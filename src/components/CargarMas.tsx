import type { ReactNode } from 'react';
import BaknazoLoader from './BaknazoLoader';
import { useScrollInfinito } from '../lib/scrollInfinito';

/**
 * El final de una lista paginada: pide la página siguiente sola al acercarse
 * (como Facebook) y, si falla, se detiene y ofrece reintentar.
 *
 * `esqueleto` permite enseñar huecos con la forma de lo que viene (publicaciones
 * en el feed); sin él se usa el loader de la marca.
 */
export default function CargarMas({
  hayMas,
  cargando,
  error,
  onCargar,
  esqueleto,
}: {
  hayMas: boolean;
  cargando: boolean;
  error: boolean;
  onCargar: () => void;
  esqueleto?: ReactNode;
}) {
  const centinela = useScrollInfinito(onCargar, hayMas && !cargando && !error);

  if (!hayMas && !error) return null;

  return (
    <>
      {cargando && (esqueleto ?? <BaknazoLoader tamano="seccion" mensaje="Cargando más" />)}
      <div ref={centinela} aria-hidden="true" className="h-px" />
      {error && (
        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          <p className="text-[13px] text-muted">No se pudo cargar lo siguiente.</p>
          <button
            type="button"
            onClick={onCargar}
            className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted"
          >
            Reintentar
          </button>
        </div>
      )}
    </>
  );
}
