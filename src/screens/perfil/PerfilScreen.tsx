import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import NoEncontrado from '../../components/NoEncontrado';
import EsqueletoAnuncio from '../../components/EsqueletoAnuncio';
import CargarMas from '../../components/CargarMas';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MarcoApp from '../../components/MarcoApp';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import RecortadorImagen from '../../components/RecortadorImagen';
import {
  IconoAjustes,
  IconoBocadillo,
  IconoCamara,
  IconoCerrar,
  IconoCheck,
  IconoCompartir,
  IconoEstrella,
  IconoEtiqueta,
  IconoLapiz,
  IconoMas,
  IconoNegocio,
  IconoOjo,
  IconoPapelera,
  IconoPersona,
  IconoPin,
  IconoPulgar,
  IconoReloj,
  IconoTelefono,
} from '../../components/Iconos';
import { useAbrirChat } from '../../lib/abrirChat';
import { notificarError, notificarExito, notificarInfo } from '../../lib/notificar';
import { actualizarPerfil } from '../../api/auth';
import { darLike, quitarLike } from '../../api/anuncios';
import { haceCuanto, inicialesDe, plural } from '../../lib/tarjeta';
import { ESTILO_PILAR } from '../../lib/pilares';
import { urlCompleta } from '../../lib/imagen';
import { useBloqueoScroll } from '../../lib/bloqueoScroll';
import { useNavegacion } from '../../lib/navegacion';
import { guardarPerfilEnCache, leerPerfilEnCache } from '../../lib/cachePerfil';
import {
  obtenerPerfil,
  obtenerAnunciosPerfil,
  seguirUsuario,
  dejarDeSeguirUsuario,
  obtenerSeguidores,
  obtenerSeguidos,
} from '../../api/perfil';
import type {
  AnuncioPerfil,
  PerfilNegocio,
  PerfilPublico,
  SemillaPerfil,
  Seguidor,
} from '../../types/perfil';
import {
  privacidadCompleta,
  type PerfilUsuario,
  type PrivacidadPerfil,
  type Sesion,
} from '../../types/auth';
import BaknazoLoader from '../../components/BaknazoLoader';

const TARJETA = 'rounded-2xl border border-border bg-white p-5 sm:p-6';
const LIMITE_ANUNCIOS = 20;

/** Tamaño máximo de la portada antes de recortarla, igual que en el backend. */
const MAX_PORTADA_BYTES = 8 * 1024 * 1024;
const AYUDA_PORTADA =
  'Se guarda en 1500 × 500 px (formato 3:1). Usa una imagen de al menos ese tamaño: JPG, PNG o WEBP de hasta 8 MB.';
const AYUDA_FOTO = 'Se guarda en 512 × 512 px. JPG, PNG o WEBP de hasta 8 MB; una foto cuadrada se ve mejor.';

type Relacion = 'SEGUIDORES' | 'SEGUIDOS';

interface Props {
  id: string;
  esPropio?: boolean;
  sesion?: Sesion | null;
  /** El perfil de GET /me se actualiza al cambiar la portada. */
  onPerfilActualizado?: (usuario: PerfilUsuario) => void;
}

