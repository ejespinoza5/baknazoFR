/**
 * El contador de la campana y el sonido elegido, compartidos por toda la app.
 *
 * No abre otra conexión: las notificaciones llegan por el WebSocket del chat
 * (`lib/chatEnVivo`). Al conectarse (y al reconectar) se pide el total al
 * servidor, porque lo que pasó sin conexión no llegó por el socket.
 */

import { useSyncExternalStore } from 'react';
import { contarNotificacionesNoLeidas, obtenerPreferenciasNotificacion } from '../api/notificaciones';
import { alEventoChat } from './chatEnVivo';
import type { Sonido } from '../types/notificacion';

let noLeidas = 0;
let sonido: Sonido = 'campana';
let dejarDeOir: (() => void) | null = null;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

export function fijarNoLeidasNotificaciones(total: number): void {
  const n = Math.max(0, Math.trunc(total));
  if (n === noLeidas) return;
  noLeidas = n;
  avisar();
}

export function fijarSonido(nuevo: Sonido): void {
  if (nuevo === sonido) return;
  sonido = nuevo;
  avisar();
}

export function sonidoActual(): Sonido {
  return sonido;
}

function ponerseAlDia(): void {
  contarNotificacionesNoLeidas()
    .then((r) => fijarNoLeidasNotificaciones(r.total))
    .catch(() => undefined);
  obtenerPreferenciasNotificacion()
    .then((p) => fijarSonido(p.sonido))
    .catch(() => undefined);
}

/** Lo llama la app al haber sesión. */
export function iniciarNotificaciones(): void {
  if (dejarDeOir) return;
  dejarDeOir = alEventoChat((e) => {
    if (e.t === 'listo') ponerseAlDia();
    else if (e.t === 'notificacion') {
      fijarNoLeidasNotificaciones(e.noLeidas);
      fijarSonido(e.sonido);
    } else if (e.t === 'notificaciones_leidas') fijarNoLeidasNotificaciones(e.noLeidas);
  });
  ponerseAlDia();
}

/** Al cerrar sesión: nada de la cuenta anterior queda a la vista. */
export function detenerNotificaciones(): void {
  dejarDeOir?.();
  dejarDeOir = null;
  noLeidas = 0;
  sonido = 'campana';
  avisar();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function useNoLeidasNotificaciones(): number {
  return useSyncExternalStore(suscribir, () => noLeidas);
}

export function useSonido(): Sonido {
  return useSyncExternalStore(suscribir, () => sonido);
}
