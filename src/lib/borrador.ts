/**
 * Borrador del registro.
 *
 * El registro son varias pantallas y un código de verificación: si algo falla
 * o el usuario recarga, perder el nombre comercial y el horario escritos le
 * obliga a empezar de cero. El borrador vive en sessionStorage porque pertenece
 * a esta pestaña: en un dispositivo compartido no debe reaparecer al día
 * siguiente.
 *
 * Lo que NO se serializa son los archivos. Un `File` no existe en JSON, así
 * que se guardan aparte, en memoria del módulo, mientras la pestaña siga viva.
 * Un F5 real los pierde, y es una limitación conocida y aceptada: las fotos se
 * vuelven a elegir, pero el texto no.
 */

import type { HorarioDia, TipoCuenta } from '../types/auth';

const CLAVE = 'baknazo.borrador.registro';

export interface RedBorrador {
  nombre: string;
  url: string;
}

export interface Borrador {
  tipoCuenta: TipoCuenta | null;
  nombreComercial: string;
  categoria: string;
  descripcion: string;
  provincia: string;
  ciudad: string;
  /** El reverse geocoding devolvió algo que no está en el catálogo: se pide a mano. */
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
  redes: RedBorrador[];
  horario: HorarioDia[];
  diaQueSeAgrega: string;
  aperturaNueva: string;
  cierreNuevo: string;
}

const VACIO: Borrador = {
  tipoCuenta: null,
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
  redes: [],
  horario: [],
  diaQueSeAgrega: '',
  aperturaNueva: '',
  cierreNuevo: '',
};

/** Archivos de la sesión: `File` no sobrevive a `JSON.stringify`. */
const archivos = new Map<string, File | null>();

function leer(): Partial<Borrador> {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return {};
    const dato = JSON.parse(crudo) as Partial<Borrador>;
    return dato && typeof dato === 'object' ? dato : {};
  } catch {
    return {};
  }
}

/** Lo guardado, con los valores por defecto de los huecos que falten. */
export function borradorInicial(): Borrador {
  return { ...VACIO, ...leer() };
}

/** Mezcla: cada pantalla escribe solo los campos que suya. */
export function guardarBorrador(parcial: Partial<Borrador>): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...leer(), ...parcial }));
  } catch {
    // Modo privado o storage bloqueado: se registra sin borrador, nada más.
  }
}

export function registrarArchivo(clave: string, archivo: File | null): void {
  archivos.set(clave, archivo);
}

export function archivoRegistrado(clave: string): File | null {
  return archivos.get(clave) ?? null;
}

export function limpiarBorrador(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // sin storage no hay nada que borrar
  }
  archivos.clear();
}
