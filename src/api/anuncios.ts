import { enviarAutenticado, enviarOpcional } from './token';
import type {
  CambiosAnuncio,
  Catalogos,
  CuerpoError,
  DatosAnuncio,
  ErroresValidacion,
  FiltrosFeed,
  FiltrosMisAnuncios,
  RespuestaAnuncio,
  RespuestaContacto,
  RespuestaCrear,
  RespuestaFeed,
  RespuestaLike,
  RespuestaMisAnuncios,
  ResumenCatalogo,
  RespuestaGuardados,
} from '../types/anuncio';

/**
 * Error que conserva el estado HTTP y el cuerpo original. Los 422 traen
 * `errores` con una clave por campo, que es lo que permite pintar el error en
 * el input que le corresponde en vez de un toast genérico.
 *
 * Lo construye el motor de token (`api/token.ts`), que es quien ya sabe
 * traducir los mensajes del backend y reintentar tras un 401.
 */
export interface ErrorApi extends Error {
  status?: number;
  datos?: unknown;
}

/** Los 422 traen el detalle por campo; se extrae para la pantalla. */
export function erroresDeValidacion(e: unknown): ErroresValidacion | null {
  if (!(e instanceof Error)) return null;
  const { status, datos } = e as ErrorApi;
  if (status !== 422 || !datos || typeof datos !== 'object') return null;
  const errores = (datos as CuerpoError).errores;
  return errores && Object.keys(errores).length > 0 ? errores : null;
}



/**
 * Serializa filtros a query string, omitiendo los vacíos.
 *
 * Compartida por el feed y por "mis anuncios": los dos paginan por cursor y
 * los dos necesitan que `estado` o `pilar` no viajen si no están puestos, para
 * no ensuciar la URL con `?pilar=undefined`.
 */
function consulta(params: FiltrosFeed | FiltrosMisAnuncios): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return texto ? `?${texto}` : '';
}

/* ---------- Catálogos ---------- */

/**
 * Categorías, territorio y enumeraciones. Sin autenticación: el formulario
 * los necesita antes de que exista el anuncio, y cachearlos en cliente evita
 * pedirlo en cada apertura.
 */
export function obtenerCatalogos(): Promise<Catalogos> {
  return enviarOpcional<Catalogos>('/api/catalogos');
}

/** Cuántos anuncios hay por categoría y en qué ciudades. Público. */
export function obtenerResumenCatalogo(): Promise<ResumenCatalogo> {
  return enviarOpcional<ResumenCatalogo>('/api/catalogos/resumen');
}

/* ---------- Publicar ---------- */

/**
 * Crea el anuncio con sus fotos en un solo request multipart.
 *
 * El cliente recorta y re-codifica antes de subir, así que las 6 fotos pesan
 * alrededor de 2 MB, no 48. No hay motivo para partirlo en crear → subir →
 * publicar, que además deja anuncios a medio existir si falla el paso 2.
 *
 * `idempotencyKey` debe ser la misma al reintentar el mismo envío (doble toque,
 * red móvil que se cae). El backend responde 201 con el anuncio original.
 */
export function crearAnuncio(
  datos: DatosAnuncio,
  fotos: File[],
  idempotencyKey: string
): Promise<RespuestaCrear> {
  const form = new FormData();
  form.append('datos', JSON.stringify(datos));
  for (const foto of fotos) form.append('fotos', foto);

  return enviarAutenticado<RespuestaCrear>(
    '/api/anuncios',
    'POST',
    form,
    { 'Idempotency-Key': idempotencyKey }
  );
}

/* ---------- Feed ---------- */

export function listarAnuncios(filtros: FiltrosFeed = {}): Promise<RespuestaFeed> {
  return enviarOpcional<RespuestaFeed>(`/api/anuncios${consulta(filtros)}`);
}

/**
 * Los anuncios del usuario, paginados por cursor igual que el feed.
 *
 * Ordena por `creado_en` descendente, así que un borrador recién creado sale
 * primero aunque todavía no tenga `publicado_en`. `limite` lo acota el backend
 * (50 como techo); aquí se piden 20 por página, el mismo tamaño del feed.
 */
export function obtenerMisAnuncios(
  filtros: FiltrosMisAnuncios = {}
): Promise<RespuestaMisAnuncios> {
  return enviarAutenticado<RespuestaMisAnuncios>(
    `/api/anuncios/mios${consulta(filtros)}`,
    'GET'
  );
}

/* ---------- Detalle y edición ---------- */

/** Acepta id o slug. Con sesión, el dueño ve también sus anuncios pausados. */
export function obtenerAnuncio(
  idOCapa: number | string
): Promise<RespuestaAnuncio> {
  return enviarOpcional<RespuestaAnuncio>(
    `/api/anuncios/${encodeURIComponent(idOCapa)}`
  );
}

/**
 * Edita un anuncio. Con fotos nuevas va multipart (campos `datos` y `fotos`);
 * sin ellas, JSON directo. `pilar` no se puede cambiar.
 */
