import { enviarAutenticado } from './token';
import type {
  CategoriaNotificacion,
  PreferenciasNotificacion,
  RespuestaNotificaciones,
  Sonido,
} from '../types/notificacion';

/**
 * Las notificaciones las crea el backend. Aquí solo se leen, se marcan, se
 * borran y se configuran; las nuevas llegan en vivo por el WebSocket.
 */

export function listarNotificaciones(
  filtros: { offset?: number; soloNoLeidas?: boolean; limite?: number } = {}
): Promise<RespuestaNotificaciones> {
  const q = new URLSearchParams();
  if (filtros.offset) q.set('offset', String(filtros.offset));
  if (filtros.soloNoLeidas) q.set('estado', 'no_leidas');
  if (filtros.limite) q.set('limite', String(filtros.limite));
  const texto = q.toString();
  return enviarAutenticado(`/api/notificaciones${texto ? `?${texto}` : ''}`, 'GET');
}

export function contarNotificacionesNoLeidas(): Promise<{ total: number }> {
  return enviarAutenticado('/api/notificaciones/no-leidas', 'GET');
}

export function marcarNotificacionesLeidas(ids: number[] | 'todas'): Promise<{ noLeidas: number }> {
  return enviarAutenticado('/api/notificaciones/leidas', 'POST', { ids });
}

export function eliminarNotificacion(id: number): Promise<{ noLeidas: number }> {
  return enviarAutenticado(`/api/notificaciones/${id}`, 'DELETE');
}

export function obtenerPreferenciasNotificacion(): Promise<PreferenciasNotificacion> {
  return enviarAutenticado('/api/notificaciones/preferencias', 'GET');
}

export function guardarPreferenciasNotificacion(cambios: {
  categorias?: Partial<Record<CategoriaNotificacion, { app?: boolean; push?: boolean }>>;
  sonido?: Sonido;
}): Promise<PreferenciasNotificacion> {
  return enviarAutenticado('/api/notificaciones/preferencias', 'PUT', cambios);
}

/** El token FCM de este navegador, tras aceptar el permiso. Va en el cuerpo. */
export function registrarDispositivoPush(token: string): Promise<{ registrado: boolean }> {
  return enviarAutenticado('/api/notificaciones/dispositivos', 'POST', { token });
}

export function eliminarDispositivoPush(token: string): Promise<{ registrado: boolean }> {
  return enviarAutenticado('/api/notificaciones/dispositivos', 'DELETE', { token });
}
