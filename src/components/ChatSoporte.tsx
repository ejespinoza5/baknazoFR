import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Emblema from './Emblema';
import BaknazoLoader from './BaknazoLoader';
import { IconoCerrar, IconoEnviar, IconoVisto } from './Iconos';
import { notificarError } from '../lib/notificar';
import { cargarAnterioresSoporte, cargarSoporte, enviarMensajeSoporte, useSoporte, useVistaSoporte } from '../lib/soporte';
import type { MensajeSoporte } from '../types/soporte';

const MAX_CARACTERES = 2000;

/** Temas para empezar: rellenan la caja, no envían nada solos. */
const TEMAS = [
  { texto: 'Me rechazaron un anuncio', inicio: 'Hola, me rechazaron un anuncio y quiero saber por qué. El anuncio es: ' },
  { texto: 'Problema con mi cuenta', inicio: 'Hola, tengo un problema con mi cuenta: ' },
  { texto: 'Quiero reportar algo', inicio: 'Hola, quiero reportar lo siguiente: ' },
  { texto: 'Otra consulta', inicio: 'Hola, ' },
];

function cuando(fecha: string): string {
  const d = new Date(fecha);
  const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return hora;
  return `${d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}, ${hora}`;
}

/**
 * La conversación con el equipo de Baknazo. Es la misma pieza en el panel
 * flotante de escritorio y en Configuración: llena el alto que le dé su
 * contenedor (cabecera arriba, mensajes en medio, caja de texto abajo).
 */
export default function ChatSoporte({ onCerrar }: { onCerrar?: () => void }) {
  useVistaSoporte();
  const s = useSoporte();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  /* Al llegar algo nuevo se baja al final; al cargar anteriores, la vista se
     queda donde estaba (crece hacia arriba). */
  const previo = useRef({ primero: 0, ultimo: 0, alto: 0 });
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    const primero = s.mensajes[0]?.id ?? 0;
    const ultimo = s.mensajes.at(-1)?.id ?? 0;
    const p = previo.current;
    if (ultimo === p.ultimo && primero !== p.primero && p.alto) el.scrollTop += el.scrollHeight - p.alto;
    else if (ultimo !== p.ultimo) el.scrollTop = el.scrollHeight;
    previo.current = { primero, ultimo, alto: el.scrollHeight };
  }, [s.mensajes]);

  /* La caja crece con el texto hasta unas cinco líneas. */
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [texto]);

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      await enviarMensajeSoporte(limpio);
      setTexto('');
    } catch (err) {
      notificarError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
      area.current?.focus();
    }
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // En el ordenador Enter envía y Mayús+Enter salta de línea; en táctil, Enter salta.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    void enviar();
  };

  const elegirTema = (inicio: string) => {
    setTexto(inicio);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(inicio.length, inicio.length);
    });
  };

  const vacio = s.cargado && s.mensajes.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-carbon">
          <span className="rounded-full bg-white p-0.5">
            <Emblema tamano={26} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">Soporte Baknazo</p>
          <p className="truncate text-[12px] text-muted">Te respondemos aquí, normalmente en menos de 24 horas</p>
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar soporte"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <IconoCerrar />
          </button>
        )}
      </header>

      <div ref={lista} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite">
        {!s.cargado && s.cargando ? (
          <div className="grid h-full place-items-center">
            <BaknazoLoader tamano="seccion" mensaje="Cargando la conversación…" />
          </div>
        ) : !s.cargado && s.error ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-[13.5px] text-muted">{s.error}</p>
              <button
                type="button"
                onClick={() => void cargarSoporte()}
                className="mt-3 inline-flex h-9 items-center rounded-lg border border-border bg-white px-3.5 text-[13px] font-medium text-foreground hover:border-muted"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : vacio ? (
          <Bienvenida onTema={elegirTema} />
        ) : (
          <>
            {s.hayMas && (
              <div className="mb-3 text-center">
                <button
                  type="button"
                  onClick={() => void cargarAnterioresSoporte()}
                  disabled={s.cargando}
                  className="rounded-full border border-border bg-white px-3 py-1 text-[12px] font-medium text-muted hover:text-foreground disabled:opacity-60"
                >
                  {s.cargando ? 'Cargando…' : 'Ver mensajes anteriores'}
                </button>
              </div>
            )}
            <ol className="space-y-0">
              {s.mensajes.map((m, i) => (
                <Burbuja key={m.id} m={m} anterior={s.mensajes[i - 1]} />
              ))}
            </ol>
            {s.estado === 'RESUELTO' && (
              <p className="mx-auto mt-5 max-w-[34ch] rounded-xl bg-success/10 px-3 py-2 text-center text-[12.5px] leading-snug text-success-deep">
                El equipo dio esta consulta por resuelta. Si necesitas algo más, escríbenos y la retomamos.
              </p>
            )}
          </>
        )}
      </div>

      <form onSubmit={enviar} className="shrink-0 border-t border-border bg-white px-3 pt-3 pb-3 sm:px-4">
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Mensaje para Soporte Baknazo</span>
            <textarea
              ref={area}
              rows={1}
              value={texto}
              maxLength={MAX_CARACTERES}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alTeclear}
              disabled={!s.cargado}
              placeholder="Cuéntanos en qué te ayudamos"
              className="block max-h-33 min-h-11 w-full resize-none rounded-2xl border border-border bg-white px-4 py-2.5 text-[14.5px] leading-snug text-foreground placeholder:text-muted/80 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none disabled:bg-background"
            />
          </label>
          <button
            type="submit"
            aria-label="Enviar mensaje"
            disabled={!texto.trim() || enviando || !s.cargado}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-foreground transition-colors hover:bg-brand-dark disabled:bg-border/80 disabled:text-muted"
          >
            {enviando ? <BaknazoLoader tamano="boton" /> : <IconoEnviar />}
          </button>
        </div>
        {texto.length > MAX_CARACTERES - 200 && (
          <p className="mt-1 text-right text-[11.5px] text-muted tabular-nums">
            {texto.length}/{MAX_CARACTERES}
          </p>
        )}
      </form>
    </div>
  );
}

