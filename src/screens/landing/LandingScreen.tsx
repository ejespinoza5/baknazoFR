import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, m, useReducedMotion, type AnimationPlaybackControls } from 'motion/react';
import { CASCADA, HIJO, RESORTE, SALIDA } from '../../lib/movimiento';
import { listarAnuncios } from '../../api/anuncios';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import EsqueletoAnuncio from '../../components/EsqueletoAnuncio';
import IconoCategoria from '../../components/IconoCategoria';
import TarjetaAnuncio from '../../components/TarjetaAnuncio';
import { IconoBandera, IconoBocadillo, IconoCerrar, IconoCheck, IconoChevron, IconoEscudo, IconoMaletin } from '../../components/Iconos';
import { categoriasDe, useCatalogos, useResumenCatalogo } from '../../lib/catalogos';
import { NavegacionContexto, useNavegacion } from '../../lib/navegacion';
import { olvidarDestino } from '../../lib/volverTrasEntrar';
import { urlCompleta } from '../../lib/imagen';
import { ESTILO_PILAR, NOMBRE_PILAR, type Pilar } from '../../lib/pilares';
import { formatearPrecio, formatearUbicacion, inicialesDe, valorLegible } from '../../lib/tarjeta';
import type { AnuncioFeed } from '../../types/anuncio';
import Cabecera, { AvisoPublicar } from './Cabecera';
import Pie from './Pie';
import Portada from './Portada';
import { irASeccion, RUTA_ENTRAR, RUTA_REGISTRO } from './config';
import { useRevelar } from './revelar';

const PILARES: Pilar[] = ['productos', 'servicios', 'empleo'];
const POR_PAGINA = 15;

interface Filtro {
  pilar: Pilar | null;
  categoria: number | null;
  q: string;
}

const SIN_FILTRO: Filtro = { pilar: null, categoria: null, q: '' };

/**
 * La landing de Baknazo: lo primero que ve quien llega sin cuenta.
 *
 * Todo se puede mirar sin entrar (anuncios reales, categorías, vacantes); lo
 * que no se puede es contactar, chatear ni publicar. Esos botones no fallan en
 * silencio: dicen que hace falta una cuenta y llevan a crearla.
 */
