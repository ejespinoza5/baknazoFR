/** Cómo se lee cada acción de la auditoría. Lo usan Administradores y Auditoría. */
const TEXTO_ACCION: Record<string, string> = {
  'sesion.inicio': 'Inició sesión',
  'sesion.cierre': 'Cerró sesión',
  'cuenta.contrasena': 'Cambió su contraseña',
  'cuenta.perfil': 'Actualizó su perfil',
  'cuenta.cerrar_sesiones': 'Cerró sus otras sesiones',
  'anuncio.aprobar': 'Aprobó un anuncio',
  'anuncio.rechazar': 'Rechazó un anuncio',
  'anuncio.pausar': 'Pausó un anuncio',
  'anuncio.eliminar': 'Eliminó un anuncio',
  'denuncias.desestimar': 'Desestimó denuncias',
  'usuario.suspender': 'Suspendió a un usuario',
  'usuario.reactivar': 'Reactivó a un usuario',
  'admin.crear': 'Creó un administrador',
  'admin.editar': 'Editó un administrador',
  'admin.activar': 'Activó un administrador',
  'admin.desactivar': 'Desactivó un administrador',
  'admin.eliminar': 'Revocó un administrador',
  'admin.permisos': 'Cambió permisos',
  'admin.restablecer': 'Restableció una contraseña',
  'admin.inicial': 'Cuenta inicial creada',
  'admin.recuperacion': 'Recuperación desde el servidor',
  'moderacion.config': 'Cambió la configuración de moderación',
  'moderacion.palabra_agregar': 'Agregó un término',
  'moderacion.palabra_eliminar': 'Quitó un término',
  'soporte.responder': 'Respondió en soporte',
  'soporte.resolver': 'Marcó una consulta como resuelta',
  'soporte.reabrir': 'Reabrió una consulta de soporte',
};

export function textoAccion(accion: string): string {
  return TEXTO_ACCION[accion] ?? accion;
}
