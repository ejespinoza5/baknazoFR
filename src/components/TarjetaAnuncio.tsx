import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconoChat,
  IconoCheck,
  IconoCompartir,
  IconoGuardar,
  IconoMaletin,
  IconoPulgar,
  IconoTelefono,
} from './Iconos';
import VisorGaleria from './VisorGaleria';
import { CHAT_PENDIENTE } from '../lib/contacto';
import { notificarExito, notificarInfo } from '../lib/notificar';
import { useVistaEnPantalla } from '../lib/vistas';
import { ESTILO_PILAR, type Pilar } from '../lib/pilares';
import { DETALLE_POR_PILAR, ETIQUETA_DETALLE } from '../lib/formularioAnuncio';
import {
  haceCuanto,
  inicialesDe,
  plural,
  resumenDeLikes,
  TONO_ESTADO,
  valorLegible,
  type AnuncioTarjeta,
  type TonoEstado,
} from '../lib/tarjeta';
import type { VistaAnuncios } from '../lib/vistaAnuncios';

interface Props {
  /**
   * Solo lo necesitan las reacciones de la lista. Las previas de un borrador no
   * lo tienen todavía, y una tarjeta sin id no debe inventarse un contador.
   */
  id?: number;
  pilar: Pilar;
  titulo: string;
  precio: string;
  ubicacion: string;
  /** Imagen ya subida. Sin ella se dibuja la franja de "sin foto". */
  foto?: string | null;
  /** Texto de la marca sobre la franja cuando no hay foto. */
  marca?: string;
  /** Muestra el botón de guardar. El feed sí; la vista previa no. */
  guardado?: boolean;
  onAlternarGuardado?: () => void;
  /**
   * Cómo se acomoda la tarjeta.
   *
   * En rejilla es la tarjeta de siempre: foto arriba y tres líneas de texto, y
   * hay que abrir la publicación para saber más. En lista es una publicación
   * entera —cabecera con su autor, texto, detalles y foto—, porque en una fila
   * por anuncio sí cabe todo y no tiene sentido mandar a otro sitio a leerlo.
   *
   * La elige quien lista los anuncios, no la tarjeta: la vista previa y "mis
   * anuncios" siempre muestran la rejilla.
   */
  vista?: VistaAnuncios;
  /**
   * Cabecera de la vista de lista. Viene suelta y no como un `AnuncioTarjeta`
   * entero porque la rejilla no la usa: la tarjeta del grid solo necesita seis
   * campos, y obligarla a recibirlos los pediría también en la vista previa.
   */
  autor?: AnuncioTarjeta['autor'];
  descripcion?: string | null;
  categoria?: string;
  detalle?: Record<string, string | null | undefined>;
  publicadoEn?: string | null;
  fotos?: AnuncioTarjeta['fotos'];
  vistas?: number;
  contactos?: number;
  /**
   * Teléfono de contacto, si ya se reveló.
   *
   * No viaja en el listado: sale de `POST /api/anuncios/:id/contacto`, que exige
   * sesión, para que no se pueda recorrer la app quedándose con todos los
   * números. Quien lista lo pide al pulsar y lo pasa ya revelado.
   */
  /** Si el backend dice que este anuncio puede revelar su número ahora. */
  puedeVerTelefono?: boolean;
  /**
   * Abre el modal de contacto con quien publicó.
   *
   * La tarjeta solo avisa: la petición y el modal son de quien lista, porque el
   * número es un dato que pide el backend con sesión y la tarjeta no la tiene.
   */
  onContactar?: () => void;
  /** La petición está en vuelo: se apaga el botón para no repetirla. */
  pidiendoTelefono?: boolean;
  /**
   * El dueño activó la opción de mostrar su número.
   *
   * La lista lo necesita para lo mismo que la ficha: el dueño no puede ver el
   * botón, pero sin algo en su lugar el pie desaparece y parece que la opción no
   * se guardó.
   */
  mostrarTelefono?: boolean;
  /** Lo que la API calculó al listar; solo la línea de contexto de la cabecera. */
  distanciaKm?: number | null;
  /** Si el anuncio es de quien mira, para no ofrecerle chat consigo mismo. */
  esMio?: boolean;
  /**
   * Abre el perfil de quien publicó. Sin esto, el nombre y la foto son texto y
   * no hay forma de llegar a ver sus demás anuncios, que es justo lo que hace
   * falta para decidirse a comprar.
   */
  onAbrirPerfil?: () => void;
  /** Liked por quien mira, y el total. Los decide quien lista, no la tarjeta. */
  meGusta?: boolean;
  likes?: number;
  /**
   * Alterna el like. Resuelve `false` si no se pudo guardar, y la tarjeta
   * revierte su cambio optimista: el pulgar tiene que reflejar lo que el
   * servidor sabe, no lo que se quiso.
   */
  onAlternarMeGusta?: () => Promise<boolean> | boolean;
  /** Vendido: la tarjeta se apaga y lo dice, sin quitar el enlace. */
  vendido?: boolean;
  /** Etiqueta opcional, como "cerca de ti" en el feed. */
  distintivo?: string;
  /** Estado del anuncio, para la vista de "mis anuncios". */
  estado?: { etiqueta: string; tono: TonoEstado };
  /** Contenido bajo la tarjeta, con su divisor: métricas y acciones. */
  pie?: ReactNode;
  /** Marca la tarjeta como la que estás viendo en la vista previa. */
  resaltada?: boolean;
  /**
   * Abre la publicación completa.
   *
   * La tarjeta entera se vuelve clicable con un enlace estirado sobre el título
   * (un `::after` que cubre el artículo), no con un `onClick` en el `article`:
   * así el teclado tiene un único punto de entrada con nombre —el título— y los
   * botones de dentro siguen siendo botones de verdad, no elementos con rol.
   */
  onAbrir?: () => void;
  /**
   * Solo en lista: abre la ficha desde el título, sin volver clicable la tarjeta
   * entera (en lista hay fotos, pulgar y botones que deben seguir funcionando).
   */
  onVerDetalle?: () => void;
  /** Solo empleo: postularse. Abre la ficha, que es donde se adjunta el CV. */
  onPostular?: () => void;
  /**
   * Cuenta una vista real cuando la publicación pasa un segundo en pantalla.
   * Solo tiene sentido en lista, donde se lee entera sin abrirla.
   */
  contarVista?: boolean;
}

