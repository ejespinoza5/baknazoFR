import type { RespuestaPregunta } from '../types/anuncio';

const legible = (r: RespuestaPregunta) => (r.tipo === 'SI_NO' ? (r.respuesta === 'SI' ? 'Sí' : 'No') : r.respuesta);

/**
 * Lo que respondió alguien al cuestionario de una vacante, con cada pregunta
 * tal como estaba cuando se postuló.
 */
export default function RespuestasCuestionario({ respuestas }: { respuestas: RespuestaPregunta[] }) {
  if (respuestas.length === 0) return null;
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {respuestas.map((r, i) => (
        <div key={r.id} className="px-3.5 py-2.5">
          <dt className="text-[12.5px] leading-snug text-muted">
            <span className="tabular-nums">{i + 1}. </span>
            {r.pregunta}
          </dt>
          <dd className="mt-0.5 text-[14px] leading-relaxed whitespace-pre-line text-foreground">
            {r.respuesta === null ? (
              <span className="text-muted/80 italic">Sin responder</span>
            ) : r.tipo === 'SI_NO' ? (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                  r.respuesta === 'SI' ? 'bg-success/10 text-success-deep' : 'bg-border/70 text-foreground'
                }`}
              >
                {legible(r)}
              </span>
            ) : (
              <span className="font-medium">{legible(r)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
