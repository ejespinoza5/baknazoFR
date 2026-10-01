import type { VistaAnuncios } from '../lib/vistaAnuncios';

/**
 * El hueco de una publicación que está por llegar, con su misma forma.
 *
 * Se usa al cargar la página siguiente mientras se hace scroll: ahí la persona
 * ya está leyendo publicaciones, y un bloque con la silueta exacta de la
 * siguiente (cabecera, texto, foto y barra de acciones en lista; foto y tres
 * líneas en rejilla) se lee como "vienen más", sin salto cuando llegan. Antes
 * la silueta de la lista era una fila fina con una miniatura, que no se parecía
 * en nada a la publicación real.
 */
export default function EsqueletoAnuncio({ vista }: { vista: VistaAnuncios }) {
  if (vista === 'lista') {
    return (
      <div aria-hidden="true" className="animate-pulse overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
          <div className="size-10 shrink-0 rounded-full bg-border/80" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-36 rounded bg-border/80" />
            <div className="h-2.5 w-24 rounded bg-border/60" />
          </div>
          <div className="size-8 rounded-full bg-border/60" />
        </div>
        <div className="space-y-2 px-4 pb-3">
          <div className="h-4 w-3/4 rounded bg-border/80" />
          <div className="h-5 w-24 rounded bg-border/80" />
          <div className="h-2.5 w-20 rounded bg-border/60" />
        </div>
        <div className="aspect-[4/3] bg-border/50 sm:aspect-[16/9]" />
        <div className="flex justify-end px-4 pt-2.5 pb-2">
          <div className="h-2.5 w-16 rounded bg-border/60" />
        </div>
        <div className="mx-3 flex gap-2 border-t border-border py-2">
          <div className="h-8 flex-1 rounded-lg bg-border/50" />
          <div className="h-8 flex-1 rounded-lg bg-border/50" />
          <div className="h-8 flex-1 rounded-lg bg-border/50" />
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="aspect-square rounded-xl bg-border/60" />
      <div className="space-y-1.5 px-0.5 pt-2">
        <div className="h-4 w-20 rounded bg-border/80" />
        <div className="h-3.5 w-4/5 rounded bg-border/70" />
        <div className="h-3 w-3/5 rounded bg-border/60" />
      </div>
    </div>
  );
}
