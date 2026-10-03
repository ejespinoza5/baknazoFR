import { useEffect, useState } from 'react';
import { revisarTextoAnuncio, type RevisionTexto } from '../api/anuncios';
import { IconoAlerta, IconoInfo } from './Iconos';

const CAMPO: Record<NonNullable<RevisionTexto['campo']>, string> = {
  titulo: 'el título',
  descripcion: 'la descripción',
  categoriaId: 'la categoría',
};

/**
 * Avisa mientras se escribe si el anuncio no se podrá publicar o pasará por
 * revisión. Nunca dice qué palabra fue: solo en qué campo está el problema.
 *
 * Pregunta al servidor tras una pausa al escribir (no por tecla). Si la
 * consulta falla, no dice nada: el servidor vuelve a revisar al guardar.
 */
export default function AvisoModeracion({
  titulo,
  descripcion,
  categoriaId,
  activo = true,
  enEdicion = false,
}: {
  titulo: string;
  descripcion: string;
  categoriaId: number | null;
  /** En la edición solo se revisa si cambió algo del texto o la categoría. */
  activo?: boolean;
  enEdicion?: boolean;
}) {
  const [resultado, setResultado] = useState<{ clave: string; r: RevisionTexto } | null>(null);
  const clave = `${titulo}\u0000${descripcion}\u0000${categoriaId ?? ''}`;
  const suficiente = activo && (titulo.trim().length >= 3 || descripcion.trim().length >= 3);

  useEffect(() => {
    if (!suficiente) return;
    let vigente = true;
    const t = setTimeout(() => {
      revisarTextoAnuncio({ titulo, descripcion, categoriaId })
        .then((r) => {
          if (vigente) setResultado({ clave, r });
        })
        .catch(() => undefined);
    }, 800);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [clave, suficiente, titulo, descripcion, categoriaId]);

  // Un resultado de un texto anterior no vale para el actual.
  const r = suficiente && resultado?.clave === clave ? resultado.r : null;
  if (!r || r.decision === 'PUBLICAR') return null;

  if (r.decision === 'BLOQUEAR') {
    return (
      <p role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-danger-deep">
        <IconoAlerta />
        <span>
          {r.campo === 'categoriaId'
            ? 'Esta categoría no admite publicaciones por ahora. Elige otra.'
            : `Hay algo en ${CAMPO[r.campo ?? 'titulo']} que las normas de Baknazo no permiten publicar. Cámbialo para poder ${enEdicion ? 'guardar' : 'publicar'}.`}
        </span>
      </p>
    );
  }
  return (
    <p role="status" className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/[0.07] px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
      <span className="text-warning-deep">
        <IconoInfo />
      </span>
      <span>
        {enEdicion
          ? 'Con estos cambios, tu anuncio pasará por una revisión rápida antes de volver a mostrarse. Te avisaremos al aprobarlo.'
          : 'Tu anuncio pasará por una revisión rápida antes de publicarse. Te avisaremos cuando esté en línea.'}
      </span>
    </p>
  );
}
