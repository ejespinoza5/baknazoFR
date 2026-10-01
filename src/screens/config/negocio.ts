import { correoEsValido } from '../../lib/password';
import { CANTONES_DE, PROVINCIAS_EC } from '../../data/ecuador';
import type { CambiosPerfil, HorarioDia, NegocioDetalle } from '../../types/auth';

export const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;
export const EXTENSIONES_IMAGEN = /\.(jpe?g|png|webp|avif)$/i;
export const MAX_DESCRIPCION = 500;

const PATRON_TELEFONO = /^[+\d\s()-]{7,20}$/;

export const DIAS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const REDES_PREDEFINIDAS = [
  { nombre: 'Instagram', url: '' },
  { nombre: 'Facebook', url: '' },
  { nombre: 'TikTok', url: '' },
  { nombre: 'YouTube', url: '' },
];

/** Estado del formulario de negocio: los mismos campos que pide el registro. */
export interface EstadoNegocio {
  nombreComercial: string;
  categoria: string;
  descripcion: string;
  provincia: string;
  ciudad: string;
  provinciaOtro: boolean;
  ciudadOtro: boolean;
  sector: string;
  tieneLocal: boolean;
  direccionLocal: string;
  zonaCobertura: string;
  latitud: string;
  longitud: string;
  telefono: string;
  whatsapp: string;
  correoContacto: string;
  entregaDomicilio: boolean;
  redes: { nombre: string; url: string }[];
  horario: HorarioDia[];
  apertura: string;
  cierre: string;
  diaQueSeAgrega: string;
}

const VACIO: EstadoNegocio = {
  nombreComercial: '',
  categoria: '',
  descripcion: '',
  provincia: '',
  ciudad: '',
  provinciaOtro: false,
  ciudadOtro: false,
  sector: '',
  tieneLocal: false,
  direccionLocal: '',
  zonaCobertura: '',
  latitud: '',
  longitud: '',
  telefono: '',
  whatsapp: '',
  correoContacto: '',
  entregaDomicilio: false,
  redes: REDES_PREDEFINIDAS,
  horario: [],
  apertura: '',
  cierre: '',
  diaQueSeAgrega: 'Lunes',
};

/** Estado inicial a partir del negocio que devolvió GET /api/auth/me. */
export function estadoDesdeNegocio(
  negocio: NegocioDetalle | null
): EstadoNegocio {
  if (!negocio) {
    return { ...VACIO, redes: REDES_PREDEFINIDAS.map((r) => ({ ...r })) };
  }

  const provincia = negocio.provincia ?? '';
  const ciudad = negocio.ciudad ?? '';
  const provinciaConocida = Object.keys(PROVINCIAS_EC).includes(provincia);
  const cantonConocido =
    provinciaConocida && CANTONES_DE(provincia).includes(ciudad);

  const redes = Object.entries(negocio.redes_sociales ?? {})
    .map(([nombre, url]) => ({ nombre, url: url ?? '' }))
    .filter((red) => red.nombre);

  const horario = (negocio.horario_atencion ?? []).map((dia) => ({
    dia: dia.dia,
    apertura: dia.apertura ?? '',
    cierre: dia.cierre ?? '',
  }));

  return {
    nombreComercial: negocio.nombre_comercial ?? '',
    categoria: negocio.categoria?.id ?? '',
    descripcion: negocio.descripcion_breve ?? '',
    provincia,
    ciudad,
    provinciaOtro: Boolean(provincia) && !provinciaConocida,
    ciudadOtro: Boolean(ciudad) && !cantonConocido,
    sector: negocio.sector ?? '',
    tieneLocal: Boolean(negocio.tiene_local),
    direccionLocal: negocio.direccion_local ?? '',
    zonaCobertura: negocio.zona_cobertura ?? '',
    latitud: negocio.latitud === null ? '' : String(negocio.latitud),
    longitud: negocio.longitud === null ? '' : String(negocio.longitud),
    telefono: negocio.telefono ?? '',
    whatsapp: negocio.whatsapp ?? '',
    correoContacto: negocio.correo_contacto ?? '',
    entregaDomicilio: Boolean(negocio.entrega_domicilio),
    redes: redes.length ? redes : REDES_PREDEFINIDAS.map((r) => ({ ...r })),
    horario,
    apertura: horario[0]?.apertura ?? '',
    cierre: horario[0]?.cierre ?? '',
    diaQueSeAgrega: 'Lunes',
  };
}

function telefonoValido(valor: string): boolean {
  return valor.trim() === '' || PATRON_TELEFONO.test(valor.trim());
}

