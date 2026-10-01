import TarjetaAnuncio from './TarjetaAnuncio';
import { IconoChevron } from './Iconos';
import type { Pilar } from '../lib/pilares';

interface Props {
  abierta: boolean;
  onAlternar: () => void;
  pilar: Pilar;
  titulo: string;
  precio: string;
  ubicacion: string;
  /** Distintivo de "borrador" en la tarjeta; al editar el anuncio ya es real. */
  borrador?: boolean;
  /** Texto bajo la tarjeta. */
  ayuda: string;
  foto: string | null;
}

/**
 * La tarjeta del anuncio, plegada, para cuando no cabe la columna lateral.
 *
 * Es la misma pieza en publicar y en editar, con el mismo rótulo y el mismo
 * plegado: si el usuario aprende a mirarla en una pantalla, la entiende en la
 * otra.
 */
export default function PreviaAnuncio({
  abierta,
  onAlternar,
  pilar,
  titulo,
  precio,
  ubicacion,
  borrador,
  ayuda,
  foto,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold tracking-[0.05em] text-muted uppercase">
            Así se verá tu anuncio
          </span>
          <span className="mt-0.5 block truncate text-[14px] font-medium text-foreground">
            {precio} · {titulo}
          </span>
        </span>
        <span
          className={`shrink-0 text-muted transition-transform duration-200 ${
            abierta ? 'rotate-180' : ''
          }`}
        >
          <IconoChevron />
        </span>
      </button>
      {abierta && (
        <div className="animate-bkn-in border-t border-border p-4">
          <TarjetaAnuncio
            pilar={pilar}
            titulo={titulo}
            precio={precio}
            ubicacion={ubicacion}
            foto={foto}
            distintivo={borrador ? 'borrador' : undefined}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{ayuda}</p>
        </div>
      )}
    </div>
  );
}
