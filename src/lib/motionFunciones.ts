// Las funciones de animación de `motion` (incluidas las de layout, para los
// indicadores que se deslizan). Se cargan aparte, después de la primera
// pintura, para no engordar el paquete inicial: ver `LazyMotion` en main.tsx.
import { domMax } from 'motion/react';

export default domMax;
