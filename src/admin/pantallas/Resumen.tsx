import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pedir, mensajeDe } from '../api';
import { useSesionAdmin } from '../sesion';
import { AvisoError, Boton, Cargando, Encabezado, Tarjeta } from '../ui';
import { espera } from '../formato';
import type { Estadisticas } from '../tipos';

/**
 * El resumen. Lo primero es la cola de moderación: cuántos anuncios esperan y
 * cuánto lleva el más antiguo, porque eso es lo que hay que atender hoy. Las
 * cifras generales y el ritmo de publicaciones van detrás.
 */
export default function Resumen() {
  const navegar = useNavigate();
  const { admin, puede } = useSesionAdmin();
  const [e, setE] = useState<Estadisticas | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    pedir<Estadisticas>('/estadisticas')
      .then(setE)
      .catch((err) => setFallo(mensajeDe(err)));
  }, []);

  if (fallo) return <AvisoError>{fallo}</AvisoError>;
  if (!e) return <Cargando mensaje="Cargando el resumen" />;

  const maximo = Math.max(1, ...e.serie.map((s) => s.total));
  const totalSerie = e.serie.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-6">
      <Encabezado titulo={`Hola, ${admin.nombre.split(' ')[0]}`} descripcion="Lo que necesita atención en Baknazo ahora mismo." />

      {/* ---------- La cola ---------- */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-brand/40 bg-white p-6">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-brand" />
          <p className="text-[13px] font-semibold text-brand-dark">Cola de moderación</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-[44px] leading-none font-semibold tracking-tight text-foreground tabular-nums">{e.pendientes}</p>
            <p className="pb-1 text-[14px] text-muted">{e.pendientes === 1 ? 'anuncio espera revisión' : 'anuncios esperan revisión'}</p>
          </div>
          <p className="mt-3 text-[13px] text-muted">
            {e.pendientes === 0
              ? 'Nada pendiente. Los anuncios que activen una regla aparecerán aquí.'
              : `El más antiguo lleva ${espera(e.pendienteMasAntiguo)} esperando.`}
          </p>
          {puede('anuncios.ver') && e.pendientes > 0 && (
            <Boton variante="primario" className="mt-5" onClick={() => navegar('/admin/anuncios')}>
              Revisar ahora
            </Boton>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <p className="text-[13px] font-semibold text-danger-deep">Denunciados</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-[44px] leading-none font-semibold tracking-tight text-foreground tabular-nums">{e.denunciados}</p>
            <p className="pb-1 text-[14px] text-muted">{e.denunciados === 1 ? 'anuncio con denuncias' : 'anuncios con denuncias'}</p>
          </div>
          <p className="mt-3 text-[13px] text-muted">Denuncias abiertas de usuarios, sin resolver.</p>
          {puede('denuncias.ver') && e.denunciados > 0 && (
            <Boton className="mt-5" onClick={() => navegar('/admin/denuncias')}>
              Ver denuncias
            </Boton>
          )}
        </div>
      </section>

      {/* ---------- Cifras ---------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra etiqueta="Anuncios publicados" valor={e.publicados} nota={`${e.anunciosSemana} nuevos en 7 días`} />
        <Cifra etiqueta="Rechazados" valor={e.rechazados} nota={`${e.pausados} pausados`} />
        <Cifra etiqueta="Usuarios" valor={e.usuarios} nota={`${e.usuariosNuevos} nuevos en 7 días`} />
        <Cifra etiqueta="Suspendidos" valor={e.usuariosSuspendidos} nota={`${e.decisionesSemana} decisiones en 7 días`} />
      </section>

      <Tarjeta titulo="Publicaciones de los últimos 14 días" descripcion={`${totalSerie} anuncios nuevos en el periodo.`}>
        <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Publicaciones por día: ${e.serie.map((s) => s.total).join(', ')}`}>
          {e.serie.map((s) => {
            const alto = Math.round((s.total / maximo) * 100);
            const dia = new Date(`${s.dia}T12:00:00`);
            return (
              <div key={s.dia} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] text-muted tabular-nums">{s.total || ''}</span>
                <span className="w-full rounded-t-md bg-accent/80" style={{ height: `${Math.max(alto, s.total ? 4 : 1)}%`, opacity: s.total ? 1 : 0.25 }} />
                <span className="text-[10.5px] text-muted tabular-nums">{dia.getDate()}</span>
              </div>
            );
          })}
        </div>
      </Tarjeta>
    </div>
  );
}

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-[12.5px] font-medium text-muted">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">{valor.toLocaleString('es-EC')}</p>
      <p className="mt-0.5 text-[12px] text-muted">{nota}</p>
    </div>
  );
}
