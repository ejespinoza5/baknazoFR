import { API_URL, SIN_CONEXION } from './base';
import { enviarAutenticado, estadoDe } from './token';
import type {
  CambiosPerfil,
  Consentimiento,
  DatosCambioContrasena,
  DatosRegistroManual,
  DatosRegistroNegocio,
  ImagenesPerfil,
  PerfilRespuesta,
  PoliticaVigente,
  RegistroPendiente,
  RespuestaActualizarPerfil,
  RespuestaCambioContrasena,
  Sesion,
  TipoCuenta,
} from '../types/auth';

export interface Categoria {
  id: string;
  nombre: string;
}

function parsearJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** El backend (NestJS) responde `{ message: string | string[] }` en los errores. */
function mensajeDeError(datos: unknown, estado: number): string {
  if (datos && typeof datos === 'object') {
    const { message, error } = datos as { message?: unknown; error?: unknown };
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message) return message;
    if (typeof error === 'string' && error) return error;
  }
  if (estado === 401) return 'Correo o contraseña incorrectos.';
  if (estado === 409) return 'Esa cuenta ya está registrada.';
  return `Error del servidor (${estado}).`;
}

/** Error que guarda también el estado HTTP y el cuerpo original de la API. */
export interface ErrorApi extends Error {
  status?: number;
  datos?: unknown;
}

function errorApi(
  mensaje: string,
  estado?: number,
  datos?: unknown
): ErrorApi {
  const err = new Error(mensaje) as ErrorApi;
  if (estado !== undefined) err.status = estado;
  if (datos !== undefined) err.datos = datos;
  return err;
}

/** true cuando el backend rechazó el login porque el correo no está verificado. */
export function esErrorVerificacionPendiente(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const api = e as ErrorApi;
  return api.status === 403 && /verificar tu correo/i.test(api.message);
}

type Metodo = 'POST' | 'PUT' | 'PATCH';

/**
 * Única salida a la API. Si el cuerpo es FormData no se pone Content-Type
 * (el navegador añade el boundary); con `token` se manda el Bearer.
 */
async function enviar<T>(
  ruta: string,
  metodo: Metodo,
  cuerpo: unknown,
  token?: string
): Promise<T> {
  let respuesta: Response;

  const esFormData =
    typeof FormData !== 'undefined' && cuerpo instanceof FormData;

  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (!esFormData) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: esFormData ? cuerpo : JSON.stringify(cuerpo),
      // Sin esto el navegador descarta la cookie del refresh token que pone el
      // backend al iniciar sesión (la API está en otro origen).
      credentials: 'include',
    });
  } catch {
    throw new Error(
      SIN_CONEXION
    );
  }

  const texto = await respuesta.text();
  const datos = texto ? parsearJson(texto) : null;

  if (!respuesta.ok) {
    throw errorApi(
      mensajeDeError(datos, respuesta.status),
      respuesta.status,
      datos
    );
  }

  return datos as T;
}

function post<T>(ruta: string, cuerpo: unknown): Promise<T> {
  return enviar<T>(ruta, 'POST', cuerpo);
}

/**
 * Respuesta de POST /api/auth/login/google.
 *
 * - `sesion`: ig ya existía una cuenta vinculada a Google (tiene tipo_cuenta).
 * - `tipo-cuenta`: el usuario es nuevo; solo falta elegir PERSONA o NEGOCIO.
 * - `vinculacion`: ya existe una cuenta manual con ese correo; el backend
 *   envió un código (respuesta 202 / `requiere_vinculacion`) y hay que
 *   confirmarlo con `vincularSesionGoogle`.
 */
export type ResultadoLoginGoogle =
  | { caso: 'sesion'; sesion: Sesion }
  | { caso: 'tipo-cuenta'; idToken: string }
  | { caso: 'vinculacion'; idToken: string; correo: string; mensaje: string };

