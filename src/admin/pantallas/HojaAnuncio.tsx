import { useEffect, useState } from 'react';
import BaknazoLoader from '../../components/BaknazoLoader';
import { IconoCerrar } from '../../components/Iconos';
import { useBloqueoScroll } from '../../lib/bloqueoScroll';
import { formatearPrecio } from '../../lib/tarjeta';
import { notificarExito } from '../../lib/notificar';
import { pedir, mensajeDe } from '../api';
import { refrescarAvisos } from '../avisos';
import { useSesionAdmin } from '../sesion';
import { AreaTexto, AvisoError, Boton, EstadoAnuncio, Insignia, Modal } from '../ui';
import { fecha, fechaHora } from '../formato';
import type { DetalleAnuncio } from '../tipos';

const ACCION_HISTORIAL: Record<string, string> = {
  ENVIADO_A_REVISION: 'Enviado a revisión',
  BLOQUEADO: 'Publicación bloqueada',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  PAUSADO: 'Pausado',
  ELIMINADO: 'Eliminado',
  DENUNCIAS_DESESTIMADAS: 'Denuncias desestimadas',
  REENVIADO: 'Reenviado tras corregirlo',
};

type Accion = 'aprobar' | 'rechazar' | 'pausar' | 'eliminar' | 'desestimar';

/**
 * La ficha de revisión: todo lo necesario para decidir sin salir de la lista.
 * Las fotos se revisan a ojo: el sistema no analiza imágenes.
 */
