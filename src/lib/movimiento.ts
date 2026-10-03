/**
 * El movimiento de Baknazo, en un solo sitio: las mismas curvas en toda la app
 * para que todo se sienta de la misma mano.
 *
 * Salidas exponenciales (arrancan rápido y frenan suave) y resortes sin rebote:
 * nada de elásticos. Quien tiene activado "reducir movimiento" en su sistema
 * no ve desplazamientos (ver `MotionConfig` en main.tsx).
 */

import type { Transition, Variants } from 'motion/react';

/** Arranque rápido y frenado largo (parecido a ease-out-quint). */
export const SALIDA = [0.22, 1, 0.36, 1] as const;

/** Para lo que se va: acelera al irse, sin hacerse esperar. */
export const ENTRADA_SALIDA = [0.4, 0, 1, 1] as const;

/** Resorte sin rebote para indicadores que se deslizan (pestañas, menú). */
export const RESORTE: Transition = { type: 'spring', bounce: 0, duration: 0.45 };

/** Un bloque que aparece subiendo un poco, y sus hijos en cascada. */
export const CASCADA: Variants = {
  oculto: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: SALIDA, staggerChildren: 0.04, delayChildren: 0.03 },
  },
};

/** Cada hijo de una cascada. */
export const HIJO: Variants = {
  oculto: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: SALIDA } },
};
