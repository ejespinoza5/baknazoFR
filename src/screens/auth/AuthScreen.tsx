import { useMemo, useState } from 'react';
import {
  esErrorVerificacionPendiente,
  loginManual,
  obtenerSesionGoogle,
  verificarCorreoExiste,
  vincularSesionGoogle,
} from '../../api/auth';
import { claveEsValida, correoEsValido, evaluarClave } from '../../lib/password';
import BotonGoogle from '../../components/BotonGoogle';
import {
  IconoAlerta,
  IconoCheck,
  IconoEscudo,
  IconoEtiqueta,
  IconoOjo,
} from '../../components/Iconos';
import BaknazoLoader from '../../components/BaknazoLoader';
import Emblema from '../../components/Emblema';
import EsloganTyper from '../../components/EsloganTyper';
import { notificarError, notificarInfo } from '../../lib/notificar';
import {
  CacaoEcuador,
  CondorAndino,
  RosaEcuador,
  SolChimborazo,
  SombreroToquilla,
  TortugaGalapagos,
} from '../../components/SimbolosEcuador';
import type { DatosRegistroManual, RegistroPendiente, Sesion } from '../../types/auth';

type PendienteSocial = Extract<RegistroPendiente, { proveedor: 'google' }>;

type Modo = 'login' | 'registro';

interface Props {
  /** El usuario entró con correo y contraseña: ya tenemos la sesión. */
  onSesion: (sesion: Sesion, persistente: boolean) => void;
  /** Llegó un token social: falta preguntar PERSONA o NEGOCIO. */
  onTokenSocial: (pendiente: PendienteSocial) => void;
  /** Datos manuales listos: falta preguntar PERSONA o NEGOCIO. */
  onDatosListos: (datos: DatosRegistroManual) => void;
  /**
   * El login falló porque el correo aún no está verificado: hay que abrir la
   * pantalla para ingresar/re-enviar el código de verificación.
   */
  onVerificacionNecesaria: (correo: string, persistente: boolean) => void;
  /** Abre el flujo de recuperación de contraseña (pendiente de conectar). */
  onRecuperarClave?: () => void;
}

type Cargando = 'google' | 'manual' | 'verificacion' | 'vinculacion' | null;

interface VinculacionPendiente {
  id_token: string;
  correo: string;
  mensaje: string;
}

const ESLOGANES = [
  'Aquí se compra bacán.',
  'Compra bacán. Vende bacán.',
  'Está bacán. Está en BAKNAZO.',
  'Todo bacán, en un solo lugar.',
  'Pasa, mira, encuentra algo bacán.',
  'De una, encuentra lo que buscas.',
];

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

const inputBase =
  'h-11 w-full rounded-lg border border-border bg-white px-3.5 text-[15px] text-foreground placeholder:text-muted transition-colors duration-150 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50';

const botonPrimario =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[15px] font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';

const alertaError =
  'mb-5 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-danger-deep';