export default function LandingScreen() {
  const catalogos = useCatalogos();
  const resumen = useResumenCatalogo();
  const [recientes, setRecientes] = useState<AnuncioFeed[]>([]);
  const [vacantes, setVacantes] = useState<AnuncioFeed[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(SIN_FILTRO);
  const [abierto, setAbierto] = useState<number | null>(null);
  const navegacion = useNavegacion();

  // Quien vuelve a la landing empieza de cero: un "Entrar" genérico no debe
  // llevar a un anuncio que se abrió antes y se dejó.
  useEffect(() => olvidarDestino(), []);

  useEffect(() => {
    document.title = 'Baknazo · Compra, vende y encuentra camello en Ecuador';
    let vivo = true;
    listarAnuncios({ limite: 24 })
      .then((r) => vivo && setRecientes(r.items))
      .catch(() => undefined);
    listarAnuncios({ pilar: 'empleo', limite: 4 })
      .then((r) => vivo && setVacantes(r.items))
      .catch(() => vivo && setVacantes([]));
    return () => {
      vivo = false;
      document.title = 'Baknazo';
    };
  }, []);

  /** Cambia el filtro del listado y lleva hasta él. */
  const filtrar = (f: Partial<Filtro>) => {
    setFiltro((actual) => ({ ...actual, ...f }));
    requestAnimationFrame(() => irASeccion('anuncios'));
  };
  const elegirPilar = (pilar: Pilar, categoria?: number) => filtrar({ pilar, categoria: categoria ?? null, q: '' });

  const ciudades = resumen?.ciudades.length ?? null;

  return (
    // overflow-x-clip (no hidden): corta cualquier desborde lateral sin romper la cabecera sticky.
    <div className="min-h-svh overflow-x-clip bg-background text-foreground">
      <a
        href="#anuncios"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-white"
      >
        Ir a los anuncios
      </a>
      <Cabecera catalogos={catalogos} resumen={resumen} onElegir={elegirPilar} />

      <main>
        <Portada
          anuncios={recientes}
          total={resumen?.total ?? null}
          ciudades={ciudades}
          onBuscar={(q) => filtrar({ q, pilar: null, categoria: null })}
          onPilar={(p) => elegirPilar(p)}
        />

        <Pilares recientes={recientes} onPilar={(p) => elegirPilar(p)} />

        <RielCategorias onElegir={elegirPilar} />

        <Listado filtro={filtro} onFiltro={setFiltro} onAbrir={setAbierto} />

        <ComoFunciona />

        <Empleo vacantes={vacantes} onVerTodas={() => elegirPilar('empleo')} onAbrir={setAbierto} />

        <Confianza />

        <Llamado />
      </main>

      <Pie onPilar={(p) => elegirPilar(p)} />

      {/* Lo que en la ficha pide cuenta (mensaje, número, postularse, denunciar)
          lleva al login y, al entrar o crear la cuenta, de vuelta a este anuncio. */}
      {abierto !== null && (
        <NavegacionContexto.Provider value={{ ...navegacion, irAlLogin: () => navegacion.irAlLogin(`/anuncio/${abierto}`) }}>
          <DetalleAnuncioModal id={abierto} onCerrar={() => setAbierto(null)} />
        </NavegacionContexto.Provider>
      )}
    </div>
  );
}

/* ================= Secciones ================= */

/** Todas las categorías en un carril, las que más anuncios tienen primero. */
function RielCategorias({ onElegir }: { onElegir: (p: Pilar, c?: number) => void }) {
    const catalogos = useCatalogos();
    const resumen = useResumenCatalogo();
    const riel = useRef<HTMLUListElement>(null);
    const deslizamiento = useRef<AnimationPlaybackControls | null>(null);
    const sinMovimiento = useReducedMotion();
    const cats = useMemo(() => {
      const todas = PILARES.flatMap((p) => categoriasDe(catalogos, p));
      return resumen ? [...todas].sort((a, b) => (resumen.categorias[b.id] ?? 0) - (resumen.categorias[a.id] ?? 0)) : todas;
    }, [catalogos, resumen]);
    if (cats.length === 0) return null;
    /**
     * Desliza el riel con motion. El `scrollBy` nativo con snap + scroll-smooth
     * saltaba de golpe en escritorio; aquí el snap se apaga mientras dura el
     * movimiento y el destino cae justo al inicio de una tarjeta, así al
     * devolverlo no hay tirón final.
     */
    const mover = (d: 1 | -1) => {
      const el = riel.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      const deseado = el.scrollLeft + d * el.clientWidth * 0.8;
      const base = el.getBoundingClientRect().left - el.scrollLeft;
      const inicios = [...el.children].map((li) => li.getBoundingClientRect().left - base);
      const cercano = inicios.reduce((a, b) => (Math.abs(b - deseado) < Math.abs(a - deseado) ? b : a));
      const destino = Math.min(Math.max(cercano, 0), max);

      deslizamiento.current?.stop();
      el.style.scrollSnapType = 'none';
      el.style.scrollBehavior = 'auto';
      const soltar = () => {
        el.style.scrollSnapType = '';
        el.style.scrollBehavior = '';
      };
      deslizamiento.current = animate(el.scrollLeft, destino, {
        // Con "reducir movimiento" (p. ej. Windows sin efectos de animación) se
        // sigue deslizando, más corto: lo pide quien pulsa la flecha y es solo
        // lateral; saltar de golpe hace perder de vista dónde se estaba.
        duration: sinMovimiento ? 0.4 : 0.7,
        ease: SALIDA,
        onUpdate: (v) => {
          el.scrollLeft = v;
        },
        onComplete: soltar,
      });
    };
    return (
      <section aria-labelledby="titulo-categorias" className="mx-auto w-full max-w-[1320px] px-5 pb-6 sm:px-8 lg:px-10">
        <m.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -12% 0px' }}
          transition={{ duration: 0.6, ease: SALIDA }}
          className="flex items-end justify-between gap-4"
        >
          <h2 id="titulo-categorias" className="titular text-[clamp(28px,4vw,40px)]">
            Explora por categoría
          </h2>
          <div className="hidden gap-2 sm:flex">
            <BotonRiel etiqueta="Categorías anteriores" onClick={() => mover(-1)} izquierda />
            <BotonRiel etiqueta="Más categorías" onClick={() => mover(1)} />
          </div>
        </m.div>
        {/* Las tarjetas entran en cascada al llegar a la sección. */}
        <m.ul
          ref={riel}
          variants={CASCADA}
          initial="oculto"
          whileInView="visible"
          viewport={{ once: true, margin: '0px 0px -12% 0px' }}
          className="sin-barra -mx-5 mt-6 flex snap-x gap-3 overflow-x-auto scroll-smooth px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0"
        >
          {cats.map((c) => {
            const n = resumen?.categorias[c.id] ?? 0;
            return (
              <m.li key={c.id} variants={HIJO} whileTap={{ scale: 0.97 }} className="snap-start">
                <button
                  type="button"
                  onClick={() => onElegir(c.pilar, c.id)}
                  className="group flex h-full w-[148px] flex-col items-start gap-3 rounded-2xl border border-border bg-white p-4 text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_16px_32px_-24px_rgba(31,41,55,0.5)] sm:w-[164px]"
                >
                  <span className={`${ESTILO_PILAR[c.pilar].tinta} [&>svg]:size-8`}>
                    <IconoCategoria pilar={c.pilar} slug={c.slug} />
                  </span>
                  <span className="min-h-[2.6em] text-[14px] leading-snug font-semibold text-foreground">{c.nombre}</span>
                  <span className="mt-auto text-[12px] text-muted">
                    {n > 0 ? `${n.toLocaleString('es-EC')} ${n === 1 ? 'anuncio' : 'anuncios'}` : NOMBRE_PILAR[c.pilar]}
                  </span>
                </button>
              </m.li>
            );
          })}
        </m.ul>
      </section>
    );
}

/* ================= Piezas ================= */

function BotonRiel({ etiqueta, onClick, izquierda = false }: { etiqueta: string; onClick: () => void; izquierda?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="grid size-11 place-items-center rounded-full border border-border bg-white text-foreground transition-colors hover:border-foreground/40"
    >
      <IconoChevron izquierda={izquierda} derecha={!izquierda} />
    </button>
  );
}

function Encabezado({ kicker, titulo, children, id }: { kicker?: string; titulo: ReactNode; children?: ReactNode; id: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16">
      <div>
        {kicker && <p className="text-[12.5px] font-semibold tracking-[0.14em] text-muted uppercase">{kicker}</p>}
        <h2 id={id} className="titular mt-2 text-[clamp(34px,5.2vw,64px)]">
          {titulo}
        </h2>
      </div>
      {children && <p className="max-w-[46ch] text-[16px] leading-relaxed text-foreground/70 lg:justify-self-end">{children}</p>}
    </div>
  );
}

/* ---------- Tres pilares ---------- */

const PILAR_INFO: Record<Pilar, { texto: string; boton: string; clase: string; tinta: string; secundaria: string }> = {
  productos: {
    texto: 'Lo que ya no usas, a alguien le sirve. Celulares, muebles, ropa, autos y todo lo que se te ocurra.',
    boton: 'Ver productos',
    clase: 'bg-brand text-foreground',
    tinta: 'text-foreground',
    secundaria: 'text-foreground/75',
  },
  servicios: {
    texto: 'Plomeros, profes, técnicos, fotógrafos. Gente de tu ciudad que sabe hacer lo que necesitas.',
    boton: 'Ver servicios',
    clase: 'bg-accent text-white',
    tinta: 'text-white',
    secundaria: 'text-white/80',
  },
  empleo: {
    texto: 'Vacantes de negocios reales. Te postulas con tu hoja de vida en un minuto.',
    boton: 'Ver vacantes',
    clase: 'bg-empleo text-white',
    tinta: 'text-white',
    secundaria: 'text-white/80',
  },
};

function Pilares({ recientes, onPilar }: { recientes: AnuncioFeed[]; onPilar: (p: Pilar) => void }) {
  const catalogos = useCatalogos();
  const resumen = useResumenCatalogo();
  const ref = useRevelar<HTMLElement>();
  const total = (p: Pilar) =>
    resumen ? categoriasDe(catalogos, p).reduce((s, c) => s + (resumen.categorias[c.id] ?? 0), 0) : null;
  const fotos = (p: Pilar, n: number) =>
    recientes
      .filter((a) => a.pilar === p && a.portada?.url)
      .slice(0, n)
      .map((a) => urlCompleta(a.portada!.url)!);

  return (
    <section ref={ref} aria-labelledby="titulo-pilares" className="mx-auto w-full max-w-[1320px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <Encabezado id="titulo-pilares" kicker="Un solo lugar" titulo="Tres maneras de moverte">
        Lo que vendes, lo que sabes hacer y el trabajo que buscas. Todo cerca de ti, con gente de tu ciudad.
      </Encabezado>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-2">
        {PILARES.map((p, i) => {
          const info = PILAR_INFO[p];
          const grande = i === 0;
          const n = total(p);
          const imgs = fotos(p, grande ? 3 : 2);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPilar(p)}
              className={`group relative isolate flex flex-col overflow-hidden rounded-[28px] p-7 text-left transition-transform duration-300 hover:-translate-y-1 sm:p-9 ${info.clase} ${
                grande ? 'min-h-[420px] lg:row-span-2 lg:min-h-[600px]' : 'min-h-[280px]'
              }`}
            >
              {n !== null && (
                <span className={`text-[13px] font-semibold tabular-nums ${info.secundaria}`}>
                  {n.toLocaleString('es-EC')} {n === 1 ? 'anuncio' : 'anuncios'}
                </span>
              )}
              <span className={`titular mt-2 ${grande ? 'text-[clamp(52px,7vw,104px)]' : 'text-[clamp(40px,4.6vw,64px)]'} ${info.tinta}`}>
                {NOMBRE_PILAR[p]}
              </span>
              <span className={`mt-4 max-w-[30ch] text-[15.5px] leading-relaxed ${info.secundaria}`}>{info.texto}</span>
              <span
                className={`relative z-10 mt-auto inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-semibold transition-transform group-hover:translate-x-1 ${
                  p === 'productos' ? 'bg-foreground text-white' : 'bg-white text-foreground'
                } ${grande ? 'mt-10' : 'mt-8'}`}
              >
                {info.boton}
                <span className="[&>svg]:size-4">
                  <IconoChevron derecha />
                </span>
              </span>

              {/* Fotos reales del pilar, en abanico. */}
              {imgs.length > 0 && (
                <span aria-hidden="true" className={`pointer-events-none absolute right-0 bottom-0 -z-10 ${grande ? 'h-[62%] w-[62%]' : 'h-[78%] w-[46%]'}`}>
                  {imgs.map((src, j) => (
                    <img
                      key={src + j}
                      src={src}
                      alt=""
                      loading="lazy"
                      className={`absolute aspect-[4/5] rounded-2xl object-cover shadow-[0_20px_40px_-18px_rgba(17,24,39,0.6)] ring-4 ring-white/70 transition-transform duration-500 ${
                        grande ? 'w-[46%]' : 'w-[56%]'
                      } ${
                        j === 0
                          ? 'right-[8%] bottom-[-6%] rotate-[6deg] group-hover:rotate-[9deg]'
                          : j === 1
                            ? 'right-[38%] bottom-[-14%] -rotate-[8deg] group-hover:-rotate-[11deg]'
                            : 'right-[22%] bottom-[22%] rotate-[-2deg] group-hover:rotate-[1deg]'
                      }`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Listado de anuncios reales ---------- */

function Listado({
  filtro,
  onFiltro,
  onAbrir,
}: {
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  onAbrir: (id: number) => void;
}) {
  const catalogos = useCatalogos();
  const [items, setItems] = useState<AnuncioFeed[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  const [aviso, setAviso] = useState(false);
  const navegar = useNavigate();

  const consulta = useMemo(
    () => ({
      pilar: filtro.pilar ?? undefined,
      categoria: filtro.categoria ?? undefined,
      q: filtro.q || undefined,
      limite: POR_PAGINA,
    }),
    [filtro]
  );

  // Al cambiar el filtro se vuelve al esqueleto en el mismo render (no en un efecto).
  const [consultaVista, setConsultaVista] = useState(consulta);
  if (consultaVista !== consulta) {
    setConsultaVista(consulta);
    setItems(null);
    setError(false);
  }

  useEffect(() => {
    let vivo = true;
    listarAnuncios(consulta)
      .then((r) => {
        if (!vivo) return;
        setItems(r.items);
        setCursor(r.pagina.siguienteCursor);
        setHayMas(r.pagina.hayMas);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [consulta]);

  const cargarMas = async () => {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const r = await listarAnuncios({ ...consulta, cursor });
      setItems((l) => {
        const vistos = new Set((l ?? []).map((x) => x.id));
        return [...(l ?? []), ...r.items.filter((x) => !vistos.has(x.id))];
      });
      setCursor(r.pagina.siguienteCursor);
      setHayMas(r.pagina.hayMas);
    } catch {
      setError(true);
    } finally {
      setCargandoMas(false);
    }
  };

  const categoria = filtro.categoria ? catalogos?.categorias.find((c) => c.id === filtro.categoria) : null;
  const filtrado = filtro.pilar !== null || filtro.q !== '';

  return (
    <section id="anuncios" aria-labelledby="titulo-anuncios" className="mx-auto w-full max-w-[1320px] scroll-mt-20 px-5 pt-16 pb-20 sm:px-8 lg:px-10 lg:pt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div>
          <p className="text-[12.5px] font-semibold tracking-[0.14em] text-muted uppercase">Anuncios de la gente</p>
          <h2 id="titulo-anuncios" className="titular mt-2 text-[clamp(34px,5.2vw,64px)]">
            {filtro.q ? `«${filtro.q}»` : categoria ? categoria.nombre : filtro.pilar ? NOMBRE_PILAR[filtro.pilar] : 'Recién publicado'}
          </h2>
        </div>

        <div role="tablist" aria-label="Tipo de anuncio" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-border">
          {([null, ...PILARES] as (Pilar | null)[]).map((p) => {
            const activo = filtro.pilar === p && !filtro.q;
            return (
              <button
                key={p ?? 'todo'}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => onFiltro({ pilar: p, categoria: null, q: '' })}
                className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors duration-200 ${
                  activo ? 'text-white' : 'text-foreground/75 hover:text-foreground'
                }`}
              >
                {activo && (
                  <m.span
                    layoutId="pestana-landing"
                    transition={RESORTE}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-foreground"
                  />
                )}
                {p && <span aria-hidden="true" className={`relative size-2 rounded-full ${ESTILO_PILAR[p].punto}`} />}
                <span className="relative">{p ? NOMBRE_PILAR[p] : 'Todo'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(categoria || filtro.q) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {categoria && (
            <Quitable onQuitar={() => onFiltro({ ...filtro, categoria: null })}>{categoria.nombre}</Quitable>
          )}
          {filtro.q && <Quitable onQuitar={() => onFiltro({ ...filtro, q: '' })}>Búsqueda: {filtro.q}</Quitable>}
          <button type="button" onClick={() => onFiltro(SIN_FILTRO)} className="h-9 px-2 text-[13.5px] font-semibold text-accent hover:underline">
            Ver todo
          </button>
        </div>
      )}

      <div className="cascada mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
        {items === null && !error && Array.from({ length: 10 }, (_, i) => <EsqueletoAnuncio key={i} vista="rejilla" />)}
        {items?.map((a) => (
          <TarjetaAnuncio
            key={a.id}
            id={a.id}
            pilar={a.pilar}
            titulo={a.titulo}
            precio={formatearPrecio(a.precio, a.pilar)}
            ubicacion={formatearUbicacion(a.ubicacion, a.sector)}
            foto={urlCompleta(a.portada?.url ?? null)}
            vendido={a.vendido}
            onAbrir={() => onAbrir(a.id)}
          />
        ))}
      </div>

      {error && (
        <p className="mt-8 rounded-2xl border border-border bg-white px-5 py-6 text-center text-[14.5px] text-muted">
          No pudimos cargar los anuncios. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      {items?.length === 0 && !error && (
        <div className="mt-2 rounded-[28px] border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="titular text-[28px]">{filtrado ? 'Nada por aquí todavía' : 'Sé de los primeros'}</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-[15px] leading-relaxed text-muted">
            {filtrado ? 'Prueba con otra categoría o una búsqueda distinta.' : 'Todavía no hay anuncios publicados. El tuyo puede ser el primero que vean todos.'}
          </p>
          {filtrado && (
            <button type="button" onClick={() => onFiltro(SIN_FILTRO)} className="mt-5 h-11 rounded-full bg-foreground px-6 text-[14px] font-semibold text-white">
              Ver todos los anuncios
            </button>
          )}
        </div>
      )}

      {hayMas && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => void cargarMas()}
            disabled={cargandoMas}
            className="h-12 rounded-full border border-foreground/20 bg-white px-7 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground/50 disabled:opacity-60"
          >
            {cargandoMas ? 'Cargando…' : 'Ver más anuncios'}
          </button>
        </div>
      )}

      {/* Lo único que no se puede sin cuenta: contactar. Se dice aquí, en claro. */}
      <div className="mt-14 flex flex-col gap-5 rounded-[28px] bg-foreground px-6 py-7 text-white sm:flex-row sm:items-center sm:px-9">
        <div className="min-w-0 flex-1">
          <p className="titular text-[26px] text-brand">¿Te gustó algo?</p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-white/70">
            Para escribirle a quien lo publicó o ver su número, entra con tu cuenta. Crearla es gratis.
          </p>
        </div>
        <div className="relative flex shrink-0 gap-2">
          <button type="button" onClick={() => navegar(RUTA_ENTRAR)} className="h-11 rounded-full px-5 text-[14px] font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setAviso((v) => !v)}
            className="h-11 rounded-full bg-brand px-5 text-[14px] font-semibold text-foreground hover:bg-brand-dark"
          >
            Publicar gratis
          </button>
          {aviso && <AvisoPublicar onCerrar={() => setAviso(false)} arriba />}
        </div>
      </div>
    </section>
  );
}

function Quitable({ children, onQuitar }: { children: ReactNode; onQuitar: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-white pr-1 pl-3.5 text-[13.5px] font-medium text-foreground ring-1 ring-border">
      {children}
      <button type="button" onClick={onQuitar} aria-label="Quitar filtro" className="grid size-7 place-items-center rounded-full text-muted hover:bg-background hover:text-foreground [&>svg]:size-4">
        <IconoCerrar />
      </button>
    </span>
  );
}

/* ---------- Cómo funciona ---------- */

const PASOS = [
  {
    titulo: 'Publica en un minuto',
    texto: 'Sube unas fotos, ponle precio y listo. Publicar no cuesta nada y no cobramos comisión por vender.',
  },
  {
    titulo: 'Conversa sin dar tu número',
    texto: 'Los interesados te escriben por el chat de Baknazo. Tu teléfono solo se muestra si tú lo decides.',
  },
  {
    titulo: 'Cierra el trato',
    texto: 'Encuéntrense en un lugar público, revisen lo que compran y paguen al recibir. Así de sencillo.',
  },
];

function ComoFunciona() {
  const ref = useRevelar<HTMLElement>();
  return (
    <section
      ref={ref}
      id="como-funciona"
      aria-labelledby="titulo-como"
      className="scroll-mt-20 border-y border-border bg-white"
    >
      <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.4fr] lg:gap-20 lg:px-10 lg:py-28">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[12.5px] font-semibold tracking-[0.14em] text-muted uppercase">Cómo funciona</p>
          <h2 id="titulo-como" className="titular mt-2 text-[clamp(38px,5.6vw,72px)]">
            Así de fácil.
          </h2>
          <p className="mt-5 max-w-[34ch] text-[16px] leading-relaxed text-foreground/70">
            Sin trámites ni letra chica. Tres pasos entre lo que tienes y alguien que lo necesita.
          </p>
        </div>
        <ol className="grid">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-border py-9 first:border-t-0 first:pt-0 sm:gap-x-10">
              <span aria-hidden="true" className="titular text-[clamp(64px,9vw,120px)] leading-[0.8] text-brand [-webkit-text-stroke:2px_#1f2937]">
                {i + 1}
              </span>
              <div className="pt-1">
                <h3 className="text-[clamp(21px,2.4vw,28px)] leading-tight font-semibold tracking-tight">{p.titulo}</h3>
                <p className="mt-2.5 max-w-[48ch] text-[16px] leading-relaxed text-foreground/70">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Empleo ---------- */

function Empleo({
  vacantes,
  onVerTodas,
  onAbrir,
}: {
  vacantes: AnuncioFeed[] | null;
  onVerTodas: () => void;
  onAbrir: (id: number) => void;
}) {
  const navegar = useNavigate();
  const ref = useRevelar<HTMLElement>();
  return (
    <section ref={ref} id="empleo" aria-labelledby="titulo-empleo" className="scroll-mt-20 bg-empleo text-white">
      <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:px-10 lg:py-28">
        <div>
          <p className="text-[12.5px] font-semibold tracking-[0.14em] text-white/70 uppercase">Empleo</p>
          <h2 id="titulo-empleo" className="titular mt-2 text-[clamp(44px,7vw,92px)]">
            ¿Buscas camello?
          </h2>
          <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed text-white/85">
            Negocios de tu ciudad publican sus vacantes en Baknazo. Te postulas con tu hoja de vida en PDF, directo y sin intermediarios.
          </p>
          <button
            type="button"
            onClick={onVerTodas}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-empleo-deep transition-transform hover:translate-x-1"
          >
            Ver vacantes
            <span className="[&>svg]:size-4">
              <IconoChevron derecha />
            </span>
          </button>

          <div className="mt-12 max-w-[440px] border-t border-white/25 pt-6">
            <p className="text-[16px] font-semibold">¿Tienes un negocio?</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/80">
              Publica tus vacantes gratis, haz tus propias preguntas y recibe las hojas de vida ordenadas en tu bandeja.
            </p>
            <button
              type="button"
              onClick={() => navegar(RUTA_REGISTRO)}
              className="mt-3 text-[14.5px] font-semibold underline decoration-white/50 decoration-2 underline-offset-4 hover:decoration-white"
            >
              Crear cuenta de negocio
            </button>
          </div>
        </div>

        <div>
          {vacantes === null ? (
            <ul className="grid gap-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[92px] animate-pulse rounded-2xl bg-white/15" />
              ))}
            </ul>
          ) : vacantes.length === 0 ? (
            <div className="grid h-full min-h-[260px] place-items-center rounded-[28px] border border-dashed border-white/35 p-8 text-center">
              <div>
                <span className="mx-auto block w-fit text-white/80 [&>svg]:size-9">
                  <IconoMaletin />
                </span>
                <p className="mt-3 text-[17px] font-semibold">Pronto, las vacantes de tu ciudad</p>
                <p className="mx-auto mt-1.5 max-w-[34ch] text-[14.5px] text-white/75">Cuando los negocios publiquen, las verás aquí primero.</p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3">
              {vacantes.map((v) => {
                const detalle = v.detalle as { jornada?: string; modalidad?: string };
                const datos = [formatearUbicacion(v.ubicacion, v.sector), detalle.jornada && valorLegible(detalle.jornada), detalle.modalidad && valorLegible(detalle.modalidad)].filter(Boolean);
                const logo = urlCompleta(v.autor.foto);
                return (
                  // min-w-0: sin él, el título con `truncate` ensancha la rejilla (y la página) en celular.
                  <li key={v.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onAbrir(v.id)}
                      className="group flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left text-foreground shadow-[0_18px_36px_-24px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5 sm:p-5"
                    >
                      {logo ? (
                        <img src={logo} alt="" className="size-12 shrink-0 rounded-full object-cover ring-1 ring-border" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-empleo/10 text-[15px] font-bold text-empleo-deep">
                          {inicialesDe(v.autor.nombre)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold">{v.titulo}</span>
                        <span className="mt-0.5 block truncate text-[13.5px] text-muted">
                          {v.autor.nombre} · {datos.join(' · ')}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right sm:block">
                        <span className="block text-[15px] font-bold">{formatearPrecio(v.precio, 'empleo')}</span>
                        <span className="text-[12px] text-muted">al mes</span>
                      </span>
                      <span className="shrink-0 text-muted transition-transform group-hover:translate-x-1 [&>svg]:size-5">
                        <IconoChevron derecha />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Confianza ---------- */

const GARANTIAS: { icono: ReactNode; titulo: string; texto: string }[] = [
  {
    icono: <IconoEscudo />,
    titulo: 'Anuncios revisados',
    texto: 'Nuestras reglas detienen lo prohibido antes de publicarse y un equipo revisa lo que la gente denuncia.',
  },
  {
    icono: <IconoBocadillo />,
    titulo: 'Chatea sin dar tu número',
    texto: 'Todo se conversa dentro de Baknazo. Tu teléfono aparece solo si tú lo activas.',
  },
  {
    icono: <IconoCheck ok />,
    titulo: 'Perfiles con historial',
    texto: 'Mira quién publica, desde cuándo está y qué más ofrece antes de decidirte.',
  },
  {
    icono: <IconoBandera />,
    titulo: 'Denuncia en un toque',
    texto: 'Si algo no se ve bien, avísanos. Es anónimo y lo revisamos.',
  },
];

function Confianza() {
  const ref = useRevelar<HTMLElement>();
  return (
    <section ref={ref} id="seguridad" aria-labelledby="titulo-seguridad" className="mx-auto w-full max-w-[1320px] scroll-mt-20 px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-[12.5px] font-semibold tracking-[0.14em] text-muted uppercase">Compra con confianza</p>
          <h2 id="titulo-seguridad" className="titular mt-2 text-[clamp(38px,5.6vw,72px)]">
            Aquí se compra tranquilo.
          </h2>
          <p className="mt-6 max-w-[38ch] rounded-2xl bg-brand/20 px-5 py-4 text-[15px] leading-relaxed text-foreground">
            <strong className="font-semibold">Un consejo de casa:</strong> reúnete en un lugar público, revisa antes de pagar y nunca envíes dinero por adelantado.
          </p>
        </div>
        <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {GARANTIAS.map((g) => (
            <div key={g.titulo}>
              <dt className="border-t-2 border-foreground pt-4 text-[18px] font-semibold tracking-tight">
                <span className="mb-3 block text-brand-dark [&>svg]:size-7">{g.icono}</span>
                {g.titulo}
              </dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-foreground/70">{g.texto}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ---------- Llamado final ---------- */

function Llamado() {
  const navegar = useNavigate();
  const ref = useRevelar<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="titulo-llamado" className="px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="relative isolate overflow-hidden rounded-[32px] bg-brand px-6 py-20 sm:px-12 lg:px-20 lg:py-28">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.22]"
          style={{ backgroundImage: 'radial-gradient(rgba(140,90,0,0.55) 1px, transparent 1.4px)', backgroundSize: '18px 18px' }}
        />
        <h2 id="titulo-llamado" className="titular max-w-[14ch] text-[clamp(44px,7.6vw,112px)]">
          Eso que ya no usas, a alguien le parece bacán.
        </h2>
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navegar(RUTA_REGISTRO)}
            className="h-14 rounded-full bg-foreground px-8 text-[16px] font-semibold text-white shadow-[0_18px_36px_-18px_rgba(17,24,39,0.8)] transition-transform hover:-translate-y-0.5"
          >
            Crear cuenta y publicar
          </button>
          <button
            type="button"
            onClick={() => navegar(RUTA_ENTRAR)}
            className="h-14 rounded-full px-8 text-[16px] font-semibold text-foreground ring-2 ring-foreground/80 transition-colors hover:bg-foreground hover:text-white"
          >
            Ya tengo cuenta
          </button>
        </div>
        <p className="mt-6 text-[14px] font-medium text-foreground/70">Gratis, sin comisiones y sin descargar nada.</p>
      </div>
    </section>
  );
}
