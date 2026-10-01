import { useEffect, useRef } from 'react';
import { IconoBocadillo, IconoCerrar, IconoTelefono } from './Iconos';
import { mensajeDeMotivo } from '../lib/contacto';
import type { RespuestaContacto } from '../types/anuncio';

interface Props {
  /** `null` mientras no hay nada que mostrar: el modal no se monta. */
  contacto: RespuestaContacto | null;
  /** A quién se va a llamar, para el encabezado. */
  nombreAutor: string;
  /** Abre el chat. Hoy avisa, igual que el botón de la cabecera. */
  onEscribir: () => void;
  onCerrar: () => void;
}

/**
 * El número de quien publicó, con las dos cosas que se hacen con él.
 *
 * Vive en un modal y no en la tarjeta por dos razones. La tarjeta se comparte por
 * pantalla y un teléfono suelto es difícil de seleccionar sin tocar justo el
 * número; y el reveal es una decisión —lo pide quien mira— que merece un
 * momento propio, no un número que aparece de golpe en la fila.
 *
 * El enlace de WhatsApp no se arma aquí: lo envía el backend ya con su texto de
 * arranque. Si se compusiera en el cliente, dejaría de funcionar en cuanto
 * cambiara ese texto, y sin dar ningún error visible.
 */
export default function ModalContacto({
  contacto,
  nombreAutor,
  onEscribir,
  onCerrar,
}: Props) {
  const botonCerrar = useRef<HTMLButtonElement>(null);

  /* Escape cierra, y el foco entra al modal: si no, el teclado sigue en la
     tarjeta de detrás y al tabular se movería por contenido invisible. */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPulsar);
    botonCerrar.current?.focus();
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  if (!contacto) return null;

  const disponible = contacto.disponible ? contacto : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-carbon/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contacto-titulo"
    >
      <button
        type="button"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
      />

      <div className="relative w-full max-w-[420px] rounded-t-2xl border border-border bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_64px_-24px_rgba(31,41,55,0.5)] sm:rounded-2xl">
        <button
          ref={botonCerrar}
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute top-3.5 right-3.5 rounded-md p-1.5 text-muted transition-colors hover:bg-canvas hover:text-foreground"
        >
          <IconoCerrar />
        </button>

        <h2
          id="contacto-titulo"
          className="pr-8 text-[16px] leading-tight font-semibold tracking-tight text-foreground"
        >
          Contactar a {nombreAutor}
        </h2>

        {disponible ? (
          <>
            <p className="mt-0.5 text-[12px] text-muted">
              Teléfono de contacto
            </p>
            <a
              href={`tel:${disponible.telefono}`}
              className="mt-0.5 block text-[26px] leading-tight font-semibold tracking-tight text-foreground"
            >
              {disponible.telefonoLegible}
            </a>

            <div className="mt-4 flex gap-2">
              <a
                href={`tel:${disponible.telefono}`}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-dark"
              >
                <IconoTelefono />
                Marcar
              </a>
              {disponible.enlaceWhatsapp && (
                <a
                  href={disponible.enlaceWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-white text-[15px] font-semibold text-foreground transition-colors hover:border-muted hover:bg-canvas"
                >
                  <IconoBocadillo />
                  WhatsApp
                </a>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onEscribir}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-muted transition-colors hover:bg-canvas hover:text-foreground"
              >
                <IconoBocadillo />
                Enviar mensaje por el chat
              </button>
            </div>
          </>
        ) : (
          <p className="mt-3 flex items-start gap-2.5 text-[13.5px] leading-snug text-muted">
            <span className="mt-0.5 shrink-0 text-muted">
              <IconoTelefono />
            </span>
            {/* Se estrecha en vez de decir `contacto.motivo`, que solo existe en
                la rama `false`: en la `true` esa propiedad no está y el
                compilador lo avisa. */}
            {mensajeDeMotivo(!contacto.disponible ? contacto.motivo : undefined)}
          </p>
        )}
      </div>
    </div>
  );
}
