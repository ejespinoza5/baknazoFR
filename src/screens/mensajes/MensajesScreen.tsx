import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import BaknazoLoader from '../../components/BaknazoLoader';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import {
  IconoAlerta,
  IconoBloquear,
  IconoBocadillo,
  IconoChevron,
  IconoEnviar,
  IconoLupa,
  IconoOpciones,
  IconoReloj,
  IconoVisto,
} from '../../components/Iconos';
import {
  bloquearUsuario,
  desbloquearUsuario,
  listarConversaciones,
  listarMensajes,
  marcarConversacionLeida,
  obtenerConversacion,
} from '../../api/chat';
import { notificarError, notificarExito } from '../../lib/notificar';
import {
  alEventoChat,
  conversacionAbiertaActual,
  enviarMensaje,
  fijarConversacionAbierta,
  fijarNoLeidos,
  useEstadoChat,
} from '../../lib/chatEnVivo';
import { useNavegacion } from '../../lib/navegacion';
import { useBloqueoScroll } from '../../lib/bloqueoScroll';
import { ESTILO_PILAR } from '../../lib/pilares';
import { urlCompleta } from '../../lib/imagen';
import { formatearPrecio, inicialesDe } from '../../lib/tarjeta';
import type { AnuncioChat, Conversacion, EstadoConexion, MensajeChat } from '../../types/chat';

/**
 * Mensajes: la bandeja a la izquierda y la conversación a la derecha.
 *
 * En móvil son dos pantallas y la URL decide cuál se ve (`/mensajes` o
 * `/mensajes/:id`), así el botón de atrás del teléfono vuelve a la bandeja sin
 * código extra. Los mensajes llegan por el WebSocket de `lib/chatEnVivo`; aquí
 * solo se pintan y se ordenan.
 */

const MAX_CARACTERES = 2000;
/** Dos mensajes seguidos de la misma persona en menos de esto van pegados. */
const PEGADOS_MS = 5 * 60 * 1000;

/* ---------- Fechas ---------- */

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