export async function obtenerSesionGoogle(
  idToken: string
): Promise<ResultadoLoginGoogle> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/api/auth/login/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
      credentials: 'include',
    });
  } catch {
    throw new Error(
      SIN_CONEXION
    );
  }

  const texto = await respuesta.text();
  const datos = texto ? parsearJson(texto) : null;

  const cuerpo = (datos ?? {}) as {
    requiere_vinculacion?: unknown;
    correo?: string;
    mensaje?: string;
  };

  if (
    respuesta.status === 202 ||
    cuerpo.requiere_vinculacion === true
  ) {
    return {
      caso: 'vinculacion',
      idToken,
      correo: cuerpo.correo ?? '',
      mensaje:
        cuerpo.mensaje ??
        'Ya existe una cuenta con este correo. Te enviamos un código para vincularla.',
    };
  }

  // Usuario nuevo: el backend responde 400 pidiendo tipo_cuenta para crear la cuenta.
  if (
    respuesta.status === 400 &&
    mensajeDeError(datos, respuesta.status).includes('tipo_cuenta')
  ) {
    return { caso: 'tipo-cuenta', idToken };
  }

  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, respuesta.status));
  }

  const sesion = datos as Sesion;
  if (sesion?.usuario?.tipo_cuenta) {
    return { caso: 'sesion', sesion };
  }

  return { caso: 'tipo-cuenta', idToken };
}

/** POST /api/auth/login/google/vincular → { id_token, codigo } */
export function vincularSesionGoogle(
  idToken: string,
  codigo: string
): Promise<Sesion> {
  return post<Sesion>('/api/auth/login/google/vincular', {
    id_token: idToken,
    codigo,
  });
}

/** POST /api/auth/login/google  → { id_token, tipo_cuenta } */
export function loginConGoogle(
  idToken: string,
  tipoCuenta: TipoCuenta,
  consentimiento: Consentimiento,
  negocio: DatosRegistroNegocio | null = null
): Promise<Sesion> {
  if (negocio) {
    return post<Sesion>(
      '/api/auth/login/google',
      llenarFormGoogle(idToken, tipoCuenta, consentimiento, negocio)
    );
  }

  return post<Sesion>('/api/auth/login/google', {
    id_token: idToken,
    tipo_cuenta: tipoCuenta,
    acepta_terminos_version: consentimiento.terminos_version,
    acepta_privacidad_version: consentimiento.privacidad_version,
  });
}

function llenarFormBase(
  tipoCuenta: TipoCuenta,
  negocio: DatosRegistroNegocio,
  consentimiento: Consentimiento,
  form: FormData
): void {
  const redes = Object.entries(negocio.redes_sociales).filter(
    ([, valor]) => valor.trim()
  );
  const horario = negocio.horario_atencion.filter(
    (dia) => dia.apertura && dia.cierre
  );

  form.append('tipo_cuenta', tipoCuenta);
  form.append('acepta_terminos_version', String(consentimiento.terminos_version));
  form.append('acepta_privacidad_version', String(consentimiento.privacidad_version));
  form.append('nombre_comercial', negocio.nombre_comercial);
  form.append('categoria', negocio.categoria);
  form.append('descripcion_breve', negocio.descripcion_breve);
  if (negocio.logo) form.append('logo', negocio.logo);
  form.append('provincia', negocio.provincia);
  form.append('ciudad', negocio.ciudad);
  form.append('sector', negocio.sector);
  form.append('tiene_local', String(negocio.tiene_local));
  form.append('direccion_local', negocio.direccion_local);
  form.append('zona_cobertura', negocio.zona_cobertura);
  if (negocio.latitud !== null) {
    form.append('latitud', String(negocio.latitud));
  }
  if (negocio.longitud !== null) {
    form.append('longitud', String(negocio.longitud));
  }
  form.append('telefono', negocio.telefono);
  form.append('whatsapp', negocio.whatsapp);
  form.append('correo_contacto', negocio.correo_contacto);
  form.append('entrega_domicilio', String(negocio.entrega_domicilio));
  form.append('redes_sociales', JSON.stringify(Object.fromEntries(redes)));
  form.append(
    'horario_atencion',
    JSON.stringify(
      horario.map((dia) => ({
        dia: dia.dia,
        apertura: dia.apertura,
        cierre: dia.cierre,
      }))
    )
  );
}

