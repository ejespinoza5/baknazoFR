import { useCallback, useEffect, useState } from 'react';
import { notificarExito, notificarError } from '../../lib/notificar';
import { pedir, mensajeDe } from '../api';
import { useSesionAdmin } from '../sesion';
import { AvisoError, Boton, Campo, Cargando, Encabezado, Insignia, Modal, Tabla, Tarjeta } from '../ui';
import { fechaHora } from '../formato';
import { textoAccion } from '../acciones';
import type { Administrador, EntradaAuditoria, Permiso } from '../tipos';

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; a: Administrador }
  | { tipo: 'permisos'; a: Administrador }
  | { tipo: 'activo'; a: Administrador }
  | { tipo: 'restablecer'; a: Administrador }
  | { tipo: 'eliminar'; a: Administrador }
  | { tipo: 'actividad'; a: Administrador }
  | { tipo: 'temporal'; correo: string; contrasena: string };

/**
 * Los administradores. Nadie toca al superadministrador ni se gestiona a sí
 * mismo desde aquí, y solo se otorgan permisos que uno tiene: el servidor lo
 * vuelve a comprobar en cada acción.
 */
export default function Administradores() {
  const { admin: yo, puede } = useSesionAdmin();
  const [lista, setLista] = useState<Administrador[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  const cargar = useCallback(() => {
    pedir<Administrador[]>('/administradores')
      .then(setLista)
      .catch((e) => setFallo(mensajeDe(e)));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cerrar = () => setDialogo(null);
  const gestionable = (a: Administrador) => !a.esSuper && a.id !== yo.id && (yo.esSuper || a.permisos.every((p) => yo.permisos.includes(p)));

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Administradores"
        descripcion="Cada persona del equipo entra con su propio correo y contraseña, y solo puede hacer lo que sus permisos le dejan."
        acciones={
          <Boton variante="primario" onClick={() => setDialogo({ tipo: 'crear' })}>
            Nuevo administrador
          </Boton>
        }
      />

      <Tarjeta sinRelleno>
        {fallo ? (
          <div className="p-5">
            <AvisoError>{fallo}</AvisoError>
          </div>
        ) : !lista ? (
          <Cargando mensaje="Cargando administradores" />
        ) : (
          <Tabla columnas={['Administrador', 'Rol', 'Permisos', 'Estado', 'Último acceso', { texto: '', derecha: true }]}>
            {lista.map((a) => (
              <tr key={a.id} className="hover:bg-background/60">
                <td className="px-5 py-3">
                  <span className="block font-semibold text-foreground">
                    {a.nombre}
                    {a.id === yo.id && <span className="ml-1.5 text-[12px] font-normal text-muted">(tú)</span>}
                  </span>
                  <span className="block text-[12px] text-muted">{a.correo}</span>
                </td>
                <td className="px-5 py-3">{a.esSuper ? <Insignia tono="info">Superadministrador</Insignia> : <span className="text-foreground">Administrador</span>}</td>
                <td className="px-5 py-3 text-foreground tabular-nums">{a.esSuper ? 'Todos' : `${a.permisos.length} de 15`}</td>
                <td className="px-5 py-3">
                  {!a.activo ? (
                    <Insignia tono="neutro">Desactivado</Insignia>
                  ) : a.debeCambiarContrasena ? (
                    <Insignia tono="aviso">Contraseña temporal</Insignia>
                  ) : (
                    <Insignia tono="exito">Activo</Insignia>
                  )}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-muted">{a.ultimoAccesoEn ? fechaHora(a.ultimoAccesoEn) : 'Nunca'}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {puede('auditoria.ver') && (
                      <Boton chico variante="fantasma" onClick={() => setDialogo({ tipo: 'actividad', a })}>
                        Actividad
                      </Boton>
                    )}
                    {gestionable(a) && (
                      <>
                        <Boton chico variante="fantasma" onClick={() => setDialogo({ tipo: 'editar', a })}>
                          Editar
                        </Boton>
                        {puede('permisos.gestionar') && (
                          <Boton chico variante="fantasma" onClick={() => setDialogo({ tipo: 'permisos', a })}>
                            Permisos
                          </Boton>
                        )}
                        <Boton chico variante="fantasma" onClick={() => setDialogo({ tipo: 'restablecer', a })}>
                          Restablecer contraseña
                        </Boton>
                        <Boton chico variante="fantasma" onClick={() => setDialogo({ tipo: 'activo', a })}>
                          {a.activo ? 'Desactivar' : 'Activar'}
                        </Boton>
                        <Boton chico variante="fantasma" className="text-danger-deep" onClick={() => setDialogo({ tipo: 'eliminar', a })}>
                          Revocar acceso
                        </Boton>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>

      {dialogo?.tipo === 'crear' && (
        <DialogoDatos
          onCerrar={cerrar}
          onGuardado={(r) => {
            cargar();
            if (r.contrasenaTemporal) setDialogo({ tipo: 'temporal', correo: r.correo, contrasena: r.contrasenaTemporal });
            else cerrar();
          }}
        />
      )}
      {dialogo?.tipo === 'editar' && (
        <DialogoDatos
          admin={dialogo.a}
          onCerrar={cerrar}
          onGuardado={() => {
            notificarExito('Datos actualizados.');
            cargar();
            cerrar();
          }}
        />
      )}
      {dialogo?.tipo === 'permisos' && (
        <DialogoPermisos
          admin={dialogo.a}
          onCerrar={cerrar}
          onGuardado={() => {
            notificarExito('Permisos actualizados.');
            cargar();
            cerrar();
          }}
        />
      )}
      {dialogo?.tipo === 'temporal' && <DialogoTemporal correo={dialogo.correo} contrasena={dialogo.contrasena} onCerrar={cerrar} />}
      {dialogo?.tipo === 'actividad' && <DialogoActividad admin={dialogo.a} onCerrar={cerrar} />}
      {(dialogo?.tipo === 'activo' || dialogo?.tipo === 'restablecer' || dialogo?.tipo === 'eliminar') && (
        <DialogoConfirmar
          dialogo={dialogo}
          onCerrar={cerrar}
          onHecho={(contrasena) => {
            cargar();
            if (contrasena && dialogo.tipo === 'restablecer') setDialogo({ tipo: 'temporal', correo: dialogo.a.correo, contrasena });
            else cerrar();
          }}
        />
      )}
    </div>
  );
}

/** Las casillas de permisos, por grupo. Solo se marca lo que uno mismo tiene. */
function CasillasPermisos({ valor, onCambiar }: { valor: Permiso[]; onCambiar: (p: Permiso[]) => void }) {
  const { catalogos, admin: yo } = useSesionAdmin();
  const grupos = [...new Set((catalogos?.permisos ?? []).map((p) => p.grupo))];
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <fieldset key={g}>
          <legend className="mb-1.5 text-[12.5px] font-semibold text-muted">{g}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {(catalogos?.permisos ?? [])
              .filter((p) => p.grupo === g)
              .map((p) => {
                const disponible = yo.esSuper || yo.permisos.includes(p.id);
                const marcado = valor.includes(p.id);
                return (
                  <label
                    key={p.id}
                    title={disponible ? undefined : 'No puedes otorgar un permiso que tú no tienes'}
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-[13px] ${
                      disponible ? 'cursor-pointer border-border hover:border-muted' : 'cursor-not-allowed border-border/60 opacity-50'
                    } ${marcado ? 'border-accent/50 bg-accent/[0.04]' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-accent"
                      checked={marcado}
                      disabled={!disponible}
                      onChange={(e) => onCambiar(e.target.checked ? [...valor, p.id] : valor.filter((x) => x !== p.id))}
                    />
                    <span className="text-foreground">{p.nombre}</span>
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function DialogoDatos({
  admin,
  onCerrar,
  onGuardado,
}: {
  admin?: Administrador;
  onCerrar: () => void;
  onGuardado: (r: { correo: string; contrasenaTemporal?: string }) => void;
}) {
  const { puede } = useSesionAdmin();
  const [nombre, setNombre] = useState(admin?.nombre ?? '');
  const [correo, setCorreo] = useState(admin?.correo ?? '');
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (nombre.trim().length < 2) return setFallo('Escribe el nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return setFallo('El correo no es válido.');
    setEnviando(true);
    setFallo(null);
    try {
      if (admin) {
        await pedir(`/administradores/${admin.id}`, 'PATCH', { nombre: nombre.trim(), correo: correo.trim() });
        onGuardado({ correo: correo.trim() });
      } else {
        const r = await pedir<{ contrasenaTemporal: string }>('/administradores', 'POST', { nombre: nombre.trim(), correo: correo.trim(), permisos });
        onGuardado({ correo: correo.trim(), contrasenaTemporal: r.contrasenaTemporal });
      }
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={admin ? `Editar a ${admin.nombre}` : 'Nuevo administrador'}
      descripcion={admin ? undefined : 'Se le generará una contraseña temporal que deberá cambiar al entrar por primera vez.'}
      ancho="max-w-xl"
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" cargando={enviando} onClick={() => void guardar()}>
            {admin ? 'Guardar' : 'Crear administrador'}
          </Boton>
        </>
      }
    >
      {fallo && <AvisoError>{fallo}</AvisoError>}
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
      <Campo etiqueta="Correo de acceso" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
      {!admin && puede('permisos.gestionar') && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-foreground">Permisos</p>
          <CasillasPermisos valor={permisos} onCambiar={setPermisos} />
        </div>
      )}
    </Modal>
  );
}

function DialogoPermisos({ admin, onCerrar, onGuardado }: { admin: Administrador; onCerrar: () => void; onGuardado: () => void }) {
  const [permisos, setPermisos] = useState<Permiso[]>(admin.permisos);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const guardar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await pedir(`/administradores/${admin.id}/permisos`, 'PUT', { permisos });
      onGuardado();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal
      titulo={`Permisos de ${admin.nombre}`}
      descripcion="Lo que marques es lo único que podrá hacer en el panel. Los cambios aplican en su siguiente acción."
      ancho="max-w-xl"
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" cargando={enviando} onClick={() => void guardar()}>
            Guardar permisos
          </Boton>
        </>
      }
    >
      {fallo && <AvisoError>{fallo}</AvisoError>}
      <CasillasPermisos valor={permisos} onCambiar={setPermisos} />
    </Modal>
  );
}

function DialogoConfirmar({
  dialogo,
  onCerrar,
  onHecho,
}: {
  dialogo: { tipo: 'activo' | 'restablecer' | 'eliminar'; a: Administrador };
  onCerrar: () => void;
  onHecho: (contrasenaTemporal?: string) => void;
}) {
  const { tipo, a } = dialogo;
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const textos = {
    activo: a.activo
      ? { titulo: `¿Desactivar a ${a.nombre}?`, texto: 'No podrá entrar al panel y sus sesiones abiertas se cierran. Puedes reactivarlo cuando quieras.', boton: 'Desactivar', variante: 'peligro' as const }
      : { titulo: `¿Activar a ${a.nombre}?`, texto: 'Podrá volver a entrar con su contraseña.', boton: 'Activar', variante: 'primario' as const },
    restablecer: { titulo: `¿Restablecer la contraseña de ${a.nombre}?`, texto: 'Se genera una contraseña temporal, se cierran sus sesiones y deberá cambiarla al entrar.', boton: 'Restablecer', variante: 'primario' as const },
    eliminar: { titulo: `¿Revocar el acceso de ${a.nombre}?`, texto: 'La cuenta deja de existir para el panel. Su actividad se conserva en la auditoría. No se puede deshacer.', boton: 'Revocar acceso', variante: 'peligro' as const },
  }[tipo];

  const ejecutar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      if (tipo === 'activo') {
        await pedir(`/administradores/${a.id}/activo`, 'POST', { activo: !a.activo });
        notificarExito(a.activo ? 'Administrador desactivado.' : 'Administrador activado.');
        onHecho();
      } else if (tipo === 'restablecer') {
        const r = await pedir<{ contrasenaTemporal: string }>(`/administradores/${a.id}/restablecer-contrasena`, 'POST');
        onHecho(r.contrasenaTemporal);
      } else {
        await pedir(`/administradores/${a.id}`, 'DELETE');
        notificarExito('Acceso revocado.');
        onHecho();
      }
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={textos.titulo}
      descripcion={textos.texto}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante={textos.variante} cargando={enviando} onClick={() => void ejecutar()}>
            {textos.boton}
          </Boton>
        </>
      }
    >
      {fallo && <AvisoError>{fallo}</AvisoError>}
    </Modal>
  );
}

/** La contraseña temporal se ve UNA vez: en la base solo queda su hash. */
function DialogoTemporal({ correo, contrasena, onCerrar }: { correo: string; contrasena: string; onCerrar: () => void }) {
  const copiar = () => {
    navigator.clipboard
      .writeText(contrasena)
      .then(() => notificarExito('Contraseña copiada.'))
      .catch(() => notificarError('No se pudo copiar. Selecciónala y cópiala a mano.'));
  };
  return (
    <Modal
      titulo="Contraseña temporal"
      descripcion="Entrégala por un canal privado. No se volverá a mostrar: si se pierde, restablécela otra vez. Al entrar, deberá cambiarla."
      onCerrar={onCerrar}
      pie={
        <Boton variante="primario" onClick={onCerrar}>
          Ya la guardé
        </Boton>
      }
    >
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <p className="text-[12.5px] text-muted">Correo</p>
        <p className="text-[14px] font-semibold text-foreground">{correo}</p>
        <p className="mt-3 text-[12.5px] text-muted">Contraseña temporal</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 font-mono text-[15px] tracking-wide break-all text-foreground ring-1 ring-border select-all">{contrasena}</code>
          <Boton chico onClick={copiar}>
            Copiar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

function DialogoActividad({ admin, onCerrar }: { admin: Administrador; onCerrar: () => void }) {
  const [items, setItems] = useState<EntradaAuditoria[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  useEffect(() => {
    pedir<{ items: EntradaAuditoria[] }>(`/auditoria?admin=${admin.id}&limite=50`)
      .then((r) => setItems(r.items))
      .catch((e) => setFallo(mensajeDe(e)));
  }, [admin.id]);
  return (
    <Modal titulo={`Actividad de ${admin.nombre}`} descripcion="Sus últimas 50 acciones en el panel." ancho="max-w-xl" onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      {fallo ? (
        <AvisoError>{fallo}</AvisoError>
      ) : !items ? (
        <Cargando />
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted">Todavía no tiene actividad.</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {items.map((e) => (
            <li key={e.id} className="px-4 py-2.5">
              <p className="text-[13.5px] text-foreground">{textoAccion(e.accion)}</p>
              <p className="text-[12px] text-muted">
                {fechaHora(e.fecha)}
                {e.ip && ` · ${e.ip}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
