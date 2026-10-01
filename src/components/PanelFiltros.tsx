import { useEffect, useState, type ReactNode } from 'react';
import BaknazoLoader from './BaknazoLoader';
import { IconoCerrar, IconoPin } from './Iconos';
import { useBloqueoScroll } from '../lib/bloqueoScroll';
import { categoriasDe } from '../lib/catalogos';
import {
  ETIQUETA_ORDEN,
  FILTROS_VACIOS,
  RADIOS_KM,
  RANGOS_PRECIO,
  conPilar,
  ordenesDisponibles,
  type FiltrosUrl,
} from '../lib/filtrosFeed';
import { NOMBRE_PILAR, type Pilar } from '../lib/pilares';
import type { Catalogos } from '../types/anuncio';

/**
 * Todos los filtros del feed en un solo panel.
 *
 * Se trabaja sobre un borrador y se aplica con "Ver resultados": cambiar cinco
 * cosas no debe disparar cinco búsquedas, y en datos móviles cada una cuesta.
 * En escritorio entra por la derecha; en el celular sube desde abajo, al
 * alcance del pulgar.
 */
export default function PanelFiltros({
  filtros,
  catalogos,
  onAplicar,
  onCerrar,
  onActivarCerca,
}: {
  filtros: FiltrosUrl;
  catalogos: Catalogos | null;
  onAplicar: (f: FiltrosUrl) => void;
  onCerrar: () => void;
  /** Pide la ubicación; resuelve `true` si se obtuvo. */
  onActivarCerca: () => Promise<boolean>;
}) {
  const [borrador, setBorrador] = useState<FiltrosUrl>(filtros);
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  useBloqueoScroll();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const poner = (cambios: Partial<FiltrosUrl>) => setBorrador((b) => ({ ...b, ...cambios }));

  const provincia = catalogos?.provincias.find((p) => p.codigo === borrador.provincia) ?? null;
  const categorias = borrador.pilar ? categoriasDe(catalogos, borrador.pilar) : [];
  const rangos = RANGOS_PRECIO[borrador.pilar ?? 'todos'];
  const enum_ = catalogos?.enumeraciones;

  const elegirRadio = async (km: number) => {
    if (borrador.cerca === km) {
      poner({ cerca: null, orden: 'recientes' });
      return;
    }
    setPidiendoUbicacion(true);
    const ok = await onActivarCerca();
    setPidiendoUbicacion(false);
    if (ok) poner({ cerca: km, orden: 'cercanos' });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-end sm:items-stretch" role="dialog" aria-modal="true" aria-label="Filtros">
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={onCerrar}
        className="animate-bkn-velo absolute inset-0 cursor-default bg-carbon/45"
      />
      <div className="animate-bkn-hoja relative flex max-h-[88svh] w-full flex-col rounded-t-2xl bg-white shadow-[0_24px_48px_-24px_rgba(31,41,55,0.5)] sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 className="text-[17px] font-semibold tracking-tight">Filtros</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
          <Seccion titulo="Qué buscas">
            <div className="flex flex-wrap gap-2">
              <Chip activo={borrador.pilar === null} onClick={() => setBorrador((b) => conPilar(b, null))}>
                Todo
              </Chip>
              {(['productos', 'servicios', 'empleo'] as Pilar[]).map((p) => (
                <Chip key={p} activo={borrador.pilar === p} onClick={() => setBorrador((b) => conPilar(b, p))}>
                  {NOMBRE_PILAR[p]}
                </Chip>
              ))}
            </div>
            {borrador.pilar && categorias.length > 0 && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[13px] font-medium text-muted">Categoría</span>
                <select
                  value={borrador.categoria ?? ''}
                  onChange={(e) => poner({ categoria: e.target.value ? Number(e.target.value) : null })}
                  className={SELECT}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </Seccion>

          <Seccion titulo="Ordenar por">
            <div className="grid gap-2">
              {ordenesDisponibles(borrador.q).map((orden) => (
                <Opcion
                  key={orden}
                  activo={!borrador.cerca && borrador.orden === orden}
                  onClick={() => poner({ orden, cerca: null })}
                >
                  {ETIQUETA_ORDEN[orden]}
                </Opcion>
              ))}
              <Opcion activo={borrador.cerca !== null} onClick={() => elegirRadio(borrador.cerca ?? 25)}>
                Más cerca de mí
              </Opcion>
            </div>
          </Seccion>

          <Seccion titulo="Cerca de ti" ayuda="Usamos tu ubicación aproximada, nunca la exacta, y no la guardamos.">
            <div className="flex flex-wrap gap-2">
              {RADIOS_KM.map((km) => (
                <Chip key={km} activo={borrador.cerca === km} onClick={() => elegirRadio(km)} deshabilitado={pidiendoUbicacion}>
                  {km} km
                </Chip>
              ))}
            </div>
            {pidiendoUbicacion && (
              <p className="mt-2.5 text-[12.5px] text-muted">
                <BaknazoLoader tamano="boton" mensaje="Buscando tu ubicación" />
              </p>
            )}
          </Seccion>

          <Seccion titulo="Ubicación">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-muted">Provincia</span>
                <select
                  value={borrador.provincia ?? ''}
                  onChange={(e) => poner({ provincia: e.target.value || null, canton: null })}
                  className={SELECT}
                >
                  <option value="">Todo Ecuador</option>
                  {catalogos?.provincias.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-muted">Ciudad</span>
                <select
                  value={borrador.canton ?? ''}
                  onChange={(e) => poner({ canton: e.target.value || null })}
                  disabled={!provincia}
                  className={SELECT}
                >
                  <option value="">{provincia ? 'Toda la provincia' : 'Elige provincia'}</option>
                  {provincia?.cantones.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Seccion>

          <Seccion titulo={borrador.pilar === 'empleo' ? 'Salario (USD)' : 'Precio (USD)'}>
            <div className="flex items-center gap-2">
              <CampoPrecio
                etiqueta="Mínimo"
                valor={borrador.precioMin}
                onCambio={(v) => poner({ precioMin: v })}
              />
              <span className="text-muted" aria-hidden="true">
                a
              </span>
              <CampoPrecio
                etiqueta="Máximo"
                valor={borrador.precioMax}
                onCambio={(v) => poner({ precioMax: v })}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {rangos.map((r) => (
                <Chip
                  key={r.etiqueta}
                  activo={borrador.precioMin === r.min && borrador.precioMax === r.max}
                  onClick={() => poner({ precioMin: r.min, precioMax: r.max })}
                >
                  {r.etiqueta}
                </Chip>
              ))}
            </div>
            {borrador.precioMin !== null &&
              borrador.precioMax !== null &&
              borrador.precioMin > borrador.precioMax && (
                <p className="mt-2 text-[12.5px] text-danger-deep">El mínimo es mayor que el máximo.</p>
              )}
          </Seccion>

          {borrador.pilar === 'productos' && enum_ && (
            <Seccion titulo="Condición">
              <GrupoEnum
                etiquetas={enum_.condicion}
                valor={borrador.condicion}
                onCambio={(v) => poner({ condicion: v as FiltrosUrl['condicion'] })}
              />
            </Seccion>
          )}

          {borrador.pilar === 'servicios' && enum_ && (
            <Seccion titulo="Forma de cobro">
              <GrupoEnum
                etiquetas={enum_.modalidadCobro}
                valor={borrador.modalidadCobro}
                onCambio={(v) => poner({ modalidadCobro: v as FiltrosUrl['modalidadCobro'] })}
              />
            </Seccion>
          )}

          {borrador.pilar === 'empleo' && enum_ && (
            <>
              <Seccion titulo="Jornada">
                <GrupoEnum
                  etiquetas={enum_.jornada}
                  valor={borrador.jornada}
                  onCambio={(v) => poner({ jornada: v as FiltrosUrl['jornada'] })}
                />
              </Seccion>
              <Seccion titulo="Modalidad">
                <GrupoEnum
                  etiquetas={enum_.modalidad}
                  valor={borrador.modalidad}
                  onCambio={(v) => poner({ modalidad: v as FiltrosUrl['modalidad'] })}
                />
              </Seccion>
            </>
          )}

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 py-3.5">
            <span>
              <span className="block text-[14px] font-medium text-foreground">Solo con fotos</span>
              <span className="block text-[12.5px] text-muted">Oculta los anuncios sin imagen.</span>
            </span>
            <input
              type="checkbox"
              checked={borrador.conFoto}
              onChange={(e) => poner({ conFoto: e.target.checked })}
              className="size-5 accent-accent"
            />
          </label>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setBorrador({ ...FILTROS_VACIOS, q: borrador.q })}
            className="h-12 flex-1 rounded-xl border border-border text-[14.5px] font-semibold text-foreground transition-colors hover:border-muted"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => onAplicar(borrador)}
            className="h-12 flex-[2] rounded-xl bg-accent text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}

const SELECT =
  'h-11 w-full rounded-lg border border-border bg-white px-3 text-[14.5px] text-foreground focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:bg-background disabled:text-muted';

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[14px] font-semibold text-foreground">{titulo}</h3>
      {ayuda && (
        <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-muted">
          <span className="mt-px shrink-0 [&>svg]:size-3.5">
            <IconoPin />
          </span>
          {ayuda}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Chip({
  activo,
  onClick,
  deshabilitado = false,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  deshabilitado?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={activo}
      className={
        activo
          ? 'h-9 rounded-full border border-transparent bg-foreground px-4 text-[13px] font-semibold text-white disabled:opacity-60'
          : 'h-9 rounded-full border border-border bg-white px-4 text-[13px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-60'
      }
    >
      {children}
    </button>
  );
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={
        activo
          ? 'flex h-11 items-center gap-3 rounded-lg border border-accent bg-accent/[0.06] px-3.5 text-left text-[14px] font-semibold text-foreground'
          : 'flex h-11 items-center gap-3 rounded-lg border border-border px-3.5 text-left text-[14px] text-foreground transition-colors hover:border-muted'
      }
    >
      <span
        aria-hidden="true"
        className={
          activo
            ? 'grid size-4 place-items-center rounded-full border-[5px] border-accent'
            : 'size-4 rounded-full border border-muted/60'
        }
      />
      {children}
    </button>
  );
}

function CampoPrecio({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: number | null;
  onCambio: (v: number | null) => void;
}) {
  return (
    <label className="relative block flex-1">
      <span className="sr-only">{etiqueta}</span>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted">$</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={etiqueta}
        value={valor ?? ''}
        onChange={(e) => {
          const n = e.target.value === '' ? null : Number(e.target.value);
          onCambio(n !== null && Number.isFinite(n) && n >= 0 ? n : null);
        }}
        className="h-11 w-full rounded-lg border border-border bg-white pr-3 pl-7 text-[14.5px] text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
      />
    </label>
  );
}

function GrupoEnum({
  etiquetas,
  valor,
  onCambio,
}: {
  etiquetas: Record<string, string>;
  valor: string | null;
  onCambio: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip activo={valor === null} onClick={() => onCambio(null)}>
        Cualquiera
      </Chip>
      {Object.entries(etiquetas).map(([clave, texto]) => (
        <Chip key={clave} activo={valor === clave} onClick={() => onCambio(valor === clave ? null : clave)}>
          {texto}
        </Chip>
      ))}
    </div>
  );
}