function llenarFormGoogle(
  idToken: string,
  tipoCuenta: TipoCuenta,
  consentimiento: Consentimiento,
  negocio: DatosRegistroNegocio
): FormData {
  const form = new FormData();
  form.append('id_token', idToken);
  llenarFormBase(tipoCuenta, negocio, consentimiento, form);
  return form;
}

/** GET /api/auth/politicas → políticas (términos y privacidad) vigentes */
export async function obtenerPoliticas(): Promise<PoliticaVigente[]> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/api/auth/politicas`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(
      SIN_CONEXION
    );
  }

  const texto = await respuesta.text();
  const datos = texto ? parsearJson(texto) : null;

  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, respuesta.status));
  }

  const politicas = (datos as { politicas?: PoliticaVigente[] })?.politicas;
  return Array.isArray(politicas) ? politicas : [];
}

/** GET /api/auth/categorias → { categorias: [{ id, nombre }] } */
export async function obtenerCategorias(): Promise<Categoria[]> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/api/auth/categorias`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(
      SIN_CONEXION
    );
  }

  const texto = await respuesta.text();
  const datos = texto ? parsearJson(texto) : null;

  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos, respuesta.status));
  }

  const categorias = (datos as { categorias?: Categoria[] })?.categorias;
  return Array.isArray(categorias) ? categorias : [];
}

/** POST /api/auth/correo-existe → { existe: boolean } */
export function verificarCorreoExiste(
  correo: string
): Promise<{ existe: boolean }> {
  return post<{ existe: boolean }>('/api/auth/correo-existe', { correo });
}

/**
 * Respuesta de POST /api/auth/registro (registro manual).
 * La cuenta se crea pero queda sin verificar: el backend envía un código por
 * correo y esta respuesta NO trae tokens de sesión.
 */
export interface RespuestaRegistro {
  mensaje: string;
  usuario: {
    id: number;
    correo: string;
    nombres: string;
    apellidos: string | null;
    tipo_cuenta: TipoCuenta;
    foto_perfil: string | null;
  };
}

/** POST /api/auth/registro → registro manual (correo + contraseña) */
export function registroManual(
  datos: DatosRegistroManual,
  tipoCuenta: TipoCuenta,
  consentimiento: Consentimiento,
  foto: File | null = null,
  negocio: DatosRegistroNegocio | null = null
): Promise<RespuestaRegistro> {
  if (negocio) {
    const cuerpo = new FormData();
    cuerpo.append('correo', datos.correo);
    cuerpo.append('contrasena', datos.contrasena);
    cuerpo.append('nombres', datos.nombres);
    cuerpo.append('apellidos', datos.apellidos);
    if (foto) cuerpo.append('foto_perfil', foto);
    llenarFormBase(tipoCuenta, negocio, consentimiento, cuerpo);
    return post<RespuestaRegistro>('/api/auth/registro', cuerpo);
  }

  if (foto) {
    const cuerpo = new FormData();
    cuerpo.append('tipo_cuenta', tipoCuenta);
    cuerpo.append('correo', datos.correo);
    cuerpo.append('contrasena', datos.contrasena);
    cuerpo.append('nombres', datos.nombres);
    cuerpo.append('apellidos', datos.apellidos);
    cuerpo.append('foto_perfil', foto);
    cuerpo.append(
      'acepta_terminos_version',
      String(consentimiento.terminos_version)
    );
    cuerpo.append(
      'acepta_privacidad_version',
      String(consentimiento.privacidad_version)
    );
    return post<RespuestaRegistro>('/api/auth/registro', cuerpo);
  }

  return post<RespuestaRegistro>('/api/auth/registro', {
    tipo_cuenta: tipoCuenta,
    correo: datos.correo,
    contrasena: datos.contrasena,
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    acepta_terminos_version: consentimiento.terminos_version,
    acepta_privacidad_version: consentimiento.privacidad_version,
  });
}

