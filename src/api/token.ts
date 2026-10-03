/**
 * Motor del token de acceso.
 *
 * El access token dura 15 minutos, así que una sesión larga necesita refresco o
 * se cae sola. Aquí vive, y no en un componente, por dos razones:
 *
 * 1. Es la única fuente de verdad. Si cada pantalla guardara su token, dos
 *    peticiones simultáneas acabarían con tokens distintos y el que se quedaba
 *    viejo se pisaría al guardarse.
 *
 * 2. El backend rota el refresh token: al usarlo, revoca el anterior y emite un
 *    par nuevo. Si dos peticiones renuevan a la vez con el mismo refresh token,
 *    la segunda parece un robo y el backend responde 401 cerrando TODAS las
 *    sesiones del usuario. Por eso `refrescoEnVuelo` deduplica: la segunda
 *    llamada espera a la primera en vez de duplicar la petición.
 *
 * El plan es: refrescar antes de que caduque (proactivo), reintentar una vez
 * ante un 401 (reactivo), y solo cerrar la sesión si el refresh token también
 * fue rechazado.
 */

import { API_URL, SIN_CONEXION } from './base';
import { porVencer } from '../lib/jwt';
import type { Sesion, Usuario } from '../types/auth';

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ErrorApi extends Error {
  status?: number;
  datos?: unknown;
}

function errorApi(mensaje: string, estado?: number, datos?: unknown): ErrorApi {
  const err = new Error(mensaje) as ErrorApi;
  if (estado !== undefined) err.status = estado;
  if (datos !== undefined) err.datos = datos;
  return err;
}

/** El estado HTTP de un error de la API, o undefined si no lo tiene. */
export function estadoDe(e: unknown): number | undefined {
  return e instanceof Error ? (e as ErrorApi).status : undefined;
}

/** true cuando el backend rechazó la credencial (401/403). */
export function esNoAutorizado(e: unknown): boolean {
  const estado = estadoDe(e);
  return estado === 401 || estado === 403;
}

function mensajeDeError(datos: unknown, estado: number): string {
  if (datos && typeof datos === 'object') {
    const { message, error } = datos as { message?: unknown; error?: unknown };
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message) return message;
    if (typeof error === 'string' && error) return error;
  }
  if (estado === 401) return 'Tu sesión expiró. Vuelve a entrar.';
  if (estado === 403) return 'No tienes permiso para eso.';
  if (estado === 429) return 'Demasiadas publicaciones. Intenta más tarde.';
  return `Error del servidor (${estado}).`;
}

/* ---------- Estado del módulo ---------- */

/**
 * La sesión vive solo en memoria: ni el usuario ni los tokens se escriben en
 * localStorage/sessionStorage. Lo único que sobrevive a recargar es la cookie
 * HttpOnly del refresh token, y con ella `restaurarSesion` recupera todo al
 * arrancar. "Mantener sesión iniciada" lo decide la cookie (con o sin fecha de
 * caducidad), no el almacenamiento.
 */
let sesion: Sesion | null = null;

// Versiones anteriores guardaban la sesión aquí; se borra para no dejar datos
// del usuario en disco.
try {
  localStorage.removeItem('baknazo.sesion');
  sessionStorage.removeItem('baknazo.sesion');
} catch {
  // storage bloqueado: no hay nada que limpiar
}

/** El refresco en curso, para que N llamadas compartan una sola petición. */
let refrescoEnVuelo: Promise<Sesion> | null = null;

const oyentes = new Set<(s: Sesion | null) => void>();

function avisar(siguiente: Sesion | null): void {
  sesion = siguiente;
  for (const oyente of oyentes) oyente(siguiente);
}

/** Notifica los cambios de sesión a quien se suscriba (normalmente `App`). */
export function alCambiarSesion(
  oyente: (s: Sesion | null) => void
): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function sesionDeApi(): Sesion | null {
  return sesion;
}

/** Entra en sesión y avisa a la app. La cookie ya la puso el backend. */
export function entrar(siguiente: Sesion): void {
  refrescoEnVuelo = null;
  avisar(siguiente);
}

/**
 * Al abrir la app: si el navegador tiene la cookie del refresh token, la canjea
 * y devuelve la sesión (con el usuario, que viene en la respuesta). Sin cookie,
 * o con una caducada, devuelve null y la app va al login.
 *
 * Lanza solo si no hay red, para que la app pueda distinguirlo de "sin sesión".
 */
export async function restaurarSesion(): Promise<Sesion | null> {
  try {
    return await refrescar();
  } catch (e) {
    const estado = estadoDe(e);
    if (estado !== undefined && estado < 500) return null;
    throw e;
  }
}

/**
 * Cierra la sesión en la app y en el backend.
 *
 * La cookie del refresh token es HttpOnly: el JavaScript no puede borrarla, así
 * que se le pide al backend que la revoque y la elimine. No se espera la
 * respuesta: sin red la sesión igual se cierra en pantalla.
 */
