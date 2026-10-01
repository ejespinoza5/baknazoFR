import type { ReactNode } from 'react';
import Emblema from './Emblema';

/**
 * La altura de la barra, en píxeles.
 *
 * Vive aquí y no en cada pantalla porque hay CSS y hay JavaScript que la
 * necesitan: la barra es `sticky`, así que el código que calcula a dónde hacer
 * scroll tiene que descontarla o dejaría una tarjeta debajo de la barra. Si las
 * dos cifras se escriben a mano, en cuanto una cambia y la otra no, el scroll
 * queda descuadrado y no se ve hasta que se cambia de vista con la página
 * desplazada.
 */
export const ALTO_CABECERA = 64;

/**
 * La barra de marca, la misma en todas las pantallas.
 *
 * Antes cada pantalla escribía la suya. El feed y "Mis anuncios" tenían copias
 * casi idénticas, y el perfil se inventó una tercera sin emblema ni logotipo: se
 * entraba a ver un anuncio y el producto desaparecía un momento, como si el
 * perfil fuera de otra aplicación. El incoherente no era solo el aspecto, era
 * que cambiar de sitio el nombre de la marca cambiara de sitio en pantalla.
 *
 * La barra solo pone el marco. Lo de la derecha cambia por pantalla (el feed
 * lleva la búsqueda), pero el emblema, el nombre, la insignia de demo, la altura
 * y el ancho máximo son siempre los mismos, para que el logotipo caiga en el
 * mismo píxel de X en todas partes. Eso es lo que hace que las pantallas se lean
 * como una sola.
 */
export default function CabeceraBaknazo({
  izquierda,
  titulo,
  centro,
  acciones,
}: {
  /** Botón de volver. Va antes del emblema, como en el resto de aplicaciones. */
  izquierda?: ReactNode;
  /** Nombre de la pantalla, después de la marca y de un separador. */
  titulo?: string;
  /** Buscador u otros controles que ocupan el hueco. */
  centro?: ReactNode;
  /** Campana, "Publicar" y el menú de cuenta. */
  acciones?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      {/* Ancho completo, sin centrar: el menú lateral arranca en el borde
          izquierdo y el botón que lo abre tiene que quedar encima de él. */}
      <div className="flex h-16 w-full items-center gap-3 px-3 sm:px-4 lg:gap-4 lg:px-5">
        {izquierda && <div className="flex shrink-0 items-center">{izquierda}</div>}

        <div className="flex min-w-0 items-center gap-2.5">
          <Emblema tamano={34} />
          <div className="flex items-center gap-1.5">
            <span className="text-[17px] font-semibold tracking-tight text-foreground">
              Baknazo
            </span>
            <span className="rounded-[5px] bg-brand/25 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-brand-dark uppercase">
              demo
            </span>
          </div>
        </div>

        {titulo && (
          <>
            {/* En móvil el título no cabe junto a la marca; la barra inferior
                ya dice en qué sección se está. */}
            <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-border sm:block" />
            <span className="hidden truncate text-[15px] font-semibold text-foreground sm:block">{titulo}</span>
          </>
        )}

        {centro}

        {acciones && (
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            {acciones}
          </div>
        )}
      </div>
    </header>
  );
}
