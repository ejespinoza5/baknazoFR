import { useEffect, useState } from 'react';
import CargarMas from '../../components/CargarMas';
import MarcoApp from '../../components/MarcoApp';
import TarjetaAnuncio from '../../components/TarjetaAnuncio';
import { useNavegacion } from '../../lib/navegacion';
import type { TonoEstado } from '../../lib/tarjeta';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import {
  IconoAlerta,
  IconoCheck,
  IconoLapiz,
  IconoMas,
  IconoOjo,
  IconoPapelera,
} from '../../components/Iconos';
import { editarAnuncio, eliminarAnuncio, obtenerMisAnuncios } from '../../api/anuncios';
import { notificarError, notificarExito } from '../../lib/notificar';
import { urlCompleta } from '../../lib/imagen';
import { formatearFecha, formatearPrecio, formatearUbicacion } from '../../lib/tarjeta';
import { anotarPropios } from '../../lib/propios';
import type { Anuncio, EstadoAnuncio } from '../../types/anuncio';
import BaknazoLoader from '../../components/BaknazoLoader';

/**
 * Los cuatro estados que el backend puede devolver y aceptar como filtro.
 * `ELIMINADO` no está: los anuncios borrados en cascada suave no se listan, y el
 * servicio responde 400 si se le pide filtrar por ese estado.
 */
type EstadoFiltrable = Exclude<EstadoAnuncio, 'ELIMINADO'>;
type FiltroEstado = 'TODOS' | EstadoFiltrable;

interface DescripcionEstado {
  etiqueta: string;
  tono: TonoEstado;
  /** Qué puede hacer el dueño con un anuncio en este estado. */
  accion: { texto: string; estado: 'PUBLICADO' | 'PAUSADO' } | null;
  ayuda: string;
}

const ESTADOS: Record<EstadoFiltrable, DescripcionEstado> = {
  PUBLICADO: {
    etiqueta: 'Publicado',
    tono: 'exito',
    accion: { texto: 'Pausar', estado: 'PAUSADO' },
    ayuda: 'Visible para todo el mundo en el feed y en las búsquedas.',
  },
  PAUSADO: {
    etiqueta: 'Pausado',
    tono: 'aviso',
    accion: { texto: 'Reanudar', estado: 'PUBLICADO' },
    ayuda: 'Nadie lo ve, pero no pierde sus fotos ni sus visitas.',
  },
  BORRADOR: {
    etiqueta: 'Borrador',
    tono: 'neutro',
    accion: { texto: 'Publicar', estado: 'PUBLICADO' },
    ayuda: 'Solo tú lo ves. Al publicarlo aparece en el feed.',
  },
  RECHAZADO: {
    etiqueta: 'Rechazado',
    tono: 'peligro',
    // El backend solo admite PUBLICADO y PAUSADO como destino, así que un
    // anuncio rechazado no se puede volver a publicar: hay que editarlo.
    accion: null,
    ayuda: 'No pasó la revisión. Lee la nota y edita lo que se pidió.',
  },
};

/**
 * /mios nunca devuelve 'ELIMINADO': el backend excluye los borrados en cascada
 * suave dentro de la consulta. El tipo de la API sí lo lista como estado
 * posible, así que se estrecha al leer. Si algún día llegara un estado que esta
 * pantalla no conoce, se muestra sin acciones en lugar de romperse.
 */
const SIN_ESTADO: DescripcionEstado = {
  etiqueta: 'Sin estado',
  tono: 'neutro',
  accion: null,
  ayuda: '',
};

function descripcionDe(estado: EstadoAnuncio): DescripcionEstado {
  return ESTADOS[estado as EstadoFiltrable] ?? SIN_ESTADO;
}

/** Los chips de arriba, en el orden en que se leen: lo vivo, lo apagado, lo pendiente. */
const FILTROS: { id: FiltroEstado; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'PUBLICADO', label: 'Publicados' },
  { id: 'PAUSADO', label: 'Pausados' },
  { id: 'BORRADOR', label: 'Borradores' },
  { id: 'RECHAZADO', label: 'Rechazados' },
];

interface Props {
  onEditar: (id: number) => void;
}

/** Aviso de carga: el logo animado de la marca, igual que en toda la app. */
function Esqueletos() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-white">
      <BaknazoLoader tamano="seccion" mensaje="Cargando tus anuncios" />
    </div>
  );
}

