import { useEffect, useState, type ReactNode } from 'react';
import BaknazoLoader from './BaknazoLoader';
import {
  IconoAlerta,
  IconoBocadillo,
  IconoCampana,
  IconoCandado,
  IconoEtiqueta,
  IconoMaletin,
  IconoPersona,
  IconoPulgar,
} from './Iconos';
import { guardarPreferenciasNotificacion, obtenerPreferenciasNotificacion } from '../api/notificaciones';
import { fijarSonido } from '../lib/notificaciones';
import { activarPush, desactivarPush, estadoPush, type EstadoPush } from '../lib/push';
import { OPCIONES_SONIDO, reproducirSonido } from '../lib/sonidos';
import { notificarError, notificarExito } from '../lib/notificar';
import type { CategoriaNotificacion, PreferenciasNotificacion, Sonido } from '../types/notificacion';

/**
 * Los ajustes de las notificaciones: el push de este dispositivo, el sonido y
 * qué se avisa por cada canal. Es uno solo y se usa en dos sitios —la pestaña
 * Ajustes de Notificaciones y la sección Notificaciones de Configuración—, así
 * que los dos muestran y guardan exactamente lo mismo.
 */

function mensajeDe(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

const CATEGORIAS: { id: CategoriaNotificacion; titulo: string; ayuda: string; icono: ReactNode; fija?: boolean }[] = [
  { id: 'mensajes', titulo: 'Mensajes', ayuda: 'Mensajes nuevos del chat y respuestas de soporte.', icono: <IconoBocadillo /> },
  { id: 'seguidores', titulo: 'Seguidores', ayuda: 'Cuando alguien empieza a seguirte.', icono: <IconoPersona /> },
  {
    id: 'interacciones',
    titulo: 'Me gusta y favoritos',
    ayuda: 'Cuando a alguien le gusta o guarda una de tus publicaciones.',
    icono: <IconoPulgar />,
  },
  {
    id: 'empleo',
    titulo: 'Empleo',
    ayuda: 'Vacantes de negocios que sigues, postulaciones y hojas de vida revisadas.',
    icono: <IconoMaletin />,
  },
  {
    id: 'publicaciones',
    titulo: 'Tus publicaciones',
    ayuda: 'Aprobación, rechazo y vencimiento. Siempre se muestran en Baknazo.',
    icono: <IconoEtiqueta />,
    fija: true,
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    ayuda: 'Cambios de contraseña y alertas de tu cuenta. Siempre se muestran en Baknazo.',
    icono: <IconoCandado />,
    fija: true,
  },
];

export default function AjustesNotificaciones() {
  const [prefs, setPrefs] = useState<PreferenciasNotificacion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    obtenerPreferenciasNotificacion()
      .then(setPrefs)
      .catch((e: unknown) => setFallo(mensajeDe(e, 'No se pudieron cargar tus ajustes.')));
  }, []);

  /* Se pinta el cambio al instante y se revierte si el servidor no lo guarda. */
  const cambiar = async (
    clave: string,
    cambios: Parameters<typeof guardarPreferenciasNotificacion>[0],
    optimista: (p: PreferenciasNotificacion) => PreferenciasNotificacion
  ) => {
    if (!prefs) return;
    const anterior = prefs;
    setPrefs(optimista(prefs));
    setGuardando(clave);
    try {
      const guardadas = await guardarPreferenciasNotificacion(cambios);
      setPrefs(guardadas);
      fijarSonido(guardadas.sonido);
    } catch (e) {
      setPrefs(anterior);
      notificarError(mensajeDe(e, 'No se pudo guardar el cambio.'));
    } finally {
      setGuardando(null);
    }
  };

  const cambiarCanal = (c: CategoriaNotificacion, canal: 'app' | 'push', valor: boolean) =>
    cambiar(`${c}-${canal}`, { categorias: { [c]: { [canal]: valor } } }, (p) => ({
      ...p,
      categorias: { ...p.categorias, [c]: { ...p.categorias[c], [canal]: valor } },
    }));

  const elegirSonido = (sonido: Sonido) => {
    reproducirSonido(sonido);
    void cambiar('sonido', { sonido }, (p) => ({ ...p, sonido }));
  };

  if (fallo) {
    return (
      <p className="mt-5 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13px] text-danger-deep">
        <span className="mt-0.5 shrink-0">
          <IconoAlerta />
        </span>
        {fallo}
      </p>
    );
  }
  if (!prefs) {
    return (
      <div className="mt-5 rounded-2xl border border-border bg-white">
        <BaknazoLoader tamano="seccion" mensaje="Cargando tus ajustes" />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <TarjetaPush disponibleEnServidor={prefs.pushDisponible} />

      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Sonido de los avisos</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Suena cuando llega algo con Baknazo abierto. Las notificaciones push usan el sonido de tu dispositivo, o
          llegan en silencio si eliges «Sin sonido».
        </p>
        <div role="radiogroup" aria-label="Sonido de los avisos" className="mt-4 grid gap-2 sm:grid-cols-2">
          {OPCIONES_SONIDO.map((o) => {
            const elegido = prefs.sonido === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => elegirSonido(o.id)}
                disabled={guardando === 'sonido'}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-wait ${
                  elegido ? 'border-accent bg-accent/[0.05] ring-1 ring-accent' : 'border-border hover:border-muted'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${
                    elegido ? 'border-accent' : 'border-border'
                  }`}
                >
                  {elegido && <span className="size-2 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-foreground">{o.nombre}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{o.descripcion}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-muted">Al elegir uno, suena para que lo escuches.</p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Qué quieres que te avise</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          «En Baknazo» es la campana. «Push» llega aunque tengas la app cerrada, en los dispositivos donde lo
          actives.
        </p>
        <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_64px_64px] gap-3 px-1 text-[11.5px] font-semibold text-muted sm:grid">
          <span />
          <span className="text-center">En Baknazo</span>
          <span className="text-center">Push</span>
        </div>
        <ul className="divide-y divide-border">
          {CATEGORIAS.map((c) => {
            const canales = prefs.categorias[c.id];
            return (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_64px_64px]">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-muted">{c.icono}</span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground">{c.titulo}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{c.ayuda}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-end gap-6 sm:contents">
                  <Interruptor
                    etiqueta={`${c.titulo} en Baknazo`}
                    corta="En Baknazo"
                    activo={canales.app}
                    fijo={c.fija}
                    ocupado={guardando === `${c.id}-app`}
                    onCambiar={(v) => void cambiarCanal(c.id, 'app', v)}
                  />
                  <Interruptor
                    etiqueta={`${c.titulo} por push`}
                    corta="Push"
                    activo={canales.push}
                    ocupado={guardando === `${c.id}-push`}
                    onCambiar={(v) => void cambiarCanal(c.id, 'push', v)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** El mismo interruptor que Privacidad en Configuración. */
function Interruptor({
  etiqueta,
  corta,
  activo,
  fijo = false,
  ocupado,
  onCambiar,
}: {
  etiqueta: string;
  /** El texto que se ve en móvil, donde no hay encabezado de columnas. */
  corta: string;
  activo: boolean;
  fijo?: boolean;
  ocupado: boolean;
  onCambiar: (valor: boolean) => void;
}) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="text-[12px] font-medium text-muted sm:hidden">{corta}</span>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        title={fijo ? 'Siempre activo' : undefined}
        disabled={fijo || ocupado}
        onClick={() => onCambiar(!activo)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
          activo ? 'bg-success' : 'bg-border'
        } ${ocupado ? 'opacity-70' : ''} ${fijo ? 'opacity-50' : ''}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(31,41,55,0.25)] transition-transform duration-200 ${
            activo ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </span>
  );
}

/**
 * Activar el push en este dispositivo. El permiso solo se pide aquí, al
 * pulsar el botón: nunca al entrar a la app.
 */
function TarjetaPush({ disponibleEnServidor }: { disponibleEnServidor: boolean }) {
  const [estado, setEstado] = useState<EstadoPush>(() => estadoPush());
  const [ocupado, setOcupado] = useState(false);
  const efectivo: EstadoPush = !disponibleEnServidor && estado !== 'no-soportado' ? 'no-configurado' : estado;

  const activar = async () => {
    setOcupado(true);
    try {
      await activarPush();
      notificarExito('Listo: este dispositivo recibirá notificaciones aunque Baknazo esté cerrado.');
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudieron activar las notificaciones push.'));
    } finally {
      setEstado(estadoPush());
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    try {
      await desactivarPush();
      notificarExito('Este dispositivo ya no recibirá notificaciones push.');
    } finally {
      setEstado(estadoPush());
      setOcupado(false);
    }
  };

  const textos: Record<EstadoPush, { titulo: string; texto: string }> = {
    activo: {
      titulo: 'Push activado en este dispositivo',
      texto: 'Te avisamos aunque tengas Baknazo cerrado. Los avisos no muestran nombres ni mensajes: el detalle lo ves aquí.',
    },
    apagado: {
      titulo: 'Recibe avisos con Baknazo cerrado',
      texto: 'Activa las notificaciones push en este dispositivo. Tu navegador te pedirá permiso.',
    },
    bloqueado: {
      titulo: 'Las notificaciones están bloqueadas',
      texto: 'Las bloqueaste para este sitio. Actívalas desde el candado de la barra de direcciones y vuelve aquí.',
    },
    'no-configurado': {
      titulo: 'Push todavía no disponible',
      texto: 'Las notificaciones dentro de Baknazo funcionan; el push se habilitará pronto.',
    },
    'no-soportado': {
      titulo: 'Este navegador no admite push',
      texto: 'Seguirás viendo tus notificaciones en la campana. En iPhone, agrega Baknazo a la pantalla de inicio.',
    },
  };

  return (
    <section className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-white p-5">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${
          efectivo === 'activo' ? 'bg-success/15 text-success-deep' : efectivo === 'bloqueado' ? 'bg-danger/10 text-danger-deep' : 'bg-accent/10 text-accent-dark'
        }`}
      >
        <IconoCampana />
      </span>
      <div className="min-w-0 flex-1 basis-60">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{textos[efectivo].titulo}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{textos[efectivo].texto}</p>
      </div>
      {efectivo === 'apagado' && (
        <button
          type="button"
          onClick={() => void activar()}
          disabled={ocupado}
          className="h-10 shrink-0 rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {ocupado ? <BaknazoLoader tamano="boton" mensaje="Activando" /> : 'Activar notificaciones push'}
        </button>
      )}
      {efectivo === 'activo' && (
        <button
          type="button"
          onClick={() => void desactivar()}
          disabled={ocupado}
          className="h-10 shrink-0 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted disabled:opacity-60"
        >
          {ocupado ? <BaknazoLoader tamano="boton" mensaje="Desactivando" /> : 'Desactivar en este dispositivo'}
        </button>
      )}
    </section>
  );
}
