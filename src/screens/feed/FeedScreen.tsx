import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALTO_CABECERA } from '../../components/CabeceraBaknazo';
import MarcoApp from '../../components/MarcoApp';
import BarraFiltros from '../../components/BarraFiltros';
import PanelFiltros from '../../components/PanelFiltros';
import { nombreDeCanton, useCatalogos } from '../../lib/catalogos';
import {
  FILTROS_VACIOS,
  aConsulta,
  contarFiltros,
  escribirFiltros,
  leerFiltros,
  type FiltrosUrl,
} from '../../lib/filtrosFeed';
import { NOMBRE_PILAR } from '../../lib/pilares';
import { pedirUbicacion, ubicacionGuardada, type Punto } from '../../lib/ubicacion';
import TarjetaAnuncio from '../../components/TarjetaAnuncio';
import DetalleAnuncioModal from '../../components/DetalleAnuncioModal';
import ModalContacto from '../../components/ModalContacto';
import {
  IconoAlerta,
  IconoCampana,
  IconoLista,
  IconoLupa,
  IconoMas,
  IconoRejilla,
} from '../../components/Iconos';
import {
  darLike,
  guardarAnuncio,
  listarAnuncios,
  quitarGuardado,
  quitarLike,
  registrarContacto,
} from '../../api/anuncios';
import EsqueletoAnuncio from '../../components/EsqueletoAnuncio';
import { useScrollInfinito } from '../../lib/scrollInfinito';
import { notificarAviso, notificarError, notificarExito, notificarInfo } from '../../lib/notificar';
import { urlCompleta } from '../../lib/imagen';
import { leerPropios } from '../../lib/propios';
import { useNavegacion } from '../../lib/navegacion';
import { CHAT_PENDIENTE } from '../../lib/contacto';
import {
  guardarVistaAnuncios,
  leerVistaAnuncios,
  type VistaAnuncios,
} from '../../lib/vistaAnuncios';
import {
  formatearPrecio,
  formatearUbicacion,
  type AnuncioTarjeta,
} from '../../lib/tarjeta';
import type { Anuncio as AnuncioApi, RespuestaContacto } from '../../types/anuncio';
import type { SemillaPerfil } from '../../types/perfil';
import type { PerfilUsuario, Sesion } from '../../types/auth';
import BaknazoLoader from '../../components/BaknazoLoader';

/**
 * Lo que la ficha necesita saber del anuncio abierto.
 *
 * No es el anuncio entero: al entrar por un enlace compartido puede no estar en
 * la lista cargada, y entonces solo hay un id. La ficha pide su propio anuncio,
 * así que con el id basta para abrirla.
 */
type AnuncioAbierto = Pick<AnuncioTarjeta, 'id' | 'distanciaKm' | 'meGusta' | 'likes'> & {
  /** Solo para los avisos; si viene de un enlace, puede no estar. */
  titulo?: string;
};

/**
 * Traduce la respuesta de la API a lo que consume la tarjeta.
 *
 * `propios` son los ids que la app ya conoce como tuyos (ver `lib/propios`): se
 * mezclan con lo que marque el servidor para que el chat no te aparezca en tus
 * propios anuncios ni antes ni después de que el listado mande `esMio`.
 */
function aTarjeta(
  anuncio: AnuncioApi,
  distanciaKm: number | null = null,
  propios: Set<number> = new Set()
): AnuncioTarjeta {
  return {
    id: anuncio.id,
    titulo: anuncio.titulo,
    precio: formatearPrecio(anuncio.precio, anuncio.pilar),
    ubicacion: formatearUbicacion(anuncio.ubicacion, anuncio.sector),
    pilar: anuncio.pilar,
    // Sin coordenadas del usuario la API no manda distancia; en ese caso
    // nadie está "cerca" y el filtro no inventa resultados.
    cercano: distanciaKm !== null && distanciaKm <= 10,
    foto: urlCompleta(anuncio.portada?.url ?? null),
    distanciaKm,
    // Lo que la vista de lista necesita para dispense de abrir la publicación:
    // quién la puso, qué dijo y de qué trata.
  autor: {
    id: anuncio.autor.id ? String(anuncio.autor.id) : undefined,
    nombre: anuncio.autor.nombre,
    foto: urlCompleta(anuncio.autor.foto),
    verificado: anuncio.autor.verificado,
    esNegocio: anuncio.autor.esNegocio,
    },
    esMio: anuncio.esMio || propios.has(anuncio.id),
    // Los likes llegan con cada anuncio del listado, así que la tarjeta y la
    // ficha parten del mismo número sin pedirlo otra vez al abrir.
    likes: anuncio.likes,
    meGusta: anuncio.meGusta,
    vendido: anuncio.vendido,
    descripcion: anuncio.descripcion ?? null,
    categoria: anuncio.categoria?.nombre,
    detalle: anuncio.detalle as Record<string, string | null | undefined>,
    publicadoEn: anuncio.publicadoEn,
    // La lista muestra la publicación completa, así que necesita todas sus fotos
    // y no solo la portada.
    fotos: (anuncio.fotos ?? []).map((f) => ({
      url: urlCompleta(f.url) ?? '',
      ancho: f.ancho,
      alto: f.alto,
    })),
    vistas: anuncio.vistas,
    contactos: anuncio.contactos,
    // Solo se pinta el botón si el backend dice que este anuncio puede revelar
    // su número ahora. El número en sí no se pide aquí: sale al pulsar.
    puedeVerTelefono: anuncio.telefonoVisible === true && anuncio.mostrarTelefono !== false,
    // Se propaga aparte porque la tarjeta lo necesita para avisarle al dueño de
    // que su número sí va a salir, igual que hace la ficha.
    mostrarTelefono: anuncio.mostrarTelefono === true,
  };
}