function Bienvenida({ onTema }: { onTema: (inicio: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-end">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
        <p className="text-[15px] font-semibold text-foreground">¿En qué te ayudamos?</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Escríbenos sobre tu cuenta, un anuncio rechazado o algo que viste en Baknazo. Un administrador te
          responderá en esta misma conversación y te avisaremos cuando lo haga.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {TEMAS.map((t) => (
            <button
              key={t.texto}
              type="button"
              onClick={() => onTema(t.inicio)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              {t.texto}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Burbuja({ m, anterior }: { m: MensajeSoporte; anterior?: MensajeSoporte }) {
  const mio = m.autor === 'usuario';
  // El nombre del equipo va solo al empezar un grupo suyo.
  const empiezaGrupo = !anterior || (anterior.autor === 'usuario') !== mio;
  return (
    <li className={`flex flex-col ${mio ? 'items-end' : 'items-start'} ${empiezaGrupo ? 'mt-3 first:mt-0' : 'mt-1'}`}>
      {!mio && empiezaGrupo && (
        <span className="mb-1 px-1 text-[11.5px] font-semibold text-muted">
          {m.autor === 'sistema' ? 'Respuesta automática' : 'Soporte Baknazo'}
        </span>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 pt-2 pb-1.5 text-[14px] leading-relaxed ${
          mio
            ? 'rounded-br-md bg-accent text-white'
            : m.autor === 'sistema'
              ? 'rounded-bl-md border border-dashed border-border bg-white/60 text-foreground/90'
              : 'rounded-bl-md bg-white text-foreground ring-1 ring-border'
        }`}
      >
        <p className="break-words whitespace-pre-wrap">{m.contenido}</p>
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums ${mio ? 'text-white/75' : 'text-muted'}`}>
          <time dateTime={m.creadoEn}>{cuando(m.creadoEn)}</time>
          {mio && (
            <span title={m.leidoEn ? 'Leído por el equipo' : 'Enviado'} className={`inline-flex [&>svg]:size-3.5 ${m.leidoEn ? 'text-brand' : ''}`}>
              <IconoVisto doble={Boolean(m.leidoEn)} />
              <span className="sr-only">{m.leidoEn ? 'Leído por el equipo' : 'Enviado'}</span>
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
