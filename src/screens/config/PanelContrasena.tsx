import { useMemo, useState, type FormEvent } from 'react';
import { cambiarContrasena } from '../../api/auth';
import { claveEsValida, evaluarClave } from '../../lib/password';
import {
  notificarError,
  notificarExito,
} from '../../lib/notificar';
import {
  IconoAlerta,
  IconoCandado,
  IconoCheck,
  IconoOjo,
} from '../../components/Iconos';
import type { RespuestaCambioContrasena } from '../../types/auth';
import { alertaError, inputBase } from './ui';
import BaknazoLoader from '../../components/BaknazoLoader';

const MAX_INTENTOS = 5;

interface Props {
  /** El backend renueva los tokens al cambiar la clave: hay que guardarlos. */
  onTokens: (tokens: RespuestaCambioContrasena) => void;
  /** La cuenta entra con Google y no tiene contraseña local. */
  soloGoogle: boolean;
}

export default function PanelContrasena({
  onTokens,
  soloGoogle,
}: Props) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Solo los errores de validación viven aquí: hay que corregir algo, así que
  // no pueden desaparecer solos. Los del backend salen como alerta flotante.
  const [error, setError] = useState<string | null>(null);

  const reglas = useMemo(() => evaluarClave(nueva), [nueva]);

  if (soloGoogle) {
    return (
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <IconoCandado />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
              Tu cuenta entra con Google
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              Como iniciaste sesión con Google no hay contraseña que cambiar.
              Gestiona tu acceso desde los ajustes de tu cuenta de Google.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setTocado(true);
    setError(null);

    if (!actual) {
      setError('Escribe tu contraseña actual.');
      return;
    }
    if (!claveEsValida(nueva)) {
      setError('La nueva contraseña no cumple todos los requisitos.');
      return;
    }
    if (nueva !== confirmar) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (nueva === actual) {
      setError('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await cambiarContrasena({
        contrasena_actual: actual,
        nueva_contrasena: nueva,
        confirmar_contrasena: confirmar,
      });
      onTokens(respuesta);
      setActual('');
      setNueva('');
      setConfirmar('');
      setTocado(false);
      notificarExito(
        respuesta.mensaje ||
          'Contraseña actualizada. Se cerraron las sesiones en otros dispositivos.'
      );
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const campoClave = `${inputBase} pr-11`;

  return (
    <section className="rounded-2xl border border-border bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <IconoCandado />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            Cambiar contraseña
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            Al cambiarla se cerrarán las sesiones abiertas en otros
            dispositivos. Este equipo seguirá conectado.
          </p>
        </div>
      </div>

      {error && (
        <div className={`${alertaError} mt-5`} role="alert">
          <IconoAlerta />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={enviar} noValidate className="mt-6 max-w-[420px] space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">
            Contraseña actual
          </span>
          <input
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="MiClave123!"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            disabled={enviando}
            className={inputBase}
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">
            Nueva contraseña
          </span>
          <div className="relative">
            <input
              type={verClave ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="NuevaClave456#"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              disabled={enviando}
              className={campoClave}
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
            >
              <IconoOjo abierto={verClave} />
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">
            Confirmar nueva contraseña
          </span>
          <input
            type={verClave ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            disabled={enviando}
            className={inputBase}
          />
          {tocado && confirmar && nueva !== confirmar && (
            <span className="mt-1 block text-[12px] text-danger-deep">
              Las contraseñas no coinciden.
            </span>
          )}
        </label>

        <ul className="grid gap-1.5 sm:grid-cols-2">
          {reglas.map((regla) => (
            <li
              key={regla.id}
              className={`flex items-center gap-2 text-[12px] ${
                regla.cumple
                  ? 'text-success-deep'
                  : tocado
                    ? 'text-danger-deep'
                    : 'text-muted'
              }`}
            >
              <IconoCheck ok={regla.cumple} />
              {regla.texto}
            </li>
          ))}
        </ul>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-brand py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {enviando ? <BaknazoLoader tamano="boton" mensaje="Guardando" /> : 'Cambiar contraseña'}
        </button>
      </form>

      <p className="mt-5 text-[12px] text-muted">
        Si olvidaste tu contraseña, ciérra sesión y usa «¿Olvidaste tu
        contraseña?» en el inicio de sesión. Solo se permiten {MAX_INTENTOS}{' '}
        intentos cada 15 minutos.
      </p>
    </section>
  );
}
