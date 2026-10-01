import { useEffect, useRef, useState } from 'react';

type RespuestaCredencial = { credential?: string; select_by?: string };

interface Props {
  clientId: string;
  /** Texto oficial del botón: "Continuar con Google" o "Registrarse con Google". */
  tipo: 'continuar' | 'registrarse';
  cargando?: boolean;
  deshabilitado?: boolean;
  onCredencial: (idToken: string) => void;
  onError?: (mensaje: string) => void;
}

type CuentaGoogle = {
  initialize: (config: {
    client_id: string;
    callback: (respuesta: RespuestaCredencial) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    opciones: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      shape: 'pill';
      locale: string;
      text: 'continue_with' | 'signup_with';
      logo_alignment: 'left';
      width: number;
    }
  ) => void;
};

type VentanaConGoogle = typeof window & {
  google?: { accounts?: { id?: CuentaGoogle } };
};

const obtenerGoogle = () =>
  (window as VentanaConGoogle).google?.accounts?.id;

/** Ancho máximo del botón: con eso queda como pastilla compacta y centrada. */
const ANCHO_MAXIMO = 340;

/**
 * Botón oficial "Continuar con Google" renderizado en DOM (sin iframe).
 * Con `renderButton` el clic abre el selector clásico de cuentas de Google;
 * NO usa `prompt()` (que muestra la ventanita de One Tap arriba a la derecha).
 */
export default function BotonGoogle({
  clientId,
  tipo,
  cargando = false,
  deshabilitado = false,
  onCredencial,
  onError,
}: Props) {
  const [disponible, setDisponible] = useState(() => Boolean(obtenerGoogle()));
  const refMarco = useRef<HTMLDivElement>(null);
  const refContenedor = useRef<HTMLDivElement>(null);
  const refCallbacks = useRef({ onCredencial, onError });

  useEffect(() => {
    refCallbacks.current = { onCredencial, onError };
  });

  useEffect(() => {
    if (disponible) return;
    const intervalo = window.setInterval(() => {
      if (obtenerGoogle()) setDisponible(true);
    }, 250);
    const tope = window.setTimeout(() => window.clearInterval(intervalo), 10000);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(tope);
    };
  }, [disponible]);

  useEffect(() => {
    if (!disponible) return;
    const gsi = obtenerGoogle();
    const marco = refMarco.current;
    const contenedor = refContenedor.current;
    if (!gsi?.initialize || !gsi?.renderButton || !marco || !contenedor) return;

    let cancelado = false;
    let temporizador = 0;

    const pintar = () => {
      if (cancelado) return;
      const anchoMarco = marco.offsetWidth;
      if (anchoMarco <= 0) {
        temporizador = window.setTimeout(pintar, 80);
        return;
      }

      contenedor.innerHTML = '';
      gsi.initialize({
        client_id: clientId,
        callback: (respuesta) => {
          if (respuesta.credential) {
            refCallbacks.current.onCredencial(respuesta.credential);
          } else {
            refCallbacks.current.onError?.('No se pudo continuar con Google.');
          }
        },
      });
      try {
        gsi.renderButton(contenedor, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          locale: 'es',
          text: tipo === 'registrarse' ? 'signup_with' : 'continue_with',
          logo_alignment: 'left',
          width: Math.min(anchoMarco, ANCHO_MAXIMO),
        });
      } catch {
        refCallbacks.current.onError?.('No se pudo cargar el botón de Google.');
      }
    };

    pintar();

    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
      contenedor.innerHTML = '';
    };
  }, [disponible, clientId, tipo]);

  const inactivo = cargando || deshabilitado;

  return (
    <div
      ref={refMarco}
      className={
        inactivo
          ? 'relative flex w-full cursor-not-allowed justify-center'
          : 'relative flex w-full justify-center'
      }
    >
      <div
        ref={refContenedor}
        aria-hidden={inactivo}
        className={`transition-opacity duration-150 ${
          inactivo ? 'pointer-events-none opacity-60' : ''
        }`}
      />
      {inactivo && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 cursor-not-allowed rounded-full"
        />
      )}
    </div>
  );
}