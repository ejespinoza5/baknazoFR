/**
 * La preferencia de rejilla o lista del feed.
 *
 * A diferencia de `vista.ts`, que recuerda en qué pantalla estás, esto recuerda
 * cómo quieres ver los anuncios, así que va en localStorage: es una decisión de
 * gusto, no de dónde estabas. Si la guardas en sessionStorage, cerraras la
 * pestaña y volvieras, Baknazo se olvidaría de que elegiste la lista.
 *
 * La lectura es tolerante a fallos a propósito: en modo privado el storage
 * lanza, y un throw al montar el feed dejaría la pantalla en blanco.
 */

export type VistaAnuncios = 'rejilla' | 'lista';

const CLAVE = 'baknazo.vista-anuncios';
const VALIDADAS: VistaAnuncios[] = ['rejilla', 'lista'];

export function leerVistaAnuncios(): VistaAnuncios {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return VALIDADAS.includes(crudo as VistaAnuncios)
      ? (crudo as VistaAnuncios)
      : 'rejilla';
  } catch {
    return 'rejilla';
  }
}

export function guardarVistaAnuncios(vista: VistaAnuncios): void {
  try {
    localStorage.setItem(CLAVE, vista);
  } catch {
    // Sin storage la preferencia solo dura mientras la pantalla esté montada.
  }
}
