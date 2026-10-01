import { useEffect } from 'react';
import { IconoCerrar, IconoChevron } from './Iconos';

interface Props {
  /** Las URLs de todas las fotos, en el orden en que se ven. */
  fotos: string[];
  /**
   * Cuál se está viendo. Lo manda quien la abre, para que las flechas y el
   * contador no necesiten un estado propio que se desincronice del de la galería.
   */
  indice: number;
  alt: string;
  onCambiar: (indice: number) => void;
  onCerrar: () => void;
}

/**
 * Las fotos a pantalla completa, con flechas para pasar de una a otra.
 *
 * La foto no se estira atodo el hueco: se limita en alto y en ancho y se deja
 * aire alrededor. A sangre, una imagen de 4:3 en una pantalla de 9:16 dejaba
 * metros de fondo oscuro y se leía como un recorte torpe, no como una foto.
 *
 * Se cierra con Escape, con el botón o tocando el fondo. Tocar la foto no
 * cierra nada: mientras se navega con las flechas es fácil rozar la imagen sin
 * querer. Por eso el fondo usa el cursor normal y no el de lupa, que además
 * aparecía también sobre la X.
 */
export default function VisorGaleria({
  fotos,
  indice,
  alt,
  onCambiar,
  onCerrar,
}: Props) {
  useEffect(() => {
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
      if (evento.key === 'ArrowRight') onCambiar((indice + 1) % fotos.length);
      if (evento.key === 'ArrowLeft')
        onCambiar((indice - 1 + fotos.length) % fotos.length);
    };

    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [indice, fotos.length, onCambiar, onCerrar]);

  /*
   * El scroll ya está bloqueado por la ficha que contiene a este visor, así que
   * aquí no se vuelve a bloquear: hacerlo dejaba dos capas peleándose por la
   * misma propiedad y la página acababa congelada. El contador de
   * `useBloqueoScroll` resuelve el orden, pero no hace falta gastarlo dos veces
   * para el mismo scroll.
   */

  const varias = fotos.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(evento) => {
        // Solo el fondo cierra: los hijos (flechas, X, miniaturas) se quedan.
        if (evento.target === evento.currentTarget) onCerrar();
      }}
      className="fixed inset-0 z-70 flex flex-col bg-carbon/96"
    >
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 truncate text-[13px] text-white/70">{alt}</p>
        {varias && (
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white/80 tabular-nums">
            {indice + 1} / {fotos.length}
          </span>
        )}
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar la imagen"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <IconoCerrar />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-3 sm:px-20">
        {varias && (
          <button
            type="button"
            onClick={() => onCambiar((indice - 1 + fotos.length) % fotos.length)}
            aria-label="Foto anterior"
            className="absolute left-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6 sm:size-10"
          >
            <IconoChevron izquierda />
          </button>
        )}

        <img
          src={fotos[indice]}
          alt={alt}
          className="max-h-full max-w-full rounded-xl object-contain ring-1 ring-white/10"
        />

        {varias && (
          <button
            type="button"
            onClick={() => onCambiar((indice + 1) % fotos.length)}
            aria-label="Foto siguiente"
            className="absolute right-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6 sm:size-10"
          >
            <IconoChevron derecha />
          </button>
        )}
      </div>

      {/* Las miniaturas solo en escritorio: en el teléfono el alto se lo gasta
          mejor la foto, y con las flechas y el contador ya se sabe cuál es cuál. */}
      {varias && (
        <div className="hidden shrink-0 items-center justify-center gap-2 px-6 pb-5 sm:flex">
          {fotos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => onCambiar(i)}
              aria-label={`Ver la foto ${i + 1}`}
              aria-current={i === indice}
              className={`size-14 cursor-pointer overflow-hidden rounded-lg ring-2 transition-opacity ${
                i === indice ? 'ring-white' : 'opacity-50 hover:opacity-90'
              }`}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
