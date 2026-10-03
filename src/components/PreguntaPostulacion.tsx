import { IconoAlerta } from './Iconos';
import type { PreguntaEmpleo } from '../types/anuncio';

/** Una pregunta del cuestionario de una vacante, con el control que pide su tipo. */
export default function PreguntaPostulacion({
  pregunta: p,
  numero,
  valor,
  error,
  onCambiar,
}: {
  pregunta: PreguntaEmpleo;
  numero: number;
  valor: string;
  error?: string;
  onCambiar: (valor: string) => void;
}) {
  const idTitulo = `pregunta-${p.id}`;
  const opciones: { valor: string; texto: string }[] =
    p.tipo === 'SI_NO'
      ? [
          { valor: 'SI', texto: 'Sí' },
          { valor: 'NO', texto: 'No' },
        ]
      : (p.opciones ?? []).map((o) => ({ valor: o, texto: o }));

  return (
    <div>
      <p id={idTitulo} className="mb-1.5 text-[13.5px] leading-snug font-medium text-foreground">
        <span className="text-muted tabular-nums">{numero}. </span>
        {p.texto}
        {p.obligatoria ? (
          <span className="text-empleo-deep">
            {' '}*<span className="sr-only"> obligatoria</span>
          </span>
        ) : (
          <span className="font-normal text-muted/80"> (opcional)</span>
        )}
      </p>

      {p.tipo === 'TEXTO' ? (
        <textarea
          aria-labelledby={idTitulo}
          value={valor}
          onChange={(e) => onCambiar(e.target.value.slice(0, 1000))}
          rows={2}
          aria-invalid={Boolean(error)}
          className={`w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[14.5px] leading-relaxed text-foreground placeholder:text-muted/70 focus:ring-[3px] focus:outline-none ${
            error ? 'border-danger/50 focus:ring-danger/15' : 'border-border focus:border-accent/70 focus:ring-accent/15'
          }`}
        />
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={idTitulo}
          className={`flex gap-2 ${p.tipo === 'OPCION' ? 'flex-col sm:flex-row sm:flex-wrap' : 'flex-wrap'}`}
        >
          {opciones.map((o) => {
            const activa = valor === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={activa}
                // Tocar la elegida en una opcional la desmarca.
                onClick={() => onCambiar(activa && !p.obligatoria ? '' : o.valor)}
                className={`min-h-10 rounded-lg border px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                  p.tipo === 'SI_NO' ? 'min-w-20 text-center' : 'text-left'
                } ${
                  activa
                    ? 'border-transparent bg-empleo text-white'
                    : error
                      ? 'border-danger/40 bg-white text-foreground hover:border-danger/60'
                      : 'border-border bg-white text-foreground hover:border-muted'
                }`}
              >
                {o.texto}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-danger-deep">
          <IconoAlerta />
          {error}
        </p>
      )}
    </div>
  );
}
