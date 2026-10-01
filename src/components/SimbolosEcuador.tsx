/**
 * Símbolos del Ecuador dibujados como aguafuerte (línea fina, tinta sobre
 * papel), en el mismo lenguaje que el Emblema y los iconos del sistema.
 * Se usan como marcas de agua del panel de marca: cada uno recibe su color
 * y su opacidad desde el padre mediante `className`.
 */

interface Props {
  className?: string;
}

const base = {
  viewBox: '0 0 120 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** El sol del escudo naciendo sobre el perfil nevado del Chimborazo. */
export function SolChimborazo({ className }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <circle cx="80" cy="38" r="11" />
      <path d="M80 21v-4 M80 55v4 M63 38h-4 M97 38h4 M68 26l-3-3 M92 50l3 3 M68 50l-3 3 M92 26l3-3" />
      <path d="M14 108 L46 54 L56 84 L66 64 L86 108 Z" />
      <path d="M46 54 L50 62 L54 58 L58 68 L62 62 L66 64" />
      <path d="M8 108 H112" />
    </svg>
  );
}

/** Cóndor andino en vuelo, visto de frente con las alas desplegadas. */
export function CondorAndino({ className }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <circle cx="60" cy="27" r="4" />
      <path d="M55.5 26.5 L49 27.5 L55 28.6" />
      <path d="M59 21.5l-1-4 M61 22l1-4" />
      <path d="M54.5 30.5 C57.5 34 62.5 34 65.5 30.5" />
      <path d="M60 34 L60 52" />
      <path d="M55 40 C57 46 63 46 65 40 Z" />
      <path d="M57 52 L53 64 M63 52 L67 64" />
      <path d="M59 34 C46 22 24 24 12 38 C24 46 44 48 56 42" />
      <path d="M20 33l-2 8 M28 30v9 M36 31v6" />
      <path d="M61 34 C74 22 96 24 108 38 C96 46 76 48 64 42" />
      <path d="M100 33l2 8 M92 30v9 M84 31v6" />
    </svg>
  );
}

/** Rosa, la flor nacional, con su tallo espinoso y dos hojas. */
export function RosaEcuador({ className }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M60 108 C58 92 62 76 60 62" />
      <path d="M59 86 C46 82 40 72 42 64 C50 62 60 68 60 78 Z" />
      <path d="M65 84 C78 76 88 66 90 56 C80 58 70 66 66 78 Z" />
      <path d="M44 62 C42 66 40 68 38 65 M76 62 C78 66 80 68 82 65" />
      <path d="M60 32 C48 32 41 40 42 49 C40 58 48 66 58 64 C60 68 68 66 70 60 C76 60 78 52 74 46 C78 38 70 32 60 32 Z" />
      <path d="M57 44 c-3 2 -5 5 -3 9 c1 3 5 4 8 3 c3 -1 4 -4 3 -7 c-1 -2 -4 -4 -6 -4 Z" />
      <path d="M56 52 c2 3 6 3 8 1" />
    </svg>
  );
}

/** Sombrero de paja toquilla, tejido fino con su cinta. */
export function SombreroToquilla({ className }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <ellipse cx="60" cy="70" rx="45" ry="9" />
      <path d="M39 62 C39 34 45 27 60 27 C75 27 81 34 81 62 Z" />
      <path d="M41 62 C49 57 71 57 79 62" />
      <path d="M47 46 c5 4 10 5 15 3 M45 56 c6 4 12 5 18 2 M55 30 l3 12 M73 42 l-9 12 M66 30 l-2 10" />
    </svg>
  );
}

/** Tortuga de las Galápagos, con el caparazón en forma de gajo. */
export function TortugaGalapagos({ className }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M28 54 C26 48 20 45 15 45 C10 45 8 51 12 55 C16 59 24 60 30 57 Z" />
      <circle cx="15" cy="50" r="1" />
      <ellipse cx="62" cy="62" rx="33" ry="24" />
      <path d="M33 72 L18 80 M33 76 L20 86" />
      <path d="M91 72 L102 80 M91 76 L100 86" />
      <path d="M48 82 L40 94 M76 82 L84 94" />
      <path d="M95 62 L108 65 M95 65 L105 68" />
      <path d="M62 44 L75 52 V74 L62 82 L49 74 V52 Z" />
      <path d="M49 50 L35 44 M49 74 L33 80 M75 50 L89 44 M75 74 L91 80" />
    </svg>
  );
}

/** Cacao ecuatoriano: la pepa de oro del país. */
export function CacaoEcuador({ className }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M66 26 C58 38 56 62 62 84 C64 94 76 96 82 88 C90 72 88 44 78 28 Z" />
      <path d="M60 34 C52 32 46 26 47 18 C56 20 62 24 63 30" />
      <path d="M64 48 c3 1 7 1 10 -1 M65 62 c4 1 7 1 10 -1 M66 76 c3 1 6 1 8 0" />
    </svg>
  );
}