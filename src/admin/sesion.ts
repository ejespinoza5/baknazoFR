import { createContext, useContext } from 'react';
import type { Administrador, Catalogos, Permiso } from './tipos';

/** Quién está dentro del panel y qué puede hacer. */
export interface SesionAdmin {
  admin: Administrador;
  catalogos: Catalogos | null;
  actualizar: (admin: Administrador) => void;
  salir: () => Promise<void>;
  /** Para pintar u ocultar. La comprobación de verdad la hace el servidor. */
  puede: (permiso: Permiso) => boolean;
}

export const SesionAdminContexto = createContext<SesionAdmin | null>(null);

export function useSesionAdmin(): SesionAdmin {
  const s = useContext(SesionAdminContexto);
  if (!s) throw new Error('useSesionAdmin necesita <SesionAdminContexto.Provider>.');
  return s;
}
