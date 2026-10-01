import { useEffect, useMemo, useState } from 'react';
import MarcoApp from '../../components/MarcoApp';
import TarjetaAnuncio from '../../components/TarjetaAnuncio';
import FormularioAnuncio from '../../components/FormularioAnuncio';
import PreviaAnuncio from '../../components/PreviaAnuncio';
import { IconoAlerta, IconoInfo } from '../../components/Iconos';
import {
  editarAnuncio,
  erroresDeValidacion,
  obtenerAnuncio,
  obtenerCatalogos,
} from '../../api/anuncios';
import { notificarAviso, notificarExito, notificarInfo } from '../../lib/notificar';
import { telefonoDeContacto, telefonoPlausible } from '../../lib/contacto';
import { actualizarPerfil } from '../../api/auth';
import { urlCompleta } from '../../lib/imagen';
import { useObjectUrl } from '../../lib/objetoUrl';
import { formatearPrecio, formatearUbicacion } from '../../lib/tarjeta';
import { ESTILO_PILAR } from '../../lib/pilares';
import {
  DETALLE_POR_PILAR,
  detalleDeFormulario,
  formularioDesdeAnuncio,
  mapearErrores,
  normalizarPrecio,
  validarFormulario,
  type ErrorCampo,
  type Formulario,
} from '../../lib/formularioAnuncio';
import { alertaError, avisoInfo, tarjeta } from '../config/ui';
import GaleriaFoto, { type Galeria } from './GaleriaFoto';
import { catalogosDeRespaldo, EJEMPLO_TITULO } from '../publicar/datos';
import type { PerfilUsuario } from '../../types/auth';
import type {
  Anuncio,
  CambiosAnuncio,
  Catalogos,
  EstadoAnuncio,
  EstadoEditable,
} from '../../types/anuncio';
import BaknazoLoader from '../../components/BaknazoLoader';

interface Props {
  id: number;
  onVolver: () => void;
  /** Igual que al publicar: para saber si hay un número que mostrar. */
  perfil?: PerfilUsuario | null;
  /** Perfil recién guardado desde aquí, para que deje de contar como vacío. */
  onPerfilActualizado?: (usuario: PerfilUsuario) => void;
}

/**
 * Qué puede hacer el dueño con el anuncio según el estado en que está.
 *
 * Los destinos son solo `PUBLICADO` y `PAUSADO`: es lo que el backend acepta
 * como destino de un PATCH. Un `PUBLICADO` no puede volver a `BORRADOR` por
 * aquí, y un `RECHAZADO` no se puede volver a publicar.
 */
const ACCIONES: Record<
  EstadoAnuncio,
  { texto: string; destino: EstadoEditable; ayuda: string }[]
> = {
  PUBLICADO: [
    { texto: 'Pausar', destino: 'PAUSADO', ayuda: 'Deja de verse en el feed.' },
  ],
  PAUSADO: [
    {
      texto: 'Reanudar',
      destino: 'PUBLICADO',
      ayuda: 'Vuelve a aparecer en el feed.',
    },
  ],
  BORRADOR: [
    { texto: 'Publicar', destino: 'PUBLICADO', ayuda: 'Aparece en el feed.' },
  ],
  RECHAZADO: [],
  ELIMINADO: [],
};

/** Dos precios son el mismo si dicen el mismo número: "320" y "320.00". */
function mismoPrecio(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return Number(a) === Number(b);
}

/**
 * El catálogo nunca puede dejar fuera lo que el anuncio ya tiene.
 *
 * Si falló la carga de catálogos, o si el anuncio usa una categoría o un cantón
 * que el catálogo no lista, el `<select` lo perdería al renderizarse y el
 * guardado mandaría un `categoriaId` vacío. Con esto, la categoría del anuncio
 * siempre está en la lista y el valor nunca se pierde por un catálogo viejo.
 */
