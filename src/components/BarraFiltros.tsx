import type { ReactNode } from 'react';
import { IconoCerrar, IconoFiltros, IconoPin } from './Iconos';
import Selector from './Selector';
import { nombreDeCanton } from '../lib/catalogos';
import {
  ETIQUETA_ORDEN,
  FILTROS_VACIOS,
  conPilar,
  contarFiltros,
  ordenPorDefecto,
  ordenesDisponibles,
  type FiltrosUrl,
} from '../lib/filtrosFeed';
import { NOMBRE_PILAR, type Pilar } from '../lib/pilares';
import type { Catalogos } from '../types/anuncio';

/**
 * La barra de arriba del feed: sección, cercanía, filtros y orden.
 *
 * Lo más usado queda a un toque (la sección y "Cerca de ti"); lo demás vive en
 * el panel. Debajo, cada filtro activo es una etiqueta con su ✕, para que se
 * vea qué está recortando los resultados y se pueda quitar sin abrir nada.
 */
export default function BarraFiltros({
  filtros,
  catalogos,
  onCambiar,
  onAbrirPanel,
  onAlternarCerca,
}: {
  filtros: FiltrosUrl;
  catalogos: Catalogos | null;
  onCambiar: (f: FiltrosUrl) => void;
  onAbrirPanel: () => void;
  onAlternarCerca: () => void;
}) {
  const cuantos = contarFiltros(filtros);
  const activos = etiquetasActivas(filtros, catalogos);

  return (
    <div className="mt-5">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Pestana activa={filtros.pilar === null} onClick={() => onCambiar(conPilar(filtros, null))}>
          Todo
        </Pestana>
        {(['productos', 'servicios', 'empleo'] as Pilar[]).map((p) => (
          <Pestana key={p} activa={filtros.pilar === p} onClick={() => onCambiar(conPilar(filtros, p))}>
            {NOMBRE_PILAR[p]}
          </Pestana>
        ))}

        <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />

        <button
          type="button"
          onClick={onAlternarCerca}
          aria-pressed={filtros.cerca !== null}
          className={
            filtros.cerca !== null
              ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white'
              : 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-muted'
          }
        >
          <span className="[&>svg]:size-4">
            <IconoPin />
          </span>
          Cerca de ti
        </button>

        <button
          type="button"
          onClick={onAbrirPanel}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-muted"
        >
          <IconoFiltros />
          Filtros
          {cuantos > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-white tabular-nums">
              {cuantos}
            </span>
          )}
        </button>

        <div className="ml-auto hidden shrink-0 items-center gap-2 text-[13px] text-muted md:flex">
          <span aria-hidden="true">Ordenar</span>
          <Selector
            etiqueta="Ordenar"
            valor={
              filtros.cerca
                ? 'cercanos'
                : filtros.orden === 'cercanos'
                  ? ordenPorDefecto(filtros.q)
                  : filtros.orden
            }
            onCambiar={(valor) => {
              if (valor === 'cercanos') onAlternarCerca();
              else onCambiar({ ...filtros, orden: valor as FiltrosUrl['orden'], cerca: null });
            }}
            opciones={[
              ...ordenesDisponibles(filtros.q).map((o) => ({ valor: o, texto: ETIQUETA_ORDEN[o] })),
              { valor: 'cercanos', texto: 'Más cerca de mí' },
            ]}
            buscable={false}
            clase="h-9 min-w-44 rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:border-muted focus-visible:border-accent/70 focus-visible:ring-[3px] focus-visible:ring-accent/15 focus:outline-none"
          />
        </div>
      </div>

      {activos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activos.map((a) => (
            <Etiqueta key={a.clave} onQuitar={() => onCambiar(a.quitar(filtros))}>
              {a.texto}
            </Etiqueta>
          ))}
          <button
            type="button"
            onClick={() => onCambiar({ ...FILTROS_VACIOS, q: filtros.q, pilar: filtros.pilar })}
            className="h-8 rounded-full px-2 text-[12.5px] font-semibold text-accent hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

function Pestana({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={
        activa
          ? 'h-9 shrink-0 rounded-full bg-foreground px-4 text-[13px] font-semibold text-white'
          : 'h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold text-muted transition-colors hover:bg-white hover:text-foreground'
      }
    >
      {children}
    </button>
  );
}

function Etiqueta({ onQuitar, children }: { onQuitar: () => void; children: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-accent/30 bg-accent/[0.06] pr-1 pl-3 text-[12.5px] font-medium text-accent-dark">
      {children}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${typeof children === 'string' ? children : 'filtro'}`}
        className="grid size-6 place-items-center rounded-full transition-colors hover:bg-accent/10 [&>svg]:size-3.5"
      >
        <IconoCerrar />
      </button>
    </span>
  );
}

const dinero = (n: number) => `$${n.toLocaleString('es-EC')}`;

interface Activo {
  clave: string;
  texto: string;
  quitar: (f: FiltrosUrl) => FiltrosUrl;
}

/** Cada filtro puesto, con su texto y cómo quitarlo. */
function etiquetasActivas(f: FiltrosUrl, c: Catalogos | null): Activo[] {
  const lista: Activo[] = [];
  const e = c?.enumeraciones;

  if (f.categoria) {
    const nombre = c?.categorias.find((x) => x.id === f.categoria)?.nombre ?? 'Categoría';
    lista.push({ clave: 'categoria', texto: nombre, quitar: (x) => ({ ...x, categoria: null }) });
  }
  if (f.cerca) {
    lista.push({
      clave: 'cerca',
      texto: `A ${f.cerca} km`,
      quitar: (x) => ({ ...x, cerca: null, orden: 'recientes' }),
    });
  }
  if (f.canton || f.provincia) {
    const texto =
      nombreDeCanton(c, f.canton ?? undefined) ??
      c?.provincias.find((p) => p.codigo === f.provincia)?.nombre ??
      'Ubicación';
    lista.push({ clave: 'lugar', texto, quitar: (x) => ({ ...x, canton: null, provincia: null }) });
  }
  if (f.precioMin !== null || f.precioMax !== null) {
    const texto =
      f.precioMin !== null && f.precioMax !== null
        ? `${dinero(f.precioMin)} a ${dinero(f.precioMax)}`
        : f.precioMin !== null
          ? `Desde ${dinero(f.precioMin)}`
          : `Hasta ${dinero(f.precioMax as number)}`;
    lista.push({ clave: 'precio', texto, quitar: (x) => ({ ...x, precioMin: null, precioMax: null }) });
  }
  if (f.condicion) {
    lista.push({ clave: 'condicion', texto: e?.condicion[f.condicion] ?? f.condicion, quitar: (x) => ({ ...x, condicion: null }) });
  }
  if (f.modalidadCobro) {
    lista.push({
      clave: 'cobro',
      texto: e?.modalidadCobro[f.modalidadCobro] ?? f.modalidadCobro,
      quitar: (x) => ({ ...x, modalidadCobro: null }),
    });
  }
  if (f.jornada) {
    lista.push({ clave: 'jornada', texto: e?.jornada[f.jornada] ?? f.jornada, quitar: (x) => ({ ...x, jornada: null }) });
  }
  if (f.modalidad) {
    lista.push({ clave: 'modalidad', texto: e?.modalidad[f.modalidad] ?? f.modalidad, quitar: (x) => ({ ...x, modalidad: null }) });
  }
  if (f.conFoto) lista.push({ clave: 'foto', texto: 'Con fotos', quitar: (x) => ({ ...x, conFoto: false }) });
  if (!f.cerca && (f.orden === 'precio_asc' || f.orden === 'precio_desc')) {
    lista.push({ clave: 'orden', texto: ETIQUETA_ORDEN[f.orden], quitar: (x) => ({ ...x, orden: 'recientes' }) });
  }
  return lista;
}
