import { useEffect, useState } from 'react';

interface Props {
  /** Frases que se escriben, pausan y borran en bucle. */
  esloganes: string[];
  /** Milisegundos por carácter al escribir. */
  velocidad?: number;
  /** Pausa en milisegundos cuando la frase está completa. */
  pausa?: number;
  className?: string;
}

/**
 * Rotador de eslóganes con efecto de máquina de escribir.
 * El cursor usa una animación CSS que `prefers-reduced-motion` apaga sola.
 */
export default function EsloganTyper({
  esloganes,
  velocidad = 55,
  pausa = 2100,
  className,
}: Props) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'escribiendo' | 'pausa' | 'borrando'>(
    'escribiendo'
  );
  const [indice, setIndice] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setCursorOn((v) => !v), 500);
    return () => window.clearInterval(id);
  }, []);

  const actual = esloganes[indice];

  useEffect(() => {
    let ms: number;
    if (estado === 'escribiendo') {
      ms = texto.length < actual.length ? velocidad : pausa;
    } else if (estado === 'pausa') {
      ms = 260;
    } else if (texto.length > 0) {
      ms = 30;
    } else {
      ms = 60;
    }

    const avanzar = () => {
      if (estado === 'escribiendo') {
        if (texto.length < actual.length) {
          setTexto(actual.slice(0, texto.length + 1));
        } else {
          setEstado('pausa');
        }
      } else if (estado === 'pausa') {
        setEstado('borrando');
      } else if (texto.length > 0) {
        setTexto(actual.slice(0, texto.length - 1));
      } else {
        setIndice((i) => (i + 1) % esloganes.length);
        setEstado('escribiendo');
      }
    };

    const timeout = window.setTimeout(avanzar, ms);
    return () => window.clearTimeout(timeout);
  }, [texto, estado, indice, actual, velocidad, pausa, esloganes]);

  return (
    <p className={className} aria-hidden="true">
      <span className="whitespace-pre-wrap break-words">{texto}</span>
      <span
        className={`inline-block h-[1.15em] w-[0.09em] translate-y-[0.18em] rounded-[1px] bg-brand transition-none ${
          cursorOn ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </p>
  );
}