import { useEffect, useState, type ReactNode } from 'react';
import { googleLogout } from '@react-oauth/google';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { obtenerMiPerfil } from './api/auth';
import {
  actualizarUsuario,
  alCambiarSesion,
  entrar,
  refrescar,
  renovarTokens,
  restaurarSesion,
  salir,
} from './api/token';
import { caducaEnMs } from './lib/jwt';
import AuthScreen from './screens/auth/AuthScreen';
import TipoCuentaScreen from './screens/auth/TipoCuentaScreen';
import FeedScreen from './screens/feed/FeedScreen';
import MisAnunciosScreen from './screens/mis-anuncios/MisAnunciosScreen';
import ConfiguracionScreen from './screens/config/ConfiguracionScreen';
import PublicarScreen from './screens/publicar/PublicarScreen';
import EditarAnuncioScreen from './screens/editar/EditarAnuncioScreen';
import PerfilScreen from './screens/perfil/PerfilScreen';
import ExplorarScreen from './screens/explorar/ExplorarScreen';
import NoEncontradoScreen from './screens/NoEncontradoScreen';
import GuardadosScreen from './screens/guardados/GuardadosScreen';
import PostulacionesScreen from './screens/postulaciones/PostulacionesScreen';
import VerificarCorreoScreen from './screens/auth/VerificarCorreoScreen';
import RecuperarContrasenaScreen from './screens/auth/RecuperarContrasenaScreen';
import Alertas from './components/Alertas';
import BaknazoLoader from './components/BaknazoLoader';
import { limpiarBorrador } from './lib/borrador';
import { NavegacionContexto, type Navegacion } from './lib/navegacion';
import { notificarInfo } from './lib/notificar';
import { olvidarPropios } from './lib/propios';
import { olvidarPerfilesEnCache } from './lib/cachePerfil';
import type {
  DatosRegistroManual,
  PerfilUsuario,
  RegistroPendiente,
  RespuestaCambioContrasena,
  Sesion,
} from './types/auth';
import type { SemillaPerfil } from './types/perfil';

/**
 * Las rutas de la app, en un solo sitio.
 *
 * Antes esto era un `useState` con un tipo `Vista` discriminado y un `return`
 * gigante que elegía pantalla. Con la URL como estado, la navegación pasa a ser
 * declarativa y cada pantalla es su propia ruta: una URL es una pantalla, se
 * puede compartir, y el botón de atrás funciona sin código extra.
 */
const RUTAS = {
  login: '/',
  registro: '/tipo-cuenta',
  verificarCorreo: '/verificar-correo',
  recuperarClave: '/recuperar-clave',
  feed: '/anuncios',
  anuncio: '/anuncio/:id',
  misAnuncios: '/mis-anuncios',
  publicar: '/publicar',
  editarAnuncio: '/mis-anuncios/:id/editar',
  configuracion: '/configuracion',
  /** El perfil de quien publica, sea persona o negocio. */
  perfil: '/perfil/:id',
  /** Todas las categorías y ciudades, con cuántos anuncios tienen. */
  explorar: '/explorar',
  /** Bandeja de postulaciones (recibidas y enviadas). */
  postulaciones: '/postulaciones',
  /** Los anuncios que la persona se guardó para después. */
  guardados: '/guardados',
} as const;

/** Por qué no se pudo cargar el perfil, para no culpar siempre a la red. */
type FalloPerfil = 'sin-conexion' | 'error' | null;

/**
 * El perfil se guarda etiquetado con el usuario al que pertenece.
 *
 * Clasificarlo por sesión no serviría: el access token cambia cada 15 minutos
 * al refrescar, y el perfil volvería a "no estar cargado" cadaquarter de hora,
 * con un parpadeo de "Cargando tu perfil…" en plena sesión activa. Con el id de
 * usuario, el perfil solo se descarta cuando cambia la cuenta, que es lo único
 * que lo vuelve obsoleto.
 */
type PerfilDe = { usuarioId: string; usuario: PerfilUsuario };
type FalloDe = { usuarioId: string; motivo: FalloPerfil };

