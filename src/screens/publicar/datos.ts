import { PROVINCIAS_EC } from '../../data/ecuador';
import type { Catalogos, Categoria } from '../../types/anuncio';
import type { Pilar } from '../../lib/pilares';

/**
 * Respaldo de los catálogos.
 *
 * La fuente real es GET /api/catalogos. Esto se usa solo si la API no
 * responde, para que la pantalla siga siendo usable en desarrollo y en la demo
 * sin backend. Cuando la API responda, estas listas no se usan.
 */

export const CATEGORIAS_DEMO: string[] = [
  'Tecnología',
  'Vehículos',
  'Hogar y Electrodomésticos',
  'Moda',
  'Inmuebles',
  'Entretenimiento',
  'Deportes',
  'Construcción y herramientas',
  'Otros',
];

/** Cantones de todo el país, sin repetir y en orden alfabético. */
export const CIUDADES_DEMO: string[] = [
  ...new Set(Object.values(PROVINCIAS_EC).flat()),
].sort((a, b) => a.localeCompare(b, 'es'));

export const CONDICIONES_DEMO = { NUEVO: 'Nuevo', USADO: 'Usado' } as const;

export const MODALIDADES_COBRO_DEMO = {
  POR_PROYECTO: 'Por proyecto',
  POR_HORA: 'Por hora',
} as const;

export const JORNADAS_DEMO = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_TEMPORADA: 'Por temporada',
} as const;

export const MODALIDADES_DEMO = {
  REMOTO: 'Remoto',
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
} as const;

/** Un ejemplo de título por tipo: orienta sin imponer el formato. */
export const EJEMPLO_TITULO: Record<Pilar, string> = {
  productos: 'Ej. iPhone 13 128GB, poco uso',
  servicios: 'Ej. Diseño de logos e identidad visual',
  empleo: 'Ej. Se busca community manager',
};

export const MAX_FOTOS = 6;
export const MAX_BYTES_FOTO = 8 * 1024 * 1024;
export const FORMATOS_FOTO = /\.(jpe?g|png|webp|avif)$/i;

/* ---------- Catálogo de respaldo ---------- */

function categoriasDemo(): Categoria[] {
  return CATEGORIAS_DEMO.map((nombre, indice) => ({
    id: indice + 1,
    slug: nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    nombre,
    pilar: 'productos' as Pilar,
  }));
}

/**
 * Rellena un catálogo mínimo para que el formulario siga siendo usable si la
 * API no responde.
 *
 * OJO: aquí los códigos son sintéticos, no los INEC. `PROVINCIAS_EC` solo
 * tiene nombres, así que sin backend no hay forma de derivar '170101'. El
 * `codigo` del cantón es su propio nombre. Sirve para probar la pantalla, no
 * para publicar: sin API no hay nada a lo que enviarlo.
 */
export function catalogosDeRespaldo(): Catalogos {
  const provincias = Object.entries(PROVINCIAS_EC).map(
    ([nombre, cantones], indice) => ({
      codigo: String(indice + 1).padStart(2, '0'),
      nombre,
      cantones: cantones.map((nombreCanton) => ({
        codigo: nombreCanton,
        nombre: nombreCanton,
      })),
    })
  );

  return {
    categorias: categoriasDemo(),
    provincias,
    enumeraciones: {
      condicion: { ...CONDICIONES_DEMO },
      modalidadCobro: { ...MODALIDADES_COBRO_DEMO },
      jornada: { ...JORNADAS_DEMO },
      modalidad: { ...MODALIDADES_DEMO },
    },
    maxFotos: MAX_FOTOS,
    maxBytesFoto: MAX_BYTES_FOTO,
  };
}
