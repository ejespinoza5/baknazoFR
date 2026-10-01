import { useEffect, useState } from 'react';
import { IconoAjustes, IconoEtiqueta, IconoGuardar, IconoPersona, IconoSalir } from './Iconos';
import { urlCompleta } from '../lib/imagen';
import { useNavegacion } from '../lib/navegacion';

/**
 * El botón de cuenta y su menú, el mismo en todas las pantallas.
 *
 * Lee la sesión y los destinos del contexto de navegación en vez de recibirlos
 * por props. Con props, cada pantalla tenía que acordarse de pasar los cinco, y
 * "Mi perfil" dejó de funcionar justo en las que se olvidaron de uno.
 */
export default function MenuCuenta() {
  const { sesion, perfil, irAMiPerfil, irAMisAnuncios, irAGuardados, irAConfiguracion, cerrarSesion } =
    useNavegacion();
  const [abierto, setAbierto] = useState(false);

  const cerrar = () => setAbierto(false);

  /* Escape cierra el menú, como en cualquier desplegable del sistema. */
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  if (!sesion) return null;

  const nombres = (perfil?.nombres ?? sesion.usuario.nombres ?? '').trim();
  const apellidos = perfil?.apellidos ?? sesion.usuario.apellidos ?? '';
  const iniciales = (nombres[0] ?? '') + (apellidos[0] ?? '') || 'BK';
  const foto = urlCompleta(
    perfil?.foto_perfil_url ?? perfil?.foto_perfil ?? sesion.usuario.foto_perfil
  );
  const nombreCompleto = `${nombres} ${apellidos}`.trim() || 'Mi cuenta';
  const correo = perfil?.correo ?? sesion.usuario.correo ?? '';

  /** Cierra el menú antes de navegar, para que no quede abierto en la otra pantalla. */
  const ir = (destino: () => void) => () => {
    cerrar();
    destino();
  };

  const opcion =
    'flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-background';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label="Menú de cuenta"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-carbon text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Avatar
          foto={foto}
          iniciales={iniciales}
          alt="Mi foto de perfil"
          className="size-10 rounded-full border-2 border-white object-cover shadow-[0_1px_3px_rgba(31,41,55,0.2)]"
        />
      </button>

      {abierto && (
        <>
          {/* El velo invisible se queda con el clic de fuera: más fiable que
              escuchar en `document` y comparar contra nodos que cambian. */}
          <div className="fixed inset-0 z-40" onClick={cerrar} aria-hidden="true" />
          <div
            role="menu"
            className="animate-bkn-in absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(31,41,55,0.04),0_18px_40px_-20px_rgba(31,41,55,0.45)]"
          >
            {/* La cabecera del menú también lleva al perfil: es donde el dedo va
                primero cuando se busca "mi perfil". */}
            <button
              type="button"
              role="menuitem"
              onClick={ir(irAMiPerfil)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-background"
            >
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-carbon text-[12px] font-semibold text-white">
                <Avatar foto={foto} iniciales={iniciales} alt="" className="size-10 object-cover" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-foreground">
                  {nombreCompleto}
                </span>
                <span className="block truncate text-[12px] text-muted">{correo}</span>
                <span className="mt-0.5 block text-[12px] font-medium text-accent">
                  Ver mi perfil
                </span>
              </span>
            </button>

            <button type="button" role="menuitem" onClick={ir(irAMiPerfil)} className={opcion}>
              <span className="text-muted">
                <IconoPersona />
              </span>
              Mi perfil
            </button>

            <button type="button" role="menuitem" onClick={ir(irAMisAnuncios)} className={opcion}>
              <span className="text-muted">
                <IconoEtiqueta />
              </span>
              Mis anuncios
            </button>

            <button type="button" role="menuitem" onClick={ir(irAGuardados)} className={opcion}>
              <span className="text-muted">
                <IconoGuardar />
              </span>
              Guardados
            </button>

            <button type="button" role="menuitem" onClick={ir(irAConfiguracion)} className={opcion}>
              <span className="text-muted">
                <IconoAjustes />
              </span>
              Configuración
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={ir(cerrarSesion)}
              className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-[13.5px] font-medium text-danger-deep transition-colors hover:bg-danger/[0.04]"
            >
              <IconoSalir />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * La foto de la cuenta, con las iniciales de respaldo si la imagen no carga.
 *
 * El respaldo importa: la foto viene de una URL guardada por el usuario, y un
 * `<img>` que falla se queda en blanco dentro del círculo, que en un botón de 40
 * px se lee como un hueco roto.
 */
export function Avatar({
  foto,
  iniciales,
  alt,
  className,
}: {
  foto: string | null;
  iniciales: string;
  alt: string;
  className: string;
}) {
  // Se guarda la URL que falló: si `foto` cambia, el respaldo se descarta solo.
  const [falloEn, setFalloEn] = useState<string | null>(null);
  const fallo = Boolean(foto) && falloEn === foto;

  if (!foto || fallo) return <span>{iniciales}</span>;

  return <img src={foto} alt={alt} className={className} onError={() => setFalloEn(foto)} />;
}
