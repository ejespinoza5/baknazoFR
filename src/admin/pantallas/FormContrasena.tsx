import { useState, type FormEvent } from 'react';
import { pedir, mensajeDe } from '../api';
import { AvisoError, Boton, Campo } from '../ui';
import type { Administrador } from '../tipos';

const REGLA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

/**
 * Cambiar la contraseña: lo usan el cambio obligatorio (primer acceso o tras
 * un restablecimiento) y el perfil. La regla se comprueba aquí para avisar
 * antes, y otra vez en el servidor, que es la que vale.
 */
export default function FormContrasena({ onCambiada, textoBoton = 'Guardar contraseña' }: {
  onCambiada: (a: Administrador) => void;
  textoBoton?: string;
}) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const errorNueva = nueva && !REGLA.test(nueva) ? 'Mínimo 10 caracteres, con mayúscula, minúscula, número y un carácter especial.' : null;
  const errorRepetida = repetida && repetida !== nueva ? 'No coincide con la nueva contraseña.' : null;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!actual || !nueva || errorNueva || nueva !== repetida) {
      setFallo('Revisa los campos marcados.');
      return;
    }
    setEnviando(true);
    setFallo(null);
    try {
      const r = await pedir<{ admin: Administrador }>('/auth/cambiar-contrasena', 'POST', { actual, nueva });
      setActual('');
      setNueva('');
      setRepetida('');
      onCambiada(r.admin);
    } catch (err) {
      setFallo(mensajeDe(err, 'No se pudo cambiar la contraseña.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} noValidate className="space-y-4">
      {fallo && <AvisoError>{fallo}</AvisoError>}
      <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      <Campo
        etiqueta="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        error={errorNueva}
        ayuda="Mínimo 10 caracteres, con mayúscula, minúscula, número y un carácter especial."
      />
      <Campo
        etiqueta="Repite la nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        error={errorRepetida}
      />
      <Boton type="submit" variante="primario" cargando={enviando}>
        {textoBoton}
      </Boton>
    </form>
  );
}
