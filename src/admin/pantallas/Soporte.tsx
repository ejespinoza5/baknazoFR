import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconoChevron, IconoSoporte } from '../../components/Iconos';
import { notificarError, notificarExito } from '../../lib/notificar';
import { pedir, mensajeDe } from '../api';
import { refrescarAvisos, useAvisos } from '../avisos';
import { AvisoError, Boton, Buscador, Cargando, Chips, Encabezado, Insignia, Paginacion, Vacio } from '../ui';
import { espera, fecha, fechaHora } from '../formato';
import type { DetalleHiloSoporte, HiloSoporte, MensajeSoporteAdmin } from '../tipos';

type Vista = 'pendientes' | 'abiertos' | 'resueltos' | 'todos';
const VISTAS: { id: Vista; texto: string }[] = [
  { id: 'pendientes', texto: 'Por responder' },
  { id: 'abiertos', texto: 'Abiertas' },
  { id: 'resueltos', texto: 'Resueltas' },
  { id: 'todos', texto: 'Todas' },
];
const LIMITE = 20;
const MAX_CARACTERES = 2000;
/** La conversación abierta se pone al día sola: el usuario puede seguir escribiendo. */
const REFRESCO_HILO_MS = 10_000;
const REFRESCO_BANDEJA_MS = 30_000;

/**
 * Soporte: la bandeja de conversaciones a la izquierda y la abierta a la
 * derecha, como un correo. En pantallas chicas se ve una u otra. La
 * conversación va en la URL (?u=) para que el aviso del panel lleve directo.
 */
export default function Soporte() {
  const [params, setParams] = useSearchParams();
  const seleccionado = params.get('u');
  const [version, setVersion] = useState(0);
  const recargarBandeja = useCallback(() => setVersion((v) => v + 1), []);

  const elegir = (id: string | null) => setParams(id ? { u: id } : {});

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Soporte"
        descripcion="Las consultas que los usuarios escriben desde la app. Al primer mensaje reciben una respuesta automática; lo que respondas aquí les llega como Soporte Baknazo, sin tu nombre."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <div className={seleccionado ? 'hidden lg:block' : ''}>
          <Bandeja seleccionado={seleccionado} onElegir={elegir} version={version} />
        </div>
        <div className={seleccionado ? '' : 'hidden lg:block'}>
          {seleccionado ? (
            <Conversacion key={seleccionado} usuarioId={seleccionado} onVolver={() => elegir(null)} onCambio={recargarBandeja} />
          ) : (
            <div className="grid h-[calc(100svh-15rem)] min-h-[420px] place-items-center rounded-2xl border border-dashed border-border bg-white/60 px-6 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-carbon text-brand [&>svg]:size-6">
                  <IconoSoporte />
                </span>
                <p className="mt-3 text-[15px] font-semibold text-foreground">Elige una conversación</p>
                <p className="mx-auto mt-1 max-w-[40ch] text-[13px] leading-relaxed text-muted">
                  Las que esperan respuesta llevan el número en amarillo. Al abrir una, el usuario ve que la leíste.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Bandeja ================= */

function Bandeja({ seleccionado, onElegir, version }: { seleccionado: string | null; onElegir: (id: string) => void; version: number }) {
  const avisos = useAvisos();
  const [vista, setVista] = useState<Vista>('pendientes');
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [offset, setOffset] = useState(0);
  const [datos, setDatos] = useState<{ items: HiloSoporte[]; total: number } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(q.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ vista, limite: String(LIMITE), offset: String(offset) });
    if (busqueda) p.set('q', busqueda);
    pedir<{ items: HiloSoporte[]; total: number }>(`/soporte?${p}`)
      .then((r) => {
        setDatos(r);
        setFallo(null);
      })
      .catch((e) => setFallo(mensajeDe(e)));
  }, [vista, busqueda, offset]);

  // También cuando cambia el contador del panel (llegó algo) o tras responder.
  useEffect(() => {
    cargar();
  }, [cargar, avisos.soporte, version]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, REFRESCO_BANDEJA_MS);
    return () => clearInterval(t);
  }, [cargar]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="space-y-3 border-b border-border px-4 py-4">
        <Chips
          opciones={VISTAS.map((v) => ({ id: v.id, texto: v.texto, cuenta: v.id === 'pendientes' ? avisos.soporte : undefined }))}
          valor={vista}
          onCambiar={(v) => {
            setVista(v);
            setOffset(0);
            setDatos(null);
          }}
        />
        <Buscador valor={q} onCambiar={setQ} placeholder="Buscar por nombre o correo" />
      </div>

      {fallo ? (
        <div className="p-4">
          <AvisoError>{fallo}</AvisoError>
        </div>
      ) : !datos ? (
        <Cargando mensaje="Cargando conversaciones" />
      ) : datos.items.length === 0 ? (
        <Vacio
          titulo={busqueda ? `Nada coincide con «${busqueda}»` : vista === 'pendientes' ? 'Todo respondido' : 'No hay conversaciones'}
          texto={busqueda ? 'Prueba con otra búsqueda.' : vista === 'pendientes' ? 'Cuando alguien escriba a soporte, aparecerá aquí.' : undefined}
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {datos.items.map((h) => (
              <li key={h.usuario.id}>
                <FilaHilo hilo={h} activo={h.usuario.id === seleccionado} onAbrir={() => onElegir(h.usuario.id)} />
              </li>
            ))}
          </ul>
          <Paginacion total={datos.total} offset={offset} limite={LIMITE} onCambiar={setOffset} />
        </>
      )}
    </section>
  );
}

