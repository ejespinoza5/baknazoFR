import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, m, type Variants } from 'motion/react';
import {
  esErrorVerificacionPendiente,
  loginManual,
  obtenerSesionGoogle,
  verificarCorreoExiste,
  vincularSesionGoogle,
} from '../../api/auth';
import { claveEsValida, correoEsValido, evaluarClave } from '../../lib/password';
import BotonGoogle from '../../components/BotonGoogle';
import AlturaAnimada from '../../components/AlturaAnimada';
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
import { cerrarAlertas, notificarError, notificarInfo } from '../../lib/notificar';
import { ENTRADA_SALIDA, HIJO, RESORTE, SALIDA } from '../../lib/movimiento';
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

/* En PC con poco alto (`bajo:`) todo se compacta un poco para caber sin scroll. */
const inputBase =
  'h-11 w-full rounded-lg border border-border bg-white px-3.5 text-[15px] text-foreground placeholder:text-muted transition-colors duration-150 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 bajo:h-10';

const botonPrimario =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-[15px] font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 bajo:h-11';

const etiqueta = 'mb-1.5 block text-[13px] font-medium text-muted bajo:mb-1';

const alertaError =
  'mb-4 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-danger-deep';

/**
 * Cambio entre "Iniciar sesión" y "Crear cuenta": el formulario que se va sale
 * hacia un lado y el nuevo entra desde el otro, según hacia dónde se movió la
 * pastilla. Sus campos llegan en cascada.
 */
const PANEL: Variants = {
  oculto: (d: number) => ({ opacity: 0, x: d * 32, filter: 'blur(3px)' }),
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, ease: SALIDA, staggerChildren: 0.035, delayChildren: 0.05 },
  },
  salida: (d: number) => ({
    opacity: 0,
    x: d * -32,
    filter: 'blur(3px)',
    transition: { duration: 0.2, ease: ENTRADA_SALIDA },
  }),
};

/** Un bloque del formulario que llega en la cascada. */
function Paso({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div variants={HIJO} className={className}>
      {children}
    </m.div>
  );
}

