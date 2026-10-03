import { useEffect, useRef, useState } from 'react';
import { denunciarAnuncio } from '../api/anuncios';
import { estadoDe } from '../api/token';
import { useBloqueoScroll } from '../lib/bloqueoScroll';
import { notificarExito, notificarInfo, notificarError } from '../lib/notificar';
import BaknazoLoader from './BaknazoLoader';
import { IconoBandera, IconoCerrar } from './Iconos';

// Coinciden con los motivos que acepta el servidor.
const MOTIVOS = [
  { id: 'PROHIBIDO', nombre: 'Es algo prohibido o ilegal', ayuda: 'Drogas, armas, documentos falsos, animales silvestres…' },
  { id: 'ESTAFA', nombre: 'Parece una estafa', ayuda: 'Piden pagos por adelantado, precios irreales o datos personales.' },
  { id: 'OFENSIVO', nombre: 'Contenido ofensivo o sexual', ayuda: 'Fotos o texto inapropiados, discriminación o acoso.' },
  { id: 'FALSO', nombre: 'Información falsa', ayuda: 'Lo que muestra no corresponde con lo que ofrece.' },
  { id: 'DUPLICADO', nombre: 'Está repetido', ayuda: 'La misma publicación aparece varias veces.' },
  { id: 'OTRO', nombre: 'Otro motivo', ayuda: 'Cuéntanos qué pasa en el campo de abajo.' },
];

/**
 * Denunciar un anuncio. Una vez por persona; con varias denuncias de personas
 * distintas, el anuncio sale del feed hasta que alguien del equipo lo revise.
 */
export default function DenunciarAnuncio({ anuncioId, onCerrar }: { anuncioId: number; onCerrar: () => void }) {
  useBloqueoScroll();
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  // onCerrar llega nuevo en cada render: se guarda para no rehacer el efecto.
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
    };
    window.addEventListener('keydown', alTeclear);
    caja.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  const pideDetalle = motivo === 'OTRO';

  const enviar = async () => {
    if (!motivo || (pideDetalle && !detalle.trim())) return;
    setEnviando(true);
    try {
      await denunciarAnuncio(anuncioId, motivo, detalle);
      notificarExito('Gracias por avisarnos. El equipo de Baknazo revisará esta publicación.');
      onCerrar();
    } catch (e) {
      if (estadoDe(e) === 409) {
        notificarInfo('Ya denunciaste esta publicación. La estamos revisando.');
        onCerrar();
      } else {
        notificarError(e instanceof Error ? e.message : 'No se pudo enviar la denuncia.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="animate-bkn-velo fixed inset-0 z-[80] grid place-items-end bg-carbon/45 sm:place-items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-denuncia"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={caja}
        className="animate-bkn-in flex max-h-[92svh] w-full flex-col rounded-t-2xl border border-border bg-white shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger-deep">
            <IconoBandera />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-denuncia" className="text-[17px] font-semibold tracking-tight text-foreground">
              Denunciar publicación
            </h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              Es anónimo: quien la publicó no sabrá que fuiste tú.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:px-6">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-foreground">¿Qué está mal?</legend>
            <div className="grid gap-1.5">
              {MOTIVOS.map((m) => {
                const activo = motivo === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                      activo ? 'border-danger/45 bg-danger/[0.04]' : 'border-border hover:border-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivo-denuncia"
                      value={m.id}
                      checked={activo}
                      onChange={() => setMotivo(m.id)}
                      className="mt-1 size-4 shrink-0 accent-danger"
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-foreground">{m.nombre}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-muted">{m.ayuda}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-medium text-foreground">
              Cuéntanos más{' '}
              {pideDetalle ? (
                <span className="text-danger-deep">*</span>
              ) : (
                <span className="font-normal text-muted">(opcional)</span>
              )}
            </span>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Cualquier dato ayuda al equipo a decidir más rápido."
              className="w-full resize-y rounded-lg border border-border bg-white px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted/70 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
            />
            <span className="mt-1 block text-right text-[11.5px] text-muted tabular-nums">{detalle.length}/500</span>
          </label>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onCerrar}
            className="h-11 flex-1 rounded-lg border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-muted sm:h-10 sm:flex-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!motivo || (pideDetalle && !detalle.trim()) || enviando}
            className="h-11 flex-[2] rounded-lg bg-danger px-4 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:h-10 sm:flex-none"
          >
            {enviando ? <BaknazoLoader tamano="boton" mensaje="Enviando" /> : 'Enviar denuncia'}
          </button>
        </div>
      </div>
    </div>
  );
}
