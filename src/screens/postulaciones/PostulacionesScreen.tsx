import { useEffect, useState, type ReactNode } from 'react';
import CargarMas from '../../components/CargarMas';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import {
  IconoBocadillo,
  IconoChevron,
  IconoDocumento,
  IconoMaletin,
  IconoTelefono,
} from '../../components/Iconos';
import {
  abrirCv,
  actualizarPostulacion,
  listarEnviadas,
  listarRecibidas,
  retirarPostulacion,
} from '../../api/postulaciones';
import { notificarError, notificarExito } from '../../lib/notificar';
import { formatearBytes } from '../../lib/pdf';
import { ESTADO_EMPLEADOR, ESTADO_POSTULANTE, TONO_ESTADO } from '../../lib/postulaciones';
import { haceCuanto, inicialesDe } from '../../lib/tarjeta';
import { urlCompleta } from '../../lib/imagen';
import type {
  EstadoPostulacion,
  PostulacionEnviada,
  PostulacionRecibida,
  RespuestaRecibidas,
} from '../../types/anuncio';
import BaknazoLoader from '../../components/BaknazoLoader';

type Vista = 'recibidas' | 'enviadas';

const ESTADOS_FILTRO: EstadoPostulacion[] = ['NUEVA', 'VISTA', 'PRESELECCIONADA', 'CONTRATADA', 'DESCARTADA'];

/**
 * La parte administrativa del empleo.
 *
 * "Recibidas" es la bandeja de quien publica vacantes: cada candidato con su CV,
 * sus datos de contacto y un estado que el empleador va moviendo (revisada,
 * preseleccionada, contratada, descartada) más una nota privada. "Enviadas" es
 * el otro lado: quien busca trabajo ve en qué va cada postulación.
 *
 * Todo el estado de la pantalla (pestaña, vacante, filtro) va en la URL, así el
 * enlace del correo de aviso abre directamente la vacante correcta.
 */
export default function PostulacionesScreen() {
  const [parametros, setParametros] = useSearchParams();
  const vista: Vista = parametros.get('vista') === 'enviadas' ? 'enviadas' : 'recibidas';

  return (
    <MarcoApp titulo="Postulaciones">
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pt-8">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-foreground">Postulaciones</h1>
        <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-muted">
          {vista === 'recibidas'
            ? 'Las hojas de vida que llegan a tus vacantes. Revísalas, márcalas y contacta a quien te interese.'
            : 'Las vacantes a las que te postulaste y en qué va cada una.'}
        </p>

        <div role="tablist" aria-label="Tipo de postulaciones" className="mt-5 flex gap-1 border-b border-border">
          <PestanaVista activa={vista === 'recibidas'} onClick={() => setParametros({})}>
            Recibidas
          </PestanaVista>
          <PestanaVista activa={vista === 'enviadas'} onClick={() => setParametros({ vista: 'enviadas' })}>
            Enviadas
          </PestanaVista>
        </div>

        {vista === 'recibidas' ? <Recibidas /> : <Enviadas />}
      </div>
    </MarcoApp>
  );
}

/* ================= Recibidas ================= */

