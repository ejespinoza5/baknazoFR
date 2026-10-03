import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Emblema from '../../components/Emblema';
import IconoCategoria from '../../components/IconoCategoria';
import { IconoCerrar, IconoChevron, IconoMas, IconoMenu } from '../../components/Iconos';
import { useBloqueoScroll } from '../../lib/bloqueoScroll';
import { categoriasDe } from '../../lib/catalogos';
import { ESTILO_PILAR, NOMBRE_PILAR, type Pilar } from '../../lib/pilares';
import type { Catalogos, ResumenCatalogo } from '../../types/anuncio';
import { irASeccion, RUTA_ENTRAR, RUTA_REGISTRO } from './config';

const PILARES: Pilar[] = ['productos', 'servicios', 'empleo'];

const ENLACES = [
  { id: 'anuncios', texto: 'Anuncios' },
  { id: 'empleo', texto: 'Empleo' },
  { id: 'como-funciona', texto: 'Cómo funciona' },
  { id: 'seguridad', texto: 'Seguridad' },
];

/** Cuántos anuncios hay por pilar y por categoría, si el resumen ya llegó. */
function cuenta(resumen: ResumenCatalogo | null, ids: number[]): number | null {
  if (!resumen) return null;
  return ids.reduce((s, id) => s + (resumen.categorias[id] ?? 0), 0);
}

/**
 * La cabecera de la landing. Todo lo que se ve se puede usar sin cuenta,
 * menos publicar: ese botón explica en el sitio que hace falta una cuenta y
 * lleva a crearla, en vez de mandar al login sin decir por qué.
 */
