import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import BaknazoLoader from '../../components/BaknazoLoader';
import {
  IconoAlerta,
  IconoCheck,
  IconoChevron,
  IconoDocumento,
  IconoLapiz,
  IconoMaletin,
  IconoMas,
  IconoOjo,
} from '../../components/Iconos';
import { editarAnuncio } from '../../api/anuncios';
import { abrirCv, actualizarPostulacion, listarRecibidas, listarVacantes } from '../../api/postulaciones';
import { useNavegacion } from '../../lib/navegacion';
import { notificarError, notificarExito } from '../../lib/notificar';
import { ESTADO_EMPLEADOR, TONO_ESTADO } from '../../lib/postulaciones';
import {
  formatearPrecio,
  haceCuanto,
  inicialesDe,
  plural,
  valorLegible,
  type TonoEstado,
} from '../../lib/tarjeta';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import { urlCompleta } from '../../lib/imagen';
import type { EstadoPostulacion, PostulacionRecibida, VacanteGestion } from '../../types/anuncio';

/**
 * El módulo de vacantes de un negocio.
 *
 * Postulaciones es la bandeja: candidato por candidato. Esta pantalla es el
 * tablero de arriba: cada vacante con su anuncio, cómo va su proceso (el embudo)
 * y quién se postuló, para decidir por dónde empezar. Desde aquí se pausa, se
 * cierra o se edita el anuncio, y se mueve a un candidato sin salir de la lista.
 */

type Filtro = 'todas' | 'abiertas' | 'pausadas' | 'cubiertas';

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'abiertas', label: 'Abiertas' },
  { id: 'pausadas', label: 'Pausadas' },
  { id: 'cubiertas', label: 'Cubiertas' },
];

function pasaFiltro(v: VacanteGestion, filtro: Filtro): boolean {
  if (filtro === 'abiertas') return v.abierta;
  if (filtro === 'pausadas') return !v.vendido && v.estado === 'PAUSADO';
  if (filtro === 'cubiertas') return v.vendido;
  return true;
}

/**
 * El estado del anuncio dicho como se dice de un puesto de trabajo. `ficha` es
 * el mismo estado en los tonos que entiende la ficha del anuncio.
 */
function selloVacante(v: VacanteGestion): { texto: string; tono: string; ficha: TonoEstado } {
  if (v.vendido) return { texto: 'Cubierta', tono: 'bg-accent/10 text-accent-dark', ficha: 'neutro' };
  if (v.estado === 'PUBLICADO') return { texto: 'Abierta', tono: 'bg-success/15 text-success-deep', ficha: 'exito' };
  if (v.estado === 'PAUSADO') return { texto: 'Pausada', tono: 'bg-warning/10 text-warning-deep', ficha: 'aviso' };
  if (v.estado === 'RECHAZADO') return { texto: 'Rechazada', tono: 'bg-danger/10 text-danger-deep', ficha: 'peligro' };
  return { texto: 'Borrador', tono: 'bg-border/70 text-foreground', ficha: 'neutro' };
}

/**
 * El orden del embudo: de lo que espera una decisión a lo que ya se decidió.
 * Los colores son los mismos de los sellos de Postulaciones, más intensos para
 * que se lean como barra.
 */
const ORDEN_EMBUDO: EstadoPostulacion[] = ['NUEVA', 'VISTA', 'PRESELECCIONADA', 'CONTRATADA', 'DESCARTADA'];

const COLOR_EMBUDO: Record<EstadoPostulacion, string> = {
  NUEVA: 'bg-accent',
  VISTA: 'bg-muted/45',
  PRESELECCIONADA: 'bg-brand',
  CONTRATADA: 'bg-success',
  DESCARTADA: 'bg-danger/35',
};

const AYUDA_ESTADO: Record<EstadoPostulacion, string> = {
  NUEVA: 'Llegó y aún no abres su hoja de vida.',
  VISTA: 'Ya abriste su hoja de vida.',
  PRESELECCIONADA: 'Pasa a la siguiente etapa: entrevista o prueba.',
  CONTRATADA: 'Es la persona elegida para el puesto.',
  DESCARTADA: 'No sigue en el proceso. Ve «No seleccionada».',
};