function Recibidas() {
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const anuncio = Number(parametros.get('anuncio')) || undefined;
  const estadoParam = parametros.get('estado');
  const estado = ESTADOS_FILTRO.includes(estadoParam as EstadoPostulacion)
    ? (estadoParam as EstadoPostulacion)
    : undefined;

  const [datos, setDatos] = useState<RespuestaRecibidas | null>(null);
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const clave = `${anuncio ?? ''}|${estado ?? ''}`;
  const cargando = cargadoPara !== clave;

  useEffect(() => {
    let vivo = true;
    listarRecibidas({ anuncio, estado })
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setFallo(null);
      })
      .catch((e: unknown) => {
        if (vivo) setFallo(e instanceof Error ? e.message : 'No se pudieron cargar las postulaciones.');
      })
      .finally(() => {
        if (vivo) setCargadoPara(clave);
      });
    return () => {
      vivo = false;
    };
  }, [anuncio, estado, clave]);

  const filtrar = (cambios: { anuncio?: number | null; estado?: EstadoPostulacion | null }) => {
    const p = new URLSearchParams(parametros);
    if (cambios.anuncio !== undefined) {
      if (cambios.anuncio) p.set('anuncio', String(cambios.anuncio));
      else p.delete('anuncio');
    }
    if (cambios.estado !== undefined) {
      if (cambios.estado) p.set('estado', cambios.estado);
      else p.delete('estado');
    }
    setParametros(p, { replace: true });
  };

  const reemplazar = (actualizada: PostulacionRecibida) =>
    setDatos((d) =>
      d ? { ...d, items: d.items.map((x) => (x.id === actualizada.id ? actualizada : x)) } : d
    );

  const [errorMas, setErrorMas] = useState(false);
  const cargarMas = async () => {
    if (!datos || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const r = await listarRecibidas({ anuncio, estado, offset: datos.items.length });
      const vistos = new Set(datos.items.map((x) => x.id));
      setDatos({ ...r, items: [...datos.items, ...r.items.filter((x) => !vistos.has(x.id))] });
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  };

  const vacantes = datos?.resumen.vacantes ?? [];
  const porEstado = datos?.resumen.porEstado ?? {};
  const totalGeneral = Object.values(porEstado).reduce((s, n) => s + (n ?? 0), 0);

  if (!cargando && datos && vacantes.length === 0) {
    return (
      <Vacio
        titulo="Todavía no tienes vacantes"
        texto="Publica una oferta de empleo y las hojas de vida de los candidatos llegarán aquí, ordenadas y listas para revisar."
        accion={{ texto: 'Publicar una vacante', onClick: () => navegar('/publicar') }}
      />
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
      {/* ---------- Vacantes ---------- */}
      <aside>
        <label className="block lg:hidden">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Vacante</span>
          <select
            value={anuncio ?? ''}
            onChange={(e) => filtrar({ anuncio: e.target.value ? Number(e.target.value) : null })}
            className="h-11 w-full rounded-lg border border-border bg-white px-3 text-[14.5px] text-foreground"
          >
            <option value="">Todas las vacantes ({totalGeneral})</option>
            {vacantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo} ({v.total})
              </option>
            ))}
          </select>
        </label>

        <nav aria-label="Vacantes" className="hidden lg:block">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Tus vacantes</p>
          <ul className="space-y-0.5">
            <li>
              <FilaVacante activa={!anuncio} total={totalGeneral} onClick={() => filtrar({ anuncio: null })}>
                Todas
              </FilaVacante>
            </li>
            {vacantes.map((v) => (
              <li key={v.id}>
                <FilaVacante
                  activa={anuncio === v.id}
                  total={v.total}
                  nuevas={v.nuevas}
                  cerrada={!v.abierta}
                  onClick={() => filtrar({ anuncio: v.id })}
                >
                  {v.titulo}
                </FilaVacante>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* ---------- Candidatos ---------- */}
      <section className="min-w-0">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <ChipEstado activo={!estado} onClick={() => filtrar({ estado: null })}>
            Todas
          </ChipEstado>
          {ESTADOS_FILTRO.map((e) => (
            <ChipEstado key={e} activo={estado === e} onClick={() => filtrar({ estado: e })} total={porEstado[e]}>
              {ESTADO_EMPLEADOR[e]}
            </ChipEstado>
          ))}
        </div>

        {fallo ? (
          <p className="mt-6 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13.5px] text-danger-deep">
            {fallo}
          </p>
        ) : cargando && !datos ? (
          <Esqueleto />
        ) : datos && datos.items.length === 0 ? (
          <Vacio
            titulo={estado ? `Nada en «${ESTADO_EMPLEADOR[estado]}»` : 'Aún no llegan postulaciones'}
            texto={
              estado
                ? 'Prueba con otro estado.'
                : 'Cuando alguien envíe su hoja de vida a esta vacante, la verás aquí y te avisaremos por correo.'
            }
          />
        ) : (
          <>
            <ul className={`mt-4 space-y-3 ${cargando ? 'opacity-60' : ''}`}>
              {datos?.items.map((p) => (
                <TarjetaCandidato key={p.id} postulacion={p} onCambio={reemplazar} />
              ))}
            </ul>
            <CargarMas
              hayMas={Boolean(datos?.hayMas)}
              cargando={cargandoMas}
              error={errorMas}
              onCargar={cargarMas}
            />
          </>
        )}
      </section>
    </div>
  );
}

const ACCIONES: { estado: Exclude<EstadoPostulacion, 'NUEVA'>; texto: string }[] = [
  { estado: 'PRESELECCIONADA', texto: 'Preseleccionar' },
  { estado: 'CONTRATADA', texto: 'Contratar' },
  { estado: 'DESCARTADA', texto: 'Descartar' },
];

