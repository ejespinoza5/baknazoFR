import { IconoAlerta } from './Iconos';
import { etiqueta as claseEtiqueta } from '../screens/config/ui';
import type { Etiquetas } from '../types/anuncio';

/**
 * Etiqueta, control y mensaje de error de un campo.
 *
 * `Campo` y `GrupoChips` viven en `components` porque los usan las dos
 * pantallas que escriben un anuncio, y un campo que se ve distinto en publicar
 * y en editar sería un bug de diseño, no una diferencia de plantilla.
 */
export function Campo({
  etiqueta,
  error,
  id,
  children,
}: {
  etiqueta: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={claseEtiqueta}>
        {etiqueta}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-danger-deep">
          <IconoAlerta />
          {error}
        </p>
      )}
    </div>
  );
}

/** Grupo de opciones excluyentes; se lee como un solo campo del formulario. */
export function GrupoChips({
  etiqueta,
  opciones,
  valor,
  error,
  onElegir,
  tono,
  sobreTono,
}: {
  etiqueta: string;
  opciones: Etiquetas;
  valor: string;
  error?: string;
  onElegir: (valor: string) => void;
  tono: string;
  sobreTono: string;
}) {
  return (
    <div>
      <span className={claseEtiqueta}>{etiqueta}</span>
      <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
        {Object.entries(opciones).map(([clave, texto]) => {
          const activo = valor === clave;
          return (
            <button
              key={clave}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onElegir(activo ? '' : clave)}
              className={`h-11 flex-1 rounded-lg border px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors ${
                activo
                  ? `${tono} ${sobreTono} border-transparent`
                  : 'border-border bg-white text-foreground hover:border-muted'
              }`}
            >
              {texto}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-danger-deep">
          <IconoAlerta />
          {error}
        </p>
      )}
    </div>
  );
}