export default function HojaAnuncio({ id, onCerrar, onCambio }: { id: number; onCerrar: () => void; onCambio: () => void }) {
  useBloqueoScroll();
  const { puede, catalogos } = useSesionAdmin();
  const [a, setA] = useState<DetalleAnuncio | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    pedir<DetalleAnuncio>(`/anuncios/${id}`)
      .then(setA)
      .catch((e) => setFallo(mensajeDe(e)));
  }, [id]);

  useEffect(() => {
    if (accion) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [accion, onCerrar]);

  const abrirAccion = (x: Accion) => {
    setAccion(x);
    setMotivo('');
    setNota('');
    setErrorAccion(null);
  };

  const ejecutar = async () => {
    if (!a || !accion) return;
    if (accion === 'rechazar' && !motivo) {
      setErrorAccion('Elige un motivo de rechazo.');
      return;
    }
    setEnviando(true);
    setErrorAccion(null);
    try {
      if (accion === 'desestimar') await pedir(`/denuncias/${a.id}/desestimar`, 'POST');
      else await pedir(`/anuncios/${a.id}/${accion}`, 'POST', { motivo: motivo || undefined, nota: nota || undefined });
      const textos: Record<Accion, string> = {
        aprobar: 'Anuncio aprobado y publicado.',
        rechazar: 'Anuncio rechazado. El dueño verá el motivo.',
        pausar: 'Anuncio pausado. El dueño no podrá reanudarlo.',
        eliminar: 'Anuncio eliminado.',
        desestimar: 'Denuncias desestimadas.',
      };
      notificarExito(textos[accion]);
      setAccion(null);
      void refrescarAvisos();
      onCambio();
      onCerrar();
    } catch (e) {
      setErrorAccion(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  const terminos = [...new Set((a?.historial ?? []).flatMap((h) => h.detalle?.terminos ?? []))];
  const pendientes = a?.denuncias.filter((d) => d.estado === 'PENDIENTE') ?? [];
  const puedeAprobar = a && puede('anuncios.aprobar') && (['PENDIENTE_REVISION', 'RECHAZADO'].includes(a.estado) || a.pausaAdministrativa);
  const puedeRechazar = a && puede('anuncios.rechazar') && a.estado !== 'RECHAZADO';
  const puedePausar = a && puede('anuncios.pausar') && a.estado === 'PUBLICADO';
  const puedeEliminar = a && puede('anuncios.eliminar');
  const puedeDesestimar = a && puede('denuncias.resolver') && pendientes.length > 0;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Revisión de anuncio">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="animate-bkn-velo absolute inset-0 cursor-default bg-carbon/45" />
      <div className="animate-bkn-hoja absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-white shadow-[0_-24px_48px_-24px_rgba(31,41,55,0.5)] sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[600px] sm:rounded-none sm:rounded-l-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-tight text-foreground">{a ? a.titulo : 'Revisión'}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background hover:text-foreground">
            <IconoCerrar />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {fallo ? (
            <AvisoError>{fallo}</AvisoError>
          ) : !a ? (
            <BaknazoLoader tamano="seccion" mensaje="Cargando el anuncio" />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <EstadoAnuncio estado={a.estado} porModeracion={a.pausaAdministrativa} />
                {a.denunciasPendientes > 0 && <Insignia tono="peligro">{a.denunciasPendientes} denuncias abiertas</Insignia>}
                <span className="text-[12.5px] text-muted">
                  {a.categoria} · {a.ubicacion} · {formatearPrecio(a.precio, a.pilar)}
                </span>
              </div>

              {a.motivosRevision.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3">
                  <p className="text-[13px] font-semibold text-warning-deep">Por qué está en revisión</p>
                  <ul className="mt-1 list-disc pl-5 text-[13px] text-foreground">
                    {a.motivosRevision.map((m) => (
                      <li key={m}>{catalogos?.motivosRevision[m] ?? m}</li>
                    ))}
                  </ul>
                  {terminos.length > 0 && (
                    <p className="mt-2 text-[12.5px] text-muted">
                      Términos detectados:{' '}
                      {terminos.map((t) => (
                        <span key={t} className="mr-1 inline-block rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-foreground ring-1 ring-border">
                          {t}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}

              {a.fotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {a.fotos.map((f) => (
                    <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-border">
                      <img src={f} alt="" className="aspect-square w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted">Sin fotos.</p>
              )}
              <p className="text-[12px] text-muted">Las fotos se revisan a ojo: el sistema no analiza imágenes automáticamente.</p>

              <section>
                <h3 className="text-[13px] font-semibold text-foreground">Descripción</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-foreground/90">{a.descripcion || 'Sin descripción.'}</p>
              </section>

              <section className="rounded-xl border border-border px-4 py-3">
                <h3 className="text-[13px] font-semibold text-foreground">Publicado por</h3>
                <p className="mt-1 text-[13.5px] text-foreground">
                  {a.autor.nombre} <span className="text-muted">· {a.autor.correo}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {a.autor.tipo === 'NEGOCIO' ? 'Negocio' : 'Persona'} · cuenta desde {fecha(a.autor.desde)} ·{' '}
                  {a.autor.estado === 'ACTIVO' ? 'activa' : a.autor.estado.toLowerCase()}
                </p>
              </section>

              {a.notasModeracion && (
                <section>
                  <h3 className="text-[13px] font-semibold text-foreground">Nota para el dueño</h3>
                  <p className="mt-1 text-[13.5px] text-foreground/90">{a.notasModeracion}</p>
                </section>
              )}

              {a.denuncias.length > 0 && (
                <section>
                  <h3 className="text-[13px] font-semibold text-foreground">Denuncias</h3>
                  <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                    {a.denuncias.map((d) => (
                      <li key={d.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            {catalogos?.motivosDenuncia.find((m) => m.id === d.motivo)?.nombre ?? d.motivo}
                          </span>
                          <Insignia tono={d.estado === 'PENDIENTE' ? 'aviso' : 'neutro'}>{d.estado === 'PENDIENTE' ? 'Abierta' : d.estado === 'RESUELTA' ? 'Resuelta' : 'Desestimada'}</Insignia>
                        </div>
                        {d.detalle && <p className="mt-1 text-[13px] text-foreground/90">«{d.detalle}»</p>}
                        <p className="mt-1 text-[12px] text-muted">
                          {d.denunciante} · {fechaHora(d.fecha)}
                          {d.resueltaPor && ` · resuelta por ${d.resueltaPor}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-[13px] font-semibold text-foreground">Historial de moderación</h3>
                {a.historial.length === 0 ? (
                  <p className="mt-1 text-[13px] text-muted">Sin decisiones todavía: se publicó sin activar ninguna regla.</p>
                ) : (
                  <ol className="mt-2 space-y-3 border-l border-border pl-4">
                    {a.historial.map((h) => (
                      <li key={h.id} className="relative">
                        <span aria-hidden="true" className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-border ring-2 ring-white" />
                        <p className="text-[13px] font-semibold text-foreground">{ACCION_HISTORIAL[h.accion] ?? h.accion}</p>
                        <p className="text-[12px] text-muted">
                          {h.por ? `Por ${h.por}` : 'Regla automática'} · {fechaHora(h.fecha)}
                          {h.motivo && ` · ${catalogos?.motivosRechazo.find((m) => m.id === h.motivo)?.nombre ?? catalogos?.motivosRevision[h.motivo] ?? h.motivo}`}
                        </p>
                        {h.nota && <p className="mt-0.5 text-[13px] text-foreground/90">{h.nota}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>

        {a && (puedeAprobar || puedeRechazar || puedePausar || puedeEliminar || puedeDesestimar) && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-background/60 px-5 py-4">
            {puedeAprobar && (
              <Boton variante="exito" onClick={() => abrirAccion('aprobar')}>
                Aprobar y publicar
              </Boton>
            )}
            {puedeRechazar && (
              <Boton variante="peligro" onClick={() => abrirAccion('rechazar')}>
                Rechazar
              </Boton>
            )}
            {puedeDesestimar && <Boton onClick={() => abrirAccion('desestimar')}>Desestimar denuncias</Boton>}
            {puedePausar && <Boton onClick={() => abrirAccion('pausar')}>Pausar</Boton>}
            {puedeEliminar && (
              <Boton variante="fantasma" className="ml-auto text-danger-deep" onClick={() => abrirAccion('eliminar')}>
                Eliminar
              </Boton>
            )}
          </div>
        )}
      </div>

      {accion && a && (
        <Modal
          titulo={
            {
              aprobar: '¿Aprobar y publicar?',
              rechazar: 'Rechazar anuncio',
              pausar: '¿Pausar este anuncio?',
              eliminar: '¿Eliminar este anuncio?',
              desestimar: '¿Desestimar las denuncias?',
            }[accion]
          }
          descripcion={
            {
              aprobar: 'Aparecerá en el feed y el dueño recibirá un aviso. Las denuncias abiertas se cerrarán como desestimadas.',
              rechazar: 'No se verá en público. El dueño verá el motivo y podrá corregirlo; al editarlo volverá a revisión.',
              pausar: 'Deja de verse en el feed y el dueño no podrá reanudarlo por su cuenta.',
              eliminar: 'Desaparece para todos. Queda en el historial y en la auditoría.',
              desestimar: `Se cerrarán ${pendientes.length} denuncias sin tomar medidas. Si el anuncio estaba en revisión solo por ellas, vuelve a publicarse.`,
            }[accion]
          }
          onCerrar={() => setAccion(null)}
          pie={
            <>
              <Boton onClick={() => setAccion(null)}>Cancelar</Boton>
              <Boton
                variante={accion === 'aprobar' ? 'exito' : accion === 'desestimar' ? 'primario' : 'peligro'}
                cargando={enviando}
                onClick={() => void ejecutar()}
              >
                {{ aprobar: 'Aprobar', rechazar: 'Rechazar', pausar: 'Pausar', eliminar: 'Eliminar', desestimar: 'Desestimar' }[accion]}
              </Boton>
            </>
          }
        >
          {errorAccion && <AvisoError>{errorAccion}</AvisoError>}
          {accion === 'rechazar' && (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-foreground">Motivo</legend>
              <div className="grid gap-1.5">
                {(catalogos?.motivosRechazo ?? []).map((m) => (
                  <label key={m.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[13.5px] ${motivo === m.id ? 'border-danger/50 bg-danger/[0.04]' : 'border-border hover:border-muted'}`}>
                    <input type="radio" name="motivo" value={m.id} checked={motivo === m.id} onChange={() => setMotivo(m.id)} className="accent-danger" />
                    {m.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {accion !== 'desestimar' && (
            <AreaTexto
              etiqueta={accion === 'rechazar' || accion === 'pausar' ? 'Nota para el dueño (opcional)' : 'Nota interna (opcional)'}
              valor={nota}
              onCambiar={setNota}
              placeholder={
                accion === 'rechazar'
                  ? 'Qué debe corregir para volver a publicarlo.'
                  : accion === 'pausar'
                    ? 'Por qué se pausó. La verá en Mis anuncios.'
                    : 'Queda en el historial.'
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}