/** Lo que la pantalla de verificar necesita, y que no cabe en la URL. */
type EstadoVerificacion = {
  correo: string;
  origen: 'registro' | 'login';
  persistente: boolean;
  mensaje?: string;
};

/**
 * Las pantallas de auth leen del `state` de la navegación.
 *
 * Si no hay datos (alguien escribió la URL a mano, o recargó) no se intenta
 * inventar nada: se vuelve al login. Un formulario de verificación sin correo
 * sería una pantalla muerta.
 */
function VerificarCorreoRuta({ onVerificado }: { onVerificado: (s: Sesion) => void }) {
  const estado = useLocation().state as EstadoVerificacion | null;
  const navegar = useNavigate();
  if (!estado?.correo) return <Navigate to={RUTAS.login} replace />;
  return (
    <VerificarCorreoScreen
      correo={estado.correo}
      origen={estado.origen}
      mensaje={estado.mensaje}
      persistente={estado.persistente}
      onVerificado={onVerificado}
      onVolver={() => navegar(RUTAS.login)}
    />
  );
}

function TipoCuentaScreenRuta({
  onListo,
  onVerificacionNecesaria,
}: {
  onListo: (s: Sesion) => void;
  onVerificacionNecesaria: (correo: string, mensaje: string) => void;
}) {
  const estado = useLocation().state as RegistroPendiente | null;
  const navegar = useNavigate();
  if (!estado) return <Navigate to={RUTAS.login} replace />;
  return (
    <TipoCuentaScreen
      pendiente={estado}
      onListo={onListo}
      onCancelar={() => navegar(RUTAS.login)}
      onVerificacionNecesaria={onVerificacionNecesaria}
    />
  );
}

/**
 * El feed, montado dentro de sus rutas.
 *
 * Existe como componente aparte, y no como un elemento creado en `Pantallas`,
 * por un motivo concreto: `useParams` solo lee el `:id` si quien lo llama está
 * dentro de un `<Route>`. Arriba no hay contexto de coincidencia de ruta, así
 * que siempre devolvería `undefined` y la ficha no se abriría nunca. Es un
 * detalle fácil de no ver y produce un fallo silencioso: todo compila, la app
 * carga, y el clic no hace nada.
 */
function FeedEnRuta(props: {
  sesion: Sesion;
  perfil: PerfilUsuario | null;
  onAbrirPerfil: (semilla: SemillaPerfil) => void;
}) {
  const { id } = useParams();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  return (
    <FeedScreen
      {...props}
      // En `/anuncios` no hay `:id`, así que no hay ficha abierta. En
      // `/anuncio/123` sí, y el feed pinta esa ficha encima del listado.
      anuncioInicial={id == null ? null : Number(id)}
      onCambiarAnuncioAbierto={(abierto) => {
        // Los filtros van en la búsqueda de la URL: se conservan al abrir y
        // cerrar la ficha, o cerrarla dejaría el feed sin filtrar.
        if (abierto != null) {
          navegar(
            { pathname: `/anuncio/${abierto}`, search: ubicacion.search },
            { state: { desdeFeed: true } }
          );
          return;
        }
        // Si la ficha se abrió desde el listado, cerrar es volver atrás: así el
        // botón de atrás del teléfono no la vuelve a abrir. Si se entró por un
        // enlace, no hay a dónde volver y se reemplaza por el listado.
        const estado = ubicacion.state as { desdeFeed?: boolean } | null;
        if (estado?.desdeFeed) navegar(-1);
        else navegar({ pathname: RUTAS.feed, search: ubicacion.search }, { replace: true });
      }}
    />
  );
}


export default function App() {
  return (
    <>
      <Alertas />
      <Pantallas />
    </>
  );
}

