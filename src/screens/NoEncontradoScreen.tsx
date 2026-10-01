import { useLocation, useNavigate } from 'react-router-dom';
import MarcoApp from '../components/MarcoApp';
import Emblema from '../components/Emblema';
import NoEncontrado from '../components/NoEncontrado';
import { useNavegacion } from '../lib/navegacion';

/**
 * La página para cualquier dirección que no existe.
 *
 * Antes cualquier URL desconocida mostraba el login, que confundía más: con
 * sesión abierta parecía que te había sacado de la cuenta. Ahora dice lo que
 * pasa y ofrece los caminos de siempre. Con sesión va dentro del marco de la
 * app (menú incluido); sin ella, una página limpia con la marca.
 */
export default function NoEncontradoScreen() {
  const { sesion, irAlFeed, irAExplorar, irAlLogin } = useNavegacion();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  const contenido = (
    <div className="grid min-h-[70svh] place-items-center px-4 py-12">
      <NoEncontrado
        codigo="404"
        titulo="No encontramos esta página"
        texto={`La dirección ${pathname} no existe en Baknazo. Puede que el enlace esté mal escrito o que lo que buscabas ya no esté.`}
      >
        {sesion ? (
          <>
            <button
              type="button"
              onClick={irAlFeed}
              className="h-11 rounded-lg bg-brand px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
            >
              Ir al inicio
            </button>
            <button
              type="button"
              onClick={irAExplorar}
              className="h-11 rounded-lg border border-border bg-white px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:border-muted"
            >
              Explorar categorías
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={irAlLogin}
              className="h-11 rounded-lg bg-brand px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-brand-dark"
            >
              Entrar a Baknazo
            </button>
            <button
              type="button"
              onClick={() => navegar(-1)}
              className="h-11 rounded-lg border border-border bg-white px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:border-muted"
            >
              Volver atrás
            </button>
          </>
        )}
      </NoEncontrado>
    </div>
  );

  if (sesion) return <MarcoApp titulo="Página no encontrada">{contenido}</MarcoApp>;

  return (
    <div className="min-h-svh bg-background">
      <header className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <Emblema tamano={32} />
        <span className="text-[17px] font-semibold tracking-tight text-foreground">Baknazo</span>
      </header>
      {contenido}
    </div>
  );
}
