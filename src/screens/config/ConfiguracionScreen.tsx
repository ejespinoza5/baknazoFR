import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { actualizarPerfil } from '../../api/auth';
import { urlCompleta } from '../../lib/imagen';
import MarcoApp from '../../components/MarcoApp';
import AjustesNotificaciones from '../../components/AjustesNotificaciones';
import {
  IconoAlerta,
  IconoCampana,
  IconoCandado,
  IconoLapiz,
  IconoOjo,
  IconoPapelera,
  IconoSoporte,
  IconoTelefono,
} from '../../components/Iconos';
import ChatSoporte from '../../components/ChatSoporte';
import { useSoporteNoLeidos } from '../../lib/soporte';
import { m } from 'motion/react';
import { RESORTE } from '../../lib/movimiento';
import PanelPrivacidad from './PanelPrivacidad';
import SelectorImagen from '../../components/SelectorImagen';
import RecortadorImagen from '../../components/RecortadorImagen';
import VisorGaleria from '../../components/VisorGaleria';
import BaknazoLoader from '../../components/BaknazoLoader';
import {
  notificarAviso,
  notificarError,
  notificarExito,
} from '../../lib/notificar';
import FormularioNegocio from './FormularioNegocio';
import PanelContrasena from './PanelContrasena';
import {
  EXTENSIONES_IMAGEN,
  MAX_IMAGEN_BYTES,
  cambiosNegocio,
  estadoDesdeNegocio,
  validarNegocio,
  type EstadoNegocio,
} from './negocio';
import { alertaError, etiqueta, inputBase, tarjeta } from './ui';
import type {
  CambiosPerfil,
  ImagenesPerfil,
  PerfilUsuario,
  RespuestaCambioContrasena,
  Sesion,
} from '../../types/auth';

type Pestana = 'perfil' | 'privacidad' | 'notificaciones' | 'seguridad' | 'soporte';

/**
 * Números de teléfono: dígitos, espacios, paréntesis, guiones y el `+` de
 * siempre. Es deliberadamente ancho porque el Ecuador escribe el número de
 * catorce formas y lo que importa es que no se cuele una letra. El backend lo
 * normaliza a E.164 al guardar; aquí solo se filtra lo absurdo.
 */
const PATRON_TELEFONO = /^[+\d\s()-]{7,20}$/;

const PESTANAS: { id: Pestana; label: string; icono: ReactNode }[] = [
  { id: 'perfil', label: 'Editar perfil', icono: <IconoLapiz /> },
  { id: 'privacidad', label: 'Privacidad', icono: <IconoOjo abierto /> },
  { id: 'notificaciones', label: 'Notificaciones', icono: <IconoCampana /> },
  { id: 'seguridad', label: 'Seguridad', icono: <IconoCandado /> },
  { id: 'soporte', label: 'Ayuda y soporte', icono: <IconoSoporte /> },
];

interface Props {
  sesion: Sesion;
  perfil: PerfilUsuario | null;
  cargandoPerfil: boolean;
  /**
   * Por qué falló GET /me. Sin esto, una sesión caducada se muestra como
   * "revisa tu conexión" y el usuarioPersigue un problema que no tiene.
   */
  falloPerfil: 'sin-conexion' | 'error' | null;
  onPerfilActualizado: (usuario: PerfilUsuario) => void;
  onSesionRenovada: (tokens: RespuestaCambioContrasena) => void;
}

/** Lo que necesita el formulario: el perfil ya está cargado. */
type PropsFormulario = Omit<
  Props,
  'perfil' | 'cargandoPerfil' | 'falloPerfil'
> & {
  perfil: PerfilUsuario;
};

/** Object URL del archivo local, liberada al cambiar o al desmontar. */
function useUrlArchivo(archivo: File | null): string | null {
  const url = useMemo(
    () => (archivo ? URL.createObjectURL(archivo) : null),
    [archivo]
  );

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}

/** Solo los campos de texto que cambiaron; "" borra, undefined no se envía. */
function cambiosPersonales(
  perfil: PerfilUsuario,
  nombres: string,
  apellidos: string
): CambiosPerfil {
  const cambios: CambiosPerfil = {};
  if (nombres.trim() !== (perfil.nombres ?? '').trim())
    cambios.nombres = nombres.trim();
  if (apellidos.trim() !== (perfil.apellidos ?? '').trim())
    cambios.apellidos = apellidos.trim();
  return cambios;
}

