/**
 * A dónde volver después de entrar o crear la cuenta.
 *
 * El `state.desde` de la navegación no basta: crear cuenta pasa por elegir el
 * tipo de cuenta y verificar el correo, y cada paso navega con su propio
 * `state`, así que el destino se perdía por el camino. Quien abrió un anuncio
 * en la landing y pulsó "Mensaje" acababa en el feed y no en ese anuncio.
 *
 * Vive en sessionStorage (solo esta pestaña) y caduca: si alguien abandona el
 * login y entra horas después, no debe aparecer un anuncio que ya no buscaba.
 */

const CLAVE = 'baknazo:volver-tras-entrar';
const VIGENCIA_MS = 60 * 60 * 1000;

/** Solo rutas internas: nada de `//otro-sitio` ni URLs completas. */
function esRutaInterna(ruta: string): boolean {
  return ruta.startsWith('/') && !ruta.startsWith('//');
}

export function recordarDestino(ruta: string): void {
  if (!esRutaInterna(ruta)) return;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ ruta, hasta: Date.now() + VIGENCIA_MS }));
  } catch {
    // Sin almacenamiento (modo privado estricto): queda el `state.desde`.
  }
}

export function olvidarDestino(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}

/** Devuelve el destino pendiente (si sigue vigente) y lo borra: se usa una vez. */
export function tomarDestino(): string | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    if (!crudo) return null;
    const { ruta, hasta } = JSON.parse(crudo) as { ruta?: unknown; hasta?: unknown };
    if (typeof ruta !== 'string' || typeof hasta !== 'number' || hasta < Date.now()) return null;
    return esRutaInterna(ruta) ? ruta : null;
  } catch {
    return null;
  }
}
