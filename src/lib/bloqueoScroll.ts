import { useEffect } from 'react';

/**
 * Bloquea el scroll de la página mientras haya algo abierto encima.
 *
 * El truco está en el contador. Un bloqueo ingenuo —guardar el valor de
 * `body.overflow` y restaurarlo al desmontar— falla en cuanto hay dos capas
 * superpuestas: cada una guarda lo que encuentra y lo devuelve, y la última en
 * restaurar gana. Con un modal y el visor de fotos dentro, el padre guardaba
 * "" y el hijo guardaba "hidden"; al cerrar los dos, React limpia primero al
 * padre y después al hijo, así que el cuerpo acababa en `hidden` y la página se
 * quedaba congelada sin poder desplazarse.
 *
 * Con el contador solo quien lo lleva a cero restaura, y da igual en qué orden
 * se cierren: o se abre la foto y se cierra, o se cierra todo de golpe, el
 * scroll vuelve exactamente una vez.
 */

/** Cuántas capas tienen el scroll bloqueado ahora mismo. */
let capas = 0;

/** El valor que tenía el body antes del primer bloqueo. */
let overflowPrevio = '';

/**
 * En desarrollo, el reemplazo del módulo deja el contador a 0 mientras el body
 * sigue bloqueado por la versión anterior. Sin esto, la siguiente página que se
 * abriría heredaría un `hidden` ya puesto y nunca lo quitaría.
 */
function recuperarSiQuedoColgado() {
  if (capas === 0 && document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(recuperarSiQuedoColgado);
}

/**
 * @param activo `false` no bloquea. Se puede pasar un estado para abrir y
 *   cerrar el bloqueo sin desmontar el componente.
 */
export function useBloqueoScroll(activo = true): void {
  useEffect(() => {
    if (!activo) return;

    // El primero en bloquear es el que guarda el valor bueno. A partir de ahí
    // solo se sube el contador.
    if (capas === 0) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    capas++;

    return () => {
      capas--;
      if (capas === 0) document.body.style.overflow = overflowPrevio;
    };
  }, [activo]);
}
