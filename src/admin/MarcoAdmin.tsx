import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Emblema from '../components/Emblema';
import {
  IconoAjustes,
  IconoAlerta,
  IconoCandado,
  IconoCasa,
  IconoCerrar,
  IconoDocumento,
  IconoEtiqueta,
  IconoGrupo,
  IconoMenu,
  IconoPersona,
  IconoSalir,
  IconoSoporte,
} from '../components/Iconos';
import { useBloqueoScroll } from '../lib/bloqueoScroll';
import { notificarMensaje } from '../lib/notificar';
import { reproducirSonido } from '../lib/sonidos';
import { iniciarAvisos, useAvisos, type Contadores } from './avisos';
import { useSesionAdmin } from './sesion';
import type { Permiso } from './tipos';

interface Entrada {
  ruta: string;
  texto: string;
  icono: ReactNode;
  permiso?: Permiso;
  /** Qué contador lleva al lado (lo que espera atención en esa sección). */
  contador?: keyof Contadores;
}

// Cada sección aparece solo con su permiso. El servidor lo vuelve a comprobar.
const SECCIONES: { titulo: string; entradas: Entrada[] }[] = [
  {
    titulo: 'Moderación',
    entradas: [
      { ruta: '/admin', texto: 'Resumen', icono: <IconoCasa />, permiso: 'estadisticas.ver' },
      { ruta: '/admin/anuncios', texto: 'Anuncios', icono: <IconoEtiqueta />, permiso: 'anuncios.ver', contador: 'pendientes' },
      { ruta: '/admin/denuncias', texto: 'Denuncias', icono: <IconoAlerta />, permiso: 'denuncias.ver', contador: 'denunciados' },
      { ruta: '/admin/usuarios', texto: 'Usuarios', icono: <IconoPersona />, permiso: 'usuarios.ver' },
      { ruta: '/admin/soporte', texto: 'Soporte', icono: <IconoSoporte />, permiso: 'soporte.responder', contador: 'soporte' },
    ],
  },
  {
    titulo: 'Administración',
    entradas: [
      { ruta: '/admin/administradores', texto: 'Administradores', icono: <IconoGrupo />, permiso: 'administradores.gestionar' },
      { ruta: '/admin/moderacion', texto: 'Reglas de moderación', icono: <IconoAjustes />, permiso: 'moderacion.configurar' },
      { ruta: '/admin/auditoria', texto: 'Auditoría', icono: <IconoDocumento />, permiso: 'auditoria.ver' },
    ],
  },
  {
    titulo: 'Tu cuenta',
    entradas: [{ ruta: '/admin/perfil', texto: 'Perfil y seguridad', icono: <IconoCandado /> }],
  },
];

/**
 * El marco del panel. La barra lateral va en el carbón de la marca: es la
 * trastienda, y se nota a primera vista que no es el marketplace. El ítem
 * activo lleva la franja amarilla de Baknazo.
 */
