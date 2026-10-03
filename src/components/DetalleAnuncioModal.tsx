import { useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { SALIDA } from '../lib/movimiento';
import PulgarAnimado from './PulgarAnimado';
import VisorGaleria from './VisorGaleria';
import BaknazoLoader from './BaknazoLoader';
import { IconoBandera, IconoBocadillo, IconoCerrar, IconoCheck, IconoChevron, IconoCompartir, IconoGuardar, IconoLapiz, IconoPulgar, IconoTelefono } from './Iconos';
import { obtenerAnuncio, registrarContacto } from '../api/anuncios';
import { useAbrirChat } from '../lib/abrirChat';
import { useNavegacion } from '../lib/navegacion';
import DenunciarAnuncio from './DenunciarAnuncio';
import { mensajeDeMotivo } from '../lib/contacto';
import { useBloqueoScroll } from '../lib/bloqueoScroll';
import BloquePostulacion from './BloquePostulacion';
import NoEncontrado from './NoEncontrado';
import { useNavigate } from 'react-router-dom';
import type { Pilar } from '../lib/pilares';
import { notificarError, notificarExito, notificarInfo } from '../lib/notificar';
import { urlCompleta } from '../lib/imagen';
import { ESTILO_PILAR } from '../lib/pilares';
import {
  formatearFecha,
  formatearPrecio,
  formatearUbicacion,
  inicialesDe,
  plural,
  resumenDeLikes,
  TONO_ESTADO,
  valorLegible,
  type TonoEstado,
} from '../lib/tarjeta';
import { DETALLE_POR_PILAR, ETIQUETA_DETALLE } from '../lib/formularioAnuncio';
import type { Anuncio, RespuestaContacto } from '../types/anuncio';
import type { SemillaPerfil } from '../types/perfil';

interface Props {
  /** Anuncio a abrir. Cambiarlo recarga la ficha sin cerrar el modal. */
  id: number;
  onCerrar: () => void;
  /**
   * Callback de edición. Solo lo pasan las pantallas desde donde se puede
   * editar; si no viene, la ficha no ofrece el botón aunque el anuncio sea
   * propio (nadie sabría a dónde ir después).
   */
  onEditar?: (id: number) => void;
  /** El feed lo sabe y el detalle no: la distancia la calcula el listado. */
  distanciaKm?: number | null;
  /** Estado ya traducido por quien abre la ficha; en el feed no aplica. */
  estado?: { etiqueta: string; tono: TonoEstado } | null;
  /**
   * Guardar también desde la ficha. Lo decide quien la abre: la lista es la que
   * sabe qué anuncios están guardados, así que le pasa el estado y el callback.
   * Sin `onAlternarGuardado` la ficha no muestra el botón, porque un botón de
   * guardar que no guarda sería peor que no tenerlo.
   */
  onAlternarGuardado?: () => void;
  guardado?: boolean;
  /**
   * Like y venta también los decide quien abre la ficha, por el mismo motivo que
   * los guardados: la lista es la que sabe el estado y la que puede reintentar
   * la llamada. Sin estos callbacks la ficha no pinta los botones, porque un
   * pulgar o una etiqueta que no guardan nada serían peores que no mostrarlos.
   */
  /** Resuelve `false` si no se pudo guardar, para revertir el cambio pintado. */
  /**
   * Recibe si el like queda puesto (`true`) o quitado. El feed ya lo sabe por su
   * lista; el perfil no trae el estado de cada anuncio y lo necesita.
   */
  onAlternarMeGusta?: (dar: boolean) => Promise<boolean> | boolean;
  meGusta?: boolean;
  likes?: number;
  /**
   * Abre el perfil de quien publicó.
   *
   * Recibe la semilla y no solo el id porque la ficha se usa también para un
   * anuncio recién directado por un enlace, donde no hay lista detrás: con el
   * recorte del anuncio, el perfil se puede pintar con la tarjeta real aunque no
   * se sepa de dónde se vino.
   */
  onAbrirPerfil?: (semilla: SemillaPerfil) => void;
  onCambiarVendido?: (vendido: boolean) => void;
  vendido?: boolean;
  /** Abierta desde el propio chat: "Enviar mensaje" no tiene a dónde llevar. */
  sinChat?: boolean;
}

/**
 * Los textos de los valores de `detalle`, las iniciales y `plural` viven en
 * `lib/tarjeta`: la tarjeta en vista de lista los necesita igual que la ficha y
 * duplicarlos harían que un valor nuevo se mostrara crudo en un sitio y
 * legible en el otro.
 */
/** Una línea de la ficha: etiqueta arriba, valor abajo. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2">
      <dt className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-foreground">{valor}</dd>
    </div>
  );
}

/**
 * La publicación completa, en un modal sobre la lista de la que se abrió.
 *
 * Es la pantalla que responde "¿quién lo puso y qué es exactamente?", la
 * pregunta que la tarjeta del feed no puede contestar con seis campos. Al
 * abrirse sobre el feed o sobre "mis anuncios" se conserva el contexto de
 * dónde se vino —igual que hace Facebook— y por eso no es una vista con
 * nombre: no se recuerda con el F5, porque recargar devuelve a la lista, que
 * es donde se sigue trabajando.
 */
export default function DetalleAnuncioModal({
  id,
  onCerrar,
  onEditar,
  distanciaKm = null,
  estado = null,
  onAlternarGuardado,
  guardado = false,
  onAlternarMeGusta,
  meGusta: meGustaProp,
  likes: likesProp,
  onAbrirPerfil,
  onCambiarVendido,
  vendido: vendidoProp,
  sinChat = false,
}: Props) {
  const { abrir: abrirChat, abriendo: abriendoChat } = useAbrirChat();
  const { sesion, irAlLogin } = useNavegacion();
  const [denunciando, setDenunciando] = useState(false);
  const [cargado, setCargado] = useState<Anuncio | null>(null);
  const [fallo, setFallo] = useState<'sin-conexion' | 'error' | 'ajeno' | null>(null);
  const [indice, setIndice] = useState(0);
  const [visor, setVisor] = useState(false);
  /**
   * El like y la venta los trae quien abre la ficha (el feed o "mis anuncios"),
   * no esta pantalla. Se copian a un estado local para poder pintar el cambio al
   * instante: la llamada al backend va por el callback del padre, y cuando la
   * respuesta llegue, el padre vuelve a pasar las props y los dos valores se
   * igualan. Si solo se leyera la prop, el pulgar no se movería hasta que
   * terminara la red, que se siente como app colgada.
   */
  const [meGustaLocal, setMeGustaLocal] = useState(meGustaProp ?? false);
  const [likesLocal, setLikesLocal] = useState(likesProp ?? 0);
  const [vendidoLocal, setVendidoLocal] = useState(vendidoProp ?? false);

  /**
   * Cuándo se suelta el estado local para volver a los datos de fuera.
   *
   * Las props mandan sobre la respuesta propia: la ficha pide el anuncio al
   * abrirse, así que `cargado` es una foto del momento en que se abrió. Si al
   * desmarcar el pulgar se copiaba `cargado.meGusta`, esa foto vieja pisaba el
   * like recién guardado, el botón se volvía a pintar vacío y solo se veía bien
   * al recargar. El detalle solo rellena huecos: si la lista ya trae el dato, es
   * el de la lista, y siempre más reciente.
   *
   * Se ajusta en el render y no en un efecto, como el resto del archivo: en un
   * efecto habría un instante con los dos valores a la vez, y React avisa de eso
   * porque encadena otro render.
   */
  const likesFuera = meGustaProp == null && likesProp == null ? (cargado?.likes ?? null) : null;
  const meGustaFuera = meGustaProp ?? (likesProp == null ? (cargado?.meGusta ?? false) : false);
  const [anclado, setAnclado] = useState<{ id: number; likes: number | null; meGusta: boolean }>({
    id,
    likes: likesFuera,
    meGusta: meGustaFuera,
  });
  if (
    anclado.id !== id ||
    anclado.likes !== likesFuera ||
    anclado.meGusta !== meGustaFuera
  ) {
    setAnclado({ id, likes: likesFuera, meGusta: meGustaFuera });
    if (likesFuera != null) setLikesLocal(likesFuera);
    setMeGustaLocal(meGustaFuera);
  }
  /**
   * El número de quien publicó, y si ya se pidió.
   *
   * Vive aquí y no en el listado porque es lo único de la ficha que necesita
   * una llamada: se pide al pulsar, no al abrir. Si quien lo publicó decidió
   * no compartirlo, la ficha ni siquiera enseña el botón.
   */
  const [contacto, setContacto] = useState<RespuestaContacto | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  /* ---------- Carga ---------- */

  useEffect(() => {
    let vivo = true;

    obtenerAnuncio(id)
      .then((respuesta) => {
        if (vivo) setCargado(respuesta.anuncio);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        const estado = (e as { status?: number }).status;
        setFallo(estado === 403 || estado === 404 ? 'ajeno' : estado ? 'error' : 'sin-conexion');
      });

    return () => {
      vivo = false;
    };
  }, [id]);

  /* ---------- Datos derivados ---------- */

  /**
   * Al cambiar de anuncio se limpia lo que era del anterior. Sin esto, recorrer
   * dos anuncios seguidos dejaba el teléfono del primero puesto en el segundo.
   *
   * Se ajusta durante el render y no en un efecto a propósito: en un efecto
   * habría un instante, entre painted y pintado, en el que la ficha muestra el
   * teléfono del anuncio anterior.
   */
  const [idVisto, setIdVisto] = useState(id);
  if (id !== idVisto) {
    setIdVisto(id);
    setContacto(null);
    setPidiendo(false);
    setIndice(0);
    // El like, el total y la venta son del anuncio anterior: si no se limpian,
    // abrir otro announcement dejaría el pulgar y la etiqueta de "Vendido" del
    // primero, que es peor que la tarjeta: aquí se ve el número al lado.
    setMeGustaLocal(meGustaProp ?? false);
    setLikesLocal(likesProp ?? 0);
    setVendidoLocal(vendidoProp ?? false);
  }

  /**
   * El anuncio se muestra solo si es el que se pidió. Si el id cambia mientras
   * se carga el nuevo, durante un instante queda el anterior en el estado: sin
   * esta comprobación se vería en la ficha un anuncio que nadie abrió ahí.
   */
  const anuncio = cargado?.id === id ? cargado : null;
  const fotos = anuncio?.fotos ?? [];
  const fotoActual = fotos[indice] ?? fotos[0];
  const estilo = anuncio ? ESTILO_PILAR[anuncio.pilar] : null;
  const puedeEditar = Boolean(onEditar) && Boolean(anuncio?.esMio);

  /**
   * El total que se muestra sale del estado local, que se sincroniza con las props
   * y con la respuesta de la ficha más abajo.
   *
   * Antes esto era `likesLocal || likesProp || anuncio?.likes || 0`, y con `||`
   * un total de cero se tomaba por "aún no sé": al quitar el like el número se
   * iba a 0 pero la cadena se saltaba al 1 de las props y la cuenta se quedaba
   * clavada en 1. Cero sí es un valor, y por eso el estado local manda.
   */
  const reacciones = likesLocal;

  /**
   * El recorte de este anuncio para la pantalla de perfil.
   *
   * La clave de la URL es `autor.id` cuando el backend lo manda y el id del
   * anuncio mientras no. Los dos son enteros, así que la ruta los acepta igual y
   * el cambio no obliga a tocar la URL ni el perfil.
   */
  const semilla: SemillaPerfil | null = anuncio
    ? {
        clavePerfil: anuncio.autor.id ?? String(anuncio.id),
        anuncioId: anuncio.id,
        titulo: anuncio.titulo,
        precio: formatearPrecio(anuncio.precio, anuncio.pilar),
        ubicacion: anuncio.ubicacion,
        pilar: anuncio.pilar,
        foto: (fotoActual ?? null)?.url ?? null,
        publicadoEn: anuncio.publicadoEn,
        likes: reacciones,
        vistas: anuncio.vistas,
        esNegocio: anuncio.autor.esNegocio,
        nombreAutor: anuncio.autor.nombre,
      }
    : null;

  const abrirPerfil = () => {
    if (semilla) onAbrirPerfil?.(semilla);
  };

  /**
   * El enlace solo existe si hay a dónde ir.
   *
   * En "Mis anuncios" la ficha se usa sin `onAbrirPerfil`: ahí el autor eres tú y
   * un enlace que no hace nada es peor que no dibujarlo.
   */
  const puedeVerPerfil = Boolean(onAbrirPerfil) && semilla != null;

  /** El like solo existe si hay alguien a quien dárselo. */
  /**
   * Si ya se vendió. Quien abre la ficha desde "Mis anuncios" lo controla (lo
   * puede cambiar); en el resto de casos manda lo que dice el servidor. Antes
   * se ignoraba el dato del servidor, y un enlace guardado a algo ya vendido se
   * abría como si siguiera disponible.
   */
  const vendido = vendidoProp !== undefined ? vendidoLocal : Boolean(anuncio?.vendido);
  const puedeDarLike = Boolean(onAlternarMeGusta) && !anuncio?.esMio && !vendido;
  const meGusta = meGustaLocal;

  /**
   * Compartir o copiar el enlace de esta publicación.
   *
   * El enlace se construye aquí y no se lee de la barra de direcciones. La ficha
   * también se abre sobre el feed, y en ese momento la URL todavía dice `/anuncios`:
   * copiar `location.href` mandaría a quien lo recibiera al listado, no al
   * anuncio. Con `/anuncio/{id}` el enlace siempre lleva a la publicación.
   *
   * Se intenta el menú de compartir del sistema, que en el móvil da la opción de
   * WhatsApp y de las apps instaladas; si no está, se copia al portapapeles.
   */
  const compartir = async () => {
    const enlace = `${window.location.origin}/anuncio/${id}`;
    const texto = anuncio?.titulo ? `${anuncio.titulo} — Baknazo` : 'Mira esto en Baknazo';

    if (navigator.share) {
      try {
        await navigator.share({ title: texto, url: enlace });
        return;
      } catch (e) {
        // Si la persona cierra el menú sin compartir, no es un fallo ni hay que
        // copiatelo por la espalda: solo se avisa si no se pudo compartir.
        if ((e as Error)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(enlace);
      notificarExito('Enlace copiado. Ya puedes pegarlo donde quieras.');
    } catch {
      // El portapapeles se puede negar (permisos, http sin contexto seguro).
      notificarInfo(`Copia este enlace: ${enlace}`);
    }
  };

  /**
   * Dar o quitar el like se pinta al instante y avisa al padre.
   *
   * El valor local es el que ve la persona y el padre es quien llama a la API.
   * Si la llamada falla, el padre devuelve `false` y aquí se deshace el cambio:
   * el pulgar tiene que decir lo que está guardado, no lo que se intentó.
   */
  /** Cerrojo síncrono: dos toques seguidos no deben salir como dos peticiones. */
  const likeEnCurso = useRef(false);

  const alternarMeGusta = async () => {
    if (likeEnCurso.current) return;
    likeEnCurso.current = true;
    const anterior = meGustaLocal;
    const siguiente = !anterior;
    setMeGustaLocal(siguiente);
    setLikesLocal((total) => Math.max(0, total + (siguiente ? 1 : -1)));
    const ok = await onAlternarMeGusta?.(siguiente);
    if (ok === false) {
      setMeGustaLocal(anterior);
      setLikesLocal((total) => Math.max(0, total + (siguiente ? -1 : 1)));
    }
    likeEnCurso.current = false;
  };

  /**
   * Marcar como vendido, o deshacerlo.
   *
   * Es un PATCH como el de pausar y va por el padre, igual que el like. Aquí solo
   * se refleja el cambio para que la etiqueta no espere a la red.
   */
  const alternarVendido = () => {
    const siguiente = !vendidoLocal;
    setVendidoLocal(siguiente);
    onCambiarVendido?.(siguiente);
  };

  /**
   * El botón aparece solo si el backend dice que hay número detrás.
   *
   * Es el backend quien lo sabe (tiene el número, el estado y la decisión del
   * dueño), y no se deduce aquí: adivinar mal y enseñar un botón que después
   * resulta inútil es peor que no enseñarlo.
   */
  const puedeVerTelefono = Boolean(
    anuncio && !anuncio.esMio && anuncio.telefonoVisible && !vendido
  );

  /**
   * El dueño de un anuncio con el número habilitado.
   *
   * No puede ver el botón —no tiene a quién llamar— pero sin algo en su lugar la
   * barra desaparece entera y parece que la opción no se guardó. Publicar, abrir
   * el anuncio y no ver nada es indistinguible de un fallo, así que se le dice
   * explícitamente que sí va a salir.
   *
   * En un anuncio vendido no se dice nada: el texto "quien abra tu anuncio verá
   * un botón" sería falso, porque ya no lo verá. Se oculta el bloque entero en
   * lugar de corregir la frase, porque no hay nada que colocar en su sitio.
   */
  const esDueñoConContacto = Boolean(
    anuncio && anuncio.esMio && anuncio.mostrarTelefono && !vendido
  );
  /**
   * Escribirle a quien publicó. Solo productos y servicios a la venta: en una
   * vacante se habla con la postulación, y lo vendido ya no se negocia.
   */
  const puedeEscribir = Boolean(
    !sinChat && anuncio && !anuncio.esMio && anuncio.pilar !== 'empleo' && anuncio.estado === 'PUBLICADO' && !vendido
  );
  const telefono = contacto?.disponible ? contacto : null;

  const datos = [];
  if (anuncio) {
    const detalle = anuncio.detalle as unknown as Record<string, string | null | undefined>;
    for (const clave of DETALLE_POR_PILAR[anuncio.pilar]) {
      const valor = detalle[clave];
      if (valor) datos.push({ etiqueta: ETIQUETA_DETALLE[clave], valor: valorLegible(valor) });
    }
    // La zona de cobertura solo la traen los servicios, y solo si se llenó.
    const zona = detalle.zonaCobertura;
    if (zona) datos.push({ etiqueta: 'Zona de cobertura', valor: zona });
  }

  /* ---------- Contacto ---------- */

  const pedirTelefono = async () => {
    if (pidiendo || telefono) return;
    // Sin cuenta no se revela ningún número (el backend tampoco lo daría).
    if (!sesion) {
      irAlLogin();
      return;
    }
    setPidiendo(true);
    try {
      const respuesta = await registrarContacto(id);
      // Se confía en el backend, pero no a ciegas: si dice que hay número y no
      // manda ninguno, es mejor mostrar el motivo que pintar un hueco vacío
      // donde debería estar un teléfono.
      if (respuesta.disponible && !respuesta.telefono) {
        setContacto({ disponible: false, motivo: 'SIN_NUMERO' });
      } else {
        setContacto(respuesta);
      }
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo pedir el número de contacto.'
      );
    } finally {
      setPidiendo(false);
    }
  };

  /* ---------- Teclado, foco y scroll ---------- */

  const mover = useCallback(
    (paso: number, total: number) => {
      if (total < 2) return;
      setIndice((actual) => (actual + paso + total) % total);
    },
    []
  );

  /**
   * Si el visor está abierto se lee de aquí y no del closure del efecto.
   *
   * Antes `visor` estaba en las dependencias del efecto del teclado, así que al
   * abrir o cerrar el visor se re-suscribía el listener entero. Peor: el mismo
   * efecto bloqueaba el scroll, de modo que cada reejecución desbloqueaba y
   * volvía a bloquear el body, y en móvil eso se nota como un tirón.
   */
  const visorRef = useRef(visor);
  useEffect(() => {
    visorRef.current = visor;
  }, [visor]);
  const denunciandoRef = useRef(denunciando);
  useEffect(() => {
    denunciandoRef.current = denunciando;
  }, [denunciando]);

  /** El bloqueo va aparte para que nada más pueda reejecutarlo. */
  useBloqueoScroll();

  useEffect(() => {
    panel.current?.focus();

    const alTeclear = (evento: KeyboardEvent) => {
      // Con el formulario de denuncia abierto encima, el teclado es suyo: si no,
      // Escape cerraba también la ficha y las flechas cambiaban la foto.
      if (denunciandoRef.current) return;
      // Escribiendo en un campo, las flechas mueven el cursor, no las fotos.
      const enCampo = evento.target instanceof HTMLElement && evento.target.closest('input, textarea, select');
      if (enCampo && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) return;
      if (evento.key === 'Escape') {
        if (visorRef.current) setVisor(false);
        else onCerrar();
        return;
      }
      if (evento.key === 'ArrowRight') mover(1, fotos.length);
      if (evento.key === 'ArrowLeft') mover(-1, fotos.length);
      if (evento.key !== 'Tab' || !panel.current) return;

      // Trampa de foco: sin ella el Tab se va a la lista que quedó detrás.
      const focos = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [fotos.length, mover, onCerrar]);

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4">
      <m.button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar la publicación"
        className="absolute inset-0 cursor-default bg-carbon/55 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />

      {/* La ficha entra subiendo un poco y creciendo apenas: se nota que se
          abre sobre la lista, sin distraer. */}
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-titulo"
        tabIndex={-1}
        initial={{ opacity: 0, y: 28, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: SALIDA }}
        className="relative flex max-h-[94vh] w-full max-w-[1060px] flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-[0_24px_64px_-24px_rgba(31,41,55,0.5)] outline-none sm:max-h-[90vh] sm:rounded-2xl lg:max-h-[86vh] lg:flex-row"
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-20 grid size-9 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-foreground"
        >
          <IconoCerrar />
        </button>

        {fallo ? (
          <div className="flex w-full items-center justify-center px-6 py-12">
            <NoEncontrado
              compacto
              codigo={fallo === 'ajeno' ? '404' : undefined}
              titulo={
                fallo === 'ajeno'
                  ? 'Esta publicación ya no existe'
                  : 'No pudimos abrir la publicación'
              }
              texto={
                fallo === 'ajeno'
                  ? 'Quien la publicó la eliminó o la pausó, o el enlace está mal escrito.'
                  : fallo === 'sin-conexion'
                    ? 'Revisa tu conexión e inténtalo otra vez.'
                    : 'Vuelve a intentarlo en un momento.'
              }
            />
          </div>
        ) : !anuncio || !estilo ? (
          <div className="flex w-full items-center justify-center py-20">
            <BaknazoLoader mensaje="Abriendo la publicación" />
          </div>
        ) : (
          <>
            {/* ---------- Galería ---------- */}
            <div className="flex shrink-0 flex-col border-b border-border lg:w-[56%] lg:border-r lg:border-b-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setVisor(true)}
                  disabled={!fotoActual}
                  aria-label={`Ver ${fotoActual ? `la foto ${indice + 1} de ${fotos.length}` : 'la portada'} en pantalla completa`}
                  className="block w-full cursor-zoom-in"
                >
                  {fotoActual ? (
                    <img
                      src={urlCompleta(fotoActual.url) ?? ''}
                      alt={`Foto ${indice + 1} de ${anuncio.titulo}`}
                      width={fotoActual.ancho}
                      height={fotoActual.alto}
                      className="aspect-[4/3] w-full bg-background object-contain"
                    />
                  ) : (
                    <span
                      className={`relative block aspect-[4/3] w-full ${estilo.fondo}`}
                      style={{
                        backgroundImage: `repeating-linear-gradient(135deg, ${estilo.rayas} 0 10px, transparent 10px 22px)`,
                      }}
                    >
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="rounded-[6px] bg-carbon/25 px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                          sin fotos
                        </span>
                      </span>
                    </span>
                  )}
                </button>

                {fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => mover(-1, fotos.length)}
                      aria-label="Foto anterior"
                      className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-carbon shadow-[0_1px_3px_rgba(31,41,55,0.18)] transition-colors hover:bg-white"
                    >
                      <IconoChevron izquierda />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(1, fotos.length)}
                      aria-label="Foto siguiente"
                      className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-carbon shadow-[0_1px_3px_rgba(31,41,55,0.18)] transition-colors hover:bg-white"
                    >
                      <IconoChevron derecha />
                    </button>
                    <span className="absolute right-3 bottom-3 rounded-full bg-carbon/70 px-2.5 py-1 text-[11.5px] font-medium text-white tabular-nums">
                      {indice + 1} / {fotos.length}
                    </span>
                  </>
                )}
              </div>

              {fotos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto px-3 py-3">
                  {fotos.map((foto, i) => (
                    <button
                      key={foto.id}
                      type="button"
                      onClick={() => setIndice(i)}
                      aria-label={`Ver la foto ${i + 1}`}
                      aria-current={i === indice}
                      className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                        i === indice
                          ? 'border-carbon'
                          : 'border-transparent opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={urlCompleta(foto.url) ?? ''}
                        alt=""
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- Ficha ---------- */}
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-center gap-2 pr-10">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${estilo.fondo} ${estilo.tinta}`}
                  >
                    <span className={`size-1.5 rounded-full ${estilo.punto}`} aria-hidden="true" />
                    {estilo.nombre}
                  </span>
                  <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted">
                    {anuncio.categoria.nombre}
                  </span>
                  {/* El estado solo lo aporta quien puede cambiarlo, así que lo
                      manda quien abre la ficha en vez de recalcularlo aquí: en el
                      feed no se pasa porque un anuncio publicado ya se ve. */}
                  {estado && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${TONO_ESTADO[estado.tono]}`}
                    >
                      {estado.etiqueta}
                    </span>
                  )}
                </div>

                {/* Quien llega por un enlace guardado o compartido tiene que
                    saber de entrada que ya no está disponible, antes de
                    ilusionarse con la foto y el precio. */}
                {vendido && !anuncio.esMio && (
                  <AvisoNoDisponible pilar={anuncio.pilar} categoriaId={anuncio.categoria?.id} />
                )}

                <h2
                  id="detalle-titulo"
                  className="mt-3 text-[20px] leading-tight font-semibold tracking-tight text-foreground"
                >
                  {anuncio.titulo}
                </h2>

                <p className="mt-2 text-[24px] leading-none font-bold text-foreground">
                  {formatearPrecio(anuncio.precio, anuncio.pilar)}
                </p>

                <p className="mt-2.5 text-[13px] text-muted">
                  {formatearUbicacion(anuncio.ubicacion, anuncio.sector)}
                  {distanciaKm != null && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="text-success-deep">
                        a {distanciaKm.toLocaleString('es-EC', { maximumFractionDigits: 1 })} km
                        de ti
                      </span>
                    </>
                  )}
                </p>

                {/* La persona que lo publicó: lo que la tarjeta no cabe a mostrar.
                    Foto y nombre abren su perfil, que es la forma de ver el resto
                    de sus anuncios antes de comprometerse a comprar uno. */}
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
                  {urlCompleta(anuncio.autor.foto) ? (
                    <img
                      src={urlCompleta(anuncio.autor.foto) ?? ''}
                      alt=""
                      className="size-11 shrink-0 rounded-full object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-carbon/10 text-[13px] font-semibold text-carbon"
                    >
                      {inicialesDe(anuncio.autor.nombre)}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
                      {puedeVerPerfil ? (
                        <button
                          type="button"
                          onClick={abrirPerfil}
                          className="truncate transition-colors hover:text-accent hover:underline"
                        >
                          {anuncio.autor.nombre}
                        </button>
                      ) : (
                        <span className="truncate">{anuncio.autor.nombre}</span>
                      )}
                      {anuncio.autor.verificado && (
                        <span
                          className="grid size-4 shrink-0 place-items-center rounded-full bg-success text-white"
                          title="Cuenta verificada"
                        >
                          <IconoCheck ok />
                        </span>
                      )}
                      {vendido && (
                        <span className="rounded-full bg-carbon px-2 py-0.5 text-[10.5px] font-semibold text-white uppercase">
                          Vendido
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                      {anuncio.autor.esNegocio && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent-dark">
                          Negocio
                        </span>
                      )}
                      <span>
                        {anuncio.estado === 'PUBLICADO' && anuncio.publicadoEn
                          ? `Publicado el ${formatearFecha(anuncio.publicadoEn)}`
                          : `Creado el ${formatearFecha(anuncio.creadoEn)}`}
                      </span>
                      {puedeVerPerfil && (
                        <button
                          type="button"
                          onClick={abrirPerfil}
                          className="font-medium text-accent hover:underline"
                        >
                          Ver su perfil
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Le gusta y guardar son los dos iconos que Facebook pone en la
                      cabecera de una publicación, y por eso van sin texto: con
                      texto, la fila le come el nombre de quien publicó. El contacto
                      no va aquí sino en la barra de abajo, que es donde cabe un
                      número con sus botones de llamar y WhatsApp. */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {puedeDarLike && (
                    <button
                      type="button"
                      onClick={alternarMeGusta}
                      aria-label={meGusta ? 'Quitar tu me gusta' : 'Me gusta esta publicación'}
                      aria-pressed={meGusta}
                      className={`grid size-9 place-items-center rounded-full transition-colors ${
                        meGusta
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted hover:bg-background hover:text-foreground'
                      }`}
                    >
                      <PulgarAnimado lleno={meGusta} />
                    </button>
                    )}
                    {onAlternarGuardado && (
                      <button
                        type="button"
                        onClick={onAlternarGuardado}
                        data-encima=""
                        aria-label={guardado ? 'Quitar de guardados' : 'Guardar anuncio'}
                        aria-pressed={guardado}
                        className={`grid size-9 place-items-center rounded-full transition-colors ${
                          guardado
                            ? 'bg-accent/10 text-accent'
                            : 'text-muted hover:bg-background hover:text-foreground'
                        }`}
                      >
                        <IconoGuardar lleno={guardado} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={compartir}
                      data-encima=""
                      aria-label="Compartir o copiar el enlace de esta publicación"
                      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
                    >
                      <IconoCompartir />
                    </button>
                  </div>
                </div>

                <section className="mt-6">
                  <h3 className="text-[12px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Descripción
                  </h3>
                  {anuncio.descripcion ? (
                    <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line text-foreground">
                      {anuncio.descripcion}
                    </p>
                  ) : (
                    <p className="mt-2 text-[14px] leading-relaxed text-muted">
                      Quien lo publicó no escribió una descripción.
                    </p>
                  )}
                </section>

                {datos.length > 0 && (
                  <section className="mt-6">
                    <h3 className="text-[12px] font-semibold tracking-[0.14em] text-muted uppercase">
                      Detalles
                    </h3>
                    <dl className="mt-2 grid grid-cols-2 gap-2">
                      {datos.map((dato) => (
                        <Dato key={dato.etiqueta} etiqueta={dato.etiqueta} valor={dato.valor} />
                      ))}
                    </dl>
                  </section>
                )}

                {/* El backend solo manda la nota al dueño, así que si aparece es
                    que el anuncio está esperando un cambio y hay que decirlo. */}
                {anuncio.notasModeracion && (
                  <section className="mt-6 rounded-xl border border-warning/30 bg-warning/8 p-3.5">
                    <h3 className="text-[12px] font-semibold tracking-[0.14em] text-warning-deep uppercase">
                      Nota de moderación
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground">
                      {anuncio.notasModeracion}
                    </p>
                  </section>
                )}

                <p className="mt-6 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                  <span>{plural(anuncio.vistas, 'vista', 'vistas')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{plural(anuncio.contactos, 'contacto', 'contactos')}</span>
                  {anuncio.actualizadoEn !== anuncio.creadoEn && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Actualizado el {formatearFecha(anuncio.actualizadoEn)}</span>
                    </>
                  )}
                </p>
                {denunciando && <DenunciarAnuncio anuncioId={anuncio.id} onCerrar={() => setDenunciando(false)} />}

                {/* Empleo: postularse con el CV, o la bandeja si es tuya. */}
                <BloquePostulacion anuncio={anuncio} />

                {/* La barra de reacciones: el pulgar con cuántos les gustó y la
                    acción debajo. Es la única reacción que existe; comentar y
                    compartir no se inventan aquí porque no hay nada detrás. */}
                <div className="mt-4 border-t border-border pt-3">
                  {/* La cuenta solo aparece si hay likes. Con un cero siempre
                      arriba, la barra de un anuncio recién publicado se ve como si
                      nadie lo hubiera mirado, que no es lo que pasó. */}
                  {reacciones > 0 && (
                    <div className="flex items-center gap-1.5 px-1 pb-2 text-[12.5px] text-muted">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white [&>svg]:size-3">
                        <IconoPulgar lleno />
                      </span>
                      <span>
                        {resumenDeLikes(reacciones, meGusta)}
                      </span>
                    </div>
                  )}

                  {puedeDarLike && (
                    <button
                      type="button"
                      onClick={alternarMeGusta}
                      aria-pressed={meGusta}
                      className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13.5px] font-semibold transition-colors [&>svg]:size-[18px] ${
                        meGusta
                          ? 'text-accent'
                          : 'text-muted hover:bg-background hover:text-foreground'
                      }`}
                    >
                      <PulgarAnimado lleno={meGusta} className="[&>svg]:size-[18px]" />
                      {meGusta ? 'Ya me gusta' : 'Me gusta'}
                    </button>
                  )}
                </div>

                {/* Denunciar: al final, en su propia fila. Se encuentra al terminar
                    de leer, que es cuando uno decide si algo no está bien, sin
                    competir con las acciones de comprar o postularse. */}
                {!anuncio.esMio && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-2.5">
                    <span className="shrink-0 text-muted">
                      <IconoBandera />
                    </span>
                    <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted">
                      ¿Algo no está bien con esta publicación?
                    </p>
                    <button
                      type="button"
                      onClick={() => (sesion ? setDenunciando(true) : irAlLogin())}
                      className="h-8 shrink-0 rounded-lg border border-border bg-white px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:border-danger/40 hover:text-danger-deep"
                    >
                      Denunciar
                    </button>
                  </div>
                )}

                {/* Vendido no es un estado, así que no cabe en la lista de
                    estados de arriba: es una decisión del dueño que se puede
                    deshacer en cualquier momento. Va debajo de la barra de
                    reacciones, separada, porque es una acción de una vez y no un
                    contador. */}
                {anuncio.esMio && onCambiarVendido && (
                  <div className="mt-4 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={alternarVendido}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-[13.5px] font-semibold text-foreground transition-colors hover:bg-background"
                    >
                      <IconoCheck ok={vendido} />
                      {vendido ? 'Volver a publicar' : 'Marcar como vendido'}
                    </button>
                    <p className="mt-1.5 px-1 text-[12px] leading-snug text-muted">
                      {vendido
                        ? 'Dejó de aparecer en el feed. El enlace sigue funcionando.'
                        : 'Deja de aparecer en el feed, pero el enlace sigue funcionando.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Editar y contactar nunca se dan a la vez: lo primero necesita
                  ser el dueño y lo segundo no puede serlo. Con las dos acciones
                  en una sola barra pegada al borde, la de abajo es la última
                  que se ve al terminar de leer, que es cuando se contacta. */}
              {(puedeEditar || puedeVerTelefono || esDueñoConContacto || puedeEscribir) && (
                <div className="sticky bottom-0 border-t border-border bg-white/95 px-5 py-4 backdrop-blur-sm sm:px-6">
                  {puedeEditar ? (
                    <button
                      type="button"
                      onClick={() => onEditar?.(anuncio.id)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amarillo text-[14px] font-semibold text-carbon transition-colors hover:bg-amarillo-oscuro"
                    >
                      <IconoLapiz />
                      Editar anuncio
                    </button>
                  ) : esDueñoConContacto ? (
                    <p className="flex items-start justify-center gap-2 py-1.5 text-center text-[13px] leading-snug text-muted">
                      <span className="mt-0.5 shrink-0 text-muted">
                        <IconoTelefono />
                      </span>
                      <span>
                        Quien abra tu anuncio verá un botón para ver tu número.
                        No se muestra aquí porque es tuyo.
                      </span>
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                  {puedeEscribir && (
                    <button
                      type="button"
                      onClick={() => (sesion ? void abrirChat({ anuncioId: anuncio.id }) : irAlLogin())}
                      disabled={abriendoChat}
                      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-semibold transition-colors disabled:opacity-60 ${
                        puedeVerTelefono
                          ? 'border border-border bg-white text-foreground hover:border-muted'
                          : 'bg-accent text-white hover:bg-accent-dark'
                      }`}
                    >
                      <IconoBocadillo />
                      {abriendoChat
                        ? 'Abriendo la conversación'
                        : sesion
                          ? `Enviar mensaje a ${anuncio.autor.nombre}`
                          : 'Entra para escribirle'}
                    </button>
                  )}
                  {!puedeVerTelefono ? null : telefono ? (
                    <div>
                      <p className="text-center text-[11px] tracking-[0.08em] text-muted uppercase">
                        Teléfono de {anuncio.autor.nombre}
                      </p>
                      <a
                        href={`tel:${telefono.telefono}`}
                        className="mt-1.5 block text-center text-[22px] font-semibold tracking-tight text-foreground"
                      >
                        {telefono.telefonoLegible}
                      </a>
                      <div className="mt-3 flex gap-2">
                        <a
                          href={`tel:${telefono.telefono}`}
                          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-semibold text-white transition-colors hover:bg-accent-dark"
                        >
                          <IconoTelefono />
                          Llamar
                        </a>
                        {telefono.enlaceWhatsapp && (
                          <a
                            href={telefono.enlaceWhatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-white text-[14px] font-semibold text-foreground transition-colors hover:border-muted"
                          >
                            <IconoBocadillo />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ) : contacto && !contacto.disponible ? (
                    <p className="flex items-center justify-center gap-2 py-2 text-center text-[13px] text-muted">
                      <span className="shrink-0">
                        <IconoTelefono />
                      </span>
                      {mensajeDeMotivo(contacto.motivo)}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={pedirTelefono}
                      disabled={pidiendo}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-60"
                    >
                      <IconoTelefono />
                      {pidiendo ? (
                        <BaknazoLoader tamano="boton" mensaje="Buscando el número" />
                      ) : sesion ? (
                        'Ver número de teléfono'
                      ) : (
                        'Entra para ver el número'
                      )}
                    </button>
                  )}
                  {!sesion && (puedeEscribir || puedeVerTelefono) && (
                    <p className="text-center text-[12px] text-muted">
                      Contactar es solo con cuenta. Crearla es gratis.
                    </p>
                  )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </m.div>

      {visor && fotoActual && (
        <VisorGaleria
          fotos={fotos.map((foto) => urlCompleta(foto.url) ?? '')}
          indice={indice}
          alt={`${anuncio?.titulo ?? ''} — foto ${indice + 1} de ${fotos.length}`}
          onCambiar={setIndice}
          onCerrar={() => setVisor(false)}
        />
      )}
    </div>
  );
}

const NO_DISPONIBLE: Record<Pilar, { titulo: string; texto: string; boton: string }> = {
  productos: {
    titulo: 'Este producto ya se vendió',
    texto: 'Quien lo publicó lo marcó como vendido. Hay otros parecidos esperando.',
    boton: 'Ver productos parecidos',
  },
  servicios: {
    titulo: 'Este servicio ya no está disponible',
    texto: 'Quien lo ofrecía ya no lo tiene activo. Mira otros en la misma categoría.',
    boton: 'Ver servicios parecidos',
  },
  empleo: {
    titulo: 'Esta vacante ya fue cubierta',
    texto: 'La empresa ya no recibe postulaciones para este puesto.',
    boton: 'Ver otras vacantes',
  },
};

/** El aviso de "ya se vendió", con un camino a algo parecido que sí esté disponible. */
function AvisoNoDisponible({ pilar, categoriaId }: { pilar: Pilar; categoriaId?: number }) {
  const navegar = useNavigate();
  const t = NO_DISPONIBLE[pilar];
  const destino = new URLSearchParams({ pilar });
  if (categoriaId) destino.set('categoria', String(categoriaId));
  return (
    <div role="status" className="mt-3 rounded-xl bg-carbon px-4 py-3.5 text-white">
      <p className="flex items-center gap-2 text-[14.5px] font-semibold">
        <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10.5px] tracking-wide uppercase">
          No disponible
        </span>
        {t.titulo}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-white/75">{t.texto}</p>
      <button
        type="button"
        onClick={() => navegar(`/anuncios?${destino.toString()}`)}
        className="mt-3 h-9 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-carbon transition-opacity hover:opacity-90"
      >
        {t.boton}
      </button>
    </div>
  );
}