function TarjetaCandidato({
  postulacion: p,
  onCambio,
}: {
  postulacion: PostulacionRecibida;
  onCambio: (p: PostulacionRecibida) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [verNota, setVerNota] = useState(Boolean(p.notaInterna));
  const [nota, setNota] = useState(p.notaInterna ?? '');
  const foto = urlCompleta(p.postulante.foto);
  const whatsapp = p.telefono ? `https://wa.me/${p.telefono.replace(/\D/g, '')}` : null;

  const cambiarEstado = async (estado: Exclude<EstadoPostulacion, 'NUEVA'>) => {
    setGuardando(true);
    try {
      onCambio(await actualizarPostulacion(p.id, { estado }));
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarNota = async () => {
    if ((p.notaInterna ?? '') === nota.trim()) return;
    try {
      onCambio(await actualizarPostulacion(p.id, { notaInterna: nota.trim() || null }));
      notificarExito('Nota guardada.');
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo guardar la nota.');
    }
  };

  const verCv = async () => {
    setAbriendo(true);
    try {
      await abrirCv(p.id, p.cv.nombre);
      // El backend la marca como revisada al abrir el CV; se refleja aquí.
      if (p.estado === 'NUEVA') onCambio({ ...p, estado: 'VISTA' });
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo abrir la hoja de vida.');
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <li
      className={`rounded-2xl border bg-white p-4 sm:p-5 ${
        p.estado === 'NUEVA' ? 'border-accent/40 shadow-[0_0_0_3px_rgba(10,110,189,0.06)]' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {foto ? (
          <img src={foto} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-carbon text-[14px] font-semibold text-white">
            {inicialesDe(p.postulante.nombre)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[15.5px] font-semibold text-foreground">{p.postulante.nombre}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TONO_ESTADO[p.estado]}`}>
              {ESTADO_EMPLEADOR[p.estado]}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {p.anuncio.titulo} · {haceCuanto(p.creadoEn)}
          </p>
        </div>
      </div>

      {p.mensaje && (
        <p className="mt-3 rounded-lg bg-background/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line text-foreground">
          {p.mensaje}
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={verCv}
          disabled={abriendo}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-3.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {abriendo ? (
            <BaknazoLoader tamano="boton" mensaje="Abriendo hoja de vida" />
          ) : (
            <>
              <IconoDocumento />
              Ver hoja de vida
              <span className="font-normal text-white/70">{formatearBytes(p.cv.bytes)}</span>
            </>
          )}
        </button>
        <a
          href={`mailto:${p.postulante.correo}?subject=${encodeURIComponent(`Tu postulación: ${p.anuncio.titulo}`)}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-[13.5px] font-semibold text-foreground transition-colors hover:border-muted"
        >
          <IconoBocadillo />
          Correo
        </a>
        {p.telefono && (
          <a
            href={`tel:${p.telefono}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-[13.5px] font-semibold text-foreground transition-colors hover:border-muted"
          >
            <IconoTelefono />
            Llamar
          </a>
        )}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-border px-3.5 text-[13.5px] font-semibold text-foreground transition-colors hover:border-muted"
          >
            WhatsApp
          </a>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
        {ACCIONES.map((a) => (
          <button
            key={a.estado}
            type="button"
            onClick={() => cambiarEstado(a.estado)}
            disabled={guardando || p.estado === a.estado}
            aria-pressed={p.estado === a.estado}
            className={
              p.estado === a.estado
                ? `h-9 rounded-full px-3.5 text-[13px] font-semibold ${TONO_ESTADO[a.estado]}`
                : 'h-9 rounded-full border border-border px-3.5 text-[13px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-50'
            }
          >
            {a.texto}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setVerNota((v) => !v)}
          className="ml-auto text-[13px] font-semibold text-accent hover:underline"
        >
          {verNota ? 'Ocultar nota' : p.notaInterna ? 'Ver nota' : 'Añadir nota'}
        </button>
      </div>

      {verNota && (
        <label className="mt-3 block">
          <span className="sr-only">Nota interna</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value.slice(0, 1000))}
            onBlur={guardarNota}
            rows={2}
            placeholder="Nota privada: solo tú la ves. Se guarda al salir del campo."
            className="w-full resize-y rounded-lg border border-border bg-background/40 px-3 py-2 text-[13.5px] text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>
      )}
    </li>
  );
}

/* ================= Enviadas ================= */

function Enviadas() {
  const navegar = useNavigate();
  const [items, setItems] = useState<PostulacionEnviada[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState(false);
  const [porRetirar, setPorRetirar] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    listarEnviadas()
      .then((r) => {
        if (!vivo) return;
        setItems(r.items);
        setHayMas(r.hayMas);
      })
      .catch((e: unknown) => {
        if (vivo) setFallo(e instanceof Error ? e.message : 'No se pudieron cargar tus postulaciones.');
      });
    return () => {
      vivo = false;
    };
  }, []);

  const cargarMas = async () => {
    if (!items || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const r = await listarEnviadas(items.length);
      const vistos = new Set(items.map((x) => x.id));
      setItems([...items, ...r.items.filter((x) => !vistos.has(x.id))]);
      setHayMas(r.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  };

  const retirar = async (id: number) => {
    try {
      await retirarPostulacion(id);
      setItems((l) => (l ? l.filter((x) => x.id !== id) : l));
      notificarExito('Retiraste tu postulación y borramos tu hoja de vida de esa vacante.');
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo retirar.');
    } finally {
      setPorRetirar(null);
    }
  };

  if (fallo) {
    return (
      <p className="mt-6 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13.5px] text-danger-deep">
        {fallo}
      </p>
    );
  }
  if (!items) return <Esqueleto />;
  if (items.length === 0) {
    return (
      <Vacio
        titulo="Aún no te postulas a ninguna vacante"
        texto="Busca en Empleo, abre una oferta y envía tu hoja de vida en PDF desde la misma ficha."
        accion={{ texto: 'Ver ofertas de empleo', onClick: () => navegar('/anuncios?pilar=empleo') }}
      />
    );
  }

  return (
    <>
    <ul className="mt-6 space-y-3">
      {items.map((p) => (
        <li key={p.id} className="rounded-2xl border border-border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-empleo/10 text-empleo-deep">
              <IconoMaletin />
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <button
                type="button"
                onClick={() => navegar(`/anuncio/${p.anuncio.id}`)}
                className="text-left text-[15.5px] font-semibold text-foreground hover:underline"
              >
                {p.anuncio.titulo}
              </button>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {p.empleador.nombre} · enviada {haceCuanto(p.creadoEn)}
                {!p.anuncio.abierta && ' · vacante cerrada'}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONO_ESTADO[p.estado]}`}>
              {ESTADO_POSTULANTE[p.estado]}
            </span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                abrirCv(p.id, p.cv.nombre).catch((e: unknown) =>
                  notificarError(e instanceof Error ? e.message : 'No se pudo abrir tu hoja de vida.')
                )
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground hover:border-muted"
            >
              <IconoDocumento />
              Mi hoja de vida
            </button>
            {porRetirar === p.id ? (
              <span className="ml-auto flex items-center gap-2 text-[13px]">
                ¿Retirar y borrar tu CV de esta vacante?
                <button
                  type="button"
                  onClick={() => retirar(p.id)}
                  className="h-9 rounded-lg bg-danger px-3 font-semibold text-white"
                >
                  Sí, retirar
                </button>
                <button type="button" onClick={() => setPorRetirar(null)} className="h-9 px-2 font-semibold text-muted">
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPorRetirar(p.id)}
                className="ml-auto h-9 px-2 text-[13px] font-semibold text-danger-deep hover:underline"
              >
                Retirar postulación
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
    <CargarMas hayMas={hayMas} cargando={cargandoMas} error={errorMas} onCargar={cargarMas} />
    </>
  );
}

/* ================= Piezas ================= */

function PestanaVista({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={
        activa
          ? '-mb-px border-b-2 border-foreground px-3 py-3 text-[14.5px] font-semibold text-foreground'
          : '-mb-px border-b-2 border-transparent px-3 py-3 text-[14.5px] font-medium text-muted hover:text-foreground'
      }
    >
      {children}
    </button>
  );
}

function FilaVacante({
  activa,
  total,
  nuevas = 0,
  cerrada = false,
  onClick,
  children,
}: {
  activa: boolean;
  total: number;
  nuevas?: number;
  cerrada?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activa ? 'true' : undefined}
      className={
        activa
          ? 'flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-[13.5px] font-semibold text-foreground ring-1 ring-border'
          : 'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-foreground transition-colors hover:bg-white'
      }
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {cerrada && <span className="block text-[11.5px] font-normal text-muted">Cerrada</span>}
      </span>
      {nuevas > 0 && (
        <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">{nuevas}</span>
      )}
      <span className="text-[12px] text-muted tabular-nums">{total}</span>
      <span className="text-muted [&>svg]:size-4">
        <IconoChevron derecha />
      </span>
    </button>
  );
}

function ChipEstado({
  activo,
  total,
  onClick,
  children,
}: {
  activo: boolean;
  total?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={
        activo
          ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-white'
          : 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-[13px] font-medium text-foreground hover:border-muted'
      }
    >
      {children}
      {total ? <span className={activo ? 'text-white/70' : 'text-muted'}>{total}</span> : null}
    </button>
  );
}

function Esqueleto() {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-white">
      <BaknazoLoader tamano="seccion" mensaje="Cargando postulaciones" />
    </div>
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
    <div className="mt-6 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
      <p className="text-[16px] font-semibold text-foreground">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-[48ch] text-[13.5px] leading-relaxed text-muted">{texto}</p>
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
  );
}
