import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { categoriasDe, useCatalogos, useResumenCatalogo } from '../lib/catalogos';
import { ESTILO_PILAR, NOMBRE_PILAR, type Pilar } from '../lib/pilares';
import CabeceraBaknazo from './CabeceraBaknazo';
import Emblema from './Emblema';
import MenuCuenta from './MenuCuenta';
import {
  IconoAjustes,
  IconoBocadillo,
  IconoBrujula,
  IconoCasa,
  IconoChevron,
  IconoMaletin,
  IconoCerrar,
  IconoEtiqueta,
  IconoGuardar,
  IconoMas,
  IconoMenu,
  IconoPersona,
  IconoSalir,
} from './Iconos';
import { useBloqueoScroll } from '../lib/bloqueoScroll';
import { guardarMenuVisible, leerMenuVisible, useNavegacion } from '../lib/navegacion';
import { notificarInfo } from '../lib/notificar';

type Seccion =
  | 'inicio'
  | 'explorar'
  | 'mis-anuncios'
  | 'postulaciones'
  | 'guardados'
  | 'publicar'
  | 'perfil'
  | 'configuracion'
  | null;

/** Qué entrada del menú corresponde a la URL actual. */
function seccionDe(ruta: string, miId: string | null): Seccion {
  if (ruta === '/anuncios' || ruta.startsWith('/anuncio/')) return 'inicio';
  if (ruta.startsWith('/explorar')) return 'explorar';
  if (ruta.startsWith('/postulaciones')) return 'postulaciones';
  if (ruta.startsWith('/guardados')) return 'guardados';
  if (ruta.startsWith('/mis-anuncios')) return 'mis-anuncios';
  if (ruta.startsWith('/publicar')) return 'publicar';
  if (ruta.startsWith('/configuracion')) return 'configuracion';
  // Solo el perfil propio enciende "Mi perfil": el de otra persona no es tuyo.
  if (miId && ruta === `/perfil/${miId}`) return 'perfil';
  return null;
}

/** Punto a partir del cual el menú es una columna fija y no un cajón. */
const ESCRITORIO = '(min-width: 1024px)';

/**
 * El marco de todas las pantallas con sesión: cabecera, menú y barra inferior.
 *
 * Antes cada pantalla dibujaba su propia cabecera y su propio menú (tres
 * variantes, y en Configuración, Publicar y Editar ni siquiera había menú). Aquí
 * se declaran una vez y las pantallas solo ponen su contenido, así que el menú
 * es literalmente el mismo en todas partes.
 *
 * - **Escritorio**: columna lateral fija. El botón de tres rayas la oculta o la
 *   muestra, y la preferencia se recuerda entre pantallas y recargas.
 * - **Móvil**: el mismo botón abre la lista como cajón, y abajo queda la barra
 *   de pestañas al alcance del pulgar, como en cualquier red social.
 */
