import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { IconoCerrar, IconoChevron, IconoLupa } from './Iconos';
import { useBloqueoScroll } from '../lib/bloqueoScroll';

export interface OpcionSelector {
  valor: string;
  texto: string;
  /** Encabezado bajo el que se agrupa (p. ej. la provincia de un cantón). */
  grupo?: string;
}

interface Props {
  valor: string;
  onCambiar: (valor: string) => void;
  opciones: OpcionSelector[];
  placeholder?: string;
  /** Opción para dejarlo vacío, p. ej. "Todas las ciudades". Sin esto no se puede vaciar. */
  vacio?: string;
  id?: string;
  /** Nombre accesible si no hay un `<label htmlFor>`; también titula la hoja en móvil. */
  etiqueta?: string;
  deshabilitado?: boolean;
  invalido?: boolean;
  /** Por defecto, con buscador si hay más de 8 opciones. */
  buscable?: boolean;
  textoBusqueda?: string;
  /** Clases del botón. Por defecto, las de un campo de formulario. */
  clase?: string;
}

const CLASE_CAMPO =
  'h-11 w-full rounded-lg border bg-white px-3.5 text-[15px] transition-colors duration-150 focus:outline-none focus-visible:ring-[3px]';

const ALTO_MAXIMO = 320;
const MOVIL = '(max-width: 639px)';

/** Sin tildes ni mayúsculas: "pichincha" encuentra "Pichincha" y "quito" a "Quito". */
const normal = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * El selector de toda la app, en lugar del `<select>` nativo.
 *
 * El nativo de Windows abre la lista entera (221 cantones) hasta el borde de la
 * pantalla, a veces hacia arriba, y no deja buscar. Este se abre bajo el campo
 * (o encima si abajo no cabe) con un alto acotado y un buscador que encuentra
 * por la opción o por su grupo: escribir "Guayas" muestra sus cantones. En el
 * celular se abre como hoja desde abajo, que es donde llega el pulgar.
 *
 * Teclado: flechas para moverse, Enter para elegir, Escape para cerrar.
 */
