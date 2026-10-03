import type { Pilar } from '../lib/pilares';
import type { Notificacion, Sonido } from './notificacion';
import type { MensajeSoporte } from './soporte';

/** La tarjeta de un anuncio citado en el chat. */
export interface AnuncioChat {
  id: number;
  slug: string;
  titulo: string;
  pilar: Pilar;
  precio: string | null;
  moneda: string;
  portada: string | null;
  /** Vendido, pausado o borrado: se sigue mostrando, pero ya no está a la venta. */
  disponible: boolean;
}

export interface MensajeChat {
  id: number;
  conversacionId: number;
  remitenteId: string;
  /** Texto plano: se pinta siempre como texto, nunca como HTML. */
  contenido: string;
  /** Sobre qué anuncio se escribió (lo decide el servidor). */
  anuncioId: number | null;
  creadoEn: string;
  /** Llegó a algún dispositivo del destinatario. */
  entregadoEn: string | null;
  /** El destinatario abrió la conversación. */
  leidoEn: string | null;
  /** Solo en los propios: el id con el que se envió desde este navegador. */
  clienteId?: string;
}

export interface Conversacion {
  id: number;
  creadoEn: string;
  ultimoMensajeEn: string | null;
  /** La otra persona: quien publicó o quien te escribió. */
  otro: { id: string; nombre: string; foto: string | null; esNegocio: boolean };
  /**
   * El anuncio del que se habla ahora. Hay una sola conversación por persona:
   * al escribir por otro anuncio, este cambia y el historial se conserva.
   */
  anuncio: AnuncioChat | null;
  ultimoMensaje: MensajeChat | null;
  noLeidos: number;
  /** Con un bloqueo en cualquier sentido, nadie puede escribir. */
  bloqueo: { yoBloquee: boolean; meBloquearon: boolean };
}

export interface RespuestaConversaciones {
  items: Conversacion[];
  hayMas: boolean;
}

export interface RespuestaMensajes {
  items: MensajeChat[];
  hayMas: boolean;
  /** Las tarjetas de los anuncios citados en la página, por id. */
  anuncios: Record<string, AnuncioChat>;
}

export type EstadoConexion = 'desconectado' | 'conectando' | 'conectado' | 'reconectando';

/** Lo que llega por el WebSocket. */
export type EventoChat =
  | { t: 'listo'; usuarioId: string; noLeidos: number }
  | {
      t: 'mensaje';
      mensaje: MensajeChat;
      /** La tarjeta del anuncio del mensaje, si tiene. */
      anuncio?: AnuncioChat | null;
      /** Solo cuando el mensaje es de otra persona. */
      remitente?: { id: string; nombre: string };
      noLeidos?: number;
    }
  | {
      t: 'bloqueo';
      conversacionId: number | null;
      /** La otra persona, vista desde quien recibe el aviso. */
      usuarioId: string;
      yoBloquee: boolean;
      meBloquearon: boolean;
    }
  | { t: 'ack'; clienteId: string; mensaje: MensajeChat }
  | { t: 'error'; clienteId?: string | null; codigo: number; mensaje: string }
  | { t: 'entregado'; conversacionId: number; hastaId: number; entregadoEn: string }
  | { t: 'leido'; conversacionId: number; hastaId: number; leidoEn: string }
  | { t: 'conversacion_leida'; conversacionId: number; noLeidos: number }
  /* Las notificaciones viajan por el mismo socket que el chat. */
  | { t: 'notificacion'; notificacion: Notificacion; noLeidas: number; sonido: Sonido }
  | { t: 'notificaciones_leidas'; noLeidas: number }
  /* Y el soporte: un mensaje nuevo del hilo, lo leíste en otra pestaña, o lo leyó el equipo. */
  | { t: 'soporte'; mensaje: MensajeSoporte; noLeidos: number }
  | { t: 'soporte_leido'; noLeidos: number }
  | { t: 'soporte_visto'; leidoEn: string }
  | { t: 'pong' };