/** Las acciones del candidato, en el orden en que avanza un proceso. */
const ACCIONES: { estado: Exclude<EstadoPostulacion, 'NUEVA'>; texto: string }[] = [
  { estado: 'PRESELECCIONADA', texto: 'Preseleccionar' },
  { estado: 'CONTRATADA', texto: 'Contratar' },
  { estado: 'DESCARTADA', texto: 'Descartar' },
];

function mensajeDe(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

/** Mueve un candidato de un estado a otro en las cifras del embudo. */
function moverEnEmbudo(v: VacanteGestion, de: EstadoPostulacion, a: EstadoPostulacion): VacanteGestion {
  if (de === a) return v;
  const porEstado = { ...v.postulaciones.porEstado };
  porEstado[de] = Math.max(0, (porEstado[de] ?? 0) - 1);
  porEstado[a] = (porEstado[a] ?? 0) + 1;
  return { ...v, postulaciones: { ...v.postulaciones, porEstado } };
}

export default function VacantesScreen({ onEditar }: { onEditar: (id: number) => void }) {
  const { irAPublicar } = useNavegacion();
  const [vacantes, setVacantes] = useState<VacanteGestion[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  /** La vacante desplegada, con sus candidatos a la vista. Una a la vez. */
  const [abierta, setAbierta] = useState<number | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const [porCubrir, setPorCubrir] = useState<VacanteGestion | null>(null);
  /**
   * La vacante con su ficha abierta encima de la lista. Se guarda el id y se lee
   * de la lista para que pausar o cubrir desde la ficha se vea en las dos.
   * Ir a /anuncio/:id sacaba de aquí al feed, que pinta la ficha detrás.
   */
  const [fichaId, setFichaId] = useState<number | null>(null);
  const ficha = vacantes?.find((v) => v.id === fichaId) ?? null;

  useEffect(() => {
    let vivo = true;
    listarVacantes()
      .then((r) => {
        if (!vivo) return;
        setVacantes(r.items);
        // La primera con candidatos nuevos se abre sola: es por donde se empieza.
        const urgente = r.items.find((v) => (v.postulaciones.porEstado.NUEVA ?? 0) > 0);
        if (urgente) setAbierta(urgente.id);
      })
      .catch((e: unknown) => {
        if (vivo) setFallo(mensajeDe(e, 'No se pudieron cargar tus vacantes.'));
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!porCubrir) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPorCubrir(null);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [porCubrir]);

  const reemplazar = (id: number, cambio: (v: VacanteGestion) => VacanteGestion) =>
    setVacantes((lista) => (lista ? lista.map((v) => (v.id === id ? cambio(v) : v)) : lista));

  const cuentas = useMemo(() => {
    const lista = vacantes ?? [];
    return Object.fromEntries(FILTROS.map((f) => [f.id, lista.filter((v) => pasaFiltro(v, f.id)).length])) as Record<
      Filtro,
      number
    >;
  }, [vacantes]);

  const nuevasTotal = (vacantes ?? []).reduce((s, v) => s + (v.postulaciones.porEstado.NUEVA ?? 0), 0);
  const conNuevas = (vacantes ?? []).filter((v) => (v.postulaciones.porEstado.NUEVA ?? 0) > 0).length;
  const visibles = (vacantes ?? []).filter((v) => pasaFiltro(v, filtro));

  /* ---------- Acciones sobre el anuncio ---------- */

  const cambiarEstado = async (v: VacanteGestion, destino: 'PUBLICADO' | 'PAUSADO') => {
    if (accionando !== null) return;
    setAccionando(v.id);
    try {
      const { anuncio } = await editarAnuncio(v.id, { estado: destino }, []);
      reemplazar(v.id, (x) => ({ ...x, estado: anuncio.estado, abierta: anuncio.estado === 'PUBLICADO' && !x.vendido }));
      notificarExito(destino === 'PAUSADO' ? `Pausaste «${v.titulo}».` : `«${v.titulo}» vuelve a recibir postulaciones.`);
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo cambiar el estado de la vacante.'));
    } finally {
      setAccionando(null);
    }
  };

  const cambiarCubierta = async (v: VacanteGestion, vendido: boolean) => {
    if (accionando !== null) return;
    setAccionando(v.id);
    try {
      const { anuncio } = await editarAnuncio(v.id, { vendido }, []);
      reemplazar(v.id, (x) => ({
        ...x,
        vendido: Boolean(anuncio.vendido),
        vendidoEn: anuncio.vendidoEn ?? null,
        abierta: x.estado === 'PUBLICADO' && !anuncio.vendido,
      }));
      notificarExito(
        vendido ? `Marcaste «${v.titulo}» como cubierta.` : `«${v.titulo}» vuelve a recibir postulaciones.`
      );
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo cambiar la vacante.'));
    } finally {
      setAccionando(null);
    }
  };

  return (
    <MarcoApp titulo="Vacantes">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-start gap-6 px-4 pt-5 pb-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground">Vacantes</h1>
              <p className="mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-muted">
                {!vacantes
                  ? 'Tus ofertas de empleo, cada una con su anuncio y sus candidatos.'
                  : nuevasTotal > 0
                    ? `${plural(nuevasTotal, 'candidato nuevo espera', 'candidatos nuevos esperan')} revisión en ${plural(conNuevas, 'vacante', 'vacantes')}.`
                    : 'Estás al día: no hay candidatos sin revisar.'}
              </p>
            </div>
            <button
              type="button"
              onClick={irAPublicar}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-brand-dark"
            >
              <IconoMas />
              Publicar vacante
            </button>
          </div>

          {fallo && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13px] leading-snug text-danger-deep">
              <span className="mt-0.5 shrink-0">
                <IconoAlerta />
              </span>
              {fallo}
            </p>
          )}

          {vacantes && vacantes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {FILTROS.map((chip) => {
                const activo = filtro === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFiltro(chip.id)}
                    aria-pressed={activo}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors ${
                      activo
                        ? 'border-transparent bg-accent text-white'
                        : 'border-border bg-white text-foreground hover:border-muted'
                    }`}
                  >
                    {chip.label}
                    <span className={`tabular-nums ${activo ? 'text-white/75' : 'text-muted'}`}>{cuentas[chip.id]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!vacantes && !fallo ? (
            <div className="mt-6 rounded-2xl border border-border bg-white">
              <BaknazoLoader tamano="seccion" mensaje="Cargando tus vacantes" />
            </div>
          ) : vacantes && vacantes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-empleo/10 text-empleo-deep">
                <IconoMaletin />
              </span>
              <p className="mt-3 text-[16px] font-semibold text-foreground">Todavía no tienes vacantes</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
                Publica una oferta de empleo y aquí verás cada vacante con sus candidatos y cómo avanza el proceso.
              </p>
              <button
                type="button"
                onClick={irAPublicar}
                className="mt-5 h-10 rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
              >
                Publicar una vacante
              </button>
            </div>
          ) : vacantes && visibles.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-white/70 px-6 py-10 text-center">
              <p className="text-[15px] font-medium text-foreground">Ninguna vacante en «{FILTROS.find((f) => f.id === filtro)?.label}»</p>
              <p className="mt-1 text-[13px] text-muted">Prueba con otro filtro.</p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {visibles.map((v) => (
                <FilaVacante
                  key={v.id}
                  vacante={v}
                  abierta={abierta === v.id}
                  bloqueado={accionando !== null}
                  ocupado={accionando === v.id}
                  onAlternar={() => setAbierta((a) => (a === v.id ? null : v.id))}
                  onAbrirAnuncio={() => setFichaId(v.id)}
                  onEditar={() => onEditar(v.id)}
                  onCambiarEstado={(destino) => cambiarEstado(v, destino)}
                  onCubrir={() => (v.vendido ? cambiarCubierta(v, false) : setPorCubrir(v))}
                  onMoverCandidato={(de, a) => reemplazar(v.id, (x) => moverEnEmbudo(x, de, a))}
                />
              ))}
            </ul>
          )}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            <section className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Cómo leer el embudo</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Cada barra reparte a los candidatos de la vacante según en qué va su proceso.
              </p>
              <dl className="mt-3 space-y-3">
                {ORDEN_EMBUDO.map((estado) => (
                  <div key={estado} className="flex gap-2.5">
                    <span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${COLOR_EMBUDO[estado]}`} />
                    <div>
                      <dt className="text-[13px] font-semibold text-foreground">{ESTADO_EMPLEADOR[estado]}</dt>
                      <dd className="text-[12.5px] leading-relaxed text-muted">{AYUDA_ESTADO[estado]}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </aside>
      </div>

      {ficha && (
        <DetalleAnuncioModal
          id={ficha.id}
          onCerrar={() => setFichaId(null)}
          estado={{ etiqueta: selloVacante(ficha).texto, tono: selloVacante(ficha).ficha }}
          onEditar={(id) => {
            setFichaId(null);
            onEditar(id);
          }}
          vendido={ficha.vendido}
          onCambiarVendido={(vendido) => cambiarCubierta(ficha, vendido)}
        />
      )}

      {porCubrir && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-carbon/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-cubrir"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPorCubrir(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]">
            <h2 id="titulo-cubrir" className="text-[17px] font-semibold tracking-tight text-foreground">
              ¿Marcar «{porCubrir.titulo}» como cubierta?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Deja de salir en el feed y ya no recibe postulaciones. Los candidatos que tienes se quedan aquí, y
              puedes reabrirla cuando quieras.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorCubrir(null)}
                className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const objetivo = porCubrir;
                  setPorCubrir(null);
                  cambiarCubierta(objetivo, true);
                }}
                className="h-10 rounded-lg bg-accent px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Sí, está cubierta
              </button>
            </div>
          </div>
        </div>
      )}
    </MarcoApp>
  );
}

