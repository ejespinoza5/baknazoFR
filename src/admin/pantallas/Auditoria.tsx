import { useCallback, useEffect, useState } from 'react';
import { pedir, mensajeDe } from '../api';
import { textoAccion } from '../acciones';
import { AvisoError, Cargando, Chips, Encabezado, Paginacion, Tabla, Tarjeta, Vacio } from '../ui';
import { fechaHora } from '../formato';
import type { EntradaAuditoria } from '../tipos';

type Filtro = '' | 'anuncio' | 'denuncias' | 'usuario' | 'admin' | 'moderacion' | 'sesion' | 'cuenta';
const LIMITE = 30;

/** Qué se hizo, quién, cuándo y desde dónde. Solo lectura: nadie la edita. */
export default function Auditoria() {
  const [filtro, setFiltro] = useState<Filtro>('');
  const [offset, setOffset] = useState(0);
  const [datos, setDatos] = useState<{ items: EntradaAuditoria[]; total: number } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ limite: String(LIMITE), offset: String(offset) });
    if (filtro) p.set('accion', filtro);
    pedir<{ items: EntradaAuditoria[]; total: number }>(`/auditoria?${p}`)
      .then((r) => {
        setDatos(r);
        setFallo(null);
      })
      .catch((e) => setFallo(mensajeDe(e)));
  }, [filtro, offset]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resumen = (e: EntradaAuditoria) => {
    const d = e.detalle || {};
    const partes: string[] = [];
    if (typeof d.titulo === 'string') partes.push(`«${d.titulo}»`);
    if (typeof d.correo === 'string') partes.push(d.correo);
    if (typeof d.termino === 'string') partes.push(`«${d.termino}»`);
    if (typeof d.motivo === 'string') partes.push(d.motivo);
    return partes.join(' · ');
  };

  return (
    <div className="space-y-6">
      <Encabezado titulo="Auditoría" descripcion="Cada acción del panel queda registrada con quién la hizo, cuándo y desde qué dirección. No se puede editar ni borrar." />
      <Tarjeta sinRelleno>
        <div className="px-5 py-4">
          <Chips<Filtro>
            opciones={[
              { id: '', texto: 'Todo' },
              { id: 'anuncio', texto: 'Anuncios' },
              { id: 'denuncias', texto: 'Denuncias' },
              { id: 'usuario', texto: 'Usuarios' },
              { id: 'admin', texto: 'Administradores' },
              { id: 'moderacion', texto: 'Reglas' },
              { id: 'sesion', texto: 'Sesiones' },
              { id: 'cuenta', texto: 'Cuentas' },
            ]}
            valor={filtro}
            onCambiar={(f) => {
              setFiltro(f);
              setOffset(0);
              setDatos(null);
            }}
          />
        </div>
        {fallo ? (
          <div className="px-5 pb-5">
            <AvisoError>{fallo}</AvisoError>
          </div>
        ) : !datos ? (
          <Cargando mensaje="Cargando la auditoría" />
        ) : datos.items.length === 0 ? (
          <Vacio titulo="Sin registros" texto="Todavía no hay acciones de este tipo." />
        ) : (
          <>
            <Tabla columnas={['Fecha', 'Administrador', 'Acción', 'Detalle', 'IP']}>
              {datos.items.map((e) => (
                <tr key={e.id} className="align-top hover:bg-background/60">
                  <td className="px-5 py-3 whitespace-nowrap text-muted">{fechaHora(e.fecha)}</td>
                  <td className="px-5 py-3">
                    <span className="block text-foreground">{e.admin?.nombre ?? 'Cuenta eliminada'}</span>
                    {e.admin && <span className="block text-[12px] text-muted">{e.admin.correo}</span>}
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{textoAccion(e.accion)}</td>
                  <td className="max-w-[320px] px-5 py-3 text-muted">{resumen(e) || '—'}</td>
                  <td className="px-5 py-3 font-mono text-[12px] whitespace-nowrap text-muted">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </Tabla>
            <Paginacion total={datos.total} offset={offset} limite={LIMITE} onCambiar={setOffset} />
          </>
        )}
      </Tarjeta>
    </div>
  );
}
