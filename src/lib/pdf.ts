/**
 * Preparar la hoja de vida antes de subirla: validar y comprimir el PDF.
 *
 * La compresión es sin pérdida: `pdf-lib` vuelve a escribir el documento con
 * "object streams", que agrupa y comprime la estructura interna. En PDFs
 * exportados desde Word o Canva suele ahorrar entre un 10 y un 50 %; en un PDF
 * escaneado (que es una foto por página) casi nada, porque las imágenes ya van
 * comprimidas. Si el resultado no es más pequeño, se sube el original tal cual.
 *
 * La librería se carga solo al llamar aquí: pesa unos cientos de KB y no tiene
 * sentido que la descargue quien nunca se postula.
 */

export const MAX_BYTES_CV = 5 * 1024 * 1024;
/** Por encima de esto ni se intenta: el navegador del celular sufriría. */
const MAX_BYTES_ENTRADA = 25 * 1024 * 1024;

export interface CvPreparado {
  archivo: File;
  bytesOriginal: number;
  bytesFinal: number;
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

async function esPdf(archivo: File): Promise<boolean> {
  const cabecera = new Uint8Array(await archivo.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...cabecera) === '%PDF-';
}

export async function prepararCv(archivo: File): Promise<CvPreparado> {
  if (!(await esPdf(archivo))) {
    throw new Error('El archivo no es un PDF. Exporta tu hoja de vida como PDF e inténtalo de nuevo.');
  }
  if (archivo.size > MAX_BYTES_ENTRADA) {
    throw new Error(
      `El PDF pesa ${formatearBytes(archivo.size)}. Intenta exportarlo de nuevo con menos imágenes.`
    );
  }

  let final: File = archivo;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const documento = await PDFDocument.load(await archivo.arrayBuffer(), {
      // Un PDF con contraseña de edición se puede leer igual; lo que no se toca
      // es su contenido.
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const bytes = await documento.save({ useObjectStreams: true, addDefaultPage: false });
    if (bytes.byteLength < archivo.size) {
      final = new File([bytes as BlobPart], nombreCv(archivo.name), { type: 'application/pdf' });
    }
  } catch {
    // Un PDF que pdf-lib no entiende se sube sin comprimir: el servidor decide.
  }

  if (final.size > MAX_BYTES_CV) {
    throw new Error(
      `Tu hoja de vida pesa ${formatearBytes(final.size)} incluso comprimida, y el máximo es ${formatearBytes(
        MAX_BYTES_CV
      )}. Quita fotos o expórtala en calidad "para web".`
    );
  }

  return { archivo: final, bytesOriginal: archivo.size, bytesFinal: final.size };
}

function nombreCv(nombre: string): string {
  return /\.pdf$/i.test(nombre) ? nombre : `${nombre}.pdf`;
}
