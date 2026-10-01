import type { Pilar } from '../lib/pilares';
import type { PrivacidadPerfil } from './auth';

export type PerfilPublico = PerfilPersona | PerfilNegocio;

export interface BasePerfil {
  /**
   * Lo que el dueño decidió enseñar. A un visitante el backend ya le manda los
   * datos ocultos vacíos; al dueño le llegan completos y esto sirve para
   * marcarle qué partes no ven los demás. Ausente con un backend anterior.
   */
  visibilidad?: Partial<PrivacidadPerfil> | null;
  id: string;
  nombre: string;
  foto: string | null;
  foto_portada: string | null;
  verificado: boolean;
  publicados: number;
  vendidos: number;
  likes: number;
  ubicacion: string;
  miembroDesde: string;
  seguidores: number;
  seguidos: number;
  loSigues: boolean;
}

export interface PerfilPersona extends BasePerfil {
  tipo: 'PERSONA';
  contacto: 'telefono' | 'whatsapp' | 'ninguno';
}

export interface PerfilNegocio extends BasePerfil {
  tipo: 'NEGOCIO';
  categoria: string;
  descripcion: string;
  direccion: string | null;
  horario: DiaHorario[];
  entregaDomicilio: boolean;
  zonaCobertura: string | null;
  telefono: string | null;
  whatsapp: string | null;
  latitud: number | null;
  longitud: number | null;
  redes: { etiqueta: string; url: string }[];
  valoracion: number | null;
  numeroValoraciones: number;
}

export interface DiaHorario {
  dia: string;
  abierto: boolean;
  desde: string | null;
  hasta: string | null;
}

export interface AnuncioPerfil {
  id: number;
  titulo: string;
  precio: string;
  ubicacion: string;
  pilar: Pilar;
  foto: string | null;
  sinFoto: boolean;
  vendido: boolean;
  publicadoEn: string;
  likes: number;
  vistas: number;
}

export interface PaginacionPerfil {
  limite: number;
  offset: number;
  total: number;
  hayMas: boolean;
}

export interface RespuestaPerfil {
  perfil: PerfilPublico;
  anuncios: AnuncioPerfil[];
  paginacion: PaginacionPerfil;
}

export interface RespuestaAnunciosPerfil {
  anuncios: AnuncioPerfil[];
  paginacion: PaginacionPerfil;
}

export interface Seguidor {
  id: string;
  tipo: 'PERSONA' | 'NEGOCIO';
  nombre: string;
  foto: string | null;
  desde: string;
}

export interface RespuestaSeguidores {
  seguidores: Seguidor[];
  total: number;
  paginacion: PaginacionPerfil;
}

export interface SemillaPerfil {
  clavePerfil: string;
  anuncioId: number;
  titulo: string;
  precio: string;
  ubicacion: string;
  pilar: Pilar;
  foto: string | null;
  publicadoEn: string | null;
  likes: number;
  vistas: number;
  esNegocio: boolean;
  nombreAutor: string;
}