/**
 * Renueva el token antes de que caduque, mientras la pestaña esté abierta.
 *
 * Sin esto, una sesión de más de 15 minutos solo se entera al hacer la
 * siguiente petición; aquí se renueva sola y el usuario no nota nada. El
 * temporizador se rearma con el token nuevo, así que no hace falta un intervalo
 * que se pise a sí mismo.
 *
 * Si no hay red el refresco falla y se reintenta más adelante, sin cerrar la
 * sesión: un corte de wifi no es motivo para echar a nadie.
 */
function useRenovacionSesion(sesion: Sesion | null): void {
  useEffect(() => {
    if (!sesion) return;

    const espirar = caducaEnMs(sesion.access_token);
    if (espirar === null) return;

    // Un minuto antes de caducar, y nunca menos de 30 s entre reintentos.
    const espera = Math.max(espirar - Date.now() - 60_000, 30_000);
    const id = setTimeout(() => {
      refrescar().catch(() => {
        setTimeout(() => {
          refrescar().catch(() => undefined);
        }, 60_000);
      });
    }, espera);

    return () => clearTimeout(id);
  }, [sesion]);
}

/**
 * Editar un anuncio, con su id leído de la ruta.
 *
 * Mismo motivo que en el feed: el `:id` hay que leerlo desde dentro del
 * `<Route>`. Leyéndolo arriba daba `NaN`, y una pantalla de editar con `id=NaN`
 * pide un anuncio que no existe y falla en silencio.
 */
function EditarAnuncioRuta({
  perfil,
  onPerfilActualizado,
}: {
  perfil: PerfilUsuario | null;
  onPerfilActualizado: (usuario: PerfilUsuario) => void;
}) {
  const { id } = useParams();
  const navegar = useNavigate();
  const num = Number(id);

  // Un id no numérico es una URL mal escrita, no un anuncio: al listado, que es
  // donde se puede seguir trabajando, en vez de una pantalla que no va a cargar.
  if (!Number.isFinite(num)) return <Navigate to={RUTAS.misAnuncios} replace />;

  return (
    <EditarAnuncioScreen
      id={num}
      perfil={perfil}
      onPerfilActualizado={onPerfilActualizado}
      onVolver={() => navegar(RUTAS.misAnuncios)}
    />
  );
}

/**
 * El perfil público de quien publica.
 *
 * **No exige sesión**: ver el perfil de alguien es como ver su anuncio, y pedir
 * login para eso solo añade un muro donde no hay nada que proteger. Lo único
 * que se protege es el número, y eso se pide desde el anuncio, no desde aquí.
 */
function PerfilRuta({
  usuarioActualId,
  sesion,
  onPerfilActualizado,
}: {
  usuarioActualId: string | null;
  sesion: Sesion | null;
  onPerfilActualizado: (usuario: PerfilUsuario) => void;
}) {
  const { id } = useParams();

  if (!id) return <Navigate to={RUTAS.feed} replace />;

  return (
    <PerfilScreen
      // La `key` reinicia la pantalla al pasar de un perfil a otro: sin ella,
      // la pestaña, la ficha abierta y la lista del anterior se colaban un
      // instante en el siguiente.
      key={id}
      id={id}
      // Se compara con el id de la sesión y no con el de GET /me: la sesión ya
      // está al entrar, y GET /me puede tardar o fallar. Con el perfil, "Tu
      // perfil" y el botón de portada aparecían tarde o no aparecían.
      esPropio={usuarioActualId === id}
      sesion={sesion}
      onPerfilActualizado={onPerfilActualizado}
    />
  );
}

