import { useEffect, useRef } from 'react';

/**
 * Hace aparecer un bloque cuando entra en pantalla (subiendo y con fundido).
 *
 * El estado oculto lo pone este mismo efecto, no el HTML: si el JavaScript
 * tarda o falla, el contenido se ve igual. Y lo que ya está a la vista al
 * cargar no se esconde.
 */
export function useRevelar<T extends HTMLElement>(retraso = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) return; // ya se ve
    el.dataset.revelar = 'oculto';
    if (retraso) el.style.transitionDelay = `${retraso}ms`;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.revelar = 'visible';
        obs.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [retraso]);
  return ref;
}