export default function PerfilScreen({
  id,
  esPropio = false,
  sesion = null,
  onPerfilActualizado,
}: Props) {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { irAlLogin, irAPublicar } = useNavegacion();
  const { abrir: abrirChat, abriendo: abriendoChat } = useAbrirChat();
  const [parametros, setParametros] = useSearchParams();

  /**
   * Lo último que se vio de este perfil, si se vio en esta pestaña.
   *
   * Con eso la pantalla se pinta al instante al volver, y la petición de abajo
   * solo refresca los números por detrás. Antes, cada vuelta al perfil era un
   * esqueleto gris de nuevo.
   */
  const [enCache] = useState(() => leerPerfilEnCache(id));
  const [perfil, setPerfil] = useState<PerfilPublico | null>(enCache?.perfil ?? null);
  const [anuncios, setAnuncios] = useState<AnuncioPerfil[]>(enCache?.anuncios ?? []);
  const [hayMas, setHayMas] = useState(enCache?.hayMas ?? false);
  const [cargando, setCargando] = useState(!enCache);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [pestana, setPestana] = useState<'ACTIVOS' | 'VENDIDOS'>('ACTIVOS');
  const [cargandoSeguir, setCargandoSeguir] = useState(false);
  const [relacion, setRelacion] = useState<Relacion | null>(null);

  /* ---------- Vista como visitante ---------- */

  // `?vista=visitante` deja al dueño ver su perfil como lo ve cualquiera, con
  // lo que ocultó ya escondido. Es la forma de comprobar la privacidad sin
  // pedirle a otra persona que abra el enlace.
  const comoVisitante = esPropio && parametros.get('vista') === 'visitante';
  const propio = esPropio && !comoVisitante;

  const salirDeVistaVisitante = () => {
    const siguientes = new URLSearchParams(parametros);
    siguientes.delete('vista');
    setParametros(siguientes, { replace: true });
  };

  /* ---------- Carga ---------- */

  useEffect(() => {
    let activo = true;
    obtenerPerfil(id, LIMITE_ANUNCIOS, 0)
      .then((respuesta) => {
        if (!activo) return;
        setPerfil(respuesta.perfil);
        setAnuncios(respuesta.anuncios);
        setHayMas(respuesta.paginacion.hayMas);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!activo) return;
        // Con una copia en pantalla, un fallo de red no borra lo que ya se ve:
        // solo se avisa. Sin copia, se muestra el error con su botón.
        const mensaje = e instanceof Error ? e.message : 'No se pudo cargar el perfil';
        if (leerPerfilEnCache(id)) notificarInfo('No se pudo actualizar el perfil. Mostramos lo último que viste.');
        else setError(mensaje);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [id, intento]);

  /* La copia se mantiene al día con cada cambio: seguir, cargar más, portada. */
  useEffect(() => {
    if (perfil) guardarPerfilEnCache(id, { perfil, anuncios, hayMas });
  }, [id, perfil, anuncios, hayMas]);

  const reintentar = () => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  };

  const [errorMas, setErrorMas] = useState(false);
  const cargarMasAnuncios = useCallback(async () => {
    if (cargandoMas || !hayMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const respuesta = await obtenerAnunciosPerfil(id, LIMITE_ANUNCIOS, anuncios.length);
      setAnuncios((prev) => {
        // Un anuncio publicado entre página y página desplaza el offset y
        // repetiría el último: se descartan los que ya están.
        const vistos = new Set(prev.map((a) => a.id));
        return [...prev, ...respuesta.anuncios.filter((a) => !vistos.has(a.id))];
      });
      setHayMas(respuesta.paginacion.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  }, [id, anuncios.length, hayMas, cargandoMas]);

  /* ---------- Seguir ---------- */

  const alternarSeguir = async () => {
    if (!perfil || cargandoSeguir) return;
    if (!sesion) {
      irAlLogin();
      return;
    }
    const seguia = perfil.loSigues;
    // Se pinta al instante: esperar a la red en un botón de seguir se siente
    // como una app colgada. Si falla, se deshace.
    setPerfil({ ...perfil, loSigues: !seguia, seguidores: perfil.seguidores + (seguia ? -1 : 1) });
    setCargandoSeguir(true);
    try {
      const respuesta = seguia ? await dejarDeSeguirUsuario(id) : await seguirUsuario(id);
      setPerfil((prev) => (prev ? { ...prev, loSigues: !seguia, seguidores: respuesta.seguidores } : prev));
    } catch (e) {
      setPerfil((prev) => (prev ? { ...prev, loSigues: seguia, seguidores: perfil.seguidores } : prev));
      notificarError(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setCargandoSeguir(false);
    }
  };

  /* ---------- Ficha del anuncio, sin salir del perfil ---------- */

  /**
   * El anuncio abierto va en la URL (`?anuncio=123`) y la ficha se pinta aquí,
   * encima del perfil.
   *
   * Antes abrir un anuncio llevaba a /anuncio/123, que es la pantalla del feed:
   * el perfil se desmontaba y al cerrar la ficha se montaba otra vez desde cero,
   * con su esqueleto y su petición. Ahora el perfil no se va a ninguna parte, y
   * el enlace sigue siendo compartible y el botón de atrás la cierra.
   */
  const anuncioAbierto = Number(parametros.get('anuncio')) || null;

  const abrirAnuncio = (anuncioId: number) => {
    const siguientes = new URLSearchParams(parametros);
    siguientes.set('anuncio', String(anuncioId));
    setParametros(siguientes, { state: { fichaDesdePerfil: true } });
  };

  const cerrarAnuncio = () => {
    if ((ubicacion.state as { fichaDesdePerfil?: boolean } | null)?.fichaDesdePerfil) {
      navegar(-1);
      return;
    }
    const siguientes = new URLSearchParams(parametros);
    siguientes.delete('anuncio');
    setParametros(siguientes, { replace: true });
  };

  const alternarMeGusta = async (anuncioId: number, dar: boolean): Promise<boolean> => {
    if (!sesion) {
      notificarInfo('Entra con tu cuenta para dar me gusta.');
      return false;
    }
    try {
      const respuesta = dar ? await darLike(anuncioId) : await quitarLike(anuncioId);
      setAnuncios((prev) =>
        prev.map((a) => (a.id === anuncioId ? { ...a, likes: respuesta.likes } : a))
      );
      return true;
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo guardar tu me gusta.');
      return false;
    }
  };

  const abrirOtroPerfil = (semilla: SemillaPerfil) => {
    if (semilla.clavePerfil === id) cerrarAnuncio();
    else navegar(`/perfil/${semilla.clavePerfil}`);
  };

  /* ---------- Compartir ---------- */

  const compartir = async () => {
    const enlace = `${window.location.origin}/perfil/${id}`;
    const titulo = perfil ? `${perfil.nombre} en Baknazo` : 'Perfil en Baknazo';
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url: enlace });
        return;
      }
      await navigator.clipboard.writeText(enlace);
      notificarExito('Enlace del perfil copiado.');
    } catch (e) {
      // Cerrar el menú de compartir no es un error.
      if ((e as Error)?.name !== 'AbortError') notificarError('No se pudo compartir el enlace.');
    }
  };

  /* ---------- Derivados ---------- */

  const visibilidad = useMemo(() => privacidadCompleta(perfil?.visibilidad), [perfil]);
  /** Si una parte se enseña en esta vista. El dueño lo ve todo. */
  const ve = (clave: keyof PrivacidadPerfil) => propio || visibilidad[clave];
  /** Si una parte está oculta para los demás y hay que marcárselo al dueño. */
  const soloTu = (clave: keyof PrivacidadPerfil) => propio && !visibilidad[clave];

  const verVendidos = ve('vendidos');
  const pestanaActual = verVendidos ? pestana : 'ACTIVOS';
  const dePestana = useMemo(
    () => anuncios.filter((a) => (pestanaActual === 'ACTIVOS' ? !a.vendido : a.vendido)),
    [anuncios, pestanaActual]
  );

  /* ---------- Estados de carga ---------- */

  if (cargando && !perfil) {
    return (
      <MarcoApp titulo="Perfil">
        <Esqueleto />
      </MarcoApp>
    );
  }

  if (error || !perfil) {
    return (
      <MarcoApp titulo="Perfil">
        <div className="grid min-h-[70svh] place-items-center px-4 py-12">
          {/* "No encontrado" y "no hay red" no son lo mismo: al primero se le
              ofrece seguir navegando, al segundo, reintentar. */}
          {!error || /no encontrado|no existe/i.test(error) ? (
            <NoEncontrado
              codigo="404"
              titulo="Este perfil no existe"
              texto="La cuenta se eliminó o el enlace está mal escrito."
            >
              <button
                type="button"
                onClick={() => navegar('/anuncios')}
                className="h-11 rounded-lg bg-brand px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
              >
                Ir al inicio
              </button>
            </NoEncontrado>
          ) : (
            <NoEncontrado titulo="No pudimos cargar el perfil" texto={error}>
              <button
                type="button"
                onClick={reintentar}
                className="h-11 rounded-lg bg-brand px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
              >
                Reintentar
              </button>
            </NoEncontrado>
          )}
        </div>
      </MarcoApp>
    );
  }

  const negocio = perfil.tipo === 'NEGOCIO' ? (perfil as PerfilNegocio) : null;
  const disponibles = Math.max(0, perfil.publicados - perfil.vendidos);

  return (
    <MarcoApp titulo={propio ? 'Mi perfil' : 'Perfil'}>
      {comoVisitante && (
        <div className="sticky top-16 z-30 border-b border-accent/20 bg-accent/[0.07] backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            <span className="text-accent">
              <IconoOjo abierto />
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">
              Así ven tu perfil los demás. Lo que ocultaste no aparece.
            </p>
            <button
              type="button"
              onClick={salirDeVistaVisitante}
              className="h-8 rounded-lg bg-white px-3 text-[13px] font-semibold text-foreground ring-1 ring-border transition-colors hover:ring-muted"
            >
              Salir de esta vista
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1080px] pb-16 sm:px-6 sm:pt-4">
        <Portada
          perfil={perfil}
          editable={propio}
          onCambio={(usuario) => {
            setPerfil((prev) =>
              prev ? { ...prev, foto_portada: usuario.foto_portada_url ?? usuario.foto_portada ?? null } : prev
            );
            onPerfilActualizado?.(usuario);
          }}
        />

        <div className="px-4 sm:px-2">
          {/* ---------- Identidad ---------- */}
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            {propio ? (
              <AvatarEditable
                perfil={perfil}
                onCambio={(usuario) => {
                  const nueva =
                    perfil.tipo === 'NEGOCIO'
                      ? (usuario.negocio?.logo_url_completa ?? usuario.negocio?.logo_url ?? usuario.foto_perfil_url ?? usuario.foto_perfil ?? null)
                      : (usuario.foto_perfil_url ?? usuario.foto_perfil ?? null);
                  setPerfil((prev) => (prev ? { ...prev, foto: nueva } : prev));
                  onPerfilActualizado?.(usuario);
                }}
              />
            ) : (
              <Avatar perfil={perfil} />
            )}

            <div className="min-w-0 flex-1 basis-60 pt-2 sm:pb-1">
              <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[22px] leading-tight font-semibold tracking-tight sm:text-[28px]">
                <span className="min-w-0 break-words">{perfil.nombre}</span>
                {perfil.verificado && (
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-white"
                    title="Cuenta verificada"
                    aria-label="Cuenta verificada"
                  >
                    <IconoCheck ok />
                  </span>
                )}
                <Distintivo tipo={perfil.tipo} />
              </h1>
              <Subtitulo perfil={perfil} ve={ve} soloTu={soloTu} />
            </div>
          </div>

          {/* ---------- Cifras ---------- */}
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
            <Cifra valor={disponibles} texto={disponibles === 1 ? 'disponible' : 'disponibles'} />
            {ve('vendidos') && (
              <Cifra
                valor={perfil.vendidos}
                texto={perfil.vendidos === 1 ? 'vendido' : 'vendidos'}
                oculto={soloTu('vendidos')}
              />
            )}
            {ve('seguidores') && (
              <>
                <Cifra
                  valor={perfil.seguidores}
                  texto={perfil.seguidores === 1 ? 'seguidor' : 'seguidores'}
                  oculto={soloTu('seguidores')}
                  onClick={() => setRelacion('SEGUIDORES')}
                />
                <Cifra
                  valor={perfil.seguidos}
                  texto="seguidos"
                  oculto={soloTu('seguidores')}
                  onClick={() => setRelacion('SEGUIDOS')}
                />
              </>
            )}
            {ve('me_gusta') && (
              <Cifra
                valor={perfil.likes}
                texto="me gusta"
                oculto={soloTu('me_gusta')}
              />
            )}
          </dl>

          {/* ---------- Acciones ---------- */}
          <div className="mt-5 flex flex-wrap gap-2">
            {propio ? (
              <>
                <BotonSecundario icono={<IconoLapiz />} onClick={() => navegar('/configuracion')}>
                  Editar perfil
                </BotonSecundario>
                <BotonSecundario
                  icono={<IconoAjustes />}
                  onClick={() => navegar('/configuracion?seccion=privacidad')}
                >
                  Privacidad
                </BotonSecundario>
                <BotonIcono etiqueta="Ver como visitante" onClick={() => setParametros({ vista: 'visitante' })}>
                  <IconoOjo abierto />
                </BotonIcono>
                <BotonIcono etiqueta="Compartir perfil" onClick={compartir}>
                  <IconoCompartir />
                </BotonIcono>
              </>
            ) : (
              <>
                {!comoVisitante && (
                  <BotonSeguir
                    siguiendo={perfil.loSigues}
                    cargando={cargandoSeguir}
                    onClick={alternarSeguir}
                  />
                )}
                {/* El chat va siempre, también junto al WhatsApp de un negocio:
                    antes lo reemplazaba y no había forma de escribir por Baknazo.
                    En la vista previa de tu propio perfil se muestra apagado,
                    porque nadie puede escribirse a sí mismo. Se usa el id del
                    perfil cargado y no el de la URL. */}
                <BotonSecundario
                  icono={<IconoBocadillo />}
                  onClick={() => void abrirChat({ usuarioId: perfil.id })}
                  deshabilitado={esPropio || abriendoChat}
                >
                  {abriendoChat ? 'Abriendo' : 'Mensaje'}
                </BotonSecundario>
                {negocio && ve('contacto_negocio') && negocio.whatsapp && (
                  <a
                    href={enlaceWhatsapp(negocio.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 min-w-0 flex-1 basis-36 items-center justify-center gap-2 rounded-lg bg-success px-4 text-[14px] font-semibold text-white transition-colors hover:bg-success-deep"
                  >
                    <IconoBocadillo />
                    WhatsApp
                  </a>
                )}
                {negocio && ve('contacto_negocio') && negocio.telefono && (
                  <a
                    href={`tel:${negocio.telefono.replace(/\s+/g, '')}`}
                    className="inline-flex h-11 min-w-0 flex-1 basis-28 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted"
                  >
                    <IconoTelefono />
                    Llamar
                  </a>
                )}
                <BotonIcono etiqueta="Compartir perfil" onClick={compartir}>
                  <IconoCompartir />
                </BotonIcono>
              </>
            )}
          </div>

          {perfil.tipo === 'PERSONA' && !propio && (
            <p className="mt-3 text-[12.5px] leading-snug text-muted">
              Su número no se muestra en el perfil. Ábrelo desde uno de sus
              anuncios si lo tiene disponible.
            </p>
          )}

          {negocio && <FichaNegocio perfil={negocio} ve={ve} soloTu={soloTu} />}

          {/* ---------- Anuncios ---------- */}
          <div className="mt-8">
            <div role="tablist" aria-label="Anuncios del perfil" className="flex gap-1 border-b border-border">
              <Pestana
                activa={pestanaActual === 'ACTIVOS'}
                onClick={() => setPestana('ACTIVOS')}
                icono={<IconoEtiqueta />}
              >
                Disponibles <span className="text-muted">{disponibles}</span>
              </Pestana>
              {verVendidos && (
                <Pestana
                  activa={pestanaActual === 'VENDIDOS'}
                  onClick={() => setPestana('VENDIDOS')}
                  icono={<IconoCheck ok />}
                >
                  Vendidos <span className="text-muted">{perfil.vendidos}</span>
                  {soloTu('vendidos') && <MarcaOculto />}
                </Pestana>
              )}
            </div>

            {dePestana.length === 0 ? (
              <Vacio
                esVendidos={pestanaActual === 'VENDIDOS'}
                nombre={perfil.nombre}
                propio={propio}
                onPublicar={irAPublicar}
              />
            ) : (
              <>
                <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                  {dePestana.map((anuncio) => (
                    <MiniAnuncio key={anuncio.id} anuncio={anuncio} onAbrir={abrirAnuncio} />
                  ))}
                </ul>
                <CargarMas
                  hayMas={hayMas}
                  cargando={cargandoMas}
                  error={errorMas}
                  onCargar={cargarMasAnuncios}
                  esqueleto={
                    <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 4 }, (_, i) => (
                        <EsqueletoAnuncio key={i} vista="rejilla" />
                      ))}
                    </div>
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>

      {anuncioAbierto && (
        <DetalleAnuncioModal
          id={anuncioAbierto}
          onCerrar={cerrarAnuncio}
          onAlternarMeGusta={(dar) => alternarMeGusta(anuncioAbierto, dar)}
          onAbrirPerfil={abrirOtroPerfil}
          onEditar={propio ? (anuncioId) => navegar(`/mis-anuncios/${anuncioId}/editar`) : undefined}
        />
      )}

      {relacion && (
        <HojaRelacion
          id={id}
          tipo={relacion}
          total={relacion === 'SEGUIDORES' ? perfil.seguidores : perfil.seguidos}
          onCerrar={() => setRelacion(null)}
          onAbrirPerfil={(otro) => {
            setRelacion(null);
            navegar(`/perfil/${otro}`);
          }}
        />
      )}
    </MarcoApp>
  );
}

/* ---------- Piezas ---------- */

function Esqueleto() {
  return (
    <div className="grid min-h-[60svh] place-items-center px-4">
      <BaknazoLoader mensaje="Cargando el perfil" />
    </div>
  );
}

/**
 * La portada, con su propio botón de cambiarla si el perfil es tuyo.
 *
 * Se recorta en 3:1 antes de subirla, que es la forma exacta en que el backend
 * la guarda (1500 × 500): así lo que se encuadra es lo que se ve, en vez de un
 * centro recortado a ciegas en el servidor. Y al subirla ya no se recarga la
 * página: la respuesta trae la URL nueva y se pinta en el sitio.
 */
function Portada({
  perfil,
  editable,
  onCambio,
}: {
  perfil: PerfilPublico;
  editable: boolean;
  onCambio: (usuario: PerfilUsuario) => void;
}) {
  const fotoPortada = urlCompleta(perfil.foto_portada);
  const [bruto, setBruto] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [menu, setMenu] = useState(false);

  const elegir = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0] ?? null;
    evento.target.value = '';
    setMenu(false);
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      notificarError('Elige una imagen (JPG, PNG, WEBP o AVIF).');
      return;
    }
    if (archivo.size > MAX_PORTADA_BYTES) {
      notificarError('La portada no puede superar los 8 MB.');
      return;
    }
    setBruto(archivo);
  };

  const subir = async (archivo: File) => {
    setBruto(null);
    setSubiendo(true);
    try {
      const respuesta = await actualizarPerfil({}, { fotoPortada: archivo });
      onCambio(respuesta.usuario);
      notificarExito('Portada actualizada.');
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo subir la portada.');
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async () => {
    setMenu(false);
    setSubiendo(true);
    try {
      const respuesta = await actualizarPerfil({}, { eliminarFotoPortada: true });
      onCambio(respuesta.usuario);
      notificarExito('Quitaste la portada.');
    } catch (e) {
      notificarError(e instanceof Error ? e.message : 'No se pudo quitar la portada.');
    } finally {
      setSubiendo(false);
    }
  };

  const esNegocio = perfil.tipo === 'NEGOCIO';

  return (
    <div className="relative">
      <div className="relative aspect-[3/1] max-h-[260px] w-full overflow-hidden border-b border-border bg-border/40 sm:rounded-2xl sm:border">
        {fotoPortada ? (
          <img src={fotoPortada} alt="" className="size-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className={`size-full ${esNegocio ? 'bg-accent' : 'bg-brand'}`}
            style={{
              backgroundImage: esNegocio
                ? 'radial-gradient(circle at 18% 120%, rgba(255,255,255,0.22) 0 30%, transparent 30.5%), radial-gradient(circle at 92% -20%, rgba(255,255,255,0.14) 0 38%, transparent 38.5%)'
                : 'radial-gradient(circle at 18% 120%, rgba(255,255,255,0.4) 0 30%, transparent 30.5%), radial-gradient(circle at 92% -20%, rgba(255,255,255,0.3) 0 38%, transparent 38.5%)',
            }}
          />
        )}

        {subiendo && (
          <div className="absolute inset-0 grid place-items-center bg-carbon/35">
            <span className="rounded-full bg-carbon/75 px-3.5 py-2 text-[12.5px] font-medium text-white">
              <BaknazoLoader tamano="boton" mensaje="Guardando portada" />
            </span>
          </div>
        )}
      </div>

      {editable && (
        <div className="absolute right-3 bottom-3">
          {fotoPortada ? (
            <button
              type="button"
              disabled={subiendo}
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={menu}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-carbon/70 px-3 text-[13px] font-medium text-white transition-colors hover:bg-carbon/85 disabled:opacity-50"
            >
              <IconoCamara />
              <span className="hidden sm:inline">Editar portada</span>
            </button>
          ) : (
            <label
              title="Recomendado: 1500 × 500 px (3:1). JPG, PNG o WEBP, hasta 8 MB."
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-carbon/70 px-3 text-[13px] font-medium text-white transition-colors hover:bg-carbon/85 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                subiendo ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <IconoCamara />
              Añadir portada
              <span className="hidden text-white/70 sm:inline">· 1500 × 500 px</span>
              <input type="file" accept="image/*" className="sr-only" onChange={elegir} disabled={subiendo} />
            </label>
          )}

          {menu && (
            <>
              <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setMenu(false)} />
              <div
                role="menu"
                className="animate-bkn-in absolute right-0 bottom-11 z-40 w-64 overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]"
              >
                <p className="border-b border-border bg-background/70 px-4 py-2.5 text-[11.5px] leading-snug text-muted">
                  Recomendado: 1500 × 500 px (3:1). JPG, PNG o WEBP, hasta 8 MB.
                </p>
                <label
                  role="menuitem"
                  className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[13.5px] font-medium text-foreground hover:bg-background"
                >
                  <span className="text-muted">
                    <IconoCamara />
                  </span>
                  Cambiar portada
                  <input type="file" accept="image/*" className="sr-only" onChange={elegir} />
                </label>
                <button
                  type="button"
                  role="menuitem"
                  onClick={eliminar}
                  className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-[13.5px] font-medium text-danger-deep hover:bg-danger/[0.04]"
                >
                  <IconoPapelera />
                  Quitar portada
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {bruto && (
        <RecortadorImagen
          imagen={bruto}
          forma="rectangular"
          formatos={['3/1']}
          tamanoSalida={1500}
          ayuda={AYUDA_PORTADA}
          onRecortada={subir}
          onCancelar={() => setBruto(null)}
        />
      )}
    </div>
  );
}

/**
 * La foto del perfil propio, con un botón de cámara encima para cambiarla sin
 * pasar por Configuración. En un negocio la foto que se ve es su logo, así que
 * es el logo lo que se cambia.
 */
function AvatarEditable({ perfil, onCambio }: { perfil: PerfilPublico; onCambio: (usuario: PerfilUsuario) => void }) {
  const esNegocio = perfil.tipo === 'NEGOCIO';
  const [bruto, setBruto] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [menu, setMenu] = useState(false);
  const nombre = esNegocio ? 'el logo' : 'la foto';

  const elegir = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0] ?? null;
    evento.target.value = '';
    setMenu(false);
    if (!archivo) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(archivo.type)) {
      notificarError('Elige una imagen JPG, PNG, WEBP o AVIF.');
      return;
    }
    if (archivo.size > MAX_PORTADA_BYTES) {
      notificarError('La imagen no puede superar los 8 MB.');
      return;
    }
    setBruto(archivo);
  };

  const guardar = async (cambio: { archivo?: File; quitar?: boolean }) => {
    setBruto(null);
    setMenu(false);
    setSubiendo(true);
    try {
      const imagenes = esNegocio
        ? cambio.quitar
          ? { eliminarLogo: true }
          : { logo: cambio.archivo }
        : cambio.quitar
          ? { eliminarFotoPerfil: true }
          : { fotoPerfil: cambio.archivo };
      const respuesta = await actualizarPerfil({}, imagenes);
      onCambio(respuesta.usuario);
      notificarExito(cambio.quitar ? `Quitaste ${nombre}.` : esNegocio ? 'Logo actualizado.' : 'Foto actualizada.');
    } catch (e) {
      notificarError(e instanceof Error ? e.message : `No se pudo guardar ${nombre}.`);
    } finally {
      setSubiendo(false);
    }
  };

  const entrada = <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={elegir} />;

  return (
    <div className="relative shrink-0">
      <Avatar perfil={perfil} />
      {subiendo && (
        <span className="absolute inset-0 -mt-10 grid place-items-center rounded-full bg-carbon/45 sm:-mt-14">
          <BaknazoLoader tamano="boton" />
        </span>
      )}
      {perfil.foto ? (
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          disabled={subiendo}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={`Cambiar ${nombre} del perfil`}
          title={`Cambiar ${nombre}`}
          className="absolute right-0 bottom-0 grid size-9 place-items-center rounded-full bg-carbon text-white shadow-md ring-3 ring-background transition-colors hover:bg-carbon/85 disabled:opacity-50 sm:right-1 sm:bottom-1"
        >
          <IconoCamara />
        </button>
      ) : (
        <label
          aria-label={`Añadir ${nombre} del perfil`}
          title={`Añadir ${nombre}`}
          className={`absolute right-0 bottom-0 grid size-9 cursor-pointer place-items-center rounded-full bg-carbon text-white shadow-md ring-3 ring-background transition-colors hover:bg-carbon/85 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent sm:right-1 sm:bottom-1 ${
            subiendo ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <IconoCamara />
          {entrada}
        </label>
      )}

      {menu && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setMenu(false)} />
          <div
            role="menu"
            className="animate-bkn-in absolute top-full left-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_40px_-20px_rgba(31,41,55,0.45)]"
          >
            <p className="border-b border-border bg-background/70 px-4 py-2.5 text-[11.5px] leading-snug text-muted">
              Cuadrada, al menos 512 × 512 px. JPG, PNG o WEBP, hasta 8 MB.
            </p>
            <label
              role="menuitem"
              className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[13.5px] font-medium text-foreground hover:bg-background"
            >
              <span className="text-muted">
                <IconoCamara />
              </span>
              {esNegocio ? 'Cambiar logo' : 'Cambiar foto de perfil'}
              {entrada}
            </label>
            <button
              type="button"
              role="menuitem"
              onClick={() => void guardar({ quitar: true })}
              className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-[13.5px] font-medium text-danger-deep hover:bg-danger/[0.04]"
            >
              <IconoPapelera />
              {esNegocio ? 'Quitar logo' : 'Quitar foto'}
            </button>
          </div>
        </>
      )}

      {bruto && (
        <RecortadorImagen
          imagen={bruto}
          // El logo se recorta cuadrado (sin máscara): un logo con bordes
          // transparentes en círculo perdería sus esquinas.
          forma={esNegocio ? 'rectangular' : 'circulo'}
          formatos={['1/1']}
          tamanoSalida={512}
          ayuda={AYUDA_FOTO}
          onRecortada={(archivo) => void guardar({ archivo })}
          onCancelar={() => setBruto(null)}
        />
      )}
    </div>
  );
}

function Avatar({ perfil }: { perfil: PerfilPublico }) {
  const foto = urlCompleta(perfil.foto);
  const [fallo, setFallo] = useState(false);
  const clase =
    '-mt-10 size-24 shrink-0 rounded-full ring-4 ring-background sm:-mt-14 sm:size-32';

  if (foto && !fallo) {
    return (
      <img
        src={foto}
        alt={`Foto de ${perfil.nombre}`}
        onError={() => setFallo(true)}
        className={`${clase} relative bg-white object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${clase} relative grid place-items-center text-2xl font-semibold text-white sm:text-3xl ${
        perfil.tipo === 'NEGOCIO' ? 'bg-accent' : 'bg-carbon'
      }`}
    >
      {inicialesDe(perfil.nombre)}
    </span>
  );
}

function Subtitulo({
  perfil,
  ve,
  soloTu,
}: {
  perfil: PerfilPublico;
  ve: (clave: keyof PrivacidadPerfil) => boolean;
  soloTu: (clave: keyof PrivacidadPerfil) => boolean;
}) {
  const partes: ReactNode[] = [];
  if (perfil.tipo === 'NEGOCIO' && (perfil as PerfilNegocio).categoria) {
    partes.push(<span key="cat">{(perfil as PerfilNegocio).categoria}</span>);
  }
  if (perfil.ubicacion && ve('ubicacion')) {
    partes.push(
      <span key="ubi" className="inline-flex items-center gap-1">
        {perfil.ubicacion}
        {soloTu('ubicacion') && <MarcaOculto />}
      </span>
    );
  }
  if (perfil.miembroDesde && ve('miembro_desde')) {
    partes.push(
      <span key="desde" className="inline-flex items-center gap-1">
        En Baknazo desde {perfil.miembroDesde}
        {soloTu('miembro_desde') && <MarcaOculto />}
      </span>
    );
  }
  if (partes.length === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13.5px] text-muted">
      {partes.map((parte, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          {parte}
        </span>
      ))}
    </p>
  );
}

/** Marca pequeña para el dueño: esto no lo ven los visitantes. */
function MarcaOculto() {
  return (
    <span
      title="Oculto para los visitantes"
      className="inline-flex items-center gap-1 rounded-full bg-background px-1.5 py-0.5 text-[10.5px] font-semibold text-muted ring-1 ring-border"
    >
      Solo tú
    </span>
  );
}

function Distintivo({ tipo }: { tipo: PerfilPublico['tipo'] }) {
  const esNegocio = tipo === 'NEGOCIO';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        esNegocio ? 'bg-accent/10 text-accent-dark' : 'bg-border/60 text-muted'
      }`}
    >
      {esNegocio ? <IconoNegocio /> : <IconoPersona />}
      {esNegocio ? 'Negocio' : 'Persona'}
    </span>
  );
}

function Cifra({
  valor,
  texto,
  oculto = false,
  onClick,
}: {
  valor: number;
  texto: string;
  oculto?: boolean;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <span className="text-[16px] font-semibold text-foreground tabular-nums">
        {valor.toLocaleString('es-EC')}
      </span>{' '}
      <span className="text-[13.5px] text-muted">{texto}</span>
      {oculto && (
        <>
          {' '}
          <MarcaOculto />
        </>
      )}
    </>
  );

  return (
    <div>
      <dt className="sr-only">{texto}</dt>
      <dd>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="rounded-md text-left transition-opacity hover:opacity-75"
          >
            {contenido}
          </button>
        ) : (
          contenido
        )}
      </dd>
    </div>
  );
}

function FichaNegocio({
  perfil,
  ve,
  soloTu,
}: {
  perfil: PerfilNegocio;
  ve: (clave: keyof PrivacidadPerfil) => boolean;
  soloTu: (clave: keyof PrivacidadPerfil) => boolean;
}) {
  const verDireccion = ve('direccion');
  const verHorario = ve('horario') && perfil.horario.length > 0;
  const verRedes = ve('redes') && perfil.redes.length > 0;
  const hayDatos =
    (verDireccion && (perfil.direccion || perfil.ubicacion)) || verHorario || perfil.entregaDomicilio;

  const mapa =
    perfil.latitud && perfil.longitud
      ? `https://www.google.com/maps/search/?api=1&query=${perfil.latitud},${perfil.longitud}`
      : perfil.direccion || perfil.ubicacion
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            perfil.direccion ?? perfil.ubicacion
          )}`
        : null;

  if (!perfil.descripcion && !verRedes && !hayDatos) return null;

  return (
    <section className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {(perfil.descripcion || verRedes) && (
        <div className={TARJETA}>
          <h2 className="text-[16px] leading-tight font-semibold tracking-tight">Sobre el negocio</h2>
          {perfil.descripcion && (
            <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-foreground">
              {perfil.descripcion}
            </p>
          )}

          {verRedes && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {perfil.redes.map((red) => (
                <a
                  key={red.etiqueta}
                  href={red.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:border-muted"
                >
                  {red.etiqueta}
                </a>
              ))}
              {soloTu('redes') && <MarcaOculto />}
            </div>
          )}

          {perfil.valoracion !== null && (
            <div className="mt-5 flex items-center gap-2.5 border-t border-border pt-4">
              <span className="flex items-center gap-0.5 text-brand">{Estrellas(perfil.valoracion)}</span>
              <span className="text-[14px] font-semibold">{perfil.valoracion.toFixed(1)}</span>
              <span className="text-[13px] text-muted">
                ({plural(perfil.numeroValoraciones, 'valoración', 'valoraciones')})
              </span>
            </div>
          )}
        </div>
      )}

      {hayDatos && (
        <div className={TARJETA}>
          <h2 className="text-[16px] leading-tight font-semibold tracking-tight">Datos</h2>

          {verDireccion && (perfil.direccion || perfil.ubicacion) && (
            <Dato
              icono={<IconoPin />}
              etiqueta="Dirección"
              oculto={soloTu('direccion')}
              valor={
                <>
                  {perfil.direccion ?? perfil.ubicacion}
                  {mapa && (
                    <a
                      href={mapa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block font-medium text-accent hover:underline"
                    >
                      Ver en el mapa
                    </a>
                  )}
                </>
              }
            />
          )}

          {verHorario && (
            <div className="mt-4 flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-muted">
                <IconoReloj />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                  Horario
                  {soloTu('horario') && <MarcaOculto />}
                </p>
                <p className="mt-0.5 text-[13px] text-foreground">{resumenHorario(perfil.horario)}</p>
                <details className="mt-1.5">
                  <summary className="cursor-pointer list-none text-[13px] font-medium text-accent hover:underline">
                    Ver todos los días
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {perfil.horario.map((dia) => (
                      <li key={dia.dia} className="flex justify-between gap-4 text-[13px]">
                        <span className={esHoy(dia.dia) ? 'font-semibold' : 'text-muted'}>{dia.dia}</span>
                        <span className={dia.abierto ? '' : 'text-muted'}>
                          {dia.abierto && dia.desde && dia.hasta ? `${dia.desde} a ${dia.hasta}` : 'Cerrado'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          )}

          {perfil.entregaDomicilio && (
            <Dato
              icono={<IconoMas />}
              etiqueta="Entrega a domicilio"
              valor={perfil.zonaCobertura ?? 'Consulta la cobertura'}
            />
          )}
        </div>
      )}
    </section>
  );
}

function enlaceWhatsapp(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}`;
}