/* ================= Una vacante ================= */

function FilaVacante({
  vacante: v,
  abierta,
  bloqueado,
  ocupado,
  onAlternar,
  onAbrirAnuncio,
  onEditar,
  onCambiarEstado,
  onCubrir,
  onMoverCandidato,
}: {
  vacante: VacanteGestion;
  abierta: boolean;
  bloqueado: boolean;
  ocupado: boolean;
  onAlternar: () => void;
  onAbrirAnuncio: () => void;
  onEditar: () => void;
  onCambiarEstado: (destino: 'PUBLICADO' | 'PAUSADO') => void;
  onCubrir: () => void;
  onMoverCandidato: (de: EstadoPostulacion, a: EstadoPostulacion) => void;
}) {
  const sello = selloVacante(v);
  const portada = urlCompleta(v.portada);
  const total = v.postulaciones.total;
  const nuevas = v.postulaciones.porEstado.NUEVA ?? 0;
  const datos = [
    v.detalle.jornada && valorLegible(v.detalle.jornada),
    v.detalle.modalidad && valorLegible(v.detalle.modalidad),
    v.ubicacion,
    formatearPrecio(v.precio, 'empleo'),
    v.detalle.preguntas
      ? `Cuestionario de ${v.detalle.preguntas} ${v.detalle.preguntas === 1 ? 'pregunta' : 'preguntas'}`
      : 'Postulación rápida',
  ].filter(Boolean);
  // Pausar y reanudar solo aplican a un anuncio publicado o pausado y no cubierto.
  const accionEstado =
    v.vendido ? null : v.estado === 'PUBLICADO' ? 'PAUSADO' : v.estado === 'PAUSADO' ? 'PUBLICADO' : null;
  const idPanel = `candidatos-${v.id}`;

  return (
    <li
      className={`rounded-2xl border bg-white transition-shadow ${
        abierta ? 'border-border shadow-[0_8px_24px_-16px_rgba(31,41,55,0.35)]' : 'border-border'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          {portada ? (
            <img src={portada} alt="" className="size-14 shrink-0 rounded-xl object-cover sm:size-16" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-empleo/10 text-empleo-deep sm:size-16">
              <IconoMaletin />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={onAbrirAnuncio}
                className="min-w-0 text-left text-[16px] leading-snug font-semibold text-foreground hover:underline"
              >
                {v.titulo}
              </button>
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${sello.tono}`}>{sello.texto}</span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {datos.join(' · ')}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1 [&>svg]:size-4">
                <IconoOjo abierto />
                {plural(v.vistas, 'vista', 'vistas')}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {v.vendido && v.vendidoEn
                  ? `cubierta ${haceCuanto(v.vendidoEn)}`
                  : v.publicadoEn
                    ? `publicada ${haceCuanto(v.publicadoEn)}`
                    : `creada ${haceCuanto(v.creadoEn)}`}
              </span>
            </p>
          </div>
        </div>

        <Embudo vacante={v} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={abierta}
            aria-controls={idPanel}
            disabled={total === 0}
            className="inline-flex h-10 items-center gap-2.5 rounded-lg bg-foreground px-3.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-border/80 disabled:text-muted disabled:opacity-100"
          >
            <Caras recientes={v.recientes} total={total} />
            {total === 0 ? 'Sin candidatos' : abierta ? 'Ocultar candidatos' : `Ver ${plural(total, 'candidato', 'candidatos')}`}
            {nuevas > 0 && !abierta && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
                {nuevas} {nuevas === 1 ? 'nueva' : 'nuevas'}
              </span>
            )}
            {total > 0 && (
              <span className={`transition-transform [&>svg]:size-4 ${abierta ? 'rotate-180' : ''}`}>
                <IconoChevron />
              </span>
            )}
          </button>

          <div className="ml-auto flex flex-wrap gap-2">
            <BotonSecundario onClick={onEditar} disabled={bloqueado}>
              <IconoLapiz />
              Editar
            </BotonSecundario>
            {accionEstado && (
              <BotonSecundario onClick={() => onCambiarEstado(accionEstado)} disabled={bloqueado}>
                {ocupado ? (
                  <BaknazoLoader tamano="boton" mensaje={accionEstado === 'PAUSADO' ? 'Pausar' : 'Reanudar'} />
                ) : accionEstado === 'PAUSADO' ? (
                  'Pausar'
                ) : (
                  'Reanudar'
                )}
              </BotonSecundario>
            )}
            {(v.vendido || v.estado === 'PUBLICADO' || v.estado === 'PAUSADO') && (
              <BotonSecundario onClick={onCubrir} disabled={bloqueado} resaltado={v.vendido}>
                <IconoCheck ok={v.vendido} />
                {v.vendido ? 'Reabrir' : 'Marcar cubierta'}
              </BotonSecundario>
            )}
          </div>
        </div>
      </div>

      {abierta && total > 0 && (
        <div id={idPanel} className="animate-bkn-in border-t border-border bg-background/60 px-4 py-4 sm:px-5">
          <PanelCandidatos vacanteId={v.id} onMover={onMoverCandidato} />
        </div>
      )}
    </li>
  );
}

