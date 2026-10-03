/**
 * La conexión en vivo del chat: un solo WebSocket por pestaña, compartido por
 * toda la app.
 *
 * Vive en un módulo y no en un componente por lo mismo que el token: si cada
 * pantalla abriera su socket, al pasar de la bandeja a una conversación se
 * cerraría uno y se abriría otro, y lo que llegara en medio se perdería.
 *
 * - **Autenticación**: el token va en el primer mensaje, no en la URL. Cuando
 *   el motor del token lo renueva, se le manda el nuevo al socket para que el
 *   servidor no lo cierre al caducar el anterior.
 * - **Reconexión**: con espera creciente (1 s, 2 s, 4 s… hasta 30 s) y algo de
 *   azar para que cien pestañas no vuelvan a la vez tras una caída. Al volver
 *   la red o la pestaña al frente se reintenta de inmediato.
 * - **Latido**: los móviles dejan sockets medio muertos al cambiar de red; sin
 *   respuesta a un ping se da por caído y se reconecta.
 * - **Envíos**: cada mensaje lleva un `clienteId` y se guarda como pendiente
 *   hasta el acuse. Si la conexión cae, se reenvía al volver, y el servidor
 *   descarta el duplicado si ya lo había guardado.
 */

import { useSyncExternalStore } from 'react';
import { API_URL } from '../api/base';
import { alCambiarSesion, sesionDeApi, tokenValido } from '../api/token';
import type { EstadoConexion, EventoChat } from '../types/chat';

const URL_WS = `${API_URL.replace(/^http/, 'ws')}/ws/chat`;
const ESPERA_MAX = 30_000;
const CADA_PING = 25_000;
const ESPERA_PONG = 10_000;

/** Códigos de cierre del servidor (ver backend `realtime/chatSocket.js`). */
const CIERRE_PROHIBIDO = 4403;

let socket: WebSocket | null = null;
let estado: EstadoConexion = 'desconectado';
let noLeidos = 0;
let activo = false;
let intentos = 0;
let tokenEnviado: string | null = null;
let temporizadorReconexion: ReturnType<typeof setTimeout> | undefined;
let temporizadorPing: ReturnType<typeof setInterval> | undefined;
let temporizadorPong: ReturnType<typeof setTimeout> | undefined;
let dejarDeOirSesion: (() => void) | null = null;

/** La conversación que se está mirando: sus mensajes no cuentan como avisos. */
let conversacionAbierta: number | null = null;

const pendientes = new Map<string, { conversacionId: number; contenido: string }>();
const oyentesEstado = new Set<() => void>();
const oyentesEventos = new Set<(evento: EventoChat) => void>();

function avisarEstado(): void {
  for (const oyente of oyentesEstado) oyente();
}

function cambiarEstado(siguiente: EstadoConexion): void {
  if (estado === siguiente) return;
  estado = siguiente;
  avisarEstado();
}

function cambiarNoLeidos(total: number): void {
  const n = Math.max(0, Math.trunc(total));
  if (n === noLeidos) return;
  noLeidos = n;
  avisarEstado();
}

function mandar(datos: unknown): boolean {
  if (socket?.readyState !== WebSocket.OPEN || estado !== 'conectado') return false;
  socket.send(JSON.stringify(datos));
  return true;
}

/* ---------- Conexión ---------- */

async function conectar(): Promise<void> {
  if (!activo || socket) return;
  cambiarEstado(intentos === 0 ? 'conectando' : 'reconectando');

  let token: string;
  try {
    token = await tokenValido();
  } catch {
    // Sin red para renovar el token: se reintenta como cualquier otra caída.
    programarReconexion();
    return;
  }
  if (!activo || socket) return;

  const nuevo = new WebSocket(URL_WS);
  socket = nuevo;

  nuevo.onopen = () => {
    tokenEnviado = token;
    nuevo.send(JSON.stringify({ t: 'auth', token }));
  };

  nuevo.onmessage = (e) => {
    let evento: EventoChat;
    try {
      evento = JSON.parse(String(e.data)) as EventoChat;
    } catch {
      return;
    }
    recibir(evento);
  };

  nuevo.onclose = (e) => {
    if (socket !== nuevo) return;
    socket = null;
    detenerLatido();
    if (!activo) return;
    // Cuenta suspendida o usuario cambiado: reintentar no lo arregla.
    if (e.code === CIERRE_PROHIBIDO) {
      cambiarEstado('desconectado');
      return;
    }
    // 4001/4401 (token caducado) también caen aquí: `tokenValido` lo renueva
    // en el próximo intento.
    programarReconexion();
  };

  // El 'close' llega siempre después: ahí se decide qué hacer.
  nuevo.onerror = () => undefined;
}

function programarReconexion(): void {
  if (!activo) return;
  cambiarEstado('reconectando');
  clearTimeout(temporizadorReconexion);
  const base = Math.min(ESPERA_MAX, 1000 * 2 ** intentos);
  const espera = base / 2 + Math.random() * (base / 2);
  intentos += 1;
  temporizadorReconexion = setTimeout(() => {
    void conectar();
  }, espera);
}

/** Si estaba esperando para reintentar, reintenta ya (volvió la red o la pestaña). */
function reconectarAhora(): void {
  if (!activo || socket) return;
  clearTimeout(temporizadorReconexion);
  intentos = 0;
  void conectar();
}

