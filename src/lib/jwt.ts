/**
 * Lectura del `exp` de un JWT, sin verificar la firma.
 *
 * El access token es un JWT con `expiresIn: '15m'` (ver tokenService del
 * backend). La firma no se comprueba aquí porque eso es trabajo del servidor y
 * hacerlo en el cliente no aportaría nada: si la firma no valiera, el servidor
 * respondería 401 y el motor de token ya lo sabe manejar.
 *
 * El campo `expira_en` de la sesión NO sirve para esto: el backend devuelve ahí
 * la duración ('15m'), no una fecha. Por eso la caducidad se lee del token.
 */

function base64UrlATexto(parte: string): string | null {
  try {
    const normal = parte.replace(/-/g, '+').replace(/_/g, '/');
    const conRelleno = normal.padEnd(
      normal.length + ((4 - (normal.length % 4)) % 4),
      '='
    );
    const binario = atob(conRelleno);
    // Las cargas del JWT vienen en UTF-8; sin esto los acentos se rompen.
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Milisegundos hasta que caduca, o null si el token no es un JWT legible. */
export function caducaEnMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const carga = base64UrlATexto(partes[1]);
  if (!carga) return null;

  try {
    const exp = (JSON.parse(carga) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * true cuando el token ya caducó o está a punto de caducar.
 *
 * El margen por defecto es de un minuto: sin él, una petición que sale con
 * medio segundo de vida llega al servidor después de que caduque y provoke un
 * 401 que sí obliga a refrescar. Con margen, el refresco ocurre antes.
 */
export function porVencer(
  token: string | null | undefined,
  margen = 60_000
): boolean {
  const expira = caducaEnMs(token);
  // Sin `exp` legible no se puede saber: se da por bueno y que el 401 decida.
  if (expira === null) return false;
  return Date.now() + margen >= expira;
}