/**
 * El embudo de la vacante: una barra que reparte a los candidatos por estado.
 * Es lo primero que se lee de cada fila: si hay azul, hay gente esperando.
 */
function Embudo({ vacante: v }: { vacante: VacanteGestion }) {
  const total = v.postulaciones.total;
  const tramos = ORDEN_EMBUDO.map((estado) => ({ estado, n: v.postulaciones.porEstado[estado] ?? 0 })).filter(
    (t) => t.n > 0
  );
  const descripcion =
    total === 0
      ? 'Sin candidatos todavía'
      : tramos.map((t) => `${t.n} ${ESTADO_EMPLEADOR[t.estado].toLowerCase()}`).join(', ');

  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={`Candidatos: ${descripcion}`}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-border/60"
      >
        {tramos.map((t) => (
          <span
            key={t.estado}
            className={`h-full first:rounded-l-full last:rounded-r-full ${COLOR_EMBUDO[t.estado]}`}
            style={{ width: `${(t.n / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted" aria-hidden="true">
        {total === 0 ? (
          <span>
            {v.abierta ? 'Aún nadie se postula. Te avisamos por correo cuando llegue alguien.' : 'No llegó ningún candidato.'}
          </span>
        ) : (
          tramos.map((t) => (
            <span key={t.estado} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${COLOR_EMBUDO[t.estado]}`} />
              <span className="font-semibold text-foreground tabular-nums">{t.n}</span>
              {ESTADO_EMPLEADOR[t.estado].toLowerCase()}
            </span>
          ))
        )}
      </p>
    </div>
  );
}