/**
 * POST /api/auth/verificar-correo → devuelve la sesión si el código es válido.
 * `mantenerSesion` decide si la cookie del refresh token sobrevive al cierre
 * del navegador.
 */
export function verificarCorreo(
  correo: string,
  codigo: string,
  mantenerSesion = true
): Promise<Sesion> {
  return post<Sesion>('/api/auth/verificar-correo', {
    correo,
    codigo,
    mantener_sesion: mantenerSesion,
  });
}

/** POST /api/auth/reenviar-verificacion → envía un nuevo código al correo. */
export function reenviarVerificacion(
  correo: string
): Promise<{ mensaje: string }> {
  return post<{ mensaje: string }>('/api/auth/reenviar-verificacion', {
    correo,
  });
}

/** POST /api/auth/solicitar-recuperacion → envía el código de recuperación. */
export function solicitarRecuperacion(
  correo: string
): Promise<{ mensaje: string }> {
  return post<{ mensaje: string }>('/api/auth/solicitar-recuperacion', {
    correo,
  });
}

/** POST /api/auth/verificar-codigo-recuperacion → valida el código sin consumirlo. */
export function verificarCodigoRecuperacion(
  correo: string,
  codigo: string
): Promise<{ mensaje: string }> {
  return post<{ mensaje: string }>('/api/auth/verificar-codigo-recuperacion', {
    correo,
    codigo,
  });
}

/** POST /api/auth/restablecer-contrasena → cambia la contraseña. */
export function restablecerContrasena(
  correo: string,
  codigo: string,
  nuevaContrasena: string
): Promise<{ mensaje: string }> {
  return post<{ mensaje: string }>('/api/auth/restablecer-contrasena', {
    correo,
    codigo,
    nueva_contrasena: nuevaContrasena,
  });
}

/** POST /api/auth/login → login manual */
export function loginManual(
  correo: string,
  contrasena: string,
  mantenerSesion = true
): Promise<Sesion> {
  return post<Sesion>('/api/auth/login', {
    correo,
    contrasena,
    mantener_sesion: mantenerSesion,
  });
}

/**
 * Resultado de completar el registro (usuario ya eligió PERSONA/NEGOCIO).
 *
 * - `sesion`: la cuenta quedó verificada por el proveedor (Google) y el login
 *   fue automático.
 * - `verificacion`: la cuenta (manual) se creó pero aún falta confirmar el
 *   correo con el código que se envió a `correo`.
 */
export type ResultadoRegistro =
  | { caso: 'sesion'; sesion: Sesion }
  | { caso: 'verificacion'; correo: string; mensaje: string };

export async function completarRegistro(
  pendiente: RegistroPendiente,
  tipoCuenta: TipoCuenta,
  consentimiento: Consentimiento,
  foto: File | null = null,
  negocio: DatosRegistroNegocio | null = null
): Promise<ResultadoRegistro> {
  switch (pendiente.proveedor) {
    case 'google':
      return {
        caso: 'sesion',
        sesion: await loginConGoogle(
          pendiente.id_token,
          tipoCuenta,
          consentimiento,
          negocio
        ),
      };
    case 'manual': {
      const resultado = await registroManual(
        pendiente,
        tipoCuenta,
        consentimiento,
        foto,
        negocio
      );
      return {
        caso: 'verificacion',
        correo: resultado.usuario.correo,
        mensaje: resultado.mensaje,
      };
    }
  }
}

/**
 * GET /api/auth/me → perfil ampliado del usuario (negocio, verificación,
 * proveedores, fechas, etc.).
 *
 * Ya no recibe token: lo toma del motor, que lo refresca si hace falta. Si el
 * refresh token también fue rechazado, el motor cierra la sesión y este error
 * sale con status 401 para que la pantalla distinga "sesión caída" de "sin
 * conexión".
 */
export function obtenerMiPerfil(): Promise<PerfilRespuesta> {
  return enviarAutenticado<PerfilRespuesta>('/api/auth/me', 'GET');
}

