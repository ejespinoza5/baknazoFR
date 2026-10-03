/**
 * Lo que se cambia de la landing sin tocar su diseño.
 */

/**
 * La portada: 1920 × 750 px (2.56:1). Se coloca el archivo en
 * `public/landing/portada.webp` (o .jpg, cambiando la ruta). Si no existe, la
 * portada se arma sola con las fotos de los anuncios reales.
 *
 * `posicion` decide qué parte de la imagen se conserva cuando la pantalla es
 * más angosta que 2.56:1 (tablet y celular recortan los costados).
 */
export const PORTADA = {
  imagen: '/landing/portada.webp',
  posicion: '70% center',
  /** Texto alternativo: describe la foto, no el producto. */
  alt: 'Gente comprando y vendiendo en un mercado de Ecuador',
};

/** Redes de Baknazo. Las que queden vacías no se muestran en el pie. */
export const REDES: { red: 'facebook' | 'instagram' | 'tiktok' | 'whatsapp'; url: string }[] = [
  { red: 'facebook', url: 'https://www.facebook.com/baknazo' },
  { red: 'instagram', url: 'https://www.instagram.com/baknazo' },
  { red: 'tiktok', url: 'https://www.tiktok.com/@baknazo' },
  { red: 'whatsapp', url: '' },
];

export const DESARROLLADOR = { nombre: 'Mutantech', url: 'https://mutantech.site/' };

/** El login vive aquí desde que `/` es la landing. `?modo=registro` abre "Crear cuenta". */
export const RUTA_ENTRAR = '/entrar';
export const RUTA_REGISTRO = '/entrar?modo=registro';

/** Desplaza suave hasta una sección de la landing (por su id). */
export function irASeccion(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
