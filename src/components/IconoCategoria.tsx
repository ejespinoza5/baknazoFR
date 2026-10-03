import type { Pilar } from '../lib/pilares';

/**
 * Los íconos de las categorías, dibujados para Baknazo.
 *
 * Misma rejilla de 24 y mismo trazo (1.6, puntas redondas) que el resto de
 * `Iconos.tsx`, para que se lean como parte de la misma familia. Cada uno
 * tiene dos capas:
 *
 * - `trazo`: el dibujo, en el color de tinta del pilar.
 * - `relleno`: una superficie del objeto (la pantalla, la cúpula del casco, la
 *   carga del camión) en el mismo color a baja opacidad. Es lo que les da
 *   cuerpo de ilustración sin degradados ni sombras.
 *
 * Se eligen por pilar y slug porque "tecnología" no es lo mismo en productos
 * (un portátil), en servicios (código en pantalla) que en empleo (un chip). Un
 * slug nuevo que no esté aquí cae en la caja de "otros", nunca en una letra.
 */

interface Dibujo {
  trazo: string[];
  relleno?: string[];
  /** Círculos aparte: con un path quedarían ilegibles. [cx, cy, r] */
  circulos?: [number, number, number][];
  /** Círculos rellenos (no solo trazo), como los botones de un mando. */
  puntos?: [number, number, number][];
}

const caja: Dibujo = {
  trazo: ['M12 3.5 20 7.5v9l-8 4-8-4v-9z', 'M4 7.5l8 4 8-4', 'M12 11.5v9'],
  relleno: ['M12 3.5 20 7.5l-8 4-8-4z'],
};

