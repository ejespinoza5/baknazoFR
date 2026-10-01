export type TipoCuenta = 'PERSONA' | 'NEGOCIO';

export type Proveedor = 'google' | 'manual';

/** Tipo de política publicada por BAKNAZO (versión vigente). */
export type ClavePolitica = 'TERMINOS' | 'PRIVACIDAD';

/** Política publicada y vigente, servida por GET /api/auth/politicas. */
export interface PoliticaVigente {
  id: string;
  clave: ClavePolitica;
  version: number;
  titulo: string;
  contenido: string;
  fecha_publicacion: string | null;
}

/** Versiones de las políticas que el usuario aceptó al registrarse. */
export interface Consentimiento {
  terminos_version: number;
  privacidad_version: number;
}

/**
 * Teléfono del usuario y su consentimiento para enseñarlo.
 *
 * Van anidados bajo `contacto` y no sueltos en el usuario por una razón concreta:
 * `PATCH /api/auth/perfil` ya recibe un `telefono` plano que es **el del
 * negocio**, y con un `telefono` de usuario al mismo nivel el backend no
 * tendría forma de saber cuál de los dos se está cambiando. Anidado, cada uno
 * sabe de quién es.
 *
 * Opcionales porque hasta que el backend los mande siguen siendo `undefined`, y
 * la app tiene que poder leerse a sí misma contra un contrato a medio editar.
 */
export interface ContactoUsuario {
  /** Siempre en E.164 ("+593991234567") o `null`. */
  telefono: string | null;
  /** Si el usuario da su número por defecto en los anuncios que publique. */
  mostrar_telefono: boolean;
  /** Cuando se haya verificado por SMS. El backend aún no lo exige. */
  telefono_verificado_en?: string | null;
}

export interface Usuario {
  id: string;
  correo: string;
  nombres: string;
  apellidos: string;
  /** Puede venir vacío cuando el usuario (ej. Google) aún no eligió tipo. */
  tipo_cuenta: TipoCuenta | null;
  foto_perfil?: string | null;
  contacto?: ContactoUsuario | null;
}

/**
 * El refresh token no aparece aquí: vive en una cookie HttpOnly que el
 * navegador envía solo a /api/auth y que el JavaScript no puede leer.
 *
 * `access_token` vive solo en memoria. Al recargar la página arranca vacío y el
 * motor (api/token.ts) lo pide de nuevo con la cookie.
 */
export interface Sesion {
  access_token: string;
  expira_en: string;
  usuario: Usuario;
}

export interface CategoriaNegocio {
  id: string;
  nombre: string;
}

export interface NegocioDetalle {
  id: string;
  nombre_comercial: string;
  categoria: CategoriaNegocio | null;
  descripcion_breve: string | null;
  logo_url: string | null;
  logo_url_completa: string | null;
  provincia: string | null;
  ciudad: string | null;
  sector: string | null;
  direccion_local: string | null;
  tiene_local: boolean;
  latitud: number | null;
  longitud: number | null;
  telefono: string | null;
  whatsapp: string | null;
  correo_contacto: string | null;
  redes_sociales: Record<string, string> | null;
  horario_atencion: HorarioDia[] | null;
  entrega_domicilio: boolean;
  zona_cobertura: string | null;
  estado: string;
  creado_en: string | null;
  actualizado_en: string | null;
}

/**
 * Qué partes del perfil ve alguien que no es el dueño.
 *
 * Todo es `true` por defecto: un perfil nuevo se ve completo, y quien quiera
 * esconder algo lo apaga. El backend aplica estas reglas antes de responder, así
 * que un visitante no recibe el dato escondido ni mirando la red.
 */
export interface PrivacidadPerfil {
  /** Pestaña "Vendidos" y la cifra de ventas. */
  vendidos: boolean;
  /** Total de "me gusta" recibidos. */
  me_gusta: boolean;
  /** Cifras y listas de seguidores y seguidos. */
  seguidores: boolean;
  /** Ciudad o sector. */
  ubicacion: boolean;
  /** "Miembro desde". */
  miembro_desde: boolean;
  /** Solo negocios: dirección del local y el enlace al mapa. */
  direccion: boolean;
  /** Solo negocios: horario de atención. */
  horario: boolean;
  /** Solo negocios: redes sociales. */
  redes: boolean;
  /** Solo negocios: botones de WhatsApp y llamada. */
  contacto_negocio: boolean;
}

export const PRIVACIDAD_POR_DEFECTO: PrivacidadPerfil = {
  vendidos: true,
  me_gusta: true,
  seguidores: true,
  ubicacion: true,
  miembro_desde: true,
  direccion: true,
  horario: true,
  redes: true,
  contacto_negocio: true,
};