/** Las mismas validaciones que aplica el backend en el registro. */
export function validarNegocio(estado: EstadoNegocio): string | null {
  if (!estado.nombreComercial.trim())
    return 'Escribe el nombre comercial de tu negocio.';
  if (!estado.categoria) return 'Elige la categoría de tu negocio.';
  if (estado.descripcion.trim().length > MAX_DESCRIPCION)
    return `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`;
  if (!telefonoValido(estado.telefono))
    return 'El teléfono debe tener entre 7 y 20 caracteres: +, dígitos, espacios, - o ().';
  if (!telefonoValido(estado.whatsapp))
    return 'El WhatsApp debe tener el mismo formato que el teléfono.';
  if (estado.correoContacto.trim() && !correoEsValido(estado.correoContacto))
    return 'Escribe un correo de contacto válido o déjalo vacío.';

  if (estado.tieneLocal && !estado.direccionLocal.trim())
    return 'Como marcas que tienes local, escribe la dirección.';
  if (!estado.tieneLocal && !estado.zonaCobertura.trim())
    return 'Como no tienes local, indica tu zona de cobertura.';

  const lat = estado.latitud.trim() ? Number(estado.latitud) : null;
  const lng = estado.longitud.trim() ? Number(estado.longitud) : null;
  if (
    lat === null ||
    lng === null ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return 'La latitud (entre -90 y 90) y la longitud (entre -180 y 180) son obligatorias. Elige un punto en el mapa o usa tu ubicación.';
  }

  return null;
}

function redesLimpias(redes: EstadoNegocio['redes']): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const red of redes) {
    const nombre = red.nombre.trim();
    const url = red.url.trim();
    if (nombre && url) salida[nombre] = url;
  }
  return salida;
}

function redesOrdenadas(redes: Record<string, string> | null) {
  return Object.fromEntries(
    Object.entries(redes ?? {})
      .map(([nombre, url]) => [nombre.trim(), (url ?? '').trim()])
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function ordenarHorario(dias: HorarioDia[]): HorarioDia[] {
  return [...dias].sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia));
}

/** Claves de CambiosPerfil cuyo valor es texto (el `-?` quita el undefined). */
type CampoTexto = {
  [K in keyof CambiosPerfil]-?: CambiosPerfil[K] extends string | undefined
    ? K
    : never;
}[keyof CambiosPerfil];

/**
 * Compara el formulario contra lo que devolvió el servidor y devuelve solo
 * los campos que cambiaron: el PATCH ignora el resto y un "" borra el campo.
 */
export function cambiosNegocio(
  estado: EstadoNegocio,
  original: NegocioDetalle | null
): CambiosPerfil {
  const cambios: CambiosPerfil = {};
  const previo = original;

  const ponerTexto = (
    campo: CampoTexto,
    valor: string,
    antes: string | null | undefined
  ) => {
    if (valor !== (antes ?? '').trim()) cambios[campo] = valor;
  };

  ponerTexto('nombre_comercial', estado.nombreComercial, previo?.nombre_comercial);
  ponerTexto('descripcion_breve', estado.descripcion, previo?.descripcion_breve);
  ponerTexto('provincia', estado.provincia, previo?.provincia);
  ponerTexto('ciudad', estado.ciudad, previo?.ciudad);
  ponerTexto('sector', estado.sector, previo?.sector);
  ponerTexto('direccion_local', estado.direccionLocal, previo?.direccion_local);
  ponerTexto('zona_cobertura', estado.zonaCobertura, previo?.zona_cobertura);
  ponerTexto('telefono', estado.telefono, previo?.telefono);
  ponerTexto('whatsapp', estado.whatsapp, previo?.whatsapp);
  ponerTexto('correo_contacto', estado.correoContacto, previo?.correo_contacto);

  if (estado.categoria !== (previo?.categoria?.id ?? ''))
    cambios.categoria = estado.categoria;
  if (estado.tieneLocal !== Boolean(previo?.tiene_local))
    cambios.tiene_local = estado.tieneLocal;
  if (estado.entregaDomicilio !== Boolean(previo?.entrega_domicilio))
    cambios.entrega_domicilio = estado.entregaDomicilio;

  const lat = estado.latitud.trim() ? Number(estado.latitud) : null;
  const lng = estado.longitud.trim() ? Number(estado.longitud) : null;
  if (lat !== null && lat !== (previo?.latitud ?? null)) cambios.latitud = lat;
  if (lng !== null && lng !== (previo?.longitud ?? null)) cambios.longitud = lng;

  const redes = redesLimpias(estado.redes);
  if (
    JSON.stringify(redesOrdenadas(redes)) !==
    JSON.stringify(redesOrdenadas(previo?.redes_sociales ?? null))
  ) {
    cambios.redes_sociales = redes;
  }

  const horario = estado.horario.filter((dia) => dia.apertura && dia.cierre);
  if (
    JSON.stringify(ordenarHorario(horario)) !==
    JSON.stringify(ordenarHorario(previo?.horario_atencion ?? []))
  ) {
    cambios.horario_atencion = horario.map((dia) => ({ ...dia }));
  }

  return cambios;
}
