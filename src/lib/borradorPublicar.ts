/**
 * Borrador del formulario de publicación.
 *
 * Un F5 no debería tirar a la basura veinte minutos de escritura, y la
 * pantalla de publicación ya se recuerda entre recargas. Se guarda en
 * sessionStorage a propósito: el borrador pertenece a esta pestaña y no debe
 * aparecer en un móvil compartido al día siguiente.
 *
 * Lo que NO se guarda son las fotos. Un `File` no se serializa y copiarlo a un
 * blob ocuparía justo el espacio que el usuario no quiere gastar en el móvil.
 * Es la misma limitación que el registro: las fotos se vuelven a elegir, el
 * texto se conserva.
 */

import type { PreguntaEmpleo } from '../types/anuncio';

const CLAVE = 'baknazo.borrador.publicar';

/** Los campos de texto del formulario, sin los `File`. */
export interface BorradorPublicar {
  pilar: string;
  titulo: string;
  categoriaId: number | '';
  cantonCodigo: string;
  descripcion: string;
  precio: string;
  condicion: string;
  modalidadCobro: string;
  jornada: string;
  modalidad: string;
  /** El cuestionario de una vacante: lo que más cuesta volver a escribir. */
  modoPostulacion: 'rapida' | 'cuestionario';
  preguntas: PreguntaEmpleo[];
  /** Sí se recuerda: es una decisión del usuario y no se quiere perder al F5. */
  mostrarTelefono: boolean;
}

const VACIO: BorradorPublicar = {
  pilar: 'productos',
  titulo: '',
  categoriaId: '',
  cantonCodigo: '',
  descripcion: '',
  precio: '',
  condicion: '',
  modalidadCobro: '',
  jornada: '',
  modalidad: '',
  modoPostulacion: 'rapida',
  preguntas: [],
  mostrarTelefono: false,
};

/** Texto y sin comillas: un borrador a medio escribir no merece un string. */
function tieneContenido(b: BorradorPublicar): boolean {
  return (
    b.titulo.trim() !== '' ||
    b.descripcion.trim() !== '' ||
    b.precio.trim() !== '' ||
    b.categoriaId !== '' ||
    b.cantonCodigo !== '' ||
    b.condicion !== '' ||
    b.modalidadCobro !== '' ||
    b.jornada !== '' ||
    b.modalidad !== '' ||
    b.preguntas.length > 0
  );
}

export function leerBorrador(): BorradorPublicar | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const leido = {
      ...VACIO,
      ...(JSON.parse(crudo) as Partial<BorradorPublicar>),
    };
    // Un borrador escrito por otra versión de la app puede traer claves que ya
    // no existen o con el tipo cambiado; se reparan en vez de romper el formulario.
    for (const clave of Object.keys(leido) as (keyof BorradorPublicar)[]) {
      if (clave === 'categoriaId') {
        if (leido.categoriaId !== '' && typeof leido.categoriaId !== 'number') {
          leido.categoriaId = '';
        }
      } else if (clave === 'mostrarTelefono') {
        // Es el único booleano del borrador. La reparación general de abajo lo
        // volvería "" y una casilla con valor "" se desmarca sola; se le exige
        // un booleano de verdad.
        if (typeof leido.mostrarTelefono !== 'boolean') leido.mostrarTelefono = false;
      } else if (clave === 'modoPostulacion') {
        if (leido.modoPostulacion !== 'cuestionario') leido.modoPostulacion = 'rapida';
      } else if (clave === 'preguntas') {
        if (!Array.isArray(leido.preguntas)) leido.preguntas = [];
      } else if (typeof leido[clave] !== 'string') {
        leido[clave] = '';
      }
    }
    return tieneContenido(leido) ? leido : null;
  } catch {
    return null;
  }
}

export function guardarBorrador(b: BorradorPublicar): void {
  try {
    if (!tieneContenido(b)) {
      sessionStorage.removeItem(CLAVE);
      return;
    }
    sessionStorage.setItem(CLAVE, JSON.stringify(b));
  } catch {
    // Modo privado o storage bloqueado: se publica sin borrador, nada más.
  }
}

export function borrarBorrador(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // sin storage no hay nada que borrar
  }
}