/** "Hoy", "Ayer", "lunes 3 de marzo": el separador entre días. */
function etiquetaDia(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(fecha, hoy)) return 'Hoy';
  if (mismoDia(fecha, ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(fecha.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** La hora en la bandeja: la de hoy, "Ayer", el día de la semana o la fecha. */
function fechaEnBandeja(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  const hoy = new Date();
  if (mismoDia(fecha, hoy)) return hora(iso);
  const dias = Math.floor((hoy.getTime() - fecha.getTime()) / 86_400_000);
  if (dias < 1 || etiquetaDia(iso) === 'Ayer') return 'Ayer';
  if (dias < 7) return fecha.toLocaleDateString('es-EC', { weekday: 'short' });
  return fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Da al chat exactamente el alto que se ve: desde su borde superior (bajo la
 * cabecera) hasta el borde de abajo de la pantalla, o hasta la barra de
 * pestañas si está. Así solo se desplaza el historial y la cabecera y la barra
 * de escribir no se mueven nunca.
 *
 * No sirve un `calc(100svh - …)` fijo: la cabecera mide un píxel más por su
 * borde, la barra de pestañas cambia con el área segura, y sobre todo `svh` no
 * se encoge al abrir el teclado del móvil. Con la página más alta que la
 * pantalla, el scroll del historial se encadenaba a la página y se llevaba la
 * barra de escribir. `visualViewport` sí sabe cuánto deja el teclado.
 */
function useAltoVisible(ref: RefObject<HTMLElement | null>, recalcularCon: unknown) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vv = window.visualViewport;
    const ajustar = () => {
      // Safari desplaza la página al enfocar un campo aunque esté bloqueada:
      // se devuelve arriba para que la cabecera siga en su sitio.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const arriba = el.getBoundingClientRect().top;
      let abajo = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const barra = document.querySelector<HTMLElement>('[data-barra-inferior]');
      const r = barra?.getBoundingClientRect();
      if (r && r.height > 0) abajo = Math.min(abajo, r.top);
      el.style.height = `${Math.max(0, Math.round(abajo - arriba))}px`;
    };
    ajustar();
    vv?.addEventListener('resize', ajustar);
    vv?.addEventListener('scroll', ajustar);
    window.addEventListener('resize', ajustar);
    return () => {
      vv?.removeEventListener('resize', ajustar);
      vv?.removeEventListener('scroll', ajustar);
      window.removeEventListener('resize', ajustar);
    };
  }, [ref, recalcularCon]);
}

function mensajeDe(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

/** Sube una conversación al principio de la bandeja tras cambiarla. */
function alPrincipio(lista: Conversacion[], id: number, cambio: (c: Conversacion) => Conversacion): Conversacion[] {
  const actual = lista.find((c) => c.id === id);
  if (!actual) return lista;
  return [cambio(actual), ...lista.filter((c) => c.id !== id)];
}

/* ================= Pantalla ================= */

export default function MensajesScreen({ conversacionId }: { conversacionId: number | null }) {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const miId = useNavegacion().sesion?.usuario.id ?? null;

  const [conversaciones, setConversaciones] = useState<Conversacion[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  /**
   * La conversación abierta cuando no está en la bandeja: una recién creada
   * (llega en el state de la navegación) o una abierta por enlace directo.
   */
  const [suelta, setSuelta] = useState<Conversacion | null>(
    () => (ubicacion.state as { conversacion?: Conversacion } | null)?.conversacion ?? null
  );
  const [noEncontrada, setNoEncontrada] = useState<number | null>(null);

  /**
   * Escribir por otro anuncio a la misma persona lleva a la misma conversación
   * (misma ruta) con la conversación al día en el state: el anuncio del que se
   * habla cambió. Se adopta en el render para que la cabecera no muestre un
   * instante el anuncio anterior.
   */
  const [navegacionVista, setNavegacionVista] = useState(ubicacion.key);
  if (ubicacion.key !== navegacionVista) {
    setNavegacionVista(ubicacion.key);
    const llegada = (ubicacion.state as { conversacion?: Conversacion } | null)?.conversacion;
    if (llegada) {
      setSuelta(llegada);
      setConversaciones((l) => l?.map((c) => (c.id === llegada.id ? { ...c, anuncio: llegada.anuncio, bloqueo: llegada.bloqueo } : c)) ?? l);
    }
  }

  /** Cambia una conversación esté donde esté: en la bandeja o suelta. */
  const actualizar = useCallback((id: number, cambio: (c: Conversacion) => Conversacion) => {
    setConversaciones((l) => l?.map((c) => (c.id === id ? cambio(c) : c)) ?? l);
    setSuelta((s) => (s && s.id === id ? cambio(s) : s));
  }, []);

  const listaRef = useRef<Conversacion[] | null>(null);
  useEffect(() => {
    listaRef.current = conversaciones;
  }, [conversaciones]);

  const cargar = useCallback(() => {
    listarConversaciones()
      .then((r) => {
        setConversaciones(r.items);
        setHayMas(r.hayMas);
        setFallo(null);
      })
      .catch((e: unknown) => setFallo(mensajeDe(e, 'No se pudieron cargar tus conversaciones.')));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarMas = async () => {
    if (!conversaciones || cargandoMas) return;
    setCargandoMas(true);
    try {
      const r = await listarConversaciones(conversaciones.length);
      setConversaciones((l) => {
        const vistos = new Set((l ?? []).map((c) => c.id));
        return [...(l ?? []), ...r.items.filter((c) => !vistos.has(c.id))];
      });
      setHayMas(r.hayMas);
    } catch {
      // El botón sigue ahí para volver a intentarlo.
    } finally {
      setCargandoMas(false);
    }
  };

  const enBandeja = conversaciones?.find((c) => c.id === conversacionId) ?? null;
  const activa = enBandeja ?? (suelta && suelta.id === conversacionId ? suelta : null);

  /* La abierta por enlace directo que no está en la primera página de la bandeja. */
  useEffect(() => {
    if (conversacionId === null || !conversaciones || enBandeja || (suelta && suelta.id === conversacionId)) return;
    let vivo = true;
    obtenerConversacion(conversacionId)
      .then((c) => {
        if (vivo) setSuelta(c);
      })
      .catch(() => {
        if (vivo) setNoEncontrada(conversacionId);
      });
    return () => {
      vivo = false;
    };
  }, [conversacionId, conversaciones, enBandeja, suelta]);

  /* ---------- Lo que llega en vivo ---------- */

  useEffect(
    () =>
      alEventoChat((e) => {
        if (e.t === 'listo') {
          // Al reconectar se repasa la bandeja: lo que llegó mientras no había
          // conexión no pasó por aquí.
          cargar();
          return;
        }
        if (e.t === 'mensaje' || e.t === 'ack') {
          const m = e.mensaje;
          const esMio = m.remitenteId === miId;
          const mirando = conversacionAbiertaActual() === m.conversacionId && document.visibilityState === 'visible';
          const conocida = listaRef.current?.some((c) => c.id === m.conversacionId);
          if (listaRef.current && !conocida) {
            // Una conversación nueva (o la recién creada, con su primer mensaje).
            obtenerConversacion(m.conversacionId)
              .then((c) =>
                setConversaciones((l) => (l && !l.some((x) => x.id === c.id) ? [c, ...l] : l))
              )
              .catch(() => undefined);
            return;
          }
          // Si el otro escribió por otro anuncio, ese pasa a ser el tema.
          const anuncio = e.t === 'mensaje' ? e.anuncio : undefined;
          setConversaciones((l) =>
            l &&
            alPrincipio(l, m.conversacionId, (c) => ({
              ...c,
              ultimoMensaje: m,
              ultimoMensajeEn: m.creadoEn,
              noLeidos: esMio || mirando ? c.noLeidos : c.noLeidos + 1,
              anuncio: anuncio ?? c.anuncio,
            }))
          );
          if (anuncio) setSuelta((s) => (s && s.id === m.conversacionId ? { ...s, anuncio } : s));
          return;
        }
        if (e.t === 'bloqueo') {
          const bloqueo = { yoBloquee: e.yoBloquee, meBloquearon: e.meBloquearon };
          setConversaciones((l) => l?.map((c) => (c.otro.id === e.usuarioId ? { ...c, bloqueo } : c)) ?? l);
          setSuelta((s) => (s && s.otro.id === e.usuarioId ? { ...s, bloqueo } : s));
          return;
        }
        if (e.t === 'entregado' || e.t === 'leido') {
          setConversaciones((l) =>
            l?.map((c) => {
              const u = c.ultimoMensaje;
              if (c.id !== e.conversacionId || !u || u.remitenteId !== miId || u.id > e.hastaId) return c;
              return {
                ...c,
                ultimoMensaje:
                  e.t === 'leido'
                    ? { ...u, entregadoEn: u.entregadoEn ?? e.leidoEn, leidoEn: e.leidoEn }
                    : { ...u, entregadoEn: u.entregadoEn ?? e.entregadoEn },
              };
            }) ?? l
          );
          return;
        }
        if (e.t === 'conversacion_leida') {
          setConversaciones((l) => l?.map((c) => (c.id === e.conversacionId ? { ...c, noLeidos: 0 } : c)) ?? l);
        }
      }),
    [cargar, miId]
  );

  const alLeer = useCallback((id: number) => {
    setConversaciones((l) => l?.map((c) => (c.id === id ? { ...c, noLeidos: 0 } : c)) ?? l);
  }, []);

  const conChat = conversacionId !== null;

  /* La página no se desplaza: solo la bandeja y el historial, cada uno por dentro. */
  useBloqueoScroll();
  const contenedor = useRef<HTMLDivElement>(null);
  useAltoVisible(contenedor, conChat);

  return (
    <MarcoApp titulo="Mensajes" sinBarraInferior={conChat}>
      <div ref={contenedor} className="flex h-[calc(100dvh-4rem)] overflow-hidden">
        <section
          aria-label="Conversaciones"
          className={`${conChat ? 'hidden lg:flex' : 'flex'} w-full flex-col lg:w-[340px] lg:shrink-0 lg:border-r lg:border-border xl:w-[380px]`}
        >
          <Bandeja
            conversaciones={conversaciones}
            fallo={fallo}
            activaId={conversacionId}
            miId={miId}
            hayMas={hayMas}
            cargandoMas={cargandoMas}
            onCargarMas={cargarMas}
            onReintentar={cargar}
            onAbrir={(id) => navegar(`/mensajes/${id}`)}
          />
        </section>

        <section
          aria-label="Conversación"
          className={`${conChat ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col bg-background`}
        >
          {activa ? (
            <PanelConversacion
              key={activa.id}
              conversacion={activa}
              miId={miId}
              onLeida={alLeer}
              onBloqueo={(bloqueo) => actualizar(activa.id, (c) => ({ ...c, bloqueo }))}
              onVolver={() => navegar('/mensajes')}
            />
          ) : conChat && noEncontrada === conversacionId ? (
            <Vacio
              titulo="No encontramos esta conversación"
              texto="Puede que el enlace esté mal o que no sea una conversación tuya."
              accion={{ texto: 'Ver mis mensajes', onClick: () => navegar('/mensajes') }}
            />
          ) : conChat ? (
            <div className="grid flex-1 place-items-center">
              <BaknazoLoader tamano="seccion" mensaje="Abriendo la conversación" />
            </div>
          ) : (
            <Vacio
              titulo="Elige una conversación"
              texto="Aquí verás los mensajes con quienes publican y con quienes te escriben por tus anuncios."
            />
          )}
        </section>
      </div>
    </MarcoApp>
  );
}

/* ================= Bandeja ================= */

function Bandeja({
  conversaciones,
  fallo,
  activaId,
  miId,
  hayMas,
  cargandoMas,
  onCargarMas,
  onReintentar,
  onAbrir,
}: {
  conversaciones: Conversacion[] | null;
  fallo: string | null;
  activaId: number | null;
  miId: string | null;
  hayMas: boolean;
  cargandoMas: boolean;
  onCargarMas: () => void;
  onReintentar: () => void;
  onAbrir: (id: number) => void;
}) {
  const navegar = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = busqueda
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
    if (!q || !conversaciones) return conversaciones;
    const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return conversaciones.filter(
      (c) => normal(c.otro.nombre).includes(q) || (c.anuncio && normal(c.anuncio.titulo).includes(q))
    );
  }, [busqueda, conversaciones]);

  return (
    <>
      <div className="border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-foreground">Mensajes</h1>
          <span className="ml-auto">
            <IndicadorConexion />
          </span>
        </div>
        {conversaciones && conversaciones.length > 0 && (
          <label className="relative mt-3 block">
            <span className="sr-only">Buscar en tus conversaciones</span>
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted [&>svg]:size-4">
              <IconoLupa />
            </span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por persona o anuncio"
              className="h-10 w-full rounded-lg border border-border bg-white pr-3 pl-9 text-[14px] text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
            />
          </label>
        )}
        <PermisoAvisos />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {fallo && !conversaciones ? (
          <div className="m-2 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13px] text-danger-deep">
            <p className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                <IconoAlerta />
              </span>
              {fallo}
            </p>
            <button type="button" onClick={onReintentar} className="mt-2 font-semibold underline">
              Reintentar
            </button>
          </div>
        ) : !visibles ? (
          <BaknazoLoader tamano="seccion" mensaje="Cargando tus conversaciones" />
        ) : conversaciones && conversaciones.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent/10 text-accent-dark">
              <IconoBocadillo />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-foreground">Aún no tienes mensajes</p>
            <p className="mx-auto mt-1 max-w-[34ch] text-[13px] leading-relaxed text-muted">
              Escríbele a quien publicó desde cualquier producto o servicio. Lo que te escriban por tus anuncios
              también llega aquí.
            </p>
            <button
              type="button"
              onClick={() => navegar('/anuncios')}
              className="mt-4 h-10 rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
            >
              Ver anuncios
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">Ninguna conversación coincide con «{busqueda}».</p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {visibles.map((c) => (
                <li key={c.id}>
                  <FilaConversacion
                    conversacion={c}
                    activa={c.id === activaId}
                    miId={miId}
                    onAbrir={() => onAbrir(c.id)}
                  />
                </li>
              ))}
            </ul>
            {hayMas && !busqueda && (
              <button
                type="button"
                onClick={onCargarMas}
                disabled={cargandoMas}
                className="mx-auto mt-2 mb-3 flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-accent hover:bg-white disabled:opacity-60"
              >
                {cargandoMas ? <BaknazoLoader tamano="boton" mensaje="Cargando" /> : 'Ver conversaciones anteriores'}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FilaConversacion({
  conversacion: c,
  activa,
  miId,
  onAbrir,
}: {
  conversacion: Conversacion;
  activa: boolean;
  miId: string | null;
  onAbrir: () => void;
}) {
  const u = c.ultimoMensaje;
  const mio = u?.remitenteId === miId;
  const sinLeer = c.noLeidos > 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={activa ? 'true' : undefined}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        activa ? 'bg-white shadow-[0_1px_2px_rgba(31,41,55,0.08)] ring-1 ring-border' : 'hover:bg-white'
      }`}
    >
      <Avatar persona={c.otro} clase="size-11" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate text-[14.5px] text-foreground ${sinLeer ? 'font-semibold' : 'font-medium'}`}>
            {c.otro.nombre}
          </span>
          {c.bloqueo.yoBloquee && (
            <span className="shrink-0 rounded-full bg-border/70 px-1.5 py-px text-[10.5px] font-semibold text-muted">
              Bloqueado
            </span>
          )}
          <span
            className={`ml-auto shrink-0 text-[11.5px] tabular-nums ${sinLeer ? 'font-semibold text-accent' : 'text-muted'}`}
          >
            {fechaEnBandeja(c.ultimoMensajeEn ?? c.creadoEn)}
          </span>
        </span>
        {c.anuncio && (
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${ESTILO_PILAR[c.anuncio.pilar].punto}`} />
            <span className="truncate">{c.anuncio.titulo}</span>
          </span>
        )}
        <span className="mt-0.5 flex items-center gap-2">
          <span
            className={`flex min-w-0 flex-1 items-center gap-1 text-[13px] ${sinLeer ? 'text-foreground' : 'text-muted'}`}
          >
            {mio && u && (
              <span className={`shrink-0 [&>svg]:size-3.5 ${u.leidoEn ? 'text-brand-dark' : 'text-muted'}`}>
                <IconoVisto doble={Boolean(u.entregadoEn)} />
              </span>
            )}
            <span className="truncate">{u ? `${mio ? 'Tú: ' : ''}${u.contenido}` : 'Conversación nueva'}</span>
          </span>
          {sinLeer && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
              {c.noLeidos > 99 ? '99+' : c.noLeidos}
              <span className="sr-only"> sin leer</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* ================= Conversación ================= */

type Pendiente = { clienteId: string; contenido: string; creadoEn: string; error: string | null };

type Marca = 'enviando' | 'error' | 'enviado' | 'entregado' | 'leido';

type Fila = {
  clave: string;
  mio: boolean;
  contenido: string;
  creadoEn: string;
  marca: Marca | null;
  /** Sobre qué anuncio se escribió: al cambiar, se intercala su tarjeta. */
  anuncioId: number | null;
  error?: string;
  clienteId?: string;
};

function marcaDe(m: MensajeChat): Marca {
  if (m.leidoEn) return 'leido';
  if (m.entregadoEn) return 'entregado';
  return 'enviado';
}

/** Une los mensajes que llegan con los que ya había, sin duplicar. */
function unir(previos: MensajeChat[], nuevos: MensajeChat[]): MensajeChat[] {
  const porId = new Map(previos.map((m) => [m.id, m]));
  for (const m of nuevos) porId.set(m.id, { ...porId.get(m.id), ...m });
  return [...porId.values()].sort((a, b) => a.id - b.id);
}

const SUGERENCIAS: Record<'productos' | 'servicios' | 'directo', string[]> = {
  productos: ['Hola, ¿sigue disponible?', '¿Cuál es el precio final?', '¿Dónde se puede ver?'],
  servicios: ['Hola, ¿tienes disponibilidad esta semana?', '¿Cuánto costaría?', '¿Atiendes en mi zona?'],
  directo: ['Hola, vi tu perfil en Baknazo.'],
};

function PanelConversacion({
  conversacion: c,
  miId,
  onLeida,
  onBloqueo,
  onVolver,
}: {
  conversacion: Conversacion;
  miId: string | null;
  onLeida: (id: number) => void;
  onBloqueo: (bloqueo: Conversacion['bloqueo']) => void;
  onVolver: () => void;
}) {
  const navegar = useNavigate();
  const estado = useEstadoChat();
  const [mensajes, setMensajes] = useState<MensajeChat[] | null>(null);
  /** Las tarjetas de los anuncios citados en la conversación, por id. */
  const [anuncios, setAnuncios] = useState<Record<string, AnuncioChat>>({});
  /** El anuncio abierto en su ficha, encima del chat (no se sale de aquí). */
  const [ficha, setFicha] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmarBloqueo, setConfirmarBloqueo] = useState(false);
  const [cambiandoBloqueo, setCambiandoBloqueo] = useState(false);
  const bloqueada = c.bloqueo.yoBloquee || c.bloqueo.meBloquearon;
  const [hayMas, setHayMas] = useState(false);
  const [cargandoAntiguos, setCargandoAntiguos] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [nuevosAbajo, setNuevosAbajo] = useState(0);
  const [borrador, setBorrador] = useState('');

  const scroller = useRef<HTMLDivElement>(null);
  /** Si quien lee está al final: solo entonces lo nuevo baja la vista sola. */
  const alFondo = useRef(true);
  /** Distancia al final antes de añadir mensajes antiguos arriba, para no saltar. */
  const anclaAntiguos = useRef<number | null>(null);
  const mensajesRef = useRef<MensajeChat[] | null>(null);
  useEffect(() => {
    mensajesRef.current = mensajes;
  }, [mensajes]);

  /* Mientras está abierta, sus mensajes no son avisos. */
  useEffect(() => {
    fijarConversacionAbierta(c.id);
    return () => fijarConversacionAbierta(null);
  }, [c.id]);

  /**
   * Marca leído lo que mandó el otro. Solo con la pestaña a la vista: si no,
   * el otro vería "leído" en algo que nadie leyó.
   */
  const marcarLeida = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    const hayPorLeer = mensajesRef.current?.some((m) => m.remitenteId !== miId && !m.leidoEn);
    if (!hayPorLeer && c.noLeidos === 0) return;
    marcarConversacionLeida(c.id)
      .then((r) => {
        fijarNoLeidos(r.noLeidos);
        onLeida(c.id);
        const ahora = new Date().toISOString();
        setMensajes((ms) => ms?.map((m) => (m.remitenteId !== miId && !m.leidoEn ? { ...m, leidoEn: ahora } : m)) ?? ms);
      })
      .catch(() => undefined);
  }, [c.id, c.noLeidos, miId, onLeida]);

  const traerUltimos = useCallback(
    () =>
      listarMensajes(c.id).then((r) => {
        setMensajes((ms) => (ms ? unir(ms, r.items) : r.items));
        setAnuncios((a) => ({ ...a, ...r.anuncios }));
        setHayMas((h) => (mensajesRef.current ? h : r.hayMas));
        setFallo(null);
      }),
    [c.id]
  );

  useEffect(() => {
    traerUltimos().catch((e: unknown) => setFallo(mensajeDe(e, 'No se pudieron cargar los mensajes.')));
  }, [traerUltimos]);

  /* Al terminar de cargar, lo pendiente se da por leído. */
  const cargado = mensajes !== null;
  useEffect(() => {
    if (cargado) marcarLeida();
  }, [cargado, marcarLeida]);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') marcarLeida();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [marcarLeida]);

  /* ---------- En vivo ---------- */

  useEffect(
    () =>
      alEventoChat((e) => {
        switch (e.t) {
          case 'listo':
            // Reconectó: lo que llegó mientras tanto se trae y se une.
            traerUltimos().catch(() => undefined);
            break;
          case 'mensaje':
            if (e.mensaje.conversacionId !== c.id) return;
            setMensajes((ms) => (ms ? unir(ms, [e.mensaje]) : ms));
            if (e.anuncio) {
              const anuncio = e.anuncio;
              setAnuncios((a) => ({ ...a, [String(anuncio.id)]: anuncio }));
            }
            if (e.mensaje.remitenteId !== miId) {
              if (!alFondo.current) setNuevosAbajo((n) => n + 1);
              // Se marca en el siguiente tic, con el mensaje ya en la lista.
              setTimeout(marcarLeida, 0);
            }
            break;
          case 'ack':
            setPendientes((p) => p.filter((x) => x.clienteId !== e.clienteId));
            if (e.mensaje.conversacionId === c.id) setMensajes((ms) => (ms ? unir(ms, [e.mensaje]) : ms));
            break;
          case 'error':
            if (e.clienteId) {
              setPendientes((p) => p.map((x) => (x.clienteId === e.clienteId ? { ...x, error: e.mensaje } : x)));
            }
            break;
          case 'entregado':
          case 'leido':
            if (e.conversacionId !== c.id) return;
            setMensajes(
              (ms) =>
                ms?.map((m) => {
                  if (m.remitenteId !== miId || m.id > e.hastaId) return m;
                  if (e.t === 'leido') return { ...m, entregadoEn: m.entregadoEn ?? e.leidoEn, leidoEn: m.leidoEn ?? e.leidoEn };
                  return { ...m, entregadoEn: m.entregadoEn ?? e.entregadoEn };
                }) ?? ms
            );
            break;
        }
      }),
    [c.id, miId, marcarLeida, traerUltimos]
  );

  /* ---------- Scroll ---------- */

  const irAlFinal = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    alFondo.current = true;
    setNuevosAbajo(0);
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anclaAntiguos.current !== null) {
      el.scrollTop = el.scrollHeight - anclaAntiguos.current;
      anclaAntiguos.current = null;
    } else if (alFondo.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mensajes, pendientes]);

  /* Si el historial se encoge (se abre el teclado, crece el texto que se
     escribe) y se estaba al final, se sigue al final: el último mensaje no
     debe quedar tapado. */
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => {
      if (alFondo.current) el.scrollTop = el.scrollHeight;
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const cargarAntiguos = async () => {
    const el = scroller.current;
    if (!mensajes || mensajes.length === 0 || cargandoAntiguos || !hayMas || !el) return;
    setCargandoAntiguos(true);
    try {
      const r = await listarMensajes(c.id, mensajes[0].id);
      anclaAntiguos.current = el.scrollHeight - el.scrollTop;
      setMensajes((ms) => unir(ms ?? [], r.items));
      setAnuncios((a) => ({ ...a, ...r.anuncios }));
      setHayMas(r.hayMas);
    } catch {
      // Se reintenta al volver a subir.
    } finally {
      setCargandoAntiguos(false);
    }
  };

  const alDesplazar = () => {
    const el = scroller.current;
    if (!el) return;
    alFondo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (alFondo.current && nuevosAbajo) setNuevosAbajo(0);
    if (el.scrollTop < 120) void cargarAntiguos();
  };

  /* ---------- Enviar ---------- */

  const enviar = (texto: string) => {
    const contenido = texto.trim();
    if (!contenido) return;
    const clienteId = enviarMensaje(c.id, contenido);
    setPendientes((p) => [...p, { clienteId, contenido, creadoEn: new Date().toISOString(), error: null }]);
    alFondo.current = true;
  };

  const reintentar = (clienteId: string) => {
    const p = pendientes.find((x) => x.clienteId === clienteId);
    setPendientes((l) => l.filter((x) => x.clienteId !== clienteId));
    if (p) enviar(p.contenido);
  };

  /* ---------- Bloquear ---------- */

  const cambiarBloqueo = async (bloquear: boolean) => {
    setCambiandoBloqueo(true);
    try {
      const r = bloquear ? await bloquearUsuario(c.otro.id) : await desbloquearUsuario(c.otro.id);
      onBloqueo(r);
      notificarExito(bloquear ? `Bloqueaste a ${c.otro.nombre}.` : `Desbloqueaste a ${c.otro.nombre}.`);
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo cambiar el bloqueo.'));
    } finally {
      setCambiandoBloqueo(false);
      setConfirmarBloqueo(false);
    }
  };

  /* Menú y diálogo se cierran con Escape; el menú también al tocar fuera. */
  const refMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu && !confirmarBloqueo) return;
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      setConfirmarBloqueo(false);
    };
    const alTocar = (e: MouseEvent) => {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('keydown', alTeclear);
    document.addEventListener('mousedown', alTocar);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.removeEventListener('mousedown', alTocar);
    };
  }, [menu, confirmarBloqueo]);

  /** La tarjeta de un anuncio citado: la del historial o la del tema actual. */
  const anuncioDe = (id: number | null): AnuncioChat | null =>
    id === null ? null : anuncios[String(id)] ?? (c.anuncio?.id === id ? c.anuncio : null);

  /* ---------- Filas a pintar ---------- */

  const filas: Fila[] = useMemo(
    () => [
      ...(mensajes ?? []).map((m) => ({
        clave: `m${m.id}`,
        mio: m.remitenteId === miId,
        contenido: m.contenido,
        creadoEn: m.creadoEn,
        marca: m.remitenteId === miId ? marcaDe(m) : null,
        anuncioId: m.anuncioId,
      })),
      // Lo pendiente se escribió sobre el tema actual, que es el que le pondrá el servidor.
      ...pendientes.map((p) => ({
        clave: `p${p.clienteId}`,
        mio: true,
        contenido: p.contenido,
        creadoEn: p.creadoEn,
        anuncioId: c.anuncio?.id ?? null,
        marca: (p.error ? 'error' : 'enviando') as Marca,
        error: p.error ?? undefined,
        clienteId: p.clienteId,
      })),
    ],
    [mensajes, pendientes, miId, c.anuncio?.id]
  );

  const vacia = mensajes !== null && filas.length === 0;
  const sugerencias = SUGERENCIAS[c.anuncio?.pilar === 'servicios' ? 'servicios' : c.anuncio ? 'productos' : 'directo'];

  return (
    <>
      {/* ---------- Cabecera ---------- */}
      <header className="flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2.5 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a la bandeja"
          className="grid size-10 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-white lg:hidden"
        >
          <IconoChevron izquierda />
        </button>
        <button
          type="button"
          onClick={() => navegar(`/perfil/${c.otro.id}`)}
          className="flex min-w-0 items-center gap-3 rounded-xl py-0.5 pr-2 text-left transition-colors hover:bg-white"
        >
          <Avatar persona={c.otro} clase="size-10" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-foreground">{c.otro.nombre}</span>
            <span className="block text-[12px] text-muted">
              {c.bloqueo.yoBloquee ? 'Bloqueado' : c.otro.esNegocio ? 'Negocio' : 'Persona'} · ver perfil
            </span>
          </span>
        </button>

        <div ref={refMenu} className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Más opciones"
            aria-haspopup="menu"
            aria-expanded={menu}
            className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-white"
          >
            <IconoOpciones />
          </button>
          {menu && (
            <div
              role="menu"
              className="absolute top-full right-0 z-20 mt-1 w-60 rounded-xl border border-border bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => navegar(`/perfil/${c.otro.id}`)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-foreground hover:bg-background"
              >
                Ver perfil
              </button>
              {c.bloqueo.yoBloquee ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={cambiandoBloqueo}
                  onClick={() => {
                    setMenu(false);
                    void cambiarBloqueo(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-foreground hover:bg-background disabled:opacity-60"
                >
                  <IconoBloquear />
                  Desbloquear a {c.otro.nombre}
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    setConfirmarBloqueo(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-danger-deep hover:bg-danger/[0.05]"
                >
                  <IconoBloquear />
                  <span className="truncate">Bloquear a {c.otro.nombre}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {c.anuncio && (
        <div className="mx-3 mt-3 sm:mx-4">
          <FichaAnuncio anuncio={c.anuncio} onAbrir={() => setFicha(c.anuncio!.id)} />
        </div>
      )}

      <AvisoConexion estado={estado} />

      {/* ---------- Mensajes ---------- */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={alDesplazar}
          className="h-full overflow-y-auto overscroll-contain px-3 pt-2 pb-4 sm:px-6"
          role="log"
          aria-live="polite"
          aria-label={`Mensajes con ${c.otro.nombre}`}
        >
          {fallo && !mensajes ? (
            <p className="mx-auto mt-6 max-w-sm rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-center text-[13px] text-danger-deep">
              {fallo}
            </p>
          ) : !mensajes ? (
            <BaknazoLoader tamano="seccion" mensaje="Cargando mensajes" />
          ) : (
            <>
              {cargandoAntiguos && (
                <div className="flex justify-center py-2">
                  <BaknazoLoader tamano="boton" mensaje="Cargando mensajes anteriores" />
                </div>
              )}
              {!hayMas && filas.length > 0 && (
                <p className="py-3 text-center text-[12px] text-muted">
                  Inicio de tu conversación con {c.otro.nombre}
                </p>
              )}
              {vacia && (
                <div className="mx-auto mt-8 max-w-sm text-center">
                  <Avatar persona={c.otro} clase="mx-auto size-14" />
                  <p className="mt-3 text-[15px] font-semibold text-foreground">Escríbele a {c.otro.nombre}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    {c.anuncio
                      ? 'Pregunta lo que necesites saber antes de decidirte.'
                      : 'Tu mensaje le llegará al instante si tiene Baknazo abierto.'}
                  </p>
                  <div className={`mt-4 flex-wrap justify-center gap-2 ${bloqueada ? 'hidden' : 'flex'}`}>
                    {sugerencias.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBorrador(s)}
                        className="h-9 rounded-full border border-border bg-white px-3.5 text-[13px] font-medium text-foreground transition-colors hover:border-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filas.map((f, i) => {
                const anterior = filas[i - 1];
                const siguiente = filas[i + 1];
                const nuevoDia = !anterior || !mismoDia(new Date(anterior.creadoEn), new Date(f.creadoEn));
                const pegadoArriba =
                  !nuevoDia &&
                  anterior?.mio === f.mio &&
                  new Date(f.creadoEn).getTime() - new Date(anterior.creadoEn).getTime() < PEGADOS_MS;
                const pegadoAbajo =
                  !!siguiente &&
                  siguiente.mio === f.mio &&
                  mismoDia(new Date(siguiente.creadoEn), new Date(f.creadoEn)) &&
                  new Date(siguiente.creadoEn).getTime() - new Date(f.creadoEn).getTime() < PEGADOS_MS;
                // Al pasar a hablar de otro anuncio se intercala su tarjeta: así
                // el historial dice sobre qué era cada parte de la conversación.
                const cambioDeTema = f.anuncioId !== null && f.anuncioId !== (anterior?.anuncioId ?? null);
                const tema = cambioDeTema ? anuncioDe(f.anuncioId) : null;
                return (
                  <div key={f.clave}>
                    {nuevoDia && (
                      <div className="my-4 flex justify-center">
                        <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-medium text-muted first-letter:uppercase ring-1 ring-border">
                          {etiquetaDia(f.creadoEn)}
                        </span>
                      </div>
                    )}
                    {tema && (
                      <div className="my-4 flex justify-center">
                        <FichaAnuncio anuncio={tema} compacta onAbrir={() => setFicha(tema.id)} />
                      </div>
                    )}
                    <Burbuja
                      fila={f}
                      pegadoArriba={pegadoArriba && !tema}
                      pegadoAbajo={pegadoAbajo && siguiente?.anuncioId === f.anuncioId}
                      onReintentar={reintentar}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>

        {nuevosAbajo > 0 && (
          <button
            type="button"
            onClick={irAlFinal}
            className="absolute bottom-3 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(31,41,55,0.6)]"
          >
            {nuevosAbajo === 1 ? '1 mensaje nuevo' : `${nuevosAbajo} mensajes nuevos`}
            <IconoChevron />
          </button>
        )}
      </div>

      {c.bloqueo.yoBloquee ? (
        <div className="border-t border-border bg-background px-4 py-4 text-center">
          <p className="text-[13.5px] text-foreground">
            Bloqueaste a <span className="font-semibold">{c.otro.nombre}</span>. Ninguno de los dos puede escribir aquí.
          </p>
          <button
            type="button"
            onClick={() => void cambiarBloqueo(false)}
            disabled={cambiandoBloqueo}
            className="mt-2 h-9 rounded-lg border border-border bg-white px-4 text-[13.5px] font-semibold text-foreground transition-colors hover:border-muted disabled:opacity-60"
          >
            {cambiandoBloqueo ? <BaknazoLoader tamano="boton" mensaje="Desbloqueando" /> : 'Desbloquear'}
          </button>
        </div>
      ) : c.bloqueo.meBloquearon ? (
        <p className="border-t border-border bg-background px-4 py-4 text-center text-[13.5px] text-muted">
          No puedes enviar mensajes en esta conversación.
        </p>
      ) : (
        <Compositor
          valor={borrador}
          onCambiar={setBorrador}
          onEnviar={(t) => {
            enviar(t);
            setBorrador('');
          }}
          conectado={estado === 'conectado'}
          nombre={c.otro.nombre}
        />
      )}

      {ficha !== null && <DetalleAnuncioModal id={ficha} onCerrar={() => setFicha(null)} sinChat />}

      {confirmarBloqueo && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-carbon/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-bloquear"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmarBloqueo(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]">
            <h2 id="titulo-bloquear" className="text-[17px] font-semibold tracking-tight text-foreground">
              ¿Bloquear a {c.otro.nombre}?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Ninguno de los dos podrá enviar mensajes en esta conversación. El historial se conserva y puedes
              desbloquear cuando quieras desde este mismo chat.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmarBloqueo(false)}
                className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void cambiarBloqueo(true)}
                disabled={cambiandoBloqueo}
                className="h-10 rounded-lg bg-danger px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {cambiandoBloqueo ? <BaknazoLoader tamano="boton" mensaje="Bloqueando" /> : 'Sí, bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * La tarjeta de un anuncio dentro del chat: arriba, la del tema actual; en el
 * historial, compacta, donde la conversación pasa a hablar de él. Abre su
 * ficha encima del chat.
 */
function FichaAnuncio({
  anuncio,
  compacta = false,
  onAbrir,
}: {
  anuncio: AnuncioChat;
  compacta?: boolean;
  onAbrir: () => void;
}) {
  const estilo = ESTILO_PILAR[anuncio.pilar];
  const foto = urlCompleta(anuncio.portada);
  const tamano = compacta ? 'size-9' : 'size-11';
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`flex items-center gap-3 rounded-xl border border-border bg-white text-left transition-colors hover:border-muted ${
        compacta ? 'max-w-[min(100%,22rem)] p-1.5 pr-3' : 'w-full p-2 pr-3'
      }`}
    >
      {foto ? (
        <img src={foto} alt="" className={`${tamano} shrink-0 rounded-lg object-cover`} />
      ) : (
        <span className={`${tamano} shrink-0 rounded-lg ${estilo.fondo}`} aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-semibold text-foreground ${compacta ? 'text-[12.5px]' : 'text-[13.5px]'}`}>
          {anuncio.titulo}
        </span>
        <span className={`mt-0.5 flex items-center gap-1.5 text-muted ${compacta ? 'text-[11.5px]' : 'text-[12.5px]'}`}>
          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${estilo.punto}`} />
          {estilo.nombre}
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-foreground">{formatearPrecio(anuncio.precio, anuncio.pilar)}</span>
        </span>
      </span>
      {!anuncio.disponible && (
        <span className="shrink-0 rounded-full bg-border/70 px-2 py-0.5 text-[11px] font-semibold text-muted">
          No disponible
        </span>
      )}
    </button>
  );
}

/* ================= Piezas ================= */

function Burbuja({
  fila: f,
  pegadoArriba,
  pegadoAbajo,
  onReintentar,
}: {
  fila: Fila;
  pegadoArriba: boolean;
  pegadoAbajo: boolean;
  onReintentar: (clienteId: string) => void;
}) {
  // La esquina del lado de quien habla se recorta solo en el último del grupo:
  // así un grupo se lee como un bloque que "sale" de esa persona.
  const esquina = pegadoAbajo ? '' : f.mio ? 'rounded-br-md' : 'rounded-bl-md';
  return (
    <div className={`flex flex-col ${f.mio ? 'items-end' : 'items-start'} ${pegadoArriba ? 'mt-0.5' : 'mt-3'}`}>
      <div
        className={`max-w-[min(80%,34rem)] rounded-2xl px-3.5 pt-2 pb-1.5 text-[14.5px] leading-relaxed ${esquina} ${
          f.mio ? 'bg-accent text-white' : 'bg-white text-foreground ring-1 ring-border'
        } ${f.marca === 'error' ? 'opacity-70' : ''}`}
      >
        <p className="break-words whitespace-pre-wrap">{f.contenido}</p>
        <p
          className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums ${
            f.mio ? 'text-white/75' : 'text-muted'
          }`}
        >
          <time dateTime={f.creadoEn}>{hora(f.creadoEn)}</time>
          {f.marca && <MarcaEntrega marca={f.marca} />}
        </p>
      </div>
      {f.marca === 'error' && f.clienteId && (
        <button
          type="button"
          onClick={() => onReintentar(f.clienteId!)}
          className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-danger-deep hover:underline"
        >
          <IconoAlerta />
          {f.error ?? 'No se envió'} · Reintentar
        </button>
      )}
    </div>
  );
}

/**
 * Enviando (reloj), enviado (un visto), entregado (dos) y leído (dos, en el
 * dorado de la marca). El dorado sobre el azul de la burbuja es la marca que
 * más se ve del chat, y el único sitio donde cambia el color y no la forma.
 */
function MarcaEntrega({ marca }: { marca: Marca }) {
  const texto: Record<Marca, string> = {
    enviando: 'Enviando',
    error: 'No enviado',
    enviado: 'Enviado',
    entregado: 'Entregado',
    leido: 'Leído',
  };
  return (
    <span
      title={texto[marca]}
      className={`inline-flex [&>svg]:size-3.5 ${marca === 'leido' ? 'text-brand' : ''}`}
    >
      {marca === 'enviando' || marca === 'error' ? (
        <IconoReloj />
      ) : (
        <IconoVisto doble={marca !== 'enviado'} />
      )}
      <span className="sr-only">{texto[marca]}</span>
    </span>
  );
}

function Compositor({
  valor,
  onCambiar,
  onEnviar,
  conectado,
  nombre,
}: {
  valor: string;
  onCambiar: (v: string) => void;
  onEnviar: (texto: string) => void;
  conectado: boolean;
  nombre: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  /* Crece con el texto hasta unas cinco líneas; después se desplaza dentro. */
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [valor]);

  const enviar = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valor.trim()) return;
    onEnviar(valor);
    area.current?.focus();
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // En el ordenador Enter envía y Mayús+Enter salta de línea. En pantallas
    // táctiles Enter siempre es salto de línea: ahí se envía con el botón.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    enviar();
  };

  const cerca = valor.length > MAX_CARACTERES - 200;

  return (
    <form onSubmit={enviar} className="border-t border-border bg-background px-3 pt-3 pb-3 sm:px-4">
      {!conectado && (
        <p className="mb-2 text-[12px] text-warning-deep">Sin conexión: lo que escribas se enviará al reconectar.</p>
      )}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Mensaje para {nombre}</span>
          <textarea
            ref={area}
            rows={1}
            value={valor}
            maxLength={MAX_CARACTERES}
            onChange={(e) => onCambiar(e.target.value)}
            onKeyDown={alTeclear}
            placeholder="Escribe un mensaje"
            className="block max-h-36 min-h-11 w-full resize-none rounded-2xl border border-border bg-white px-4 py-2.5 text-[14.5px] leading-snug text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          aria-label="Enviar mensaje"
          disabled={!valor.trim()}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-foreground transition-colors hover:bg-brand-dark disabled:bg-border/80 disabled:text-muted"
        >
          <IconoEnviar />
        </button>
      </div>
      {cerca && (
        <p className="mt-1 text-right text-[11.5px] text-muted tabular-nums">
          {valor.length}/{MAX_CARACTERES}
        </p>
      )}
    </form>
  );
}