export default function AuthScreen({
  onSesion,
  onTokenSocial,
  onDatosListos,
  onVerificacionNecesaria,
  onRecuperarClave,
}: Props) {
  const [modo, setModo] = useState<Modo>('login');

  // ---------- Estado: inicio de sesión ----------
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
  const [cargando, setCargando] = useState<Cargando>(null);
  // Solo la validación del formulario vive aquí. Los fallos del backend salen
  // como alerta flotante para que se vean aunque el usuario esté en otra parte.
  const [errorLogin, setErrorLogin] = useState<string | null>(null);

  // ---------- Estado: vincular cuenta manual con Google ----------
  const [vinculacion, setVinculacion] =
    useState<VinculacionPendiente | null>(null);
  const [codigo, setCodigo] = useState('');
  const [errorVinculacion, setErrorVinculacion] = useState<string | null>(
    null
  );

  // ---------- Estado: crear cuenta ----------
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correoReg, setCorreoReg] = useState('');
  const [contrasenaReg, setContrasenaReg] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verClaveReg, setVerClaveReg] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);

  const reglas = useMemo(() => evaluarClave(contrasenaReg), [contrasenaReg]);

  const manejarManualSubmit = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrorLogin(null);

    if (!correo.trim() || !contrasena) {
      setErrorLogin('Escribe tu correo y tu contraseña.');
      return;
    }

    setCargando('manual');
    try {
      const sesion = await loginManual(correo.trim(), contrasena, recordarme);
      onSesion(sesion, recordarme);
    } catch (e) {
      if (esErrorVerificacionPendiente(e)) {
        onVerificacionNecesaria(correo.trim(), recordarme);
        return;
      }
      notificarError(
        e instanceof Error ? e.message : 'No se pudo iniciar sesión.'
      );
    } finally {
      setCargando(null);
    }
  };

  const manejarGoogleSuccess = async (credential?: string) => {
    if (!credential) {
      notificarError('Google no devolvió el id_token.');
      return;
    }

    setCargando('google');
    setErrorLogin(null);
    setErrorRegistro(null);
    setVinculacion(null);
    setErrorVinculacion(null);
    try {
      const resultado = await obtenerSesionGoogle(credential);
      if (resultado.caso === 'sesion') {
        onSesion(resultado.sesion, true);
      } else if (resultado.caso === 'tipo-cuenta') {
        onTokenSocial({
          proveedor: 'google',
          id_token: resultado.idToken,
        });
      } else {
        setCodigo('');
        setVinculacion({
          id_token: resultado.idToken,
          correo: resultado.correo,
          mensaje: resultado.mensaje,
        });
      }
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo continuar con Google.'
      );
    } finally {
      setCargando(null);
    }
  };

  const manejarVinculacionSubmit = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrorVinculacion(null);

    if (!/^\d{6}$/.test(codigo.trim())) {
      setErrorVinculacion('El código de verificación tiene 6 dígitos.');
      return;
    }
    if (!vinculacion) return;

    setCargando('vinculacion');
    try {
      const sesion = await vincularSesionGoogle(
        vinculacion.id_token,
        codigo.trim()
      );
      onSesion(sesion, true);
    } catch (e) {
      notificarError(
        e instanceof Error
          ? e.message
          : 'El código no es válido. Intenta nuevamente.'
      );
    } finally {
      setCargando(null);
    }
  };

  const manejarRecuperar = () => {
    setErrorLogin(null);
    if (onRecuperarClave) {
      onRecuperarClave();
      return;
    }
    notificarInfo('La recuperación de contraseña se habilitará en breve.');
  };

  const manejarRegistroSubmit = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setTocado(true);
    setErrorRegistro(null);

    if (!nombres.trim() || !apellidos.trim()) {
      setErrorRegistro('Completa tus nombres y apellidos.');
      return;
    }
    if (!correoEsValido(correoReg)) {
      setErrorRegistro('Escribe un correo válido.');
      return;
    }
    if (!claveEsValida(contrasenaReg)) {
      setErrorRegistro('La contraseña no cumple todos los requisitos.');
      return;
    }
    if (contrasenaReg !== confirmar) {
      setErrorRegistro('Las contraseñas no coinciden.');
      return;
    }

    // Antes de pasar al siguiente paso (PERSONA/NEGOCIO + datos del negocio),
    // se avisa temprano si el correo ya tiene una cuenta para no llenar todo en vano.
    setCargando('verificacion');
    try {
      const resultado = await verificarCorreoExiste(correoReg.trim());
      if (resultado.existe) {
        setErrorRegistro(
          'Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.'
        );
        return;
      }
    } catch {
      // Si la verificación falla (sin conexión o endpoint aún no desplegado),
      // se continúa: el registro final seguirá avisando de cuentas duplicadas.
    } finally {
      setCargando(null);
    }

    onDatosListos({
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      correo: correoReg.trim(),
      contrasena: contrasenaReg,
    });
  };

  const ocupado = cargando !== null;
  const mensajeCarga =
    cargando === 'google'
      ? 'Conectando con Google…'
      : cargando === 'verificacion'
        ? 'Verificando correo…'
        : 'Iniciando sesión…';

  const beneficio =
    modo === 'login'
      ? 'Usa tu cuenta de Google o el correo con el que te registraste.'
      : 'En el siguiente paso eliges si tu cuenta es de persona o de negocio.';

  const campoClase = `${inputBase} pr-11`;

  const sellos = [
    { icon: <IconoCheck ok />, texto: 'Vendedores verificados' },
    { icon: <IconoEtiqueta />, texto: 'Entregas coordinadas' },
  ];

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Escenario de marca */}
      <section className="relative hidden overflow-hidden border-r border-border bg-background px-12 pt-10 pb-10 lg:flex lg:flex-col lg:justify-between xl:px-16 2xl:px-20">
        {/* Galería de motivos ecuatorianos en aguafuerte, tintados con los
            tres colores de la marca y se desvanecen como marcas de agua. */}
        <SolChimborazo className="pointer-events-none absolute -top-14 -right-16 h-[500px] w-[500px] rotate-[8deg] text-brand/25" />
        <CondorAndino className="pointer-events-none absolute top-[33%] -left-14 h-[430px] w-[430px] -rotate-[8deg] text-accent/15" />
        <RosaEcuador className="pointer-events-none absolute top-[28%] right-10 h-[150px] w-[150px] rotate-12 text-danger/25" />
        <SombreroToquilla className="pointer-events-none absolute top-[86px] left-9 h-[125px] w-[125px] text-brand/20" />
        <TortugaGalapagos className="pointer-events-none absolute right-[24%] bottom-[15%] h-[120px] w-[120px] text-accent/20" />
        <CacaoEcuador className="pointer-events-none absolute bottom-[10%] left-[38%] h-[95px] w-[95px] text-danger/20" />

        <div className="relative flex items-center gap-2.5">
          <Emblema tamano={42} />
          <span className="text-[16px] font-semibold tracking-tight text-foreground">
            Baknazo
          </span>
        </div>

        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Tú Marketplace de confianza
          </p>
          <EsloganTyper
            esloganes={ESLOGANES}
            className="mt-5 min-h-[2.5em] text-[min(5vw,4.75rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground"
          />
        </div>

        <div className="relative border-y border-border">
          <ul className="divide-y divide-border">
            {sellos.map(({ icon, texto }, indice) => (
              <li
                key={texto}
                className="flex items-center gap-3.5 py-3.5"
              >
                <span className="font-mono text-[11px] leading-none text-muted">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <span
                  className={`grid size-6 shrink-0 place-items-center ${
                    indice === 0 ? 'text-selva' : 'text-accent'
                  }`}
                >
                  {icon}
                </span>
                <span className="text-[13.5px] font-medium text-foreground">
                  {texto}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Formulario */}
      <main className="flex flex-col px-4 pt-12 pb-16 sm:px-8 lg:justify-center lg:px-10 lg:py-3 xl:px-12 2xl:px-16">
        <div className="mx-auto w-full max-w-[560px]">
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                Tú Marketplace de confianza
              </p>
              <EsloganTyper
                esloganes={ESLOGANES}
                className="mt-3 min-h-[3.3em] text-[clamp(22px,7.5vw,30px)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground"
              />
            </div>
            <Emblema tamano={56} />
          </div>

          <h1 className="mt-8 text-[24px] leading-tight font-semibold tracking-tight text-foreground sm:text-[26px] lg:mt-0">
            {modo === 'login' ? 'Accede a tu cuenta' : 'Crea tu cuenta'}
          </h1>
          <p className="mt-2.5 max-w-[38ch] text-[14px] leading-relaxed text-muted">
            {beneficio}
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.35)] sm:p-7">
            {vinculacion ? (
              <div
                key={`vincular-${vinculacion.correo}`}
                id="auth-vincular"
                role="tabpanel"
                className="animate-bkn-in mt-4 lg:mt-5 lg:flex lg:h-[480px] lg:flex-col"
              >
                <div className="lg:my-auto">
                  <span className="inline-block rounded-md bg-background px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    Vinculación con Google
                  </span>
                  <h2 className="mt-4 max-w-[30ch] text-[19px] leading-tight font-semibold tracking-tight text-foreground">
                    Confirma tu identidad para vincular la cuenta
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">
                    {vinculacion.mensaje} Te enviamos un código de verificación
                    a{' '}
                    <strong className="font-medium text-foreground">
                      {vinculacion.correo || 'tu correo'}
                    </strong>
                    .
                  </p>

                  {errorVinculacion && (
                    <div className={alertaError} role="alert">
                      <IconoAlerta />
                      <span>{errorVinculacion}</span>
                    </div>
                  )}

                  <form
                    onSubmit={manejarVinculacionSubmit}
                    noValidate
                    className="mt-6 space-y-4"
                  >
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-muted">
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
                          setCodigo(
                            e.target.value.replace(/\D/g, '').slice(0, 6)
                          )
                        }
                        disabled={cargando === 'vinculacion'}
                        className={`${inputBase} text-center text-[18px] font-semibold tracking-[0.4em]`}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={cargando === 'vinculacion'}
                      className={botonPrimario}
                    >
                      {cargando === 'vinculacion'
                        ? <BaknazoLoader tamano="boton" mensaje="Verificando" />
                        : 'Verificar y continuar'}
                    </button>
                  </form>

                  <p className="mt-4 text-[12px] leading-relaxed text-muted">
                    El código dura unos minutos y sirve una sola vez. Si no
                    llega o ya no es válido, vuelve a entrar con Google para
                    recibir uno nuevo.
                  </p>

                  <p className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setVinculacion(null);
                        setErrorVinculacion(null);
                        setCodigo('');
                      }}
                      disabled={cargando === 'vinculacion'}
                      className="text-[13px] font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Volver a iniciar sesión
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              <>
            <div
              role="tablist"
              aria-label="Modo de acceso"
              className="relative grid grid-cols-2 rounded-xl bg-background p-1"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-lg bg-brand shadow-[0_1px_3px_rgba(31,41,55,0.18),0_2px_6px_-2px_rgba(31,41,55,0.12)] transition-transform duration-200 ease-out ${
                  modo === 'registro' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                type="button"
                role="tab"
                id="tab-entrar"
                aria-selected={modo === 'login'}
                aria-controls="auth-formulario"
                onClick={() => setModo('login')}
                className={`relative z-10 rounded-lg py-3 text-center text-[14px] transition-colors duration-150 ${
                  modo === 'login'
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted hover:text-foreground'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                id="tab-crear"
                aria-selected={modo === 'registro'}
                aria-controls="auth-formulario"
                onClick={() => setModo('registro')}
                className={`relative z-10 rounded-lg py-3 text-center text-[14px] transition-colors duration-150 ${
                  modo === 'registro'
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted hover:text-foreground'
                }`}
              >
                Crear cuenta
              </button>
            </div>

            {ocupado ? (
              <div className="animate-bkn-in mt-4 grid place-items-center py-14 lg:mt-5 lg:h-[480px]">
                <BaknazoLoader mensaje={mensajeCarga} />
              </div>
            ) : modo === 'login' ? (
              <div
                key={modo}
                id="auth-formulario"
                role="tabpanel"
                aria-labelledby="tab-entrar"
                className="animate-bkn-in mt-4 lg:mt-5 lg:flex lg:h-[480px] lg:flex-col"
              >
                <div className="lg:my-auto">
                {errorLogin && (
                  <div className={alertaError} role="alert">
                    <IconoAlerta />
                    <span>{errorLogin}</span>
                  </div>
                )}

                <BotonGoogle
                  clientId={googleClientId}
                  tipo="continuar"
                  cargando={cargando === 'google'}
                  deshabilitado={ocupado}
                  onCredencial={manejarGoogleSuccess}
                  onError={notificarError}
                />

                <div className="my-4 flex items-center gap-3 text-[12px] text-muted">
                  <span className="h-px flex-1 bg-border" />
                  o continúa con tu correo
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={manejarManualSubmit} noValidate className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-muted">
                      Correo
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="usuario@correo.com"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      disabled={ocupado}
                      className={inputBase}
                    />
                  </label>

                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span
                        id="etiqueta-clave"
                        className="text-[13px] font-medium text-muted"
                      >
                        Contraseña
                      </span>
                      <button
                        type="button"
                        onClick={manejarRecuperar}
                        disabled={ocupado}
                        className="text-[13px] font-medium text-accent hover:underline disabled:opacity-50"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={verClave ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-labelledby="etiqueta-clave"
                        placeholder="••••••••"
                        value={contrasena}
                        onChange={(e) => setContrasena(e.target.value)}
                        disabled={ocupado}
                        className={campoClase}
                      />
                      <button
                        type="button"
                        onClick={() => setVerClave((v) => !v)}
                        aria-label={
                          verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'
                        }
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
                      >
                        <IconoOjo abierto={verClave} />
                      </button>
                    </div>
                  </div>

                  <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
                    <input
                      type="checkbox"
                      checked={recordarme}
                      onChange={(e) => setRecordarme(e.target.checked)}
                      disabled={ocupado}
                      className="size-4 accent-accent"
                    />
                    Mantener sesión iniciada
                  </label>

                  <button type="submit" disabled={ocupado} className={botonPrimario}>
                    {cargando === 'manual' ? <BaknazoLoader tamano="boton" mensaje="Entrando" /> : 'Iniciar sesión'}
                  </button>
                </form>
                </div>
              </div>
            ) : (
              <div
                key={modo}
                id="auth-formulario"
                role="tabpanel"
                aria-labelledby="tab-crear"
                className="animate-bkn-in mt-4 lg:mt-5 lg:flex lg:h-[480px] lg:flex-col"
              >
                <div className="lg:my-auto">
                {errorRegistro && (
                  <div className={alertaError} role="alert">
                    <IconoAlerta />
                    <span>{errorRegistro}</span>
                  </div>
                )}

                <BotonGoogle
                  clientId={googleClientId}
                  tipo="registrarse"
                  cargando={cargando === 'google'}
                  deshabilitado={ocupado}
                  onCredencial={(idToken) => {
                    setErrorRegistro(null);
                    manejarGoogleSuccess(idToken);
                  }}
                  onError={notificarError}
                />

                <div className="my-4 flex items-center gap-3 text-[12px] text-muted">
                  <span className="h-px flex-1 bg-border" />
                  o continúa con tu correo
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form
                  onSubmit={manejarRegistroSubmit}
                  noValidate
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-muted">
                        Nombres
                      </span>
                      <input
                        type="text"
                        autoComplete="given-name"
                        placeholder="Juan"
                        value={nombres}
                        onChange={(e) => setNombres(e.target.value)}
                        className={inputBase}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-muted">
                        Apellidos
                      </span>
                      <input
                        type="text"
                        autoComplete="family-name"
                        placeholder="Pérez"
                        value={apellidos}
                        onChange={(e) => setApellidos(e.target.value)}
                        className={inputBase}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-muted">
                      Correo
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="usuario@correo.com"
                      value={correoReg}
                      onChange={(e) => setCorreoReg(e.target.value)}
                      className={inputBase}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span className="mb-1.5 block text-[13px] font-medium text-muted">
                        Contraseña
                      </span>
                      <div className="relative">
                        <input
                          type={verClaveReg ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="ClaveSegura1!"
                          value={contrasenaReg}
                          onChange={(e) => setContrasenaReg(e.target.value)}
                          className={campoClase}
                        />
                        <button
                          type="button"
                          onClick={() => setVerClaveReg((v) => !v)}
                          aria-label={
                            verClaveReg
                              ? 'Ocultar contraseña'
                              : 'Mostrar contraseña'
                          }
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
                        >
                          <IconoOjo abierto={verClaveReg} />
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-muted">
                        Repetir contraseña
                      </span>
                      <input
                        type={verClaveReg ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        className={inputBase}
                      />
                    </label>
                  </div>

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

                  <button type="submit" className={botonPrimario}>
                    Continuar
                  </button>
                </form>
                </div>
              </div>
            )}
              </>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-2.5 text-[13px] text-muted">
            <span className="grid size-5 shrink-0 place-items-center text-accent">
              <IconoEscudo />
            </span>
            Tus datos protegidos
          </p>
        </div>
      </main>
    </div>
  );
}