/**
 * La tarjeta de anuncio, compartida por el feed, la vista previa de publicación
 * y "mis anuncios".
 *
 * Que las tres superficies usen el mismo componente es lo que hace verdadera la
 * frase "así se verá tu anuncio": si el feed cambiara el orden de la precio o
 * el color del pilar, la vista previa cambia con él en el mismo commit.
 *
 * `estado` y `pie` son opcionales y los añade solo la vista de "mis anuncios":
 * el feed y la vista previa no necesitan saber si un anuncio está pausado, y
 * ocultar esas zonas es preferible a mostrarlas vacías.
 */
export default function TarjetaAnuncio({
  id,
  pilar,
  titulo,
  precio,
  ubicacion,
  foto,
  marca = 'imagen demo',
  guardado,
  onAlternarGuardado,
  vista = 'rejilla',
  autor,
  descripcion,
  categoria,
  detalle,
  publicadoEn,
  fotos,
  vistas,
  contactos,
  puedeVerTelefono,
  onContactar,
  pidiendoTelefono,
  mostrarTelefono,
  distanciaKm,
  esMio,
  meGusta: meGustaProp,
  likes: likesProp,
  onAlternarMeGusta,
  vendido = false,
  distintivo,
  estado,
  pie,
  resaltada,
  onAbrir,
  onAbrirPerfil,
  onVerDetalle,
  onPostular,
  contarVista = false,
}: Props) {
  const estilo = ESTILO_PILAR[pilar];
  const lista = vista === 'lista';

  const navegar = useNavigate();
  const refArticulo = useRef<HTMLElement | null>(null);

  /**
   * Rejilla estilo Marketplace de Facebook: foto cuadrada y el texto debajo,
   * sin caja alrededor. Así caben más anuncios por fila y la foto manda.
   * "Mis anuncios" (con `pie` o `estado`) conserva la tarjeta con borde,
   * porque ahí cada anuncio lleva sus botones de gestión.
   */
  const marketplace = !lista && !pie && !estado;
  useVistaEnPantalla(refArticulo, id, lista && contarVista && !esMio);

  /**
   * Las fotos de la publicación. Se prefieren todas las que trae el listado y,
   * si no vienen, se cae a la portada: así la vista de lista se ve igual con un
   * listado viejo que solo mande la portada.
   */
  const imagenes = lista
    ? fotos?.length
      ? fotos.map((f) => f.url)
      : foto
        ? [foto]
        : []
    : [];

  /** El botón de guardar: en rejilla va sobre la foto, en lista en la cabecera. */
  const botonGuardar = onAlternarGuardado && (
    <button
      type="button"
      onClick={onAlternarGuardado}
      // Solo el de la foto es posicionado (va absoluto sobre la imagen) y hay que
      // marcarlo para que la regla del artículo no le imponga `relative`. El de
      // la cabecera fluye, así que lo levanta esa misma regla. Ver la nota abajo.
      data-encima={lista ? undefined : ''}
      aria-label={guardado ? 'Quitar de guardados' : 'Guardar anuncio'}
      aria-pressed={Boolean(guardado)}
      className={
        lista
          ? `grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
              guardado ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-background'
            }`
          : 'absolute top-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-foreground'
      }
    >
      <IconoGuardar lleno={guardado} />
    </button>
  );

  /**
   * El like de la tarjeta es el mismo estado que el de la ficha, y por eso lo
   * decide quien lista: la tarjeta es de presentación y no sabe llamar a la API.
   * El contador y el botón vienen como props, y si no llega `onAlternarMeGusta`
   * no se pinta el botón —un pulgar que no hace nada sería peor que ninguno.
   *
   * El estado local vive aquí para que el toque se pinte al instante, pero la
   * verdad es la prop: cuando el padre devuelve la respuesta del servidor, esta
   * tiene que soltarlo. Si la llamada falla, las props no cambian y el valor real
   * sustituye al inventado sin que nadie tenga que deshacer nada.
   *
   * Se ajusta durante el render y no en un efecto, que es el patrón que ya usa
   * la ficha para limpiar lo del anuncio anterior. En un efecto habría un
   * instante entre pintado y pintado con los dos valores a la vez, y React avisa
   * de eso porque un `setState` dentro de un efecto cascada un render.
   */
  const [meGustaLocal, setMeGustaLocal] = useState<boolean>(meGustaProp ?? false);
  const [likesLocal, setLikesLocal] = useState<number>(likesProp ?? 0);

  /**
   * Cuándo se descarta el estado local para volver al de las props.
   *
   * El `id` se normaliza a -1 ANTES de compararse, en los dos lados. Este
   * componente se usa también sin id (la vista previa de un borrador, que aún no
   * está en ningún listado) y comparar `-1` contra `undefined` da verdadero
   * siempre: el componente se volvería a pintar sin fin y la pantalla se quedaría
   * en blanco.
   */
  const idAncla = id ?? -1;
  const [anclado, setAnclado] = useState<{ id: number; meGusta?: boolean; likes?: number }>({
    id: idAncla,
    meGusta: meGustaProp,
    likes: likesProp,
  });
  if (anclado.id !== idAncla || anclado.meGusta !== meGustaProp || anclado.likes !== likesProp) {
    setAnclado({ id: idAncla, meGusta: meGustaProp, likes: likesProp });
    setMeGustaLocal(meGustaProp ?? false);
    setLikesLocal(likesProp ?? 0);
  }

  /**
   * Descripción y características, plegadas detrás de un "ver más".
   *
   * Plegado, la lista solo enseña lo que hace falta para escanearla —qué es,
   * cuánto y dónde—. Con todo fuera, cada tarjeta ocupaba media pantalla y había
   * que hacer scroll por veinte anuncios para llegar a la veinteava foto.
   */
  const [descripcionAmpliada, setDescripcionAmpliada] = useState(false);

  /**
   * Las características con valor, ya en texto.
   *
   * Se calculan una vez y se usan para las dos cosas que las necesitan: decidir
   * si hay algo que revelar y pintar las etiquetas. Si el backend manda un
   * `detalle: {}` —puede, si el pilar no tiene características— la lista sale
   * vacía, y con ella el botón, en vez de prometer una expansión sin contenido.
   */
  const caracteristicas = [
    ...DETALLE_POR_PILAR[pilar].map((clave) => {
      const valor = detalle?.[clave];
      return valor ? { clave, etiqueta: ETIQUETA_DETALLE[clave], valor } : null;
    }),
    /* La zona de cobertura solo la traen los servicios. */
    detalle?.zonaCobertura
      ? {
          clave: 'zonaCobertura',
          etiqueta: 'Zona de cobertura',
          valor: detalle.zonaCobertura,
        }
      : null,
  ].filter((c): c is { clave: string; etiqueta: string; valor: string } => c !== null);

  /**
   * Solo se ofrece el botón si hay algo detrás que sacar. Un anuncio sin
   * descripción ni características no tiene nada que revelar, y un "ver más"
   * que no despliega nada es un botón que no hace nada.
   */
  const hayDetallesOcultables = Boolean(descripcion?.trim()) || caracteristicas.length > 0;

  /**
   * Se vuelve a plegar si el texto cambia, y se hace durante el render y no en
   * un efecto a propósito: un `setState` dentro de un efecto provoca un render
   * en cascada —justo lo que la regla de hooks prohíbe—, mientras que aquí React
   * lo resuelve antes de pintar nada. Sin esto, el texto corto de otro anuncio
   * heredaría el "ver más" abierto del anterior al reciclar la fila.
   */
  const [textoVisto, setTextoVisto] = useState({ descripcion, id: idAncla });
  if (textoVisto.descripcion !== descripcion || textoVisto.id !== idAncla) {
    setTextoVisto({ descripcion, id: idAncla });
    setDescripcionAmpliada(false);
  }

  /**
   * El botón solo aparece si el texto de verdad se corta.
   *
   * Medir es lo único fiable: adivinar por número de caracteres falla con
   * descripciones cortas en pantallas anchas y largas en estrechas, y un
   * "ver más" que no oculta nada es un botón que no hace nada.
   */

  /** No se puede dar like a lo propio ni a lo ya vendido. */
  const puedeDarLike = id != null && Boolean(onAlternarMeGusta) && !esMio && !vendido;
  const meGusta = meGustaLocal;
  const reacciones = likesLocal;

  /**
   * Un ref y no un estado para el cerrojo: dos toques seguidos llegan antes de que
   * React vuelva a pintar, así que un `useState` se leería todavía en `false` en
   * el segundo toque y saldrían dos peticiones iguales. El ref se escribe en el
   * acto, y el segundo toque no llega a llamar al padre. Con `useState` el botón
   * se deshabilita y se ve la espera; el ref es lo que la detiene de verdad.
   */
  const likeEnCurso = useRef(false);

  const alternarMeGusta = async () => {
    if (likeEnCurso.current) return;
    likeEnCurso.current = true;
    const anterior = meGustaLocal;
    const siguiente = !anterior;
    setMeGustaLocal(siguiente);
    setLikesLocal((total) => Math.max(0, total + (siguiente ? 1 : -1)));
    const ok = await onAlternarMeGusta?.();
    if (ok === false) {
      setMeGustaLocal(anterior);
      setLikesLocal((total) => Math.max(0, total + (siguiente ? -1 : 1)));
    }
    likeEnCurso.current = false;
  };

  /**
   * El dueño de un anuncio con el número habilitado.
   *
   * El botón de "Ver número" no se le enseña —no tiene a quién llamarse—, pero
   * sin esto la lista no le dice que la opción quedó activa. En un vendido no se
   * dice nada, porque el texto sería falso: ya no lo verá nadie.
   */
  const avisoDueñoTelefono =
    lista && esMio && mostrarTelefono && !vendido ? (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
        <IconoTelefono />
        Quien abra tu anuncio verá un botón para ver tu número
      </span>
    ) : null;

  /** Compartir el enlace de la publicación (menú del sistema o portapapeles). */
  const compartir = async () => {
    if (id == null) return;
    const enlace = `${window.location.origin}/anuncio/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url: enlace });
        return;
      }
      await navigator.clipboard.writeText(enlace);
      notificarExito('Enlace copiado.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') notificarInfo(`Copia este enlace: ${enlace}`);
    }
  };

  /**
   * La acción principal depende de qué es y de quién mira: postularse a un
   * empleo, pedir el número, escribir, o, si es tuyo, abrirlo.
   */
  const accionPrincipal: ReactNode = !lista || vendido
    ? null
    : pilar === 'empleo' && !esMio && onPostular ? (
        <BotonAccion key="principal" onClick={onPostular} tono="empleo">
          <IconoMaletin />
          Postularme
        </BotonAccion>
      ) : !esMio && puedeVerTelefono && onContactar ? (
        <BotonAccion key="principal" onClick={onContactar} deshabilitado={pidiendoTelefono}>
          <IconoTelefono />
          {pidiendoTelefono ? 'Buscando' : 'Ver número'}
        </BotonAccion>
      ) : !esMio ? (
        <BotonAccion key="principal" onClick={() => notificarInfo(CHAT_PENDIENTE)}>
          <IconoChat />
          Mensaje
        </BotonAccion>
      ) : pilar === 'empleo' && id != null ? (
        // Tu propia vacante: lo útil es ir directo a quién se postuló.
        <BotonAccion key="principal" onClick={() => navegar(`/postulaciones?anuncio=${id}`)} tono="empleo">
          <IconoMaletin />
          Postulaciones
        </BotonAccion>
      ) : onVerDetalle ? (
        <BotonAccion key="principal" onClick={onVerDetalle}>
          Ver anuncio
        </BotonAccion>
      ) : null;

  const acciones: ReactNode[] = [];
  if (lista && puedeDarLike) {
    acciones.push(
      <BotonAccion key="like" onClick={alternarMeGusta} activo={meGusta} presionado={meGusta}>
        <IconoPulgar lleno={meGusta} />
        Me gusta
      </BotonAccion>
    );
  }
  if (accionPrincipal) acciones.push(accionPrincipal);
  if (lista && id != null) {
    acciones.push(
      <BotonAccion key="compartir" onClick={compartir}>
        <IconoCompartir />
        Compartir
      </BotonAccion>
    );
  }

  /**
   * La foto a pantalla completa. Vive fuera del `<article>` porque el visor es de
   * pantalla completa y la tarjeta recorta lo que sobra.
   */
  const [visor, setVisor] = useState<number | null>(null);

  return (
    <>
    <article
      ref={refArticulo}
      // El feed se ancla a este atributo para devolver el scroll al mismo anuncio
      // cuando se cambia de rejilla a lista.
      data-anuncio={id != null ? String(id) : undefined}
      className={`${
        marketplace
          ? 'group relative'
          : `relative overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-200 ${
              resaltada
                ? 'border-transparent shadow-[0_1px_2px_rgba(31,41,55,0.04),0_18px_36px_-26px_rgba(31,41,55,0.45)]'
                : 'border-border hover:border-muted hover:shadow-[0_1px_2px_rgba(31,41,55,0.04),0_18px_36px_-26px_rgba(31,41,55,0.45)]'
            }`
      } ${
        // Con la tarjeta abrible, el enlace estirado del título cubre el
        // artículo entero: los botones que ya había (guardar, editar, eliminar)
        // hay que levantarlos o se quedarían debajo y no recibirían el clic. Se
        // excluye el propio botón del título porque, si fuera el contenedor de
        // posición, su `::after` se estiraría solo sobre el texto.
        //
        // `data-encima` marca los botones que ya son posicionados (el de guardar
        // sobre la foto): para ellos basta el `z-10`, y aplicarles `relative`
        // ganaría por especificidad y los sacaría de su sitio.
        onAbrir
          ? 'cursor-pointer [&_button:not([data-estirar]):not([data-encima])]:relative [&_button:not([data-estirar]):not([data-encima])]:z-10'
          : ''
      }`}
    >
      {lista ? (
        <>
          {/* ---------- Cabecera: quién publicó ---------- */}
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
            {autor && onAbrirPerfil ? (
              <button
                type="button"
                onClick={onAbrirPerfil}
                aria-label={`Ver el perfil de ${autor.nombre}`}
                className="shrink-0 rounded-full transition-transform duration-150 active:scale-95"
              >
                <Avatar autor={autor} respaldo={estilo.nombre} negocio={autor.esNegocio} />
              </button>
            ) : (
              <Avatar autor={autor} respaldo={estilo.nombre} negocio={autor?.esNegocio} />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] leading-tight font-semibold text-foreground">
                {autor && onAbrirPerfil ? (
                  <button
                    type="button"
                    onClick={onAbrirPerfil}
                    className="truncate transition-colors hover:text-accent hover:underline"
                  >
                    {autor.nombre}
                  </button>
                ) : (
                  <span className="truncate">{autor?.nombre ?? estilo.nombre}</span>
                )}
                {autor?.verificado && (
                  <span
                    className="grid size-4 shrink-0 place-items-center rounded-full bg-success text-white"
                    title="Cuenta verificada"
                  >
                    <IconoCheck ok />
                  </span>
                )}
                {autor?.esNegocio && (
                  <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-dark">
                    Negocio
                  </span>
                )}
                {distintivo && (
                  <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success-deep">
                    {distintivo}
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-muted">
                {haceCuanto(publicadoEn) && <span>{haceCuanto(publicadoEn)}</span>}
                {haceCuanto(publicadoEn) && (
                  <span aria-hidden="true">·</span>
                )}
                <span>{categoria ?? estilo.nombre}</span>
                {distanciaKm != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-success-deep">
                      a {distanciaKm.toLocaleString('es-EC', { maximumFractionDigits: 1 })} km
                    </span>
                  </>
                )}
              </p>
            </div>
            {vendido && (
              <span className="shrink-0 rounded-full bg-carbon px-2 py-0.5 text-[10.5px] font-semibold text-white uppercase">
                Vendido
              </span>
            )}
            {botonGuardar}
          </div>

          {/* ---------- Texto y detalles ---------- */}
          <div className="px-4 pb-3">
            <h3 className="text-[15px] leading-snug font-semibold text-foreground">
              {onAbrir ? (
                <button
                  type="button"
                  onClick={onAbrir}
                  data-estirar=""
                  className="text-left after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {titulo}
                </button>
              ) : onVerDetalle ? (
                <button type="button" onClick={onVerDetalle} className="text-left hover:underline">
                  {titulo}
                </button>
              ) : (
                titulo
              )}
            </h3>
            <p className="mt-1 text-[18px] leading-none font-bold text-foreground">
              {precio}
            </p>
            <p className="mt-1 text-[12px] text-muted">{ubicacion}</p>

            {/*
              Descripción y características van detrás del "ver más". Plegado, lo
              único que se ve de la publicación es lo que hace falta para
              escanear la lista —qué es, cuánto y dónde—, y el resto aparece si se
              pide. Con todo desplegado, cada tarjeta ocupaba media pantalla y
              había que hacer scroll por veinte anuncios para ver veinte fotos.
            */}
            {hayDetallesOcultables && (
              <button
                type="button"
                onClick={() => setDescripcionAmpliada((v) => !v)}
                aria-expanded={descripcionAmpliada}
                className="mt-1.5 text-[12.5px] font-semibold text-accent hover:underline"
              >
                {descripcionAmpliada ? 'Ver menos' : 'Ver más'}
              </button>
            )}

            {descripcionAmpliada && descripcion && (
              <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-foreground">
                {descripcion}
              </p>
            )}
            {descripcionAmpliada && caracteristicas.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {caracteristicas.map(({ clave, etiqueta, valor }) => (
                  <li
                    key={clave}
                    className="rounded-full bg-background px-2.5 py-0.5 text-[11px] text-muted"
                  >
                    {etiqueta}:{' '}
                    <span className="font-medium text-foreground">
                      {valorLegible(valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- Las fotos, al final, como en una publicación ----------
              Con una sola foto ocupa todo el ancho; con varias se reparten en
              dos como en Facebook y la segunda avisa cuántas más hay. La
              separación entre ellas es el fondo del contenedor, así que no hay
              que pintar bordes. */}
          {imagenes.length > 0 ? (
            <div
              className={`grid bg-background ${
                imagenes.length > 1 ? 'grid-cols-2 gap-0.5' : 'grid-cols-1'
              }`}
            >
              {imagenes.slice(0, 2).map((url, i) => {
                // Con más de dos, la segunda abre la tercera: es la siguiente que
                // no se ha visto, y así el "+2" no esconde nada.
                const abre = i === 1 && imagenes.length > 2 ? 2 : i;
                return (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setVisor(abre)}
                    aria-label={`Ver la foto ${abre + 1} de ${imagenes.length} en grande`}
                    className={`relative block w-full cursor-pointer overflow-hidden ${
                      imagenes.length > 1
                        ? 'aspect-square'
                        : 'aspect-[4/3] sm:aspect-[16/9]'
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={`absolute inset-0 size-full object-cover ${vendido ? 'grayscale' : ''}`}
                    />
                    {i === 1 && imagenes.length > 2 && (
                      <span className="absolute inset-0 grid place-items-center bg-carbon/60 text-[16px] font-semibold text-white">
                        +{imagenes.length - 2}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className={`relative aspect-[4/3] ${estilo.fondo} sm:aspect-[16/9]`}
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${estilo.rayas} 0 10px, transparent 10px 22px)`,
              }}
            >
              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-[6px] bg-carbon/25 px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                  {marca}
                </span>
              </span>
            </div>
          )}

          {/* El pie: el like a la izquierda y los contadores a la derecha, como
              en una publicación de Facebook. El teléfono, si lo hay, se queda
              justo debajo porque es lo que se busca para poder pagar. */}
          {/* Resumen: reacciones a la izquierda, alcance a la derecha. */}
          {(reacciones > 0 || vistas !== undefined) && (
            <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 text-[12px] text-muted">
              <span className="flex min-w-0 items-center gap-1.5">
                {reacciones > 0 && (
                  <>
                    <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-accent text-white [&>svg]:size-3">
                      <IconoPulgar lleno />
                    </span>
                    <span className="truncate">{resumenDeLikes(reacciones, meGusta)}</span>
                  </>
                )}
              </span>
              <span className="shrink-0">
                {plural(vistas ?? 0, 'vista', 'vistas')}
                {contactos ? ` · ${plural(contactos, 'contacto', 'contactos')}` : ''}
              </span>
            </div>
          )}

          {/* Barra de acciones, como en una publicación de Facebook. */}
          {acciones.length > 0 && (
            <div className="mx-2 flex border-t border-border py-1 sm:mx-3">{acciones}</div>
          )}
          {avisoDueñoTelefono && <div className="px-4 pb-3">{avisoDueñoTelefono}</div>}
        </>
      ) : marketplace ? (
        <>
          <div
            className={`relative aspect-square overflow-hidden rounded-xl ${estilo.fondo} ${
              resaltada ? 'ring-2 ring-accent/30' : ''
            }`}
            style={
              foto
                ? undefined
                : { backgroundImage: `repeating-linear-gradient(135deg, ${estilo.rayas} 0 10px, transparent 10px 22px)` }
            }
          >
            {foto ? (
              <img
                src={foto}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
                  vendido ? 'grayscale' : ''
                }`}
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-[6px] bg-carbon/25 px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                  {marca}
                </span>
              </span>
            )}
            {vendido && (
              <span className="absolute bottom-2 left-2 rounded-md bg-carbon/85 px-2 py-0.5 text-[11px] font-semibold text-white uppercase">
                Vendido
              </span>
            )}
            {botonGuardar}
          </div>
          <div className="px-0.5 pt-2">
            <p className="text-[15.5px] leading-tight font-bold text-foreground">{precio}</p>
            <h3 className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-foreground">
              {onAbrir ? (
                <button
                  type="button"
                  onClick={onAbrir}
                  data-estirar=""
                  className="text-left after:absolute after:inset-0 after:content-[''] group-hover:underline"
                >
                  {titulo}
                </button>
              ) : (
                titulo
              )}
            </h3>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
              {/* El color del pilar siempre va con su nombre, nunca solo. */}
              <span className={`size-1.5 shrink-0 rounded-full ${estilo.punto}`} aria-hidden="true" />
              <span className={`shrink-0 font-medium ${estilo.tinta}`}>{estilo.nombre}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{ubicacion}</span>
            </p>
            {distintivo && (
              <span className="mt-1.5 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-medium text-success-deep">
                {distintivo}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div
            className={`relative aspect-[4/3] ${estilo.fondo}`}
            style={{
              backgroundImage: `repeating-linear-gradient(135deg, ${estilo.rayas} 0 10px, transparent 10px 22px)`,
            }}
          >
            {foto ? (
              <img
                src={foto}
                alt=""
                // Lo vendido se ve en gris: el gris se lee como "agotado" en
                // cualquier cultura y de un vistazo, sin tener que leer la
                // etiqueta. Se desatura la foto, no la tarjeta entera, para que
                // el texto siga siendo legible.
                className={`absolute inset-0 size-full object-cover ${vendido ? 'grayscale' : ''}`}
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-[6px] bg-carbon/25 px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                  {marca}
                </span>
              </span>
            )}
            {botonGuardar}
          </div>
          <div className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 shrink-0 rounded-full ${estilo.punto}`} aria-hidden="true" />
              <span className={`truncate text-[11px] font-medium ${estilo.tinta}`}>
                {estilo.nombre}
              </span>
              {distintivo && (
                <span className="ml-auto shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-medium text-success-deep">
                  {distintivo}
                </span>
              )}
              {/* "Vendido" gana al estado: si además está pausado, lo que
                  importa para el dueño es que ya se vendió, no que esté en
                  pausa. Se pinta solo si no hay estado con el que competir. */}
              {vendido ? (
                <span className="ml-auto shrink-0 rounded-full bg-carbon px-2 py-0.5 text-[10.5px] font-semibold text-white uppercase">
                  Vendido
                </span>
              ) : (
                estado && (
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${TONO_ESTADO[estado.tono]}`}
                  >
                    {estado.etiqueta}
                  </span>
                )
              )}
            </div>
            <p className="mt-2 text-[14px] font-semibold text-foreground sm:mt-2.5 sm:text-[15px]">
              {precio}
            </p>
            {/* En dos columnas el título se cortaría en cuatro o cinco líneas y
               la tarjeta crecería sin control: dos líneas y a otra tarjeta. */}
            <h3 className="mt-0.5 line-clamp-2 text-[13.5px] font-medium text-foreground sm:text-[14px]">
              {onAbrir ? (
                <button
                  type="button"
                  onClick={onAbrir}
                  data-estirar=""
                  className="text-left after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {titulo}
                </button>
              ) : (
                titulo
              )}
            </h3>
            <p className="mt-2 truncate text-[12px] text-muted sm:text-[12.5px]">
              {ubicacion}
            </p>
            {/* Quién publicó, también en la rejilla.
                Va debajo de la ubicación y no junto al título porque el título
                lleva un enlace que se estira a toda la tarjeta: el botón del autor
                se levanta solo con el `z-10` que el `article` aplica a los botones
                que no son el del título, y así el clic va al perfil y no al
                anuncio. Sin esta fila, en rejilla no había forma de llegar al
                perfil sin abrir antes la ficha. */}
            {autor && (
              <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5">
                {onAbrirPerfil ? (
                  <button
                    type="button"
                    onClick={onAbrirPerfil}
                    aria-label={`Ver el perfil de ${autor.nombre}`}
                    className="flex min-w-0 items-center gap-1.5 text-left text-[11.5px] text-muted transition-colors hover:text-accent hover:underline"
                  >
                    <Avatar
                      autor={autor}
                      respaldo={estilo.nombre}
                      negocio={autor.esNegocio}
                      clase="size-[18px] text-[8px]"
                    />
                    <span className="truncate">{autor.nombre}</span>
                  </button>
                ) : (
                  <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted">
                    <Avatar
                      autor={autor}
                      respaldo={estilo.nombre}
                      negocio={autor.esNegocio}
                      clase="size-[18px] text-[8px]"
                    />
                    <span className="truncate">{autor.nombre}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {pie && (
        <div className="border-t border-border bg-background/60 px-4 py-3">
          {pie}
        </div>
      )}
    </article>

    {visor !== null && imagenes[visor] && (
      <VisorGaleria
        fotos={imagenes}
        indice={visor}
        alt={titulo}
        onCambiar={setVisor}
        onCerrar={() => setVisor(null)}
      />
    )}
    </>
  );
}

/**
 * La foto de quien publicó: la del logo si es un negocio, la de la persona si no.
 *
 * Siempre redonda, como la foto de perfil de Facebook. Un logo no va en un
 * cuadrado: recortado a círculo desaparece el marco oscuro que traen muchos
 * archivos y que en un cuadrado se leía como un borde negro. Por eso el recorte
 * es `cover` en los dos casos y solo cambia la foto de la que se parte.
 *
 * Sin foto, y también cuando el listado no trajo autor (los datos de prueba), se
 * recurre a las iniciales sobre el color del pilar.
 */
function Avatar({
  autor,
  respaldo,
  negocio,
  clase = 'size-10',
}: {
  autor: AnuncioTarjeta['autor'];
  respaldo: string;
  negocio?: boolean;
  /** El tamaño lo fija quien llama: en la rejilla el avatar va en miniatura. */
  clase?: string;
}) {
  if (autor?.foto) {
    return (
      <img
        src={autor.foto}
        alt=""
        className={`${clase} shrink-0 rounded-full object-cover ring-1 ring-black/5`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid ${clase} shrink-0 place-items-center rounded-full text-[12.5px] font-semibold text-white ${
        negocio ? 'bg-accent' : 'bg-carbon'
      }`}
    >
      {autor?.nombre ? inicialesDe(autor.nombre) : respaldo.charAt(0)}
    </span>
  );
}

/** Un botón de la barra de acciones de la lista: ancho repartido, icono y texto. */
function BotonAccion({
  onClick,
  children,
  activo = false,
  presionado,
  deshabilitado = false,
  tono,
}: {
  onClick: () => void;
  children: ReactNode;
  activo?: boolean;
  presionado?: boolean;
  deshabilitado?: boolean;
  tono?: 'empleo';
}) {
  const color =
    tono === 'empleo'
      ? 'text-empleo-deep hover:bg-empleo/[0.06]'
      : activo
        ? 'text-accent hover:bg-background'
        : 'text-muted hover:bg-background hover:text-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={presionado}
      className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-60 sm:gap-2 sm:text-[13.5px] [&>svg]:size-[18px] [&>svg]:shrink-0 ${color}`}
    >
      {children}
    </button>
  );
}