function FilaHilo({ hilo: h, activo, onAbrir }: { hilo: HiloSoporte; activo: boolean; onAbrir: () => void }) {
  const prefijo = h.ultimo?.autor === 'ADMIN' ? 'Equipo: ' : h.ultimo?.autor === 'SISTEMA' ? 'Automática: ' : '';
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={activo ? 'true' : undefined}
      className={`relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${activo ? 'bg-accent/[0.06]' : 'hover:bg-background/70'}`}
    >
      {activo && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-accent" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-[14px] ${h.pendientes > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>
            {h.usuario.nombre}
          </span>
          <span className="shrink-0 text-[11.5px] text-muted tabular-nums">{espera(h.ultimoMensajeEn)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">
          {prefijo}
          {h.ultimo?.contenido ?? '—'}
        </span>
        {(h.estado === 'RESUELTO' || h.usuario.estado !== 'ACTIVO') && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {h.estado === 'RESUELTO' && <Insignia tono="exito">Resuelta</Insignia>}
            {h.usuario.estado === 'SUSPENDIDO' && <Insignia tono="peligro">Cuenta suspendida</Insignia>}
            {h.usuario.estado === 'INACTIVO' && <Insignia tono="neutro">Cuenta inactiva</Insignia>}
          </span>
        )}
      </span>
      {h.pendientes > 0 && (
        <span className="mt-0.5 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-carbon tabular-nums">
          {h.pendientes}
          <span className="sr-only"> sin leer</span>
        </span>
      )}
    </button>
  );
}

/* ================= Conversación ================= */