export function editarAnuncio(
  id: number,
  cambios: CambiosAnuncio,
  fotosNuevas: File[]
): Promise<RespuestaAnuncio> {
  const hayFotos = fotosNuevas.length > 0;

  const cuerpo = hayFotos ? new FormData() : cambios;
  if (hayFotos) {
    (cuerpo as FormData).append('datos', JSON.stringify(cambios));
    for (const foto of fotosNuevas) (cuerpo as FormData).append('fotos', foto);
  }

  return enviarAutenticado<RespuestaAnuncio>(`/api/anuncios/${id}`, 'PATCH', cuerpo);
}

export function eliminarAnuncio(id: number): Promise<void> {
  return enviarAutenticado<void>(`/api/anuncios/${id}`, 'DELETE');
}

/* ---------- Contacto ---------- */

/**
 * Pide el teléfono de quien publicó y suma un contacto.
 *
 * Exige sesión a propósito: es la única ruta por la que sale un número, así que
 * sin sesión cualquiera podría recorrer los ids y quedarse con todos.
 *
 * Una llamada, dos efectos. Si fueran dos, el contador y el número se
 * desincronizarían: uno se contaría sin haber enseñado nada o se enseñaría algo
 * que no se contó. El backend deduplica por ventana para que probar el botón
 * varias veces no dispare la cifra, y lo dice en `contado`.
 */
export function registrarContacto(id: number): Promise<RespuestaContacto> {
  return enviarAutenticado<RespuestaContacto>(
    `/api/anuncios/${id}/contacto`,
    'POST'
  );
}

/* ---------- Likes ---------- */

/**
 * Dar like y quitarlo van en dos rutas y no en una que alterne, por idempotencia.
 *
 * Un `POST .../like` que conmuta sería más corto, pero no se puede reintentar: en
 * una app con mala señal un toque que se va y vuelve llega dos veces y se
 * desharía solo. Con dos verbos distintos, repetir la llamada no cambia nada.
 *
 * El doble toque rápido lo resuelve el frontend: mientras una está en vuelo, el
 * botón no acepta otro clic.
 */
export function darLike(id: number): Promise<RespuestaLike> {
  return enviarAutenticado<RespuestaLike>(`/api/anuncios/${id}/likes`, 'POST');
}

export function quitarLike(id: number): Promise<RespuestaLike> {
  return enviarAutenticado<RespuestaLike>(`/api/anuncios/${id}/likes/me`, 'DELETE');
}

/* ---------- Moderación ---------- */

export interface RevisionTexto {
  /** Se publicaría, pasaría por revisión o no se puede publicar. */
  decision: 'PUBLICAR' | 'REVISION' | 'BLOQUEAR';
  /** Solo si se bloquea: en qué campo está el problema (nunca qué palabra). */
  campo?: 'titulo' | 'descripcion' | 'categoriaId';
}

/** Lo que diría la moderación del texto, mientras se escribe. */
export function revisarTextoAnuncio(datos: { titulo: string; descripcion: string; categoriaId: number | null }): Promise<RevisionTexto> {
  return enviarAutenticado('/api/anuncios/revisar-texto', 'POST', datos);
}

/** Un 422 que viene de la moderación (contenido o categoría no permitidos). */
export function esBloqueoDeModeracion(errores: Partial<Record<string, string>> | null): boolean {
  return Boolean(errores && Object.values(errores).some((m) => typeof m === 'string' && /normas de Baknazo|no admite publicaciones/.test(m)));
}

/* ---------- Denuncias ---------- */

/** Denunciar un anuncio. Una vez por persona; un 409 dice que ya se denunció. */
export function denunciarAnuncio(id: number, motivo: string, detalle?: string): Promise<{ denunciado: boolean }> {
  return enviarAutenticado(`/api/anuncios/${id}/denuncias`, 'POST', { motivo, detalle: detalle?.trim() || undefined });
}

/* ---------- Guardados ---------- */

export function guardarAnuncio(id: number): Promise<{ guardado: boolean }> {
  return enviarAutenticado(`/api/anuncios/${id}/guardado`, 'POST');
}

export function quitarGuardado(id: number): Promise<{ guardado: boolean }> {
  return enviarAutenticado(`/api/anuncios/${id}/guardado`, 'DELETE');
}

/** Los guardados, del más reciente al más antiguo. Incluye los ya vendidos. */
export function listarGuardados(cursor?: string | null): Promise<RespuestaGuardados> {
  return enviarAutenticado(`/api/anuncios/guardados${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, 'GET');
}

/* ---------- Vistas ---------- */

/**
 * Las publicaciones que se vieron en la lista sin abrirlas. El backend cuenta
 * cada una una sola vez por persona y día, y nunca la del dueño.
 */
export function registrarVistas(ids: number[]): Promise<{ registradas: number }> {
  return enviarOpcional('/api/anuncios/vistas', 'POST', { ids });
}
