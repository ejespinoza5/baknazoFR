import type { OpcionSelector } from '../components/Selector';
import type { Catalogos } from '../types/anuncio';

/** Los cantones agrupados por provincia: buscar la provincia muestra todos los suyos. */
export function opcionesCiudad(catalogos: Pick<Catalogos, 'provincias'>): OpcionSelector[] {
  return catalogos.provincias.flatMap((p) => p.cantones.map((c) => ({ valor: c.codigo, texto: c.nombre, grupo: p.nombre })));
}

/** Las provincias, para los filtros que van por provincia y luego cantón. */
export function opcionesProvincia(catalogos: Pick<Catalogos, 'provincias'>): OpcionSelector[] {
  return catalogos.provincias.map((p) => ({ valor: p.codigo, texto: p.nombre }));
}

/** Una lista simple de textos (los mismos como valor y como etiqueta). */
export function opcionesTexto(lista: readonly string[]): OpcionSelector[] {
  return lista.map((t) => ({ valor: t, texto: t }));
}
