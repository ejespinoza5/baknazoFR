import { useMemo, useState, type FormEvent } from 'react';
import { IconoLupa } from '../../components/Iconos';
import { urlCompleta } from '../../lib/imagen';
import { ESTILO_PILAR, NOMBRE_PILAR, type Pilar } from '../../lib/pilares';
import { formatearPrecio } from '../../lib/tarjeta';
import type { Anuncio } from '../../types/anuncio';
import { PORTADA } from './config';

interface Mosaico {
  id: number;
  foto: string | null;
  precio: string;
  pilar: Pilar;
  titulo: string;
}

/** Las fotos de la portada: anuncios reales con foto, repetidos si son pocos. */
function armarMosaico(anuncios: Anuncio[]): Mosaico[] {
  const conFoto = anuncios
    .filter((a) => a.portada?.url)
    .map((a) => ({
      id: a.id,
      foto: urlCompleta(a.portada!.url),
      precio: formatearPrecio(a.precio, a.pilar),
      pilar: a.pilar,
      titulo: a.titulo,
    }));
  if (conFoto.length === 0) {
    // Sin fotos todavía: bloques con el color y el nombre de cada pilar.
    return (['productos', 'servicios', 'empleo', 'productos', 'servicios', 'empleo'] as Pilar[]).map((p, i) => ({
      id: -i - 1,
      foto: null,
      precio: '',
      pilar: p,
      titulo: NOMBRE_PILAR[p],
    }));
  }
  const lista = [...conFoto];
  while (lista.length < 9) lista.push(...conFoto);
  return lista.slice(0, 12);
}

const SOLIDO: Record<Pilar, string> = {
  productos: 'bg-foreground text-brand',
  servicios: 'bg-accent text-white',
  empleo: 'bg-empleo text-white',
};

function Teja({ m, ancha = false }: { m: Mosaico; ancha?: boolean }) {
  return (
    <figure
      className={`relative shrink-0 overflow-hidden rounded-[22px] bg-white shadow-[0_18px_40px_-20px_rgba(31,41,55,0.55)] ring-1 ring-black/5 ${
        ancha ? 'h-[150px] w-[120px]' : 'aspect-[4/5] w-full'
      }`}
    >
      {m.foto ? (
        <img src={m.foto} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className={`grid size-full place-items-center ${SOLIDO[m.pilar]}`}>
          <span className={`titular ${ancha ? 'text-[14px]' : 'text-[22px]'}`}>{m.titulo}</span>
        </div>
      )}
      {m.precio && (
        <figcaption className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-white/95 py-1 pr-2.5 pl-2 text-[12px] font-bold text-foreground shadow-sm">
          <span aria-hidden="true" className={`size-2 rounded-full ${ESTILO_PILAR[m.pilar].punto}`} />
          {m.precio}
        </figcaption>
      )}
    </figure>
  );
}

/** Una palabra con un trazo a mano debajo que se dibuja al cargar. */
function Subrayado({ children, color, trazo, retraso }: { children: string; color: string; trazo: string; retraso?: string }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 300 24"
        preserveAspectRatio="none"
        className="absolute -bottom-[0.16em] left-[-2%] h-[0.22em] w-[104%] overflow-visible"
      >
        <path
          d={trazo}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          className="animate-bkn-trazo"
          style={retraso ? { animationDelay: retraso } : undefined}
        />
      </svg>
    </span>
  );
}

/** Una columna de fotos que se desliza sin fin (el contenido va dos veces). */
function Columna({ tejas, lenta = false, desfase = 0 }: { tejas: Mosaico[]; lenta?: boolean; desfase?: number }) {
  const doble = [...tejas, ...tejas];
  return (
    <div className="min-w-0 flex-1 overflow-hidden" style={{ marginTop: desfase }}>
      <div className={`flex flex-col gap-4 ${lenta ? 'animate-bkn-deriva-lenta' : 'animate-bkn-deriva'}`}>
        {doble.map((m, i) => (
          <Teja key={`${m.id}-${i}`} m={m} />
        ))}
      </div>
    </div>
  );
}

