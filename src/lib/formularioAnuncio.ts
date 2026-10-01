import type { Pilar } from './pilares';
import type {
  Anuncio,
  Detalle,
  DetalleEmpleo,
  DetalleProducto,
  DetalleServicio,
} from '../types/anuncio';

/**
 * El formulario de un anuncio, compartido por publicar y editar.
 *
 * Vive aquí y no dentro de `PublicarScreen` porque las dos pantallas escriben
 * exactamente los mismos campos contra las mismas reglas: si el formulario
 * viviera duplicado, cambiar un texto, un límite o un chip en un sitio dejaría
 * al otro desactualizado, y el anuncio se vería distinto según por dónde se
 * escribió.
 *
 * Lo que NO se comparte es la foto: al publicar solo hay archivos nuevos, y al
 * editar hay archivos ya guardados que se conservan, se reordenan o se borran.
 * Esa diferencia la resuelve cada pantalla (ver `HuecosFoto` y `GaleriaFoto`).
 */

export type ClaveDetalle = 'condicion' | 'modalidadCobro' | 'jornada' | 'modalidad';

export type ErrorCampo =
  | 'titulo'
  | 'categoria'
  | 'ciudad'
  | 'precio'
  | 'fotos'
  | ClaveDetalle;

export interface Formulario {
  titulo: string;
  categoriaId: number | '';
  cantonCodigo: string;
  descripcion: string;
  precio: string;
  condicion: string;
  modalidadCobro: string;
  jornada: string;
  modalidad: string;
  /** Solo al publicar: al editar las fotos guardadas no son `File`. */
  fotos: (File | null)[];
  /**
   * Si este anuncio enseña el teléfono de quien lo publica.
   *
   * Viene del perfil (Configuración) al publicar y del propio anuncio al
   * editar, pero en los dos casos es una decisión de este anuncio: el valor por
   * defecto se puede apagar en uno solo sin tocar los demás.
   */
  mostrarTelefono: boolean;
}

/* ---------- Reglas que dicta la API ---------- */

export const TITULO_MIN = 5;
export const TITULO_MAX = 120;

/** Qué pide el backend en el `detalle` de cada pilar. */
export const DETALLE_POR_PILAR: Record<Pilar, ClaveDetalle[]> = {
  productos: ['condicion'],
  servicios: ['modalidadCobro'],
  empleo: ['jornada', 'modalidad'],
};

export const ETIQUETA_DETALLE: Record<ClaveDetalle, string> = {
  condicion: 'Condición',
  modalidadCobro: 'Modalidad de cobro',
  jornada: 'Jornada',
  modalidad: 'Modalidad de trabajo',
};

export const PRECIO: Record<Pilar, { etiqueta: string; placeholder: string }> = {
  productos: { etiqueta: 'Precio (USD)', placeholder: '0.00' },
  servicios: { etiqueta: 'Precio desde (USD)', placeholder: '0.00' },
  empleo: { etiqueta: 'Salario mensual (USD)', placeholder: '500' },
};

/**
 * `mostrarTelefono` sale del perfil, no de la nada: quien ya dijo en
 * Configuración que quiere mostrarlo no debería tener que volver a marcarlo en
 * cada anuncio. Publicar y editar pasan aquí su valor por defecto.
 */
export const formularioVacio = (
  maxFotos: number,
  mostrarTelefono = false
): Formulario => ({
  titulo: '',
  categoriaId: '',
  cantonCodigo: '',
  descripcion: '',
  precio: '',
  condicion: '',
  modalidadCobro: '',
  jornada: '',
  modalidad: '',
  fotos: Array.from({ length: maxFotos }, () => null),
  mostrarTelefono,
});

/**
 * Rellena el formulario con lo que ya tiene el anuncio.
 *
 * El precio viene del servidor como texto ("320.00" o `null`); se copia tal
 * cual para no perder los decimales que el usuario escribió y el backend
 * formateó.
 */
export function formularioDesdeAnuncio(anuncio: Anuncio, maxFotos: number): Formulario {
  const detalle = anuncio.detalle as Partial<Detalle>;
  return {
    titulo: anuncio.titulo,
    categoriaId: anuncio.categoria?.id ?? '',
    cantonCodigo: anuncio.cantonCodigo,
    descripcion: anuncio.descripcion ?? '',
    precio: anuncio.precio ?? '',
    condicion: 'condicion' in detalle ? String(detalle.condicion ?? '') : '',
    modalidadCobro:
      'modalidadCobro' in detalle ? String(detalle.modalidadCobro ?? '') : '',
    jornada: 'jornada' in detalle ? String(detalle.jornada ?? '') : '',
    modalidad: 'modalidad' in detalle ? String(detalle.modalidad ?? '') : '',
    fotos: Array.from({ length: maxFotos }, () => null),
    // Un anuncio guardado antes de que existiera este campo no trae nada: se
    // deja en `false`, que es lo más prudente cuando se trata de un teléfono.
    mostrarTelefono: anuncio.mostrarTelefono ?? false,
  };
}

