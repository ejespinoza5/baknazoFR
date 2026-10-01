import { useEffect, useRef } from 'react';

/**
 * Paginación como la de Facebook: al acercarse al final de la lista se pide la
 * siguiente página sola, sin botón.
 *
 * Devuelve un `ref` para un elemento centinela al final de la lista. Cuando ese
 * elemento entra a 600 px de la pantalla, se llama a `cargar`. El margen hace
 * que la página nueva llegue antes de que la persona toque fondo, así el scroll
 * no se detiene.
 *
 * `activo` en false (no hay más, o ya se está cargando, o hubo un error) no
 * pide nada: sin esto, un error de red provocaría un bucle de peticiones.
 */
export function useScrollInfinito(cargar: () => void, activo: boolean) {
  const centinela = useRef<HTMLDivElement | null>(null);
  // La función cambia en cada render; se lee del ref para no re-observar.
  const ultimaCarga = useRef(cargar);
  useEffect(() => {
    ultimaCarga.current = cargar;
  }, [cargar]);

  useEffect(() => {
    const el = centinela.current;
    if (!activo || !el || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) ultimaCarga.current();
      },
      { rootMargin: '600px 0px' }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [activo]);

  return centinela;
}