/**
 * El recorte del anuncio que la pantalla de perfil pinta como primera tarjeta.
 *
 * `clavePerfil` es lo que va en la URL y `anuncioId` lo que se usa para no
 * repetir la tarjeta. Hoy son el mismo número porque el backend todavía no manda
 * el id de la cuenta, pero no tienen por qué serlo: cuando lo mande, la URL
 * llevará el id de la persona y el anuncio seguirá siendo el mismo.
 */
function semillaDe(anuncio: AnuncioTarjeta): SemillaPerfil {
  return {
    clavePerfil: anuncio.autor?.id ?? String(anuncio.id),
    anuncioId: anuncio.id,
    titulo: anuncio.titulo,
    precio: anuncio.precio,
    ubicacion: anuncio.ubicacion,
    pilar: anuncio.pilar,
    foto: anuncio.foto,
    publicadoEn: anuncio.publicadoEn ?? null,
    likes: anuncio.likes ?? 0,
    vistas: anuncio.vistas ?? 0,
    esNegocio: anuncio.autor?.esNegocio ?? false,
    nombreAutor: anuncio.autor?.nombre ?? 'Vendedor',
  };
}

/* Datos de respaldo: se muestran si la API no responde.
   Los ids de autor coinciden con los perfiles de ejemplo, para que al pulsarlos
   se abra una plantilla de verdad y no una pantalla vacía. */
const AUTORES_DEMO: NonNullable<AnuncioTarjeta['autor']>[] = [
  { id: '12', nombre: 'TechStore Ecuador', foto: null, verificado: true, esNegocio: true },
  { id: '7', nombre: 'Ana Ríos', foto: null, verificado: false, esNegocio: false },
  { id: '13', nombre: 'Café La Brisa', foto: null, verificado: false, esNegocio: true },
  { id: '14', nombre: 'Marco Espín', foto: null, verificado: false, esNegocio: false },
];

/** Una fecha ISO de hace tantas horas, para que la línea de tiempo no mienta. */
const haceHoras = (horas: number) =>
  new Date(Date.now() - horas * 3600_000).toISOString();

/*
 * Los datos de respaldo también traen autor, descripción y fecha. No es
 * decoración: en esta vista la lista se lee como una publicación, y sin ellos
 * no se podría ni ver ni juzgar cómo queda.
 */
const ANUNCIOS_DEMO: AnuncioTarjeta[] = [
  { id: 1, titulo: 'Computadora portátil, 16 GB RAM', precio: '$780.00', ubicacion: 'Quito', pilar: 'productos', cercano: true, foto: null, autor: AUTORES_DEMO[0], esMio: true, descripcion: 'Laptop de 15 pulgadas, SSD de 512 GB y batería que aguanta la jornada. Se entrega con el cargador original.', publicadoEn: haceHoras(2), detalle: { condicion: 'USADO' } },
  { id: 2, titulo: 'Reparación de celulares a domicilio', precio: 'Desde $15.00', ubicacion: 'Cuenca', pilar: 'servicios', cercano: true, foto: null, autor: AUTORES_DEMO[1], descripcion: 'Cambio de pantalla, batería y unlocking. Voy a donde estés dentro de la ciudad, sin costo de desplazamiento.', publicadoEn: haceHoras(9), detalle: { modalidadCobro: 'POR_HORA' } },
  { id: 3, titulo: 'Cajero para cafetería, tiempo completo', precio: '$550.00', ubicacion: 'Guayaquil', pilar: 'empleo', cercano: false, foto: null, autor: AUTORES_DEMO[2], descripcion: 'Turno de mañana en cafeteria del centro. Buscamos alguien con buena atención y manejo de caja.', publicadoEn: haceHoras(26), detalle: { jornada: 'TIEMPO_COMPLETO', modalidad: 'PRESENCIAL' } },
  { id: 4, titulo: 'Colección de cómics, edición local', precio: '$90.00', ubicacion: 'Loja', pilar: 'productos', cercano: false, foto: null, autor: AUTORES_DEMO[3], descripcion: 'Ocho números de la colección local, todos en buen estado y con sus páginas completas.', publicadoEn: haceHoras(30), detalle: { condicion: 'USADO' } },
  { id: 5, titulo: 'Clases de guitarra, nivel principiante', precio: '$12.00 la hora', ubicacion: 'Ambato', pilar: 'servicios', cercano: true, foto: null, autor: AUTORES_DEMO[1], descripcion: 'Dos horas por sesión en mi casa o en la tuya. Trae tu guitarra o te presto una.', publicadoEn: haceHoras(40), detalle: { modalidadCobro: 'POR_HORA', zonaCobertura: 'Ambato centro' } },
  { id: 6, titulo: 'Carpintero para muebles a medida', precio: '$25.00 la hora', ubicacion: 'Riobamba', pilar: 'empleo', cercano: false, foto: null, autor: AUTORES_DEMO[0], descripcion: 'Busco carpintero con experiencia en muebles de cocina para un proyecto de dos meses.', publicadoEn: haceHoras(52), detalle: { jornada: 'POR_TEMPORADA', modalidad: 'PRESENCIAL' } },
  { id: 7, titulo: 'Kit de herramientas, uso profesional', precio: '$140.00', ubicacion: 'Manta', pilar: 'productos', cercano: false, foto: null, autor: AUTORES_DEMO[3], descripcion: 'Set de destornilladores, llaves y alicates en bolsa de lona. Se vende completo.', publicadoEn: haceHoras(70), detalle: { condicion: 'USADO' } },
  { id: 8, titulo: 'Paseo de mascotas, quincenal', precio: '$35.00', ubicacion: 'Quito', pilar: 'servicios', cercano: true, foto: null, autor: AUTORES_DEMO[1], descripcion: 'Paseo de una hora para perros de tamaño mediano o pequeño, con foto y reporte al dueño.', publicadoEn: haceHoras(96), detalle: { modalidadCobro: 'POR_PROYECTO' } },
  { id: 9, titulo: 'Recepcionista bilingüe, turno tarde', precio: '$480.00', ubicacion: 'Machala', pilar: 'empleo', cercano: false, foto: null, autor: AUTORES_DEMO[2], descripcion: 'Atención al cliente y recepción en hotel del centro. Se requiere inglés intermedio.', publicadoEn: haceHoras(120), detalle: { jornada: 'MEDIO_TIEMPO', modalidad: 'PRESENCIAL' } },
];