export default function Cabecera({
  catalogos,
  resumen,
  onElegir,
}: {
  catalogos: Catalogos | null;
  resumen: ResumenCatalogo | null;
  onElegir: (pilar: Pilar, categoria?: number) => void;
}) {
  const navegar = useNavigate();
  const [panel, setPanel] = useState<'categorias' | 'publicar' | null>(null);
  const [cajon, setCajon] = useState(false);
  const [conSombra, setConSombra] = useState(false);
  const cabecera = useRef<HTMLElement>(null);

  useBloqueoScroll(cajon);

  useEffect(() => {
    const alDesplazar = () => setConSombra(window.scrollY > 8);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  /* Los paneles se cierran al tocar fuera o con Escape. */
  useEffect(() => {
    if (!panel && !cajon) return;
    const fuera = (e: PointerEvent) => {
      if (panel && !cabecera.current?.contains(e.target as Node)) setPanel(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPanel(null);
      setCajon(false);
    };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('keydown', tecla);
    };
  }, [panel, cajon]);

  const elegir = (pilar: Pilar, categoria?: number) => {
    setPanel(null);
    setCajon(false);
    onElegir(pilar, categoria);
  };

  const ir = (id: string) => {
    setPanel(null);
    setCajon(false);
    irASeccion(id);
  };

  return (
    <header
      ref={cabecera}
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        conSombra
          ? 'border-border bg-background/92 shadow-[0_8px_24px_-18px_rgba(31,41,55,0.35)] backdrop-blur-md'
          : 'border-transparent bg-background'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-2 px-4 sm:px-6 lg:h-[72px] lg:gap-6 lg:px-10">
        <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Baknazo, inicio">
          <Emblema tamano={34} />
          <span className="titular text-[22px] text-foreground">Baknazo</span>
        </a>

        {/* ---------- Escritorio ---------- */}
        <nav aria-label="Principal" className="ml-4 hidden items-center gap-1 lg:flex">
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'categorias' ? null : 'categorias'))}
            aria-expanded={panel === 'categorias'}
            aria-controls="panel-categorias"
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14.5px] font-medium transition-colors ${
              panel === 'categorias' ? 'bg-foreground text-white' : 'text-foreground hover:bg-white'
            }`}
          >
            Categorías
            <span className={`transition-transform duration-200 [&>svg]:size-4 ${panel === 'categorias' ? 'rotate-180' : ''}`}>
              <IconoChevron />
            </span>
          </button>
          {ENLACES.slice(1).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => ir(e.id)}
              className="h-10 rounded-full px-4 text-[14.5px] font-medium text-foreground transition-colors hover:bg-white"
            >
              {e.texto}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => navegar(RUTA_ENTRAR)}
            className="h-10 rounded-full px-3.5 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-white sm:px-4"
          >
            Entrar
          </button>
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'publicar' ? null : 'publicar'))}
              aria-expanded={panel === 'publicar'}
              aria-controls="aviso-publicar"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand pr-5 pl-4 text-[14.5px] font-semibold text-foreground shadow-[0_8px_20px_-10px_rgba(204,146,0,0.9)] transition-[background-color,transform] hover:bg-brand-dark active:scale-[0.98]"
            >
              <IconoMas />
              Publicar gratis
            </button>
            {panel === 'publicar' && <AvisoPublicar id="aviso-publicar" onCerrar={() => setPanel(null)} />}
          </div>
          <button
            type="button"
            onClick={() => setCajon(true)}
            aria-label="Abrir el menú"
            aria-expanded={cajon}
            className="grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-white lg:hidden"
          >
            <IconoMenu />
          </button>
        </div>
      </div>

      {/* ---------- Panel de categorías (escritorio) ---------- */}
      {panel === 'categorias' && (
        <div id="panel-categorias" className="animate-bkn-in absolute inset-x-0 top-full hidden border-b border-border bg-white shadow-[0_24px_48px_-28px_rgba(31,41,55,0.45)] lg:block">
          <div className="mx-auto grid max-w-[1320px] grid-cols-3 gap-10 px-10 py-8">
            {PILARES.map((p) => {
              const cats = categoriasDe(catalogos, p);
              const total = cuenta(resumen, cats.map((c) => c.id));
              return (
                <div key={p}>
                  <button
                    type="button"
                    onClick={() => elegir(p)}
                    className="group flex w-full items-baseline gap-2.5 border-b border-border pb-3 text-left"
                  >
                    <span aria-hidden="true" className={`size-2.5 shrink-0 translate-y-[-2px] rounded-full ${ESTILO_PILAR[p].punto}`} />
                    <span className="titular text-[22px] text-foreground group-hover:underline">{NOMBRE_PILAR[p]}</span>
                    {total !== null && <span className="ml-auto text-[13px] text-muted tabular-nums">{total.toLocaleString('es-EC')}</span>}
                  </button>
                  <ul className="mt-3 grid gap-0.5">
                    {cats.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => elegir(p, c.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[14px] text-foreground/90 transition-colors hover:bg-background hover:text-foreground"
                        >
                          <span className={`grid size-6 shrink-0 place-items-center ${ESTILO_PILAR[p].tinta} [&>svg]:size-5`}>
                            <IconoCategoria pilar={p} slug={c.slug} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                          {resumen && (resumen.categorias[c.id] ?? 0) > 0 && (
                            <span className="text-[12px] text-muted tabular-nums">{resumen.categorias[c.id]}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- Cajón (celular y tablet) ----------
          Va en un portal al body: dentro de la cabecera, su `backdrop-blur` hace
          que el `fixed` se mida contra ella (64px de alto) y no contra la pantalla. */}
      {cajon && createPortal(
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setCajon(false)}
            className="animate-bkn-velo absolute inset-0 cursor-default bg-carbon/50"
          />
          <div className="animate-bkn-in absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-background shadow-[-24px_0_48px_-24px_rgba(31,41,55,0.5)]">
            <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">
              <Emblema tamano={30} />
              <span className="titular text-[20px]">Baknazo</span>
              <button
                type="button"
                onClick={() => setCajon(false)}
                aria-label="Cerrar el menú"
                className="ml-auto grid size-10 place-items-center rounded-full text-muted hover:bg-white hover:text-foreground"
              >
                <IconoCerrar />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <div className="rounded-2xl bg-brand p-4 text-foreground">
                <p className="titular text-[22px]">Publica gratis</p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-foreground/80">
                  Para publicar necesitas una cuenta. Crearla es gratis y toma un minuto.
                </p>
                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => navegar(RUTA_REGISTRO)}
                    className="h-11 flex-1 rounded-full bg-foreground px-4 text-[14px] font-semibold text-white"
                  >
                    Crear cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => navegar(RUTA_ENTRAR)}
                    className="h-11 rounded-full border border-foreground/25 px-4 text-[14px] font-semibold"
                  >
                    Entrar
                  </button>
                </div>
              </div>

              <p className="mt-6 px-1 text-[11.5px] font-semibold tracking-[0.12em] text-muted uppercase">Categorías</p>
              <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-white">
                {PILARES.map((p) => (
                  <details key={p} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden="true" className={`size-2.5 rounded-full ${ESTILO_PILAR[p].punto}`} />
                      <span className="flex-1 text-[15px] font-semibold text-foreground">{NOMBRE_PILAR[p]}</span>
                      <span className="text-muted transition-transform group-open:rotate-180 [&>svg]:size-4">
                        <IconoChevron />
                      </span>
                    </summary>
                    <ul className="pb-2">
                      <li>
                        <button type="button" onClick={() => elegir(p)} className="w-full px-4 py-2 pl-[38px] text-left text-[14px] font-medium text-accent">
                          Ver todo en {NOMBRE_PILAR[p].toLowerCase()}
                        </button>
                      </li>
                      {categoriasDe(catalogos, p).map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => elegir(p, c.id)}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-foreground/90"
                          >
                            <span className={`[&>svg]:size-[18px] ${ESTILO_PILAR[p].tinta}`}>
                              <IconoCategoria pilar={p} slug={c.slug} />
                            </span>
                            {c.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>

              <ul className="mt-6 grid gap-1">
                {ENLACES.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => ir(e.id)}
                      className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-medium text-foreground hover:bg-white"
                    >
                      {e.texto}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}

/** El aviso de "publicar" sin cuenta: en el sitio, junto al botón. */
export function AvisoPublicar({ id, onCerrar, arriba = false }: { id?: string; onCerrar: () => void; arriba?: boolean }) {
  const navegar = useNavigate();
  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby="aviso-publicar-titulo"
      className={`animate-bkn-in absolute right-0 z-50 w-[320px] overflow-hidden rounded-[20px] bg-white text-left shadow-[0_28px_60px_-24px_rgba(31,41,55,0.55)] ring-1 ring-black/5 ${
        arriba ? 'bottom-full mb-3' : 'top-full mt-3'
      }`}
    >
      {/* La franja de la bandera: el único adorno, y es el de Baknazo. */}
      <div aria-hidden="true" className="flex h-1.5">
        <span className="flex-[2] bg-brand" />
        <span className="flex-1 bg-accent" />
        <span className="flex-1 bg-empleo" />
      </div>
      <div className="relative px-6 pt-5 pb-5">
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          <IconoCerrar />
        </button>
        <p id="aviso-publicar-titulo" className="titular pr-8 text-[26px] text-foreground">
          Publicar es gratis.
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Solo necesitas una cuenta, así quien te escribe sabe con quién habla.
        </p>
        <ol className="mt-4 grid gap-1.5 border-y border-border py-3.5">
          {['Crea tu cuenta', 'Toma tus fotos', 'Publica en un minuto'].map((paso, i) => (
            <li key={paso} className="flex items-baseline gap-3 text-[14px] text-foreground">
              <span className="titular w-4 text-[17px] text-brand-dark">{i + 1}</span>
              {paso}
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-2 px-6 pb-6">
        <button
          type="button"
          onClick={() => navegar(RUTA_REGISTRO)}
          className="h-11 rounded-full bg-foreground text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Crear cuenta gratis
        </button>
        <button
          type="button"
          onClick={() => navegar(RUTA_ENTRAR)}
          className="h-11 rounded-full border border-border text-[14px] font-semibold text-foreground transition-colors hover:border-muted"
        >
          Ya tengo cuenta
        </button>
      </div>
    </div>
  );
}