function Conversacion({ usuarioId, onVolver, onCambio }: { usuarioId: string; onVolver: () => void; onCambio: () => void }) {
  const [hilo, setHilo] = useState<DetalleHiloSoporte | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  /* Pide lo último. Abrirla la marca leída en el servidor: baja el contador. */
  const actualizar = useCallback(
    (primeraVez: boolean) =>
      pedir<DetalleHiloSoporte>(`/soporte/${encodeURIComponent(usuarioId)}`)
        .then((r) => {
          setHilo((previo) => {
            if (!previo) return r;
            // Se conservan los anteriores ya cargados; lo nuevo se suma al final.
            const ids = new Set(r.items.map((m) => m.id));
            const viejos = previo.items.filter((m) => !ids.has(m.id) && m.id < (r.items[0]?.id ?? 0));
            return { ...r, items: [...viejos, ...r.items], hayMas: viejos.length > 0 ? previo.hayMas : r.hayMas };
          });
          setFallo(null);
          if (primeraVez) {
            void refrescarAvisos();
            onCambio();
          }
        })
        .catch((e) => {
          if (primeraVez) setFallo(mensajeDe(e));
        }),
    [usuarioId, onCambio]
  );

  useEffect(() => {
    void actualizar(true);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void actualizar(false);
    }, REFRESCO_HILO_MS);
    return () => clearInterval(t);
  }, [actualizar]);

  const cargarAnteriores = async () => {
    const primero = hilo?.items[0];
    if (!primero) return;
    setCargandoAnteriores(true);
    try {
      const r = await pedir<DetalleHiloSoporte>(`/soporte/${encodeURIComponent(usuarioId)}?antesDe=${primero.id}`);
      setHilo((h) => (h ? { ...h, items: [...r.items, ...h.items], hayMas: r.hayMas } : h));
    } catch (e) {
      notificarError(mensajeDe(e));
    } finally {
      setCargandoAnteriores(false);
    }
  };

  /* Abajo del todo al abrir y al llegar algo; quieto al cargar anteriores. */
  const previo = useRef({ primero: 0, ultimo: 0, alto: 0 });
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el || !hilo) return;
    const primero = hilo.items[0]?.id ?? 0;
    const ultimo = hilo.items.at(-1)?.id ?? 0;
    const p = previo.current;
    if (ultimo === p.ultimo && primero !== p.primero && p.alto) el.scrollTop += el.scrollHeight - p.alto;
    else if (ultimo !== p.ultimo) el.scrollTop = el.scrollHeight;
    previo.current = { primero, ultimo, alto: el.scrollHeight };
  }, [hilo]);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  const responder = async (e?: FormEvent) => {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      const m = await pedir<MensajeSoporteAdmin>(`/soporte/${encodeURIComponent(usuarioId)}/mensajes`, 'POST', { contenido: limpio });
      setHilo((h) => (h ? { ...h, items: [...h.items.map((x) => (x.autor === 'USUARIO' && !x.leidoEn ? { ...x, leidoEn: m.creadoEn } : x)), m] } : h));
      setTexto('');
      void refrescarAvisos();
      onCambio();
    } catch (err) {
      notificarError(mensajeDe(err));
    } finally {
      setEnviando(false);
      area.current?.focus();
    }
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/⌘+Enter envía: en el panel se escriben respuestas largas con saltos de línea.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void responder();
    }
  };

  const cambiarEstado = async (estado: 'ABIERTO' | 'RESUELTO') => {
    setCambiandoEstado(true);
    try {
      await pedir(`/soporte/${encodeURIComponent(usuarioId)}/estado`, 'POST', { estado });
      notificarExito(estado === 'RESUELTO' ? 'Consulta marcada como resuelta.' : 'Consulta reabierta.');
      await actualizar(false);
      void refrescarAvisos();
      onCambio();
    } catch (e) {
      notificarError(mensajeDe(e));
    } finally {
      setCambiandoEstado(false);
    }
  };

  if (fallo) {
    return (
      <section className="rounded-2xl border border-border bg-white p-5">
        <BotonVolver onVolver={onVolver} />
        <div className="mt-3">
          <AvisoError>{fallo}</AvisoError>
        </div>
      </section>
    );
  }

  if (!hilo) {
    return (
      <section className="grid h-[calc(100svh-15rem)] min-h-[420px] place-items-center rounded-2xl border border-border bg-white">
        <Cargando mensaje="Abriendo la conversación" />
      </section>
    );
  }

  const u = hilo.usuario;

  return (
    <section className="flex h-[calc(100svh-15rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-white">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border px-5 py-4">
        <BotonVolver onVolver={onVolver} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-foreground">{u.nombre}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            {u.correo} · {u.tipo === 'NEGOCIO' ? 'Negocio' : 'Persona'} · desde {fecha(u.desde)} · {u.anuncios}{' '}
            {u.anuncios === 1 ? 'anuncio' : 'anuncios'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hilo.estado === 'RESUELTO' ? (
              <Insignia tono="exito">
                Resuelta{hilo.resueltoPor ? ` por ${hilo.resueltoPor}` : ''} · {fechaHora(hilo.resueltoEn)}
              </Insignia>
            ) : (
              <Insignia tono="info">Abierta</Insignia>
            )}
            {u.estado === 'SUSPENDIDO' && <Insignia tono="peligro">Cuenta suspendida</Insignia>}
            {u.estado === 'INACTIVO' && <Insignia tono="neutro">Cuenta inactiva</Insignia>}
          </div>
        </div>
        {hilo.estado === 'ABIERTO' ? (
          <Boton chico variante="exito" cargando={cambiandoEstado} onClick={() => void cambiarEstado('RESUELTO')}>
            Marcar resuelta
          </Boton>
        ) : (
          <Boton chico cargando={cambiandoEstado} onClick={() => void cambiarEstado('ABIERTO')}>
            Reabrir
          </Boton>
        )}
      </header>

      <div ref={lista} className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-5">
        {hilo.hayMas && (
          <div className="mb-3 text-center">
            <Boton chico disabled={cargandoAnteriores} onClick={() => void cargarAnteriores()}>
              {cargandoAnteriores ? 'Cargando…' : 'Ver mensajes anteriores'}
            </Boton>
          </div>
        )}
        <ol>
          {hilo.items.map((m, i) => (
            <BurbujaAdmin key={m.id} m={m} anterior={hilo.items[i - 1]} />
          ))}
        </ol>
      </div>

      <form onSubmit={responder} className="border-t border-border bg-white px-4 pt-3 pb-3 sm:px-5">
        {hilo.estado === 'RESUELTO' && (
          <p className="mb-2 text-[12px] text-muted">Está resuelta. Si respondes, el usuario lo verá igual; si él escribe, se reabre sola.</p>
        )}
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Respuesta para {u.nombre}</span>
            <textarea
              ref={area}
              rows={2}
              value={texto}
              maxLength={MAX_CARACTERES}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alTeclear}
              placeholder="Escribe tu respuesta. Ctrl + Enter para enviar"
              className="block max-h-40 min-h-16 w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground placeholder:text-muted/75 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
            />
          </label>
          <Boton variante="primario" type="submit" cargando={enviando} disabled={!texto.trim()}>
            Responder
          </Boton>
        </div>
        <p className="mt-1.5 flex justify-between gap-3 text-[11.5px] text-muted">
          <span>Le llega como «Soporte Baknazo», con aviso en la app y push.</span>
          {texto.length > MAX_CARACTERES - 200 && (
            <span className="tabular-nums">
              {texto.length}/{MAX_CARACTERES}
            </span>
          )}
        </p>
      </form>
    </section>
  );
}

