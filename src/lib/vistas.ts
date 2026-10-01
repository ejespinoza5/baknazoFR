import { useEffect, useRef, type RefObject } from 'react';
import { registrarVistas } from '../api/anuncios';

/**
 * Vistas reales de las publicaciones que se leen en la lista.
 *
 * En la vista de lista la publicación se ve entera sin abrirla, así que contar
 * solo las aperturas dejaba esas lecturas fuera. Aquí una publicación cuenta
 * como vista cuando al menos el 60 % de ella estuvo en pantalla durante un
 * segundo: pasar el dedo rápido por encima no es verla.
 *
 * Las vistas se juntan y se mandan en lote cada pocos segundos (una petición en
 * vez de veinte), y el servidor vuelve a filtrar: una por persona y día, nunca
 * la del dueño. Aquí solo se evita reenviar en la misma pestaña lo ya enviado.
 */

const UMBRAL = 0.6;
const TIEMPO_MS = 1000;
const ESPERA_ENVIO_MS = 4000;

const enviadas = new Set<number>();
const pendientes = new Set<number>();
let temporizador: ReturnType<typeof setTimeout> | null = null;

function enviar() {
  temporizador = null;
  if (pendientes.size === 0) return;
  const ids = [...pendientes];
  pendientes.clear();
  // Si falla, no se reintenta: una vista de menos no le hace daño a nadie y
  // reintentar en bucle con datos móviles sí.
  registrarVistas(ids).catch(() => undefined);
}

function anotar(id: number) {
  if (enviadas.has(id)) return;
  enviadas.add(id);
  pendientes.add(id);
  if (!temporizador) temporizador = setTimeout(enviar, ESPERA_ENVIO_MS);
}

// Al cambiar de pestaña o cerrar, se manda lo que quede.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendientes.size > 0) {
      if (temporizador) clearTimeout(temporizador);
      enviar();
    }
  });
}

/**
 * Cuenta una vista cuando `ref` pasa un segundo en pantalla.
 * `activo` en false no observa nada (por ejemplo, tus propios anuncios).
 */
export function useVistaEnPantalla(ref: RefObject<HTMLElement | null>, id: number | undefined, activo: boolean) {
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!activo || id == null || !el || enviadas.has(id) || typeof IntersectionObserver === 'undefined') return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting && entrada.intersectionRatio >= UMBRAL) {
          if (!reloj.current) {
            reloj.current = setTimeout(() => {
              anotar(id);
              observador.disconnect();
            }, TIEMPO_MS);
          }
        } else if (reloj.current) {
          clearTimeout(reloj.current);
          reloj.current = null;
        }
      },
      { threshold: [0, UMBRAL] }
    );
    observador.observe(el);
    return () => {
      observador.disconnect();
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = null;
    };
  }, [ref, id, activo]);
}