function catalogosConElAnuncio(catalogos: Catalogos, anuncio: Anuncio): Catalogos {
  // El catálogo y el anuncio no siempre traen los códigos con el mismo tipo: el
  // catálogo sale de `c.codigo` y el anuncio de `anuncio.cantonCodigo`, y según
  // el origen uno llega como texto y el otro como número. Compararlos con `===`
  // hacía creer que el cantón no estaba, y la provincia del anuncio se colaba
  // dos veces en el mismo `<select>`. Comparar por texto lo evita.
  const mismoCodigo = (a: string | number, b: string | number) => String(a) === String(b);

  const categorias = catalogos.categorias.some((c) => mismoCodigo(c.id, anuncio.categoria.id))
    ? catalogos.categorias
    : [...catalogos.categorias, anuncio.categoria];

  const tieneElCantón = catalogos.provincias.some((p) =>
    p.cantones.some((c) => mismoCodigo(c.codigo, anuncio.cantonCodigo))
  );
  // Si la provincia del anuncio ya está en el catálogo, se le agrega el cantón
  // en vez de repetir la provincia entera.
  if (tieneElCantón) return { ...catalogos, categorias, provincias: catalogos.provincias };

  const provincias = catalogos.provincias.filter(
    (p) => !mismoCodigo(p.codigo, anuncio.provinciaCodigo)
  );

  return {
    ...catalogos,
    categorias,
    provincias: [
      {
        codigo: anuncio.provinciaCodigo,
        nombre: anuncio.provincia,
        cantones: [{ codigo: anuncio.cantonCodigo, nombre: anuncio.ubicacion }],
      },
      ...provincias,
    ],
  };
}