export function salir(): void {
  refrescoEnVuelo = null;
  avisar(null);
  fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
}

/** Reemplaza solo los tokens, conservando el usuario ya guardado. */
export function renovarTokens(tokens: {
  access_token: string;
  expira_en: string;
}): void {
  if (!sesion) return;
  const siguiente: Sesion = { ...sesion, ...tokens };
  avisar(siguiente);
}

/**
 * Refleja un cambio del usuario (por ejemplo tras guardar el perfil) en la
 * sesión.
 *
 * Pasa por el motor a propósito: si la pantalla guardara su propia copia, la
 * del motor quedaría desfasada y el próximo aviso la pisaría con la antigua.
 */
export function actualizarUsuario(usuario: Usuario): void {
  if (!sesion) return;
  const siguiente: Sesion = { ...sesion, usuario: { ...sesion.usuario, ...usuario } };
  avisar(siguiente);
}

/* ---------- Refresco ---------- */

/**
 * Un access token válido, refrescando antes si ya está por caducar.
 *
 * Lanza si no hay sesión o si el refresh token fue rechazado: en ese caso ya no
 * hay nada que hacer salvo volver al login.
 */
export async function tokenValido(): Promise<string> {
  if (!sesion) throw errorApi('No hay sesión iniciada.', 401);
  // Vacío = recién recargada la página: el access token solo vive en memoria.
  if (!sesion.access_token || porVencer(sesion.access_token)) {
    return (await refrescar()).access_token;
  }
  return sesion.access_token;
}

/**
 * Token válido o null, sin lanzar.
 *
 * Para endpoints que son públicos pero se-personalizan con la sesión (feed,
 * detalle, contacto): si no hay sesión se sigue como anónimo, y si el refresco
 * falla porque no hay red se usa el token en caché mientras siga sirviendo, en
 * vez de convertir un fallo de red en un error de pantalla completa.
 */
export async function tokenOpcional(): Promise<string | null> {
  if (!sesion) return null;
  if (sesion.access_token && !porVencer(sesion.access_token)) {
    return sesion.access_token;
  }
  try {
    return (await refrescar()).access_token;
  } catch (e) {
    if (estadoDe(e) === 401) return null;
    return sesion?.access_token || null;
  }
}

/**
 * Canjea el refresh token por un par nuevo.
 *
 * Deduplicado: si ya hay un refresco en marcha se devuelve esa misma promesa.
 * Es lo que evita que dos peticiones simultáneas dispare la detección de robo.
 */
export function refrescar(): Promise<Sesion> {
  if (refrescoEnVuelo) return refrescoEnVuelo;

  // `actual` es null al arrancar (restaurarSesion): la cookie decide si hay sesión.
  const actual = sesion;

  const tarea = conCandadoEntrePestanas(() => canjear(actual)).finally(() => {
    if (refrescoEnVuelo === tarea) refrescoEnVuelo = null;
  });

  refrescoEnVuelo = tarea;
  return tarea;
}

/**
 * La cookie del refresh token es compartida por todas las pestañas. Si dos
 * refrescan a la vez (por ejemplo al restaurar el navegador con varias
 * abiertas), las dos mandan la misma cookie y la segunda parece un robo. El
 * candado de Web Locks las pone en fila: la segunda sale cuando la primera ya
 * guardó la cookie nueva, y la usa.
 */
function conCandadoEntrePestanas<T>(tarea: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('baknazo-refresco', tarea);
  }
  return tarea();
}