export default function MarcoAdmin({ children }: { children: ReactNode }) {
  const [cajon, setCajon] = useState(false);
  const { pathname } = useLocation();
  const [rutaVista, setRutaVista] = useState(pathname);
  if (rutaVista !== pathname) {
    setRutaVista(pathname);
    setCajon(false);
  }
  useBloqueoScroll(cajon);

  /* ---------- Avisos de lo que espera atención ---------- */
  const navegar = useNavigate();
  const avisos = useAvisos();
  const previo = useRef<Contadores | null>(null);
  useEffect(() => iniciarAvisos(), []);

  // Cuando sube un contador, se avisa (con sonido) y se puede ir directo.
  // La primera carga no avisa: lo que ya había no es nuevo.
  useEffect(() => {
    const antes = previo.current;
    previo.current = avisos;
    if (!antes || (antes.pendientes === undefined && antes.denunciados === undefined && antes.soporte === undefined)) return;
    const nuevosRevision = (avisos.pendientes ?? 0) - (antes.pendientes ?? 0);
    const nuevasDenuncias = (avisos.denunciados ?? 0) - (antes.denunciados ?? 0);
    const nuevoSoporte = (avisos.soporte ?? 0) - (antes.soporte ?? 0);
    if (nuevosRevision > 0) {
      notificarMensaje(
        'Anuncios por revisar',
        nuevosRevision === 1 ? 'Llegó un anuncio nuevo a la cola de revisión.' : `Llegaron ${nuevosRevision} anuncios nuevos a la cola de revisión.`,
        () => navegar('/admin/anuncios')
      );
    }
    if (nuevasDenuncias > 0) {
      notificarMensaje(
        'Denuncias',
        nuevasDenuncias === 1 ? 'Hay un anuncio nuevo con denuncias.' : `Hay ${nuevasDenuncias} anuncios nuevos con denuncias.`,
        () => navegar('/admin/denuncias')
      );
    }
    // Quien ya está en Soporte ve llegar la conversación en la bandeja.
    if (nuevoSoporte > 0 && !window.location.pathname.startsWith('/admin/soporte')) {
      notificarMensaje(
        'Soporte',
        nuevoSoporte === 1 ? 'Alguien escribió a soporte.' : `${nuevoSoporte} conversaciones nuevas esperan respuesta.`,
        () => navegar('/admin/soporte')
      );
    }
    if (nuevosRevision > 0 || nuevasDenuncias > 0 || nuevoSoporte > 0) reproducirSonido('campana');
  }, [avisos, navegar]);

  // "(3) Panel Baknazo": se ve en la pestaña aunque esté en segundo plano.
  const total = (avisos.pendientes ?? 0) + (avisos.denunciados ?? 0) + (avisos.soporte ?? 0);
  useEffect(() => {
    document.title = total > 0 ? `(${total}) Panel Baknazo` : 'Panel Baknazo';
    return () => {
      document.title = 'Baknazo';
    };
  }, [total]);

  return (
    <div className="min-h-svh bg-background lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <BarraLateral />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setCajon(true)}
          aria-label={total > 0 ? `Abrir el menú, ${total} por atender` : 'Abrir el menú'}
          className="relative grid size-10 place-items-center rounded-full text-foreground hover:bg-white"
        >
          <IconoMenu />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-bold text-carbon tabular-nums ring-2 ring-background">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </button>
        <Emblema tamano={28} />
        <span className="text-[15px] font-semibold text-foreground">Panel Baknazo</span>
      </header>

      {cajon && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <button type="button" aria-label="Cerrar el menú" onClick={() => setCajon(false)} className="animate-bkn-velo absolute inset-0 cursor-default bg-carbon/50" />
          <div className="animate-bkn-cajon absolute inset-y-0 left-0 w-[min(84vw,280px)]">
            <BarraLateral onCerrar={() => setCajon(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}

function BarraLateral({ onCerrar }: { onCerrar?: () => void }) {
  const { admin, puede, salir } = useSesionAdmin();
  const avisos = useAvisos();

  return (
    <nav aria-label="Panel de administración" className="flex h-full flex-col bg-carbon text-white">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="rounded-full bg-white p-0.5">
          <Emblema tamano={30} />
        </span>
        <span className="text-[16px] font-semibold tracking-tight">Baknazo</span>
        <span className="rounded-[5px] bg-brand px-1.5 py-0.5 text-[10.5px] font-bold text-carbon">Panel</span>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar el menú" className="ml-auto grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            <IconoCerrar />
          </button>
        )}
      </div>

      {/* La barra de desplazamiento es fina, del tono del menú y solo aparece
          al pasar el cursor: la del sistema, gris clara, cortaba el carbón. */}
      <div className="barra-discreta min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {SECCIONES.map((s) => {
          const visibles = s.entradas.filter((e) => !e.permiso || puede(e.permiso));
          if (visibles.length === 0) return null;
          return (
            <div key={s.titulo} className="mb-4 last:mb-0">
              <p className="px-3 pb-1 text-[11.5px] font-medium text-white/45">{s.titulo}</p>
              <ul className="space-y-0.5">
                {visibles.map((e) => {
                  const cuenta = e.contador ? (avisos[e.contador] ?? 0) : 0;
                  return (
                    <li key={e.ruta}>
                      <NavLink
                        to={e.ruta}
                        end={e.ruta === '/admin'}
                        className={({ isActive }) =>
                          `relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
                            isActive ? 'bg-white/[0.09] font-semibold text-white' : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" />}
                            <span className={isActive ? 'text-brand' : 'text-white/55'}>{e.icono}</span>
                            <span className="min-w-0 flex-1 truncate">{e.texto}</span>
                            {cuenta > 0 && (
                              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-carbon tabular-nums">
                                {cuenta > 99 ? '99+' : cuenta}
                                <span className="sr-only"> por atender</span>
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-white/10 p-2.5">
        <div className="px-3 py-1.5">
          <p className="truncate text-[13.5px] font-semibold text-white">{admin.nombre}</p>
          <p className="truncate text-[12px] text-white/55">
            {admin.esSuper ? 'Superadministrador' : 'Administrador'} · {admin.correo}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void salir()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <IconoSalir />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
