export interface ReglaClave {
  id: string;
  texto: string;
  cumple: boolean;
}

/**
 * Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.
 * Mismas reglas que valida el backend.
 */
export function evaluarClave(valor: string): ReglaClave[] {
  return [
    { id: 'largo', texto: 'Mínimo 8 caracteres', cumple: valor.length >= 8 },
    { id: 'mayus', texto: 'Una mayúscula (A-Z)', cumple: /[A-Z]/.test(valor) },
    { id: 'minus', texto: 'Una minúscula (a-z)', cumple: /[a-z]/.test(valor) },
    { id: 'numero', texto: 'Un número (0-9)', cumple: /[0-9]/.test(valor) },
    {
      id: 'especial',
      texto: 'Un carácter especial (!@#$…)',
      cumple: /[^A-Za-z0-9]/.test(valor),
    },
  ];
}

export function claveEsValida(valor: string): boolean {
  return evaluarClave(valor).every((regla) => regla.cumple);
}

export function correoEsValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}