/**
 * Un 401/403 en un endpoint con Bearer casi siempre es sesión caducada, no
 * "correo o contraseña incorrectos" (ese texto es genérico de `mensajeDeError`).
 */
function comoSesionCaducada(e: unknown): never {
  const estado = estadoDe(e);
  if (estado === 401 || estado === 403) {
    throw errorApi(
      'Tu sesión caducó. Vuelve a iniciar sesión para continuar.',
      401
    );
  }
  throw e;
}

function llenarFormPerfil(
  cambios: CambiosPerfil,
  imagenes: ImagenesPerfil,
  form: FormData
): void {
  for (const [campo, valor] of Object.entries(cambios)) {
    if (valor === undefined) continue;
    // En multipart todo llega como texto. Un objeto con `String()` sale como
    // "[object Object]" y el backend no tiene forma de parsearlo, así que estos
    // tres van como JSON: los dos del negocio y el contacto del usuario.
    if (
      campo === 'redes_sociales' ||
      campo === 'horario_atencion' ||
      campo === 'contacto' ||
      campo === 'privacidad_perfil'
    ) {
      form.append(campo, JSON.stringify(valor));
    } else {
      form.append(campo, String(valor));
    }
  }

  // Un archivo nuevo reemplaza al anterior; "eliminar" solo si no hay ninguno.
  if (imagenes.fotoPerfil) {
    form.append('foto_perfil', imagenes.fotoPerfil);
  } else if (imagenes.eliminarFotoPerfil) {
    form.append('eliminar_foto_perfil', 'true');
  }

  if (imagenes.logo) {
    form.append('logo', imagenes.logo);
  } else if (imagenes.eliminarLogo) {
    form.append('eliminar_logo', 'true');
  }

  if (imagenes.fotoPortada) {
    form.append('foto_portada', imagenes.fotoPortada);
  } else if (imagenes.eliminarFotoPortada) {
    form.append('eliminar_foto_portada', 'true');
  }
}

/**
 * PATCH /api/auth/perfil → actualiza el perfil.
 *
 * `cambios` debe traer solo lo que cambió: el backend ignora el resto y borra
 * los campos opcionales que llegan vacíos. Si hay imágenes o se pide quitar
 * alguna, el envío pasa a multipart/form-data.
 */
export function actualizarPerfil(
  cambios: CambiosPerfil,
  imagenes: ImagenesPerfil = {}
): Promise<RespuestaActualizarPerfil> {
  // La portada tiene que estar aquí igual que las otras dos imágenes. Faltaba,
  // así que al subirla sola se mandaba un JSON vacío y el backend respondía
  // "No se enviaron cambios": el archivo nunca salía del navegador.
  const hayImagenes = Boolean(
    imagenes.fotoPerfil ||
      imagenes.logo ||
      imagenes.fotoPortada ||
      imagenes.eliminarFotoPerfil ||
      imagenes.eliminarLogo ||
      imagenes.eliminarFotoPortada
  );

  let cuerpo: CambiosPerfil | FormData = cambios;
  if (hayImagenes) {
    const form = new FormData();
    llenarFormPerfil(cambios, imagenes, form);
    cuerpo = form;
  }

  return enviarAutenticado<RespuestaActualizarPerfil>(
    '/api/auth/perfil',
    'PATCH',
    cuerpo
  ).catch(comoSesionCaducada);
}

/**
 * PUT /api/auth/cambiar-contrasena → renueva la contraseña.
 *
 * Cerrar las otras sesiones no afecta a este dispositivo: la respuesta trae
 * tokens nuevos que hay que guardar para no perder la sesión.
 */
export function cambiarContrasena(
  datos: DatosCambioContrasena
): Promise<RespuestaCambioContrasena> {
  return enviarAutenticado<RespuestaCambioContrasena>(
    '/api/auth/cambiar-contrasena',
    'PUT',
    datos
  ).catch(comoSesionCaducada);
}

export { API_URL };
