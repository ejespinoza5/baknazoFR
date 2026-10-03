import type { Pilar } from '../lib/pilares';

export type Permiso =
  | 'anuncios.ver'
  | 'anuncios.aprobar'
  | 'anuncios.rechazar'
  | 'anuncios.pausar'
  | 'anuncios.eliminar'
  | 'usuarios.ver'
  | 'usuarios.suspender'
  | 'usuarios.reactivar'
  | 'denuncias.ver'
  | 'denuncias.resolver'
  | 'estadisticas.ver'
  | 'administradores.gestionar'
  | 'permisos.gestionar'
  | 'moderacion.configurar'
  | 'auditoria.ver'
  | 'soporte.responder';

export interface Administrador {
  id: string;
  nombre: string;
  correo: string;
  esSuper: boolean;
  activo: boolean;
  permisos: Permiso[];
  debeCambiarContrasena: boolean;
  ultimoAccesoEn: string | null;
  contrasenaCambiadaEn: string | null;
  creadoEn: string;
  acciones?: number;
}

export interface Catalogos {
  permisos: { id: Permiso; grupo: string; nombre: string }[];
  motivosRechazo: { id: string; nombre: string }[];
  motivosDenuncia: { id: string; nombre: string }[];
  motivosRevision: Record<string, string>;
}

export interface Estadisticas {
  usuarios: number;
  usuariosNuevos: number;
  usuariosSuspendidos: number;
  publicados: number;
  pendientes: number;
  rechazados: number;
  pausados: number;
  anunciosSemana: number;
  denunciados: number;
  decisionesSemana: number;
  pendienteMasAntiguo: string | null;
  serie: { dia: string; total: number }[];
}

export type EstadoAnuncioAdmin = 'BORRADOR' | 'PENDIENTE_REVISION' | 'PUBLICADO' | 'PAUSADO' | 'RECHAZADO' | 'ELIMINADO';

export interface AnuncioAdmin {
  id: number;
  slug: string;
  titulo: string;
  descripcion: string | null;
  pilar: Pilar;
  estado: EstadoAnuncioAdmin;
  precio: string | null;
  moneda: string;
  categoria: string;
  categoriaId: number;
  ubicacion: string;
  creadoEn: string;
  publicadoEn: string | null;
  motivosRevision: string[];
  notasModeracion: string | null;
  pausaAdministrativa: boolean;
  vendido: boolean;
  portada: string | null;
  denunciasPendientes: number;
  autor: { id: string; nombre: string; correo: string; tipo: string; estado: string; desde: string };
}

export interface DetalleAnuncio extends AnuncioAdmin {
  fotos: string[];
  historial: {
    id: number;
    accion: string;
    estadoAnterior: string | null;
    estadoNuevo: string | null;
    motivo: string | null;
    nota: string | null;
    detalle: { terminos?: string[]; motivos?: string[] } | null;
    por: string | null;
    fecha: string;
  }[];
  denuncias: { id: number; motivo: string; detalle: string | null; estado: string; fecha: string; denunciante: string; resueltaPor: string | null }[];
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  correo: string;
  tipo: 'PERSONA' | 'NEGOCIO';
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
  correoVerificado: boolean;
  anuncios: number;
  denuncias: number;
  creadoEn: string;
  ultimoAccesoEn: string | null;
}

export interface EntradaAuditoria {
  id: number;
  accion: string;
  objetivoTipo: string | null;
  objetivoId: string | null;
  detalle: Record<string, unknown>;
  ip: string | null;
  fecha: string;
  admin: { id: string; nombre: string; correo: string } | null;
}

export interface ConfigModeracion {
  revisionUsuariosNuevos: boolean;
  diasUsuarioNuevo: number;
  umbralDenuncias: number;
  categoriasProhibidas: number[];
  actualizadoEn: string;
  palabras: { id: number; termino: string; nivel: 'REVISION' | 'BLOQUEO'; creadoPor: string | null; creadoEn: string }[];
  categorias: { id: number; nombre: string; pilar: Pilar }[];
}

export type EstadoHiloSoporte = 'ABIERTO' | 'RESUELTO';

export interface UsuarioSoporte {
  id: string;
  nombre: string;
  correo: string;
  tipo: 'PERSONA' | 'NEGOCIO';
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
}

/** Una conversación en la bandeja de soporte. */
export interface HiloSoporte {
  usuario: UsuarioSoporte;
  estado: EstadoHiloSoporte;
  /** Mensajes del usuario que nadie del equipo leyó todavía. */
  pendientes: number;
  ultimoMensajeEn: string;
  ultimo: { autor: AutorSoporte; contenido: string } | null;
}

export type AutorSoporte = 'USUARIO' | 'ADMIN' | 'SISTEMA';

export interface MensajeSoporteAdmin {
  id: number;
  autor: AutorSoporte;
  contenido: string;
  creadoEn: string;
  leidoEn: string | null;
  /** Quién respondió (solo en los del equipo). El usuario no lo ve. */
  admin: string | null;
}

export interface DetalleHiloSoporte {
  usuario: UsuarioSoporte & { desde: string; anuncios: number };
  estado: EstadoHiloSoporte;
  creadoEn: string;
  resueltoEn: string | null;
  resueltoPor: string | null;
  items: MensajeSoporteAdmin[];
  hayMas: boolean;
}

export interface Pagina<T> {
  items: T[];
  total: number;
}
