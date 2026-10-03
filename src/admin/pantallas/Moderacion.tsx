import { useEffect, useState, type FormEvent } from 'react';
import { NOMBRE_PILAR, type Pilar } from '../../lib/pilares';
import { notificarExito, notificarError } from '../../lib/notificar';
import { pedir, mensajeDe } from '../api';
import { AvisoError, Boton, Campo, Cargando, Encabezado, Insignia, Tarjeta } from '../ui';
import type { ConfigModeracion } from '../tipos';

/**
 * Las reglas de la moderación automática. Todas leen el TEXTO del anuncio
 * (título y descripción) y su categoría; las fotos las revisa una persona.
 */
export default function Moderacion() {
  const [c, setC] = useState<ConfigModeracion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [termino, setTermino] = useState('');
  const [nivel, setNivel] = useState<'REVISION' | 'BLOQUEO'>('REVISION');
  const [agregando, setAgregando] = useState(false);

  useEffect(() => {
    pedir<ConfigModeracion>('/moderacion')
      .then(setC)
      .catch((e) => setFallo(mensajeDe(e)));
  }, []);

  if (fallo) return <AvisoError>{fallo}</AvisoError>;
  if (!c) return <Cargando mensaje="Cargando las reglas" />;

  const guardar = async () => {
    setGuardando(true);
    try {
      setC(
        await pedir<ConfigModeracion>('/moderacion', 'PUT', {
          revisionUsuariosNuevos: c.revisionUsuariosNuevos,
          diasUsuarioNuevo: c.diasUsuarioNuevo,
          umbralDenuncias: c.umbralDenuncias,
          categoriasProhibidas: c.categoriasProhibidas,
        })
      );
      notificarExito('Reglas guardadas. Aplican desde ya.');
    } catch (e) {
      notificarError(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  };

  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    if (termino.trim().length < 2) return;
    setAgregando(true);
    try {
      setC(await pedir<ConfigModeracion>('/moderacion/palabras', 'POST', { termino: termino.trim(), nivel }));
      setTermino('');
    } catch (err) {
      notificarError(mensajeDe(err));
    } finally {
      setAgregando(false);
    }
  };

  const quitar = async (id: number) => {
    try {
      setC(await pedir<ConfigModeracion>(`/moderacion/palabras/${id}`, 'DELETE'));
    } catch (err) {
      notificarError(mensajeDe(err));
    }
  };

  const porPilar = (['productos', 'servicios', 'empleo'] as Pilar[]).map((p) => ({ pilar: p, cats: c.categorias.filter((x) => x.pilar === p) }));

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Reglas de moderación"
        descripcion="Lo normal se publica al instante. Estas reglas deciden qué espera revisión y qué no se puede publicar. Leen el texto del anuncio; las fotos se revisan a mano."
        acciones={
          <Boton variante="primario" cargando={guardando} onClick={() => void guardar()}>
            Guardar reglas
          </Boton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Cuentas nuevas" descripcion="Los anuncios de cuentas recién creadas pasan por revisión antes de publicarse.">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-[14px] font-medium text-foreground">Revisar a las cuentas nuevas</span>
            <Interruptor activo={c.revisionUsuariosNuevos} onCambiar={(v) => setC({ ...c, revisionUsuariosNuevos: v })} etiqueta="Revisar a las cuentas nuevas" />
          </label>
          <div className="mt-4 max-w-[220px]">
            <Campo
              etiqueta="Se considera nueva durante (días)"
              type="number"
              min={1}
              max={365}
              value={c.diasUsuarioNuevo}
              disabled={!c.revisionUsuariosNuevos}
              onChange={(e) => setC({ ...c, diasUsuarioNuevo: Number(e.target.value) })}
            />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Denuncias" descripcion="Al reunir este número de denuncias de personas distintas, el anuncio sale del feed y espera revisión.">
          <div className="max-w-[220px]">
            <Campo etiqueta="Denuncias para ir a revisión" type="number" min={1} max={100} value={c.umbralDenuncias} onChange={(e) => setC({ ...c, umbralDenuncias: Number(e.target.value) })} />
          </div>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Diccionario de términos"
        descripcion="Se buscan sin importar mayúsculas, tildes, plurales simples ni trucos como «c0caína» o «c.o.c.a.í.n.a». «Revisión» manda el anuncio a revisión manual; «Bloqueo» no deja publicarlo."
      >
        <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <Campo etiqueta="Término o frase" value={termino} onChange={(e) => setTermino(e.target.value)} maxLength={80} placeholder="p. ej. documentos falsos" />
          </div>
          <div role="radiogroup" aria-label="Nivel" className="flex h-11 rounded-lg border border-border bg-white p-1">
            {(['REVISION', 'BLOQUEO'] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={nivel === n}
                onClick={() => setNivel(n)}
                className={`rounded-md px-3 text-[13px] font-semibold transition-colors ${nivel === n ? (n === 'BLOQUEO' ? 'bg-danger text-white' : 'bg-warning text-white') : 'text-muted hover:text-foreground'}`}
              >
                {n === 'REVISION' ? 'Revisión' : 'Bloqueo'}
              </button>
            ))}
          </div>
          <Boton type="submit" cargando={agregando} disabled={termino.trim().length < 2}>
            Agregar
          </Boton>
        </form>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {(['BLOQUEO', 'REVISION'] as const).map((n) => {
            const lista = c.palabras.filter((p) => p.nivel === n);
            return (
              <div key={n}>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <Insignia tono={n === 'BLOQUEO' ? 'peligro' : 'aviso'}>{n === 'BLOQUEO' ? 'Bloquean' : 'Mandan a revisión'}</Insignia>
                  <span className="text-muted tabular-nums">{lista.length}</span>
                </p>
                {lista.length === 0 ? (
                  <p className="text-[13px] text-muted">Ninguno.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {lista.map((p) => (
                      <li key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-white py-1 pr-1 pl-3 text-[13px] text-foreground">
                        {p.termino}
                        <button
                          type="button"
                          onClick={() => void quitar(p.id)}
                          aria-label={`Quitar «${p.termino}»`}
                          className="grid size-6 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger-deep"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Categorías prohibidas" descripcion="En las categorías marcadas no se puede publicar. Los anuncios que ya existen no cambian.">
        <div className="grid gap-5 md:grid-cols-3">
          {porPilar.map(({ pilar, cats }) => (
            <fieldset key={pilar}>
              <legend className="mb-2 text-[13px] font-semibold text-foreground">{NOMBRE_PILAR[pilar]}</legend>
              <div className="space-y-1">
                {cats.map((cat) => {
                  const marcada = c.categoriasProhibidas.includes(cat.id);
                  return (
                    <label key={cat.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] ${marcada ? 'bg-danger/[0.06] text-danger-deep' : 'text-foreground hover:bg-background'}`}>
                      <input
                        type="checkbox"
                        className="accent-danger"
                        checked={marcada}
                        onChange={(e) =>
                          setC({
                            ...c,
                            categoriasProhibidas: e.target.checked ? [...c.categoriasProhibidas, cat.id] : c.categoriasProhibidas.filter((x) => x !== cat.id),
                          })
                        }
                      />
                      {cat.nombre}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

/** El interruptor de siempre (el de Configuración). */
function Interruptor({ activo, onCambiar, etiqueta }: { activo: boolean; onCambiar: (v: boolean) => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambiar(!activo)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? 'bg-success' : 'bg-border'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(31,41,55,0.25)] transition-transform duration-200 ${activo ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}
