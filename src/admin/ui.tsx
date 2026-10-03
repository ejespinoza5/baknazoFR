import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import BaknazoLoader from '../components/BaknazoLoader';
import { IconoCerrar, IconoLupa } from '../components/Iconos';
import { useBloqueoScroll } from '../lib/bloqueoScroll';
import type { EstadoAnuncioAdmin } from './tipos';

/**
 * Las piezas del panel. Son las de la app (tarjetas blancas de borde suave,
 * botones de alto 40, los tonos de estado de siempre) en versión de oficina:
 * más densas y con tablas. Las fechas están en `formato.ts`.
 */

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight text-foreground">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-[70ch] text-[13.5px] leading-relaxed text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

export function Tarjeta({ titulo, descripcion, acciones, children, className = '', sinRelleno = false }: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  sinRelleno?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-white ${className}`}>
      {(titulo || acciones) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {titulo && <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{descripcion}</p>}
          </div>
          {acciones}
        </div>
      )}
      <div className={sinRelleno ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

type Tono = 'exito' | 'aviso' | 'peligro' | 'neutro' | 'info';
const TONOS: Record<Tono, string> = {
  exito: 'bg-success/10 text-success-deep',
  aviso: 'bg-warning/10 text-warning-deep',
  peligro: 'bg-danger/10 text-danger-deep',
  neutro: 'bg-border/70 text-foreground',
  info: 'bg-accent/10 text-accent-dark',
};

export function Insignia({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${TONOS[tono]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

const ESTADO_ANUNCIO: Record<EstadoAnuncioAdmin, { texto: string; tono: Tono }> = {
  PENDIENTE_REVISION: { texto: 'En revisión', tono: 'aviso' },
  PUBLICADO: { texto: 'Publicado', tono: 'exito' },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' },
  PAUSADO: { texto: 'Pausado', tono: 'neutro' },
  BORRADOR: { texto: 'Borrador', tono: 'neutro' },
  ELIMINADO: { texto: 'Eliminado', tono: 'peligro' },
};

export function EstadoAnuncio({ estado, porModeracion = false }: { estado: EstadoAnuncioAdmin; porModeracion?: boolean }) {
  const e = ESTADO_ANUNCIO[estado] ?? { texto: estado, tono: 'neutro' as Tono };
  return <Insignia tono={porModeracion && estado === 'PAUSADO' ? 'aviso' : e.tono}>{porModeracion && estado === 'PAUSADO' ? 'Pausado por moderación' : e.texto}</Insignia>;
}

type Variante = 'primario' | 'secundario' | 'peligro' | 'exito' | 'fantasma';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand text-foreground hover:bg-brand-dark',
  secundario: 'border border-border bg-white text-foreground hover:border-muted',
  peligro: 'bg-danger text-white hover:opacity-90',
  exito: 'bg-success text-white hover:bg-success-deep',
  fantasma: 'text-foreground hover:bg-background',
};

export function Boton({
  variante = 'secundario',
  cargando = false,
  chico = false,
  children,
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean; chico?: boolean }) {
  return (
    <button
      type="button"
      {...resto}
      disabled={resto.disabled || cargando}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
        chico ? 'h-8 px-3 text-[12.5px]' : 'h-10 px-4 text-[13.5px]'
      } ${VARIANTES[variante]} ${className}`}
    >
      {cargando ? <BaknazoLoader tamano="boton" mensaje="Procesando" /> : children}
    </button>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">{etiqueta}</span>
      <input
        {...resto}
        aria-invalid={Boolean(error)}
        className={`h-11 w-full rounded-lg border bg-white px-3.5 text-[14.5px] text-foreground placeholder:text-muted/70 focus:ring-[3px] focus:outline-none ${
          error ? 'border-danger/60 focus:ring-danger/15' : 'border-border focus:border-accent/70 focus:ring-accent/15'
        }`}
      />
      {error ? (
        <span className="mt-1 block text-[12.5px] text-danger-deep">{error}</span>
      ) : ayuda ? (
        <span className="mt-1 block text-[12px] text-muted">{ayuda}</span>
      ) : null}
    </label>
  );
}