/** En productos la foto es obligatoria; en servicios y empleo, no. */
export function fotoObligatoria(pilar: Pilar): boolean {
  return pilar === 'productos';
}

/**
 * Convierte `errores` del 422 a los campos del formulario. El backend devuelve
 * una clave por campo de su modelo (categoriaId, detalle.condicion) y aquí se
 * traduce a los nombres que usa el formulario. Sin este mapa, un error de
 * validación solo podría mostrarse como un toast genérico.
 */
export function mapearErrores(
  errores: Partial<Record<string, string>>
): Partial<Record<ErrorCampo, string>> {
  const destino: Partial<Record<ErrorCampo, string>> = {};
  const pares: [string, ErrorCampo][] = [
    ['titulo', 'titulo'],
    ['categoriaId', 'categoria'],
    ['cantonCodigo', 'ciudad'],
    ['precio', 'precio'],
    ['fotos', 'fotos'],
    ['detalle.condicion', 'condicion'],
    ['detalle.modalidadCobro', 'modalidadCobro'],
    ['detalle.jornada', 'jornada'],
    ['detalle.modalidad', 'modalidad'],
  ];
  for (const [origen, campo] of pares) {
    if (errores[origen]) destino[campo] = errores[origen];
  }
  return destino;
}

/** El backend acepta "320,50" y "320.50"; se normaliza a punto. */
export function normalizarPrecio(valor: string): string | null {
  const limpio = valor.trim().replace(',', '.');
  if (!limpio) return null;
  return Number.isFinite(Number(limpio)) ? limpio : valor.trim();
}

/** El `detalle` completo del pilar, para crear o para un PATCH. */
export function detalleDeFormulario(pilar: Pilar, form: Formulario): Detalle {
  if (pilar === 'productos') {
    return { condicion: form.condicion as DetalleProducto['condicion'] };
  }
  if (pilar === 'servicios') {
    return {
      modalidadCobro: form.modalidadCobro as DetalleServicio['modalidadCobro'],
    };
  }
  return {
    jornada: form.jornada as DetalleEmpleo['jornada'],
    modalidad: form.modalidad as DetalleEmpleo['modalidad'],
  };
}

/**
 * Lo que el formulario no deja enviar.
 *
 * El backend vuelve a validarlo todo, pero avisar aquí evita el viaje de ida y
 * vuelta por un 422 y, sobre todo, permite señalar el campo en pantalla. Las
 * reglas viven una sola vez: publicar y editar validan con la misma función, así
 * que no pueden empezar a discrepar.
 *
 * `cuantoFotos` lo cuenta cada pantalla a su manera: al publicar son los
 * archivos elegidos, al editar las conservadas más las nuevas.
 */
export function validarFormulario(
  form: Formulario,
  pilar: Pilar,
  cuantoFotos: number
): Partial<Record<ErrorCampo, string>> {
  const found: Partial<Record<ErrorCampo, string>> = {};

  const titulo = form.titulo.trim();
  if (!titulo) found.titulo = 'Ponle un título a tu anuncio.';
  else if (titulo.length < TITULO_MIN)
    found.titulo = `El título necesita al menos ${TITULO_MIN} caracteres.`;

  if (form.categoriaId === '') found.categoria = 'Elige una categoría.';
  if (!form.cantonCodigo) found.ciudad = 'Elige una ciudad.';

  // El precio es opcional en los tres tipos: vacío significa "a convenir".
  if (form.precio.trim() && !Number.isFinite(Number(normalizarPrecio(form.precio))))
    found.precio = 'Escribe un número, por ejemplo 320 o 320.50.';

  for (const clave of DETALLE_POR_PILAR[pilar]) {
    if (!form[clave]) found[clave] = `Elige ${ETIQUETA_DETALLE[clave].toLowerCase()}.`;
  }

  if (fotoObligatoria(pilar) && cuantoFotos === 0)
    found.fotos = 'Un producto necesita al menos una foto.';

  return found;
}
