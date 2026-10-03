import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import CargarMas from '../../components/CargarMas';
import BaknazoLoader from '../../components/BaknazoLoader';
import FilaNotificacion from '../../components/FilaNotificacion';
import AjustesNotificaciones from '../../components/AjustesNotificaciones';
import { IconoAlerta, IconoCampana, IconoCheck } from '../../components/Iconos';
import { eliminarNotificacion, listarNotificaciones, marcarNotificacionesLeidas } from '../../api/notificaciones';
import { alEventoChat } from '../../lib/chatEnVivo';
import { fijarNoLeidasNotificaciones, useNoLeidasNotificaciones } from '../../lib/notificaciones';
import { notificarError } from '../../lib/notificar';
import type { Notificacion } from '../../types/notificacion';

type Vista = 'todas' | 'no_leidas' | 'ajustes';

const PESTANAS: { id: Vista; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'no_leidas', label: 'No leídas' },
  { id: 'ajustes', label: 'Ajustes' },
];

function mensajeDe(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

/**
 * Notificaciones: el historial completo de la campana y sus ajustes.
 *
 * La vista va en la URL (?vista=ajustes) para que la campana pueda llevar
 * directo a los ajustes y el botón de atrás funcione.
 */
export default function NotificacionesScreen() {
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('vista');
  const vista: Vista = pedida === 'ajustes' || pedida === 'no_leidas' ? pedida : 'todas';

  return (
    <MarcoApp titulo="Notificaciones">
      <div className="mx-auto w-full max-w-[760px] px-4 pt-5 pb-10 sm:px-6 lg:pt-8">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground">Notificaciones</h1>

        <div className="mt-4 flex flex-wrap gap-2">
          {PESTANAS.map((p) => {
            const activa = vista === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={activa}
                onClick={() => setParametros(p.id === 'todas' ? {} : { vista: p.id })}
                className={`h-9 rounded-full border px-4 text-[13px] font-semibold transition-colors ${
                  activa ? 'border-transparent bg-accent text-white' : 'border-border bg-white text-foreground hover:border-muted'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {vista === 'ajustes' ? <AjustesNotificaciones /> : <Historial key={vista} soloNoLeidas={vista === 'no_leidas'} />}
      </div>
    </MarcoApp>
  );
}

/* ================= Historial ================= */

function Historial({ soloNoLeidas }: { soloNoLeidas: boolean }) {
  const navegar = useNavigate();
  const noLeidas = useNoLeidasNotificaciones();
  const [items, setItems] = useState<Notificacion[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState(false);

  const cargar = useCallback(() => {
    listarNotificaciones({ soloNoLeidas })
      .then((r) => {
        setItems(r.items);
        setHayMas(r.hayMas);
        setFallo(null);
        fijarNoLeidasNotificaciones(r.noLeidas);
      })
      .catch((e: unknown) => setFallo(mensajeDe(e, 'No se pudieron cargar tus notificaciones.')));
  }, [soloNoLeidas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Lo nuevo aparece arriba sin recargar; una agrupada que sumó a alguien sube. */
  useEffect(
    () =>
      alEventoChat((e) => {
        if (e.t === 'notificacion') {
          setItems((l) => (l ? [e.notificacion, ...l.filter((x) => x.id !== e.notificacion.id)] : l));
        } else if (e.t === 'listo') {
          cargar();
        }
      }),
    [cargar]
  );

  const cargarMas = async () => {
    if (!items || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const r = await listarNotificaciones({ soloNoLeidas, offset: items.length });
      const vistos = new Set(items.map((x) => x.id));
      setItems([...items, ...r.items.filter((x) => !vistos.has(x.id))]);
      setHayMas(r.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  };

  const abrir = (n: Notificacion) => {
    if (!n.leida) {
      marcarNotificacionesLeidas([n.id])
        .then((r) => fijarNoLeidasNotificaciones(r.noLeidas))
        .catch(() => undefined);
    }
    navegar(n.url);
  };

  const leerTodas = async () => {
    try {
      const r = await marcarNotificacionesLeidas('todas');
      fijarNoLeidasNotificaciones(r.noLeidas);
      setItems((l) => (soloNoLeidas ? [] : (l?.map((x) => ({ ...x, leida: true })) ?? l)));
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudieron marcar como leídas.'));
    }
  };

  const eliminar = async (n: Notificacion) => {
    setItems((l) => l?.filter((x) => x.id !== n.id) ?? l);
    try {
      const r = await eliminarNotificacion(n.id);
      fijarNoLeidasNotificaciones(r.noLeidas);
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo eliminar.'));
      cargar();
    }
  };

  return (
    <section className="mt-5">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {noLeidas > 0 ? `${noLeidas === 1 ? '1 sin leer' : `${noLeidas} sin leer`}` : 'Estás al día.'}
        </p>
        {noLeidas > 0 && (
          <button
            type="button"
            onClick={leerTodas}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[13px] font-semibold text-foreground transition-colors hover:border-muted"
          >
            <IconoCheck ok />
            Marcar todo como leído
          </button>
        )}
      </div>

      {fallo && !items ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13px] text-danger-deep">
          <span className="mt-0.5 shrink-0">
            <IconoAlerta />
          </span>
          {fallo}
        </p>
      ) : !items ? (
        <div className="mt-4 rounded-2xl border border-border bg-white">
          <BaknazoLoader tamano="seccion" mensaje="Cargando notificaciones" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent/10 text-accent-dark">
            <IconoCampana />
          </span>
          <p className="mt-3 text-[16px] font-semibold text-foreground">
            {soloNoLeidas ? 'No tienes notificaciones sin leer' : 'Todavía no tienes notificaciones'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
            Aquí verás quién te sigue, a quién le gustan tus anuncios, tus mensajes y cómo van tus postulaciones.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-0.5 rounded-2xl border border-border bg-white p-1.5">
            {items.map((n) => (
              <li key={n.id}>
                <FilaNotificacion notificacion={n} onAbrir={() => abrir(n)} onEliminar={() => void eliminar(n)} />
              </li>
            ))}
          </ul>
          <CargarMas hayMas={hayMas} cargando={cargandoMas} error={errorMas} onCargar={cargarMas} />
        </>
      )}
    </section>
  );
}

