import { useEffect, useRef, useState } from 'react';
import DenunciarAnuncio from './DenunciarAnuncio';
import { IconoBandera, IconoOpciones } from './Iconos';
import { useNavegacion } from '../lib/navegacion';

/**
 * Los tres puntos de una publicación en la lista: lo que no merece un botón
 * a la vista. Hoy es denunciar; aquí irá cualquier opción secundaria nueva.
 */
export default function MenuOpcionesAnuncio({ anuncioId, titulo }: { anuncioId: number; titulo: string }) {
  const { sesion, irAlLogin } = useNavegacion();
  const [abierto, setAbierto] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  /* Se cierra al tocar fuera o con Escape, y el foco vuelve al botón. */
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    caja.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Más opciones de «${titulo}»`}
        className={`grid size-9 place-items-center rounded-full transition-colors ${
          abierto ? 'bg-background text-foreground' : 'text-muted hover:bg-background hover:text-foreground'
        }`}
      >
        <IconoOpciones />
      </button>

      {abierto && (
        <div
          role="menu"
          aria-label="Opciones de la publicación"
          className="animate-bkn-in absolute top-full right-0 z-30 mt-1 w-60 rounded-xl border border-border bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(31,41,55,0.45)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAbierto(false);
              if (sesion) setDenunciando(true);
              else irAlLogin();
            }}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-danger/[0.05] focus-visible:bg-danger/[0.05]"
          >
            <span className="mt-0.5 shrink-0 text-danger-deep">
              <IconoBandera />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-foreground">Denunciar publicación</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">Algo prohibido, una estafa u ofensivo</span>
            </span>
          </button>
        </div>
      )}

      {denunciando && <DenunciarAnuncio anuncioId={anuncioId} onCerrar={() => setDenunciando(false)} />}
    </div>
  );
}
