import { useEffect, useMemo, useState } from 'react';
import {
  restablecerContrasena,
  solicitarRecuperacion,
  verificarCodigoRecuperacion,
} from '../../api/auth';
import { claveEsValida, correoEsValido, evaluarClave } from '../../lib/password';
import Emblema from '../../components/Emblema';
import {
  notificarError,
  notificarExito,
} from '../../lib/notificar';
import {
  IconoAlerta,
  IconoCheck,
  IconoEtiqueta,
  IconoOjo,
} from '../../components/Iconos';
import BaknazoLoader from '../../components/BaknazoLoader';

const inputBase =
  'h-11 w-full rounded-lg border border-claro bg-white px-3.5 text-[15px] text-carbon placeholder:text-medio/70 transition-colors duration-150 focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15 disabled:cursor-not-allowed disabled:opacity-50';

const alertaError =
  'mb-5 flex items-start gap-2.5 rounded-lg border border-terracota/25 bg-terracota/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-[#a32531]';

const TIEMPO_REENVIO_SEG = 30;

type Paso = 'correo' | 'codigo' | 'clave' | 'exito';

interface Props {
  /** Volver a la pantalla de inicio de sesión. */
  onVolver: () => void;
}

export default function RecuperarContrasenaScreen({ onVolver }: Props) {
  const [paso, setPaso] = useState<Paso>('correo');
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [cargando, setCargando] = useState<
    'solicitar' | 'verificar' | 'reenviar' | 'restablecer' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);

  const reglas = useMemo(() => evaluarClave(nueva), [nueva]);

  useEffect(() => {
    if (segundos <= 0) return;
    const temporizador = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [segundos]);

  // Solo la validación se queda pegada al formulario; los fallos del backend
  // salen como alerta flotante.
  const limpiarFeedback = () => setError(null);

  const manejarSolicitar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    limpiarFeedback();

    if (!correoEsValido(correo)) {
      setError('Escribe un correo válido.');
      return;
    }

    setCargando('solicitar');
    try {
      const resultado = await solicitarRecuperacion(correo.trim());
      notificarExito(
        `${resultado.mensaje} Revisa también la carpeta de spam o de promociones: a veces los correos de recuperación caen ahí.`
      );
      setCodigo('');
      setPaso('codigo');
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo enviar el código.'
      );
    } finally {
      setCargando(null);
    }
  };

  const manejarVerificar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    limpiarFeedback();

    if (!/^\d{6}$/.test(codigo.trim())) {
      setError('El código de recuperación tiene 6 dígitos.');
      return;
    }

    setCargando('verificar');
    try {
      await verificarCodigoRecuperacion(correo.trim(), codigo.trim());
      setPaso('clave');
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'El código no es válido. Intenta nuevamente.'
      );
    } finally {
      setCargando(null);
    }
  };

  const manejarReenviar = async () => {
    limpiarFeedback();
    setCargando('reenviar');
    try {
      const resultado = await solicitarRecuperacion(correo.trim());
      notificarExito(
        `${resultado.mensaje} Revisa también la carpeta de spam o de promociones.`
      );
      setCodigo('');
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

  const manejarRestablecer = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setTocado(true);
    limpiarFeedback();

    if (!claveEsValida(nueva)) {
      setError('La contraseña no cumple todos los requisitos.');
      return;
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando('restablecer');
    try {
      await restablecerContrasena(correo.trim(), codigo.trim(), nueva);
      setPaso('exito');
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.'
      );
    } finally {
      setCargando(null);
    }
  };

  const campoClave = `${inputBase} pr-11`;

  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-3">
          <Emblema tamano={38} />
          <span className="text-[15px] font-semibold tracking-tight text-carbon">
            Baknazo
          </span>
        </div>

        {paso === 'correo' && (
          <div className="animate-bkn-in">
            <h1 className="mt-9 text-[25px] leading-tight font-semibold tracking-tight text-carbon">
              Recupera tu contraseña
            </h1>
            <span
              className="mt-3 block h-[3px] w-10 bg-andino"
              aria-hidden="true"
            />
            <p className="mt-4 text-[14px] leading-relaxed text-medio">
              Escribe tu correo y te enviaremos un código de 6 dígitos para
              crear una nueva contraseña.
            </p>

            {error && (
              <div className={alertaError} role="alert">
                <IconoAlerta />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={manejarSolicitar} noValidate className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-medio">
                  Correo
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="usuario@correo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  disabled={cargando !== null}
                  className={inputBase}
                />
              </label>

              <button
                type="submit"
                disabled={cargando !== null}
                className="w-full rounded-md bg-amarillo py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99] disabled:opacity-60"
              >
                {cargando === 'solicitar' ? <BaknazoLoader tamano="boton" mensaje="Enviando" /> : 'Enviar código'}
              </button>
            </form>

            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-andino/20 bg-andino/[0.04] px-3.5 py-2.5 text-[12.5px] leading-snug text-medio">
              <span className="grid size-5 shrink-0 place-items-center text-andino">
                <IconoEtiqueta />
              </span>
              <span>
                Si no recibes el correo, revisa tu carpeta de{' '}
                <strong className="font-medium text-carbon">spam</strong>.
              </span>
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
        )}

        {paso === 'codigo' && (
          <div className="animate-bkn-in">
            <h1 className="mt-9 text-[25px] leading-tight font-semibold tracking-tight text-carbon">
              Ingresa el código
            </h1>
            <span
              className="mt-3 block h-[3px] w-10 bg-andino"
              aria-hidden="true"
            />
            <p className="mt-4 text-[14px] leading-relaxed text-medio">
              Te enviamos un código de 6 dígitos a{' '}
              <strong className="font-medium text-carbon">{correo}</strong>.
            </p>

            {error && (
              <div className={`${alertaError} mt-5`} role="alert">
                <IconoAlerta />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={manejarVerificar} noValidate className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-medio">
                  Código de recuperación
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
                {cargando === 'verificar' ? <BaknazoLoader tamano="boton" mensaje="Verificando" /> : 'Continuar'}
              </button>
            </form>

            <div className="mt-5 rounded-lg border border-claro bg-white p-4">
              <p className="text-[13px] leading-snug text-medio">
                ¿No te llegó? El código dura 15 minutos.
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
                onClick={() => {
                  limpiarFeedback();
                  setPaso('correo');
                }}
                disabled={cargando !== null}
                className="text-[13px] font-medium text-andino hover:underline disabled:opacity-50"
              >
                Cambiar de correo
              </button>
            </p>
          </div>
        )}

        {paso === 'clave' && (
          <div className="animate-bkn-in">
            <h1 className="mt-9 text-[25px] leading-tight font-semibold tracking-tight text-carbon">
              Crea tu nueva contraseña
            </h1>
            <span
              className="mt-3 block h-[3px] w-10 bg-andino"
              aria-hidden="true"
            />
            <p className="mt-4 text-[14px] leading-relaxed text-medio">
              Código verificado. Escribe y confirma tu nueva contraseña.
            </p>

            {error && (
              <div className={alertaError} role="alert">
                <IconoAlerta />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={manejarRestablecer}
              noValidate
              className="mt-6 space-y-4"
            >
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-medio">
                  Nueva contraseña
                </span>
                <div className="relative">
                  <input
                    type={verClave ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="NuevaClave1!"
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                    disabled={cargando !== null}
                    className={campoClave}
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label={
                      verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-medio transition-colors hover:text-carbon"
                  >
                    <IconoOjo abierto={verClave} />
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-medio">
                  Confirmar contraseña
                </span>
                <input
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  disabled={cargando !== null}
                  className={inputBase}
                />
              </label>

              <ul className="grid gap-1.5 sm:grid-cols-2">
                {reglas.map((regla) => (
                  <li
                    key={regla.id}
                    className={`flex items-center gap-2 text-[12px] ${
                      regla.cumple
                        ? 'text-[#17794b]'
                        : tocado
                          ? 'text-[#a32531]'
                          : 'text-medio'
                    }`}
                  >
                    <IconoCheck ok={regla.cumple} />
                    {regla.texto}
                  </li>
                ))}
              </ul>

              <button
                type="submit"
                disabled={cargando !== null}
                className="w-full rounded-md bg-amarillo py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99] disabled:opacity-60"
              >
                {cargando === 'restablecer'
                  ? <BaknazoLoader tamano="boton" mensaje="Guardando" />
                  : 'Guardar nueva contraseña'}
              </button>
            </form>

            <p className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  limpiarFeedback();
                  setPaso('codigo');
                }}
                disabled={cargando !== null}
                className="text-[13px] font-medium text-andino hover:underline disabled:opacity-50"
              >
                Volver al código
              </button>
            </p>
          </div>
        )}

        {paso === 'exito' && (
          <div className="animate-bkn-in">
            <div className="mt-9 grid place-items-center rounded-2xl border border-claro bg-white px-5 py-10 text-center shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.35)]">
              <span className="grid size-14 place-items-center rounded-full bg-selva/10 text-selva">
                <IconoCheck ok />
              </span>
              <h1 className="mt-5 text-[22px] leading-tight font-semibold tracking-tight text-carbon">
                Contraseña actualizada
              </h1>
              <p className="mt-2.5 max-w-[30ch] text-[14px] leading-relaxed text-medio">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button
                type="button"
                onClick={onVolver}
                className="mt-6 w-full rounded-md bg-amarillo py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99]"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}