/** El backend responde 400 con el motivo; si no, un texto que no culpa al usuario. */
function mensajeDe(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

export default function MisAnunciosScreen({ onEditar }: Props) {
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS');
  const { irAPublicar: onPublicar } = useNavegacion();

  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  /** Por qué no se pudo listar, para no culpar siempre a la red. */
  const [fallo, setFallo] = useState<'sin-conexion' | 'error' | null>(null);
  /** Id del anuncio con una acción en curso, para bloquear solo esa tarjeta. */
  const [accionando, setAccionando] = useState<number | null>(null);
  /** Anuncio que espera confirmación en el diálogo de borrado. */
  const [porBorrar, setPorBorrar] = useState<Anuncio | null>(null);
  /**
   * Anuncio que espera confirmación para marcarlo como vendido.
   *
   * Pide confirmación por lo mismo que el borrado, pero al revés: aquí el error
   * es de omitted una venta ya hecha, y sin un "sí" la única forma de arreglarlo
   * es acordarse de dónde se vuelve a publicar. El botón de deshacer queda en la
   * tarjeta, a la vista.
   */
  const [porVender, setPorVender] = useState<Anuncio | null>(null);
  /** Anuncio abierto en la ficha completa, sobre la propia lista. */
  const [visto, setVisto] = useState<Anuncio | null>(null);
  /** El estado, ya traducido, se calcula una vez y se pasa a la ficha. */
  const estadoVisto = visto
    ? { etiqueta: descripcionDe(visto.estado).etiqueta, tono: descripcionDe(visto.estado).tono }
    : null;

  useEffect(() => {
    if (porBorrar === null && porVender === null) return;
    const manejarTecla = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPorBorrar(null);
      setPorVender(null);
    };
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [porBorrar, porVender]);

  /* La foto, las iniciales y el correo los resuelve `MenuCuenta` ahora. */

  /* ---------- Listado ---------- */

  /**
   * Cambia el filtro desde la interacción, no desde el efecto.
   *
   * El efecto de carga solo se encarga de pedir la página; el estado de
   * "cargando" se pone aquí, que es donde ocurre el cambio. Dejarlo en el
   * efecto obligaría a un render en cascada en cada tecla, y además mostraría
   * un esqueleto encima de la lista vieja, que ya no corresponde al filtro
   * pedido.
   */
  const cambiarFiltro = (nuevo: FiltroEstado) => {
    if (nuevo === filtro) return;
    setAnuncios([]);
    setCursor(null);
    setHayMas(false);
    setFallo(null);
    setCargando(true);
    setFiltro(nuevo);
  };

  /**
   * Carga la primera página del filtro. El estado va al servidor: filtrar en el
   * cliente mostraría solo lo de la página actual y daría la falsa impresión de
   * que no hay más anuncios.
   */
  useEffect(() => {
    let vivo = true;

    obtenerMisAnuncios({
      estado: filtro === 'TODOS' ? undefined : filtro,
      limite: 20,
    })
      .then((respuesta) => {
        if (!vivo) return;
        setAnuncios(respuesta.items);
        setCursor(respuesta.pagina.siguienteCursor);
        setHayMas(respuesta.pagina.hayMas);
        setFallo(null);
        // El feed no sabe qué anuncios son tuyos, así que se lo dejamos anotado
        // para no ofrecerte un chat contigo mismo.
        anotarPropios(respuesta.items.map((anuncio) => anuncio.id));
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setAnuncios([]);
        setCursor(null);
        setHayMas(false);
        setFallo((e as { status?: number }).status ? 'error' : 'sin-conexion');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [filtro]);

  /** Paginación por cursor: la siguiente página llega sola al hacer scroll. */
  const [errorMas, setErrorMas] = useState(false);
  const cargarMas = async () => {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const respuesta = await obtenerMisAnuncios({
        estado: filtro === 'TODOS' ? undefined : filtro,
        cursor,
        limite: 20,
      });
      setAnuncios((previos) => {
        const vistos = new Set(previos.map((a) => a.id));
        return [...previos, ...respuesta.items.filter((a) => !vistos.has(a.id))];
      });
      setCursor(respuesta.pagina.siguienteCursor);
      setHayMas(respuesta.pagina.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  };

  /* ---------- Acciones del dueño ---------- */

  /**
   * Publicar, pausar o reanudar.
   *
   * El PATCH devuelve el anuncio completo y ese es el que se pinta: si el
   * backend cambiara el `publicado_en` al publicar, la tarjeta lo refleja sin
   * que esta pantalla tenga que saberlo.
   *
   * Si había un estado filtrado, el anuncio que deja de coincidir se sale de la
   * lista en vez de quedarse con una insignia que contradice el chip activo. El
   * aviso de confirmación dice qué pasó, así que no se pierde el resultado de
   * la acción.
   */
  const cambiarEstado = async (anuncio: Anuncio, destino: 'PUBLICADO' | 'PAUSADO') => {
    if (accionando !== null) return;
    setAccionando(anuncio.id);
    try {
      const respuesta = await editarAnuncio(anuncio.id, { estado: destino }, []);
      setAnuncios((previos) => {
        if (filtro !== 'TODOS' && respuesta.anuncio.estado !== filtro) {
          return previos.filter((a) => a.id !== anuncio.id);
        }
        return previos.map((a) => (a.id === anuncio.id ? respuesta.anuncio : a));
      });
      notificarExito(
        destino === 'PAUSADO'
          ? `Pausaste «${anuncio.titulo}».`
          : `«${anuncio.titulo}» vuelve a estar visible.`
      );
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo cambiar el estado del anuncio.'));
    } finally {
      setAccionando(null);
    }
  };

  /**
   * Marcar como vendido, o devolverlo al feed.
   *
   * Un PATCH con `vendido` y nada más: el backend decide la fecha y el feed
   * deja de trazerlo. El anuncio completo que vuelve es el que se pinta, igual
   * que al pausar, para que la insignia y el estado nunca se contradigan.
   */
  const cambiarVendido = async (anuncio: Anuncio, vendido: boolean) => {
    if (accionando !== null) return;
    setAccionando(anuncio.id);
    try {
      const respuesta = await editarAnuncio(anuncio.id, { vendido }, []);
      setAnuncios((previos) =>
        previos.map((a) => (a.id === anuncio.id ? respuesta.anuncio : a))
      );
      // La ficha abierta sobre esta lista tiene su propia copia del anuncio.
      setVisto((prev) =>
        prev && prev.id === anuncio.id ? respuesta.anuncio : prev
      );
      notificarExito(
        vendido
          ? `Marcaste «${anuncio.titulo}» como vendido. Ya no sale en el feed.`
          : `«${anuncio.titulo}» vuelve a aparecer en el feed.`
      );
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo cambiar el estado de la venta.'));
    } finally {
      setAccionando(null);
    }
  };

  const confirmarBorrado = async () => {
    if (porBorrar === null) return;
    const objetivo = porBorrar;
    setPorBorrar(null);
    setAccionando(objetivo.id);
    try {
      await eliminarAnuncio(objetivo.id);
      setAnuncios((previos) => previos.filter((a) => a.id !== objetivo.id));
      notificarExito(`Eliminaste «${objetivo.titulo}».`);
    } catch (e) {
      notificarError(mensajeDe(e, 'No se pudo eliminar el anuncio.'));
    } finally {
      setAccionando(null);
    }
  };

  const plural = (n: number, singular: string, plural_: string) =>
    `${n} ${n === 1 ? singular : plural_}`;

  return (
    <MarcoApp titulo="Mis anuncios">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-start gap-6 px-4 pt-5 pb-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground">
              Mis anuncios
            </h1>
            <p className="text-[12.5px] text-muted">
              {cargando
                ? ''
                : fallo
                  ? ''
                  : plural(anuncios.length, 'anuncio cargado', 'anuncios cargados') +
                    (hayMas ? ' · hay más' : '')}
            </p>
          </div>

          {fallo && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-brand/25 bg-brand/10 px-4 py-3 text-[12.5px] leading-snug text-foreground">
              <span className="mt-0.5 shrink-0 text-brand-dark">
                <IconoAlerta />
              </span>
              <span>
                {fallo === 'sin-conexion'
                  ? 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo otra vez.'
                  : 'No se pudieron cargar tus anuncios. Vuelve a intentarlo en un momento.'}
              </span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTROS.map((chip) => {
              const activo = filtro === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => cambiarFiltro(chip.id)}
                  aria-pressed={activo}
                  className={`h-9 rounded-full border px-4 text-[13px] font-semibold transition-colors ${
                    activo
                      ? 'border-transparent bg-accent text-white'
                      : 'border-border bg-white text-foreground hover:border-muted'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {cargando && anuncios.length === 0 ? (
            <Esqueletos />
          ) : anuncios.length === 0 ? (
            // Con fallo de carga no se puede decir "no tienes anuncios": no se
            // sabe si es verdad. El aviso de arriba ya explica qué pasó, y este
            // hueco con un "Publicar mi primer anuncio" contradiría al aviso.
            fallo ? null : (
              <div className="mt-10 rounded-2xl border border-dashed border-border bg-white/70 px-6 py-12 text-center">
                <p className="text-[15px] font-medium text-foreground">
                  {filtro === 'TODOS' ? 'Todavía no tienes anuncios' : 'Nada con ese estado'}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {filtro === 'TODOS'
                    ? 'Cuando publiques algo, lo verás aquí.'
                    : 'Prueba con otro estado o quita el filtro.'}
                </p>
                {filtro === 'TODOS' && (
                  <button
                    type="button"
                    onClick={onPublicar}
                    className="mt-4 h-10 rounded-lg bg-brand px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-brand-dark"
                  >
                    Publicar mi primer anuncio
                  </button>
                )}
              </div>
            )
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {anuncios.map((anuncio) => {
                  const descripcion = descripcionDe(anuncio.estado);
                  const ocupado = accionando === anuncio.id;
                  const bloqueado = accionando !== null;
                  return (
                    <TarjetaAnuncio
                      key={anuncio.id}
                      id={anuncio.id}
                      pilar={anuncio.pilar}
                      titulo={anuncio.titulo}
                      precio={formatearPrecio(anuncio.precio, anuncio.pilar)}
                      ubicacion={formatearUbicacion(anuncio.ubicacion, anuncio.sector)}
                      foto={urlCompleta(anuncio.portada?.url ?? null)}
                      estado={{ etiqueta: descripcion.etiqueta, tono: descripcion.tono }}
                      vendido={anuncio.vendido}
                      onAbrir={() => setVisto(anuncio)}
                      pie={
                        <div className="space-y-2.5">
                          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                            <span className="inline-flex items-center gap-1">
                              <IconoOjo abierto />
                              {plural(anuncio.vistas, 'vista', 'vistas')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {plural(anuncio.contactos, 'contacto', 'contactos')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatearFecha(anuncio.creadoEn)}</span>
                          </p>

                          {anuncio.estado === 'RECHAZADO' && anuncio.notasModeracion && (
                            <p className="flex items-start gap-1.5 rounded-lg bg-danger/[0.06] px-2.5 py-2 text-[12px] leading-snug text-danger-deep">
                              <span className="mt-0.5 shrink-0">
                                <IconoAlerta />
                              </span>
                              {anuncio.notasModeracion}
                            </p>
                          )}

                          {/* El botón de venta va en su propia línea, arriba de los
                             de siempre: es la única acción que esconde el
                             anuncio del feed, y si compartiera fila con
                             "Editar" un toque errado taparía justo la opción
                             difícil de recuperar. */}
                          <button
                            type="button"
                            onClick={() =>
                              anuncio.vendido
                                ? cambiarVendido(anuncio, false)
                                : setPorVender(anuncio)
                            }
                            disabled={bloqueado}
                            className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                              anuncio.vendido
                                ? 'border-accent/30 bg-accent/[0.06] text-accent-dark hover:bg-accent/10'
                                : 'border-border bg-white text-foreground hover:border-muted'
                            }`}
                          >
                            <span className="shrink-0">
                              <IconoCheck ok={anuncio.vendido ?? false} />
                            </span>
                            <span className="truncate">
                              {anuncio.vendido ? 'Volver a publicar' : 'Marcar como vendido'}
                            </span>
                          </button>

                          {/* Los tres botones en una sola fila no cabían en una
                             tarjeta estrecha: el último se salía del borde y la
                             tarjeta, que recorta, lo partía por la mitad. Ahora
                             los dos de siempre comparten el ancho y borrar baja
                             a su propia línea, completo y sin clipping. */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onEditar(anuncio.id)}
                              disabled={bloqueado}
                              className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-50"
                            >
                              <span className="shrink-0">
                                <IconoLapiz />
                              </span>
                              <span className="truncate">Editar</span>
                            </button>
                            {descripcion.accion && (
                              <button
                                type="button"
                                onClick={() => cambiarEstado(anuncio, descripcion.accion!.estado)}
                                disabled={bloqueado}
                                className="inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-white px-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-50"
                              >
                                {/* La etiqueta se mantiene mientras corre la
                                    acción: ahora el botón ocupa media tarjeta y
                                    dejar solo «…» se leía como un fallo. */}
                                <span className="truncate">
                                  {ocupado ? (
                                    <BaknazoLoader tamano="boton" mensaje={descripcion.accion.texto} />
                                  ) : (
                                    descripcion.accion.texto
                                  )}
                                </span>
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPorBorrar(anuncio)}
                            disabled={bloqueado}
                            aria-label={`Eliminar ${anuncio.titulo}`}
                            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/25 bg-danger/[0.05] px-2 text-[12.5px] font-medium text-danger-deep transition-colors hover:border-danger/40 hover:bg-danger/[0.1] disabled:opacity-50"
                          >
                            <span className="shrink-0">
                              <IconoPapelera />
                            </span>
                            <span className="truncate">Eliminar</span>
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>

              <CargarMas hayMas={hayMas} cargando={cargandoMas} error={errorMas} onCargar={cargarMas} />
            </>
          )}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            <section className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                ¿Qué significa cada estado?
              </h2>
              <dl className="mt-3 space-y-3">
                {FILTROS.filter((chip) => chip.id !== 'TODOS').map((chip) => {
                  const descripcion = ESTADOS[chip.id as EstadoFiltrable];
                  return (
                    <div key={chip.id}>
                      <dt className="text-[13px] font-semibold text-foreground">
                        {descripcion.etiqueta}
                      </dt>
                      <dd className="text-[12.5px] leading-relaxed text-muted">
                        {descripcion.ayuda}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            <section className="rounded-2xl bg-carbon p-5 text-white">
              <h2 className="text-[15px] font-semibold tracking-tight">
                ¿Tienes algo que vender?
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                Publica gratis en menos de 2 minutos, sin comisiones.
              </p>
              <button
                type="button"
                onClick={onPublicar}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[13.5px] font-medium text-foreground transition-colors hover:bg-brand-dark"
              >
                <IconoMas />
                Publicar anuncio
              </button>
            </section>
          </div>
        </aside>
      </div>

      {porVender && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-carbon/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-vender"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPorVender(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]">
            <h2
              id="titulo-vender"
              className="text-[17px] font-semibold tracking-tight text-foreground"
            >
              ¿Marcar «{porVender.titulo}» como vendido?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Deja de salir en el feed y en las búsquedas. El enlace directo sigue
              funcionando, con una etiqueta de «Vendido». Puedes volver a
              publicarlo cuando quieras desde la misma tarjeta.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorVender(null)}
                className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const objetivo = porVender;
                  setPorVender(null);
                  cambiarVendido(objetivo, true);
                }}
                className="h-10 rounded-lg bg-accent px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Sí, marcar vendido
              </button>
            </div>
          </div>
        </div>
      )}

      {porBorrar && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-carbon/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-borrar"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPorBorrar(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]">
            <h2
              id="titulo-borrar"
              className="text-[17px] font-semibold tracking-tight text-foreground"
            >
              ¿Eliminar «{porBorrar.titulo}»?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Deja de aparecer en tu lista y en el feed. No se puede deshacer, y si
              lo publicaste de nuevo después será otro anuncio.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorBorrar(null)}
                className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarBorrado}
                className="h-10 rounded-lg bg-danger px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {visto && (
        <DetalleAnuncioModal
          id={visto.id}
          onCerrar={() => setVisto(null)}
          estado={estadoVisto}
          onEditar={(id) => {
            setVisto(null);
            onEditar(id);
          }}
          // Aquí la ficha no da like: los anuncios son tuyos, y un like propio
          // no cuenta para nadie. Le pasa la venta, que sí es de esta pantalla.
          likes={visto.likes}
          meGusta={visto.meGusta}
          vendido={visto.vendido}
          onCambiarVendido={(vendido) => cambiarVendido(visto, vendido)}
        />
      )}
    </MarcoApp>
  );
}