/** Rellena lo que falte con el valor por defecto (el backend puede ser anterior). */
export function privacidadCompleta(
  parcial: Partial<PrivacidadPerfil> | null | undefined
): PrivacidadPerfil {
  return { ...PRIVACIDAD_POR_DEFECTO, ...(parcial ?? {}) };
}

/** Respuesta ampliada del endpoint GET /api/auth/me. */
export interface PerfilUsuario extends Usuario {
  foto_perfil_url: string | null;
  foto_portada?: string | null;
  foto_portada_url?: string | null;
  /** Ausente mientras el backend no tenga la migración de privacidad. */
  privacidad_perfil?: Partial<PrivacidadPerfil> | null;
  estado: string;
  correo_verificado: boolean;
  correo_verificado_en: string | null;
  ultimo_acceso_en: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
  proveedores: string[];
  negocio: NegocioDetalle | null;
  /** El backend lo manda siempre ya guardado; antes de existir, `null`. */
  contacto: ContactoUsuario;
}

export interface PerfilRespuesta {
  usuario: PerfilUsuario;
}

export interface DatosRegistroManual {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
}

export interface HorarioDia {
  dia: string;
  apertura: string;
  cierre: string;
}

/** Datos extra que pide la API cuando la cuenta es NEGOCIO. */
export interface DatosRegistroNegocio {
  nombre_comercial: string;
  categoria: string;
  descripcion_breve: string;
  logo: File | null;
  provincia: string;
  ciudad: string;
  sector: string;
  tiene_local: boolean;
  direccion_local: string;
  zona_cobertura: string;
  latitud: number | null;
  longitud: number | null;
  telefono: string;
  whatsapp: string;
  correo_contacto: string;
  entrega_domicilio: boolean;
  redes_sociales: Record<string, string>;
  horario_atencion: HorarioDia[];
}

/**
 * Lo que queda "en espera" mientras le preguntamos al usuario si es
 * PERSONA o NEGOCIO. Con esto ya se puede completar el registro.
 *
 * Google se verifica en el backend con el id_token (JWT).
 */
export type RegistroPendiente =
  | { proveedor: 'google'; id_token: string }
  | ({ proveedor: 'manual' } & DatosRegistroManual);

/**
 * Campos que acepta PATCH /api/auth/perfil.
 *
 * Solo se envían los que cambiaron: el backend ignora el resto. Un campo
 * opcional enviado como "" se borra, así que `undefined` = "no tocar" y
 * `""` = "dejarlo vacío".
 *
 * Ojo con el `telefono` de aquí: es el **del negocio**, y lo escribe
 * `cambiosNegocio`. El del usuario va anidado en `contacto` para que los dos no
 * se confundan.
 */
export interface CambiosPerfil {
  nombres?: string;
  apellidos?: string;
  nombre_comercial?: string;
  categoria?: string;
  descripcion_breve?: string;
  provincia?: string;
  ciudad?: string;
  sector?: string;
  direccion_local?: string;
  tiene_local?: boolean;
  latitud?: number;
  longitud?: number;
  telefono?: string;
  whatsapp?: string;
  correo_contacto?: string;
  redes_sociales?: Record<string, string>;
  horario_atencion?: HorarioDia[];
  entrega_domicilio?: boolean;
  zona_cobertura?: string;
  contacto?: {
    /** `null` o "" lo borra; `undefined` dentro no se manda. */
    telefono?: string | null;
    mostrar_telefono?: boolean;
  };
  /** Viaja completo: son nueve casillas y el backend reemplaza el objeto. */
  privacidad_perfil?: PrivacidadPerfil;
}

/**
 * Imágenes de PATCH /api/auth/perfil. Obligan a enviar multipart/form-data.
 * `eliminar*` solo se manda cuando no hay un archivo nuevo que lo reemplace.
 */
export interface ImagenesPerfil {
  fotoPerfil?: File | null;
  logo?: File | null;
  fotoPortada?: File | null;
  eliminarFotoPerfil?: boolean;
  eliminarLogo?: boolean;
  eliminarFotoPortada?: boolean;
}

export interface RespuestaActualizarPerfil {
  mensaje: string;
  usuario: PerfilUsuario;
}

export interface DatosCambioContrasena {
  contrasena_actual: string;
  nueva_contrasena: string;
  confirmar_contrasena: string;
}

/** Al cambiar la contraseña el backend cierra el resto de sesiones y renueva los tokens. */
export interface RespuestaCambioContrasena {
  mensaje: string;
  access_token: string;
  expira_en: string;
}
