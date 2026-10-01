import type { Pilar } from './pilares';
import type {
  DetalleEmpleo,
  DetalleProducto,
  DetalleServicio,
  FiltrosFeed,
  OrdenFeed,
} from '../types/anuncio';

/**
 * Los filtros del feed viven en la URL (`/anuncios?pilar=empleo&precioMax=500`).
 *
 * Así una búsqueda se puede compartir o guardar, el botón de atrás deshace el
 * último filtro, y un F5 no los pierde. La ubicación exacta NO va en la URL
 * (se compartiría con el enlace): solo el radio, `cerca=10`; las coordenadas
 * las guarda `lib/ubicacion` en la pestaña.
 */
export interface FiltrosUrl {
  q: string;
  pilar: Pilar | null;
  categoria: number | null;
  provincia: string | null;
  canton: string | null;
  precioMin: number | null;
  precioMax: number | null;
  orden: OrdenFeed;
  /** Radio en km de "Cerca de ti". Con él, el orden pasa a ser por distancia. */
  cerca: number | null;
  condicion: DetalleProducto['condicion'] | null;
  modalidadCobro: DetalleServicio['modalidadCobro'] | null;
  jornada: DetalleEmpleo['jornada'] | null;
  modalidad: DetalleEmpleo['modalidad'] | null;
  conFoto: boolean;
}

export const FILTROS_VACIOS: FiltrosUrl = {
  q: '',
  pilar: null,
  categoria: null,
  provincia: null,
  canton: null,
  precioMin: null,
  precioMax: null,
  orden: 'recientes',
  cerca: null,
  condicion: null,
  modalidadCobro: null,
  jornada: null,
  modalidad: null,
  conFoto: false,
};

export const RADIOS_KM = [5, 10, 25, 50, 100] as const;

const PILARES: Pilar[] = ['productos', 'servicios', 'empleo'];
const ORDENES: OrdenFeed[] = ['recientes', 'cercanos', 'precio_asc', 'precio_desc', 'relevancia'];

