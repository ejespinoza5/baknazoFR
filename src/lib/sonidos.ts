import type { Sonido } from '../types/notificacion';

/**
 * Los sonidos de los avisos, sintetizados con Web Audio.
 *
 * No hay archivos de audio: cada tono se arma con un par de osciladores y una
 * envolvente corta. Pesan cero bytes, suenan igual en todos los navegadores y
 * no hay derechos de nadie de por medio.
 *
 * El navegador no deja sonar nada hasta que la persona toca la página una
 * vez; si todavía no lo hizo, el aviso llega en silencio y ya está.
 */

export const OPCIONES_SONIDO: { id: Sonido; nombre: string; descripcion: string }[] = [
  { id: 'campana', nombre: 'Campanita', descripcion: 'Dos notas claras, como un timbre de mostrador.' },
  { id: 'burbuja', nombre: 'Burbuja', descripcion: 'Un tono que sube, suave y corto.' },
  { id: 'pop', nombre: 'Pop', descripcion: 'Un golpe seco y discreto.' },
  { id: 'marimba', nombre: 'Marimba', descripcion: 'Tres notas de madera, alegres.' },
  { id: 'ninguno', nombre: 'Sin sonido', descripcion: 'Los avisos llegan en silencio, también los push.' },
];

let contexto: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  contexto ??= new Ctor();
  return contexto;
}

/** Una nota con ataque rápido y caída exponencial. */
function nota(
  ctx: AudioContext,
  { frecuencia, inicio, duracion, volumen = 0.18, forma = 'sine', hasta }: {
    frecuencia: number;
    inicio: number;
    duracion: number;
    volumen?: number;
    forma?: OscillatorType;
    /** Si se da, la frecuencia se desliza hasta aquí (la "burbuja"). */
    hasta?: number;
  }
) {
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.type = forma;
  osc.frequency.setValueAtTime(frecuencia, t);
  if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, t + duracion * 0.8);
  gan.gain.setValueAtTime(0.0001, t);
  gan.gain.exponentialRampToValueAtTime(volumen, t + 0.012);
  gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  osc.connect(gan).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duracion + 0.02);
}

const TONOS: Record<Exclude<Sonido, 'ninguno'>, (ctx: AudioContext) => void> = {
  campana: (ctx) => {
    nota(ctx, { frecuencia: 1318.5, inicio: 0, duracion: 0.9, volumen: 0.14 });
    nota(ctx, { frecuencia: 2637, inicio: 0, duracion: 0.5, volumen: 0.04 });
    nota(ctx, { frecuencia: 987.8, inicio: 0.16, duracion: 1.1, volumen: 0.14 });
  },
  burbuja: (ctx) => {
    nota(ctx, { frecuencia: 380, hasta: 980, inicio: 0, duracion: 0.22, volumen: 0.2 });
  },
  pop: (ctx) => {
    nota(ctx, { frecuencia: 620, hasta: 300, inicio: 0, duracion: 0.09, volumen: 0.26, forma: 'triangle' });
  },
  marimba: (ctx) => {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      nota(ctx, { frecuencia: f, inicio: i * 0.09, duracion: 0.32, volumen: 0.16 });
      nota(ctx, { frecuencia: f * 4, inicio: i * 0.09, duracion: 0.08, volumen: 0.03 });
    });
  },
};

/** Suena el tono elegido. Con 'ninguno', o sin permiso del navegador, nada. */
export function reproducirSonido(sonido: Sonido): void {
  if (sonido === 'ninguno') return;
  const ctx = audio();
  if (!ctx) return;
  const sonar = () => {
    try {
      TONOS[sonido](ctx);
    } catch {
      // Un navegador sin Web Audio completo: el aviso visual basta.
    }
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(sonar).catch(() => undefined);
  } else {
    sonar();
  }
}
