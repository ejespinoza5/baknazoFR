/**
 * Pasa una ruta de imagen del backend a una URL que el navegador pueda pedir.
 *
 * El backend devuelve la ruta tal cual (`/uploads/...`) y eso solo funciona si
 * la app se sirve desde el mismo dominio que la API. En cuanto se sirve desde
 * otro —el caso normal, que la app está en la red local y la API en su
 * subdominio— hay que anteponer el origen, o las imágenes salen rotas.
 *
 * Una URL completa se devuelve tal cual: el backend a veces ya la manda
 * absoluta, y anteponerle el origen la dejaría inválida.
 */
export function urlCompleta(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Lo que hay que hacerle a una imagen antes de usarla en un anuncio.
 *
 * Hay dos problemas que no se ven en el código pero se ven en la pantalla.
 */
import { API_URL } from '../api/base';

/** Lado mayor, en píxeles, de la imagen que se guarda y se sube. */
export const LADO_MAXIMO = 1600;

/** JPEG bajo: fotos de teléfono pesan mucho y aquí no se nota la pérdida. */
const CALIDAD = 0.88;

/**
 * Si el navegador sabe aplicar la orientación EXIF, que es lo que decide si una
 * foto tomada en vertical sale tumbada.
 *
 * No todos lo hacen igual: la mayoría respeta la etiqueta al pintar un `<img>`,
 * pero nunca fue una obligación del estándar y hay navegadores que se la pasan
 * por alto. Por eso el recorte, que dibuja sobre un canvas, salía girado 90
 * grados en algunos dispositivos y en otros no.
 */
const PUEDE_ORIENTAR =
  typeof createImageBitmap === 'function' &&
  typeof HTMLCanvasElement !== 'undefined';

function extensionSegun(tipo: string, original: string): string {
  if (tipo === 'image/png') return 'png';
  if (tipo === 'image/webp') return 'webp';
  if (tipo === 'image/jpeg') return 'jpg';
  const punto = original.lastIndexOf('.');
  return punto > 0 ? original.slice(punto + 1) : 'jpg';
}

/** Lee la imagen con la orientación ya aplicada, si el navegador sabe. */
async function leerOrientada(archivo: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (PUEDE_ORIENTAR) {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch {
      // Safari antiguo o formatos que no admite: se intenta por la otra vía.
    }
  }

  return await new Promise<HTMLImageElement | null>((resolver) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolver(null);
    };
    img.src = url;
  });
}

function dimensiones(img: ImageBitmap | HTMLImageElement) {
  // `naturalWidth` solo existe en HTMLImageElement, así que sirve para
  // separar los dos casos. Preguntar por `width` no vale: los dos lo tienen.
  return 'naturalWidth' in img
    ? { ancho: img.naturalWidth, alto: img.naturalHeight }
    : { ancho: img.width, alto: img.height };
}

/**
 * Si el lienzo tiene algún píxel transparente. Un PNG que no lo tiene es una
 * foto como cualquier otra y se sube como JPEG: pesa diez veces menos. Antes se
 * conservaba en PNG y unas pocas fotos pasaban del límite del servidor, que
 * cortaba la subida (el navegador lo mostraba como un error de CORS).
 */
export function tieneTransparencia(ctx: CanvasRenderingContext2D, ancho: number, alto: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, ancho, alto);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  } catch {
    return true; // sin poder leerlo, se respeta el formato original
  }
}

function cerrar(img: ImageBitmap | HTMLImageElement) {
  if ('close' in img) img.close();
}

/**
 * Deja la imagen derecha y acotada, **sin recortar nada**.
 *
 * Son dos cosas separadas y conviene no confundirlas:
 *
 * - **Orientación**: la foto del teléfono viene con una etiqueta EXIF que dice
 *   "gira 90°". Sin aplicar esa instrucción, sale tumbada.
 * - **Tamaño**: una foto de móvil pesa 4 megapíxeles o más. Sin acotarla, sube
 *   entera y la descarga se hace pesada para una miniatura.
 *
 * Lo que nunca hace es recortar. El recorte es decisión del usuario y vive en
 * `RecortadorImagen`; esta función solo evita que la foto llegue deformada.
 *
 * Si algo falla devuelve el archivo original sin tocar: es preferible subir una
 * foto que quizá salga girada a no subirla.
 */
export async function normalizarImagen(archivo: File): Promise<File> {
  if (!PUEDE_ORIENTAR) return archivo;

  const img = await leerOrientada(archivo);
  if (!img) return archivo;

  try {
    const { ancho, alto } = dimensiones(img);
    if (!ancho || !alto) return archivo;

    // Encaja la imagen dentro del lado máximo conservando su proporción. Se
    // calcula sobre el lado largo, que es el que manda: es el que hace pesada
    // una foto en vertical.
    const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
    const destinoAncho = Math.max(1, Math.round(ancho * escala));
    const destinoAlto = Math.max(1, Math.round(alto * escala));

    const lienzo = document.createElement('canvas');
    lienzo.width = destinoAncho;
    lienzo.height = destinoAlto;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return archivo;

    ctx.drawImage(img, 0, 0, destinoAncho, destinoAlto);

    // WEBP y JPEG se conservan. PNG solo si de verdad usa transparencia (un
    // logo); si no, va como JPEG. AVIF no lo escriben todos los navegadores en
    // un canvas, así que también pasa a JPEG.
    const candidato = archivo.type;
    const tipo =
      candidato === 'image/webp' || candidato === 'image/jpeg'
        ? candidato
        : candidato === 'image/png' && tieneTransparencia(ctx, destinoAncho, destinoAlto)
          ? 'image/png'
          : 'image/jpeg';

    const blob = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, tipo, tipo === 'image/png' ? undefined : CALIDAD)
    );
    if (!blob) return archivo;

    const nombre =
      archivo.name.replace(/\.[^./]+$/, '') + '.' + extensionSegun(blob.type, archivo.name);

    return new File([blob], nombre, { type: blob.type || tipo });
  } catch {
    return archivo;
  } finally {
    cerrar(img);
  }
}
