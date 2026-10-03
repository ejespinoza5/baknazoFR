import { enviarAutenticado } from './token';
import type { Conversacion, RespuestaConversaciones, RespuestaMensajes } from '../types/chat';

/**
 * La parte REST del chat: la bandeja, el historial y las marcas de leído.
 * Los mensajes se envían y se reciben por el WebSocket (`lib/chatEnVivo`).
 */

export function listarConversaciones(offset = 0): Promise<RespuestaConversaciones> {
  return enviarAutenticado(`/api/chat/conversaciones${offset ? `?offset=${offset}` : ''}`, 'GET');
}

export function obtenerConversacion(id: number): Promise<Conversacion> {
  return enviarAutenticado(`/api/chat/conversaciones/${id}`, 'GET');
}

/**
 * Abre (o recupera) la conversación. Con un anuncio, la otra persona la decide
 * el servidor: siempre es quien lo publicó.
 */
export function iniciarConversacion(
  destino: { anuncioId: number } | { usuarioId: string }
): Promise<Conversacion> {
  return enviarAutenticado('/api/chat/conversaciones', 'POST', destino);
}

export function listarMensajes(id: number, antesDe?: number): Promise<RespuestaMensajes> {
  return enviarAutenticado(
    `/api/chat/conversaciones/${id}/mensajes${antesDe ? `?antesDe=${antesDe}` : ''}`,
    'GET'
  );
}

type EstadoBloqueo = { yoBloquee: boolean; meBloquearon: boolean };

/** Quien bloquea es siempre quien tiene la sesión; aquí solo va a quién. */
export function bloquearUsuario(usuarioId: string): Promise<EstadoBloqueo> {
  return enviarAutenticado('/api/chat/bloqueos', 'POST', { usuarioId });
}

export function desbloquearUsuario(usuarioId: string): Promise<EstadoBloqueo> {
  return enviarAutenticado(`/api/chat/bloqueos/${encodeURIComponent(usuarioId)}`, 'DELETE');
}

export function marcarConversacionLeida(id: number): Promise<{ leidos: number; noLeidos: number }> {
  return enviarAutenticado(`/api/chat/conversaciones/${id}/leida`, 'POST');
}
