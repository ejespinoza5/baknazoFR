/**
 * Un mensaje del hilo de soporte, visto por el usuario. El equipo es uno solo:
 * nunca viaja qué administrador respondió.
 */
export interface MensajeSoporte {
  id: number;
  /** usuario = tú; equipo = un administrador; sistema = la respuesta automática. */
  autor: 'usuario' | 'equipo' | 'sistema';
  /** Texto plano: se pinta siempre como texto, nunca como HTML. */
  contenido: string;
  creadoEn: string;
  /** En los tuyos: cuándo lo leyó el equipo. En los suyos: cuándo los leíste. */
  leidoEn: string | null;
}

export type EstadoHiloSoporte = 'ABIERTO' | 'RESUELTO';

export interface RespuestaSoporte {
  /** null: todavía no escribiste nunca. */
  estado: EstadoHiloSoporte | null;
  /** Del más antiguo al más nuevo. */
  items: MensajeSoporte[];
  hayMas: boolean;
  noLeidos: number;
}
