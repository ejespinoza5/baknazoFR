import type { Pilar } from '../lib/pilares';

export type TipoNotificacion =
  | 'SEGUIDOR'
  | 'ME_GUSTA'
  | 'COMENTARIO'
  | 'RESPUESTA'
  | 'GUARDADO'
  | 'MENSAJE'
  | 'ANUNCIO_APROBADO'
  | 'ANUNCIO_RECHAZADO'
  | 'ANUNCIO_VENCIDO'
  | 'NUEVA_VACANTE'
  | 'POSTULACION_NUEVA'
  | 'POSTULACION_ESTADO'
  | 'CV_REVISADO'
  | 'SEGURIDAD'
  | 'SOPORTE';

export type CategoriaNotificacion =
  | 'seguidores'
  | 'interacciones'
  | 'mensajes'
  | 'publicaciones'
  | 'empleo'
  | 'seguridad';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  categoria: CategoriaNotificacion;
  /** Ya armado por el servidor, con los nombres y títulos de ahora. */
  texto: string;
  /** A dónde lleva al pulsarla (ruta de la app). */
  url: string;
  /** Las repetitivas se agrupan: cuántas personas o mensajes suma. */
  cantidad: number;
  actor: { id: string; nombre: string; foto: string | null; esNegocio: boolean } | null;
  anuncio: { id: number; titulo: string; pilar: Pilar } | null;
  creadaEn: string;
  actualizadaEn: string;
  leida: boolean;
}

export interface RespuestaNotificaciones {
  items: Notificacion[];
  hayMas: boolean;
  noLeidas: number;
}

export type Sonido = 'ninguno' | 'campana' | 'burbuja' | 'pop' | 'marimba';

export interface PreferenciasNotificacion {
  categorias: Record<CategoriaNotificacion, { app: boolean; push: boolean }>;
  sonido: Sonido;
  /** Si el servidor tiene Firebase configurado para mandar push. */
  pushDisponible: boolean;
}
