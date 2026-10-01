import { createContext, useContext } from 'react';
import type { PerfilUsuario, Sesion } from '../types/auth';

/**
 * Lo que la navegación de la app necesita saber, en un solo sitio.
 *
 * Antes cada pantalla recibía por props la sesión, el perfil y cinco callbacks
 * para pasárselos a su propio menú. Una pantalla que olvidaba uno (Mis anuncios
 * no pasaba `onAbrirPerfil`; Configuración, Publicar y Editar no tenían menú)
 * dejaba un botón que no hacía nada. Con un contexto, el menú lee lo mismo en
 * todas partes y no hay prop que se pueda quedar por el camino.
 */
export interface Navegacion {
  sesion: Sesion | null;
  perfil: PerfilUsuario | null;
  irAlFeed: () => void;
  irAMisAnuncios: () => void;
  irAPublicar: () => void;
  irAConfiguracion: () => void;
  irAExplorar: () => void;
  irAPostulaciones: () => void;
  irAGuardados: () => void;
  /** Al perfil propio. Usa el id de la sesión: no espera a que cargue GET /me. */
  irAMiPerfil: () => void;
  irAlLogin: () => void;
  cerrarSesion: () => void;
}

export const NavegacionContexto = createContext<Navegacion | null>(null);

export function useNavegacion(): Navegacion {
  const valor = useContext(NavegacionContexto);
  if (!valor) throw new Error('useNavegacion necesita <NavegacionContexto.Provider>.');
  return valor;
}

const CLAVE_MENU = 'bkn:menu-lateral';

/** Si el menú lateral de escritorio está desplegado. Por defecto, sí. */
export function leerMenuVisible(): boolean {
  try {
    return localStorage.getItem(CLAVE_MENU) !== 'oculto';
  } catch {
    return true;
  }
}

export function guardarMenuVisible(visible: boolean): void {
  try {
    localStorage.setItem(CLAVE_MENU, visible ? 'visible' : 'oculto');
  } catch {
    /* Modo privado o almacenamiento lleno: se pierde solo la preferencia. */
  }
}
