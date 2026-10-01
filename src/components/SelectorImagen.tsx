import { IconoCamara, IconoFoto } from './Iconos';
import { OCULTO_CON_RATON, SOLO_CON_RATON } from '../lib/tactil';

/**
 * `image/*` a secas, no la lista de formatos de la app.
 *
 * Android no ofrece la cámara cuando el filtro `accept` es una lista específica
 * de extensiones: el selector solo muestra archivos. Con el comodín la opción de
 * cámara aparece, y un input aparte con `capture` la abre directamente sin pasar
 * por el selector.
 */
const ACEPTAR = 'image/*';

const boton =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';

const inactivo = 'pointer-events-none opacity-50';

interface Props {
  /**
   * Fuerza el texto del botón de archivo en cualquier pantalla. Si se omite,
   * dice "Galería" donde hay cámara y "Elegir imagen" donde no.
   */
  etiqueta?: string;
  deshabilitado?: boolean;
  /** Recibe null si el usuario cancela. */
  onElegir: (archivo: File | null) => void;
}

export default function SelectorImagen({
  etiqueta,
  deshabilitado = false,
  onElegir,
}: Props) {
  const manejar = (evento: React.ChangeEvent<HTMLInputElement>) => {
    onElegir(evento.target.files?.[0] ?? null);
    // Vaciar el valor permite volver a elegir el mismo archivo dos veces.
    evento.target.value = '';
  };

  return (
    <div className="flex flex-wrap gap-2">
      <label
        className={`${boton} ${OCULTO_CON_RATON} ${deshabilitado ? inactivo : ''}`}
      >
        <IconoCamara />
        Cámara
        <input
          type="file"
          accept={ACEPTAR}
          capture="user"
          className="sr-only"
          disabled={deshabilitado}
          onChange={manejar}
        />
      </label>

      <label className={`${boton} ${deshabilitado ? inactivo : ''}`}>
        <IconoFoto />
        {etiqueta ?? (
          <>
            <span className={OCULTO_CON_RATON}>Galería</span>
            <span className={`hidden ${SOLO_CON_RATON}`}>Elegir imagen</span>
          </>
        )}
        <input
          type="file"
          accept={ACEPTAR}
          className="sr-only"
          disabled={deshabilitado}
          onChange={manejar}
        />
      </label>
    </div>
  );
}
