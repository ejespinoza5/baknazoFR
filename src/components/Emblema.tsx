import logo from '../assets/logo.png';

/**
 * La única marca ornamental del sistema: un sello grabado (dos anillos
 * finos, como el troquel de una moneda o un timbre notarial) alrededor
 * del isotipo. Aparece una sola vez por pantalla, junto al nombre.
 */
export default function Emblema({ tamano = 40 }: { tamano?: number }) {
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: tamano, height: tamano }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        width={tamano}
        height={tamano}
        className="absolute inset-0 text-carbon/25"
      >
        <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="20" cy="20" r="15.5" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <img
        src={logo}
        alt=""
        style={{ width: tamano * 0.52, height: tamano * 0.52 }}
        className="relative object-contain"
      />
    </span>
  );
}
