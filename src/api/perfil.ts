import { enviarOpcional, enviarAutenticado } from './token';
import type {
  RespuestaPerfil,
  RespuestaAnunciosPerfil,
  RespuestaSeguidores,
} from '../types/perfil';

/**
 * GET /api/perfil/:id?limite=20&offset=0
 *
 * Perfil público con sus anuncios. Es pública, pero con sesión loSigues dice
 * si el visitante ya sigue a ese usuario.
 */
export function obtenerPerfil(
  id: string,
  limite = 20,
  offset = 0
): Promise<RespuestaPerfil> {
  return enviarOpcional<RespuestaPerfil>(
    `/api/perfil/${encodeURIComponent(id)}?limite=${limite}&offset=${offset}`
  );
}

/**
 * GET /api/perfil/:id/anuncios?limite=20&offset=20
 *
 * Páginas siguientes de anuncios sin volver a pedir todo el perfil.
 */
export function obtenerAnunciosPerfil(
  id: string,
  limite = 20,
  offset = 0
): Promise<RespuestaAnunciosPerfil> {
  return enviarOpcional<RespuestaAnunciosPerfil>(
    `/api/perfil/${encodeURIComponent(id)}/anuncios?limite=${limite}&offset=${offset}`
  );
}

/**
 * POST /api/perfil/:id/seguir
 *
 * Seguir a un usuario. Requiere sesión.
 */
export function seguirUsuario(id: string): Promise<{ seguidores: number }> {
  return enviarAutenticado<{ seguidores: number }>(
    `/api/perfil/${encodeURIComponent(id)}/seguir`,
    'POST'
  );
}

/**
 * DELETE /api/perfil/:id/seguir
 *
 * Dejar de seguir a un usuario. Requiere sesión.
 */
export function dejarDeSeguirUsuario(id: string): Promise<{ seguidores: number }> {
  return enviarAutenticado<{ seguidores: number }>(
    `/api/perfil/${encodeURIComponent(id)}/seguir`,
    'DELETE'
  );
}

/**
 * GET /api/perfil/:id/seguidores?limite=20&offset=0
 *
 * Lista de seguidores de un usuario.
 */
export function obtenerSeguidores(
  id: string,
  limite = 20,
  offset = 0
): Promise<RespuestaSeguidores> {
  return enviarOpcional<RespuestaSeguidores>(
    `/api/perfil/${encodeURIComponent(id)}/seguidores?limite=${limite}&offset=${offset}`
  );
}

/**
 * GET /api/perfil/:id/seguidos?limite=20&offset=0
 *
 * Lista de usuarios a los que sigue.
 */
export function obtenerSeguidos(
  id: string,
  limite = 20,
  offset = 0
): Promise<RespuestaSeguidores> {
  return enviarOpcional<RespuestaSeguidores>(
    `/api/perfil/${encodeURIComponent(id)}/seguidos?limite=${limite}&offset=${offset}`
  );
}
