import type { EstadoPostulacion } from '../types/anuncio';

/**
 * Cómo se llama cada estado según quién mira.
 *
 * El empleador ve su proceso ("Descartada"); quien se postuló ve algo que no
 * suene a portazo sin explicación ("No seleccionada"), que es lo que se usa en
 * cualquier bolsa de empleo seria.
 */
export const ESTADO_EMPLEADOR: Record<EstadoPostulacion, string> = {
  NUEVA: 'Nueva',
  VISTA: 'Revisada',
  PRESELECCIONADA: 'Preseleccionada',
  DESCARTADA: 'Descartada',
  CONTRATADA: 'Contratada',
};

export const ESTADO_POSTULANTE: Record<EstadoPostulacion, string> = {
  NUEVA: 'Enviada',
  VISTA: 'Vista por la empresa',
  PRESELECCIONADA: 'Preseleccionada',
  DESCARTADA: 'No seleccionada',
  CONTRATADA: '¡Seleccionada!',
};

/** Color del sello de cada estado: literales completos para Tailwind. */
export const TONO_ESTADO: Record<EstadoPostulacion, string> = {
  NUEVA: 'bg-accent/10 text-accent-dark',
  VISTA: 'bg-border/70 text-foreground',
  PRESELECCIONADA: 'bg-brand/20 text-brand-dark',
  DESCARTADA: 'bg-danger/10 text-danger-deep',
  CONTRATADA: 'bg-success/15 text-success-deep',
};