function Pantallas() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const navegar = useNavigate();
  const location = useLocation();
  /** Mientras se pregunta al backend (con la cookie) si hay sesión abierta. */
  const [restaurando, setRestaurando] = useState(true);
  /** Perfil ampliado de GET /me: lo comparten el feed y la configuración. */
  const [perfilDe, setPerfilDe] = useState<PerfilDe | null>(null);
  const [falloDe, setFalloDe] = useState<FalloDe | null>(null);

  useRenovacionSesion(sesion);

  const usuarioId = sesion?.usuario.id ?? null;
  const perfil = perfilDe?.usuarioId === usuarioId ? perfilDe.usuario : null;
  const falloPerfil = falloDe?.usuarioId === usuarioId ? falloDe.motivo : null;
  const cargandoPerfil = usuarioId !== null && !perfil && falloPerfil === null;

  /**
   * El motor es la fuente de verdad de la sesión: si un 401 obliga a refrescar
   * o el refresh token resulta inválido, esto refleja el cambio en pantalla.
   */
  useEffect(() => {
    return alCambiarSesion((siguiente) => {
      setSesion(siguiente);
      if (!siguiente) {
        // El motor cerró la sesión porque el refresh token ya no sirve.
        limpiarBorrador();
        setPerfilDe(null);
        setFalloDe(null);
        navegar(RUTAS.login, { replace: true });
        googleLogout();
      }
    });
  }, [navegar]);

  /**
   * Nada de la sesión se guarda en el navegador: al abrir la app se canjea la
   * cookie HttpOnly del refresh token y el backend devuelve el usuario.
   *
   * Ya no hace falta recordar la última pantalla con sessionStorage: la URL
   * cumple esa función sola, porque un F5 en configuración deja la URL en
   * configuración y el router vuelve a pintarla. Eso quita un archivo entero
   * (lib/vista) y elimina la posibilidad de que la URL y lo pintado digan cosas
   * distintas.
   */
  useEffect(() => {
    let activo = true;
    restaurarSesion()
      .then((restaurada) => {
        if (!activo || !restaurada) return;
        setSesion(restaurada);
      })
      .catch(() => undefined)
      .finally(() => {
        if (activo) setRestaurando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (usuarioId === null) return;

    let activo = true;

    obtenerMiPerfil()
      .then((respuesta) => {
        if (!activo) return;
        setPerfilDe({ usuarioId, usuario: respuesta.usuario });
        setFalloDe(null);
      })
      .catch((e: unknown) => {
        if (!activo) return;
        // Un 401 con refresh inválido ya cerró la sesión en el motor y su
        // suscriptor manda al login: aquí solo se registra el fallo visible.
        const estado = (e as { status?: number }).status;
        setPerfilDe(null);
        setFalloDe({
          usuarioId,
          motivo: estado ? 'error' : 'sin-conexion',
        });
      });

    return () => {
      activo = false;
    };
  }, [usuarioId]);

  /**
   * "Mantener sesión iniciada" ya viajó al backend con el login y quedó en la
   * cookie, así que aquí no hace falta.
   */
  const abrirSesion = (nueva: Sesion) => {
    limpiarBorrador();
    // El motor avisa: `sesion` se actualiza solo.
    entrar(nueva);
    setPerfilDe(null);
    setFalloDe(null);
    // Si se llegó al login desde un enlace (un perfil, un anuncio), se vuelve a
    // él y no al feed: el enlace compartido era lo que se quería ver.
    const desde = (location.state as { desde?: string } | null)?.desde;
    navegar(desde && desde !== RUTAS.login ? desde : RUTAS.feed);
  };

  /** Refleja en la sesión (y en el almacenamiento) lo que devolvió el PATCH. */
  const perfilActualizado = (usuario: PerfilUsuario) => {
    setPerfilDe({ usuarioId: usuario.id, usuario });
    // El motor escribe en memoria y en el almacenamiento, para que un refresco
    // posterior no revierta estos datos con la copia anterior.
    actualizarUsuario({
      id: usuario.id,
      correo: usuario.correo,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      tipo_cuenta: usuario.tipo_cuenta,
      foto_perfil: usuario.foto_perfil,
    });
  };

  /**
   * El cambio de contraseña renueva los tokens de este dispositivo. El refresh
   * token nuevo ya lo dejó el backend en la cookie; aquí solo llega el access.
   */
  const sesionRenovada = (tokens: RespuestaCambioContrasena) => {
    if (!sesion) return;
    const siguiente: Sesion = {
      ...sesion,
      access_token: tokens.access_token,
      expira_en: tokens.expira_en,
    };
    setSesion(siguiente);
    // El motor es quien los guarda, para que un refresco posterior no los
    // revierta por seguir con los tokens viejos en memoria.
    renovarTokens(tokens);
  };

  /**
   * Los datos del registro y de la verificación viajan en el `state` de la
   * navegación, no en un estado global.
   *
   * Antes vivían en el tipo `Vista`, dentro del mismo useState que elegía
   * pantalla. Ahora la URL solo lleva el.path y lo que no cabe en él (el correo a
   * verificar, los datos del formulario) va en el historial: si alguien recarga
   * en esa pantalla no hay datos, y se vuelve al login en vez de romper trying de
   * pintar un formulario con `undefined`.
   */
  const pedirTipoCuenta = (pendiente: RegistroPendiente) =>
    navegar(RUTAS.registro, { state: pendiente });

  const manejarDatosManuales = (datos: DatosRegistroManual) =>
    pedirTipoCuenta({ proveedor: 'manual', ...datos });

  /** Llegó del login: el correo no está verificado. */
  const verificarDesdeLogin = (correo: string, persistente: boolean) =>
    navegar(RUTAS.verificarCorreo, {
      state: { correo, origen: 'login', persistente } satisfies EstadoVerificacion,
    });

  /** Llegó del registro manual: cuenta creada, falta confirmar el correo. */
  const verificarDesdeRegistro = (correo: string, mensaje: string) =>
    navegar(RUTAS.verificarCorreo, {
      state: { correo, origen: 'registro', persistente: true, mensaje } satisfies EstadoVerificacion,
    });

  const abrirRecuperacion = () => navegar(RUTAS.recuperarClave);

  const cerrarSesion = () => {
    limpiarBorrador();
    // Los ids anotados eran de la cuenta que sale: si no se olvidan, la siguiente
    // persona en usar el dispositivo vería sus anuncios sin botón de chat.
    olvidarPropios();
    olvidarPerfilesEnCache();
    // El motor borra el almacenamiento y avisa: esto cierra la sesión en la UI.
    salir();
    notificarInfo('Cerraste sesión.');
  };

  if (restaurando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <BaknazoLoader mensaje="Abriendo Baknazo" />
      </div>
    );
  }

  /**
   * Las pantallas privadas exigen sesión. Sin ella se devuelve al login
   * guardando la ruta en el `state`, para que al entrar caiga donde quería ir y
   * no de vuelta al feed: el enlace a un anuncio se pierde de otro modo.
   */
  const exigeSesion = (pantalla: ReactNode) =>
    sesion ? pantalla : <Navigate to={RUTAS.login} replace state={{ desde: location.pathname }} />;

  /**
   * Los destinos del menú, compartidos por todas las pantallas vía contexto.
   *
   * "Mi perfil" usa el id de la sesión y no el de GET /me. Antes usaba
   * `perfil?.id`, que mientras /me cargaba (o si fallaba) era `undefined`, y el
   * botón llevaba a `/perfil/undefined`: por eso fallaba en unas pantallas sí y
   * en otras no, según cuánto hubiera tardado la respuesta.
   */
  const navegacion: Navegacion = {
    sesion,
    perfil,
    irAlFeed: () => navegar(RUTAS.feed),
    irAMisAnuncios: () => navegar(RUTAS.misAnuncios),
    irAPublicar: () => navegar(RUTAS.publicar),
    irAConfiguracion: () => navegar(RUTAS.configuracion),
    irAExplorar: () => navegar(RUTAS.explorar),
    irAPostulaciones: () => navegar(RUTAS.postulaciones),
    irAGuardados: () => navegar(RUTAS.guardados),
    irAMiPerfil: () => {
      if (usuarioId) navegar(`/perfil/${usuarioId}`);
      else navegar(RUTAS.login);
    },
    irAlLogin: () => navegar(RUTAS.login, { state: { desde: location.pathname } }),
    cerrarSesion,
  };

  /**
   * El feed se declara UNA vez con todas sus props y se reutiliza en las dos
   * rutas. Estaba duplicado en cada `<Route>` y el de `/anuncios` se quedó sin
   * `onCambiarAnuncioAbierto`: al pulsar un anuncio no tenía a quién llamar y no
   * pasaba nada. Un objeto compartido no puede quedar con props de menos.
   */
  const feed = exigeSesion(
    <FeedEnRuta
      sesion={sesion as Sesion}
      perfil={perfil}
      onAbrirPerfil={(semilla) => navegar(`/perfil/${semilla.clavePerfil}`)}
    />
  );

  return (
    <NavegacionContexto.Provider value={navegacion}>
    <Routes>
      {/* Un anuncio suelto: /anuncio/123. Es la ruta compartible, y pinta el
          feed detrás para que cerrar la ficha devuelva al listado. */}
      <Route path={RUTAS.anuncio} element={feed} />

      <Route path={RUTAS.feed} element={feed} />

      <Route
        path={RUTAS.misAnuncios}
        element={
          exigeSesion(
            <MisAnunciosScreen onEditar={(id) => navegar(`/mis-anuncios/${id}/editar`)} />
          )
        }
      />

      <Route
        path={RUTAS.editarAnuncio}
        element={exigeSesion(<EditarAnuncioRuta perfil={perfil} onPerfilActualizado={perfilActualizado} />)}
      />

      <Route
        path={RUTAS.publicar}
        element={
          exigeSesion(
            <PublicarScreen
              perfil={perfil}
              onPerfilActualizado={perfilActualizado}
              onVolver={() => navegar(RUTAS.feed)}
            />
          )
        }
      />

      <Route
        path={RUTAS.perfil}
        element={
          <PerfilRuta
            usuarioActualId={usuarioId}
            sesion={sesion}
            onPerfilActualizado={perfilActualizado}
          />
        }
      />

      <Route path={RUTAS.explorar} element={exigeSesion(<ExplorarScreen />)} />

      <Route path={RUTAS.guardados} element={exigeSesion(<GuardadosScreen />)} />

      <Route path={RUTAS.postulaciones} element={exigeSesion(<PostulacionesScreen />)} />

      <Route
        path={RUTAS.configuracion}
        element={
          exigeSesion(
            <ConfiguracionScreen
              sesion={sesion as Sesion}
              perfil={perfil}
              cargandoPerfil={cargandoPerfil}
              falloPerfil={falloPerfil}
              onPerfilActualizado={perfilActualizado}
              onSesionRenovada={sesionRenovada}
            />
          )
        }
      />

      {/* El flujo de auth. Si alguien entra sin sesión a una de estas, la
          guardea de sesión lo devuelve al login, que es donde se entra. */}
      <Route
        path={RUTAS.registro}
        element={
          <TipoCuentaScreenRuta
            onListo={abrirSesion}
            onVerificacionNecesaria={verificarDesdeRegistro}
          />
        }
      />

      <Route path={RUTAS.verificarCorreo} element={<VerificarCorreoRuta onVerificado={abrirSesion} />} />

      <Route
        path={RUTAS.recuperarClave}
        element={<RecuperarContrasenaScreen onVolver={() => navegar(RUTAS.login)} />}
      />

      <Route
        path={RUTAS.login}
        element={
          // Con la sesión abierta, el login no tiene nada que hacer: al feed.
          sesion && !(location.state as { desde?: string } | null)?.desde ? (
            <Navigate to={RUTAS.feed} replace />
          ) : (
            <AuthScreen
              onSesion={abrirSesion}
              onTokenSocial={pedirTipoCuenta}
              onDatosListos={manejarDatosManuales}
              onVerificacionNecesaria={verificarDesdeLogin}
              onRecuperarClave={abrirRecuperacion}
            />
          )
        }
      />
      <Route path="/login" element={<Navigate to={RUTAS.login} replace />} />

      {/* Cualquier otra dirección: 404 de verdad, no el login. */}
      <Route path="*" element={<NoEncontradoScreen />} />
    </Routes>
    </NavegacionContexto.Provider>
  );
}