export default function Selector({
  valor,
  onCambiar,
  opciones,
  placeholder = 'Elige una opción',
  vacio,
  id,
  etiqueta,
  deshabilitado = false,
  invalido = false,
  buscable,
  textoBusqueda = 'Buscar',
  clase,
}: Props) {
  const idLista = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const busqueda = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [hoja, setHoja] = useState(false);
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const [posicion, setPosicion] = useState<CSSProperties>({});

  const conBuscador = buscable ?? opciones.length > 8;
  const seleccionada = opciones.find((o) => o.valor === valor);

  /* Las opciones visibles, con la de "vacío" primero si existe. */
  const visibles = useMemo(() => {
    const t = normal(q);
    const filtradas = t
      ? opciones.filter((o) => normal(o.texto).includes(t) || (o.grupo !== undefined && normal(o.grupo).includes(t)))
      : opciones;
    return vacio !== undefined && !t ? [{ valor: '', texto: vacio }, ...filtradas] : filtradas;
  }, [opciones, q, vacio]);

  const colocar = useCallback(() => {
    const el = boton.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const abajo = window.innerHeight - r.bottom - 12;
    const arriba = r.top - 12;
    const haciaArriba = abajo < 220 && arriba > abajo;
    const alto = Math.min(ALTO_MAXIMO + (conBuscador ? 56 : 0), haciaArriba ? arriba : abajo);
    const ancho = Math.min(Math.max(r.width, 240), window.innerWidth - 16);
    const izquierda = Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8);
    setPosicion(
      haciaArriba
        ? { left: izquierda, width: ancho, bottom: window.innerHeight - r.top + 4, maxHeight: alto }
        : { left: izquierda, width: ancho, top: r.bottom + 4, maxHeight: alto }
    );
  }, [conBuscador]);

  const abrir = () => {
    if (deshabilitado) return;
    const esMovil = window.matchMedia(MOVIL).matches;
    setHoja(esMovil);
    setQ('');
    const i = visiblesIniciales();
    setActivo(i);
    if (!esMovil) colocar();
    setAbierto(true);
  };

  // El índice de la opción elegida en la lista completa (sin filtro).
  const visiblesIniciales = () => {
    const base = vacio !== undefined ? [{ valor: '' }, ...opciones] : opciones;
    return Math.max(0, base.findIndex((o) => o.valor === valor));
  };

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  const elegir = (o: OpcionSelector) => {
    onCambiar(o.valor);
    cerrar();
  };

  useBloqueoScroll(abierto && hoja);

  /* Abierto: se recoloca al desplazar o redimensionar, y se cierra al tocar fuera. */
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !boton.current?.contains(t)) cerrar(false);
    };
    const recolocar = () => {
      if (!hoja) colocar();
    };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('scroll', recolocar, true);
    };
  }, [abierto, hoja, colocar, cerrar]);

  /**
   * La hoja del celular va pegada abajo, pero el teclado no encoge la ventana
   * (ni en iPhone ni en Chrome de Android): se pone encima y tapaba las
   * opciones justo al buscar. `visualViewport` sí sabe cuánto deja el teclado,
   * así que la hoja se apoya sobre él y su alto se limita a lo que se ve.
   */
  useLayoutEffect(() => {
    const el = panel.current;
    const vv = window.visualViewport;
    if (!abierto || !hoja || !el || !vv) return;
    const ajustar = () => {
      const tapado = Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height)));
      el.style.bottom = `${tapado}px`;
      el.style.maxHeight = `${Math.round(Math.min(window.innerHeight * 0.78, vv.height - 16))}px`;
    };
    ajustar();
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    return () => {
      vv.removeEventListener('resize', ajustar);
      vv.removeEventListener('scroll', ajustar);
    };
  }, [abierto, hoja]);

  /* Al abrir, el foco va al buscador (o a la lista) y la elegida queda a la vista. */
  useLayoutEffect(() => {
    if (!abierto) return;
    if (conBuscador && !hoja) busqueda.current?.focus();
    else lista.current?.focus();
  }, [abierto, conBuscador, hoja]);

  useEffect(() => {
    if (!abierto) return;
    lista.current?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, abierto]);

  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(visibles.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActivo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActivo(visibles.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = visibles[activo];
      if (o) elegir(o);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    } else if (e.key === 'Tab') {
      cerrar(false);
    }
  };

  const textoBoton = seleccionada?.texto ?? (valor === '' && vacio !== undefined ? vacio : undefined);

  const contenido = (
    <>
      {conBuscador && (
        <div className="shrink-0 border-b border-border p-2">
          <label className="relative block">
            <span className="sr-only">{textoBusqueda}</span>
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted [&>svg]:size-4">
              <IconoLupa />
            </span>
            <input
              ref={busqueda}
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActivo(0);
              }}
              onKeyDown={alTeclear}
              placeholder={textoBusqueda}
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls={idLista}
              aria-activedescendant={visibles[activo] ? `${idLista}-${activo}` : undefined}
              className="h-10 w-full rounded-lg border border-border bg-background/60 pr-3 pl-9 text-[14.5px] text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:bg-white focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
            />
          </label>
        </div>
      )}
      <ul
        ref={lista}
        id={idLista}
        role="listbox"
        tabIndex={-1}
        aria-label={etiqueta ?? placeholder}
        onKeyDown={alTeclear}
        aria-activedescendant={!conBuscador && visibles[activo] ? `${idLista}-${activo}` : undefined}
        className="barra-clara min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 focus:outline-none"
      >
        {visibles.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-muted">Sin resultados para «{q}»</li>}
        {visibles.map((o, i) => {
          const grupoNuevo = o.grupo !== undefined && o.grupo !== visibles[i - 1]?.grupo;
          const elegida = o.valor === valor;
          return (
            <li key={`${o.grupo ?? ''}|${o.valor}`} role="presentation">
              {grupoNuevo && (
                <p
                  aria-hidden="true"
                  className="sticky top-0 z-10 -mx-1.5 bg-white/95 px-4.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase backdrop-blur"
                >
                  {o.grupo}
                </p>
              )}
              <div
                id={`${idLista}-${i}`}
                data-indice={i}
                role="option"
                aria-selected={elegida}
                onPointerMove={() => setActivo(i)}
                onClick={() => elegir(o)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[14.5px] ${
                  i === activo ? 'bg-accent/[0.08]' : ''
                } ${elegida ? 'font-semibold text-accent-dark' : 'text-foreground'} ${o.valor === '' ? 'text-muted' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate">{o.texto}</span>
                {elegida && (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      <button
        ref={boton}
        id={id}
        type="button"
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            abrir();
          }
        }}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-invalid={invalido || undefined}
        aria-label={etiqueta && !id ? `${etiqueta}: ${textoBoton ?? placeholder}` : undefined}
        className={`flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
          clase ??
          `${CLASE_CAMPO} ${
            invalido
              ? 'border-danger/60 focus-visible:ring-danger/15'
              : abierto
                ? 'border-accent/70 ring-[3px] ring-accent/15'
                : 'border-border hover:border-muted focus-visible:border-accent/70 focus-visible:ring-accent/15'
          }`
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${textoBoton ? 'text-foreground' : 'text-muted/80'}`}>
          {textoBoton ?? placeholder}
        </span>
        <span className={`shrink-0 text-muted transition-transform duration-150 [&>svg]:size-4 ${abierto ? 'rotate-180' : ''}`}>
          <IconoChevron />
        </span>
      </button>

      {abierto &&
        createPortal(
          hoja ? (
            <div className="fixed inset-0 z-[95]" role="presentation">
              <div className="animate-bkn-velo absolute inset-0 bg-carbon/45" aria-hidden="true" />
              <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label={etiqueta ?? placeholder}
                style={{ transition: 'bottom 0.18s ease-out' }}
                className="animate-bkn-hoja absolute inset-x-0 bottom-0 flex max-h-[78svh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgba(31,41,55,0.35)]"
              >
                <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-1">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{etiqueta ?? placeholder}</p>
                  <button
                    type="button"
                    onClick={() => cerrar()}
                    aria-label="Cerrar"
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-background hover:text-foreground"
                  >
                    <IconoCerrar />
                  </button>
                </div>
                {contenido}
              </div>
            </div>
          ) : (
            <div
              ref={panel}
              style={posicion}
              className="animate-bkn-in fixed z-[95] flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_40px_-18px_rgba(31,41,55,0.45)]"
            >
              {contenido}
            </div>
          ),
          document.body
        )}
    </>
  );
}
