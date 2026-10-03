import { descargarAutenticado, enviarAutenticado } from './token';
import type {
  EstadoPostulacion,
  PostulacionRecibida,
  RespuestaEnviadas,
  RespuestaRecibidas,
  RespuestaVacantes,
} from '../types/anuncio';

/**
 * POST /api/anuncios/:id/postulaciones (multipart).
 *
 * El CV va ya comprimido por `lib/pdf`; el backend vuelve a comprobar que sea
 * un PDF de verdad y que no pase de 5 MB.
 */
export function postular(
  anuncioId: number,
  datos: { cv: File; mensaje?: string; telefono?: string; respuestas?: Record<string, string> }
): Promise<{ id: number; estado: EstadoPostulacion }> {
  const form = new FormData();
  form.append('cv', datos.cv, datos.cv.name);
  if (datos.mensaje?.trim()) form.append('mensaje', datos.mensaje.trim());
  if (datos.telefono?.trim()) form.append('telefono', datos.telefono.trim());
  // Las respuestas del cuestionario, por id de pregunta (el backend las valida).
  if (datos.respuestas && Object.keys(datos.respuestas).length > 0) {
    form.append('respuestas', JSON.stringify(datos.respuestas));
  }
  return enviarAutenticado(`/api/anuncios/${anuncioId}/postulaciones`, 'POST', form);
}

export function listarRecibidas(
  filtros: { anuncio?: number; estado?: EstadoPostulacion; offset?: number } = {}
): Promise<RespuestaRecibidas> {
  const q = new URLSearchParams();
  if (filtros.anuncio) q.set('anuncio', String(filtros.anuncio));
  if (filtros.estado) q.set('estado', filtros.estado);
  if (filtros.offset) q.set('offset', String(filtros.offset));
  const texto = q.toString();
  return enviarAutenticado(`/api/postulaciones/recibidas${texto ? `?${texto}` : ''}`, 'GET');
}

/** Solo negocios: sus vacantes con el anuncio y las cifras de candidatos. */
export function listarVacantes(): Promise<RespuestaVacantes> {
  return enviarAutenticado('/api/postulaciones/vacantes', 'GET');
}

export function listarEnviadas(offset = 0): Promise<RespuestaEnviadas> {
  return enviarAutenticado(`/api/postulaciones/enviadas${offset ? `?offset=${offset}` : ''}`, 'GET');
}

export function actualizarPostulacion(
  id: number,
  cambios: { estado?: Exclude<EstadoPostulacion, 'NUEVA'>; notaInterna?: string | null }
): Promise<PostulacionRecibida> {
  return enviarAutenticado(`/api/postulaciones/${id}`, 'PATCH', cambios);
}

export function retirarPostulacion(id: number): Promise<void> {
  return enviarAutenticado(`/api/postulaciones/${id}`, 'DELETE');
}

/**
 * Abre el CV en una pestaña nueva (o lo descarga si el navegador no muestra PDF).
 *
 * La pestaña se abre ANTES de pedir el archivo: si se abriera después del
 * `await`, el navegador ya no lo consideraría un clic del usuario y la
 * bloquearía como ventana emergente.
 */
export async function abrirCv(id: number, nombre: string): Promise<void> {
  const pestana = window.open('', '_blank');
  try {
    const blob = await descargarAutenticado(`/api/postulaciones/${id}/cv`);
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    if (pestana) {
      pestana.location.href = url;
    } else {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
    }
    // Se libera cuando la pestaña ya tuvo tiempo de cargarlo.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    pestana?.close();
    throw e;
  }
}