/** Las caras de los últimos que se postularon, superpuestas. */
function Caras({ recientes, total }: { recientes: VacanteGestion['recientes']; total: number }) {
  if (recientes.length === 0) return null;
  const resto = total - recientes.length;
  return (
    <span className="flex -space-x-2" aria-hidden="true">
      {recientes.map((r, i) => {
        const foto = urlCompleta(r.foto);
        return foto ? (
          <img key={i} src={foto} alt="" className="size-6 rounded-full object-cover ring-2 ring-foreground" />
        ) : (
          <span
            key={i}
            className="grid size-6 place-items-center rounded-full bg-white/20 text-[9.5px] font-semibold text-white ring-2 ring-foreground"
          >
            {inicialesDe(r.nombre)}
          </span>
        );
      })}
      {resto > 0 && (
        <span className="grid size-6 place-items-center rounded-full bg-white text-[9.5px] font-semibold text-foreground ring-2 ring-foreground tabular-nums">
          +{resto}
        </span>
      )}
    </span>
  );
}

/* ================= Candidatos de una vacante ================= */

function PanelCandidatos({
  vacanteId,
  onMover,
}: {
  vacanteId: number;
  onMover: (de: EstadoPostulacion, a: EstadoPostulacion) => void;
}) {
  const navegar = useNavigate();
  const [items, setItems] = useState<PostulacionRecibida[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarRecibidas({ anuncio: vacanteId })
      .then((r) => {
        if (!vivo) return;
        setItems(r.items);
        setHayMas(r.hayMas);
      })
      .catch((e: unknown) => {
        if (vivo) setFallo(mensajeDe(e, 'No se pudieron cargar los candidatos.'));
      });
    return () => {
      vivo = false;
    };
  }, [vacanteId]);

  const reemplazar = (anterior: PostulacionRecibida, nueva: PostulacionRecibida) => {
    setItems((l) => (l ? l.map((x) => (x.id === nueva.id ? nueva : x)) : l));
    onMover(anterior.estado, nueva.estado);
  };

  if (fallo) return <p className="text-[13px] text-danger-deep">{fallo}</p>;
  if (!items) return <BaknazoLoader tamano="seccion" mensaje="Cargando candidatos" />;

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
        {items.map((p) => (
          <FilaCandidato key={p.id} postulacion={p} onCambio={(nueva) => reemplazar(p, nueva)} />
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
        <span>Para ver mensajes, notas y datos de contacto, abre la bandeja completa.</span>
        <button
          type="button"
          onClick={() => navegar(`/postulaciones?anuncio=${vacanteId}`)}
          className="font-semibold text-accent hover:underline"
        >
          {hayMas ? 'Ver todos en Postulaciones' : 'Gestionar en Postulaciones'}
        </button>
      </div>
    </>
  );
}

function FilaCandidato({
  postulacion: p,
  onCambio,
}: {
  postulacion: PostulacionRecibida;
  onCambio: (p: PostulacionRecibida) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const foto = urlCompleta(p.postulante.foto);

  const cambiarEstado = async (estado: Exclude<EstadoPostulacion, 'NUEVA'>) => {
    setGuardando(true);
    try {
      onCambio(await actualizarPostulacion(p.id, { estado }));
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo cambiar el estado.'));
    } finally {
      setGuardando(false);
    }
  };

  const verCv = async () => {
    setAbriendo(true);
    try {
      await abrirCv(p.id, p.cv.nombre);
      // El backend la marca como revisada al abrir el CV; se refleja aquí.
      if (p.estado === 'NUEVA') onCambio({ ...p, estado: 'VISTA' });
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo abrir la hoja de vida.'));
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-3.5 py-3">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        {foto ? (
          <img src={foto} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-carbon text-[13px] font-semibold text-white">
            {inicialesDe(p.postulante.nombre)}
          </span>
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-[14px] font-semibold text-foreground">{p.postulante.nombre}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO_ESTADO[p.estado]}`}>
              {ESTADO_EMPLEADOR[p.estado]}
            </span>
          </p>
          <p className="text-[12px] text-muted">se postuló {haceCuanto(p.creadoEn)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={verCv}
          disabled={abriendo}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-muted disabled:opacity-60 [&>svg]:size-4"
        >
          {abriendo ? (
            <BaknazoLoader tamano="boton" mensaje="Abriendo hoja de vida" />
          ) : (
            <>
              <IconoDocumento />
              Hoja de vida
            </>
          )}
        </button>
        {ACCIONES.map((a) => {
          const activa = p.estado === a.estado;
          return (
            <button
              key={a.estado}
              type="button"
              onClick={() => cambiarEstado(a.estado)}
              disabled={guardando || activa}
              aria-pressed={activa}
              className={
                activa
                  ? `h-8 rounded-full px-2.5 text-[12px] font-semibold ${TONO_ESTADO[a.estado]}`
                  : 'h-8 rounded-full border border-border px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-50'
              }
            >
              {a.texto}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function BotonSecundario({
  onClick,
  disabled,
  resaltado = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  resaltado?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-50 [&>svg]:size-4 ${
        resaltado
          ? 'border-accent/30 bg-accent/[0.06] text-accent-dark hover:bg-accent/10'
          : 'border-border bg-white text-foreground hover:border-muted'
      }`}
    >
      {children}
    </button>
  );
}
