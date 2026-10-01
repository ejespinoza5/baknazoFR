import type { Pilar } from '../lib/pilares';

/**
 * Tipos del contrato de anuncios.
 *
 * El precio viaja siempre como texto ("320.00") y `null` significa "a
 * convenir". Es deliberado: un número en JSON.parse pasa por coma flotante y
 * "0.1 + 0.2" terminaría en la conciliación de pagos.
 */

export type EstadoAnuncio =
  | 'BORRADOR'
  | 'PUBLICADO'
  | 'PAUSADO'
  | 'RECHAZADO'
  | 'ELIMINADO';

/** Solo estos dos se pueden pedir en un PATCH. */
export type EstadoEditable = Extract<EstadoAnuncio, 'PUBLICADO' | 'PAUSADO'>;

export interface Categoria {
  id: number;
  slug: string;
  nombre: string;
  pilar: Pilar;
}

export interface Canton {
  codigo: string;
  nombre: string;
}

export interface Provincia {
  codigo: string;
  nombre: string;
  cantones: Canton[];
}

/** Etiquetas de las enumeraciones: el backend es quien manda los textos. */
export type Etiquetas = Record<string, string>;

export interface Catalogos {
  categorias: Categoria[];
  provincias: Provincia[];
  enumeraciones: {
    condicion: Etiquetas;
    modalidadCobro: Etiquetas;
    jornada: Etiquetas;
    modalidad: Etiquetas;
  };
  maxFotos: number;
  maxBytesFoto: number;
}

export interface FotoAnuncio {
  id: number;
  url: string;
  ancho: number;
  alto: number;
  orden: number;
}

export interface Portada {
  url: string;
  ancho: number;
  alto: number;
}

export interface Autor {
  /**
   * El id de la cuenta, para abrir su perfil.
   *
   * Opcional a propósito: la API en producción todavía no lo manda, y mientras no
   * lo haga la app usa el id del anuncio como clave del perfil en vez de dejar el
   * nombre sin destino. En cuanto llegue, se usa este y el respaldo sobra.
   */
  id?: string;
  nombre: string;
  foto: string | null;
  verificado: boolean;
  esNegocio: boolean;
  /** Solo si el autor es un negocio. */
  whatsapp?: string | null;
}

export type DetalleProducto = { condicion: 'NUEVO' | 'USADO' };
export type DetalleServicio = {
  modalidadCobro: 'POR_PROYECTO' | 'POR_HORA';
  zonaCobertura?: string | null;
};
export type DetalleEmpleo = {
  jornada: 'TIEMPO_COMPLETO' | 'MEDIO_TIEMPO' | 'POR_TEMPORADA';
  modalidad: 'REMOTO' | 'PRESENCIAL' | 'HIBRIDO';
};

export type Detalle = DetalleProducto | DetalleServicio | DetalleEmpleo;

export interface Anuncio {
  id: number;
  slug: string;
  pilar: Pilar;
  titulo: string;
  descripcion: string | null;
  precio: string | null;
  moneda: string;
  ubicacion: string;
  provincia: string;
  cantonCodigo: string;
  provinciaCodigo: string;
  sector: string | null;
  categoria: Categoria;
  portada: Portada | null;
  fotos: FotoAnuncio[];
  detalle: Detalle;
  estado: EstadoAnuncio;
  vistas: number;
  contactos: number;
  publicadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  autor: Autor;
  esMio: boolean;
  /**
   * Lo que eligió el dueño de este anuncio: mostrar su número o no.
   *
   * No es un dato personal, es una decisión, así que viaja siempre y también en
   * el listado. El número en sí nunca viaja aquí: sale solo de
   * `POST /api/anuncios/:id/contacto`.
   */
  mostrarTelefono?: boolean;
  /**
   * Si un desconocido puede revelar el número *ahora mismo*. El backend lo
   * apaga cuando el dueño no lo marcó, cuando no tiene número, o cuando el
   * anuncio no está publicado. Es lo que decide si se pinta el botón de teléfono.
   */
  telefonoVisible?: boolean;
  /**
   * Si el dueño ya lo sold.
   *
   * No es un estado a propósito: un anuncio puede estar pausado y vendido a la
   * vez, o publicado y vendido, y con un solo `estado` se perdería una de las dos
   * cosas. Viaja aparte y el backend lo saca del feed.
   */
  vendido?: boolean;
  vendidoEn?: string | null;
  /**
   * Cuántas personas le dieron like, y si a quien mira le gusta.
   *
   * Van los dos juntos porque la tarjeta siempre muestra la cifra y solo entonces
   * sabe si el pulgar va lleno: con solo el número, al pintar el icono de "me
   * gusta" habría que adivinar.
   */
  likes?: number;
  meGusta?: boolean;
  /** Solo su dueño las recibe; el público solo ve `distanciaKm`. */
  latitud?: number | null;
  longitud?: number | null;
  notasModeracion?: string | null;
  /** Si quien mira lo tiene en Guardados. */
  guardado?: boolean;
  /** Solo empleo y solo al dueño: cuántas postulaciones tiene. */
  postulaciones?: { total: number; nuevas: number };
  /** Solo empleo y solo a quien no es el dueño: si ya se postuló. */
  miPostulacion?: { id: number; estado: EstadoPostulacion; creadoEn: string } | null;
}

