import { useState, type FormEvent } from 'react';
import Emblema from '../../components/Emblema';
import { pedir, mensajeDe } from '../api';
import { AvisoError, Boton, Campo } from '../ui';
import type { Administrador } from '../tipos';

/** La entrada al panel: correo y contraseña de administrador (no de usuario). */
export default function LoginAdmin({ onEntrar }: { onEntrar: (a: Administrador) => void }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!correo.trim() || !contrasena) {
      setFallo('Escribe tu correo y tu contraseña.');
      return;
    }
    setEnviando(true);
    setFallo(null);
    try {
      const r = await pedir<{ admin: Administrador }>('/auth/login', 'POST', { correo: correo.trim(), contrasena });
      onEntrar(r.admin);
    } catch (err) {
      setFallo(mensajeDe(err, 'No se pudo iniciar sesión.'));
      setContrasena('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          <Emblema tamano={40} />
          <span className="text-[19px] font-semibold tracking-tight text-foreground">Baknazo</span>
          <span className="rounded-[5px] bg-carbon px-1.5 py-0.5 text-[10.5px] font-bold text-white">Panel</span>
        </div>
        <form onSubmit={entrar} noValidate className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-[0_18px_40px_-28px_rgba(31,41,55,0.45)]">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Panel de administración</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">Solo para el equipo de moderación. Tu cuenta de Baknazo no sirve aquí.</p>
          <div className="mt-5 space-y-4">
            {fallo && <AvisoError>{fallo}</AvisoError>}
            <Campo etiqueta="Correo" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
            <Boton type="submit" variante="primario" cargando={enviando} className="w-full">
              Entrar al panel
            </Boton>
          </div>
        </form>
        <p className="mt-4 text-center text-[12px] text-muted">Tras cinco intentos fallidos la cuenta se bloquea 15 minutos.</p>
      </div>
    </div>
  );
}
