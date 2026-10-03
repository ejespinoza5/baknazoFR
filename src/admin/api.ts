import { API_URL, SIN_CONEXION } from '../api/base';

/**
 * Cliente del panel de administración.
 *
 * La sesión vive en una cookie HttpOnly propia del panel (el JavaScript no la
 * ve ni la guarda): cada petición va con `credentials: 'include'`. Es otra
 * cookie que la del marketplace, así que estar dentro de uno no da acceso al
 * otro.
 */

export interface ErrorAdmin extends Error {
  status?: number;
  codigo?: string;
}

/** Avisa a la app del panel cuando la sesión terminó o pide cambiar la contraseña. */
type Oyente = (motivo: 'sin-sesion' | 'cambio-contrasena') => void;
let oyente: Oyente | null = null;
export function alPerderSesion(fn: Oyente): void {
  oyente = fn;
}

export async function pedir<T>(ruta: string, metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/api/admin${ruta}`, {
      method: metodo,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw Object.assign(new Error(SIN_CONEXION), { status: 0 }) as ErrorAdmin;
  }
  if (respuesta.status === 204) return undefined as T;
  const texto = await respuesta.text();
  let datos: { error?: string; codigo?: string } | null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }
  if (!respuesta.ok) {
    const err = new Error(datos?.error || `Error del servidor (${respuesta.status})`) as ErrorAdmin;
    err.status = respuesta.status;
    err.codigo = datos?.codigo;
    if (respuesta.status === 401 && !ruta.startsWith('/auth/login')) oyente?.('sin-sesion');
    if (datos?.codigo === 'CAMBIO_CONTRASENA_REQUERIDO') oyente?.('cambio-contrasena');
    throw err;
  }
  return datos as T;
}

export function mensajeDe(e: unknown, porDefecto = 'Algo salió mal. Inténtalo de nuevo.'): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}