/* ---------- Postulaciones ---------- */

export type EstadoPostulacion =
  | 'NUEVA'
  | 'VISTA'
  | 'PRESELECCIONADA'
  | 'DESCARTADA'
  | 'CONTRATADA';

/** Lo que ve el dueño de la vacante. */
export interface PostulacionRecibida {
  id: number;
  estado: EstadoPostulacion;
  mensaje: string | null;
  telefono: string | null;
  notaInterna: string | null;
  creadoEn: string;
  actualizadoEn: string;
  cv: { nombre: string; bytes: number };
  anuncio: { id: number; titulo: string };
  postulante: { id: string; nombre: string; foto: string | null; correo: string };
}

/** Lo que ve quien se postuló (sin la nota interna del empleador). */
export interface PostulacionEnviada {
  id: number;
  estado: EstadoPostulacion;
  mensaje: string | null;
  creadoEn: string;
  actualizadoEn: string;
  cv: { nombre: string; bytes: number };
  anuncio: { id: number; titulo: string; abierta: boolean };
  empleador: { id: string; nombre: string; foto: string | null };
}

export interface RespuestaRecibidas {
  items: PostulacionRecibida[];
  hayMas: boolean;
  resumen: {
    porEstado: Partial<Record<EstadoPostulacion, number>>;
    vacantes: { id: number; titulo: string; abierta: boolean; total: number; nuevas: number }[];
  };
}

export interface RespuestaEnviadas {
  items: PostulacionEnviada[];
  hayMas: boolean;
}

/** El feed agrega la distancia, calculada con las coordenadas del usuario. */
export interface AnuncioFeed extends Anuncio {
  distanciaKm: number | null;
  /** Si el anuncio es de quien está mirando. Sin sesión llega false. */
  esMio: boolean;
}

export interface RespuestaCrear {
  slug: string;
  estado: EstadoAnuncio;
  publicadoEn: string | null;
  anuncio: Anuncio;
}

export interface RespuestaFeed {
  items: AnuncioFeed[];
  pagina: {
    siguienteCursor: string | null;
    hayMas: boolean;
  };
}

/** Un anuncio en Guardados: puede haberse vendido o pausado desde que se guardó. */
export interface AnuncioGuardado extends AnuncioFeed {
  guardadoEn: string;
  /** Si todavía se puede comprar o contratar. */
  disponible: boolean;
}

export interface RespuestaGuardados {
  items: AnuncioGuardado[];
  pagina: { siguienteCursor: string | null; hayMas: boolean };
}

export interface RespuestaAnuncio {
  anuncio: Anuncio;
}

export interface RespuestaMisAnuncios {
  items: Anuncio[];
  pagina: {
    siguienteCursor: string | null;
    hayMas: boolean;
  };
}

/* ---------- Contacto ---------- */

/** Por qué no hay número que enseñar. El backend decide cuál de los dos. */
export type MotivoContacto = 'SIN_NUMERO' | 'ES_PROPIO' | 'NO_VERIFICADO';

/**
 * Respuesta de POST /api/anuncios/:id/contacto.
 *
 * Pide sesión a propósito: es la única puerta por la que sale un teléfono, y
 * sin sesión cualquiera podría recorrer los ids y quedarse con todos.
 *
 * `disponible: false` no es un error: es un resultado, y por eso se responde
 * 200 en vez de 4xx. El 401 llega solo si no hay sesión.
 */
export type RespuestaContacto =
  | {
      disponible: true;
      /** Como lo guarda el backend, E.164. Sirve para el `tel:`. */
      telefono: string;
      /** Ya formateado, para enseñarlo tal cual. */
      telefonoLegible: string;
      whatsapp: string | null;
      /** `https://wa.me/…` con el texto de arranque; lo arma el backend. */
      enlaceWhatsapp: string | null;
      /** De quién es el número: el del usuario o el del negocio. */
      origen: 'USUARIO' | 'NEGOCIO';
      /** Si este reveal sumó al contador de contactos. */
      contado: boolean;
    }
  | { disponible: false; motivo: MotivoContacto };

/* ---------- Likes ---------- */

/**
 * Respuesta de dar o quitar un like. Siempre trae las dos cosas, y el frontend
 * las pinta tal cual: si devolviera solo el número, el pulgar quedaría
 * desincronizado del texto al reiniciar la vista.
 */
