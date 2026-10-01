/**
 * Mensajes de celebración al publicar.
 *
 * Publicar es el momento en que la persona hizo algo: dejó de fisgonear y dejó
 * un producto, un trabajo o un servicio en la calle. Decir solo "Anuncio
 * publicado" es cierto y no dice nada; estas líneas reconocen el esfuerzo sin
 * inventar métricas ni promesas.
 *
 * El tono es el de la casa: frases cortas, en segunda persona y sin signos de
 * apertura, como el resto de los mensajes de la app.
 *
 * Se eligen por turno y no al azar: dos publicaciones seguidas en la misma
 * sesión dicen cosas distintas, y a la vez una prueba puede contar cuántas veces
 * se escribió la primera.
 */
const LINEAS = [
  'Tu publicación quedó bacán. Ya aparece en el feed.',
  'Listo, quedó bacán. Ya pueden verte en el feed.',
  'Qué bacano publicarlo. Ya está en el feed.',
  'Buen trabajo: quedó bacán y ya está en el feed.',
  'Ya estás en el feed. Esto quedó bacán.',
  'Anuncio publicado y bien bacán. Ya aparece en el feed.',
];

let turno = 0;

export function lineaDeCelebracion(): string {
  const linea = LINEAS[turno % LINEAS.length];
  turno += 1;
  return linea;
}