/**
 * Lo del teléfono, y solo si se movió algo.
 *
 * Va anidado en `contacto` porque `telefono` a este nivel del PATCH ya es el del
 * negocio. Y van los dos campos juntos aunque solo cambie uno: son dos, y enviar
 * solo el que se movió obligaría a un `PATCH` parcial más por cada casilla.
 */
function cambiosContacto(
  perfil: PerfilUsuario,
  telefono: string,
  mostrar: boolean
): CambiosPerfil {
  const actual = perfil.contacto?.telefono ?? '';
  const antes = perfil.contacto?.mostrar_telefono ?? false;
  if (telefono.trim() === actual.trim() && mostrar === antes) return {};
  return { contacto: { telefono: telefono.trim() || null, mostrar_telefono: mostrar } };
}

/**
 * Espera a que llegue GET /me y recién ahí monta el formulario: así sus
 * estados iniciales salen del perfil sin needing un efecto que los sincronice.
 */
export default function ConfiguracionScreen(props: Props) {
  if (props.cargandoPerfil && !props.perfil) {
    return <PantallaCargando />;
  }

  if (!props.perfil) {
    return <PerfilNoDisponible fallo={props.falloPerfil} />;
  }

  return <FormularioConfiguracion {...props} perfil={props.perfil} />;
}

function PantallaCargando() {
  return (
    <MarcoApp titulo="Configuración">
      <div className="px-4 sm:px-6">
        <div className={`${tarjeta} mx-auto mt-10 grid max-w-[1080px] place-items-center py-16`}>
          <BaknazoLoader mensaje="Cargando tu perfil…" />
        </div>
      </div>
    </MarcoApp>
  );
}

function PerfilNoDisponible({ fallo }: { fallo: 'sin-conexion' | 'error' | null }) {
  // Un 401 real ya cerró la sesión en el motor, así que llegar aquí con
  // `error` casi siempre es un 5xx o un payload raro: culpar a la red sería
  // mandar al usuario a reiniciar el router.
  const texto =
    fallo === 'sin-conexion'
      ? 'No pudimos cargar tu perfil. Revisa tu conexión y vuelve a entrar.'
      : 'No pudimos cargar tu perfil. Vuelve a entrar para reintentarlo.';

  return (
    <MarcoApp titulo="Configuración">
      <div className="px-4 sm:px-6">
        <div className={`${tarjeta} mx-auto mt-10 max-w-[1080px]`}>
          <div className={alertaError} role="alert">
            <IconoAlerta />
            <span>{texto}</span>
          </div>
        </div>
      </div>
    </MarcoApp>
  );
}

/**
 * El bloque de teléfono, en sus dos versiones.
 *
 * A una persona se le pide el número: no lo dio en el registro y sin él no hay
 * forma de que nadie la contacte. A un negocio **no** se le pregunta, porque en
 * su registro ya lo escribió en "Datos del negocio", y preguntarlo otra vez
 * produce dos números que no coinciden y una duda razonable sobre cuál manda.
 *
 * Lo que el negocio sí necesita es la casilla de permiso, y por eso el bloque
 * no desaparece: se queda solo el consentimiento, leyendo el número del
 * negocio. Por eso `telefono: null` no significa "sin número" sino "no lo
 * escribas aquí".
 */