/** Un socket que no responde se cierra a mano: su 'close' podría tardar minutos. */
function darPorCaido(): void {
  const viejo = socket;
  if (!viejo) return;
  socket = null;
  detenerLatido();
  viejo.onclose = null;
  viejo.close();
  programarReconexion();
}

function iniciarLatido(): void {
  detenerLatido();
  temporizadorPing = setInterval(() => {
    if (!mandar({ t: 'ping' })) return;
    clearTimeout(temporizadorPong);
    temporizadorPong = setTimeout(darPorCaido, ESPERA_PONG);
  }, CADA_PING);
}

function detenerLatido(): void {
  clearInterval(temporizadorPing);
  clearTimeout(temporizadorPong);
}

function alVolverRed(): void {
  reconectarAhora();
}

function alCambiarVisibilidad(): void {
  if (document.visibilityState === 'visible') reconectarAhora();
}

/* ---------- Eventos del servidor ---------- */

function recibir(evento: EventoChat): void {
  switch (evento.t) {
    case 'listo':
      intentos = 0;
      cambiarEstado('conectado');
      cambiarNoLeidos(evento.noLeidos);
      iniciarLatido();
      // Lo que quedó sin acuse se reenvía; el servidor descarta duplicados.
      for (const [clienteId, p] of pendientes) {
        mandar({ t: 'enviar', clienteId, conversacionId: p.conversacionId, contenido: p.contenido });
      }
      break;
    case 'pong':
      clearTimeout(temporizadorPong);
      return;
    case 'mensaje':
      if (typeof evento.noLeidos === 'number') cambiarNoLeidos(evento.noLeidos);
      break;
    case 'conversacion_leida':
      cambiarNoLeidos(evento.noLeidos);
      break;
    case 'ack':
      pendientes.delete(evento.clienteId);
      break;
    case 'error':
      // Un envío rechazado sale de la cola: reenviarlo solo al reconectar
      // repetiría el mismo error. La burbuja ofrece reintentarlo a mano.
      if (evento.clienteId) pendientes.delete(evento.clienteId);
      break;
  }
  for (const oyente of oyentesEventos) oyente(evento);
}

/* ---------- API del módulo ---------- */

/** Abre la conexión. La llama la app al haber sesión. */
export function iniciarChat(): void {
  if (activo) return;
  activo = true;
  intentos = 0;
  window.addEventListener('online', alVolverRed);
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  // El motor del token renueva cada ~15 min: el socket recibe el nuevo para
  // que el servidor no lo cierre al caducar el que mandó al conectarse.
  dejarDeOirSesion = alCambiarSesion((s) => {
    if (s?.access_token && s.access_token !== tokenEnviado && mandar({ t: 'auth', token: s.access_token })) {
      tokenEnviado = s.access_token;
    }
  });
  void conectar();
}

/** Cierra la conexión y olvida todo. La llama la app al cerrar sesión. */
export function detenerChat(): void {
  activo = false;
  clearTimeout(temporizadorReconexion);
  detenerLatido();
  window.removeEventListener('online', alVolverRed);
  document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  dejarDeOirSesion?.();
  dejarDeOirSesion = null;
  const viejo = socket;
  socket = null;
  tokenEnviado = null;
  viejo?.close(1000, 'Sesión cerrada');
  pendientes.clear();
  conversacionAbierta = null;
  noLeidos = 0;
  cambiarEstado('desconectado');
  avisarEstado();
}

function nuevoClienteId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Manda un mensaje y devuelve su `clienteId`, que es como la pantalla lo
 * reconoce en el acuse. Sin conexión queda en cola y sale al reconectar.
 */
export function enviarMensaje(conversacionId: number, contenido: string): string {
  const clienteId = nuevoClienteId();
  pendientes.set(clienteId, { conversacionId, contenido });
  mandar({ t: 'enviar', clienteId, conversacionId, contenido });
  return clienteId;
}

/** El id de quien tiene la sesión abierta, para saber qué mensajes son propios. */
export function miUsuarioId(): string | null {
  return sesionDeApi()?.usuario.id ?? null;
}

export function fijarConversacionAbierta(id: number | null): void {
  conversacionAbierta = id;
}

export function conversacionAbiertaActual(): number | null {
  return conversacionAbierta;
}

/** Tras marcar leída por REST, el total que devolvió el servidor. */
export function fijarNoLeidos(total: number): void {
  cambiarNoLeidos(total);
}

/** Escucha todo lo que llega por el socket. Devuelve la función para dejar de oír. */
export function alEventoChat(oyente: (evento: EventoChat) => void): () => void {
  oyentesEventos.add(oyente);
  return () => {
    oyentesEventos.delete(oyente);
  };
}

function suscribirEstado(oyente: () => void): () => void {
  oyentesEstado.add(oyente);
  return () => {
    oyentesEstado.delete(oyente);
  };
}

/** Estado de la conexión, para el aviso de "reconectando". */
export function useEstadoChat(): EstadoConexion {
  return useSyncExternalStore(suscribirEstado, () => estado);
}

/** Total de mensajes sin leer, para los contadores del menú y la cabecera. */
export function useNoLeidos(): number {
  return useSyncExternalStore(suscribirEstado, () => noLeidos);
}