function BotonVolver({ onVolver }: { onVolver: () => void }) {
  return (
    <button
      type="button"
      onClick={onVolver}
      aria-label="Volver a la bandeja"
      className="-ml-2 grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-background hover:text-foreground lg:hidden"
    >
      <IconoChevron izquierda />
    </button>
  );
}

function BurbujaAdmin({ m, anterior }: { m: MensajeSoporteAdmin; anterior?: MensajeSoporteAdmin }) {
  const delEquipo = m.autor !== 'USUARIO';
  const empiezaGrupo = !anterior || anterior.autor !== m.autor || anterior.admin !== m.admin;
  const quien = m.autor === 'USUARIO' ? 'Usuario' : m.autor === 'SISTEMA' ? 'Respuesta automática' : m.admin;
  return (
    <li className={`flex flex-col ${delEquipo ? 'items-end' : 'items-start'} ${empiezaGrupo ? 'mt-3 first:mt-0' : 'mt-1'}`}>
      {empiezaGrupo && <span className="mb-1 px-1 text-[11.5px] font-semibold text-muted">{quien}</span>}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 pt-2 pb-1.5 text-[14px] leading-relaxed ${
          m.autor === 'USUARIO'
            ? 'rounded-bl-md bg-white text-foreground ring-1 ring-border'
            : m.autor === 'SISTEMA'
              ? 'rounded-br-md border border-dashed border-border bg-white/70 text-foreground/80'
              : 'rounded-br-md bg-carbon text-white'
        }`}
      >
        <p className="break-words whitespace-pre-wrap">{m.contenido}</p>
        <p className={`mt-0.5 text-right text-[11px] tabular-nums ${m.autor === 'ADMIN' ? 'text-white/60' : 'text-muted'}`}>
          <time dateTime={m.creadoEn}>{fechaHora(m.creadoEn)}</time>
          {m.autor !== 'USUARIO' && m.leidoEn && <span> · leído</span>}
        </p>
      </div>
    </li>
  );
}
