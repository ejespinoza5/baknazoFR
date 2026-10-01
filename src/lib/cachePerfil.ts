import type { AnuncioPerfil, PerfilPublico } from '../types/perfil';

/**
 * Los perfiles ya vistos en esta pestaña, para volver a ellos sin esperar.
 *
 * Al volver a un perfil (desde el feed, con el botón de atrás, tras editar la
 * portada) se pinta al instante lo último que se vio y se pide la versión fresca
 * por detrás. Es la diferencia entre una red social y una página que carga cada
 * vez: lo que ya viste no tiene por qué volver a aparecer en gris.
 *
 * Vive en memoria y no en el almacenamiento: al recargar se pide todo de nuevo,
 * y al cerrar sesión se vacía para que la siguiente cuenta no herede el
 * "lo sigues" de la anterior.
 */
export interface PerfilEnCache {
  perfil: PerfilPublico;
  anuncios: AnuncioPerfil[];
  hayMas: boolean;
}

/** Suficiente para ir y volver entre varios perfiles sin crecer sin límite. */
const MAXIMO = 20;

const cache = new Map<string, PerfilEnCache>();

export function leerPerfilEnCache(id: string): PerfilEnCache | null {
  return cache.get(id) ?? null;
}

export function guardarPerfilEnCache(id: string, datos: PerfilEnCache): void {
  cache.delete(id);
  cache.set(id, datos);
  // El Map recuerda el orden de inserción: el primero es el más antiguo.
  if (cache.size > MAXIMO) {
    const masViejo = cache.keys().next().value;
    if (masViejo !== undefined) cache.delete(masViejo);
  }
}

export function olvidarPerfilesEnCache(): void {
  cache.clear();
}