/**
 * La portada: 1920 × 750 (2.56:1) en escritorio. En tablet y celular crece en
 * alto para que el titular y el buscador quepan sin apretarse.
 *
 * Con imagen propia (`config.PORTADA`) se usa esa foto con un velo oscuro para
 * leer el texto. Sin ella, la portada se arma sola sobre el amarillo de la marca
 * con las fotos de los anuncios reales, que es lo que de verdad hay en Baknazo.
 */
export default function Portada({
  anuncios,
  total,
  ciudades,
  onBuscar,
  onPilar,
}: {
  anuncios: Anuncio[];
  total: number | null;
  ciudades: number | null;
  onBuscar: (q: string) => void;
  onPilar: (p: Pilar) => void;
}) {
  const [conImagen, setConImagen] = useState(false);
  const [q, setQ] = useState('');
  const mosaico = useMemo(() => armarMosaico(anuncios), [anuncios]);
  const tercio = Math.ceil(mosaico.length / 3);
  const columnas = [mosaico.slice(0, tercio), mosaico.slice(tercio, tercio * 2), mosaico.slice(tercio * 2)].map((c) =>
    c.length > 0 ? c : mosaico.slice(0, tercio)
  );

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    onBuscar(q.trim());
  };

  // Sobre la foto el texto va en blanco; sobre el amarillo, en carbón.
  const claro = conImagen;

  return (
    <section
      aria-labelledby="titular-portada"
      className={`relative isolate overflow-hidden transition-colors duration-500 ${claro ? 'bg-carbon' : 'bg-brand'}`}
    >
      {/* Textura de rótulo: puntos finos del mismo amarillo, más oscuro. */}
      {!claro && (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(rgba(140,90,0,0.55) 1px, transparent 1.4px)',
            backgroundSize: '18px 18px',
          }}
        />
      )}

      {/* La imagen propia, si existe. Se prueba siempre: aparece al cargar. */}
      <img
        src={PORTADA.imagen}
        alt={PORTADA.alt}
        fetchPriority="high"
        onLoad={() => setConImagen(true)}
        onError={() => setConImagen(false)}
        style={{ objectPosition: PORTADA.posicion }}
        className={`absolute inset-0 -z-10 size-full object-cover transition-opacity duration-700 ${conImagen ? 'opacity-100' : 'opacity-0'}`}
      />
      {claro && (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(17,24,39,0.15)_0%,rgba(17,24,39,0.75)_100%)] lg:bg-[linear-gradient(90deg,rgba(17,24,39,0.88)_0%,rgba(17,24,39,0.62)_42%,rgba(17,24,39,0.05)_78%)]"
        />
      )}

      <div className="relative mx-auto flex min-h-[640px] w-full max-w-[1920px] flex-col sm:min-h-[600px] md:min-h-[560px] lg:aspect-[1920/750] lg:min-h-[580px] lg:flex-row">
        {/* ---------- Texto ---------- */}
        <div className="relative z-10 flex flex-col justify-center px-5 pt-10 pb-8 sm:px-8 md:max-w-[640px] lg:w-[58%] lg:max-w-none lg:py-12 lg:pr-6 lg:pl-[max(2.5rem,calc((100vw-1320px)/2+2.5rem))]">
          <p
            className={`animate-bkn-asoma inline-flex w-fit items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2 text-[12.5px] font-semibold ${
              claro ? 'bg-white/12 text-white ring-1 ring-white/25' : 'bg-foreground text-brand'
            }`}
          >
            <span className="flex gap-0.5" aria-hidden="true">
              <span className="h-3 w-1.5 rounded-sm bg-brand" />
              <span className="h-3 w-1.5 rounded-sm bg-accent" />
              <span className="h-3 w-1.5 rounded-sm bg-empleo" />
            </span>
            Hecho en Ecuador · Publicar es gratis
          </p>

          <h1
            id="titular-portada"
            className={`titular animate-bkn-asoma mt-5 text-[clamp(48px,9.5vw,76px)] sm:text-[clamp(60px,8vw,96px)] lg:text-[clamp(72px,6.4vw,104px)] ${
              claro ? 'text-white' : 'text-foreground'
            }`}
            style={{ animationDelay: '90ms' }}
          >
            Lo{' '}
            {/* Dos trazos a mano: azul bajo "bacán" y rojo bajo "cerca" (los
                colores de la bandera, con el amarillo de fondo). */}
            <Subrayado color={claro ? '#5fb0f0' : '#0a6ebd'} trazo="M4 16 C 60 6, 120 4, 170 9 S 260 18, 296 7">
              bacán
            </Subrayado>
            <br />
            está{' '}
            <Subrayado color={claro ? '#ff5a68' : '#ce1126'} trazo="M5 9 C 70 18, 140 17, 200 11 S 270 6, 295 14" retraso="1.15s">
              cerca
            </Subrayado>
            .
          </h1>

          <p
            className={`animate-bkn-asoma mt-6 max-w-[34ch] text-[16.5px] leading-relaxed sm:text-[18px] ${claro ? 'text-white/85' : 'text-foreground/80'}`}
            style={{ animationDelay: '180ms' }}
          >
            Compra, vende, ofrece tu oficio o encuentra camello en tu ciudad. Sin comisiones y sin complicaciones.
          </p>

          <form
            onSubmit={buscar}
            role="search"
            className="animate-bkn-asoma mt-7 flex w-full max-w-[560px] items-center gap-2 rounded-full bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(31,41,55,0.6)] ring-1 ring-black/5"
            style={{ animationDelay: '260ms' }}
          >
            <label className="flex min-w-0 flex-1 items-center gap-2.5 pl-4">
              <span className="shrink-0 text-muted [&>svg]:size-5">
                <IconoLupa />
              </span>
              <span className="sr-only">¿Qué buscas?</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Bicicleta, plomero, cajero…"
                enterKeyHint="search"
                className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-foreground placeholder:text-muted/80 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-foreground px-5 text-[15px] font-semibold text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] sm:px-7"
            >
              Buscar
            </button>
          </form>

          <div className="animate-bkn-asoma mt-5 flex flex-wrap items-center gap-2" style={{ animationDelay: '330ms' }}>
            {(['productos', 'servicios', 'empleo'] as Pilar[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPilar(p)}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                  claro ? 'bg-white/12 text-white ring-1 ring-white/25 hover:bg-white/20' : 'bg-white/55 text-foreground hover:bg-white'
                }`}
              >
                <span aria-hidden="true" className={`size-2.5 rounded-full ${ESTILO_PILAR[p].punto} ${p === 'productos' && !claro ? 'ring-2 ring-foreground/70' : ''}`} />
                {NOMBRE_PILAR[p]}
              </button>
            ))}
          </div>

          {total !== null && total > 0 && (
            <p className={`mt-6 text-[13.5px] font-medium ${claro ? 'text-white/70' : 'text-foreground/65'}`}>
              {total.toLocaleString('es-EC')} {total === 1 ? 'anuncio activo' : 'anuncios activos'}
              {ciudades ? ` en ${ciudades} ${ciudades === 1 ? 'ciudad' : 'ciudades'}` : ''}
            </p>
          )}
        </div>

        {/* ---------- Mosaico de anuncios reales (sin imagen propia) ---------- */}
        {!claro && (
          <>
            {/* Escritorio y tablet: columnas que se deslizan, inclinadas. */}
            <div
              aria-hidden="true"
              className="pausar-al-pasar pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] md:block lg:w-[46%]"
              style={{
                maskImage: 'linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%)',
              }}
            >
              <div className="absolute -inset-y-24 -right-10 left-8 flex rotate-[-7deg] gap-4 lg:gap-5">
                <Columna tejas={columnas[0]} />
                <Columna tejas={columnas[1]} lenta desfase={-80} />
                <div className="hidden min-w-0 flex-1 lg:flex">
                  <Columna tejas={columnas[2]} desfase={-30} />
                </div>
              </div>
            </div>

            {/* Celular: una franja que pasa de lado. */}
            <div aria-hidden="true" className="pointer-events-none relative -mx-2 overflow-hidden pb-8 md:hidden">
              <div className="animate-bkn-deriva-x flex w-max gap-3 pl-5">
                {[...mosaico, ...mosaico].map((m, i) => (
                  <div key={`${m.id}-${i}`} className={i % 2 ? 'translate-y-3' : ''}>
                    <Teja m={m} ancha />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