async function canjear(actual: Sesion | null): Promise<Sesion> {
  let respuesta: Response;
  try {
    // El refresh token va en la cookie HttpOnly: no hay nada que mandar en el body.
    respuesta = await fetch(`${API_URL}/api/auth/refrescar-token`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
  } catch {
    // Fallo de red: NO se cierra sesión. Puede ser el túnel o el móvil sin
    // datos; el token en caché todavía sirve un rato y se reintentará luego.
    throw errorApi(SIN_CONEXION);
  }

  // 204: no hay cookie de sesión (un visitante). Es la respuesta normal al
  // abrir la app sin cuenta; se trata como "sin sesión", igual que un 401.
  if (respuesta.status === 204) {
    if (actual) salir();
    throw errorApi('No hay sesión iniciada', 401);
  }

  const texto = await respuesta.text();
  const datos = texto ? parsear(texto) : null;

  if (!respuesta.ok) {
    // 401 = el refresh token caducó, se revocó o ya se usó. No tiene arreglo:
    // se cierra la sesión para no dejar al usuario en un limbo.
    // Al arrancar sin sesión no hay nada que cerrar.
    if (respuesta.status === 401 && actual) salir();
    throw errorApi(
      mensajeDeError(datos, respuesta.status),
      respuesta.status,
      datos
    );
  }

  const par = datos as Partial<Sesion> | null;
  const usuario = par?.usuario ?? actual?.usuario;
  if (!par?.access_token || !usuario) {
    throw errorApi('El backend no devolvió un token válido.', 502, datos);
  }

  const siguiente: Sesion = {
    access_token: par.access_token,
    expira_en: par.expira_en ?? actual?.expira_en ?? '',
    usuario,
  };

  // Se avisa antes de devolver: si un oyente dispara una petición al recibir
  // el aviso, ya tiene que leer el token nuevo, no el revocado.
  avisar(siguiente);
  return siguiente;
}

function parsear(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/* ---------- Peticiones autenticadas ---------- */

/**
 * Petición con `Authorization: Bearer`, con refresco proactivo y un reintento
 * tras un 401.
 *
 * El reintento es único a propósito: si el segundo intento también falla, el
 * problema no es el token y hay que dejar que el error llegue a la pantalla.
 */
export async function enviarAutenticado<T>(
  ruta: string,
  metodo: Metodo,
  cuerpo?: unknown,
  cabecerasExtra?: Record<string, string>
): Promise<T> {
  const token = await tokenValido();
  let respuesta = await mandar(ruta, metodo, cuerpo, token, cabecerasExtra);

  if (respuesta.status === 401) {
    // El token caducó entre la comprobación y la llegada: se renueva y se
    // reintenta una vez.
    const renovada = await refrescar();
    respuesta = await mandar(
      ruta,
      metodo,
      cuerpo,
      renovada.access_token,
      cabecerasExtra
    );
  }

  return interpretar<T>(respuesta);
}

/**
 * Petición a un endpoint PÚBLICO que se personaliza si hay sesión.
 *
 * Sin sesión se consulta como anónimo, sin error. Con sesión, un 401 dispara el
 * refresco y un reintento igual que `enviarAutenticado`: si el token en caché
 * caducó mientras no había red, `tokenOpcional` no pudo renovarlo y esta es la
 * oportunidad de arreglarlo sin echar al usuario de la pantalla.
 */
export async function enviarOpcional<T>(
  ruta: string,
  metodo: Metodo = 'GET',
  cuerpo?: unknown,
  cabecerasExtra?: Record<string, string>
): Promise<T> {
  const token = await tokenOpcional();
  let respuesta = await mandar(ruta, metodo, cuerpo, token, cabecerasExtra);

  if (respuesta.status === 401 && sesion) {
    const renovada = await refrescar();
    respuesta = await mandar(
      ruta,
      metodo,
      cuerpo,
      renovada.access_token,
      cabecerasExtra
    );
  }

  return interpretar<T>(respuesta);
}

/**
 * Descarga un archivo privado (un CV) con la sesión, como `Blob`.
 *
 * No puede ser un enlace normal: el archivo solo sale con `Authorization`, y un
 * `<a href>` no manda cabeceras. Mismo refresco y reintento que las demás.
 */
export async function descargarAutenticado(ruta: string): Promise<Blob> {
  const token = await tokenValido();
  const cabeceras = { Accept: 'application/pdf, application/json' };
  let respuesta = await mandar(ruta, 'GET', undefined, token, cabeceras);
  if (respuesta.status === 401) {
    const renovada = await refrescar();
    respuesta = await mandar(ruta, 'GET', undefined, renovada.access_token, cabeceras);
  }
  // Los errores llegan como JSON: se interpretan igual que en el resto.
  if (!respuesta.ok) return interpretar<Blob>(respuesta);
  return respuesta.blob();
}

async function mandar(
  ruta: string,
  metodo: Metodo,
  cuerpo: unknown,
  token: string | null,
  cabecerasExtra?: Record<string, string>
): Promise<Response> {
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  // Sin sesión, el endpoint se consulta como anónimo en vez de fallar.
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  Object.assign(cabeceras, cabecerasExtra);

  const esFormData =
    typeof FormData !== 'undefined' && cuerpo instanceof FormData;

  let body: BodyInit | undefined;
  if (cuerpo !== undefined) {
    if (esFormData) {
      // Sin Content-Type: el navegador añade el boundary del multipart.
      body = cuerpo as FormData;
    } else {
      cabeceras['Content-Type'] = 'application/json';
      body = JSON.stringify(cuerpo);
    }
  }

  try {
    return await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body,
      // Algunas respuestas autenticadas (cambiar contraseña) rotan la cookie.
      credentials: 'include',
    });
  } catch {
    throw errorApi(SIN_CONEXION);
  }
}

async function interpretar<T>(respuesta: Response): Promise<T> {
  const texto = await respuesta.text();
  const datos = texto ? parsear(texto) : null;

  if (!respuesta.ok) {
    throw errorApi(
      mensajeDeError(datos, respuesta.status),
      respuesta.status,
      datos
    );
  }
  return datos as T;
}
