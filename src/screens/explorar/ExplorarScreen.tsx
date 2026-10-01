import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import BaknazoLoader from '../../components/BaknazoLoader';
import { IconoChevron, IconoLupa, IconoPin } from '../../components/Iconos';
import { categoriasDe, useCatalogos, useResumenCatalogo } from '../../lib/catalogos';
import { ESTILO_PILAR, NOMBRE_PILAR, type Pilar } from '../../lib/pilares';

const DESCRIPCION: Record<Pilar, string> = {
  productos: 'Nuevos y de segunda mano, de gente de tu ciudad.',
  servicios: 'Oficios, reparaciones, clases y profesionales.',
  empleo: 'Vacantes y trabajos, con postulación en línea.',
};

/**
 * Explorar: el mapa de todo lo que hay en Baknazo.
 *
 * El feed responde "¿qué hay nuevo?"; esta pantalla responde "¿qué hay?". Cada
 * categoría dice cuántos anuncios tiene, para que nadie entre a una vacía, y
 * todo lleva al feed con el filtro ya puesto.
 */
export default function ExplorarScreen() {
  const navegar = useNavigate();
  const catalogos = useCatalogos();
  const resumen = useResumenCatalogo();
  const [texto, setTexto] = useState('');

  const ir = (params: Record<string, string>) => navegar(`/anuncios?${new URLSearchParams(params).toString()}`);

  return (
    <MarcoApp titulo="Explorar">
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pt-8">
        <header className="max-w-[640px]">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-foreground sm:text-[32px]">
            Explorar
          </h1>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            {resumen
              ? `${resumen.total.toLocaleString('es-EC')} anuncios activos en productos, servicios y empleo.`
              : 'Todo lo que se compra, se vende y se ofrece en Baknazo.'}
          </p>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (texto.trim()) ir({ q: texto.trim() });
            }}
          >
            <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-white px-4 text-muted focus-within:border-accent/60 focus-within:ring-[3px] focus-within:ring-accent/10">
              <IconoLupa />
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="¿Qué estás buscando?"
                aria-label="Buscar en Baknazo"
                className="h-full w-full bg-transparent text-[15px] text-foreground placeholder:text-muted focus:outline-none"
              />
            </label>
          </form>
        </header>

        <section className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-white p-5 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <IconoPin />
          </span>
          <div className="min-w-0 flex-1 basis-60">
            <h2 className="text-[16px] font-semibold text-foreground">Cerca de ti</h2>
            <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
              Ordena por distancia usando tu ubicación aproximada.
              {resumen && resumen.conUbicacion > 0 && ` ${resumen.conUbicacion} anuncios comparten su ubicación.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ir({ cerca: '25' })}
            className="h-10 shrink-0 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Ver lo cercano
          </button>
        </section>

        {(['productos', 'servicios', 'empleo'] as Pilar[]).map((pilar) => {
          const categorias = categoriasDe(catalogos, pilar);
          const total = categorias.reduce((s, c) => s + (resumen?.categorias[c.id] ?? 0), 0);
          const estilo = ESTILO_PILAR[pilar];
          return (
            <section key={pilar} className="mt-10" aria-labelledby={`seccion-${pilar}`}>
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
                <div>
                  <h2
                    id={`seccion-${pilar}`}
                    className="flex items-center gap-2.5 text-[20px] font-semibold tracking-tight text-foreground"
                  >
                    <span aria-hidden="true" className={`size-3 rounded-full ${estilo.punto}`} />
                    {NOMBRE_PILAR[pilar]}
                    {resumen && <span className="text-[14px] font-normal text-muted tabular-nums">{total}</span>}
                  </h2>
                  <p className="mt-0.5 text-[13.5px] text-muted">{DESCRIPCION[pilar]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => ir({ pilar })}
                  className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent hover:text-accent-dark"
                >
                  Ver todo
                  <IconoChevron derecha />
                </button>
              </div>

              {categorias.length === 0 ? (
                <BaknazoLoader tamano="seccion" mensaje="Cargando categorías" />
              ) : (
                <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {categorias.map((c) => {
                    const cuantos = resumen?.categorias[c.id] ?? 0;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => ir({ pilar, categoria: String(c.id) })}
                          className="group flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-white"
                        >
                          <span
                            aria-hidden="true"
                            className={`grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-semibold ${estilo.fondo} ${estilo.tinta}`}
                          >
                            {c.nombre.charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium text-foreground">{c.nombre}</span>
                            <span className="block text-[12.5px] text-muted">
                              {resumen ? (cuantos === 1 ? '1 anuncio' : `${cuantos} anuncios`) : ' '}
                            </span>
                          </span>
                          <span className="text-muted opacity-0 transition-opacity group-hover:opacity-100">
                            <IconoChevron derecha />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        {resumen && resumen.ciudades.length > 0 && (
          <section className="mt-10">
            <h2 className="border-b border-border pb-3 text-[20px] font-semibold tracking-tight text-foreground">
              Ciudades con más anuncios
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {resumen.ciudades.map((c) => (
                <button
                  key={c.codigo}
                  type="button"
                  onClick={() => ir({ provincia: c.codigo.slice(0, 2), canton: c.codigo })}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-[13.5px] font-medium text-foreground transition-colors hover:border-muted"
                >
                  {c.nombre}
                  <span className="text-[12px] text-muted tabular-nums">{c.total}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </MarcoApp>
  );
}
