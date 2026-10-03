import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { normalizarImagen, tieneTransparencia } from '../lib/imagen';
import BaknazoLoader from './BaknazoLoader';

/** Formatos de recorte para fotos de anuncio. */
export type FormatoRecorte = '4/3' | '1/1' | '3/1';

const PROPORCION: Record<FormatoRecorte, number> = {
  '4/3': 4 / 3,
  '1/1': 1,
  '3/1': 3,
};

const ETIQUETA_FORMATO: Record<FormatoRecorte, string> = {
  '4/3': '4:3 (feed)',
  '1/1': '1:1 (cuadrada)',
  '3/1': '3:1 (portada)',
};

interface Props {
  imagen: File;
  /** Formato de salida: se conserva el original (png/webp) o se cae a jpeg. */
  onRecortada: (archivo: File) => void;
  onCancelar: () => void;
  tamanoSalida?: number;
  /**
   * `circulo` para avatares (recorta en cuadrado y enmascara en redondo).
   * `rectangular` para fotos de anuncio, que se muestran en 4:3 en el feed y no
   * deben quedar con los bordes transparentes que deja el recorte circular.
   */
  forma?: 'circulo' | 'rectangular';
  /**
   * Formatos ofrecidos al recortar. Solo tiene efecto en `rectangular`: el
   * avatar es siempre cuadrado, así que no tiene sentido ofrecerle otra cosa.
   */
  formatos?: FormatoRecorte[];
  /** Línea extra bajo el título, p. ej. el tamaño final de una portada. */
  ayuda?: string;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error('No se pudo cargar la imagen.'));
    img.src = src;
  });
}

/** Lienzo transparente: el PNG conserva el canal alfa, el JPG se rellena. */
function prepararLienzo(
  ancho: number,
  alto: number,
  tipoOriginal: string
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; esPng: boolean } {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite procesar la imagen.');

  const esPng = tipoOriginal.toLowerCase().includes('png');
  if (!esPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
  }
  return { canvas, ctx, esPng };
}

function aArchivo(blob: Blob, nombreBase: string, esPng: boolean): File {
  // Manda lo que de verdad salió del lienzo (un PNG opaco ya viene como JPEG).
  const png = blob.type ? blob.type === 'image/png' : esPng;
  const tipo = png ? 'image/png' : 'image/jpeg';
  const nombre = `${nombreBase}.${png ? 'png' : 'jpg'}`;
  return new File([blob], nombre, { type: blob.type || tipo });
}

function aBlob(canvas: HTMLCanvasElement, esPng: boolean): Promise<Blob> {
  // Un PNG sin transparencia sale como JPEG: mucho más liviano.
  const ctx = canvas.getContext('2d');
  const png = esPng && (!ctx || tieneTransparencia(ctx, canvas.width, canvas.height));
  const tipo = png ? 'image/png' : 'image/jpeg';
  return new Promise((resolver, rechazar) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolver(blob) : rechazar(new Error('No se pudo generar la imagen.')),
      tipo,
      0.92
    )
  );
}

async function recortarComoCirculo(
  src: string,
  area: Area,
  tamanoSalida: number,
  tipoOriginal: string
): Promise<Blob> {
  const img = await cargarImagen(src);
  const { canvas, ctx, esPng } = prepararLienzo(
    tamanoSalida,
    tamanoSalida,
    tipoOriginal
  );

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2,
    0,
    Math.PI * 2
  );
  ctx.clip();

  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  return aBlob(canvas, esPng);
}

/**
 * Recorta al formato pedido, sin máscara: el `cropShape` de react-easy-crop ya
 * se encarga de spitear el lienzo.
 */
async function recortarRectangular(
  src: string,
  area: Area,
  anchoSalida: number,
  proporcion: number,
  tipoOriginal: string
): Promise<Blob> {
  const img = await cargarImagen(src);
  const altoSalida = Math.round(anchoSalida / proporcion);
  const { canvas, ctx, esPng } = prepararLienzo(
    anchoSalida,
    altoSalida,
    tipoOriginal
  );

  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return aBlob(canvas, esPng);
}

