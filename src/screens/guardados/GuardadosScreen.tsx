import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import BaknazoLoader from '../../components/BaknazoLoader';
import TarjetaAnuncio from '../../components/TarjetaAnuncio';
import EsqueletoAnuncio from '../../components/EsqueletoAnuncio';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import { IconoGuardar } from '../../components/Iconos';
import { darLike, guardarAnuncio, listarGuardados, quitarGuardado, quitarLike } from '../../api/anuncios';
import { notificarError, notificarInfo } from '../../lib/notificar';
import { urlCompleta } from '../../lib/imagen';
import { formatearPrecio, formatearUbicacion } from '../../lib/tarjeta';
import { useScrollInfinito } from '../../lib/scrollInfinito';
import type { AnuncioGuardado } from '../../types/anuncio';
import type { SemillaPerfil } from '../../types/perfil';

type Filtro = 'todos' | 'disponibles' | 'no-disponibles';

/**
 * Guardados: lo que la persona se apartó para decidir después.
 *
 * Lo que ya se vendió o se pausó sigue aquí, apagado y con su etiqueta: si
 * desapareciera sin más, parecería que la app perdió lo guardado. Arriba se
 * avisa cuántos ya no están disponibles, con la opción de limpiarlos de una vez.
 */
export default function GuardadosScreen() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const [items, setItems] = useState<AnuncioGuardado[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => {
    let vivo = true;
    listarGuardados()
      .then((r) => {
        if (!vivo) return;
        setItems(r.items);
        setCursor(r.pagina.siguienteCursor);
        setHayMas(r.pagina.hayMas);
      })
      .catch((e: unknown) => {
        if (vivo) setFallo(e instanceof Error ? e.message : 'No se pudieron cargar tus guardados.');
      });
    return () => {
      vivo = false;
    };
  }, []);

  const cargarMas = async () => {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const r = await listarGuardados(cursor);
      setItems((prev) => {
        const vistos = new Set((prev ?? []).map((a) => a.id));
        return [...(prev ?? []), ...r.items.filter((a) => !vistos.has(a.id))];
      });
      setCursor(r.pagina.siguienteCursor);
      setHayMas(r.pagina.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  };
  const centinela = useScrollInfinito(cargarMas, hayMas && !cargandoMas && !errorMas && items !== null);

  const noDisponibles = useMemo(() => (items ?? []).filter((a) => !a.disponible), [items]);
  const visibles = useMemo(() => {
    if (!items) return [];
    if (filtro === 'disponibles') return items.filter((a) => a.disponible);
    if (filtro === 'no-disponibles') return items.filter((a) => !a.disponible);
    return items;
  }, [items, filtro]);

  /** Quitar se pinta al instante; si falla, vuelve a su sitio. */
  const quitar = async (anuncio: AnuncioGuardado) => {
    const antes = items;
    setItems((prev) => (prev ?? []).filter((a) => a.id !== anuncio.id));
    try {
      await quitarGuardado(anuncio.id);
      notificarInfo(`Quitaste «${anuncio.titulo}» de Guardados.`);
    } catch (e) {
      setItems(antes);
      notificarError(e instanceof Error ? e.message : 'No se pudo quitar.');
    }
  };

  const limpiarNoDisponibles = async () => {
    const antes = items;
    const ids = noDisponibles.map((a) => a.id);
    setItems((prev) => (prev ?? []).filter((a) => a.disponible));
    setFiltro('todos');
    const resultados = await Promise.allSettled(ids.map((id) => quitarGuardado(id)));
    const fallidos = resultados.filter((r) => r.status === 'rejected').length;
    if (fallidos > 0) {
      setItems(antes);
      notificarError('No se pudieron quitar todos. Inténtalo otra vez.');
    } else {
      notificarInfo(ids.length === 1 ? 'Quitaste 1 anuncio.' : `Quitaste ${ids.length} anuncios.`);
    }
  };

  /* ---------- Ficha abierta encima, sin salir de la pantalla ---------- */

  const abierto = Number(parametros.get('anuncio')) || null;
  const anuncioAbierto = items?.find((a) => a.id === abierto) ?? null;
  const abrir = (id: number) => {
    const p = new URLSearchParams(parametros);
    p.set('anuncio', String(id));
    setParametros(p, { state: { fichaDesdeGuardados: true } });
  };
  const cerrar = () => {
    if ((ubicacion.state as { fichaDesdeGuardados?: boolean } | null)?.fichaDesdeGuardados) {
      navegar(-1);
      return;
    }
    const p = new URLSearchParams(parametros);
    p.delete('anuncio');
    setParametros(p, { replace: true });
  };

  const alternarDesdeFicha = async (anuncio: AnuncioGuardado | null, id: number) => {
    // Desde la ficha se puede volver a guardar lo que se acaba de quitar.
    if (anuncio) {
      await quitar(anuncio);
      return;
    }
    try {
      await guardarAnuncio(id);
      const r = await listarGuardados();
      setItems(r.items);
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  };

  return (
    <MarcoApp titulo="Guardados">
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-foreground">Guardados</h1>
            <p className="mt-1.5 text-[14px] text-muted">
              Lo que apartaste para decidir después. Solo tú lo ves.
            </p>
          </div>
          {items && items.length > 0 && (
            <div className="flex gap-2">
              {(
                [
                  ['todos', 'Todos'],
                  ['disponibles', 'Disponibles'],
                  ['no-disponibles', 'Ya no disponibles'],
                ] as [Filtro, string][]
              ).map(([id, texto]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltro(id)}
                  aria-pressed={filtro === id}
                  className={
                    filtro === id
                      ? 'h-9 rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-white'
                      : 'h-9 rounded-full border border-border bg-white px-3.5 text-[13px] font-medium text-foreground hover:border-muted'
                  }
                >
                  {texto}
                </button>
              ))}
            </div>
          )}
        </div>

        {noDisponibles.length > 0 && filtro !== 'disponibles' && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-carbon px-4 py-3.5 text-white">
            <p className="min-w-0 flex-1 basis-60 text-[13.5px] leading-snug">
              <strong className="font-semibold">
                {noDisponibles.length === 1
                  ? '1 de tus guardados ya no está disponible.'
                  : `${noDisponibles.length} de tus guardados ya no están disponibles.`}
              </strong>{' '}
              <span className="text-white/75">Se vendieron o quien los publicó los pausó.</span>
            </p>
            <button
              type="button"
              onClick={limpiarNoDisponibles}
              className="h-9 shrink-0 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-carbon transition-opacity hover:opacity-90"
            >
              Quitarlos de Guardados
            </button>
          </div>
        )}

        {fallo ? (
          <p className="mt-6 rounded-xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-[13.5px] text-danger-deep">
            {fallo}
          </p>
        ) : items === null ? (
          <div className="mt-6 rounded-2xl border border-border bg-white">
            <BaknazoLoader tamano="seccion" mensaje="Cargando tus guardados" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent/10 text-accent [&>svg]:size-6">
              <IconoGuardar />
            </span>
            <p className="mt-4 text-[16px] font-semibold text-foreground">Todavía no guardas nada</p>
            <p className="mx-auto mt-1.5 max-w-[42ch] text-[13.5px] leading-relaxed text-muted">
              Toca el marcador de cualquier anuncio para guardarlo aquí. Si se vende, te lo diremos.
            </p>
            <button
              type="button"
              onClick={() => navegar('/anuncios')}
              className="mt-5 h-10 rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
            >
              Ver anuncios
            </button>
          </div>
        ) : (
          <>
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-x-4">
              {visibles.map((a) => (
                <li key={a.id} className={a.disponible ? '' : 'opacity-80'}>
                  <TarjetaAnuncio
                    id={a.id}
                    pilar={a.pilar}
                    titulo={a.titulo}
                    precio={formatearPrecio(a.precio, a.pilar)}
                    ubicacion={formatearUbicacion(a.ubicacion, a.sector)}
                    foto={urlCompleta(a.portada?.url ?? null)}
                    autor={{
                      id: a.autor.id,
                      nombre: a.autor.nombre,
                      foto: urlCompleta(a.autor.foto),
                      verificado: a.autor.verificado,
                      esNegocio: a.autor.esNegocio,
                    }}
                    vendido={a.vendido}
                    estado={
                      !a.disponible && !a.vendido ? { etiqueta: 'No disponible', tono: 'neutro' } : undefined
                    }
                    guardado
                    onAlternarGuardado={() => quitar(a)}
                    onAbrir={() => abrir(a.id)}
                    onAbrirPerfil={a.autor.id ? () => navegar(`/perfil/${a.autor.id}`) : undefined}
                  />
                </li>
              ))}
            </ul>

            {cargandoMas && (
              <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-x-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <EsqueletoAnuncio key={i} vista="rejilla" />
                ))}
              </div>
            )}
            <div ref={centinela} aria-hidden="true" className="h-px" />
            {errorMas && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={cargarMas}
                  className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground hover:border-muted"
                >
                  Reintentar
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {abierto && (
        <DetalleAnuncioModal
          id={abierto}
          onCerrar={cerrar}
          guardado={Boolean(anuncioAbierto)}
          onAlternarGuardado={() => alternarDesdeFicha(anuncioAbierto, abierto)}
          onAlternarMeGusta={async (dar) => {
            try {
              if (dar) await darLike(abierto);
              else await quitarLike(abierto);
              return true;
            } catch (e) {
              notificarError(e instanceof Error ? e.message : 'No se pudo guardar tu me gusta.');
              return false;
            }
          }}
          onAbrirPerfil={(semilla: SemillaPerfil) => navegar(`/perfil/${semilla.clavePerfil}`)}
        />
      )}
    </MarcoApp>
  );
}