export default function MarcoApp({
  titulo,
  centro,
  acciones,
  children,
}: {
  titulo?: string;
  /** Buscador u otro control que ocupa el centro de la cabecera. */
  centro?: ReactNode;
  /** Botones propios de la pantalla, a la izquierda del de cuenta. */
  acciones?: ReactNode;
  children: ReactNode;
}) {
  const nav = useNavegacion();
  const { pathname } = useLocation();
  const [menuVisible, setMenuVisible] = useState(leerMenuVisible);
  const [cajon, setCajon] = useState(false);

  const miId = nav.sesion?.usuario.id ?? null;
  const seccion = seccionDe(pathname, miId);

  useBloqueoScroll(cajon);

  /* Al cambiar de ruta el cajón se cierra. Se ajusta en el render y no en un
     efecto para que la pantalla nueva no se pinte un instante con él abierto. */
  const [rutaVista, setRutaVista] = useState(pathname);
  if (rutaVista !== pathname) {
    setRutaVista(pathname);
    setCajon(false);
  }

  useEffect(() => {
    if (!cajon) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setCajon(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [cajon]);

  const alternarMenu = () => {
    if (window.matchMedia(ESCRITORIO).matches) {
      setMenuVisible((actual) => {
        guardarMenuVisible(!actual);
        return !actual;
      });
    } else {
      setCajon(true);
    }
  };

  return (
    <div className="min-h-svh">
      <CabeceraBaknazo
        izquierda={
          <button
            type="button"
            onClick={alternarMenu}
            aria-label={menuVisible ? 'Ocultar el menú' : 'Mostrar el menú'}
            aria-expanded={menuVisible}
            title={menuVisible ? 'Ocultar el menú' : 'Mostrar el menú'}
            className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-white"
          >
            <IconoMenu />
          </button>
        }
        titulo={titulo}
        centro={centro}
        acciones={
          <>
            {acciones}
            {nav.sesion ? (
              <>
                {seccion !== 'publicar' && (
                  <button
                    type="button"
                    onClick={nav.irAPublicar}
                    className="hidden h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-brand-dark md:inline-flex"
                  >
                    <IconoMas />
                    Publicar gratis
                  </button>
                )}
                <MenuCuenta />
              </>
            ) : (
              <button
                type="button"
                onClick={nav.irAlLogin}
                className="inline-flex h-10 shrink-0 items-center rounded-lg bg-brand px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
              >
                Entrar
              </button>
            )}
          </>
        }
      />

      <div className="flex">
        <aside
          aria-label="Menú principal"
          className={
            menuVisible
              ? 'sticky top-16 hidden h-[calc(100svh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border lg:block'
              : 'hidden'
          }
        >
          <ListaNavegacion seccion={seccion} />
        </aside>

        {/* El hueco de abajo es el de la barra de pestañas en móvil: sin él, la
            última fila de cualquier pantalla quedaría tapada. */}
        <div className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </div>
      </div>

      {nav.sesion && <BarraInferior seccion={seccion} />}

      {cajon && (
        <div className="fixed inset-0 z-55 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setCajon(false)}
            className="animate-bkn-velo absolute inset-0 cursor-default bg-carbon/45"
          />
          <div className="animate-bkn-cajon absolute inset-y-0 left-0 flex w-[min(84vw,300px)] flex-col bg-background shadow-[0_24px_48px_-24px_rgba(31,41,55,0.5)]">
            <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">
              <Emblema tamano={32} />
              <span className="text-[17px] font-semibold tracking-tight text-foreground">
                Baknazo
              </span>
              <button
                type="button"
                onClick={() => setCajon(false)}
                aria-label="Cerrar el menú"
                className="ml-auto grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-white hover:text-foreground"
              >
                <IconoCerrar />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ListaNavegacion seccion={seccion} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lo que aún no existe avisa en vez de llevar a una pantalla vacía. */
const pronto = (que: string) => () => notificarInfo(`${que} llega muy pronto.`);

/** La lista del menú, igual en la columna de escritorio y en el cajón de móvil. */
function ListaNavegacion({ seccion }: { seccion: Seccion }) {
  const nav = useNavegacion();

  if (!nav.sesion) {
    return (
      <nav className="space-y-1 p-3">
        <p className="px-2 pt-1 pb-3 text-[13px] leading-snug text-muted">
          Entra para publicar, seguir a vendedores y guardar anuncios.
        </p>
        <button
          type="button"
          onClick={nav.irAlLogin}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
        >
          Entrar o crear cuenta
        </button>
      </nav>
    );
  }

  return (
    <nav className="flex min-h-full flex-col p-3">
      <button
        type="button"
        onClick={nav.irAPublicar}
        className="mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
      >
        <IconoMas />
        Publicar gratis
      </button>

      <ul className="space-y-0.5">
        <Entrada icono={<IconoCasa />} activa={seccion === 'inicio'} onClick={nav.irAlFeed}>
          Inicio
        </Entrada>
        <Entrada icono={<IconoBrujula />} activa={seccion === 'explorar'} onClick={nav.irAExplorar}>
          Explorar
        </Entrada>
        <Entrada
          icono={<IconoEtiqueta />}
          activa={seccion === 'mis-anuncios'}
          onClick={nav.irAMisAnuncios}
        >
          Mis anuncios
        </Entrada>
        <Entrada
          icono={<IconoMaletin />}
          activa={seccion === 'postulaciones'}
          onClick={nav.irAPostulaciones}
        >
          Postulaciones
        </Entrada>
        <Entrada icono={<IconoPersona />} activa={seccion === 'perfil'} onClick={nav.irAMiPerfil}>
          Mi perfil
        </Entrada>
        <Entrada icono={<IconoGuardar />} activa={seccion === 'guardados'} onClick={nav.irAGuardados}>
          Guardados
        </Entrada>
        <Entrada icono={<IconoBocadillo />} onClick={pronto('El chat')} etiqueta="Pronto">
          Mensajes
        </Entrada>
      </ul>

      <div className="my-3 h-px bg-border" aria-hidden="true" />

      <MenuCategorias />

      <div className="my-3 h-px bg-border" aria-hidden="true" />

      <ul className="space-y-0.5">
        <Entrada
          icono={<IconoAjustes />}
          activa={seccion === 'configuracion'}
          onClick={nav.irAConfiguracion}
        >
          Configuración
        </Entrada>
        <li>
          <button
            type="button"
            onClick={nav.cerrarSesion}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-danger-deep transition-colors hover:bg-danger/[0.05]"
          >
            <IconoSalir />
            Cerrar sesión
          </button>
        </li>
      </ul>

      <p className="mt-auto px-3 pt-6 text-[11.5px] leading-snug text-muted">
        Baknazo · compra, vende y contrata cerca de ti.
      </p>
    </nav>
  );
}

/**
 * Todas las categorías, agrupadas por sección y con cuántos anuncios tienen.
 *
 * Cada sección se despliega con un toque (`<details>`, sin JavaScript de más)
 * y la que coincide con la URL se abre sola. Llevan al feed con el filtro ya
 * puesto, así el enlace se puede compartir tal cual.
 */
function MenuCategorias() {
  const catalogos = useCatalogos();
  const resumen = useResumenCatalogo();
  const navegar = useNavigate();
  const { pathname, search } = useLocation();

  const actual = pathname === '/anuncios' || pathname.startsWith('/anuncio/') ? new URLSearchParams(search) : null;
  const pilarActual = actual?.get('pilar') ?? null;
  const categoriaActual = actual?.get('categoria') ?? null;

  if (!catalogos) return null;

  const ir = (pilar: Pilar, categoria?: number) => {
    const q = new URLSearchParams({ pilar });
    if (categoria) q.set('categoria', String(categoria));
    navegar(`/anuncios?${q.toString()}`);
  };

  return (
    <div>
      <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Categorías</p>
      {(['productos', 'servicios', 'empleo'] as Pilar[]).map((pilar) => {
        const categorias = categoriasDe(catalogos, pilar);
        const totalPilar = categorias.reduce((s, c) => s + (resumen?.categorias[c.id] ?? 0), 0);
        return (
          <details key={pilar} open={pilarActual === pilar} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-white [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${ESTILO_PILAR[pilar].punto}`} />
              <span className="flex-1">{NOMBRE_PILAR[pilar]}</span>
              {resumen && <span className="text-[12px] text-muted tabular-nums">{totalPilar}</span>}
              <span className="text-muted transition-transform group-open:rotate-180 [&>svg]:size-4">
                <IconoChevron />
              </span>
            </summary>
            <ul className="mt-0.5 mb-1 ml-[18px] border-l border-border pl-2">
              <li>
                <SubEntrada activa={pilarActual === pilar && !categoriaActual} onClick={() => ir(pilar)}>
                  Todo en {NOMBRE_PILAR[pilar].toLowerCase()}
                </SubEntrada>
              </li>
              {categorias.map((c) => (
                <li key={c.id}>
                  <SubEntrada
                    activa={categoriaActual === String(c.id)}
                    total={resumen ? (resumen.categorias[c.id] ?? 0) : undefined}
                    onClick={() => ir(pilar, c.id)}
                  >
                    {c.nombre}
                  </SubEntrada>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function SubEntrada({
  activa,
  total,
  onClick,
  children,
}: {
  activa: boolean;
  total?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      className={
        activa
          ? 'flex w-full items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-left text-[13px] font-semibold text-foreground ring-1 ring-border'
          : 'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-foreground/85 transition-colors hover:bg-white hover:text-foreground'
      }
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {total !== undefined && total > 0 && (
        <span className="text-[11.5px] text-muted tabular-nums">{total}</span>
      )}
    </button>
  );
}

function Entrada({
  icono,
  activa = false,
  etiqueta,
  onClick,
  children,
}: {
  icono: ReactNode;
  activa?: boolean;
  /** Marca a la derecha, como "Pronto". */
  etiqueta?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={activa ? 'page' : undefined}
        className={
          activa
            ? 'flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-[14px] font-semibold text-foreground shadow-[0_1px_2px_rgba(31,41,55,0.08)] ring-1 ring-border'
            : 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-white'
        }
      >
        <span className={activa ? 'text-accent' : 'text-muted'}>{icono}</span>
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {etiqueta && (
          <span className="rounded-full bg-border/70 px-2 py-0.5 text-[10.5px] font-semibold text-muted">
            {etiqueta}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * Las pestañas de abajo en móvil, al alcance del pulgar.
 *
 * Publicar va en el centro y en el color de marca: es la acción que sostiene el
 * marketplace, y antes vivía en un botón flotante que tapaba la última tarjeta.
 */
function BarraInferior({ seccion }: { seccion: Seccion }) {
  const nav = useNavegacion();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        <Pestana icono={<IconoCasa />} activa={seccion === 'inicio'} onClick={nav.irAlFeed}>
          Inicio
        </Pestana>
        <Pestana icono={<IconoBrujula />} activa={seccion === 'explorar'} onClick={nav.irAExplorar}>
          Explorar
        </Pestana>
        <li className="grid place-items-center">
          <button
            type="button"
            onClick={nav.irAPublicar}
            aria-label="Publicar un anuncio"
            aria-current={seccion === 'publicar' ? 'page' : undefined}
            className="grid size-12 place-items-center rounded-2xl bg-brand text-foreground shadow-[0_6px_14px_-6px_rgba(204,146,0,0.8)] transition-colors hover:bg-brand-dark active:scale-95"
          >
            <IconoMas />
          </button>
        </li>
        <Pestana
          icono={<IconoEtiqueta />}
          activa={seccion === 'mis-anuncios' || seccion === 'postulaciones'}
          onClick={nav.irAMisAnuncios}
        >
          Anuncios
        </Pestana>
        <Pestana icono={<IconoPersona />} activa={seccion === 'perfil'} onClick={nav.irAMiPerfil}>
          Perfil
        </Pestana>
      </ul>
    </nav>
  );
}

function Pestana({
  icono,
  activa,
  onClick,
  children,
}: {
  icono: ReactNode;
  activa: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={activa ? 'page' : undefined}
        className={
          activa
            ? 'flex size-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-accent'
            : 'flex size-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted transition-colors hover:text-foreground'
        }
      >
        {icono}
        {children}
      </button>
    </li>
  );
}