export default function RecortadorImagen({
  imagen,
  onRecortada,
  onCancelar,
  tamanoSalida = 512,
  forma = 'circulo',
  formatos = ['4/3', '1/1'],
  ayuda,
}: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formato, setFormato] = useState<FormatoRecorte>(formatos[0] ?? '4/3');

  /**
   * La imagen se endereza antes de enseñarse, no solo antes de recortarse.
   *
   * Enderezarla solo al exportar dejaba un momento en el que el encuadre se
   * veía girado, y en el caso de los avatares —que no pasan por el flujo de
   * anuncios— no se arreglaba nunca. Con la foto ya normalizada, lo que se ve
   * es lo que sale.
   */
  useEffect(() => {
    let vivo = true;
    let url: string | null = null;

    normalizarImagen(imagen).then((normalizada) => {
      if (!vivo) return;
      setArchivo(normalizada);
      url = URL.createObjectURL(normalizada);
      setSrc(url);
    });

    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imagen]);

  const circular = forma === 'circulo';
  const proporcion = PROPORCION[formato];

  /**
   * Cambiar de formato reinicia el encuadre. Si no, el `crop` de la foto
   * anterior se aplica sobre un marco de otra proporción y la imagen queda
   * descentrada en vez de centrada.
   */
  const cambiarFormato = (nuevo: FormatoRecorte) => {
    setFormato(nuevo);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const confirmar = useCallback(async () => {
    // Se recorta la imagen normalizada, no la original: es la que está en
    // pantalla, así que el resultado es exactamente lo que se está viendo.
    const fuente = archivo ?? imagen;
    if (!src || !area) return;
    setProcesando(true);
    setError(null);
    try {
      const nombreBase = fuente.name.replace(/\.[^./]+$/, '') + '_recortada';
      const blob = circular
        ? await recortarComoCirculo(src, area, tamanoSalida, fuente.type)
        : await recortarRectangular(
            src,
            area,
            tamanoSalida,
            proporcion,
            fuente.type
          );
      onRecortada(aArchivo(blob, nombreBase, fuente.type.includes('png')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo recortar la imagen.');
    } finally {
      setProcesando(false);
    }
  }, [
    src,
    archivo,
    imagen,
    area,
    circular,
    proporcion,
    tamanoSalida,
    onRecortada,
  ]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Ajustar imagen">
      <div className="fixed inset-0 z-50 overflow-y-auto bg-carbon/50 px-4 py-6 backdrop-blur-sm sm:grid sm:place-items-center">
        <div className="animate-bkn-in mx-auto w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.4)] sm:p-6">
          <h2 className="text-[19px] font-semibold tracking-tight text-carbon">
            Ajusta la imagen
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-medio">
            Arrastra para moverla y usa el deslizador para acercar o alejar.{' '}
            {circular
              ? 'Se guardará en forma de círculo.'
              : 'Lo que quede fuera del marco se descarta de la foto.'}
          </p>
          {ayuda && (
            <p className="mt-2 rounded-lg bg-background px-3 py-2 text-[12px] leading-snug text-medio">{ayuda}</p>
          )}

          {/* El formato se elige aquí y no viene impuesto. Con 4:3 fijo, una
              captura vertical salía cortada sin que hubiera forma de evitarlo. */}
          {!circular && formatos.length > 1 && (
            <div
              role="group"
              aria-label="Formato de la foto"
              className="mt-3.5 flex gap-2"
            >
              {formatos.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => cambiarFormato(opcion)}
                  aria-pressed={formato === opcion}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                    formato === opcion
                      ? 'border-carbon bg-carbon text-white'
                      : 'border-claro bg-white text-carbon hover:border-medio'
                  }`}
                >
                  {ETIQUETA_FORMATO[opcion]}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-terracota/25 bg-terracota/[0.04] px-3 py-2 text-[12px] leading-snug text-[#a32531]">
              {error}
            </p>
          )}

          <div className="relative mt-4 h-64 w-full touch-none overflow-hidden rounded-xl border border-claro bg-background sm:h-72">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={circular ? 1 : proporcion}
                cropShape={circular ? 'round' : 'rect'}
                showGrid={false}
                minZoom={1}
                maxZoom={4}
                restrictPosition
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaRecorte) => setArea(areaRecorte)}
              />
            )}
          </div>

          <label className="mt-4 flex items-center gap-3">
            <span className="text-[13px] font-medium text-medio">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              aria-label="Nivel de zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-andino"
            />
            <span className="w-9 text-right text-[12px] text-medio">
              {zoom.toFixed(1)}x
            </span>
          </label>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancelar}
              disabled={procesando}
              className="flex-1 rounded-md border border-claro py-2.5 text-[14px] font-medium text-carbon transition-colors hover:border-medio disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={procesando || !area}
              className="flex-1 rounded-md bg-amarillo py-2.5 text-[14px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99] disabled:opacity-60"
            >
              {procesando ? <BaknazoLoader tamano="boton" mensaje="Guardando" /> : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}