function Dato({
  icono,
  etiqueta,
  valor,
  oculto = false,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: ReactNode;
  oculto?: boolean;
}) {
  return (
    <div className="mt-4 flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted">{icono}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          {etiqueta}
          {oculto && <MarcaOculto />}
        </p>
        <div className="mt-0.5 text-[13px] leading-snug text-foreground">{valor}</div>
      </div>
    </div>
  );
}

function esHoy(dia: string): boolean {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dias[new Date().getDay()] === dia;
}

function Estrellas(nota: number) {
  const llenas = Math.floor(nota);
  const hayMedia = nota - llenas >= 0.25;
  return Array.from({ length: 5 }, (_, i) => (
    <IconoEstrella key={i} llena={i < llenas || (i === llenas && hayMedia)} />
  ));
}

function BotonSecundario({
  icono,
  children,
  onClick,
  deshabilitado = false,
}: {
  icono: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="inline-flex h-11 min-w-0 flex-1 basis-36 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
    >
      {icono}
      <span className="truncate">{children}</span>
    </button>
  );
}

function BotonIcono({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-white text-foreground transition-colors hover:border-muted"
    >
      {children}
    </button>
  );
}

function BotonSeguir({
  siguiendo,
  cargando,
  onClick,
}: {
  siguiendo: boolean;
  cargando: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      aria-pressed={siguiendo}
      className={
        siguiendo
          ? 'inline-flex h-11 min-w-0 flex-1 basis-36 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted disabled:opacity-60'
          : 'inline-flex h-11 min-w-0 flex-1 basis-36 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-60'
      }
    >
      {siguiendo ? <IconoCheck ok /> : <IconoMas />}
      {siguiendo ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}

function Pestana({
  activa,
  onClick,
  icono,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={
        activa
          ? '-mb-px flex items-center gap-1.5 border-b-2 border-accent px-3 py-3 text-[14px] font-semibold text-foreground'
          : '-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-3 text-[14px] font-medium text-muted transition-colors hover:text-foreground'
      }
    >
      <span className={activa ? 'text-accent' : 'text-muted'}>{icono}</span>
      {children}
    </button>
  );
}

function MiniAnuncio({ anuncio, onAbrir }: { anuncio: AnuncioPerfil; onAbrir: (id: number) => void }) {
  const estilo = ESTILO_PILAR[anuncio.pilar];
  const foto = urlCompleta(anuncio.foto);

  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(anuncio.id)}
        className="group block w-full text-left"
      >
        <div className={`relative ${estilo.fondo} aspect-square overflow-hidden rounded-xl`}>
          {foto ? (
            <img
              src={foto}
              alt=""
              loading="lazy"
              decoding="async"
              className={`size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
                anuncio.vendido ? 'grayscale' : ''
              }`}
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-full place-items-center text-[28px] font-semibold text-black/25"
            >
              {inicialesDe(anuncio.titulo)}
            </span>
          )}
          {anuncio.vendido && (
            <span className="absolute bottom-2 left-2 rounded-md bg-carbon/85 px-2 py-0.5 text-[11px] font-semibold text-white uppercase">
              Vendido
            </span>
          )}
        </div>

        <div className="px-0.5 pt-2">
          <p className="text-[15px] leading-tight font-bold text-foreground">{anuncio.precio}</p>
          <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-foreground group-hover:underline">
            {anuncio.titulo}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted">
            <span>{haceCuanto(anuncio.publicadoEn)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-0.5">
              <IconoPulgar />
              {anuncio.likes}
            </span>
          </p>
        </div>
      </button>
    </li>
  );
}

function Vacio({
  esVendidos,
  nombre,
  propio,
  onPublicar,
}: {
  esVendidos: boolean;
  nombre: string;
  propio: boolean;
  onPublicar: () => void;
}) {
  const titulo = esVendidos
    ? 'Sin ventas marcadas todavía'
    : propio
      ? 'Aún no tienes anuncios disponibles'
      : 'No hay anuncios disponibles';
  const texto = esVendidos
    ? propio
      ? 'Cuando marques un anuncio como vendido aparecerá aquí. Es la mejor prueba de confianza para quien te compra.'
      : `Cuando ${nombre} marque una venta, aparecerá aquí.`
    : propio
      ? 'Publica tu primer anuncio: es gratis y tarda menos de dos minutos.'
      : `Cuando ${nombre} publique algo, lo verás aquí.`;

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border bg-white px-5 py-10 text-center">
      <p className="text-[15px] font-medium text-foreground">{titulo}</p>
      <p className="mx-auto mt-1 max-w-[42ch] text-[13px] leading-snug text-muted">{texto}</p>
      {propio && !esVendidos && (
        <button
          type="button"
          onClick={onPublicar}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
        >
          <IconoMas />
          Publicar gratis
        </button>
      )}
    </div>
  );
}

