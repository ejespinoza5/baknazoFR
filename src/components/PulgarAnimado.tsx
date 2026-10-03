import { m } from 'motion/react';
import { IconoPulgar } from './Iconos';
import { SALIDA } from '../lib/movimiento';

/**
 * El pulgar de "me gusta": al marcarlo da un pequeño salto y se inclina, como
 * un gesto. Al quitarlo vuelve quieto, sin celebrar nada.
 */
export default function PulgarAnimado({ lleno, className = '' }: { lleno: boolean; className?: string }) {
  return (
    <m.span
      aria-hidden="true"
      className={`inline-grid place-items-center ${className}`}
      animate={lleno ? { scale: [1, 1.34, 0.94, 1], rotate: [0, -14, 4, 0] } : { scale: 1, rotate: 0 }}
      transition={{ duration: 0.45, ease: SALIDA }}
    >
      <IconoPulgar lleno={lleno} />
    </m.span>
  );
}