/**
 * Rejilla que se adapta al ancho disponible, como Marketplace: con el menú
 * oculto o en una pantalla grande caben más columnas solas, sin saltos fijos.
 * El mínimo de 158 px deja dos por fila en un celular de 360 px.
 */
const CLASE_REJILLA =
  'grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-x-4 sm:gap-y-7';
/** En lista, una publicación por fila, con aire entre ellas. */
const CLASE_LISTA = 'grid-cols-1 gap-4';

/** Las dos formas de mostrar el feed, como las dos de Facebook. */
const VISTAS: { id: VistaAnuncios; label: string }[] = [
  { id: 'rejilla', label: 'Rejilla' },
  { id: 'lista', label: 'Lista' },
];

interface Props {
  sesion: Sesion;
  /** Perfil ampliado (GET /me): mantiene la foto al día tras editar. */
  perfil: PerfilUsuario | null;
  /**
   * Anuncio abierto al entrar, por id, para la ruta /anuncio/:id.
   *
   * La ficha pide su propio anuncio al backend, así que abrir un enlaceshared
   * funciona aunque ese anuncio no esté en la página que se cargó: no se depende
   * de que la lista lo trajera.
   */
  anuncioInicial?: number | null;
  /** Cambia la URL al abrir o cerrar un anuncio, para que el enlace sea real. */
  onCambiarAnuncioAbierto?: (id: number | null) => void;
  /**
   * Abre el perfil de quien publicó. Si la ficha estaba abierta, el botón de
   * atrás vuelve a ella, que es lo que se espera al ir y volver de un perfil.
   */
  onAbrirPerfil?: (semilla: SemillaPerfil) => void;
}

/** Aviso de carga: el logo animado de la marca, igual que en toda la app. */
function Esqueletos() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-white">
      <BaknazoLoader tamano="seccion" mensaje="Buscando anuncios" />
    </div>
  );
}

