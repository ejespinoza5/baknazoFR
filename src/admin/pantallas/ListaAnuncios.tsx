import { useCallback, useEffect, useState } from 'react';
import { ESTILO_PILAR } from '../../lib/pilares';
import { pedir, mensajeDe } from '../api';
import { useSesionAdmin } from '../sesion';
import { AvisoError, Boton, Buscador, Cargando, Chips, EstadoAnuncio, Insignia, Paginacion, Tabla, Tarjeta, Vacio } from '../ui';
import { espera, fecha } from '../formato';
import HojaAnuncio from './HojaAnuncio';
import type { AnuncioAdmin } from '../tipos';

const LIMITE = 20;

/**
 * La tabla de anuncios del panel, con su búsqueda, paginación y la ficha de
 * revisión. La usan Anuncios (con pestañas por estado) y Denuncias.
 */
export default function ListaAnuncios<V extends string>({
  ruta,
  vistas,
  vistaInicial,
  textoVacio,
}: {
  ruta: '/anuncios' | '/denuncias';
  vistas?: { id: V; texto: string }[];
  vistaInicial?: V;
  textoVacio: { titulo: string; texto: string };
}) {
  const { catalogos } = useSesionAdmin();
  const [vista, setVista] = useState<V | undefined>(vistaInicial);
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [offset, setOffset] = useState(0);
  const [datos, setDatos] = useState<{ items: AnuncioAdmin[]; total: number } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);

  /* La búsqueda espera a que se deje de escribir. */
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(q.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ limite: String(LIMITE), offset: String(offset) });
    if (vista) p.set('vista', vista);
    if (busqueda) p.set('q', busqueda);
    pedir<{ items: AnuncioAdmin[]; total: number }>(`${ruta}?${p}`)
      .then((r) => {
        setDatos(r);
        setFallo(null);
      })
      .catch((e) => setFallo(mensajeDe(e)));
  }, [ruta, vista, busqueda, offset]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <>
      <Tarjeta sinRelleno>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          {vistas && vista ? (
            <Chips
              opciones={vistas.map((v) => ({ id: v.id, texto: v.texto }))}
              valor={vista}
              onCambiar={(v) => {
                setVista(v);
                setOffset(0);
                setDatos(null);
              }}
            />
          ) : (
            <span />
          )}
          <Buscador valor={q} onCambiar={setQ} placeholder="Buscar por título o correo" />
        </div>

        {fallo ? (
          <div className="px-5 pb-5">
            <AvisoError>{fallo}</AvisoError>
          </div>
        ) : !datos ? (
          <Cargando mensaje="Cargando anuncios" />
        ) : datos.items.length === 0 ? (
          <Vacio titulo={busqueda ? `Nada coincide con «${busqueda}»` : textoVacio.titulo} texto={busqueda ? 'Prueba con otra búsqueda.' : textoVacio.texto} />
        ) : (
          <>
            <Tabla columnas={['Anuncio', 'Publicado por', 'Estado', 'Señales', { texto: 'Creado', derecha: true }, { texto: '', derecha: true }]}>
              {datos.items.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-background/60">
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setAbierto(a.id)} className="flex min-w-0 items-center gap-3 text-left">
                      {a.portada ? (
                        <img src={a.portada} alt="" className="size-11 shrink-0 rounded-lg object-cover ring-1 ring-border" />
                      ) : (
                        <span aria-hidden="true" className={`size-11 shrink-0 rounded-lg ${ESTILO_PILAR[a.pilar].fondo}`} />
                      )}
                      <span className="min-w-0">
                        <span className="block max-w-[280px] truncate font-semibold text-foreground hover:underline">{a.titulo}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${ESTILO_PILAR[a.pilar].punto}`} />
                          {a.categoria}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <span className="block max-w-[200px] truncate text-foreground">{a.autor.nombre}</span>
                    <span className="block max-w-[200px] truncate text-[12px] text-muted">{a.autor.correo}</span>
                  </td>
                  <td className="px-5 py-3">
                    <EstadoAnuncio estado={a.estado} porModeracion={a.pausaAdministrativa} />
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap gap-1">
                      {a.denunciasPendientes > 0 && <Insignia tono="peligro">{a.denunciasPendientes} denuncias</Insignia>}
                      {a.motivosRevision.map((m) => (
                        <Insignia key={m} tono="aviso">
                          {catalogos?.motivosRevision[m] ?? m}
                        </Insignia>
                      ))}
                      {a.denunciasPendientes === 0 && a.motivosRevision.length === 0 && <span className="text-[12px] text-muted">—</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <span className="block text-foreground">{fecha(a.creadoEn)}</span>
                    {a.estado === 'PENDIENTE_REVISION' && <span className="block text-[12px] text-warning-deep">espera {espera(a.creadoEn)}</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Boton chico variante={a.estado === 'PENDIENTE_REVISION' || a.denunciasPendientes > 0 ? 'primario' : 'secundario'} onClick={() => setAbierto(a.id)}>
                      {a.estado === 'PENDIENTE_REVISION' || a.denunciasPendientes > 0 ? 'Revisar' : 'Ver'}
                    </Boton>
                  </td>
                </tr>
              ))}
            </Tabla>
            <Paginacion total={datos.total} offset={offset} limite={LIMITE} onCambiar={setOffset} />
          </>
        )}
      </Tarjeta>

      {abierto !== null && <HojaAnuncio id={abierto} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
    </>
  );
}