const DIBUJOS: Record<string, Dibujo> = {
  /* ---------- Productos ---------- */
  'productos:tecnologia': {
    trazo: ['M5.5 5.5h13a1 1 0 0 1 1 1V16h-15V6.5a1 1 0 0 1 1-1z', 'M2.5 16h19l-1 2.5a1 1 0 0 1-.9.5H4.4a1 1 0 0 1-.9-.5z'],
    relleno: ['M7 7.5h10v6.5H7z'],
  },
  'productos:vehiculos': {
    trazo: [
      'M5.5 12.5l1.5-4a1.8 1.8 0 0 1 1.7-1.2h6.6a1.8 1.8 0 0 1 1.7 1.2l1.5 4',
      'M3.5 13.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v3.5h-17z',
    ],
    relleno: ['M7.3 12.5l1.1-3a.7.7 0 0 1 .7-.5h5.8a.7.7 0 0 1 .7.5l1.1 3z'],
    circulos: [
      [7.5, 17.5, 1.9],
      [16.5, 17.5, 1.9],
    ],
  },
  'productos:hogar': {
    trazo: ['M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z', 'M5 7.5h14', 'M8 5.5h.01M10.5 5.5h.01'],
    relleno: ['M12 10.4a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z'],
    circulos: [[12, 13.5, 4.3]],
  },
  'productos:moda': {
    trazo: ['M9 4 4.5 6.4l1.7 3.6 2.3-.9V20h7V9.1l2.3.9 1.7-3.6L15 4a3 3 0 0 1-6 0z'],
    relleno: ['M8.5 13h7v7h-7z'],
  },
  'productos:inmuebles': {
    trazo: ['M3.5 11 12 4l8.5 7', 'M6 9.2v10.3h12V9.2', 'M10 19.5v-5h4v5'],
    relleno: ['M6 9.3 12 4.4l6 4.9v10.2H6z'],
  },
  'productos:entretenimiento': {
    trazo: [
      'M7.6 8h8.8a4 4 0 0 1 3.9 4.9l-.9 4.1a2.1 2.1 0 0 1-3.7.9L14 16h-4l-1.7 1.9a2.1 2.1 0 0 1-3.7-.9l-.9-4.1A4 4 0 0 1 7.6 8z',
      'M8.5 10.5v3M7 12h3',
    ],
    relleno: ['M7.6 8h8.8a4 4 0 0 1 3.9 4.9l-.9 4.1a2.1 2.1 0 0 1-3.7.9L14 16h-4l-1.7 1.9a2.1 2.1 0 0 1-3.7-.9l-.9-4.1A4 4 0 0 1 7.6 8z'],
    puntos: [
      [15.4, 11.2, 0.9],
      [17.2, 13, 0.9],
    ],
  },
  // Una mancuerna: una pelota con costuras se confundía con un globo terráqueo.
  'productos:deportes': {
    trazo: [
      'M6.5 7h2a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z',
      'M15.5 7h2a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z',
      'M6 9.5H4a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h2M18 9.5h2a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-2',
      'M9 12h6',
    ],
    relleno: ['M6 7h3v10H6zM15 7h3v10h-3z'],
  },
  'productos:construccion': {
    trazo: ['M11.8 6.2 14.6 3.4l6 6-2.8 2.8z', 'M14.6 9.4 4.9 19.1a1.4 1.4 0 0 0 2 2l9.7-9.7'],
    relleno: ['M11.8 6.2 14.6 3.4l6 6-2.8 2.8z'],
  },
  'productos:otros': caja,

  /* ---------- Servicios ---------- */
  'servicios:tecnologia': {
    trazo: ['M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z', 'M9 20h6M12 16.5V20', 'M10 8.5 8 10.5l2 2M14 8.5l2 2-2 2'],
    relleno: ['M5.5 6.5h13v8h-13z'],
  },
  'servicios:hogar': {
    trazo: ['M5 4h11a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M17 6.5h2.5V12H12v3', 'M11 15h2v5.5h-2z'],
    relleno: ['M5 4h11a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'],
  },
  'servicios:belleza': {
    trazo: ['M8.3 8.2 19.5 17', 'M8.3 15.8 19.5 7', 'M13.2 12h.01'],
    relleno: ['M6.5 4.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM6.5 15.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z'],
    circulos: [
      [6.5, 6.5, 2.6],
      [6.5, 17.5, 2.6],
    ],
  },
  'servicios:clases': {
    trazo: ['M12 6.6C10.2 5.3 7.7 4.6 4.5 4.6v13c3.2 0 5.7.7 7.5 2 1.8-1.3 4.3-2 7.5-2v-13c-3.2 0-5.7.7-7.5 2z', 'M12 6.6v13'],
    relleno: ['M12 6.6C10.2 5.3 7.7 4.6 4.5 4.6v13c3.2 0 5.7.7 7.5 2z'],
  },
  'servicios:eventos': {
    trazo: ['M11 3.5a5.5 5.5 0 0 1 5.5 5.5c0 3.6-3 6.5-5.5 7.5C8.5 15.5 5.5 12.6 5.5 9A5.5 5.5 0 0 1 11 3.5z', 'M10 16.5h2l-1 1.3z', 'M11 17.8c-1.4.9-1.4 1.8 0 2.7', 'M19 4v2.5M17.8 5.2h2.5'],
    relleno: ['M11 3.5a5.5 5.5 0 0 1 5.5 5.5c0 3.6-3 6.5-5.5 7.5C8.5 15.5 5.5 12.6 5.5 9A5.5 5.5 0 0 1 11 3.5z'],
  },
  'servicios:transporte': {
    trazo: ['M3.5 6.5h10v9.5h-10z', 'M13.5 9.5h4l3 3.3V16h-7'],
    relleno: ['M3.5 6.5h10v9.5h-10z'],
    circulos: [
      [7, 17.5, 1.9],
      [17, 17.5, 1.9],
    ],
  },
  'servicios:salud': {
    trazo: ['M12 19.5s-7.5-4.4-7.5-10a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z', 'M7 11.5h2.6l1.4-2.4 2 4.8 1.4-2.4H17'],
    relleno: ['M12 19.5s-7.5-4.4-7.5-10a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z'],
  },
  'servicios:profesionales': {
    trazo: ['M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5z', 'M9 3h6v3H9z', 'M8.5 10.5h7M8.5 13.5h7M8.5 16.5h4'],
    relleno: ['M9 3h6v3H9z'],
  },
  'servicios:otros': {
    trazo: ['M11 4l1.5 4.2L16.7 9.7l-4.2 1.5L11 15.4l-1.5-4.2-4.2-1.5 4.2-1.5z', 'M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'],
    relleno: ['M11 4l1.5 4.2L16.7 9.7l-4.2 1.5L11 15.4l-1.5-4.2-4.2-1.5 4.2-1.5z'],
  },

  /* ---------- Empleo ---------- */
  'empleo:tecnologia': {
    trazo: ['M8.5 7h7A1.5 1.5 0 0 1 17 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 15.5v-7A1.5 1.5 0 0 1 8.5 7z', 'M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3'],
    relleno: ['M9.8 9.8h4.4v4.4H9.8z'],
  },
  'empleo:ventas': {
    trazo: ['M4 9.5 5.5 4.5h13L20 9.5', 'M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0', 'M5.5 11.8v7.7h13v-7.7', 'M10 19.5V15h4v4.5'],
    relleno: ['M4 9.5 5.5 4.5h13L20 9.5z'],
  },
  'empleo:administracion': {
    trazo: ['M4 20h16', 'M6 20v-6h3v6M10.5 20V9h3v11M15 20v-9h3v9', 'M5 8.5l4-3 3 1.8L18.5 3.5'],
    relleno: ['M10.5 9h3v11h-3z'],
  },
  'empleo:gastronomia': {
    trazo: ['M7 13.5a3.5 3.5 0 0 1 .6-6.9 4.5 4.5 0 0 1 8.8 0 3.5 3.5 0 0 1 .6 6.9V18.5H7z', 'M7 15.5h10'],
    relleno: ['M7 15.5h10v3H7z'],
  },
  // Una pared de ladrillos: el casco de obra se leía como la campana de
  // servicio de un restaurante, justo al lado de Gastronomía.
  'empleo:construccion': {
    trazo: [
      'M4.5 5.5h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z',
      'M3.5 9.8h17M3.5 14.2h17',
      'M9 5.5v4.3M15 5.5v4.3M6.5 9.8v4.4M12 9.8v4.4M17.5 9.8v4.4M9 14.2v4.3M15 14.2v4.3',
    ],
    relleno: ['M12 9.8h5.5v4.4H12z', 'M3.5 14.2H9v4.3H3.5z'],
  },
  'empleo:salud': {
    trazo: ['M6.5 4v5a4 4 0 0 0 8 0V4', 'M5.3 4h2.4M13.3 4h2.4', 'M10.5 13v2.5a4 4 0 0 0 8 0v-1.8'],
    relleno: ['M18.5 10a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z'],
    circulos: [[18.5, 11.7, 2.1]],
  },
  'empleo:educacion': {
    trazo: ['M2.5 9.5 12 5l9.5 4.5L12 14z', 'M6.5 11.6v4.2c0 1.6 2.5 3.2 5.5 3.2s5.5-1.6 5.5-3.2v-4.2', 'M21.5 9.5V14'],
    relleno: ['M2.5 9.5 12 5l9.5 4.5L12 14z'],
  },
  'empleo:logistica': {
    trazo: ['M9 7h11v10.5H9z', 'M13 7v3.5h3V7', 'M3.5 10h3.5M2.5 13h4.5M4 16h3'],
    relleno: ['M9 7h11v10.5H9z'],
  },
  'empleo:otros': {
    trazo: ['M5.5 7.5h13A1.5 1.5 0 0 1 20 9v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V9a1.5 1.5 0 0 1 1.5-1.5z', 'M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5', 'M4 12.5h16'],
    relleno: ['M4 12.5h16V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z'],
  },
};

export default function IconoCategoria({ pilar, slug }: { pilar: Pilar; slug: string }) {
  const d = DIBUJOS[`${pilar}:${slug}`] ?? caja;
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d.relleno?.map((p, i) => (
        <path key={`r${i}`} d={p} fill="currentColor" fillOpacity="0.18" stroke="none" />
      ))}
      {d.trazo.map((p, i) => (
        <path key={`t${i}`} d={p} />
      ))}
      {d.circulos?.map(([cx, cy, r], i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
      {d.puntos?.map(([cx, cy, r], i) => (
        <circle key={`p${i}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
