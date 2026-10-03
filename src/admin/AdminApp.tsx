import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import BaknazoLoader from '../components/BaknazoLoader';
import { alPerderSesion, pedir } from './api';
import { SesionAdminContexto, type SesionAdmin } from './sesion';
import MarcoAdmin from './MarcoAdmin';
import LoginAdmin from './pantallas/LoginAdmin';
import CambioObligatorio from './pantallas/CambioObligatorio';
import Resumen from './pantallas/Resumen';
import Anuncios from './pantallas/Anuncios';
import Denuncias from './pantallas/Denuncias';
import Usuarios from './pantallas/Usuarios';
import Soporte from './pantallas/Soporte';
import Administradores from './pantallas/Administradores';
import Moderacion from './pantallas/Moderacion';
import Auditoria from './pantallas/Auditoria';
import Perfil from './pantallas/Perfil';
import type { Administrador, Catalogos, Permiso } from './tipos';

/**
 * El panel de administración, en /admin.
 *
 * Va aparte de la app del marketplace: su propia sesión (cookie HttpOnly del
 * panel), su propio marco y sus propias rutas. Al entrar se pregunta al
 * servidor quién eres; nada de la sesión se guarda en el navegador.
 */
export default function AdminApp() {
  const navegar = useNavigate();
  const [admin, setAdmin] = useState<Administrador | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarCatalogos = useCallback(() => {
    pedir<Catalogos>('/catalogos').then(setCatalogos).catch(() => undefined);
  }, []);

  useEffect(() => {
    pedir<{ admin: Administrador }>('/auth/yo')
      .then((r) => {
        setAdmin(r.admin);
        if (!r.admin.debeCambiarContrasena) cargarCatalogos();
      })
      .catch(() => setAdmin(null))
      .finally(() => setCargando(false));
  }, [cargarCatalogos]);

  /* Si el servidor dice que la sesión terminó (o pide cambiar la contraseña), se refleja aquí. */
  useEffect(() => {
    alPerderSesion((motivo) => {
      if (motivo === 'sin-sesion') {
        setAdmin(null);
        navegar('/admin/login', { replace: true });
      } else {
        setAdmin((a) => (a ? { ...a, debeCambiarContrasena: true } : a));
      }
    });
  }, [navegar]);

  const sesion: SesionAdmin | null = useMemo(() => {
    if (!admin) return null;
    const permisos = new Set<Permiso>(admin.permisos);
    return {
      admin,
      catalogos,
      actualizar: (a) => {
        setAdmin(a);
        if (!a.debeCambiarContrasena && !catalogos) cargarCatalogos();
      },
      salir: async () => {
        await pedir('/auth/logout', 'POST').catch(() => undefined);
        setAdmin(null);
        navegar('/admin/login', { replace: true });
      },
      puede: (p) => admin.esSuper || permisos.has(p),
    };
  }, [admin, catalogos, cargarCatalogos, navegar]);

  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <BaknazoLoader mensaje="Abriendo el panel" />
      </div>
    );
  }

  if (!sesion) {
    return (
      <Routes>
        <Route
          path="login"
          element={
            <LoginAdmin
              onEntrar={(a) => {
                setAdmin(a);
                if (!a.debeCambiarContrasena) cargarCatalogos();
                navegar('/admin', { replace: true });
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    );
  }

  return (
    <SesionAdminContexto.Provider value={sesion}>
      {sesion.admin.debeCambiarContrasena ? (
        <CambioObligatorio />
      ) : (
        <MarcoAdmin>
          <Routes>
            <Route index element={<Inicio />} />
            <Route path="anuncios" element={<Protegida permiso="anuncios.ver"><Anuncios /></Protegida>} />
            <Route path="denuncias" element={<Protegida permiso="denuncias.ver"><Denuncias /></Protegida>} />
            <Route path="usuarios" element={<Protegida permiso="usuarios.ver"><Usuarios /></Protegida>} />
            <Route path="soporte" element={<Protegida permiso="soporte.responder"><Soporte /></Protegida>} />
            <Route path="administradores" element={<Protegida permiso="administradores.gestionar"><Administradores /></Protegida>} />
            <Route path="moderacion" element={<Protegida permiso="moderacion.configurar"><Moderacion /></Protegida>} />
            <Route path="auditoria" element={<Protegida permiso="auditoria.ver"><Auditoria /></Protegida>} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="login" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </MarcoAdmin>
      )}
    </SesionAdminContexto.Provider>
  );
}

/** El inicio: el resumen si puede verlo, si no la primera sección a su alcance. */
function Inicio() {
  return (
    <SesionAdminContexto.Consumer>
      {(s) => {
        if (!s) return null;
        if (s.puede('estadisticas.ver')) return <Resumen />;
        const destino = (
          [
            ['anuncios.ver', '/admin/anuncios'],
            ['denuncias.ver', '/admin/denuncias'],
            ['usuarios.ver', '/admin/usuarios'],
            ['soporte.responder', '/admin/soporte'],
            ['administradores.gestionar', '/admin/administradores'],
            ['moderacion.configurar', '/admin/moderacion'],
            ['auditoria.ver', '/admin/auditoria'],
          ] as [Permiso, string][]
        ).find(([p]) => s.puede(p));
        return <Navigate to={destino ? destino[1] : '/admin/perfil'} replace />;
      }}
    </SesionAdminContexto.Consumer>
  );
}

/** Sin el permiso, la pantalla ni se monta (y el servidor tampoco respondería). */
function Protegida({ permiso, children }: { permiso: Permiso; children: ReactNode }) {
  return (
    <SesionAdminContexto.Consumer>
      {(s) => (s?.puede(permiso) ? children : <Navigate to="/admin" replace />)}
    </SesionAdminContexto.Consumer>
  );
}