/**
 * Seguidores o seguidos, en una hoja que sube desde abajo en móvil.
 *
 * Carga su propia lista al abrirse y la pagina con "Ver más". Cada persona es
 * un enlace a su perfil: una lista de seguidores que no lleva a ninguna parte
 * es solo un número más largo.
 */
function HojaRelacion({
  id,
  tipo,
  total,
  onCerrar,
  onAbrirPerfil,
}: {
  id: string;
  tipo: Relacion;
  total: number;
  onCerrar: () => void;
  onAbrirPerfil: (id: string) => void;
}) {
  const [lista, setLista] = useState<Seguidor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBloqueoScroll();

  const pedir = useCallback(
    (desde: number) =>
      tipo === 'SEGUIDORES' ? obtenerSeguidores(id, 20, desde) : obtenerSeguidos(id, 20, desde),
    [id, tipo]
  );

  useEffect(() => {
    let vivo = true;
    pedir(0)
      .then((respuesta) => {
        if (!vivo) return;
        setLista(respuesta.seguidores);
        setHayMas(respuesta.paginacion.hayMas);
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [pedir]);

  const [errorMas, setErrorMas] = useState(false);
  const verMas = async () => {
    if (cargando) return;
    setCargando(true);
    setErrorMas(false);
    try {
      const respuesta = await pedir(lista.length);
      setLista((prev) => {
        const vistos = new Set(prev.map((x) => x.id));
        return [...prev, ...respuesta.seguidores.filter((x) => !vistos.has(x.id))];
      });
      setHayMas(respuesta.paginacion.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const titulo = tipo === 'SEGUIDORES' ? 'Seguidores' : 'Seguidos';

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="animate-bkn-velo absolute inset-0 cursor-default bg-carbon/50"
      />
      <div className="animate-bkn-in relative flex max-h-[80svh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[16px] font-semibold tracking-tight">
            {titulo}
            <span className="ml-2 text-[13px] font-normal text-muted">{total.toLocaleString('es-EC')}</span>
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? (
            <p className="px-3 py-8 text-center text-[14px] text-muted">{error}</p>
          ) : lista.length === 0 && cargando ? (
            <BaknazoLoader tamano="seccion" mensaje="Cargando" />
          ) : lista.length === 0 ? (
            <p className="px-3 py-8 text-center text-[14px] text-muted">
              {tipo === 'SEGUIDORES' ? 'Todavía no tiene seguidores.' : 'Todavía no sigue a nadie.'}
            </p>
          ) : (
            <>
              <ul>
                {lista.map((persona) => (
                  <li key={persona.id}>
                    <FilaPersona persona={persona} onAbrir={() => onAbrirPerfil(persona.id)} />
                  </li>
                ))}
              </ul>
              <CargarMas hayMas={hayMas} cargando={cargando} error={errorMas} onCargar={verMas} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaPersona({ persona, onAbrir }: { persona: Seguidor; onAbrir: () => void }) {
  const foto = urlCompleta(persona.foto);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-background"
    >
      {foto ? (
        <img src={foto} alt="" className="size-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white ${
            persona.tipo === 'NEGOCIO' ? 'bg-accent' : 'bg-carbon'
          }`}
        >
          {inicialesDe(persona.nombre)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-foreground">{persona.nombre}</span>
        <span className="block text-[12px] text-muted">
          {persona.tipo === 'NEGOCIO' ? 'Negocio' : 'Persona'} · desde {haceCuanto(persona.desde)}
        </span>
      </span>
    </button>
  );
}

function resumenHorario(
  horario: { dia: string; abierto: boolean; desde: string | null; hasta: string | null }[]
): string {
  const abiertos = horario.filter((d) => d.abierto && d.desde && d.hasta);
  if (abiertos.length === 0) return 'Cerrado todos los días';

  const primero = abiertos[0];
  const iguales = abiertos.filter((d) => d.desde === primero.desde && d.hasta === primero.hasta);
  const desde = horaLegible(primero.desde!);
  const hasta = horaLegible(primero.hasta!);

  if (abiertos.length === iguales.length && iguales.length > 1) {
    return `De ${iguales[0].dia} a ${iguales[iguales.length - 1].dia}, de ${desde} a ${hasta}`;
  }
  if (abiertos.length === 1) {
    return `${primero.dia}, de ${desde} a ${hasta}`;
  }
  return `${abiertos[0].dia} de ${desde} a ${hasta}, y ${abiertos.length - 1} día${
    abiertos.length - 1 > 1 ? 's' : ''
  } más`;
}

function horaLegible(hora: string): string {
  const [h, m] = hora.split(':');
  return `${Number(h)}:${m ?? '00'}`;
}
