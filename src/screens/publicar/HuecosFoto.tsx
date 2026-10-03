import { useEffect, useState } from 'react';
import RecortadorImagen from '../../components/RecortadorImagen';
import { IconoCamara, IconoPapelera, IconoRecortar } from '../../components/Iconos';
import { notificarAviso } from '../../lib/notificar';
import { OCULTO_CON_RATON } from '../../lib/tactil';
import { normalizarImagen } from '../../lib/imagen';
import { fotoEntera } from '../config/ui';
import { FORMATOS_FOTO } from './datos';
import FormatosAceptados from '../../components/FormatosAceptados';

interface Props {
  fotos: (File | null)[];
  onCambio: (fotos: (File | null)[]) => void;
  /** Vienen de GET /api/catalogos: el límite es del servidor, no nuestro. */
  maxFotos: number;
  maxBytes: number;
}

/**
 * Una foto ya elegida. Crea la URL temporal una sola vez y la revoca al
 * desmontar: hacerlo en el render del padre repetiría la asignación en cada
 * tecla que se pulsa y dejaría cientos de blobs vivos.
 */
function FotoElegida({
  foto,
  indice,
  esPortada,
  onQuitar,
  onAjustar,
}: {
  foto: File;
  indice: number;
  esPortada: boolean;
  onQuitar: () => void;
  onAjustar: () => void;
}) {
  const [url] = useState(() => URL.createObjectURL(foto));

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <>
      <img
        src={url}
        alt={`Foto ${indice + 1} del anuncio`}
        className={fotoEntera}
      />
      <button
        type="button"
        onClick={onAjustar}
        aria-label={`Ajustar la foto ${indice + 1}`}
        className="absolute top-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-carbon"
      >
        <IconoRecortar />
      </button>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar foto ${indice + 1}`}
        className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-danger-deep"
      >
        <IconoPapelera />
      </button>
      {esPortada && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-carbon/70 px-2 py-0.5 text-[10px] font-medium text-white">
          Portada
        </span>
      )}
    </>
  );
}

/**
 * Los seis huecos de foto del anuncio. El primero es la portada, la que se ve
 * en la tarjeta del feed.
 *
 * El hueco vacío es una `<label>` con un input real: al tocarla el sistema abre
 * su selector. Se usa `accept="image/*"` a propósito, porque con una lista de
 * extensiones Android esconde la cámara y solo deja elegir archivos.
 *
 * Ese selector no basta: en iOS `accept="image/*"` abre la fototeca y no ofrece
 * cámara, así que hay un botón aparte con `capture="environment"` que la abre de
 * frente. Rellena el primer hueco libre, que es donde el usuario esperaría
 * encontrarla, y solo aparece con pantalla táctil porque en escritorio el
 * atributo no hace nada y el botón repetiría el diálogo de archivos.
 */
export default function HuecosFoto({ fotos, onCambio, maxFotos, maxBytes }: Props) {
  const [recortando, setRecortando] = useState<{
    indice: number;
    archivo: File;
  } | null>(null);

  const completas = fotos.filter(Boolean).length;
  const lleno = completas >= maxFotos;
  /** El primer hueco libre: la foto recién tomada entra ahí. */
  const libre = fotos.findIndex((foto) => !foto);

  const reemplazar = (indice: number, archivo: File | null) => {
    const siguiente = [...fotos];
    siguiente[indice] = archivo;
    onCambio(siguiente);
  };

  const recibir = async (indice: number, lista: FileList | null) => {
    const archivo = lista?.[0];
    if (!archivo) return;
    // El input es de un solo uso: vaciarlo permite volver a elegir la misma foto.
    if (!FORMATOS_FOTO.test(archivo.name)) {
      notificarAviso('Esa imagen no es JPG, PNG, WEBP ni AVIF.');
      return;
    }
    if (archivo.size > maxBytes) {
      notificarAviso(
        `La imagen supera los ${Math.round(maxBytes / 1024 / 1024)} MB. Elige una más liviana.`
      );
      return;
    }

    // Entra tal cual, sin recortar. Antes se abría el recortador solo al elegir
    // la foto, y como imponía 4:3 con `restrictPosition`, una foto vertical
    // perdía la mitad sin que hubiera manera de evitarlo: se recortaba antes de
    // que el usuario llegara a ver qué se estaba cortando.
    //
    // Antes de guardarla se endereza: la foto del teléfono trae una instrucción
    // de rotación que no todos los navegadores respetan, y por eso salía
    // tumbada. Acotarla a 1600 px hace el trabajo que antes hacía el recorte, sin
    // recortar.
    reemplazar(indice, await normalizarImagen(archivo));
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {fotos.map((foto, indice) => {
          const esPortada = indice === 0;
          const bloqueado = !foto && lleno && !esPortada;
          return (
            <div key={indice} className="relative">
              {foto ? (
                <FotoElegida
                  foto={foto}
                  indice={indice}
                  esPortada={esPortada}
                  onQuitar={() => reemplazar(indice, null)}
                  onAjustar={() => setRecortando({ indice, archivo: foto })}
                />
              ) : (
                <label
                  className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition-colors ${
                    bloqueado
                      ? 'cursor-not-allowed border-border/60 bg-background/50'
                      : 'cursor-pointer border-border bg-white hover:border-muted'
                  }`}
                >
                  <IconoCamara />
                  <span className="px-2 text-[11.5px] leading-tight font-medium text-muted">
                    {bloqueado ? 'Sin cupo' : `Foto ${indice + 1}`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={bloqueado}
                    onChange={async (e) => {
                      await recibir(indice, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* La cámara directa. En móvil el selector del hueco no la ofrece, y en
          escritorio este botón no hace nada útil, así que se esconde. */}
      {!lleno && (
        <label
          className={`mt-2.5 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-white px-3.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-muted active:bg-background has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent sm:w-auto ${OCULTO_CON_RATON}`}
        >
          <IconoCamara />
          Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              if (libre >= 0) await recibir(libre, e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}

      <p className="mt-2.5 text-[12px] text-muted">
        {lleno
          ? `Usaste las ${maxFotos} fotos. Quita una para cambiarla.`
          : `La primera es la portada. Llevas ${completas} de ${maxFotos}.`}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Las fotos se publican enteras. Si quieres recortarlas, toca el botón de
        ajustar de cada una.
      </p>
      <FormatosAceptados maxBytes={maxBytes} />

      {recortando && (
        <RecortadorImagen
          imagen={recortando.archivo}
          forma="rectangular"
          tamanoSalida={1200}
          onCancelar={() => setRecortando(null)}
          onRecortada={(archivo) => {
            reemplazar(recortando.indice, archivo);
            setRecortando(null);
          }}
        />
      )}
    </>
  );
}
