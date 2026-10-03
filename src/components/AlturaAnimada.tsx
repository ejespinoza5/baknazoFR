import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { SALIDA } from '../lib/movimiento';

/**
 * Un contenedor que acompaña el alto de lo que tiene dentro: cuando el
 * contenido cambia (otro formulario, un error que aparece), la caja crece o
 * se encoge suave en vez de saltar.
 *
 * El margen negativo con relleno deja ver los anillos de foco de los campos,
 * que si no quedarían cortados por el `overflow: hidden`.
 */
export default function AlturaAnimada({ children, className = '' }: { children: ReactNode; className?: string }) {
  const interior = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number | 'auto'>('auto');

  useLayoutEffect(() => {
    const el = interior.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => setAlto(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <m.div
      className={`-mx-1 overflow-hidden px-1 ${className}`}
      initial={false}
      animate={{ height: alto }}
      transition={{ duration: 0.42, ease: SALIDA }}
    >
      <div ref={interior} className="relative py-1">
        {children}
      </div>
    </m.div>
  );
}
