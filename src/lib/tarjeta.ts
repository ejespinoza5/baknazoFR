import type { Pilar } from './pilares';

/**
 * Datos que una tarjeta de anuncio necesita, ya traducidos a texto.
 *
 * "Lo que la tarjeta necesita mostrar" es un recorte deliberado: la tarjeta no
 * recibe el `Anuncio` completo, sino solo los campos que pinta. Así el feed y
 * "mis anuncios" comparten el formateo sin compartir la superficie de la API,
 * que cambia (los `items` de /mios traen `estado`, `vistas` y `contactos`, y el
 * feed además `distanciaKm`).
 *
 * Los campos de la cabecera son opcionales a propósito: son lo único que la
 * vista de lista necesita y lo único que el listado puede no traer. La rejilla
 * no los mira, así que una tarjeta sin ellos sigue siendo válida.
 */
export interface AnuncioTarjeta {
  id: number;
  titulo: string;
  precio: string;
  ubicacion: string;
  pilar: Pilar;
  cercano: boolean;
  foto: string | null;
  /**
   * Lo que la API calculó al listar. La tarjeta no lo pinta, pero la ficha del
   * anuncio sí ("a 1,2 km de ti"), y volver a pedirlo al abrir sería tirar la
   * información que ya venía en la respuesta.
   */
  distanciaKm?: number | null;
  /**
   * Si el anuncio es de quien lo está viendo. La lista lo usa para no ofrecerle un
   * chat con su propio anuncio. Viene `false` mientras el Backend no lo mande, y
   * entonces el chat se enseña igual: es preferible offered de más que un botón
   * que aparece y desaparece según la versión del servidor.
   */
  esMio?: boolean;
  /** Quién publicó: la cabecera de la vista de lista. */
  autor?: {
    /**
     * El id de la cuenta, para abrir su perfil.
     *
     * Opcional porque la API en producción todavía no lo manda; mientras no,
     * quien llama usa el id del anuncio como clave del perfil.
     */
    id?: string;
    nombre: string;
    /** Foto de la persona, o el logo si quien publica es un negocio. */
    foto: string | null;
    verificado: boolean;
    esNegocio: boolean;
  };
  /** El texto de la publicación. En rejilla no cabe; en lista sí. */
  descripcion?: string | null;
  /**
   * Todas las fotos, no solo la portada: la vista de lista enseña la publicación
   * entera. Sin ellas se cae a la portada, que es lo que hay en `foto`.
   */
  fotos?: { url: string; ancho: number; alto: number }[];
  /** Los contadores que la ficha muestra al pie. */
  vistas?: number;
  contactos?: number;
  /** Si el backend permite revelar el número de este anuncio ahora mismo. */
  puedeVerTelefono?: boolean;
  /** El dueño activó mostrar su número. La tarjeta se lo confirma al abrirla. */
  mostrarTelefono?: boolean;
  /**
   * Likes y si le gusta a quien mira.
   *
   * Opcionales porque la tarjeta se usa también en la vista previa de un
   * borrador recién creado, que aún no está en ningún listado y no tiene likes
   * que mostrar: sin ellos, el pulgar no se pinta.
   */
  likes?: number;
  meGusta?: boolean;
  /** Vendido. En el feed nunca llega; en "mis anuncios" es lo que se ve. */
  vendido?: boolean;
  /** Nombre de la categoría, para la línea de contexto de la cabecera. */
  categoria?: string;
  /** Los campos del pilar ("NUEVO", "POR_HORA"), sin traducir. */
  detalle?: Record<string, string | null | undefined>;
  publicadoEn?: string | null;
}

/**
 * El precio llega como texto ("320.00") o null. `null` es "a convenir", que es
 * un precio válido y no un dato faltante: la tarjeta lo dice explícito.
 */
export function formatearPrecio(precio: string | null, pilar: Pilar): string {
  if (precio === null) {
    return pilar === 'empleo' ? 'Salario a convenir' : 'Precio a convenir';
  }
  const numero = Number(precio);
  if (!Number.isFinite(numero)) return precio;
  return `$${numero.toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "Quito · La Floresta". Sin sector, solo la ciudad. */
export function formatearUbicacion(ubicacion: string, sector: string | null): string {
  return sector ? `${ubicacion} · ${sector}` : ubicacion;
}

/**
 * "12 mar 2026". Un texto corto y fijo: cabe en el pie de la tarjeta sin
 * empujar el título a dos líneas.
 */
export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * "hace 3 h", como la línea de tiempo de una publicación. A partir de un mes
 * delego en la fecha: "hace 47 días" no ayuda a nadie.
 */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const minutos = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000));
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `hace ${dias} d`;
  return formatearFecha(iso);
}

/**
 * Los textos de los valores de `detalle` ("NUEVO", "POR_HORA") viven en
 * `/api/catalogos`, pero ni la ficha ni la tarjeta en lista pueden depender de
 * una segunda petición: si el catálogo falla, el anuncio se vería a medias. Aquí
 * se fijan y, si el backend agrega un valor nuevo, se muestra legible ("Tiempo
 * completo") en vez del código en crudo ("TIEMPO_COMPLETO").
 */
const ETIQUETA_VALOR: Record<string, string> = {
  NUEVO: 'Nuevo',
  USADO: 'Usado',
  POR_PROYECTO: 'Por proyecto',
  POR_HORA: 'Por hora',
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_TEMPORADA: 'Por temporada',
  REMOTO: 'Remoto',
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
};

export function valorLegible(codigo: string): string {
  return (
    ETIQUETA_VALOR[codigo] ??
    codigo.charAt(0).toUpperCase() + codigo.slice(1).toLowerCase().replace(/_/g, ' ')
  );
}

/**
 * Cómo se lee el número de likes: "Te gusta", "Tú y 3 más" o "12 me gusta".
 *
 * El caso intermedio importa más de lo que parece: si eres el único al que le
 * gusta, "Tú y 0 más" se lee como que hay alguien más y no es cierto. Facebook
 * pone "Te gusta" a secas ahí, y es lo que se hace.
 */
export function resumenDeLikes(likes: number, meGusta: boolean): string {
  if (meGusta) return likes <= 1 ? 'Te gusta' : `Tú y ${likes - 1} más`;
  return likes === 1 ? '1 me gusta' : `${likes.toLocaleString('es-EC')} te gusta`;
}

/** "1 vista" / "24 vistas". Los contadores se leen de uno en uno. */
export function plural(n: number, uno: string, varios: string): string {
  return `${n.toLocaleString('es-EC')} ${n === 1 ? uno : varios}`;
}

/** "MP" de "María Pérez": dos iniciales, nunca más. */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primera = partes[0].charAt(0);
  const segunda = partes.length > 1 ? partes[1].charAt(0) : '';
  return (primera + segunda).toUpperCase();
}

/**
 * Colores del distintivo de estado. Vive aquí y no en la tarjeta porque lo usan
 * dos sitios (la tarjeta y la ficha del anuncio) y un archivo que exporta
 * componentes y constantes a la vez rompe el fast refresh.
 */
export type TonoEstado = 'neutro' | 'exito' | 'aviso' | 'peligro';

export const TONO_ESTADO: Record<TonoEstado, string> = {
  neutro: 'bg-medio/10 text-foreground',
  exito: 'bg-success/10 text-success-deep',
  aviso: 'bg-warning/10 text-warning-deep',
  peligro: 'bg-danger/10 text-danger-deep',
};
