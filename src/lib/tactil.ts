/**
 * Cómo se sabe si el dispositivo tiene pantalla táctil, sin JavaScript.
 *
 * La condición mira `pointer` y `hover`, no el ancho: con un ratón como puntero
 * principal el atributo `capture` no hace nada, el navegador abre el mismo
 * diálogo de archivos que el otro botón y la opción solo confunde. Da igual que
 * la ventana sea ancha o estrecha, en escritorio sobraría en ambos casos, así que
 * no hace falta inventar un punto de corte por píxeles.
 *
 * Pedir las dos pistas evita falsos negativos: una tableta o un portátil con
 * pantalla táctil siguen viendo el botón aunque tengan un ratón pareado.
 *
 * OJO: estas clases van escritas enteras y literal porque Tailwind escanea el
 * código fuente buscando cadenas completas. Si se componen con una variable
 * (`${algo}:hidden`) la variante arbitraria no llega a generarse y el estilo se
 * pierde en silencio, sin error de compilación que lo delate. Por eso viven
 * aquí y no se reconstruyen en cada sitio: son cadenas, no clases sueltas.
 */

/** Solo en táctil: se esconde cuando el ratón es el puntero principal. */
export const OCULTO_CON_RATON = '[@media(pointer:fine)_and_(hover:hover)]:hidden';

/** Solo con ratón: es la etiqueta del botón cuando la cámara no está. */
export const SOLO_CON_RATON = '[@media(pointer:fine)_and_(hover:hover)]:inline';
