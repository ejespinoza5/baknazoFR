/**
 * El hilo de soporte, compartido por toda la app: lo usan el botón flotante
 * (escritorio) y la sección de Configuración (todas las pantallas), y los dos
 * tienen que mostrar lo mismo y el mismo contador.
 *
 * No abre otra conexión: las respuestas del equipo llegan por el WebSocket del
 * chat (`lib/chatEnVivo`), igual que las notificaciones.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { contarSoporteNoLeidos, enviarSoporte, marcarSoporteLeido, obtenerSoporte } from '../api/soporte';
import { alEventoChat } from './chatEnVivo';
import type { EstadoHiloSoporte, MensajeSoporte } from '../types/soporte';

export interface EstadoSoporte {
  cargado: boolean;
  cargando: boolean;
  error: string | null;
  /** null: todavía no escribió nunca. */
  estado: EstadoHiloSoporte | null;
  mensajes: MensajeSoporte[];
  hayMas: boolean;
  noLeidos: number;
}

const INICIAL: EstadoSoporte = {
  cargado: false,
  cargando: false,
  error: null,
  estado: null,
  mensajes: [],
  hayMas: false,
  noLeidos: 0,
};

let actual: EstadoSoporte = INICIAL;
let dejarDeOir: (() => void) | null = null;
/** Cuántas vistas del hilo hay abiertas: con alguna, lo que llega ya se leyó. */
let vistas = 0;
const oyentes = new Set<() => void>();

function cambiar(parcial: Partial<EstadoSoporte>): void {
  actual = { ...actual, ...parcial };
  for (const o of oyentes) o();
}

/** Suma mensajes sin repetir: el propio llega por la respuesta y por el socket. */
function juntar(previos: MensajeSoporte[], nuevos: MensajeSoporte[]): MensajeSoporte[] {
  const vistos = new Set(previos.map((m) => m.id));
  const extra = nuevos.filter((m) => !vistos.has(m.id));
  if (extra.length === 0) return previos;
  return [...previos, ...extra].sort((a, b) => a.id - b.id);
}

export function soporteVisible(): boolean {
  return vistas > 0 && document.visibilityState === 'visible';
}

let marcando = false;
function marcarLeido(): void {
  if (marcando || actual.noLeidos === 0) return;
  marcando = true;
  cambiar({ noLeidos: 0 });
  marcarSoporteLeido()
    .catch(() => undefined)
    .finally(() => {
      marcando = false;
    });
}

function alVolverPestana(): void {
  if (soporteVisible()) marcarLeido();
}

export async function cargarSoporte(): Promise<void> {
  if (actual.cargando) return;
  cambiar({ cargando: true, error: null });
  try {
    const r = await obtenerSoporte();
    cambiar({
      cargado: true,
      cargando: false,
      estado: r.estado,
      mensajes: r.items,
      hayMas: r.hayMas,
      noLeidos: r.noLeidos,
    });
    if (soporteVisible()) marcarLeido();
  } catch (e) {
    cambiar({ cargando: false, error: e instanceof Error ? e.message : 'No pudimos cargar la conversación.' });
  }
}

export async function cargarAnterioresSoporte(): Promise<void> {
  const primero = actual.mensajes[0];
  if (!primero || !actual.hayMas || actual.cargando) return;
  cambiar({ cargando: true });
  try {
    const r = await obtenerSoporte(primero.id);
    cambiar({ cargando: false, mensajes: juntar(actual.mensajes, r.items), hayMas: r.hayMas });
  } catch {
    cambiar({ cargando: false });
  }
}

/** Lanza si no se pudo: el texto se queda en la caja para reintentar. */
export async function enviarMensajeSoporte(texto: string): Promise<void> {
  const r = await enviarSoporte(texto);
  cambiar({ estado: r.estado, mensajes: juntar(actual.mensajes, r.items), noLeidos: r.noLeidos });
  // La respuesta automática llega mientras se mira: ya está leída.
  if (soporteVisible()) marcarLeido();
}

/** Lo llama la app al haber sesión. */
export function iniciarSoporte(): void {
  if (dejarDeOir) return;
  const ponerseAlDia = () => {
    // Lo que pasó sin conexión no llegó por el socket.
    if (actual.cargado) void cargarSoporte();
    else
      contarSoporteNoLeidos()
        .then((r) => cambiar({ noLeidos: r.total }))
        .catch(() => undefined);
  };
  const quitar = alEventoChat((e) => {
    if (e.t === 'listo') ponerseAlDia();
    else if (e.t === 'soporte') {
      cambiar({
        estado: actual.estado ?? 'ABIERTO',
        // Sin cargar el hilo no se guardan sueltos: al abrirlo llega entero.
        mensajes: actual.cargado ? juntar(actual.mensajes, [e.mensaje]) : actual.mensajes,
        noLeidos: e.noLeidos,
      });
      if (e.mensaje.autor !== 'usuario' && soporteVisible()) marcarLeido();
    } else if (e.t === 'soporte_leido') cambiar({ noLeidos: e.noLeidos });
    else if (e.t === 'soporte_visto') {
      cambiar({
        mensajes: actual.mensajes.map((m) => (m.autor === 'usuario' && !m.leidoEn ? { ...m, leidoEn: e.leidoEn } : m)),
      });
    }
  });
  document.addEventListener('visibilitychange', alVolverPestana);
  dejarDeOir = () => {
    quitar();
    document.removeEventListener('visibilitychange', alVolverPestana);
  };
  ponerseAlDia();
}

/** Al cerrar sesión: nada de la cuenta anterior queda a la vista. */
export function detenerSoporte(): void {
  dejarDeOir?.();
  dejarDeOir = null;
  actual = INICIAL;
  for (const o of oyentes) o();
}

function suscribir(o: () => void): () => void {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

export function useSoporte(): EstadoSoporte {
  return useSyncExternalStore(suscribir, () => actual);
}

export function useSoporteNoLeidos(): number {
  return useSyncExternalStore(suscribir, () => actual.noLeidos);
}

/**
 * Para la vista que muestra el hilo: mientras está montada, carga lo que haya
 * y da por leído lo que llega.
 */
export function useVistaSoporte(): void {
  useEffect(() => {
    vistas += 1;
    if (!actual.cargado) void cargarSoporte();
    else if (soporteVisible()) marcarLeido();
    return () => {
      vistas -= 1;
    };
  }, []);
}
