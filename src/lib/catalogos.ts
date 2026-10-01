import { useEffect, useState } from 'react';
import { obtenerCatalogos, obtenerResumenCatalogo } from '../api/anuncios';
import type { Catalogos, Categoria, ResumenCatalogo } from '../types/anuncio';
import type { Pilar } from './pilares';

/**
 * Categorías, ciudades y cifras, pedidas una sola vez por pestaña.
 *
 * El menú lateral, los filtros del feed y Explorar necesitan lo mismo. Sin una
 * caché común, cada uno haría su propia petición al montarse, y el menú (que
 * está en todas las pantallas) la repetiría a cada navegación.
 */

let catalogos: Catalogos | null = null;
let pedidoCatalogos: Promise<Catalogos> | null = null;

function cargarCatalogos(): Promise<Catalogos> {
  if (!pedidoCatalogos) {
    pedidoCatalogos = obtenerCatalogos()
      .then((c) => (catalogos = c))
      .catch((e) => {
        // Un fallo no se queda cacheado: el siguiente que lo pida reintenta.
        pedidoCatalogos = null;
        throw e;
      });
  }
  return pedidoCatalogos;
}

/** Las cifras cambian con cada publicación: se renuevan cada minuto. */
const VIGENCIA_RESUMEN = 60_000;
let resumen: { datos: ResumenCatalogo; en: number } | null = null;
let pedidoResumen: Promise<ResumenCatalogo> | null = null;

function cargarResumen(): Promise<ResumenCatalogo> {
  if (resumen && Date.now() - resumen.en < VIGENCIA_RESUMEN) return Promise.resolve(resumen.datos);
  if (!pedidoResumen) {
    pedidoResumen = obtenerResumenCatalogo()
      .then((datos) => {
        resumen = { datos, en: Date.now() };
        return datos;
      })
      .finally(() => {
        pedidoResumen = null;
      });
  }
  return pedidoResumen;
}

export function useCatalogos(): Catalogos | null {
  const [valor, setValor] = useState<Catalogos | null>(catalogos);
  useEffect(() => {
    if (catalogos) return;
    let vivo = true;
    cargarCatalogos()
      .then((c) => {
        if (vivo) setValor(c);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return valor;
}

export function useResumenCatalogo(): ResumenCatalogo | null {
  const [valor, setValor] = useState<ResumenCatalogo | null>(resumen?.datos ?? null);
  useEffect(() => {
    let vivo = true;
    cargarResumen()
      .then((r) => {
        if (vivo) setValor(r);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return valor;
}

export function categoriasDe(c: Catalogos | null, pilar: Pilar): Categoria[] {
  return (c?.categorias ?? []).filter((cat) => cat.pilar === pilar);
}

export function nombreDeCanton(c: Catalogos | null, codigo: string | undefined): string | null {
  if (!c || !codigo) return null;
  for (const provincia of c.provincias) {
    const canton = provincia.cantones.find((x) => x.codigo === codigo);
    if (canton) return canton.nombre;
  }
  return null;
}
