import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FilaNotificacion from './FilaNotificacion';
import BaknazoLoader from './BaknazoLoader';
import { IconoCampana } from './Iconos';
import { listarNotificaciones, marcarNotificacionesLeidas } from '../api/notificaciones';
import { alEventoChat } from '../lib/chatEnVivo';
import { fijarNoLeidasNotificaciones, useNoLeidasNotificaciones } from '../lib/notificaciones';
import type { Notificacion } from '../types/notificacion';

const ESCRITORIO = '(min-width: 1024px)';

/**
 * La campana de la cabecera, con el contador de no leídas.
 *
 * En escritorio despliega las últimas debajo, sin salir de la pantalla. En
 * móvil un panel flotante no cabe bien: lleva a la pantalla de notificaciones.
 */
export default function CampanaNotificaciones({ activa }: { activa: boolean }) {
  const navegar = useNavigate();
  const noLeidas = useNoLeidasNotificaciones();
  const [abierta, setAbierta] = useState(false);
  const [items, setItems] = useState<Notificacion[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const alternar = () => {
    if (!window.matchMedia(ESCRITORIO).matches) {
      navegar('/notificaciones');
      return;
    }
    if (abierta) {
      setAbierta(false);
      return;
    }
    setAbierta(true);
    setFallo(false);
    listarNotificaciones({ limite: 8 })
      .then((r) => {
        setItems(r.items);
        fijarNoLeidasNotificaciones(r.noLeidas);
      })
      .catch(() => setFallo(true));
  };

  /* Abierta, lo nuevo aparece arriba sin volver a pedir la lista. */
  useEffect(() => {
    if (!abierta) return;
    return alEventoChat((e) => {
      if (e.t !== 'notificacion') return;
      setItems((l) => (l ? [e.notificacion, ...l.filter((x) => x.id !== e.notificacion.id)].slice(0, 8) : l));
    });
  }, [abierta]);

  /* Se cierra al tocar fuera o con Escape. */
  useEffect(() => {
    if (!abierta) return;
    const alTocar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('mousedown', alTocar);
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alTocar);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [abierta]);

  const abrir = (n: Notificacion) => {
    setAbierta(false);
    if (!n.leida) {
      marcarNotificacionesLeidas([n.id])
        .then((r) => fijarNoLeidasNotificaciones(r.noLeidas))
        .catch(() => undefined);
    }
    navegar(n.url);
  };

  const leerTodas = () => {
    marcarNotificacionesLeidas('todas')
      .then((r) => {
        fijarNoLeidasNotificaciones(r.noLeidas);
        setItems((l) => l?.map((x) => ({ ...x, leida: true })) ?? l);
      })
      .catch(() => undefined);
  };

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        aria-current={activa ? 'page' : undefined}
        title="Notificaciones"
        className={`relative grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-white ${
          activa || abierta ? 'text-accent' : 'text-foreground'
        }`}
      >
        <IconoCampana />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10.5px] font-semibold text-white tabular-nums ring-2 ring-background">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="animate-bkn-in absolute top-full right-0 z-50 mt-2 w-[380px] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_48px_-24px_rgba(31,41,55,0.5)]"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Notificaciones</h2>
            {noLeidas > 0 && (
              <button type="button" onClick={leerTodas} className="ml-auto text-[12.5px] font-semibold text-accent hover:underline">
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,480px)] overflow-y-auto overscroll-contain p-1.5">
            {fallo ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">No se pudieron cargar. Vuelve a intentarlo.</p>
            ) : !items ? (
              <BaknazoLoader tamano="seccion" mensaje="Cargando notificaciones" />
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-[14px] font-semibold text-foreground">Todo al día</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  Aquí verás quién te sigue, a quién le gustan tus anuncios y cómo van tus postulaciones.
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {items.map((n) => (
                  <li key={n.id}>
                    <FilaNotificacion notificacion={n} compacta onAbrir={() => abrir(n)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex border-t border-border">
            <button
              type="button"
              onClick={() => {
                setAbierta(false);
                navegar('/notificaciones');
              }}
              className="h-11 flex-1 text-[13px] font-semibold text-accent hover:bg-background"
            >
              Ver todas
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierta(false);
                navegar('/notificaciones?vista=ajustes');
              }}
              className="h-11 flex-1 border-l border-border text-[13px] font-semibold text-foreground hover:bg-background"
            >
              Ajustes y sonido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