export default function AuthScreen({
  onSesion,
  onTokenSocial,
  onDatosListos,
  onVerificacionNecesaria,
  onRecuperarClave,
}: Props) {
  // La landing manda a /entrar?modo=registro desde "Crear cuenta" y "Publicar gratis".
  const [modo, setModo] = useState<Modo>(() =>
    new URLSearchParams(window.location.search).get('modo') === 'registro' ? 'registro' : 'login'
  );
  /** Hacia dónde se movió la pastilla: 1 a la derecha (crear), -1 a la izquierda. */
  const [direccion, setDireccion] = useState(1);
  const cambiarModo = (nuevo: Modo) => {
    if (nuevo === modo) return;
    setDireccion(nuevo === 'registro' ? 1 : -1);
    setModo(nuevo);
  };

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
      cerrarAlertas();
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
  // Mientras se envía con correo, el botón muestra su propio cargador; los
  // demás casos (Google, verificación, vinculación) ocupan la tarjeta entera.
  const tarjetaOcupada = cargando === 'google' || cargando === 'verificacion';
  const mensajeCarga =
    cargando === 'google' ? 'Conectando con Google…' : 'Verificando correo…';

  const titulo = vinculacion ? 'Vincula tu cuenta' : modo === 'login' ? 'Accede a tu cuenta' : 'Crea tu cuenta';
  const beneficio = vinculacion
    ? 'Confirma que eres tú para entrar también con Google.'
    : modo === 'login'
      ? 'Usa tu cuenta de Google o el correo con el que te registraste.'
      : 'En el siguiente paso eliges si tu cuenta es de persona o de negocio.';

  const campoClase = `${inputBase} pr-11`;

  const sellos = [
    { icon: <IconoCheck ok />, texto: 'Vendedores verificados' },
    { icon: <IconoEtiqueta />, texto: 'Entregas coordinadas' },
    { icon: <IconoEscudo />, texto: 'Tus datos protegidos' },
  ];

  const separador = (
    <Paso className="my-4 flex items-center gap-3 text-[12px] text-muted bajo:my-2.5">
      <span className="h-px flex-1 bg-border" />
      o continúa con tu correo
      <span className="h-px flex-1 bg-border" />
    </Paso>
  );

  return (
    <div className="min-h-svh bg-background lg:grid lg:h-svh lg:grid-cols-[1.02fr_0.98fr] lg:overflow-hidden">
      {/* ---------- Escenario de marca: el mismo amarillo de la landing ---------- */}
      <section className="relative isolate hidden overflow-hidden bg-brand px-12 py-10 text-foreground lg:flex lg:flex-col lg:justify-between xl:px-16 bajo:py-7">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(rgba(140,90,0,0.55) 1px, transparent 1.4px)',
            backgroundSize: '18px 18px',
          }}
        />
        {/* Motivos ecuatorianos en aguafuerte, como marcas de agua. */}
        <SolChimborazo className="pointer-events-none absolute -top-16 -right-20 -z-10 h-[460px] w-[460px] rotate-[8deg] text-white/45" />
        <CondorAndino className="pointer-events-none absolute top-[36%] -left-20 -z-10 h-[400px] w-[400px] -rotate-[8deg] text-foreground/[0.07]" />
        <RosaEcuador className="pointer-events-none absolute top-[24%] right-12 -z-10 h-[130px] w-[130px] rotate-12 text-empleo/25" />
        <SombreroToquilla className="pointer-events-none absolute top-[92px] left-[44%] -z-10 h-[110px] w-[110px] text-foreground/[0.08]" />
        <TortugaGalapagos className="pointer-events-none absolute right-[18%] bottom-[18%] -z-10 h-[110px] w-[110px] text-accent/25" />
        <CacaoEcuador className="pointer-events-none absolute bottom-[8%] left-[44%] -z-10 h-[85px] w-[85px] text-foreground/[0.08]" />

        <m.a
          href="/"
          aria-label="Baknazo, ir al inicio"
          className="flex w-fit items-center gap-2.5"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SALIDA }}
        >
          <span className="rounded-full bg-white/70 p-0.5">
            <Emblema tamano={40} />
          </span>
          <span className="titular text-[24px]">Baknazo</span>
        </m.a>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: SALIDA, delay: 0.1 }}
        >
          <p className="text-[12px] font-semibold tracking-[0.16em] text-foreground/70 uppercase">
            Tu marketplace de confianza
          </p>
          <EsloganTyper
            esloganes={ESLOGANES}
            colorCursor="bg-foreground"
            className="titular mt-5 min-h-[2em] max-w-[13ch] text-[clamp(48px,min(5.6vw,10.5vh),96px)]"
          />
        </m.div>

        <m.ul
          className="grid gap-x-6 gap-y-2 border-t-2 border-foreground pt-5 sm:grid-cols-3"
          initial="oculto"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } } }}
        >
          {sellos.map(({ icon, texto }) => (
            <m.li key={texto} variants={HIJO} className="flex items-center gap-2.5 text-[14px] font-semibold">
              <span className="text-foreground [&>svg]:size-5">{icon}</span>
              {texto}
            </m.li>
          ))}
        </m.ul>
      </section>

      {/* ---------- Formulario ---------- */}
      <main className="flex min-h-svh flex-col px-4 pt-10 pb-10 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-12 lg:py-8 xl:px-16 bajo:py-3">
        {/* my-auto centra sin cortar: si algún día no cabe, empieza arriba y se
            desplaza, en vez de esconder el título como hace justify-center. */}
        <div className="mx-auto w-full max-w-[480px] lg:my-auto">
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Tu marketplace de confianza</p>
              <EsloganTyper
                esloganes={ESLOGANES}
                className="titular mt-3 min-h-[2em] text-[clamp(28px,8.5vw,40px)] text-foreground"
              />
            </div>
            {/* El logo lleva al inicio, como en cualquier sitio. */}
            <a href="/" aria-label="Baknazo, ir al inicio" className="shrink-0 rounded-full transition-transform active:scale-95">
              <Emblema tamano={56} />
            </a>
          </div>

          {/* El título cambia con el formulario, con un fundido corto. */}
          <div className="relative mt-8 lg:mt-0">
            {/* popLayout: el título nuevo entra mientras el viejo sale, sin que
                la tarjeta de abajo dé un salto. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <m.div
                key={titulo}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: SALIDA }}
              >
                <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground bajo:text-[23px]">{titulo}</h1>
                <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-muted bajo:mt-1 muybajo:hidden">{beneficio}</p>
              </m.div>
            </AnimatePresence>
          </div>

          <m.div
            className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.35)] sm:p-6 bajo:mt-3 bajo:p-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: SALIDA, delay: 0.05 }}
          >
            {!vinculacion && (
              <div role="tablist" aria-label="Modo de acceso" className="relative grid grid-cols-2 rounded-xl bg-background p-1">
                {(['login', 'registro'] as Modo[]).map((opcion) => {
                  const activo = modo === opcion;
                  return (
                    <button
                      key={opcion}
                      type="button"
                      role="tab"
                      id={opcion === 'login' ? 'tab-entrar' : 'tab-crear'}
                      aria-selected={activo}
                      aria-controls="auth-formulario"
                      onClick={() => cambiarModo(opcion)}
                      disabled={ocupado}
                      className={`relative rounded-lg py-3 text-center text-[14px] transition-colors duration-150 bajo:py-2 ${
                        activo ? 'font-semibold text-foreground' : 'font-medium text-muted hover:text-foreground'
                      }`}
                    >
                      {/* La pastilla amarilla viaja de una pestaña a la otra. */}
                      {activo && (
                        <m.span
                          layoutId="pastilla-acceso"
                          transition={RESORTE}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-lg bg-brand shadow-[0_1px_3px_rgba(31,41,55,0.18),0_2px_6px_-2px_rgba(31,41,55,0.12)]"
                        />
                      )}
                      <span className="relative">{opcion === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <AlturaAnimada className={vinculacion ? '' : 'mt-3'}>
              <AnimatePresence mode="popLayout" initial={false} custom={direccion}>
                {tarjetaOcupada ? (
                  <m.div
                    key="cargando"
                    className="grid place-items-center py-16"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BaknazoLoader mensaje={mensajeCarga} />
                  </m.div>
                ) : vinculacion ? (
                  <m.div
                    key={`vincular-${vinculacion.correo}`}
                    id="auth-vincular"
                    custom={direccion}
                    variants={PANEL}
                    initial="oculto"
                    animate="visible"
                    exit="salida"
                  >
                    <Paso>
                      <span className="inline-block rounded-md bg-background px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
                        Vinculación con Google
                      </span>
                      <p className="mt-3 text-[14px] leading-relaxed text-muted">
                        {vinculacion.mensaje} Te enviamos un código de verificación a{' '}
                        <strong className="font-medium text-foreground">{vinculacion.correo || 'tu correo'}</strong>.
                      </p>
                    </Paso>

                    {errorVinculacion && (
                      <div className={`${alertaError} mt-4`} role="alert">
                        <IconoAlerta />
                        <span>{errorVinculacion}</span>
                      </div>
                    )}

                    <form onSubmit={manejarVinculacionSubmit} noValidate className="mt-5 space-y-4">
                      <Paso>
                        <label className="block">
                          <span className={etiqueta}>Código de verificación</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="000000"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={cargando === 'vinculacion'}
                            className={`${inputBase} text-center text-[18px] font-semibold tracking-[0.4em]`}
                          />
                        </label>
                      </Paso>
                      <Paso>
                        <button type="submit" disabled={cargando === 'vinculacion'} className={botonPrimario}>
                          {cargando === 'vinculacion' ? <BaknazoLoader tamano="boton" mensaje="Verificando" /> : 'Verificar y continuar'}
                        </button>
                      </Paso>
                    </form>

                    <Paso>
                      <p className="mt-4 text-[12px] leading-relaxed text-muted">
                        El código dura unos minutos y sirve una sola vez. Si no llega o ya no es válido, vuelve a entrar con
                        Google para recibir uno nuevo.
                      </p>
                      <p className="mt-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDireccion(-1);
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
                    </Paso>
                  </m.div>
                ) : modo === 'login' ? (
                  <m.div
                    key="login"
                    id="auth-formulario"
                    role="tabpanel"
                    aria-labelledby="tab-entrar"
                    custom={direccion}
                    variants={PANEL}
                    initial="oculto"
                    animate="visible"
                    exit="salida"
                  >
                    {errorLogin && (
                      <div className={alertaError} role="alert">
                        <IconoAlerta />
                        <span>{errorLogin}</span>
                      </div>
                    )}

                    <Paso>
                      <BotonGoogle
                        clientId={googleClientId}
                        tipo="continuar"
                        cargando={false}
                        deshabilitado={ocupado}
                        onCredencial={manejarGoogleSuccess}
                        onError={notificarError}
                      />
                    </Paso>

                    {separador}

                    <form onSubmit={manejarManualSubmit} noValidate className="space-y-4 bajo:space-y-3">
                      <Paso>
                        <label className="block">
                          <span className={etiqueta}>Correo</span>
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
                      </Paso>

                      <Paso>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 bajo:mb-1">
                          <span id="etiqueta-clave" className="text-[13px] font-medium text-muted">
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
                            aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
                          >
                            <IconoOjo abierto={verClave} />
                          </button>
                        </div>
                      </Paso>

                      <Paso>
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
                      </Paso>

                      <Paso>
                        <button type="submit" disabled={ocupado} className={botonPrimario}>
                          {cargando === 'manual' ? <BaknazoLoader tamano="boton" mensaje="Entrando" /> : 'Iniciar sesión'}
                        </button>
                      </Paso>
                    </form>
                  </m.div>
                ) : (
                  <m.div
                    key="registro"
                    id="auth-formulario"
                    role="tabpanel"
                    aria-labelledby="tab-crear"
                    custom={direccion}
                    variants={PANEL}
                    initial="oculto"
                    animate="visible"
                    exit="salida"
                  >
                    {errorRegistro && (
                      <div className={alertaError} role="alert">
                        <IconoAlerta />
                        <span>{errorRegistro}</span>
                      </div>
                    )}

                    <Paso>
                      <BotonGoogle
                        clientId={googleClientId}
                        tipo="registrarse"
                        cargando={false}
                        deshabilitado={ocupado}
                        onCredencial={(idToken) => {
                          setErrorRegistro(null);
                          manejarGoogleSuccess(idToken);
                        }}
                        onError={notificarError}
                      />
                    </Paso>

                    {separador}

                    <form onSubmit={manejarRegistroSubmit} noValidate className="space-y-4 bajo:space-y-3">
                      <Paso className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className={etiqueta}>Nombres</span>
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
                          <span className={etiqueta}>Apellidos</span>
                          <input
                            type="text"
                            autoComplete="family-name"
                            placeholder="Pérez"
                            value={apellidos}
                            onChange={(e) => setApellidos(e.target.value)}
                            className={inputBase}
                          />
                        </label>
                      </Paso>

                      <Paso>
                        <label className="block">
                          <span className={etiqueta}>Correo</span>
                          <input
                            type="email"
                            autoComplete="email"
                            placeholder="usuario@correo.com"
                            value={correoReg}
                            onChange={(e) => setCorreoReg(e.target.value)}
                            className={inputBase}
                          />
                        </label>
                      </Paso>

                      <Paso className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className={etiqueta}>Contraseña</span>
                          <div className="relative">
                            <input
                              type={verClaveReg ? 'text' : 'password'}
                              autoComplete="new-password"
                              placeholder="ClaveSegura1!"
                              aria-label="Contraseña"
                              value={contrasenaReg}
                              onChange={(e) => setContrasenaReg(e.target.value)}
                              className={campoClase}
                            />
                            <button
                              type="button"
                              onClick={() => setVerClaveReg((v) => !v)}
                              aria-label={verClaveReg ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
                            >
                              <IconoOjo abierto={verClaveReg} />
                            </button>
                          </div>
                        </div>
                        <label className="block">
                          <span className={etiqueta}>Repetir contraseña</span>
                          <input
                            type={verClaveReg ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmar}
                            onChange={(e) => setConfirmar(e.target.value)}
                            className={inputBase}
                          />
                        </label>
                      </Paso>

                      <Paso>
                        <ul className="grid gap-x-3 gap-y-1 sm:grid-cols-2 bajo:gap-y-0.5 bajo:text-[11.5px]">
                          {reglas.map((regla) => (
                            <li
                              key={regla.id}
                              className={`flex items-center gap-2 text-[12px] transition-colors bajo:text-[11.5px] ${
                                regla.cumple ? 'text-success-deep' : tocado ? 'text-danger-deep' : 'text-muted'
                              }`}
                            >
                              <IconoCheck ok={regla.cumple} />
                              {regla.texto}
                            </li>
                          ))}
                        </ul>
                      </Paso>

                      <Paso>
                        <button type="submit" className={botonPrimario}>
                          Continuar
                        </button>
                      </Paso>
                    </form>
                  </m.div>
                )}
              </AnimatePresence>
            </AlturaAnimada>
          </m.div>

          {/* Para quien vino a mirar y no a entrar: una fila al final, sin
              competir con el formulario. */}
          <a href="/" className="group mt-6 flex items-center justify-between gap-4 border-t border-border pt-4 bajo:mt-3 bajo:pt-3">
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-foreground">¿Solo vienes a mirar?</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted bajo:hidden">Mira lo que se vende cerca de ti, sin crear cuenta.</span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold whitespace-nowrap text-foreground underline decoration-brand decoration-[3px] underline-offset-[6px] transition-[text-decoration-color] group-hover:decoration-foreground">
              Ver anuncios
            </span>
          </a>
        </div>
      </main>
    </div>
  );
}
