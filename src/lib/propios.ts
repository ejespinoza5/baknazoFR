/**
 * Los ids de los anuncios que son de quien está usando la app.
 *
 * El listado del feed todavía no marca cuáles son propios, así que la lista no
 * puede saberlo y le ofrecería a todo el mundo un chat con su propio anuncio. Para
 * no esperar a eso, la app apunta aquí los ids que ya conoce: al entrar a "Mis
 * anuncios" y al publicar. Es una pista del cliente, no la fuente de verdad, por
 * eso se mezcla con lo que llegue del servidor en vez de reemplazarlo.
 *
 * Se guarda en `localStorage` porque tiene que sobrevivir a recargar: si no, al
 * volver al feed se perdería justo el dato que se necesita.
 */

const CLAVE = 'baknazo:anuncios-propios';

/** Tope de ids guardados: es una pista, no un archivo. */
const MAXIMO = 300;

const leer = (): number[] => {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const lista: unknown = JSON.parse(crudo);
    if (!Array.isArray(lista)) return [];
    return lista.filter((n): n is number => typeof n === 'number' && Number.isInteger(n));
  } catch {
    // Un storage lleno o un JSON corrupto no pueden tumbar la app.
    return [];
  }
};

const escribir = (ids: number[]) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ids.slice(0, MAXIMO)));
  } catch {
    // Si no se puede guardar, la app sigue funcionando; solo pierde la pista.
  }
};

/** Los ids que ya se conocen como propios. */
export function leerPropios(): Set<number> {
  return new Set(leer());
}

/**
 * Anota ids como propios sin perder los que ya estaban: "Mis anuncios" se lista
 * por páginas, así que reemplazar el conjunto con la página actual borraría los
 * anuncios de las páginas anteriores.
 */
export function anotarPropios(ids: number[]): void {
  if (ids.length === 0) return;
  const juntos = [...new Set([...ids, ...leer()])];
  escribir(juntos);
}

/** Se llama al cerrar sesión: lo que era tuyo ya no lo es. */
export function olvidarPropios(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer: si no se puede borrar, es un storage que ya no responde.
  }
}
