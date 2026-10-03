import type { ReactNode } from 'react';
import { toast } from 'sonner';
import {
  IconoAdvertencia,
  IconoAlerta,
  IconoBocadillo,
  IconoCerrar,
  IconoCheck,
  IconoInfo,
} from '../components/Iconos';

type TipoAlerta = 'exito' | 'error' | 'aviso' | 'info';

/**
 * Cada tipo se queda el tiempo que cuesta leerlo. Un error o una advertencia
 * piden más atención que una confirmación, así que viven más en pantalla.
 */
const DURACION: Record<TipoAlerta, number> = {
  exito: 3500,
  info: 4500,
  aviso: 6000,
  error: 7000,
};

const SELLOS: Record<TipoAlerta, ReactNode> = {
  exito: <IconoCheck ok />,
  error: <IconoAlerta />,
  aviso: <IconoAdvertencia />,
  info: <IconoInfo />,
};

/**
 * Las pantallas llaman a las cuatro funciones de abajo, nunca a sonner: así el
 * aviso se ve igual en toda la app y cambiar de librería es cosa de este
 * archivo. El recuadro que las dibuja vive en components/Alertas.
 */
function mostrar(tipo: TipoAlerta, mensaje: string) {
  return toast.custom(
    (id) => (
      <div
        className={`bkn-alerta bkn-alerta--${tipo}`}
        // Un error interrumpe al lector de pantalla; el resto espera turno.
        role={tipo === 'error' ? 'alert' : 'status'}
      >
        <span className="bkn-alerta__sello">{SELLOS[tipo]}</span>
        <p className="bkn-alerta__texto">{mensaje}</p>
        <button
          type="button"
          className="bkn-alerta__cerrar"
          aria-label="Cerrar aviso"
          onClick={() => toast.dismiss(id)}
        >
          <IconoCerrar />
        </button>
      </div>
    ),
    { duration: DURACION[tipo] }
  );
}

/** Confirmación de que algo salió bien. */
export const notificarExito = (mensaje: string) => mostrar('exito', mensaje);

/** Algo falló y el usuario tiene que hacer algo al respecto. */
/** Cierra las alertas abiertas (ej: errores viejos tras un acierto). */
export const cerrarAlertas = () => toast.dismiss();

export const notificarError =(mensaje: string) => mostrar('error', mensaje);

/** La acción se hizo, pero conviene revisarla. */
export const notificarAviso = (mensaje: string) => mostrar('aviso', mensaje);

/** Falta un dato, o una función que todavía no está disponible. */
export const notificarInfo = (mensaje: string) => mostrar('info', mensaje);

/**
 * Llegó un mensaje del chat. Es el mismo recuadro que los avisos informativos,
 * con quién escribe arriba; tocarlo abre la conversación.
 */
export function notificarMensaje(de: string, texto: string, onAbrir: () => void) {
  return toast.custom(
    (id) => (
      <div className="bkn-alerta bkn-alerta--info" role="status">
        <span className="bkn-alerta__sello">
          <IconoBocadillo />
        </span>
        <button
          type="button"
          className="bkn-alerta__texto cursor-pointer text-left"
          onClick={() => {
            toast.dismiss(id);
            onAbrir();
          }}
        >
          <strong className="block font-semibold">{de}</strong>
          <span className="line-clamp-2 text-foreground">{texto}</span>
        </button>
        <button
          type="button"
          className="bkn-alerta__cerrar"
          aria-label="Cerrar aviso"
          onClick={() => toast.dismiss(id)}
        >
          <IconoCerrar />
        </button>
      </div>
    ),
    { duration: DURACION.info }
  );
}