export function AreaTexto({ etiqueta, valor, onCambiar, max = 1000, placeholder }: {
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">{etiqueta}</span>
      <textarea
        value={valor}
        onChange={(e) => onCambiar(e.target.value.slice(0, max))}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground placeholder:text-muted/70 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
      />
      <span className="mt-1 block text-right text-[11.5px] text-muted tabular-nums">
        {valor.length}/{max}
      </span>
    </label>
  );
}

/** Modal de la app: centrado, con velo, Escape y clic fuera cierran. */
export function Modal({ titulo, descripcion, onCerrar, children, pie, ancho = 'max-w-md' }: {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children?: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  useBloqueoScroll();
  const caja = useRef<HTMLDivElement>(null);
  // onCerrar suele llegar como función nueva en cada render: se guarda en una
  // referencia para que el efecto de Escape no se rehaga a cada tecla.
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  // El foco entra UNA vez, al abrir: al primer campo de texto si lo hay y, si
  // no, al primer botón del pie, nunca a la X. Antes se repetía en cada render
  // y cada tecla mandaba el foco a la X.
  useEffect(() => {
    const el = caja.current;
    const campo = el?.querySelector<HTMLElement>('input:not([type="radio"]):not([type="checkbox"]), textarea, select');
    (campo ?? el?.querySelector<HTMLElement>('[data-pie] button'))?.focus();
  }, []);
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-carbon/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-admin-titulo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div ref={caja} className={`w-full ${ancho} rounded-2xl border border-border bg-white shadow-[0_24px_48px_-24px_rgba(31,41,55,0.5)]`}>
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="modal-admin-titulo" className="text-[17px] font-semibold tracking-tight text-foreground">
              {titulo}
            </h2>
            {descripcion && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{descripcion}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-mt-1 -mr-2 grid size-9 place-items-center rounded-lg text-muted hover:bg-background hover:text-foreground">
            <IconoCerrar />
          </button>
        </div>
        {children && <div className="space-y-4 px-6 pt-4">{children}</div>}
        <div data-pie className="flex flex-wrap justify-end gap-2 px-6 pt-5 pb-5">
          {pie}
        </div>
      </div>
    </div>
  );
}

export function Chips<T extends string>({ opciones, valor, onCambiar }: {
  opciones: { id: T; texto: string; cuenta?: number }[];
  valor: T;
  onCambiar: (v: T) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(o.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
              activo ? 'border-transparent bg-accent text-white' : 'border-border bg-white text-foreground hover:border-muted'
            }`}
          >
            {o.texto}
            {o.cuenta !== undefined && <span className={`tabular-nums ${activo ? 'text-white/75' : 'text-muted'}`}>{o.cuenta}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Buscador({ valor, onCambiar, placeholder }: { valor: string; onCambiar: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted [&>svg]:size-4">
        <IconoLupa />
      </span>
      <input
        type="search"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-white pr-3 pl-9 text-[14px] text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
      />
    </label>
  );
}

export function Paginacion({ total, offset, limite, onCambiar }: { total: number; offset: number; limite: number; onCambiar: (o: number) => void }) {
  if (total <= limite) return null;
  const desde = offset + 1;
  const hasta = Math.min(offset + limite, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[12.5px] text-muted">
      <span className="tabular-nums">
        {desde}–{hasta} de {total}
      </span>
      <div className="flex gap-2">
        <Boton chico disabled={offset === 0} onClick={() => onCambiar(Math.max(0, offset - limite))}>
          Anterior
        </Boton>
        <Boton chico disabled={hasta >= total} onClick={() => onCambiar(offset + limite)}>
          Siguiente
        </Boton>
      </div>
    </div>
  );
}

export function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-foreground">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-relaxed text-muted">{texto}</p>}
    </div>
  );
}

export function Cargando({ mensaje = 'Cargando' }: { mensaje?: string }) {
  return <BaknazoLoader tamano="seccion" mensaje={mensaje} />;
}

export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13px] text-danger-deep">
      {children}
    </p>
  );
}

/** La tabla del panel: encabezado discreto y desplazamiento lateral en pantallas chicas. */
export function Tabla({ columnas, children }: { columnas: (string | { texto: string; derecha?: boolean })[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="bg-background/70">
            {columnas.map((c) => {
              const col = typeof c === 'string' ? { texto: c } : c;
              return (
                <th key={col.texto} scope="col" className={`px-5 py-2.5 text-[12px] font-semibold whitespace-nowrap text-muted ${col.derecha ? 'text-right' : ''}`}>
                  {col.texto}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
