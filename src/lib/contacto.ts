import type { PerfilUsuario } from '../types/auth';
import type { MotivoContacto } from '../types/anuncio';

/**
 * El chat con quien publicó.
 *
 * Todavía no existe: no hay API de conversaciones, así que el botón es solo la
 * señal de que la acción va en esa dirección. Al pulsarlo avisa en vez de llevar
 * a ninguna parte, que es lo honesto mientras tanto.
 *
 * El texto vive aquí y no en cada botón para que la ficha y la publicación de la
 * lista digan exactamente lo mismo.
 */
export const CHAT_PENDIENTE =
  'El chat todavía no está disponible. Pronto podrás escribirle a quien publicó.';

/**
 * Por qué no sale un número, en palabras de la persona que lo pidió.
 *
 * El backend responde 200 con `disponible: false` y un motivo, porque no
 * enseñarle el número a alguien no es un fallo: es la respuesta correcta cuando
 * quien publica decidió no compartirlo. Un error genérico haría pensar que
 * algo se rompió.
 */
export const MOTIVO_CONTACTO: Record<MotivoContacto, string> = {
  SIN_NUMERO:
    'Esta publicación no muestra el número de quien la puso.',
  ES_PROPIO: 'Este anuncio es tuyo.',
  NO_VERIFICADO:
    'Verifica tu número de teléfono para poder ver el de los demás.',
};

/** El texto del motivo, con un texto por si el backend no dijerá cuál. */
export function mensajeDeMotivo(motivo: MotivoContacto | undefined): string {
  return (motivo && MOTIVO_CONTACTO[motivo]) || MOTIVO_CONTACTO.SIN_NUMERO;
}

/**
 * Acepta lo que la gente escribe de verdad: `+593 99 123 4567`, `0991234567`,
 * `(04) 2561234`. No distingue un fijo de un móvil ni exige el prefijo, porque
 * esa comprobación la hace el backend cuando normaliza. Aquí solo se filtra lo
 * absurdo; el mismo criterio se usa en Configuración y en el formulario del
 * anuncio, de modo que los dos sitios admiten exactamente lo mismo.
 */
const PATRON_TELEFONO = /^[+\d\s()-]{7,20}$/;

/** Si lo tecleado es un número con forma de teléfono, no solo letras. */
export function telefonoPlausible(valor: string): boolean {
  const limpio = valor.trim();
  return limpio.length > 0 && PATRON_TELEFONO.test(limpio);
}

/**
 * El número que se publicaría en los anuncios de esta cuenta, o `null` si no
 * tiene ninguno.
 *
 * Para un negocio es el suyo —el del negocio, no uno nuevo— porque es el único
 * que se le pidió. Es el mismo orden que debe usar el backend, y por eso vive
 * en una función: si el orden cambia en un sitio y no en el otro, la casilla
 * se enciende para un número que luego no se puede enseñar.
 */
export function telefonoDeContacto(
  perfil: PerfilUsuario | null | undefined
): string | null {
  if (!perfil) return null;
  return (
    perfil.contacto?.telefono ||
    perfil.negocio?.telefono ||
    perfil.negocio?.whatsapp ||
    null
  );
}
