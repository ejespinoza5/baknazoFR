import { Toaster } from 'sonner';
import './Alertas.css';

/**
 * El recuadro donde aterrizan los avisos. Se monta una sola vez, en App, y
 * queda fuera de la navegación a propósito: las pantallas cambian entre sí,
 * pero los avisos sobreviven al cambio.
 *
 * Para avisar, importa las cuatro funciones de lib/notificar.
 */
export default function Alertas() {
  return (
    <Toaster
      className="bkn-alertas"
      position="bottom-right"
      visibleToasts={4}
      containerAriaLabel="Avisos de Baknazo"
    />
  );
}