function PanelContacto({
  telefono,
  onTelefono,
  delNegocio,
  guardando,
  mostrando,
  onCambiarMostrando,
}: {
  /** `null` = no editar el número (cuenta de negocio). */
  telefono: string | null;
  onTelefono?: (valor: string) => void;
  delNegocio?: string | null;
  guardando?: boolean;
  mostrando: boolean;
  onCambiarMostrando: (valor: boolean) => void;
}) {
  const edita = telefono !== null;
  const numero = edita ? telefono.trim() : (delNegocio ?? '').trim();

  return (
    <section className={tarjeta}>
      <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
        {edita ? 'Teléfono' : 'Contacto en tus anuncios'}
      </h2>
      <p className="mt-1.5 text-[13px] text-muted">
        {edita
          ? 'No lo pedimos al registrarte. Si lo escribes aquí, puedes decidir que aparezca en los anuncios que publiques.'
          : 'Ya diste el teléfono de tu negocio al registrarte, así que usaremos ese. Aquí solo decides si se enseña.'}
      </p>

      {edita && (
        <div className="mt-5 max-w-sm">
          <label className="block">
            <span className={etiqueta}>Número de teléfono</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+593 99 123 4567"
              value={telefono}
              onChange={(e) => {
                onTelefono?.(e.target.value);
                // Borrar el número apaga la casilla sola: un perfil sin
                // teléfono no puede estar pidiendo que se le muestre, y dejarla
                // encendida solo produciría un error al guardar.
                if (!e.target.value.trim()) onCambiarMostrando(false);
              }}
              disabled={guardando}
              className={inputBase}
            />
          </label>
        </div>
      )}

      {!edita && numero && (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-4 py-3 text-[13px] text-foreground">
          <span className="shrink-0 text-muted">
            <IconoTelefono />
          </span>
          <span className="truncate">{numero}</span>
        </p>
      )}

      {/* La casilla sin número es una promesa que el backend no puede cumplir,
          así que se apaga sola. Se avisa en la misma línea en lugar de un error
          al guardar: es una consecuencia obvia de no haber escrito nada, no un
          fallo. */}
      <div className="mt-5 rounded-xl border border-border bg-background/50 px-4 py-3.5">
        <label
          className={`flex w-fit items-center gap-2.5 text-[13px] ${
            numero
              ? 'cursor-pointer text-foreground'
              : 'cursor-not-allowed text-muted'
          }`}
        >
          <input
            type="checkbox"
            checked={mostrando && Boolean(numero)}
            onChange={(e) => onCambiarMostrando(e.target.checked)}
            disabled={guardando || !numero}
            className="size-4 accent-accent disabled:cursor-not-allowed"
          />
          {edita
            ? 'Mostrar mi número en los anuncios que publique'
            : 'Mostrar el teléfono de mi negocio en los anuncios que publique'}
        </label>
        <p className="mt-1.5 pl-[26px] text-[12px] text-muted">
          {numero ? (
            <>
              Podrás apagarlo en un solo anuncio al publicarlo. Nadie ve el
              número sin abrir antes el botón de contacto.
            </>
          ) : edita ? (
            'Escribe un número arriba para poder activarlo.'
          ) : (
            /* El negocio sí puede haberse registrado sin teléfono, porque
               aquel formulario no lo obliga. El aviso tiene que llevarnos al
               sitio donde sí se puede escribir. */
            <>
              Tu negocio se registró sin teléfono. Agrégalo en{' '}
              <strong className="font-semibold">Datos del negocio</strong> para
              poder activarlo.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function FormularioConfiguracion({
  sesion,
  perfil,
  onPerfilActualizado,
  onSesionRenovada,
}: PropsFormulario) {
  // La pestaña va en la URL (?seccion=privacidad) para que el perfil pueda
  // enlazar directo a "Qué ven los demás" y para que un F5 no la pierda.
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('seccion');
  const pestana: Pestana =
    pedida === 'privacidad' || pedida === 'notificaciones' || pedida === 'seguridad' || pedida === 'soporte'
      ? pedida
      : 'perfil';
  const soporteSinLeer = useSoporteNoLeidos();
  const setPestana = (nueva: Pestana) =>
    setParametros(nueva === 'perfil' ? {} : { seccion: nueva }, { replace: true });

  const [nombres, setNombres] = useState(perfil.nombres ?? '');
  const [apellidos, setApellidos] = useState(perfil.apellidos ?? '');
  const [telefono, setTelefono] = useState(perfil.contacto?.telefono ?? '');
  const [mostrarTelefono, setMostrarTelefono] = useState(
    perfil.contacto?.mostrar_telefono ?? false
  );
  const [negocio, setNegocio] = useState<EstadoNegocio>(() =>
    estadoDesdeNegocio(perfil.negocio)
  );

  const [fotoBruto, setFotoBruto] = useState<File | null>(null);
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const [logoArchivo, setLogoArchivo] = useState<File | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);

  const [visor, setVisor] = useState<{ src: string; alt: string } | null>(
    null
  );
  const [guardando, setGuardando] = useState(false);
  // Solo los errores de validación se quedan pegados al formulario. Los avisos
  // de guardado y los fallos del backend salen como alertas flotantes.
  const [error, setError] = useState<string | null>(null);

  const urlFotoLocal = useUrlArchivo(fotoArchivo);
  const urlLogoLocal = useUrlArchivo(logoArchivo);

  const esNegocio = perfil.tipo_cuenta === 'NEGOCIO';
  const iniciales =
    ((perfil.nombres ?? '')[0] ?? '') +
      ((perfil.apellidos ?? '')[0] ?? '') || 'BK';

  const fotoServidor = urlCompleta(
    perfil.foto_perfil_url ?? perfil.foto_perfil ?? sesion.usuario.foto_perfil
  );
  const fotoVisible = quitarFoto ? null : (urlFotoLocal ?? fotoServidor);
  const logoServidor = urlCompleta(
    perfil.negocio?.logo_url_completa ?? perfil.negocio?.logo_url
  );
  const logoVisible = quitarLogo ? null : (urlLogoLocal ?? logoServidor);

  const elegirFoto = (archivo: File | null) => {
    setErrorFoto(null);
    setFotoBruto(null);
    if (!archivo) return;
    if (!EXTENSIONES_IMAGEN.test(archivo.name)) {
      setErrorFoto('La foto debe ser JPG, JPEG, PNG, WEBP o AVIF.');
      return;
    }
    if (archivo.size > MAX_IMAGEN_BYTES) {
      setErrorFoto('La foto no puede superar los 8 MB.');
      return;
    }
    setFotoBruto(archivo);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);

    if (!nombres.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    // No se puede encender la casilla sin un número: quedaría un perfil que
    // promete contacto y no tiene a quién darlo. Se avisa aquí y no esperando un
    // 422, que además dejaría el error en una parte de la pantalla lejana.
    // Para un negocio vale el suyo, que ya se escribió al registrarse.
    const numeroDelNegocio =
      esNegocio && (perfil.negocio?.whatsapp ?? perfil.negocio?.telefono ?? '');
    if (mostrarTelefono && !telefono.trim() && !numeroDelNegocio) {
      setError(
        esNegocio
          ? 'Agrega el teléfono de tu negocio en "Datos del negocio" antes de publicarlo en los anuncios.'
          : 'Antes de publicarlo necesitas un número de teléfono.'
      );
      return;
    }
    if (telefono.trim() && !PATRON_TELEFONO.test(telefono.trim())) {
      setError('El teléfono no parece un número válido. Puedes escribir +593 99 123 4567.');
      return;
    }

    let cambios = {
      ...cambiosPersonales(perfil, nombres, apellidos),
      ...cambiosContacto(perfil, telefono, mostrarTelefono),
    };

    if (esNegocio) {
      const problema = validarNegocio(negocio);
      if (problema) {
        setError(problema);
        return;
      }
      cambios = { ...cambios, ...cambiosNegocio(negocio, perfil.negocio) };
    }

    const imagenes: ImagenesPerfil = {};
    if (fotoArchivo) imagenes.fotoPerfil = fotoArchivo;
    else if (quitarFoto && fotoServidor) imagenes.eliminarFotoPerfil = true;
    if (esNegocio) {
      if (logoArchivo) imagenes.logo = logoArchivo;
      else if (quitarLogo && logoServidor) imagenes.eliminarLogo = true;
    }

    if (!Object.keys(cambios).length && !Object.keys(imagenes).length) {
      notificarAviso('No hay cambios por guardar.');
      return;
    }

    setGuardando(true);
    try {
      const respuesta = await actualizarPerfil(cambios, imagenes);
      onPerfilActualizado(respuesta.usuario);
      // Lo que se ve ahora es lo que devolvió el servidor, no lo que se escribió:
      // el backend guarda el teléfono normalizado y si no se adopta aquí, el
      // campo se quedaría mostrando una forma que ya no es la guardada.
      if (respuesta.usuario.contacto) {
        setTelefono(respuesta.usuario.contacto.telefono ?? '');
        setMostrarTelefono(respuesta.usuario.contacto.mostrar_telefono);
      }
      setFotoArchivo(null);
      setQuitarFoto(false);
      setLogoArchivo(null);
      setQuitarLogo(false);
      notificarExito(respuesta.mensaje || 'Perfil actualizado.');
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo guardar el perfil.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const soloGoogle =
    perfil.proveedores.some((p) => /google/i.test(p)) &&
    !perfil.proveedores.some((p) => /correo/i.test(p));

  return (
    <MarcoApp titulo="Configuración">
      {fotoBruto && (
        <RecortadorImagen
          imagen={fotoBruto}
          onRecortada={(archivo) => {
            setFotoArchivo(archivo);
            setQuitarFoto(false);
            setErrorFoto(null);
            setFotoBruto(null);
          }}
          onCancelar={() => setFotoBruto(null)}
        />
      )}

      {/* Una sola foto: la galería no enseña flechas ni contador, que es justo lo
          que se necesita aquí. */}
      {visor && (
        <VisorGaleria
          fotos={[visor.src]}
          indice={0}
          alt={visor.alt}
          onCambiar={() => {}}
          onCerrar={() => setVisor(null)}
        />
      )}

      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted">
          Actualiza tu foto, tus datos y, si tu cuenta es de negocio, la
          información con la que te encuentran.
        </p>

        <div
          role="tablist"
          aria-label="Secciones de configuración"
          className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1"
        >
          {PESTANAS.map((item) => {
            const activo = pestana === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`pestana-${item.id}`}
                aria-selected={activo}
                aria-controls={`panel-${item.id}`}
                onClick={() => setPestana(item.id)}
                className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors duration-200 sm:px-3.5 ${
                  activo ? 'text-white' : 'text-muted hover:bg-background hover:text-foreground'
                }`}
              >
                {/* El fondo oscuro se desliza hasta la pestaña elegida. */}
                {activo && (
                  <m.span
                    layoutId="pestana-configuracion"
                    transition={RESORTE}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg bg-foreground"
                  />
                )}
                <span className="relative">{item.icono}</span>
                <span className="relative">{item.label}</span>
                {item.id === 'soporte' && soporteSinLeer > 0 && !activo && (
                  <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-carbon tabular-nums">
                    {soporteSinLeer > 9 ? '9+' : soporteSinLeer}
                    <span className="sr-only"> sin leer</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {pestana === 'privacidad' ? (
          <div
            role="tabpanel"
            id="panel-privacidad"
            aria-labelledby="pestana-privacidad"
            className="animate-bkn-in mt-6"
          >
            <PanelPrivacidad perfil={perfil} onPerfilActualizado={onPerfilActualizado} />
          </div>
        ) : pestana === 'notificaciones' ? (
          <div
            role="tabpanel"
            id="panel-notificaciones"
            aria-labelledby="pestana-notificaciones"
            className="animate-bkn-in mt-6 max-w-[760px]"
          >
            {/* El mismo panel que "Ajustes" en Notificaciones: un solo componente,
                así los dos sitios muestran y guardan lo mismo. */}
            <AjustesNotificaciones />
          </div>
        ) : pestana === 'soporte' ? (
          <div
            role="tabpanel"
            id="panel-soporte"
            aria-labelledby="pestana-soporte"
            className="animate-bkn-in mt-6 max-w-[760px]"
          >
            {/* La misma conversación que el botón flotante de escritorio. */}
            <div className="h-[min(620px,calc(100svh-17rem))] min-h-[420px] overflow-hidden rounded-2xl border border-border bg-white">
              <ChatSoporte />
            </div>
            <p className="mt-3 px-1 text-[12.5px] leading-relaxed text-muted">
              Para reportar un anuncio concreto, usa también <strong className="font-semibold text-foreground">Denunciar</strong>{' '}
              dentro del anuncio: llega directo a moderación.
            </p>
          </div>
        ) : pestana === 'seguridad' ? (
          <div
            role="tabpanel"
            id="panel-seguridad"
            aria-labelledby="pestana-seguridad"
            className="animate-bkn-in mt-6"
          >
            <PanelContrasena onTokens={onSesionRenovada} soloGoogle={soloGoogle} />
          </div>
        ) : (
          <form
            role="tabpanel"
            id="panel-perfil"
            aria-labelledby="pestana-perfil"
            onSubmit={guardar}
            noValidate
            className="animate-bkn-in mt-6 space-y-5"
          >
            {error && (
              <div className={alertaError} role="alert">
                <IconoAlerta />
                <span>{error}</span>
              </div>
            )}

            <section className={`${tarjeta} mt-5`}>
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                Foto de perfil
              </h2>
              <p className="mt-1.5 text-[13px] text-muted">
                Tócala para verla en grande.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-5">
                {fotoVisible ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVisor({
                        src: fotoVisible,
                        alt: `Foto de perfil de ${perfil.nombres}`.trim(),
                      })
                    }
                    aria-label="Ver la foto de perfil en grande"
                    className="group relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-[0_1px_3px_rgba(31,41,55,0.2)] transition-transform hover:scale-[1.02] sm:size-28"
                  >
                    <img
                      src={fotoVisible}
                      alt="Foto de perfil"
                      className="size-full object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-carbon/0 text-white opacity-0 transition-all group-hover:bg-carbon/45 group-hover:opacity-100">
                      <span className="rounded-full bg-carbon/60 px-2.5 py-1 text-[11px] font-medium">
                        Ver grande
                      </span>
                    </span>
                  </button>
                ) : (
                  <span className="grid size-24 shrink-0 place-items-center rounded-full border border-dashed border-border bg-background text-[26px] font-semibold text-muted sm:size-28">
                    {quitarFoto ? 'Sin foto' : iniciales}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SelectorImagen
                      etiqueta={fotoArchivo ? 'Cambiar de nuevo' : undefined}
                      deshabilitado={guardando}
                      onElegir={elegirFoto}
                    />

                    {(fotoVisible || fotoArchivo) && (
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => {
                          if (fotoArchivo) setFotoArchivo(null);
                          setQuitarFoto(true);
                          setErrorFoto(null);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-[13.5px] font-medium text-danger-deep transition-colors hover:border-danger/40 disabled:opacity-50"
                      >
                        <IconoPapelera />
                        Quitar foto
                      </button>
                    )}
                  </div>

                  <p className="mt-2.5 text-[12px] text-muted">
                    {fotoArchivo
                      ? 'Guarda los cambios para aplicar la foto nueva.'
                      : quitarFoto
                        ? 'Se quitará al guardar los cambios.'
                        : 'JPG, PNG, WEBP o AVIF · máximo 8 MB.'}
                  </p>

                  {errorFoto && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-danger-deep">
                      <IconoAlerta />
                      {errorFoto}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className={tarjeta}>
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                Datos personales
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className={etiqueta}>Nombres *</span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Nicolás"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    disabled={guardando}
                    className={inputBase}
                  />
                </label>
                <label className="block">
                  <span className={etiqueta}>
                    Apellidos{' '}
                    <span className="font-normal text-muted/70">(opcional)</span>
                  </span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Lara Caicedo"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    disabled={guardando}
                    className={inputBase}
                  />
                </label>
                <label className="block">
                  <span className={etiqueta}>Correo</span>
                  <input
                    type="email"
                    value={perfil.correo}
                    readOnly
                    disabled
                    className={`${inputBase} cursor-not-allowed bg-background`}
                  />
                  <span className="mt-1 block text-[11px] text-muted/70">
                    Por seguridad el correo no se cambia aquí.
                  </span>
                </label>
                <div>
                  <span className={etiqueta}>Tipo de cuenta</span>
                  <div className="flex h-11 items-center rounded-lg border border-border bg-background px-3.5 text-[15px] text-foreground">
                    {perfil.tipo_cuenta === 'NEGOCIO' ? 'Negocio' : 'Persona'}
                  </div>
                  <span className="mt-1 block text-[11px] text-muted/70">
                    No se puede cambiar una cuenta ya creada.
                  </span>
                </div>
              </div>
            </section>

            {esNegocio ? (
              <PanelContacto
                telefono={null}
                delNegocio={perfil.negocio?.whatsapp ?? perfil.negocio?.telefono}
                guardando={guardando}
                mostrando={mostrarTelefono}
                onCambiarMostrando={setMostrarTelefono}
              />
            ) : (
              <PanelContacto
                telefono={telefono}
                onTelefono={setTelefono}
                guardando={guardando}
                mostrando={mostrarTelefono}
                onCambiarMostrando={setMostrarTelefono}
              />
            )}

            {esNegocio && (
              <section className={tarjeta}>
                <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                  Datos del negocio
                </h2>
                <p className="mt-1.5 text-[13px] text-muted">
                  Solo se envían los campos que cambies.
                </p>

                <div className="mt-6">
                  <FormularioNegocio
                    estado={negocio}
                    onCambio={(cambios) =>
                      setNegocio((anterior) => ({ ...anterior, ...cambios }))
                    }
                    logoArchivo={logoArchivo}
                    onLogoArchivo={(archivo) => {
                      setLogoArchivo(archivo);
                      if (archivo) setQuitarLogo(false);
                    }}
                    logoVisible={logoVisible}
                    onQuitarLogo={() => {
                      setLogoArchivo(null);
                      setQuitarLogo(true);
                    }}
                    onAmpliar={() => {
                      if (!logoVisible) return;
                      setVisor({ src: logoVisible, alt: 'Logo del negocio' });
                    }}
                    deshabilitado={guardando}
                  />
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-4 pb-10">
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-[15px] font-medium text-foreground transition-colors hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
              >
                {guardando ? <BaknazoLoader tamano="boton" mensaje="Guardando" /> : 'Guardar cambios'}
              </button>
              <p className="text-[12.5px] text-muted">
                Los cambios se aplican a tu cuenta al instante.
              </p>
            </div>
          </form>
        )}
      </div>
    </MarcoApp>
  );
}