export default function FeedScreen({
  sesion,
  perfil,
  anuncioInicial = null,
  onCambiarAnuncioAbierto,
  onAbrirPerfil,
}: Props) {
  /* ---------- Filtros: viven en la URL ---------- */

  const [parametros, setParametros] = useSearchParams();
  const filtros = useMemo(() => leerFiltros(parametros), [parametros]);
  const catalogos = useCatalogos();
  const [panelFiltros, setPanelFiltros] = useState(false);

  /** Cambia los filtros. `reemplazar` para lo que no merece una entrada en el historial (teclear). */
  const aplicarFiltros = (siguientes: FiltrosUrl, reemplazar = false) => {
    setParametros(escribirFiltros(siguientes), { replace: reemplazar });
    if (!reemplazar) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * El texto del buscador va a la URL con 400 ms de espera, para no hacer una
   * búsqueda por cada tecla. Si la URL cambia por otro lado (el botón de
   * atrás, un enlace del menú), el campo se pone al día con ella.
   */
  const [busqueda, setBusqueda] = useState(filtros.q);
  const [qVista, setQVista] = useState(filtros.q);
  if (qVista !== filtros.q) {
    setQVista(filtros.q);
    setBusqueda(filtros.q);
  }
  useEffect(() => {
    if (busqueda.trim() === filtros.q.trim()) return;
    const t = setTimeout(() => {
      setParametros(escribirFiltros({ ...filtros, q: busqueda }), { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda, filtros, setParametros]);

  /* ---------- Cerca de ti ---------- */

  const [punto, setPunto] = useState<Punto | null>(ubicacionGuardada);

  const activarCerca = async (): Promise<boolean> => {
    try {
      setPunto(await pedirUbicacion());
      return true;
    } catch (e) {
      notificarAviso(e instanceof Error ? e.message : 'No pudimos saber dónde estás.');
      return false;
    }
  };

  const alternarCerca = async () => {
    if (filtros.cerca) {
      aplicarFiltros({ ...filtros, cerca: null, orden: 'recientes' });
      return;
    }
    if (await activarCerca()) aplicarFiltros({ ...filtros, cerca: 25, orden: 'cercanos' });
  };

  /* Un enlace con `?cerca=10` abierto en otra visita no trae las coordenadas
     (a propósito, no van en la URL): se piden una vez y, si no se dan, el
     filtro se quita en vez de quedarse puesto sin efecto. */
  const pidioAlEntrar = useRef(false);
  useEffect(() => {
    if (!filtros.cerca || punto || pidioAlEntrar.current) return;
    pidioAlEntrar.current = true;
    pedirUbicacion()
      .then(setPunto)
      .catch(() => {
        notificarInfo('Sin tu ubicación no podemos mostrar lo cercano. Filtra por ciudad.');
        setParametros(escribirFiltros({ ...filtros, cerca: null, orden: 'recientes' }), { replace: true });
      });
  }, [filtros, punto, setParametros]);
  /** Rejilla o lista. Se lee del storage para no perderla al recargar. */
  const [vista, setVista] = useState<VistaAnuncios>(leerVistaAnuncios);
  const [guardados, setGuardados] = useState<Set<number>>(new Set());
  /**
   * Anuncios con una llamada de like en vuelo, para que un doble toque no
   * mande dos peticiones. Con las rutas idempotentes el servidor lo aguantaría,
   * pero el contador parpadearía al volver cada respuesta, que es lo que se ve.
   */
  const [likrando, setLikrando] = useState<Set<number>>(new Set());
  /** Anuncios con la petición del teléfono en vuelo, para no repetirla. */
  const [pidiendoTelefono, setPidiendoTelefono] = useState<Set<number>>(new Set());

  /**
   * El contacto del modal: `{ anuncio, respuesta }` y no solo la respuesta,
   * porque el título necesita el nombre de quien publicó. Vive aquí y no en la
   * tarjeta porque la tarjeta no sabe de dónde salió el número.
   */
  const [contacto, setContacto] = useState<{
    anuncio: AnuncioTarjeta;
    respuesta: RespuestaContacto;
  } | null>(null);
  /**
   * Los ids de los anuncios de quien está mirando, tal como los tiene el
   * dispositivo. Se releen al cambiar de cuenta, porque pueden haberse anotado en
   * otra pantalla (publicar, entrar a "Mis anuncios"), y con ellos el feed deja de
   * ofrecer un chat con los anuncios propios.
   */
  const usuarioId = sesion?.usuario.id;
  const propios = useMemo(
    () => (usuarioId ? leerPropios() : new Set<number>()),
    [usuarioId]
  );
  const { irAPublicar, irAConfiguracion, irAMiPerfil } = useNavegacion();

  /** Abre la ficha y pone el id en la URL, para que el enlace sea compartible. */
  const abrirFicha = (anuncio: AnuncioTarjeta) => {
    onCambiarAnuncioAbierto?.(anuncio.id);
  };

  const cerrarFicha = () => {
    onCambiarAnuncioAbierto?.(null);
  };

  /**
   * Ir al perfil de quien publicó. La URL solo lleva el id: es lo compartible.
   *
   * No se cierra la ficha antes: cerrar es un "atrás" en el historial, y
   * navegar justo después competía con él. Al cambiar de ruta la ficha
   * desaparece sola, y el botón de atrás vuelve a mostrarla.
   */
  const abrirPerfil = (semilla: SemillaPerfil) => {
    onAbrirPerfil?.(semilla);
  };

  /**
   * El perfil de un autor de la lista.
   *
   * La clave de la URL es `autor.id` —el id de la cuenta— cuando el backend lo
   * manda. En producción todavía no lo manda, así que mientras tanto se usa el
   * id del anuncio: el resultado es un perfil coherente, con el anuncio que se
   * está viendo de primero, en vez de un enlace que no lleva a ninguna parte.
   */
  const abrirAutor = (anuncio: AnuncioTarjeta) => () => abrirPerfil(semillaDe(anuncio));
  /**
   * Cambiar de rejilla a lista redibuja los mismos anuncios con otra altura, y el
   * navegador se queda en el mismo píxel: en un caso te salta hacia atrás y en el
   * otro, al final, porque ya no hay tanto contenido y no le queda.scroll
   *
   * La solución es no guardar el píxel sino la referencia: el primer anuncio que
   * se estaba viendo y a qué distancia del borde superior estaba. Al volver a
   * pintar, ese mismo anuncio se deja en el mismo sitio y el resto se acomoda
   * alrededor, que es lo que se espera al cambiar de vista.
   */
  const cambiarVista = (nueva: VistaAnuncios) => {
    if (nueva === vista) return;

    // Un poco de margen: cuenta como "primer anuncio visible" el primero que
    // asoma por debajo de la barra, no solo el que ya está cortado.
    const margen = 160;
    const tarjetas = Array.from(
      document.querySelectorAll<HTMLElement>('[data-anuncio]')
    );
    let ancla: { id: string; desplazamiento: number } | null = null;
    for (const tarjeta of tarjetas) {
      const id = tarjeta.dataset.anuncio;
      if (!id) continue;
      const top = tarjeta.getBoundingClientRect().top;
      if (top <= margen) {
        ancla = { id, desplazamiento: top };
      } else break;
    }

    setVista(nueva);

    if (!ancla) return;
    requestAnimationFrame(() => {
      const destino = document.querySelector<HTMLElement>(
        `[data-anuncio="${ancla.id}"]`
      );
      if (!destino) return;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      // Se usa la posición absoluta de la tarjeta y no la de `getBoundingClient
      // Rect`, porque al pintar ya no hay ningún scroll que compensar.
      const arriba = destino.getBoundingClientRect().top + window.scrollY;
      // La barra de marca es fija, así que el sitio de la tarjeta hay que
      // medido desde el borde de abajo de la barra y no desde el borde de la
      // pantalla. Sin esto, la tarjeta que estaba asomando por arriba vuelve a
      // asomar por arriba, pero debajo de la barra, y el cambio de vista parece
      // que se ha comido la primera fila.
      const desdeArriba = Math.max(ALTO_CABECERA, ancla.desplazamiento);
      window.scrollTo({
        top: Math.min(Math.max(0, arriba - desdeArriba), Math.max(0, total)),
        behavior: 'instant' as ScrollBehavior,
      });
    });
  };

  /* ---------- Feed desde la API ---------- */

  const [anuncios, setAnuncios] = useState<AnuncioTarjeta[]>([]);
  /**
   * Para qué combinación de filtros es la lista que se ve. "Cargando" no es un
   * estado aparte: es que la lista no corresponde todavía a los filtros de la
   * URL, y así no hay que encenderlo a mano dentro de un efecto.
   */
  const claveCarga = `${escribirFiltros(filtros).toString()}|${
    filtros.cerca && punto ? `${punto.lat},${punto.lng}` : ''
  }`;
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  const cargando = cargadoPara !== claveCarga;
  const [cargandoMas, setCargandoMas] = useState(false);
  /** La página siguiente falló: se para el scroll infinito y se ofrece reintentar. */
  const [errorMas, setErrorMas] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  /** true cuando se está mostrando la lista de respaldo por fallo de red. */
  const [sinConexion, setSinConexion] = useState(false);

  /**
   * El anuncio abierto sale de la URL, no de un estado propio.
   *
   * Antes vivía en `useState` y la URL no se enteraba: el enlace de lo que
   * estabas mirando era siempre el del feed, y recargar te devolvía al listado.
   * Ahora la ruta manda y el estado se deriva de ella, así que no hay dos
   * verdades que puedan contradecirse: copiar la barra de direcciones siempre
   * lleva al anuncio que se está viendo.
   *
   * Los datos que solo trae la lista (la distancia, el like) se buscan en ella.
   * Si el anuncio no está en la página cargada —un enlace compartido, por
   * ejemplo— se abre solo con el id: la ficha pide su propio anuncio al backend
   * y no depende de que el listado lo trajera. Por eso el tipo es solo un
   * `Pick`: de este valor la ficha necesita el id y, si están, esos extras.
   */
  const abierto = useMemo<AnuncioAbierto | null>(() => {
    if (anuncioInicial == null) return null;
    return anuncios.find((a) => a.id === anuncioInicial) ?? { id: anuncioInicial };
  }, [anuncioInicial, anuncios]);

  /* La preferencia de vista se guarda al cambiar, no al montar: escribir en el
     storage en cada render de la pantalla no compra nada. */
  useEffect(() => {
    guardarVistaAnuncios(vista);
  }, [vista]);

  /* El nombre y la foto de la cuenta los resuelve `MenuCuenta`; aquí solo hace
     falta el nombre corto, que es el saludo de arriba. */
  const nombre = ((perfil?.nombres ?? sesion.usuario.nombres) ?? '')
    .trim()
    .split(/\s+/)[0] || 'María';

  /* El título dice qué se está viendo: una categoría, una búsqueda, o el saludo. */
  const categoriaActual = catalogos?.categorias.find((c) => c.id === filtros.categoria) ?? null;
  const titulo = filtros.q.trim()
    ? `Resultados para «${filtros.q.trim()}»`
    : categoriaActual
      ? categoriaActual.nombre
      : filtros.pilar
        ? NOMBRE_PILAR[filtros.pilar]
        : `Hola, ${nombre}`;
  const ciudad = nombreDeCanton(catalogos, filtros.canton ?? undefined);
  const subtitulo = filtros.cerca
    ? `A menos de ${filtros.cerca} km de ti, de lo más cercano a lo más lejano.`
    : ciudad
      ? `Anuncios en ${ciudad}.`
      : categoriaActual && filtros.pilar
        ? `${NOMBRE_PILAR[filtros.pilar]} · lo más reciente primero.`
        : 'Compra, vende y contrata en tu ciudad.';

  const visibles = useMemo(() => {
    // Todo el filtrado va al servidor. Solo los datos de respaldo (sin
    // conexión) se filtran aquí, y solo por lo que tienen: pilar y texto.
    if (sinConexion) {
      const texto = filtros.q.trim().toLowerCase();
      return ANUNCIOS_DEMO.filter(
        (anuncio) =>
          (!filtros.pilar || anuncio.pilar === filtros.pilar) &&
          (!texto || anuncio.titulo.toLowerCase().includes(texto))
      );
    }
    return anuncios;
  }, [anuncios, filtros.pilar, filtros.q, sinConexion]);

  /**
   * Carga la primera página cada vez que cambian los filtros de la URL.
   *
   * Si llegan dos respuestas desordenadas (filtros cambiados rápido en datos
   * móviles), solo cuenta la de la última petición: antes una respuesta vieja
   * podía pisar a la nueva y enseñar resultados de otro filtro.
   */
  const ultimaPeticion = useRef(0);
  useEffect(() => {
    const numero = ++ultimaPeticion.current;
    listarAnuncios({ ...aConsulta(filtros, punto), limite: 20 })
      .then((respuesta) => {
        if (numero !== ultimaPeticion.current) return;
        setAnuncios(respuesta.items.map((a) => aTarjeta(a, a.distanciaKm, propios)));
        setGuardados(new Set(respuesta.items.filter((a) => a.guardado).map((a) => a.id)));
        setCursor(respuesta.pagina.siguienteCursor);
        setHayMas(respuesta.pagina.hayMas);
        setErrorMas(false);
        setSinConexion(false);
      })
      .catch(() => {
        // Sin API se muestran los datos de respaldo y un aviso, no un
        // pantalla en blanco que parece un error del usuario.
        if (numero !== ultimaPeticion.current) return;
        setSinConexion(true);
        setHayMas(false);
      })
      .finally(() => {
        if (numero === ultimaPeticion.current) setCargadoPara(claveCarga);
      });
    // `filtros` y `punto` ya están resumidos en `claveCarga`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveCarga, propios]);

  /**
   * Paginación por cursor, como en Facebook: al acercarse al final se pide la
   * página siguiente sola y se anexa. Si falla, se para y aparece un botón para
   * reintentar, en vez de insistir en bucle con datos móviles.
   */
  const cargarMas = async () => {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    setErrorMas(false);
    try {
      const respuesta = await listarAnuncios({
        ...aConsulta(filtros, punto),
        cursor,
        limite: 20,
      });
      setAnuncios((previos) => {
        // Un anuncio publicado entre página y página no debe salir dos veces.
        const vistos = new Set(previos.map((a) => a.id));
        return [
          ...previos,
          ...respuesta.items
            .filter((a) => !vistos.has(a.id))
            .map((a) => aTarjeta(a, a.distanciaKm, propios)),
        ];
      });
      setGuardados((prev) => {
        const copia = new Set(prev);
        for (const a of respuesta.items) if (a.guardado) copia.add(a.id);
        return copia;
      });
      setCursor(respuesta.pagina.siguienteCursor);
      setHayMas(respuesta.pagina.hayMas);
    } catch {
      setErrorMas(true);
    } finally {
      setCargandoMas(false);
    }
  };
  const centinela = useScrollInfinito(
    cargarMas,
    hayMas && !cargandoMas && !errorMas && !cargando && !sinConexion
  );

  /**
   * El anuncio recién publicado no se pasa por props: al volver de la pantalla
   * de publicación el feed se monta y pide la primera página, que ya lo
   * incluye. Un canal extra para "inyectarlo" sería estado que puede quedar
   * viejo y ganarle a la respuesta fresca del servidor.
   */

  /**
   * Dar o quitar like, y dejar la lista al día con lo que devuelve el backend.
   *
   * El cambio optimista lo pinta la tarjeta y la ficha al instante; esta función
   * solo se encarga de la llamada y de escribir la respuesta.
   *
   * Devuelve `false` si la llamada falló, y eso es lo que permite que quien la
   * pinte revierta su cambio. Un pulgar que queda marcado sin que el servidor lo
   * sepa es peor que uno que tarda medio segundo: parece un fallo y además
   * engaña sobre lo que está guardado.
   */
  const alternarMeGusta = async (anuncio: AnuncioAbierto): Promise<boolean> => {
    if (likrando.has(anuncio.id)) return false;
    setLikrando((prev) => new Set(prev).add(anuncio.id));
    const dar = !(anuncio.meGusta ?? false);
    try {
      const respuesta = dar ? await darLike(anuncio.id) : await quitarLike(anuncio.id);
      setAnuncios((previos) =>
        previos.map((a) =>
          a.id === anuncio.id
            ? { ...a, likes: respuesta.likes, meGusta: respuesta.meGusta }
            : a
        )
      );
      return true;
    } catch (e) {
      notificarError(
        (e as Error)?.message ?? 'No se pudo guardar tu me gusta. Inténtalo otra vez.'
      );
      return false;
    } finally {
      setLikrando((prev) => {
        const copia = new Set(prev);
        copia.delete(anuncio.id);
        return copia;
      });
    }
  };

  /**
   * Pide el teléfono de un anuncio desde la lista y lo deja a la vista.
   *
   * El número no viene en el listado, a propósito: sale de
   * `POST /api/anuncios/:id/contacto`, que exige sesión, para que nadie pueda
   * recorrer los ids quedándose con todos los números. Por eso hace falta un
   * botón en vez de un campo: la lista lo enseña sin abrir el anuncio, pero solo
   * si quien mira lo pide.
   *
   * El número no se queda en la tarjeta: el modal lo muestra mientras está
   * abierto y al cerrar se tira. Es lo que hace que "revelar" signifique algo —
   * si se guardara, la fila expondría un número suelto por pantalla sin que
   * nadie lo pidiera, que es justo lo que el reveal evita.
   */
  const verTelefono = async (anuncio: AnuncioTarjeta) => {
    if (pidiendoTelefono.has(anuncio.id)) return;
    setPidiendoTelefono((prev) => new Set(prev).add(anuncio.id));
    try {
      const respuesta = await registrarContacto(anuncio.id);
      // `disponible: false` no es un error: es un resultado, y por eso el backend
      // responde 200. El modal enseña el motivo en vez de fingir un número.
      setContacto({ anuncio, respuesta });
    } catch (e) {
      notificarError(
        (e as Error)?.message ?? 'No se pudo mostrar el número de contacto.'
      );
    } finally {
      setPidiendoTelefono((prev) => {
        const copia = new Set(prev);
        copia.delete(anuncio.id);
        return copia;
      });
    }
  };

  /**
   * Guardar o quitar de Guardados. Se pinta al instante y, si el servidor
   * falla, se deshace: el marcador tiene que decir lo que está guardado.
   */
  const alternarGuardado = async (anuncio: AnuncioAbierto) => {
    const yaGuardado = guardados.has(anuncio.id);
    const cambiar = (guardar: boolean) =>
      setGuardados((prev) => {
        const copia = new Set(prev);
        if (guardar) copia.add(anuncio.id);
        else copia.delete(anuncio.id);
        return copia;
      });
    cambiar(!yaGuardado);
    // El título solo lo hay si el anuncio venía de la lista. Entrando por un
    // enlace puede no estar, y un aviso sin nombre es mejor que uno que minta.
    const nombre = anuncio.titulo ? `«${anuncio.titulo}»` : 'el anuncio';
    try {
      if (yaGuardado) {
        await quitarGuardado(anuncio.id);
        notificarInfo(`Quitaste ${nombre} de Guardados.`);
      } else {
        await guardarAnuncio(anuncio.id);
        notificarExito(`Guardaste ${nombre}. Lo encuentras en Guardados.`);
      }
    } catch (e) {
      cambiar(yaGuardado);
      notificarError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo otra vez.');
    }
  };

  /**
   * Cuánto le falta al perfil, con datos reales en vez de un 60 % fijo.
   *
   * Solo cuenta lo que de verdad ayuda a vender: que se te vea la cara (o el
   * logo), que haya un número para contactarte, un correo verificado y una
   * portada. Cuando está todo, la tarjeta desaparece: no hay nada que pedir.
   */
  const pendientes = useMemo(() => {
    if (!perfil) return null;
    const esNegocio = perfil.tipo_cuenta === 'NEGOCIO';
    const tareas = [
      { hecho: Boolean(perfil.foto_perfil_url ?? perfil.foto_perfil), texto: 'tu foto' },
      {
        hecho: Boolean(
          perfil.contacto?.telefono ||
            (esNegocio && (perfil.negocio?.telefono || perfil.negocio?.whatsapp))
        ),
        texto: 'un teléfono',
      },
      { hecho: perfil.correo_verificado, texto: 'tu correo verificado' },
      { hecho: Boolean(perfil.foto_portada_url ?? perfil.foto_portada), texto: 'una portada' },
    ];
    const hechas = tareas.filter((t) => t.hecho).length;
    return {
      porcentaje: Math.round((hechas / tareas.length) * 100),
      faltan: tareas.filter((t) => !t.hecho).map((t) => t.texto),
    };
  }, [perfil]);

  const buscador = (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-white px-4 text-muted focus-within:border-accent/50 lg:max-w-[560px]">
      <IconoLupa />
      <input
        type="search"
        placeholder="Buscar productos, servicios o empleo"
        aria-label="Buscar anuncios"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        onKeyDown={(event) => {
          // Enter busca ya, sin esperar la pausa.
          if (event.key === 'Enter') aplicarFiltros({ ...filtros, q: busqueda });
        }}
        className="h-10 w-full bg-transparent text-[14px] text-foreground placeholder:text-muted focus:outline-none"
      />
    </label>
  );

  return (
    <MarcoApp
      centro={<div className="hidden min-w-0 flex-1 sm:flex">{buscador}</div>}
      acciones={
        <button
          type="button"
          aria-label="Notificaciones"
          onClick={() => notificarInfo('Las notificaciones llegan muy pronto.')}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-foreground"
        >
          <IconoCampana />
        </button>
      }
    >
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-start gap-6 px-4 pt-5 pb-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* En lista, la columna se centra a un ancho de lectura, como el feed de
            Facebook: a todo el ancho, cada foto medía media pantalla. */}
        <main className={vista === 'lista' ? 'mx-auto w-full max-w-[680px] min-w-0' : 'min-w-0'}>
          {/* En móvil la cabecera no tiene sitio para el buscador, así que va
              aquí arriba, que es donde el pulgar lo busca primero. */}
          <div className="mb-4 flex sm:hidden">{buscador}</div>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground">
                {titulo}
              </h1>
              <p className="mt-1 text-[13.5px] text-muted">{subtitulo}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Rejilla o lista. Va arriba a la derecha, donde Facebook pone
                  este mismo control, y no junto a los filtros: cambiar cómo se
                  ven los anuncios no es filtrarlos. */}
              <div
                role="group"
                aria-label="Cómo mostrar los anuncios"
                className="flex items-center gap-1 rounded-xl border border-border bg-white p-1"
              >
                {VISTAS.map((opcion) => {
                  const activo = vista === opcion.id;
                  return (
                    <button
                      key={opcion.id}
                      type="button"
                      onClick={() => cambiarVista(opcion.id)}
                      aria-pressed={activo}
                      aria-label={opcion.label}
                      title={opcion.label}
                      className={`grid size-8 place-items-center rounded-lg transition-colors ${
                        activo
                          ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(31,41,55,0.14)]'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      {opcion.id === 'rejilla' ? <IconoRejilla /> : <IconoLista />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {sinConexion && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-brand/25 bg-brand/10 px-4 py-3 text-[12.5px] leading-snug text-foreground">
              <span className="mt-0.5 shrink-0 text-brand-dark">
                <IconoAlerta />
              </span>
              <span>
                No se pudo conectar con el servidor, así que se muestran datos de
                prueba.
              </span>
            </p>
          )}

          <BarraFiltros
            filtros={filtros}
            catalogos={catalogos}
            onCambiar={aplicarFiltros}
            onAbrirPanel={() => setPanelFiltros(true)}
            onAlternarCerca={alternarCerca}
          />

          {cargando && (visibles.length === 0 || sinConexion) ? (
            <Esqueletos />
          ) : visibles.length === 0 ? (
            <SinResultados
              filtros={filtros}
              onCambiar={aplicarFiltros}
              onLimpiar={() => aplicarFiltros({ ...FILTROS_VACIOS })}
            />
          ) : (
            <>
              <div
                className={`mt-5 grid ${vista === 'lista' ? CLASE_LISTA : CLASE_REJILLA}`}
              >
                {visibles.map((anuncio) => {
                  const guardado = guardados.has(anuncio.id);
                  return (
                    <TarjetaAnuncio
                      key={anuncio.id}
                      pilar={anuncio.pilar}
                      titulo={anuncio.titulo}
                      precio={anuncio.precio}
                      ubicacion={anuncio.ubicacion}
                      foto={anuncio.foto}
                      guardado={guardado}
                      onAlternarGuardado={() => alternarGuardado(anuncio)}
                      // La ficha se abre desde la rejilla. En lista la publicación
                      // ya muestra todo lo que la ficha enseña, así que abrirla sería
                      // repetir lo mismo con un paso de más; y sin `onAbrir` la
                      // tarjeta no pone el enlace estirado que se comería los clics
                      // del pulgar, del guardar y de las fotos.
                      onAbrir={vista === 'rejilla' ? () => abrirFicha(anuncio) : undefined}
                      onVerDetalle={() => abrirFicha(anuncio)}
                      onPostular={anuncio.pilar === 'empleo' ? () => abrirFicha(anuncio) : undefined}
                      contarVista={!sinConexion}
                      vista={vista}
                      id={anuncio.id}
                      autor={anuncio.autor}
                      descripcion={anuncio.descripcion}
                      categoria={anuncio.categoria}
                      detalle={anuncio.detalle}
                      publicadoEn={anuncio.publicadoEn}
                      fotos={anuncio.fotos}
                      vistas={anuncio.vistas}
                      contactos={anuncio.contactos}
                      distanciaKm={anuncio.distanciaKm}
                      esMio={anuncio.esMio}
                      meGusta={anuncio.meGusta}
                      likes={anuncio.likes}
                      vendido={anuncio.vendido}
                      onAlternarMeGusta={() => alternarMeGusta(anuncio)}
                      onAbrirPerfil={abrirAutor(anuncio)}
                      // El teléfono se pide al backend con un toque y se queda en
                      // la tarjeta; el listado nunca lo trae.
                      puedeVerTelefono={anuncio.puedeVerTelefono}
                      mostrarTelefono={anuncio.mostrarTelefono}
                      onContactar={() => verTelefono(anuncio)}
                      pidiendoTelefono={pidiendoTelefono.has(anuncio.id)}
                      distintivo={
                        anuncio.cercano && filtros.cerca !== null ? 'cerca' : undefined
                      }
                    />
                  );
                })}
              </div>

              {/* Scroll infinito: el centinela pide la página siguiente antes de
                  llegar al final, y mientras llega se ven publicaciones con la
                  misma forma que las reales. */}
              {cargandoMas && (
                <div className={`mt-6 grid ${vista === 'lista' ? CLASE_LISTA : CLASE_REJILLA}`}>
                  {Array.from({ length: vista === 'lista' ? 2 : 4 }, (_, i) => (
                    <EsqueletoAnuncio key={i} vista={vista} />
                  ))}
                </div>
              )}
              <div ref={centinela} aria-hidden="true" className="h-px" />
              {errorMas && (
                <div className="mt-6 flex flex-col items-center gap-2 text-center">
                  <p className="text-[13px] text-muted">No se pudieron cargar más anuncios.</p>
                  <button
                    type="button"
                    onClick={cargarMas}
                    className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {!hayMas && !sinConexion && anuncios.length > 8 && (
                <p className="mt-8 text-center text-[13px] text-muted">
                  Ya viste todo lo publicado con estos filtros.
                </p>
              )}
            </>
          )}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            {pendientes && pendientes.porcentaje < 100 && (
              <section className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                    Completa tu perfil
                  </h2>
                  <span className="text-[13px] font-semibold text-success-deep tabular-nums">
                    {pendientes.porcentaje} %
                  </span>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-background"
                  role="progressbar"
                  aria-label="Progreso del perfil"
                  aria-valuenow={pendientes.porcentaje}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${pendientes.porcentaje}%` }}
                  />
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Te falta {pendientes.faltan.join(', ')}. Un perfil completo
                  inspira confianza y vende antes.
                </p>
                <button
                  type="button"
                  // La portada se pone desde el perfil; lo demás, en Configuración.
                  onClick={
                    pendientes.faltan.length === 1 && pendientes.faltan[0] === 'una portada'
                      ? irAMiPerfil
                      : irAConfiguracion
                  }
                  className="mt-3 text-[13.5px] font-semibold text-accent transition-colors hover:text-accent-dark"
                >
                  Completar ahora →
                </button>
              </section>
            )}

            <section className="rounded-2xl bg-carbon p-5 text-white">
              <h2 className="text-[15px] font-semibold tracking-tight">
                ¿Tienes algo que vender?
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                Publica gratis en menos de 2 minutos, sin comisiones.
              </p>
              <button
                type="button"
                onClick={irAPublicar}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[13.5px] font-medium text-foreground transition-colors hover:bg-brand-dark"
              >
                <IconoMas />
                Publicar anuncio
              </button>
            </section>
          </div>
        </aside>
      </div>

      {abierto && (
        <DetalleAnuncioModal
          id={abierto.id}
          distanciaKm={abierto.distanciaKm ?? null}
          // La lista es la dueña de los guardados, así que la ficha no los
          // calcula: le pasa el estado y le devuelve el clic.
          guardado={guardados.has(abierto.id)}
          onAlternarGuardado={() => alternarGuardado(abierto)}
          // Igual que los guardados: la lista es la dueña del like y le pasa el
          // estado. La ficha solo lo refleja, así que el pulgar de la tarjeta y
          // el de la ficha nunca muestran números distintos.
          meGusta={abierto.meGusta}
          likes={abierto.likes}
          onAlternarMeGusta={() => alternarMeGusta(abierto)}
          onAbrirPerfil={abrirPerfil}
          onCerrar={cerrarFicha}
        />
      )}

      {panelFiltros && (
        <PanelFiltros
          filtros={filtros}
          catalogos={catalogos}
          onActivarCerca={activarCerca}
          onCerrar={() => setPanelFiltros(false)}
          onAplicar={(f) => {
            setPanelFiltros(false);
            aplicarFiltros(f);
          }}
        />
      )}

      {contacto && (
        <ModalContacto
          contacto={contacto.respuesta}
          nombreAutor={contacto.anuncio.autor?.nombre ?? 'quien lo publicó'}
          onEscribir={() => {
            // El chat todavía no existe, así que avisa igual que el botón de la
            // cabecera en vez de llevar a ninguna parte.
            notificarInfo(CHAT_PENDIENTE);
            setContacto(null);
          }}
          onCerrar={() => setContacto(null)}
        />
      )}
    </MarcoApp>
  );
}
/**
 * Qué decir cuando no hay nada, según por qué no hay nada.
 *
 * "Nada por aquí" a secas deja a la persona sin saber qué hacer. Con filtros
 * puestos se ofrece deshacerlos; con "Cerca de ti", ampliar el radio, porque
 * todavía son pocos los anuncios que comparten ubicación.
 */
function SinResultados({
  filtros,
  onCambiar,
  onLimpiar,
}: {
  filtros: FiltrosUrl;
  onCambiar: (f: FiltrosUrl) => void;
  onLimpiar: () => void;
}) {
  const hayFiltros = contarFiltros(filtros) > 0 || filtros.q.trim() !== '' || filtros.pilar !== null;

  let titulo = 'Todavía no hay anuncios';
  let texto = 'Sé la primera persona en publicar algo en Baknazo.';
  if (filtros.cerca) {
    titulo = `Nada a menos de ${filtros.cerca} km`;
    texto =
      'Aún son pocos los anuncios que comparten su ubicación. Amplía la distancia o busca por ciudad.';
  } else if (hayFiltros) {
    titulo = 'Ningún anuncio coincide';
    texto = 'Prueba con menos filtros o con otras palabras.';
  }

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
      <p className="text-[16px] font-semibold text-foreground">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">{texto}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {filtros.cerca !== null && filtros.cerca < 100 && (
          <button
            type="button"
            onClick={() => onCambiar({ ...filtros, cerca: 100 })}
            className="h-10 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Ampliar a 100 km
          </button>
        )}
        {hayFiltros && (
          <button
            type="button"
            onClick={onLimpiar}
            className="h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-semibold text-foreground transition-colors hover:border-muted"
          >
            Quitar todos los filtros
          </button>
        )}
      </div>
    </div>
  );
}