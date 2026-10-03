import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ChatSoporte from './ChatSoporte';
import { IconoCerrar, IconoSoporte } from './Iconos';
import { useSoporteNoLeidos } from '../lib/soporte';

/**
 * El acceso a soporte en escritorio: un botón en la esquina que abre la
 * conversación en un panel, sin salir de la pantalla. En móvil y tableta no
 * se pinta (taparía contenido y la barra de abajo): ahí está en Configuración.
 *
 * Tampoco aparece donde ya hay una conversación o una caja de texto abajo a
 * la derecha: el chat, y la propia sección de soporte de Configuración.
 */
export default function BotonSoporte() {
  const { pathname, search } = useLocation();
  const noLeidos = useSoporteNoLeidos();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const oculto = pathname.startsWith('/mensajes') || (pathname.startsWith('/configuracion') && search.includes('seccion=soporte'));

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  if (oculto) return null;

  return (
    <div className="fixed right-6 bottom-6 z-45 hidden flex-col items-end gap-3 lg:flex">
      {abierto && (
        <section
          role="dialog"
          aria-label="Soporte Baknazo"
          className="animate-bkn-in h-[min(560px,calc(100svh-8rem))] w-[380px] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_60px_-20px_rgba(31,41,55,0.45)]"
        >
          <ChatSoporte onCerrar={() => setAbierto(false)} />
        </section>
      )}
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? 'Cerrar soporte' : noLeidos > 0 ? `Soporte, ${noLeidos} respuestas sin leer` : 'Ayuda y soporte'}
        title={abierto ? 'Cerrar soporte' : 'Ayuda y soporte'}
        className="relative grid size-14 place-items-center rounded-full bg-carbon text-brand shadow-[0_10px_24px_-8px_rgba(31,41,55,0.6)] transition-transform hover:scale-105 active:scale-95 [&>svg]:size-6"
      >
        {abierto ? <IconoCerrar /> : <IconoSoporte />}
        {!abierto && noLeidos > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-carbon tabular-nums ring-2 ring-background">
            {noLeidos > 9 ? '9+' : noLeidos}
          </span>
        )}
      </button>
    </div>
  );
}
