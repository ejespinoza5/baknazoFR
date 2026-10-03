import { useSyncExternalStore } from 'react';
import { pedir } from './api';

/**
 * Lo que espera atención en el panel: anuncios en revisión y anuncios con
 * denuncias abiertas. El servidor solo devuelve lo que los permisos de cada
 * uno le dejan ver.
 *
 * El panel no usa el WebSocket del marketplace (otra sesión), así que se
 * pregunta cada 45 s y al volver a la pestaña. Es una consulta liviana.
 */

export interface Contadores {
  pendientes?: number;
  denunciados?: number;
  /** Conversaciones de soporte con mensajes sin leer. */
  soporte?: number;
}

const CADA_MS = 45_000;

let contadores: Contadores = {};
let temporizador: ReturnType<typeof setInterval> | undefined;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const o of oyentes) o();
}

/** Vuelve a contar ya (p. ej. tras aprobar o rechazar algo). */
export async function refrescarAvisos(): Promise<void> {
  try {
    const r = await pedir<Contadores>('/contadores');
    if (r.pendientes !== contadores.pendientes || r.denunciados !== contadores.denunciados || r.soporte !== contadores.soporte) {
      contadores = r;
      avisar();
    }
  } catch {
    // Sin red o sin sesión: se intenta en la próxima vuelta.
  }
}

const alVolver = () => {
  if (document.visibilityState === 'visible') void refrescarAvisos();
};

export function iniciarAvisos(): () => void {
  void refrescarAvisos();
  temporizador = setInterval(() => void refrescarAvisos(), CADA_MS);
  document.addEventListener('visibilitychange', alVolver);
  return () => {
    clearInterval(temporizador);
    document.removeEventListener('visibilitychange', alVolver);
    contadores = {};
  };
}

function suscribir(o: () => void): () => void {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

export function useAvisos(): Contadores {
  return useSyncExternalStore(suscribir, () => contadores);
}
