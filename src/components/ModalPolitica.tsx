import type { PoliticaVigente } from '../types/auth';

interface Props {
  politica: PoliticaVigente | null;
  onCerrar: () => void;
}

export default function ModalPolitica({ politica, onCerrar }: Props) {
  if (!politica) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="politica-titulo"
    >
      <button
        type="button"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar política"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_64px_-24px_rgba(31,41,55,0.5)]">
        <div className="flex items-start justify-between gap-4 border-b border-claro px-6 py-4">
          <h2
            id="politica-titulo"
            className="text-[17px] leading-tight font-semibold tracking-tight text-carbon"
          >
            {politica.titulo}
            <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-medio">
              Versión {politica.version}
            </span>
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-medio transition-colors hover:bg-background hover:text-carbon"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-[13.5px] leading-relaxed text-carbon">
          <pre className="font-sans whitespace-pre-wrap">{politica.contenido}</pre>
        </div>
        <div className="border-t border-claro px-6 py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-md bg-amarillo py-2.5 text-[14px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}