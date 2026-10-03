import { useCallback, useEffect, useState } from 'react';
import { notificarExito } from '../../lib/notificar';
import { pedir, mensajeDe } from '../api';
import { useSesionAdmin } from '../sesion';
import { AreaTexto, AvisoError, Boton, Buscador, Cargando, Chips, Encabezado, Insignia, Modal, Paginacion, Tabla, Tarjeta, Vacio } from '../ui';
import { fecha } from '../formato';
import type { UsuarioAdmin } from '../tipos';

type Filtro = 'todos' | 'ACTIVO' | 'SUSPENDIDO';
const LIMITE = 20;

export default function Usuarios() {
  const { puede } = useSesionAdmin();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [offset, setOffset] = useState(0);
  const [datos, setDatos] = useState<{ items: UsuarioAdmin[]; total: number } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState<{ usuario: UsuarioAdmin; suspender: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(q.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ limite: String(LIMITE), offset: String(offset) });
    if (filtro !== 'todos') p.set('estado', filtro);
    if (busqueda) p.set('q', busqueda);
    pedir<{ items: UsuarioAdmin[]; total: number }>(`/usuarios?${p}`)
      .then((r) => {
        setDatos(r);
        setFallo(null);
      })
      .catch((e) => setFallo(mensajeDe(e)));
  }, [filtro, busqueda, offset]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmar = async () => {
    if (!objetivo) return;
    setEnviando(true);
    setErrorAccion(null);
    try {
      const { usuario, suspender } = objetivo;
      await pedir(`/usuarios/${usuario.id}/${suspender ? 'suspender' : 'reactivar'}`, 'POST', suspender ? { motivo: motivo || undefined } : undefined);
      notificarExito(suspender ? `Suspendiste a ${usuario.nombre}.` : `Reactivaste a ${usuario.nombre}.`);
      setObjetivo(null);
      cargar();
    } catch (e) {
      setErrorAccion(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Encabezado titulo="Usuarios" descripcion="Las cuentas del marketplace. Suspender a alguien cierra sus sesiones y oculta todos sus anuncios del público." />

      <Tarjeta sinRelleno>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Chips<Filtro>
            opciones={[
              { id: 'todos', texto: 'Todos' },
              { id: 'ACTIVO', texto: 'Activos' },
              { id: 'SUSPENDIDO', texto: 'Suspendidos' },
            ]}
            valor={filtro}
            onCambiar={(f) => {
              setFiltro(f);
              setOffset(0);
              setDatos(null);
            }}
          />
          <Buscador valor={q} onCambiar={setQ} placeholder="Buscar por nombre o correo" />
        </div>

        {fallo ? (
          <div className="px-5 pb-5">
            <AvisoError>{fallo}</AvisoError>
          </div>
        ) : !datos ? (
          <Cargando mensaje="Cargando usuarios" />
        ) : datos.items.length === 0 ? (
          <Vacio titulo="Ningún usuario coincide" texto="Prueba con otra búsqueda o filtro." />
        ) : (
          <>
            <Tabla columnas={['Usuario', 'Tipo', 'Estado', { texto: 'Anuncios', derecha: true }, { texto: 'Denuncias', derecha: true }, { texto: 'Alta', derecha: true }, { texto: '', derecha: true }]}>
              {datos.items.map((u) => (
                <tr key={u.id} className="hover:bg-background/60">
                  <td className="px-5 py-3">
                    <span className="block max-w-[260px] truncate font-semibold text-foreground">{u.nombre}</span>
                    <span className="block max-w-[260px] truncate text-[12px] text-muted">
                      {u.correo}
                      {!u.correoVerificado && ' · sin verificar'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-foreground">{u.tipo === 'NEGOCIO' ? 'Negocio' : 'Persona'}</td>
                  <td className="px-5 py-3">
                    <Insignia tono={u.estado === 'ACTIVO' ? 'exito' : u.estado === 'SUSPENDIDO' ? 'peligro' : 'neutro'}>
                      {u.estado === 'ACTIVO' ? 'Activa' : u.estado === 'SUSPENDIDO' ? 'Suspendida' : 'Inactiva'}
                    </Insignia>
                  </td>
                  <td className="px-5 py-3 text-right text-foreground tabular-nums">{u.anuncios}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${u.denuncias > 0 ? 'font-semibold text-danger-deep' : 'text-muted'}`}>{u.denuncias}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-muted">{fecha(u.creadoEn)}</td>
                  <td className="px-5 py-3 text-right">
                    {u.estado === 'SUSPENDIDO'
                      ? puede('usuarios.reactivar') && (
                          <Boton chico onClick={() => setObjetivo({ usuario: u, suspender: false })}>
                            Reactivar
                          </Boton>
                        )
                      : puede('usuarios.suspender') && (
                          <Boton
                            chico
                            variante="fantasma"
                            className="text-danger-deep"
                            onClick={() => {
                              setMotivo('');
                              setErrorAccion(null);
                              setObjetivo({ usuario: u, suspender: true });
                            }}
                          >
                            Suspender
                          </Boton>
                        )}
                  </td>
                </tr>
              ))}
            </Tabla>
            <Paginacion total={datos.total} offset={offset} limite={LIMITE} onCambiar={setOffset} />
          </>
        )}
      </Tarjeta>

      {objetivo && (
        <Modal
          titulo={objetivo.suspender ? `¿Suspender a ${objetivo.usuario.nombre}?` : `¿Reactivar a ${objetivo.usuario.nombre}?`}
          descripcion={
            objetivo.suspender
              ? 'No podrá entrar a Baknazo, sus sesiones se cierran y sus anuncios dejan de verse. Se puede revertir.'
              : 'Podrá volver a entrar y sus anuncios publicados vuelven a verse.'
          }
          onCerrar={() => setObjetivo(null)}
          pie={
            <>
              <Boton onClick={() => setObjetivo(null)}>Cancelar</Boton>
              <Boton variante={objetivo.suspender ? 'peligro' : 'primario'} cargando={enviando} onClick={() => void confirmar()}>
                {objetivo.suspender ? 'Suspender' : 'Reactivar'}
              </Boton>
            </>
          }
        >
          {errorAccion && <AvisoError>{errorAccion}</AvisoError>}
          {objetivo.suspender && <AreaTexto etiqueta="Motivo (queda en la auditoría)" valor={motivo} onCambiar={setMotivo} max={300} />}
        </Modal>
      )}
    </div>
  );
}
