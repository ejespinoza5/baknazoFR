import { IconoInfo } from './Iconos';

/**
 * Qué fotos se aceptan, dicho antes de elegirlas y no en un error después.
 * Las mismas reglas que valida el backend (tipo y peso por foto).
 */
export default function FormatosAceptados({ maxBytes }: { maxBytes: number }) {
  const mb = Math.round(maxBytes / 1024 / 1024);
  return (
    <p className="mt-2 flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-[12px] leading-snug text-muted">
      <span className="mt-px shrink-0 [&>svg]:size-4">
        <IconoInfo />
      </span>
      <span>
        <strong className="font-semibold text-foreground">JPG, PNG, WEBP o AVIF</strong>, hasta{' '}
        <strong className="font-semibold text-foreground">{mb} MB</strong> cada una. Se ven mejor desde 1200 px de
        ancho; antes de subirlas las optimizamos para que pesen poco.
      </span>
    </p>
  );
}
