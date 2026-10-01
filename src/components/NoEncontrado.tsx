import type { ReactNode } from 'react';
import Emblema from './Emblema';

/**
 * "No encontrado": una URL que no existe, un perfil borrado, un anuncio que ya
 * no está.
 *
 * El número va grande y el cero es el sello de Baknazo, para que un error se
 * siga sintiendo parte de la app y no una página rota del servidor. Debajo, qué
 * pasó en palabras normales y, sobre todo, por dónde seguir.
 */
export default function NoEncontrado({
  codigo,
  titulo,
  texto,
  compacto = false,
  children,
}: {
  /** '404' en grande. Sin él, solo el sello (para errores que no son 404). */
  codigo?: string;
  titulo: string;
  texto: string;
  /** Para dentro de una ficha o un bloque: más pequeño. */
  compacto?: boolean;
  /** Botones: por dónde seguir. */
  children?: ReactNode;
}) {
  const tamanoSello = compacto ? 56 : 96;
  return (
    <div className="flex max-w-[440px] flex-col items-center text-center">
      {codigo ? (
        <p
          aria-hidden="true"
          className={`flex items-center font-semibold tracking-tight text-foreground ${
            compacto ? 'gap-1.5 text-[64px] leading-none' : 'gap-2.5 text-[112px] leading-none sm:text-[132px]'
          }`}
        >
          {codigo.split('').map((caracter, i) =>
            caracter === '0' ? (
              <span key={i} className="inline-grid place-items-center">
                <Emblema tamano={tamanoSello} />
              </span>
            ) : (
              <span key={i}>{caracter}</span>
            )
          )}
        </p>
      ) : (
        <Emblema tamano={tamanoSello} />
      )}
      <h1
        className={`mt-5 font-semibold tracking-tight text-foreground ${
          compacto ? 'text-[18px]' : 'text-[24px] sm:text-[26px]'
        }`}
      >
        {titulo}
      </h1>
      <p className={`mt-2 leading-relaxed text-muted ${compacto ? 'text-[13.5px]' : 'text-[15px]'}`}>{texto}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
