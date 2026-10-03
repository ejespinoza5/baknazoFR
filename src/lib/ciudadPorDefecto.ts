import type { Catalogos } from '../types/anuncio';
import type { PerfilUsuario } from '../types/auth';

/**
 * La ciudad que aparece ya elegida al publicar. Casi todo el mundo publica
 * siempre desde la misma, así que se recuerda la última usada. Sin ella, un
 * negocio parte de la ciudad que dio al registrarse.
 */

const CLAVE = 'bkn:ultima-ciudad';

export function ciudadRecordada(): string {
  try {
    return localStorage.getItem(CLAVE) ?? '';
  } catch {
    return '';
  }
}

export function recordarCiudad(codigo: string): void {
  try {
    if (codigo) localStorage.setItem(CLAVE, codigo);
  } catch {
    /* sin almacenamiento, la próxima vez se elige a mano */
  }
}

const normal = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** El cantón del catálogo que corresponde a la ciudad (texto) del negocio. */
export function ciudadDelNegocio(perfil: PerfilUsuario | null, catalogos: Pick<Catalogos, 'provincias'>): string {
  const ciudad = perfil?.negocio?.ciudad;
  if (!ciudad) return '';
  const provincia = perfil?.negocio?.provincia ? normal(perfil.negocio.provincia) : null;
  const candidatas = provincia
    ? catalogos.provincias.filter((p) => normal(p.nombre) === provincia)
    : catalogos.provincias;
  for (const p of candidatas.length > 0 ? candidatas : catalogos.provincias) {
    const c = p.cantones.find((x) => normal(x.nombre) === normal(ciudad));
    if (c) return c.codigo;
  }
  return '';
}

/** Solo si el código existe en el catálogo cargado: uno viejo no se impone. */
export function ciudadValida(codigo: string, catalogos: Pick<Catalogos, 'provincias'>): boolean {
  return Boolean(codigo) && catalogos.provincias.some((p) => p.cantones.some((c) => c.codigo === codigo));
}
