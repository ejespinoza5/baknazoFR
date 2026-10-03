import { enviarAutenticado } from './token';
import type { RespuestaSoporte } from '../types/soporte';

/**
 * El hilo del usuario con el equipo de Baknazo. Se escribe por REST (no hay
 * prisa de milisegundos y así cada envío tiene su respuesta); las respuestas
 * del equipo llegan en vivo por el WebSocket del chat.
 */

export function obtenerSoporte(antesDe?: number): Promise<RespuestaSoporte> {
  return enviarAutenticado(`/api/soporte${antesDe ? `?antesDe=${antesDe}` : ''}`, 'GET');
}

/** Devuelve lo creado: tu mensaje y, si el hilo se abrió, la respuesta automática. */
export function enviarSoporte(contenido: string): Promise<RespuestaSoporte> {
  return enviarAutenticado('/api/soporte/mensajes', 'POST', { contenido });
}

export function marcarSoporteLeido(): Promise<{ noLeidos: number }> {
  return enviarAutenticado('/api/soporte/leido', 'POST');
}

export function contarSoporteNoLeidos(): Promise<{ total: number }> {
  return enviarAutenticado('/api/soporte/no-leidos', 'GET');
}
