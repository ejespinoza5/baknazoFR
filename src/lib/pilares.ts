/**
 * Lenguaje visual de los tres pilares del marketplace.
 *
 * Vive aparte del feed porque lo comparten dos superficies: las tarjetas del
 * feed y la vista previa de "Publicar un anuncio". Si el color de cada pilar
 * viviera duplicado en las dos pantallas, bastaría un cambio en un sitio para
 * que un anuncio se viera distinto antes y después de publicarlo.
 */

export type Pilar = 'productos' | 'servicios' | 'empleo';

export const PILARES: { id: Pilar; singular: string; consulta: string }[] = [
  { id: 'productos', singular: 'Producto', consulta: 'Producto' },
  { id: 'servicios', singular: 'Servicio', consulta: 'Servicio' },
  { id: 'empleo', singular: 'Empleo', consulta: 'Empleo' },
];

/** Nombre plural de la sección, como aparece en menús y filtros. */
export const NOMBRE_PILAR: Record<Pilar, string> = {
  productos: 'Productos',
  servicios: 'Servicios',
  empleo: 'Empleo',
};

interface EstiloPilar {
  nombre: string;
  /** Tinta del nombre del pilar: AA sobre fondo claro. */
  tinta: string;
  punto: string;
  fondo: string;
  rayas: string;
  /** Color que se lleva el formulario cuando ese pilar está activo. */
  solido: string;
  solidoOscuro: string;
  /** Tinta de texto sobre `solido`. */
  sobreSolido: string;
}

export const ESTILO_PILAR: Record<Pilar, EstiloPilar> = {
  productos: {
    nombre: 'Producto',
    tinta: 'text-brand-dark',
    punto: 'bg-brand',
    fondo: 'bg-brand/[0.12]',
    rayas: 'rgba(255,184,0,0.55)',
    solido: 'bg-brand',
    solidoOscuro: 'hover:bg-brand-dark',
    sobreSolido: 'text-foreground',
  },
  servicios: {
    nombre: 'Servicio',
    tinta: 'text-accent-dark',
    punto: 'bg-accent',
    fondo: 'bg-accent/[0.1]',
    rayas: 'rgba(10,110,189,0.5)',
    solido: 'bg-accent',
    solidoOscuro: 'hover:bg-accent-dark',
    sobreSolido: 'text-white',
  },
  // Los tres pilares son los colores de la bandera: amarillo, azul y rojo.
  empleo: {
    nombre: 'Empleo',
    tinta: 'text-empleo-deep',
    punto: 'bg-empleo',
    fondo: 'bg-empleo/[0.08]',
    rayas: 'rgba(206,17,38,0.4)',
    solido: 'bg-empleo',
    solidoOscuro: 'hover:bg-empleo-deep',
    sobreSolido: 'text-white',
  },
};
