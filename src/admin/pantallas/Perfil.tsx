import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { notificarExito, notificarError } from '../../lib/notificar';
import { pedir, mensajeDe } from '../api';
import { useSesionAdmin } from '../sesion';
import { AvisoError, Boton, Campo, Cargando, Encabezado, Insignia, Tarjeta } from '../ui';
import { fechaHora } from '../formato';
import FormContrasena from './FormContrasena';
import type { Administrador } from '../tipos';

interface Sesion {
  id: number;
  ip: string | null;
  navegador: string | null;
  creadaEn: string;
  ultimoUsoEn: string;
  actual: boolean;
}

/** Perfil y seguridad: nombre, correo de acceso, contraseña y sesiones abiertas. */
export default function Perfil() {
  const { admin, actualizar } = useSesionAdmin();
  return (
    <div className="space-y-6">
      <Encabezado titulo="Perfil y seguridad" descripcion="Tus datos de acceso al panel. El correo y la contraseña iniciales se cambian aquí." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Tu cuenta">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
            <dt className="text-muted">Rol</dt>
            <dd>{admin.esSuper ? <Insignia tono="info">Superadministrador</Insignia> : 'Administrador'}</dd>
            <dt className="text-muted">Permisos</dt>
            <dd className="text-foreground">{admin.esSuper ? 'Todos' : `${admin.permisos.length} asignados`}</dd>
            <dt className="text-muted">Último acceso</dt>
            <dd className="text-foreground">{fechaHora(admin.ultimoAccesoEn)}</dd>
            <dt className="text-muted">Contraseña cambiada</dt>
            <dd className="text-foreground">{fechaHora(admin.contrasenaCambiadaEn)}</dd>
            <dt className="text-muted">Cuenta creada</dt>
            <dd className="text-foreground">{fechaHora(admin.creadoEn)}</dd>
          </dl>
        </Tarjeta>
        <DatosCuenta admin={admin} onGuardado={actualizar} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Cambiar contraseña" descripcion="Se cerrarán tus demás sesiones; esta sigue abierta.">
          <FormContrasena
            onCambiada={(a) => {
              notificarExito('Contraseña actualizada.');
              actualizar(a);
            }}
          />
        </Tarjeta>
        <Sesiones />
      </div>
    </div>
  );
}

function DatosCuenta({ admin, onGuardado }: { admin: Administrador; onGuardado: (a: Administrador) => void }) {
  const [nombre, setNombre] = useState(admin.nombre);
  const [correo, setCorreo] = useState(admin.correo);
  const [contrasena, setContrasena] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cambiaCorreo = correo.trim().toLowerCase() !== admin.correo.toLowerCase();

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setFallo(null);
    try {
      const r = await pedir<{ admin: Administrador }>('/auth/perfil', 'PATCH', {
        nombre: nombre.trim(),
        correo: correo.trim(),
        contrasenaActual: cambiaCorreo ? contrasena : undefined,
      });
      setContrasena('');
      notificarExito('Datos guardados.');
      onGuardado(r.admin);
    } catch (err) {
      setFallo(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta titulo="Datos de acceso">
      <form onSubmit={guardar} noValidate className="space-y-4">
        {fallo && <AvisoError>{fallo}</AvisoError>}
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
        <Campo etiqueta="Correo de acceso" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        {cambiaCorreo && (
          <Campo
            etiqueta="Tu contraseña actual"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            ayuda="Para cambiar el correo con el que entras, confirma que eres tú."
          />
        )}
        <Boton type="submit" variante="primario" cargando={enviando}>
          Guardar datos
        </Boton>
      </form>
    </Tarjeta>
  );
}

function Sesiones() {
  const [lista, setLista] = useState<Sesion[] | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(() => {
    pedir<Sesion[]>('/auth/sesiones')
      .then(setLista)
      .catch(() => setLista([]));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cerrarOtras = async () => {
    setCerrando(true);
    try {
      const r = await pedir<{ cerradas: number }>('/auth/cerrar-sesiones', 'POST');
      notificarExito(r.cerradas === 0 ? 'No había otras sesiones abiertas.' : `Se cerraron ${r.cerradas} sesiones.`);
      cargar();
    } catch (e) {
      notificarError(mensajeDe(e));
    } finally {
      setCerrando(false);
    }
  };

  return (
    <Tarjeta
      titulo="Sesiones abiertas"
      descripcion="Duran 8 horas y se cierran tras 1 hora sin uso."
      acciones={
        <Boton chico variante="peligro" cargando={cerrando} onClick={() => void cerrarOtras()} disabled={!lista || lista.length <= 1}>
          Cerrar las demás
        </Boton>
      }
    >
      {!lista ? (
        <Cargando />
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((s) => (
            <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
              <p className="flex items-center gap-2 text-[13.5px] text-foreground">
                <span className="max-w-[300px] truncate">{resumirNavegador(s.navegador)}</span>
                {s.actual && <Insignia tono="exito">Esta sesión</Insignia>}
              </p>
              <p className="text-[12px] text-muted">
                {s.ip ?? 'IP desconocida'} · último uso {fechaHora(s.ultimoUsoEn)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function resumirNavegador(ua: string | null): string {
  if (!ua) return 'Navegador desconocido';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return so ? `${nav} en ${so}` : nav;
}
