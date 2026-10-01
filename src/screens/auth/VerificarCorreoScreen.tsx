import { useEffect, useState } from 'react';
import {
  reenviarVerificacion,
  type ErrorApi,
  verificarCorreo,
} from '../../api/auth';
import Emblema from '../../components/Emblema';
import {
  notificarError,
  notificarExito,
} from '../../lib/notificar';
import {
  IconoAlerta,
  IconoEtiqueta,
} from '../../components/Iconos';
import type { Sesion } from '../../types/auth';
import BaknazoLoader from '../../components/BaknazoLoader';

const inputBase =
  'h-11 w-full rounded-lg border border-claro bg-white px-3.5 text-[15px] text-carbon placeholder:text-medio/70 transition-colors duration-150 focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15 disabled:cursor-not-allowed disabled:opacity-50';

const alertaError =
  'mb-5 flex items-start gap-2.5 rounded-lg border border-terracota/25 bg-terracota/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-[#a32531]';

interface Props {
  /** Correo al que se envió el código. */
  correo: string;
  /** De dónde llegó el usuario: terminó su registro o intentó iniciar sesión. */
  origen: 'registro' | 'login';
  /** Mensaje del backend al crear la cuenta (ej: "Revisa tu correo…"). */
  mensaje?: string;
  /** "Mantener sesión iniciada": viaja al backend para decidir la cookie. */
  persistente: boolean;
  /** Código correcto: ya hay sesión iniciada. */
  onVerificado: (sesion: Sesion) => void;
  onVolver: () => void;
}

const TIEMPO_REENVIO_SEG = 30;

export default function VerificarCorreoScreen({
  correo,
  origen,
  mensaje,
  persistente,
  onVerificado,
  onVolver,
}: Props) {
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState<'verificar' | 'reenviar' | null>(
    null
  );
  // Solo el error de formato del código se queda en el formulario. Si el
  // backend lo rechaza, el aviso sale flotante.
  const [error, setError] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (segundos <= 0) return;
    const temporizador = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [segundos]);

  const manejarEnviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(codigo.trim())) {
      setError('El código de verificación tiene 6 dígitos.');
      return;
    }

    setCargando('verificar');
    try {
      const sesion = await verificarCorreo(correo, codigo.trim(), persistente);
      onVerificado(sesion);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as ErrorApi).status === 409 &&
        /ya .*verificado/i.test(e.message)
      ) {
        notificarError(
          'Tu correo ya está verificado. Vuelve a iniciar sesión con normalidad.'
        );
      } else {
        notificarError(
          e instanceof Error
            ? e.message
            : 'El código no es válido. Intenta nuevamente.'
        );
      }
    } finally {
      setCargando(null);
    }
  };

  const manejarReenviar = async () => {
    setError(null);
    setCargando('reenviar');
    try {
      const resultado = await reenviarVerificacion(correo);
      notificarExito(
        `${resultado.mensaje} Revisa también la carpeta de spam o de promociones: a veces los correos de verificación caen ahí.`
      );
      setSegundos(TIEMPO_REENVIO_SEG);
    } catch (e) {
      notificarError(
        e instanceof Error
          ? e.message
          : 'No se pudo reenviar el código. Intenta más tarde.'
      );
    } finally {
      setCargando(null);
    }
  };

  const titulo =
    origen === 'registro'
      ? 'Tu cuenta está casi lista'
      : 'Primero confirma tu correo';

  const descripcion =
    origen === 'registro'
      ? 'Elegiste verificar tu cuenta con un código. Te enviamos uno de 6 dígitos para confirmar tu correo.'
      : 'Aún no has verificado tu correo. Te enviamos un código de 6 dígitos para poder iniciar sesión.';

  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-3">
          <Emblema tamano={38} />
          <span className="text-[15px] font-semibold tracking-tight text-carbon">
            Baknazo
          </span>
        </div>

        <h1 className="mt-9 text-[25px] leading-tight font-semibold tracking-tight text-carbon">
          {titulo}
        </h1>
        <span
          className="mt-3 block h-[3px] w-10 bg-andino"
          aria-hidden="true"
        />

        <p className="mt-4 text-[14px] leading-relaxed text-medio">
          {descripcion}
        </p>

        {mensaje && (
          <p className="mt-2 text-[13px] leading-relaxed text-andino">
            {mensaje}
          </p>
        )}

        <div className="mt-5 rounded-lg border border-claro bg-white p-4">
          <span className="block text-[12px] font-semibold tracking-[0.14em] text-medio uppercase">
            El código llegó a
          </span>
          <span className="mt-1 block truncate text-[14px] font-medium text-carbon">
            {correo}
          </span>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-andino/20 bg-andino/[0.04] px-3.5 py-2.5 text-[12.5px] leading-snug text-medio">
          <span className="grid size-5 shrink-0 place-items-center text-andino">
            <IconoEtiqueta />
          </span>
          <span>
            Si no lo ves en unos minutos, revisa la carpeta de{' '}
            <strong className="font-medium text-carbon">spam</strong> o{' '}
            <strong className="font-medium text-carbon">promociones</strong>.
            El código dura 15 minutos y sirve una sola vez.
          </span>
        </div>

        {error && (
          <div className={alertaError} role="alert">
            <IconoAlerta />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={manejarEnviar} noValidate className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-medio">
              Código de verificación
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) =>
                setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              disabled={cargando !== null}
              className={`${inputBase} text-center text-[18px] font-semibold tracking-[0.4em]`}
            />
          </label>

          <button
            type="submit"
            disabled={cargando !== null}
            className="w-full rounded-md bg-amarillo py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99] disabled:opacity-60"
          >
            {cargando === 'verificar' ? <BaknazoLoader tamano="boton" mensaje="Verificando" /> : 'Verificar y continuar'}
          </button>
        </form>

        <div className="mt-5 rounded-lg border border-claro bg-white p-4">
          <p className="text-[13px] leading-snug text-medio">
            ¿No te llegó el código?
          </p>
          <button
            type="button"
            onClick={manejarReenviar}
            disabled={cargando !== null || segundos > 0}
            className="mt-2 w-full rounded-md border border-claro py-2.5 text-[14px] font-medium text-carbon transition-colors hover:border-andino hover:text-andino disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando === 'reenviar'
              ? <BaknazoLoader tamano="boton" mensaje="Reenviando" />
              : segundos > 0
                ? `Reenviar código (${segundos}s)`
                : 'Reenviar código'}
          </button>
        </div>

        <p className="mt-5 text-center">
          <button
            type="button"
            onClick={onVolver}
            disabled={cargando !== null}
            className="text-[13px] font-medium text-andino hover:underline disabled:opacity-50"
          >
            Volver a iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}