export interface RespuestaLike {
  meGusta: boolean;
  likes: number;
}

/* ---------- Petición de publicación ---------- */

export interface DatosProducto {
  pilar: 'productos';
  titulo: string;
  descripcion?: string;
  categoriaId: number;
  cantonCodigo: string;
  sector?: string;
  precio?: string | null;
  latitud?: number;
  longitud?: number;
  detalle: DetalleProducto;
  /** Si este anuncio enseña el teléfono de quien lo publica. */
  mostrarTelefono?: boolean;
}

export interface DatosServicio {
  pilar: 'servicios';
  titulo: string;
  descripcion?: string;
  categoriaId: number;
  cantonCodigo: string;
  sector?: string;
  precio?: string | null;
  latitud?: number;
  longitud?: number;
  detalle: DetalleServicio;
  mostrarTelefono?: boolean;
}

export interface DatosEmpleo {
  pilar: 'empleo';
  titulo: string;
  descripcion?: string;
  categoriaId: number;
  cantonCodigo: string;
  sector?: string;
  precio?: string | null;
  latitud?: number;
  longitud?: number;
  detalle: DetalleEmpleo;
  mostrarTelefono?: boolean;
}

export type DatosAnuncio = DatosProducto | DatosServicio | DatosEmpleo;

/** Campos de un PATCH: todos opcionales, se manda solo lo que cambia. */
export interface CambiosAnuncio {
  titulo?: string;
  descripcion?: string | null;
  categoriaId?: number;
  cantonCodigo?: string;
  sector?: string | null;
  precio?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  detalle?: Partial<Detalle>;
  /** Ids de las fotos que quedan, en el orden nuevo. */
  fotosConservar?: number[];
  estado?: EstadoEditable;
  mostrarTelefono?: boolean;
  /**
   * Marcar como vendido, o deshacerlo.
   *
   * Acepta los dos valores en el mismo campo a propósito: desvender no necesita
   * una ruta nueva ni una pantalla aparte, es el mismo PATCH con `false`.
   */
  vendido?: boolean;
}

/** `relevancia` solo tiene sentido con búsqueda: lo que más se parece a lo escrito, primero. */
export type OrdenFeed = 'recientes' | 'cercanos' | 'precio_asc' | 'precio_desc' | 'relevancia';

export type FiltrosFeed = {
  pilar?: Pilar;
  categoria?: number;
  canton?: string;
  provincia?: string;
  q?: string;
  precioMin?: number;
  precioMax?: number;
  orden?: OrdenFeed;
  lat?: number;
  lng?: number;
  radioKm?: number;
  /** Productos. */
  condicion?: DetalleProducto['condicion'];
  /** Servicios. */
  modalidadCobro?: DetalleServicio['modalidadCobro'];
  /** Empleo. */
  jornada?: DetalleEmpleo['jornada'];
  modalidad?: DetalleEmpleo['modalidad'];
  conFoto?: boolean;
  cursor?: string;
  limite?: number;
};

/** GET /api/catalogos/resumen: cifras para Explorar y el menú. */
export interface ResumenCatalogo {
  total: number;
  /** id de categoría → anuncios visibles. Las que no tienen ninguno no vienen. */
  categorias: Record<string, number>;
  ciudades: { codigo: string; nombre: string; provincia: string; total: number }[];
  /** Cuántos anuncios comparten ubicación: son los que salen en "Cerca de ti". */
  conUbicacion: number;
}

/**
 * Filtros de "mis anuncios".
 *
 * `ELIMINADO` queda fuera a propósito: el backend borra en cascada suave y su
 * consulta excluye los eliminados, así que ni se listan ni se pueden pedir por
 * `estado` (el servicio responde 400 si se le pasa uno que no exista).
 */
export type FiltrosMisAnuncios = {
  estado?: Exclude<EstadoAnuncio, 'ELIMINADO'>;
  cursor?: string;
  limite?: number;
};

/* ---------- Errores ---------- */

/**
 * Claves que puede traer `errores` en un 422. Se mapean a los campos del
 * formulario en la pantalla: el servidor manda el nombre del campo, no un
 * índice, así que el mapeo es explícito y no se adivina.
 */
export type CampoError =
  | 'pilar'
  | 'titulo'
  | 'descripcion'
  | 'categoriaId'
  | 'cantonCodigo'
  | 'sector'
  | 'precio'
  | 'ubicacion'
  | 'fotos'
  | 'detalle.condicion'
  | 'detalle.modalidadCobro'
  | 'detalle.zonaCobertura'
  | 'detalle.jornada'
  | 'detalle.modalidad'
  | 'estado'
  | string;

export type ErroresValidacion = Partial<Record<CampoError, string>>;

export interface CuerpoError {
  error?: string;
  message?: string | string[];
  statusCode?: number;
  errores?: ErroresValidacion;
}
