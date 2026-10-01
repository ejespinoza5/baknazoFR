/** Estilos compartidos por las secciones de configuración. */

/**
 * Una foto vista **entera**, sin recortes.
 *
 * `object-cover` es lo correcto para una rejilla, donde el recorte mantiene
 * todas las tarjetas alineadas. Pero donde el usuario está eligiendo o
 * revisando su foto, recortar le oculta justo lo que quiere comprobar: una
 * captura vertical salía cortada por la mitad y parecía un fallo de carga.
 *
 * La caja sigue a la foto en vez de imponer 4:3. Con un marco fijo, `contain`
 * encogía las fotos verticales hasta dejarlas como una franja diminuta en el
 * centro, con bandas grises; ahora la miniatura sale a su proporción real. Los
 * límites Alto y bajo evitan que una panorámica deforme el formulario y que una
 * vertical alta se lleve media pantalla, y `min-h` reserva el espacio para que
 * los botones no bailen mientras carga.
 */
export const fotoEntera =
  'min-h-24 max-h-72 w-full rounded-xl border border-border bg-background object-contain';

export const inputBase =
  'h-11 w-full rounded-lg border border-border bg-white px-3.5 text-[15px] text-foreground placeholder:text-muted/70 transition-colors duration-150 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50';

export const etiqueta = 'mb-1.5 block text-[13px] font-medium text-muted';

export const tituloSeccion =
  'text-[12px] font-semibold tracking-[0.14em] text-muted uppercase';

export const tarjeta =
  'rounded-2xl border border-border bg-white p-5 sm:p-7';

export const alertaError =
  'flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-danger-deep';

export const avisoInfo =
  'flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent/[0.05] px-3.5 py-2.5 text-[13px] leading-snug text-foreground';