/** Una línea discreta en la bandeja: solo se ve cuando algo no va bien. */
function IndicadorConexion() {
  const estado = useEstadoChat();
  if (estado === 'conectado') return null;
  const texto = estado === 'desconectado' ? 'Sin conexión' : 'Conectando…';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-[11.5px] font-semibold text-warning-deep">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
      {texto}
    </span>
  );
}

/** Franja sobre los mensajes mientras no hay conexión en vivo. */
function AvisoConexion({ estado }: { estado: EstadoConexion }) {
  if (estado === 'conectado') return null;
  return (
    <p
      role="status"
      className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/[0.08] px-3 py-2 text-[12.5px] text-warning-deep sm:mx-4"
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 animate-pulse rounded-full bg-warning" />
      {estado === 'desconectado'
        ? 'Sin conexión con el chat. Recarga la página si no vuelve.'
        : 'Reconectando… los mensajes nuevos aparecerán en cuanto vuelva la conexión.'}
    </p>
  );
}

/**
 * Pide permiso para avisar con notificaciones del navegador cuando la pestaña
 * no está a la vista. Solo se ofrece si nunca se respondió.
 */
function PermisoAvisos() {
  const soportado = typeof window !== 'undefined' && 'Notification' in window;
  const [permiso, setPermiso] = useState(() => (soportado ? Notification.permission : 'denied'));
  if (!soportado || permiso !== 'default') return null;
  return (
    <button
      type="button"
      onClick={() => {
        void Notification.requestPermission().then(setPermiso);
      }}
      className="mt-2.5 text-[12.5px] font-semibold text-accent hover:underline"
    >
      Avisarme de mensajes nuevos aunque esté en otra pestaña
    </button>
  );
}

function Avatar({
  persona,
  clase,
}: {
  persona: Conversacion['otro'];
  clase: string;
}) {
  const foto = urlCompleta(persona.foto);
  if (foto) {
    return <img src={foto} alt="" className={`${clase} shrink-0 rounded-full object-cover ring-1 ring-black/5`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`grid ${clase} shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white ${
        persona.esNegocio ? 'bg-accent' : 'bg-carbon'
      }`}
    >
      {inicialesDe(persona.nombre)}
    </span>
  );
}

function Vacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: { texto: string; onClick: () => void };
}) {
  return (
    <div className="grid flex-1 place-items-center px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent/10 text-accent-dark">
          <IconoBocadillo />
        </span>
        <p className="mt-3 text-[16px] font-semibold text-foreground">{titulo}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{texto}</p>
        {accion && (
          <button
            type="button"
            onClick={accion.onClick}
            className="mt-5 h-10 rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
          >
            {accion.texto}
          </button>
        )}
      </div>
    </div>
  );
}