const numero = (valor: string | null): number | null => {
  if (valor === null || valor.trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const deLista = <T extends string>(valor: string | null, lista: readonly T[]): T | null =>
  valor !== null && (lista as readonly string[]).includes(valor) ? (valor as T) : null;

/**
 * El orden que se usa si no se eligió otro: con una búsqueda, lo más parecido
 * a lo escrito primero (como cualquier buscador); sin ella, lo más reciente.
 */
export const ordenPorDefecto = (q: string): OrdenFeed => (q.trim() ? 'relevancia' : 'recientes');

/** Los órdenes que tiene sentido ofrecer: "Más relevantes" solo con búsqueda. */
export function ordenesDisponibles(q: string): (keyof typeof ETIQUETA_ORDEN)[] {
  const todos = Object.keys(ETIQUETA_ORDEN) as (keyof typeof ETIQUETA_ORDEN)[];
  return q.trim() ? todos : todos.filter((o) => o !== 'relevancia');
}

export function leerFiltros(p: URLSearchParams): FiltrosUrl {
  const pilar = deLista(p.get('pilar'), PILARES);
  const cerca = numero(p.get('cerca'));
  const q = (p.get('q') ?? '').slice(0, 100);
  return {
    q,
    pilar,
    categoria: numero(p.get('categoria')),
    provincia: /^\d{2}$/.test(p.get('provincia') ?? '') ? p.get('provincia') : null,
    canton: /^\d{6}$/.test(p.get('canton') ?? '') ? p.get('canton') : null,
    precioMin: numero(p.get('precioMin')),
    precioMax: numero(p.get('precioMax')),
    orden: cerca ? 'cercanos' : (deLista(p.get('orden'), ORDENES) ?? ordenPorDefecto(q)),
    cerca: cerca && cerca > 0 ? Math.min(cerca, 500) : null,
    // Los filtros de detalle solo valen con su pilar: sin él se descartan.
    condicion: pilar === 'productos' ? deLista(p.get('condicion'), ['NUEVO', 'USADO'] as const) : null,
    modalidadCobro:
      pilar === 'servicios' ? deLista(p.get('modalidadCobro'), ['POR_PROYECTO', 'POR_HORA'] as const) : null,
    jornada:
      pilar === 'empleo'
        ? deLista(p.get('jornada'), ['TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'POR_TEMPORADA'] as const)
        : null,
    modalidad:
      pilar === 'empleo' ? deLista(p.get('modalidad'), ['REMOTO', 'PRESENCIAL', 'HIBRIDO'] as const) : null,
    conFoto: p.get('conFoto') === '1',
  };
}

export function escribirFiltros(f: FiltrosUrl): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.pilar) p.set('pilar', f.pilar);
  if (f.categoria) p.set('categoria', String(f.categoria));
  if (f.provincia) p.set('provincia', f.provincia);
  if (f.canton) p.set('canton', f.canton);
  if (f.precioMin !== null) p.set('precioMin', String(f.precioMin));
  if (f.precioMax !== null) p.set('precioMax', String(f.precioMax));
  if (f.cerca) p.set('cerca', String(f.cerca));
  // El orden solo va en la URL si no es el de por defecto (y si tiene sentido).
  else if (
    f.orden !== 'cercanos' &&
    f.orden !== ordenPorDefecto(f.q) &&
    !(f.orden === 'relevancia' && !f.q.trim())
  )
    p.set('orden', f.orden);
  if (f.pilar === 'productos' && f.condicion) p.set('condicion', f.condicion);
  if (f.pilar === 'servicios' && f.modalidadCobro) p.set('modalidadCobro', f.modalidadCobro);
  if (f.pilar === 'empleo' && f.jornada) p.set('jornada', f.jornada);
  if (f.pilar === 'empleo' && f.modalidad) p.set('modalidad', f.modalidad);
  if (f.conFoto) p.set('conFoto', '1');
  return p;
}

/** Cambiar de pilar suelta lo que solo valía para el anterior. */
export function conPilar(f: FiltrosUrl, pilar: Pilar | null): FiltrosUrl {
  return {
    ...f,
    pilar,
    categoria: null,
    condicion: null,
    modalidadCobro: null,
    jornada: null,
    modalidad: null,
  };
}

/** Cuántos filtros del panel hay puestos (sin contar búsqueda ni pilar). */
export function contarFiltros(f: FiltrosUrl): number {
  return [
    f.categoria,
    f.canton ?? f.provincia,
    f.precioMin,
    f.precioMax,
    f.cerca,
    f.condicion,
    f.modalidadCobro,
    f.jornada,
    f.modalidad,
    f.conFoto || null,
    f.orden === 'precio_asc' || f.orden === 'precio_desc' ? f.orden : null,
  ].filter((v) => v !== null && v !== undefined).length;
}

/** Lo que se manda a la API, sin cursor. */
export function aConsulta(
  f: FiltrosUrl,
  punto: { lat: number; lng: number } | null
): FiltrosFeed {
  const cerca = f.cerca !== null && punto !== null;
  return {
    q: f.q.trim() || undefined,
    pilar: f.pilar ?? undefined,
    categoria: f.categoria ?? undefined,
    provincia: f.canton ? undefined : (f.provincia ?? undefined),
    canton: f.canton ?? undefined,
    precioMin: f.precioMin ?? undefined,
    precioMax: f.precioMax ?? undefined,
    condicion: f.condicion ?? undefined,
    modalidadCobro: f.modalidadCobro ?? undefined,
    jornada: f.jornada ?? undefined,
    modalidad: f.modalidad ?? undefined,
    conFoto: f.conFoto || undefined,
    orden: cerca
      ? 'cercanos'
      : f.orden === 'cercanos'
        ? ordenPorDefecto(f.q)
        : f.orden === 'relevancia' && !f.q.trim()
          ? 'recientes'
          : f.orden,
    lat: cerca ? punto.lat : undefined,
    lng: cerca ? punto.lng : undefined,
    radioKm: cerca ? (f.cerca ?? undefined) : undefined,
  };
}

export const ETIQUETA_ORDEN: Record<Exclude<OrdenFeed, 'cercanos'>, string> = {
  relevancia: 'Más relevantes',
  recientes: 'Más recientes',
  precio_asc: 'Precio: menor a mayor',
  precio_desc: 'Precio: mayor a menor',
};

/** Rangos de precio de un toque, según lo que se busca. */
export const RANGOS_PRECIO: Record<Pilar | 'todos', { etiqueta: string; min: number | null; max: number | null }[]> = {
  todos: [
    { etiqueta: 'Hasta $50', min: null, max: 50 },
    { etiqueta: '$50 a $200', min: 50, max: 200 },
    { etiqueta: '$200 a $1.000', min: 200, max: 1000 },
    { etiqueta: 'Más de $1.000', min: 1000, max: null },
  ],
  productos: [
    { etiqueta: 'Hasta $50', min: null, max: 50 },
    { etiqueta: '$50 a $200', min: 50, max: 200 },
    { etiqueta: '$200 a $1.000', min: 200, max: 1000 },
    { etiqueta: 'Más de $1.000', min: 1000, max: null },
  ],
  servicios: [
    { etiqueta: 'Hasta $20', min: null, max: 20 },
    { etiqueta: '$20 a $100', min: 20, max: 100 },
    { etiqueta: 'Más de $100', min: 100, max: null },
  ],
  empleo: [
    { etiqueta: 'Desde $470', min: 470, max: null },
    { etiqueta: 'Desde $800', min: 800, max: null },
    { etiqueta: 'Desde $1.500', min: 1500, max: null },
  ],
};
