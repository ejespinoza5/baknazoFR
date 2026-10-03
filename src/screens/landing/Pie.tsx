import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Emblema from '../../components/Emblema';
import ModalPolitica from '../../components/ModalPolitica';
import { obtenerPoliticas } from '../../api/auth';
import { notificarError } from '../../lib/notificar';
import type { Pilar } from '../../lib/pilares';
import type { PoliticaVigente } from '../../types/auth';
import { DESARROLLADOR, irASeccion, REDES, RUTA_ENTRAR, RUTA_REGISTRO } from './config';

/** El año en que nació Baknazo: el © arranca aquí. */
const ANIO_INICIO = 2026;

const ICONO_RED: Record<(typeof REDES)[number]['red'], { nombre: string; dibujo: ReactNode }> = {
  facebook: {
    nombre: 'Facebook',
    dibujo: <path d="M14 8.5V7c0-.8.5-1 1-1h1.5V3H14c-2.5 0-3.5 1.7-3.5 3.8v1.7H8.5V12h2v9H14v-9h2.3l.4-3.5H14z" fill="currentColor" />,
  },
  instagram: {
    nombre: 'Instagram',
    dibujo: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
      </>
    ),
  },
  tiktok: {
    nombre: 'TikTok',
    dibujo: (
      <path
        d="M16.5 3c.3 2.2 1.6 3.6 3.8 3.8v3a7 7 0 0 1-3.8-1.2v6.2a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.8 2.5V3h3z"
        fill="currentColor"
      />
    ),
  },
  whatsapp: {
    nombre: 'WhatsApp',
    dibujo: (
      <path
        d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2zm0 1.7a7.1 7.1 0 1 1-3.6 13.2l-.3-.2-2.6.7.7-2.5-.2-.3A7.1 7.1 0 0 1 12 4.9zm-3 3.6c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 4.9 4.3 2.4.9 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4l-.5-.3-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.6l.4-.5.3-.5v-.5l-.8-2c-.2-.5-.4-.4-.6-.4H9z"
        fill="currentColor"
      />
    ),
  },
};

/**
 * El pie: quién es Baknazo, a dónde ir, lo legal y las redes. Términos y
 * privacidad se abren con el texto vigente del servidor, el mismo que acepta
 * quien se registra; no una copia que se quede vieja.
 */
export default function Pie({ onPilar }: { onPilar: (p: Pilar) => void }) {
  const navegar = useNavigate();
  const [politica, setPolitica] = useState<PoliticaVigente | null>(null);
  const redes = REDES.filter((r) => r.url);
  // 2026 este año; desde el siguiente, el rango: "2026–2027", "2026–2028"…
  const anio = new Date().getFullYear();
  const anios = anio > ANIO_INICIO ? `${ANIO_INICIO}–${anio}` : String(ANIO_INICIO);

  const abrirPolitica = async (clave: 'TERMINOS' | 'PRIVACIDAD') => {
    try {
      const lista = await obtenerPoliticas();
      const p = lista.find((x) => x.clave === clave);
      if (p) setPolitica(p);
      else if (clave === 'PRIVACIDAD') window.open('/privacidad.html', '_blank', 'noopener');
      else notificarError('No pudimos cargar los términos. Inténtalo en un momento.');
    } catch {
      if (clave === 'PRIVACIDAD') window.open('/privacidad.html', '_blank', 'noopener');
      else notificarError('No pudimos cargar los términos. Inténtalo en un momento.');
    }
  };

  const columnas: { titulo: string; enlaces: { texto: string; accion: () => void }[] }[] = [
    {
      titulo: 'Explora',
      enlaces: [
        { texto: 'Productos', accion: () => onPilar('productos') },
        { texto: 'Servicios', accion: () => onPilar('servicios') },
        { texto: 'Empleo', accion: () => onPilar('empleo') },
        { texto: 'Lo más reciente', accion: () => irASeccion('anuncios') },
      ],
    },
    {
      titulo: 'Baknazo',
      enlaces: [
        { texto: 'Cómo funciona', accion: () => irASeccion('como-funciona') },
        { texto: 'Compra con confianza', accion: () => irASeccion('seguridad') },
        { texto: 'Crear cuenta gratis', accion: () => navegar(RUTA_REGISTRO) },
        { texto: 'Iniciar sesión', accion: () => navegar(RUTA_ENTRAR) },
      ],
    },
    {
      titulo: 'Legal',
      enlaces: [
        { texto: 'Términos y condiciones', accion: () => void abrirPolitica('TERMINOS') },
        { texto: 'Política de privacidad', accion: () => void abrirPolitica('PRIVACIDAD') },
        { texto: 'Eliminar mis datos', accion: () => window.open('/eliminar-datos.html', '_blank', 'noopener') },
      ],
    },
  ];

  return (
    <footer className="bg-carbon text-white">
      <div className="mx-auto w-full max-w-[1320px] px-5 pt-16 pb-10 sm:px-8 lg:px-10 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr] lg:gap-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white p-1">
                <Emblema tamano={36} />
              </span>
              <span className="titular text-[30px]">Baknazo</span>
            </div>
            <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-white/70">
              El marketplace de Ecuador para comprar, vender y contratar cerca de ti. Publicar es gratis.
            </p>
            {redes.length > 0 && (
              <ul className="mt-6 flex gap-2.5" aria-label="Redes sociales">
                {redes.map((r) => (
                  <li key={r.red}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Baknazo en ${ICONO_RED[r.red].nombre}`}
                      className="grid size-11 place-items-center rounded-full bg-white/8 text-white/85 ring-1 ring-white/12 transition-colors hover:bg-brand hover:text-foreground hover:ring-transparent"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        {ICONO_RED[r.red].dibujo}
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {columnas.map((c) => (
              <nav key={c.titulo} aria-label={c.titulo}>
                <p className="text-[12px] font-semibold tracking-[0.14em] text-brand uppercase">{c.titulo}</p>
                <ul className="mt-4 grid gap-2.5">
                  {c.enlaces.map((e) => (
                    <li key={e.texto}>
                      <button
                        type="button"
                        onClick={e.accion}
                        className="text-left text-[14.5px] text-white/75 transition-colors hover:text-white hover:underline hover:underline-offset-4"
                      >
                        {e.texto}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/12 pt-6 text-[13px] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {anios} Baknazo. Todos los derechos reservados. Hecho en Ecuador
            <span aria-hidden="true" className="ml-1.5 inline-flex translate-y-[1px] gap-px align-middle">
              <span className="h-2.5 w-1 rounded-[1px] bg-brand" />
              <span className="h-2.5 w-1 rounded-[1px] bg-accent" />
              <span className="h-2.5 w-1 rounded-[1px] bg-empleo" />
            </span>
          </p>
          <p>
            Desarrollado por{' '}
            <a
              href={DESARROLLADOR.url}
              target="_blank"
              rel="noopener"
              className="font-semibold text-white/85 underline decoration-brand decoration-2 underline-offset-4 transition-colors hover:text-brand"
            >
              {DESARROLLADOR.nombre}
            </a>
          </p>
        </div>
      </div>

      <ModalPolitica politica={politica} onCerrar={() => setPolitica(null)} />
    </footer>
  );
}
