/**
 * URL base del backend, en su propio módulo.
 *
 * Vive solo aquí para que el motor de token (`api/token.ts`) y el cliente de la
 * API (`api/auth.ts`) no se importen entre sí: el primero refresca el token y
 * el segundo lo consume, así que si el segundo importara al primero y el
 * primero al segundo, cualquier llamada a un token sin sesión cerraría el
 * módulo a medio cargar.
 */

export const API_URL = (
  import.meta.env.VITE_API_URL ?? 'https://apibaknzo.duckdns.org'
)
  .toString()
  .replace(/\/+$/, '');

export const SIN_CONEXION = `No se pudo conectar con el servidor (${API_URL}). Revisa que el backend esté encendido y que permita CORS.`;