export default function EditarAnuncioScreen({
  id,
  onVolver,
  perfil = null,
  onPerfilActualizado = () => {},
}: Props) {
  /** Lo que hay guardado en el servidor: la referencia de todos los cambios. */
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<'sin-conexion' | 'error' | 'ajeno' | null>(null);

  const [catalogos, setCatalogos] = useState<Catalogos>(() =>
    catalogosDeRespaldo()
  );
  const [sinCatalogos, setSinCatalogos] = useState(false);
  const [form, setForm] = useState<Formulario | null>(null);
  const [galeria, setGaleria] = useState<Galeria>({ existentes: [], nuevas: [] });
  const [errores, setErrores] = useState<Partial<Record<ErrorCampo, string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [verPrevia, setVerPrevia] = useState(false);

  /* ---------- Teléfono ---------- */

  const tieneTelefono = telefonoDeContacto(perfil) !== null;
  /** El número escrito en el propio formulario, si la cuenta no tenía ninguno. */
  const [telefonoNuevo, setTelefonoNuevo] = useState('');
  const telefonoNuevoValido = telefonoPlausible(telefonoNuevo);
  const hayTelefono = tieneTelefono || telefonoNuevoValido;

  /* ---------- Carga ---------- */

  useEffect(() => {
    let vivo = true;

    obtenerAnuncio(id)
      .then((respuesta) => {
        if (!vivo) return;
        setAnuncio(respuesta.anuncio);
        setForm(
          formularioDesdeAnuncio(respuesta.anuncio, catalogosDeRespaldo().maxFotos)
        );
        setGaleria({ existentes: respuesta.anuncio.fotos, nuevas: [] });
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        const estado = (e as { status?: number }).status;
        // 403 y 404 significan lo mismo aquí: no es un anuncio que este usuario
        // pueda editar. 404 además cubre el anuncio que alguien ya borró.
        setFallo(estado === 403 || estado === 404 ? 'ajeno' : estado ? 'error' : 'sin-conexion');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    let vivo = true;
    obtenerCatalogos()
      .then((respuesta) => {
        if (vivo) setCatalogos(respuesta);
      })
      .catch(() => {
        // Editar no depende del catálogo: sin él solo faltan las opciones para
        // cambiar de categoría o de ciudad, no los campos ya guardados.
        if (vivo) setSinCatalogos(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const pilares = ESTILO_PILAR;
  const pilar = anuncio?.pilar;
  const estilo = pilar ? pilares[pilar] : null;

  const catalogoUtil = useMemo(
    () => (anuncio ? catalogosConElAnuncio(catalogos, anuncio) : catalogos),
    [catalogos, anuncio]
  );

  /* ---------- Cambios ---------- */

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setForm((anterior) => (anterior ? { ...anterior, [campo]: valor } : anterior));
    // El error se borra al tocar el campo, no al volver a guardar.
    setErrores((anterior) =>
      anterior[campo as ErrorCampo] ? { ...anterior, [campo]: undefined } : anterior
    );
  };

  const nombreCiudad = useMemo(() => {
    if (!form) return '';
    for (const provincia of catalogoUtil.provincias) {
      const canton = provincia.cantones.find((c) => c.codigo === form.cantonCodigo);
      if (canton) return canton.nombre;
    }
    return '';
  }, [catalogoUtil.provincias, form]);

  /* ---------- Vista previa ---------- */

  const portadaNueva = useObjectUrl(galeria.nuevas[0]);
  const previa = useMemo(() => {
    if (!form || !pilar) return null;
    const titulo = form.titulo.trim() || EJEMPLO_TITULO[pilar];
    const importe = formatearPrecio(normalizarPrecio(form.precio), pilar);
    return {
      titulo,
      precio: importe,
      ubicacion: formatearUbicacion(nombreCiudad || 'Ciudad por definir', null),
      foto: urlCompleta(galeria.existentes[0]?.url ?? null) ?? portadaNueva,
    };
  }, [form, pilar, nombreCiudad, portadaNueva, galeria.existentes]);

  /* ---------- Guardar ---------- */

  /**
   * Solo se manda lo que cambió.
   *
   * El PATCH es parcial y `sector` no se toca nunca desde aquí, así que mandarlo
   * todo en cada guardado pisaría campos que esta pantalla ni muestra. La
   * comparación es contra `anuncio`, que es lo último que confirmó el servidor.
   */
  const construirCambios = (): CambiosAnuncio => {
    const cambios: CambiosAnuncio = {};
    if (!anuncio || !form) return cambios;

    const titulo = form.titulo.trim();
    if (titulo !== anuncio.titulo) cambios.titulo = titulo;

    const descripcion = form.descripcion.trim() || null;
    if (descripcion !== (anuncio.descripcion ?? null)) cambios.descripcion = descripcion;

    if (form.categoriaId !== anuncio.categoria.id)
      cambios.categoriaId = form.categoriaId as number;

    if (form.cantonCodigo !== anuncio.cantonCodigo)
      cambios.cantonCodigo = form.cantonCodigo;

    const precio = normalizarPrecio(form.precio);
    if (!mismoPrecio(precio, anuncio.precio)) cambios.precio = precio;

    // El `detalle` del backend se valida entero, así que se manda completo, pero
    // solo si alguno de sus campos del pilar cambió de verdad.
    const nuevo = detalleDeFormulario(pilar!, form) as unknown as Record<string, unknown>;
    const actual = anuncio.detalle as unknown as Record<string, unknown>;
    if (DETALLE_POR_PILAR[pilar!].some((clave) => nuevo[clave] !== actual[clave]))
      cambios.detalle = detalleDeFormulario(pilar!, form);

    // `fotosConservar` es el orden nuevo: la que quede de primera es la portada
    // y las que no estén, se borran.
    const ids = galeria.existentes.map((f) => f.id);
    const actuales = anuncio.fotos.map((f) => f.id);
    if (ids.join(',') !== actuales.join(',')) cambios.fotosConservar = ids;

    // Solo se manda si hay un número que respaldarlo. Una casilla marcada sin
    // número detrás produce un anuncio que promete contacto y no lo tiene, que
    // es peor que no enviarla.
    if (form.mostrarTelefono !== (anuncio.mostrarTelefono ?? false) || !hayTelefono)
      cambios.mostrarTelefono = form.mostrarTelefono && hayTelefono;

    return cambios;
  };

  /**
   * Guarda el número escrito en el propio formulario antes de mandar el PATCH.
   *
   * El orden importa: si el número fallara y se guardara el anuncio primero, el
   * anuncio quedaría con la casilla marcada sin número, y el usuario tendría
   * que volver a entrar a arreglarlo.
   */
  const guardarTelefonoNuevo = async (): Promise<boolean> => {
    if (!form || tieneTelefono || !form.mostrarTelefono) return true;
    const numero = telefonoNuevo.trim();
    if (!telefonoPlausible(numero)) {
      notificarAviso('El teléfono no parece un número válido.');
      return false;
    }

    try {
      const respuesta = await actualizarPerfil({
        contacto: { telefono: numero, mostrar_telefono: true },
      });
      onPerfilActualizado(respuesta.usuario);
      setTelefonoNuevo('');
      return true;
    } catch (e) {
      notificarAviso(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar tu teléfono. Intenta de nuevo.'
      );
      return false;
    }
  };

  const guardar = async () => {
    if (guardando || !anuncio || !form) return;

    const found = validarFormulario(
      form,
      pilar!,
      galeria.existentes.length + galeria.nuevas.length
    );
    setErrores(found);
    if (Object.keys(found).length > 0) {
      setVerPrevia(true);
      return;
    }

    const cambios = construirCambios();
    if (Object.keys(cambios).length === 0 && galeria.nuevas.length === 0) {
      notificarInfo('No hay cambios por guardar.');
      return;
    }

    setGuardando(true);
    try {
      if (!(await guardarTelefonoNuevo())) {
        notificarAviso('No se pudo guardar tu teléfono. No se guardaron los cambios.');
        return;
      }

      const respuesta = await editarAnuncio(anuncio.id, cambios, galeria.nuevas);
      // El PATCH devuelve el anuncio completo: se adopta como nueva referencia
      // para que el siguiente guardado compare contra lo que quedó guardado.
      setAnuncio(respuesta.anuncio);
      setForm(
        formularioDesdeAnuncio(respuesta.anuncio, catalogosDeRespaldo().maxFotos)
      );
      setGaleria({ existentes: respuesta.anuncio.fotos, nuevas: [] });
      setErrores({});
      notificarExito('Guardamos los cambios de tu anuncio.');
    } catch (e) {
      const delServidor = erroresDeValidacion(e);
      const mapeados = delServidor ? mapearErrores(delServidor) : null;
      if (mapeados && Object.keys(mapeados).length > 0) {
        setErrores(mapeados);
        setVerPrevia(true);
      } else {
        notificarAviso(
          e instanceof Error ? e.message : 'No se pudo guardar el anuncio.'
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Publicar, pausar o reanudar desde la misma pantalla.
   *
   * Va en su propio PATCH y no espera al botón de guardar: si alguien pausa un
   * anuncio y se le olvida guardar el texto, no tiene por qué enterarse luego de
   * que el texto tampoco se guardó.
   */
  const cambiarEstado = async (destino: EstadoEditable) => {
    if (cambiandoEstado || !anuncio) return;
    setCambiandoEstado(true);
    try {
      const respuesta = await editarAnuncio(anuncio.id, { estado: destino }, []);
      setAnuncio(respuesta.anuncio);
      notificarExito(
        destino === 'PAUSADO'
          ? `Pausaste «${anuncio.titulo}».`
          : `«${anuncio.titulo}» vuelve a estar visible.`
      );
    } catch (e) {
      notificarAviso(
        e instanceof Error ? e.message : 'No se pudo cambiar el estado del anuncio.'
      );
    } finally {
      setCambiandoEstado(false);
    }
  };

  const camposConError = Object.keys(errores).length > 0;

  /* ---------- Estados de carga y error ---------- */

  if (cargando) {
    return (
      <MarcoApp titulo="Editar anuncio">
        <div className="mx-auto grid min-h-[60svh] w-full max-w-[1120px] place-items-center px-4 py-10 sm:px-6">
          <BaknazoLoader mensaje="Cargando tu anuncio" />
        </div>
      </MarcoApp>
    );
  }

  if (fallo || !anuncio || !form || !pilar || !estilo) {
    return (
      <MarcoApp titulo="Editar anuncio">
        <div className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
          <div className={`${tarjeta} text-center`}>
            <h1 className="text-[19px] font-semibold tracking-tight text-foreground">
              {fallo === 'ajeno'
                ? 'Este anuncio no se puede editar'
                : 'No pudimos abrir tu anuncio'}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              {fallo === 'ajeno'
                ? 'Puede que lo hayas eliminado, o que sea de otra cuenta.'
                : fallo === 'sin-conexion'
                  ? 'Revisa tu conexión e inténtalo otra vez.'
                  : 'Vuelve a intentarlo en un momento.'}
            </p>
            <button
              type="button"
              onClick={onVolver}
              className="mt-5 h-10 rounded-lg border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-muted"
            >
              Volver a mis anuncios
            </button>
          </div>
        </div>
      </MarcoApp>
    );
  }

  return (
    <MarcoApp titulo="Editar anuncio">

      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-10">
          <div className="min-w-0">
            {/* En móvil la vista previa va arriba y plegada; en escritorio se
                corre a la columna lateral. Se declara una sola vez. */}
            {previa && (
              <section className="mb-6 min-w-0 lg:hidden">
                <PreviaAnuncio
                  abierta={verPrevia}
                  onAlternar={() => setVerPrevia((v) => !v)}
                  pilar={pilar}
                  titulo={previa.titulo}
                  precio={previa.precio}
                  ubicacion={previa.ubicacion}
                  ayuda="Así se ven los cambios que vas a guardar."
                  foto={previa.foto}
                />
              </section>
            )}

            {/* El tipo no se puede cambiar: el backend lo rechaza, así que se
                muestra como lo que es, un dato fijo del anuncio. */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${estilo.solido} ${estilo.sobreSolido}`}
              >
                {estilo.nombre}
              </span>
              <span className="text-[12.5px] text-muted">
                El tipo de un anuncio no se puede cambiar.
              </span>
            </div>

            <form
              className={`${tarjeta} mt-5 flex flex-col gap-5`}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                guardar();
              }}
            >
              <FormularioAnuncio
                form={form}
                cambiar={cambiar}
                errores={errores}
                catalogos={catalogoUtil}
                pilar={pilar}
                tieneTelefono={tieneTelefono}
                telefonoNuevo={telefonoNuevo}
                onTelefonoNuevo={setTelefonoNuevo}
                telefonoNuevoValido={telefonoNuevoValido}
                avisos={
                  <>
                    {anuncio.notasModeracion && (
                      <p className={avisoInfo} role="note">
                        <IconoInfo />
                        <span>
                          <strong className="font-semibold">
                            Nota de revisión:
                          </strong>{' '}
                          {anuncio.notasModeracion}
                        </span>
                      </p>
                    )}

                    {sinCatalogos && (
                      <p className={avisoInfo} role="note">
                        <IconoInfo />
                        <span>
                          No se pudo cargar el catálogo del servidor. Puedes
                          seguir editando lo que ya está escrito, pero no
                          cambiar de categoría ni de ciudad.
                        </span>
                      </p>
                    )}

                    {camposConError && (
                      <p className={alertaError} role="alert">
                        <IconoAlerta />
                        <span>Revisa los campos marcados antes de guardar.</span>
                      </p>
                    )}
                  </>
                }
                fotos={
                  <GaleriaFoto
                    galeria={galeria}
                    onCambio={setGaleria}
                    maxFotos={catalogoUtil.maxFotos}
                    maxBytes={catalogoUtil.maxBytesFoto}
                  />
                }
              >
                <div className="mt-1 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={guardando || cambiandoEstado}
                    className={`flex h-[52px] items-center justify-center gap-2 rounded-full text-[15.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${estilo.solido} ${estilo.solidoOscuro} ${estilo.sobreSolido}`}
                  >
                    {guardando ? <BaknazoLoader tamano="boton" mensaje="Guardando" /> : 'Guardar cambios'}
                  </button>
                  <p className="text-center text-[12.5px] leading-relaxed text-muted">
                    Solo se guardará lo que hayas cambiado. La fecha del anuncio
                    no cambia.
                  </p>
                </div>
              </FormularioAnuncio>
            </form>

            <EstadoDelAnuncio
              estado={anuncio.estado}
              notas={anuncio.notasModeracion ?? null}
              ocupado={cambiandoEstado}
              onCambiar={cambiarEstado}
            />
          </div>

          {/* ---------- Vista previa, escritorio ---------- */}
          {previa && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="mb-2.5 text-[12.5px] font-semibold tracking-[0.05em] text-muted uppercase">
                  Así se verá tu anuncio
                </p>
                <TarjetaAnuncio
                  pilar={pilar}
                  titulo={previa.titulo}
                  precio={previa.precio}
                  ubicacion={previa.ubicacion}
                  foto={previa.foto}
                />
                <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
                  Así se ven los cambios que vas a guardar.
                </p>
              </div>
            </aside>
          )}
        </div>
      </div>
    </MarcoApp>
  );
}

/* ---------- Piezas ---------- */

/**
 * El estado del anuncio, con lo que se puede hacer desde aquí.
 *
 * Vive debajo del formulario y no dentro: no es un campo del anuncio, es una
 * decisión distinta —pausar, reanudar, publicar— que se aplica en su propio
 * PATCH. Los destinos son los dos que el backend acepta, y un anuncio rechazado
 * no ofrece ninguno porque no se puede volver a publicar desde el PATCH.
 */
function EstadoDelAnuncio({
  estado,
  notas,
  ocupado,
  onCambiar,
}: {
  estado: Anuncio['estado'];
  notas: string | null;
  ocupado: boolean;
  onCambiar: (destino: EstadoEditable) => void;
}) {
  const acciones = ACCIONES[estado] ?? [];
  if (acciones.length === 0 && !notas) return null;

  return (
    <section className="mt-5 rounded-2xl border border-border bg-white p-5">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
        Visibilidad
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {estado === 'RECHAZADO'
          ? 'Este anuncio no pasó la revisión, así que no se puede publicar otra vez desde aquí. Corrige lo que pedían y deja que lo revisen de nuevo.'
          : 'Esto se aplica al instante, sin esperar a guardar los cambios de arriba.'}
      </p>
      {acciones.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {acciones.map((accion) => (
            <button
              key={accion.texto}
              type="button"
              title={accion.ayuda}
              onClick={() => onCambiar(accion.destino)}
              disabled={ocupado}
              className="h-9 rounded-lg border border-border bg-white px-3.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-50"
            >
              {ocupado ? <BaknazoLoader tamano="boton" mensaje="" /> : accion.texto}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
