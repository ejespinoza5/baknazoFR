import { useEffect, useMemo, useState } from 'react';
import MarcoApp from '../../components/MarcoApp';
import { pedirUbicacion, type Punto } from '../../lib/ubicacion';
import TarjetaAnuncio from '../../components/TarjetaAnuncio';
import FormularioAnuncio from '../../components/FormularioAnuncio';
import PreviaAnuncio from '../../components/PreviaAnuncio';
import { IconoAlerta, IconoInfo } from '../../components/Iconos';
import { crearAnuncio, erroresDeValidacion, obtenerCatalogos } from '../../api/anuncios';
import {
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
} from '../../lib/borradorPublicar';
import { notificarAviso, notificarExito } from '../../lib/notificar';
import { telefonoDeContacto, telefonoPlausible } from '../../lib/contacto';
import { actualizarPerfil } from '../../api/auth';
import { anotarPropios } from '../../lib/propios';
import { lineaDeCelebracion } from '../../lib/celebrar';
import { useObjectUrl } from '../../lib/objetoUrl';
import { ESTILO_PILAR, type Pilar } from '../../lib/pilares';
import {
  detalleDeFormulario,
  formularioVacio,
  mapearErrores,
  normalizarPrecio,
  validarFormulario,
  type ErrorCampo,
  type Formulario,
} from '../../lib/formularioAnuncio';
import {
  alertaError,
  avisoInfo,
  tarjeta,
} from '../config/ui';
import HuecosFoto from './HuecosFoto';
import { catalogosDeRespaldo, EJEMPLO_TITULO } from './datos';
import type { Catalogos, DatosAnuncio } from '../../types/anuncio';
import type { PerfilUsuario } from '../../types/auth';
import BaknazoLoader from '../../components/BaknazoLoader';

interface Props {
  onVolver: () => void;
  /**
   * El perfil solo se usa para dos cosas: si hay número para mostrar y cuál es
   * la preferencia por defecto. Llega después de montar la pantalla, así que
   * no se puede leer solo en el inicializador del estado.
   */
  perfil?: PerfilUsuario | null;
  /**
   * Recibe el perfil recién guardado desde esta misma pantalla, para que el
   * número recién escrito deje de contar como "no registrado" sin esperar a
   * volver a cargar el perfil entero.
   */
  onPerfilActualizado?: (usuario: PerfilUsuario) => void;
}

/**
 * Clave de idempotencia. `crypto.randomUUID` solo existe en contexto seguro;
 * en la app servida por http en la LAN no, y sin ella el doble toque crearía
 * dos anuncios. El backend pide entre 8 y 100 caracteres.
 */
function nuevaClaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function PublicarScreen({
  onVolver,
  perfil = null,
  onPerfilActualizado = () => {},
}: Props) {
  /**
   * El borrador se lee en el inicializador del estado, no en un efecto: así se
   * aplica en el primer render y la pantalla no parpadea de vacía a rellena.
   */
  const [borrador] = useState(() => leerBorrador());

  /**
   * Si la casilla del teléfono ya la tocó alguien. El perfil se pide en paralelo
   * al montar y puede llegar tarde: sin este testigo, su llegada pisaría una
   * casilla que el usuario acababa de marcar, que es la forma más fácil de
   * perder lo que alguien quiso hacer.
   */
  const [tocadoTelefono, setTocadoTelefono] = useState(borrador !== null);

  const [catalogos, setCatalogos] = useState<Catalogos>(() =>
    catalogosDeRespaldo()
  );
  const [sinCatalogos, setSinCatalogos] = useState(false);
  const [pilar, setPilar] = useState<Pilar>(
    () => (borrador?.pilar as Pilar | undefined) ?? 'productos'
  );
  const [form, setForm] = useState<Formulario>(() => ({
    ...formularioVacio(
      catalogosDeRespaldo().maxFotos,
      perfil?.contacto?.mostrar_telefono ?? false
    ),
    ...(borrador ?? {}),
    // El borrador no guarda archivos: las fotos se piden de nuevo.
    fotos: Array.from(
      { length: catalogosDeRespaldo().maxFotos },
      () => null
    ),
  }));
  const [errores, setErrores] = useState<Partial<Record<ErrorCampo, string>>>({});
  const [publicando, setPublicando] = useState(false);
  /**
   * La ubicación aproximada del anuncio, si se quiso compartir. Es lo que lo
   * hace aparecer en "Cerca de ti": sin coordenadas, un anuncio solo se
   * encuentra por su ciudad.
   */
  const [ubicacion, setUbicacion] = useState<Punto | null>(null);
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);

  const alternarUbicacion = async () => {
    if (ubicacion) {
      setUbicacion(null);
      return;
    }
    setPidiendoUbicacion(true);
    try {
      setUbicacion(await pedirUbicacion());
    } catch (e) {
      notificarAviso(e instanceof Error ? e.message : 'No pudimos obtener tu ubicación.');
    } finally {
      setPidiendoUbicacion(false);
    }
  };
  const [verPrevia, setVerPrevia] = useState(false);

  const estilo = ESTILO_PILAR[pilar];
  const portada = useObjectUrl(form.fotos[0] ?? null);

  /**
   * Sin número guardado no hay nada que mostrar, y la casilla ni se pinta. De
   * una cuenta de negocio vale el suyo, que ya dio al registrarse.
   */
  const tieneTelefono = telefonoDeContacto(perfil) !== null;

  /**
   * El número escrito en el propio formulario, para las cuentas que no tienen
   * ninguno. Vive aquí y no en el formulario porque es la pantalla la que lo
   * tiene que guardar en el perfil antes de mandar el anuncio.
   */
  const [telefonoNuevo, setTelefonoNuevo] = useState('');
  const telefonoNuevoValido = telefonoPlausible(telefonoNuevo);
  /**
   * Con esto ya hay número para mostrar: el del perfil, el del negocio, o el
   * que se acaba de escribir. El checkbox se habilita con cualquiera de los
   * tres, que es la condición de la que depende `mostrarTelefono` al enviar.
   */
  const hayTelefono = tieneTelefono || telefonoNuevoValido;

  /* ---------- El perfil llega tarde: se adopta su preferencia ---------- */

  /**
   * El perfil se pide en paralelo a esta pantalla, así que puede llegar
   * después de que se monte. Cuando llega hay que adoptar su preferencia, pero
   * solo si nadie tocó la casilla: si no, su llegada pisaría una marca recién
   * hecha, que es la forma más fácil de perder lo que alguien quiso.
   *
   * Se ajusta durante el render y no en un efecto a propósito. Un `setState`
   * dentro de un efecto provoca un render en cascada —justo lo que la regla de
   * hooks prohíbe— mientras que aquí React lo resuelve antes de pintar nada, y
   * quien lo ve ya aparece con la casilla correcta.
   */
  const [perfilVisto, setPerfilVisto] = useState(perfil);
  if (perfil !== perfilVisto) {
    setPerfilVisto(perfil);
    if (!tocadoTelefono) {
      const porDefecto = Boolean(perfil?.contacto?.mostrar_telefono);
      setForm((anterior) =>
        anterior.mostrarTelefono === porDefecto
          ? anterior
          : { ...anterior, mostrarTelefono: porDefecto }
      );
    }
  }

  /* ---------- Borrador: se escribe en sessionStorage a cada cambio ---------- */

  useEffect(() => {
    // Solo texto: las fotos son File y no se guardan.
    guardarBorrador({
      pilar,
      titulo: form.titulo,
      categoriaId: form.categoriaId,
      cantonCodigo: form.cantonCodigo,
      descripcion: form.descripcion,
      precio: form.precio,
      condicion: form.condicion,
      modalidadCobro: form.modalidadCobro,
      jornada: form.jornada,
      modalidad: form.modalidad,
      mostrarTelefono: form.mostrarTelefono,
    });
  }, [form, pilar]);

  /* ---------- Catálogos ---------- */

  useEffect(() => {
    let vivo = true;

    obtenerCatalogos()
      .then((respuesta) => {
        if (!vivo) return;
        setCatalogos(respuesta);
        setForm((anterior) => ({
          ...anterior,
          fotos: Array.from({ length: respuesta.maxFotos }, () => null),
        }));
      })
      .catch(() => {
        // Sin backend se sigue con el catálogo de respaldo: la pantalla no se
        // queda en blanco, simplemente no se puede publicar.
        if (vivo) setSinCatalogos(true);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const categorias = useMemo(
    () => catalogos.categorias.filter((c) => c.pilar === pilar),
    [catalogos.categorias, pilar]
  );

  const nombreCiudad = useMemo(() => {
    for (const provincia of catalogos.provincias) {
      const canton = provincia.cantones.find((c) => c.codigo === form.cantonCodigo);
      if (canton) return canton.nombre;
    }
    return '';
  }, [catalogos.provincias, form.cantonCodigo]);

  /* ---------- Cambios ---------- */

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    if (campo === 'mostrarTelefono') setTocadoTelefono(true);
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
    // El error se borra al tocar el campo, no al enviar otra vez.
    setErrores((anterior) =>
      anterior[campo as ErrorCampo] ? { ...anterior, [campo]: undefined } : anterior
    );
  };

  const cambiarPilar = (nuevo: Pilar) => {
    if (nuevo === pilar) return;
    setPilar(nuevo);

    setForm((anterior) => {
      // La categoría no vale para todos los pilares: "Tecnología" de productos
      // no es la de empleo. Si no pertenece al pilar nuevo, se suelta.
      const sigueValiendo = categorias.find((c) => c.id === anterior.categoriaId);
      return {
        ...anterior,
        categoriaId: sigueValiendo ? anterior.categoriaId : '',
        condicion: '',
        modalidadCobro: '',
        jornada: '',
        modalidad: '',
      };
    });

    setErrores((anterior) => ({
      ...anterior,
      categoria: undefined,
      condicion: undefined,
      modalidadCobro: undefined,
      jornada: undefined,
      modalidad: undefined,
    }));
  };

  /* ---------- Vista previa ---------- */

  const previa = useMemo(() => {
    const titulo = form.titulo.trim() || EJEMPLO_TITULO[pilar];
    const vacio = !form.titulo.trim() && !form.precio.trim();

    let importe: string;
    const crudo = normalizarPrecio(form.precio);
    if (crudo !== null && Number(crudo) > 0) {
      // Los precios se muestran con dos decimales: es como se lee un monto.
      importe = `$${Number(crudo).toLocaleString('es-EC', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } else if (pilar === 'empleo') {
      importe = 'Salario a convenir';
    } else {
      importe = 'Precio a convenir';
    }

    return { titulo, precio: importe, ubicacion: nombreCiudad || 'Ciudad por definir', vacio };
  }, [form.titulo, form.precio, nombreCiudad, pilar]);

  /* ---------- Validación y envío ---------- */

  const validar = (): boolean => {
    const found = validarFormulario(form, pilar, form.fotos.filter(Boolean).length);
    setErrores(found);
    return Object.keys(found).length === 0;
  };

  const construirDatos = (): DatosAnuncio => {
    const comun = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || undefined,
      categoriaId: form.categoriaId as number,
      cantonCodigo: form.cantonCodigo,
      precio: normalizarPrecio(form.precio),
      mostrarTelefono: form.mostrarTelefono && hayTelefono,
      // Ya redondeada a ~1 km en `lib/ubicacion`: nunca la dirección exacta.
      ...(ubicacion ? { latitud: ubicacion.lat, longitud: ubicacion.lng } : {}),
    };

    return {
      ...comun,
      pilar,
      detalle: detalleDeFormulario(pilar, form),
    } as DatosAnuncio;
  };

  /**
   * Guarda el número que se escribió en el propio formulario, si es que se
   * escribió. Devuelve `true` si se guardó o si no había nada que guardar, y
   * `false` si falló, para que el envío se detenga sin crear un anuncio que
   * prometería un número que no llegó a existir.
   *
   * `mostrar_telefono` se manda en `true` junto al número: son la misma
   * decisión, no dos. Alguien que marca "que me contacten" está aceptando
   * ambos, y separarlos dejaría el caso raro de un número guardado con el
   * consentimiento apagado.
   */
  const guardarTelefonoNuevo = async (): Promise<boolean> => {
    if (tieneTelefono || !form.mostrarTelefono) return true;
    const numero = telefonoNuevo.trim();
    if (!telefonoPlausible(numero)) {
      notificarAviso('El teléfono no parece un número válido.');
      return false;
    }

    try {
      const respuesta = await actualizarPerfil({
        contacto: { telefono: numero, mostrar_telefono: true },
      });
      // Sin esto la pantalla seguiría creyendo que no hay número, y la casilla
      // volvería a desaparecer tras guardar.
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

  /**
   * Se genera una clave por intento y se conserva mientras el envío falla: si
   * el primer POST llegó al servidor y la respuesta se perdió, al reintentar
   * con la misma clave el backend devuelve el mismo anuncio en vez de crear
   * un duplicado. Se renueva solo tras un éxito.
   */
  const [claveIdempotencia, setClaveIdempotencia] = useState(
    nuevaClaveIdempotencia
  );

  const publicar = async () => {
    if (publicando) return;
    if (!validar()) {
      setVerPrevia(true);
      return;
    }

    setPublicando(true);
    const fotos = form.fotos.filter((f): f is File => f !== null);

    try {
      // El número se guarda antes que el anuncio, y solo si la casilla está
      // marcada. Escribir un número y luego no marcar nada no da permiso para
      // almacenarlo: se habría escrito un número que nadie pidió guardar, y a
      // la próxima publicación volvería a aparecer pre-marcado.
      if (!(await guardarTelefonoNuevo())) return;

      const respuesta = await crearAnuncio(construirDatos(), fotos, claveIdempotencia);
      // El id se apunta para que el feed no le ofrezca un chat al recién
      // publicado, que es justo el caso en el que más se notaría.
      anotarPropios([respuesta.anuncio.id]);

      setClaveIdempotencia(nuevaClaveIdempotencia());
      setForm(formularioVacio(catalogos.maxFotos, form.mostrarTelefono));
      setErrores({});
      setVerPrevia(false);
      borrarBorrador();
      notificarExito(lineaDeCelebracion());
      onVolver();
    } catch (e) {
      const delServidor = erroresDeValidacion(e);
      if (delServidor) {
        const mapeados = mapearErrores(delServidor);
        setErrores(mapeados);
        setVerPrevia(true);
        // Si el 422 habla de campos que este formulario no tiene, el mensaje
        // se avisa igual en vez de tragárselo.
        if (Object.keys(mapeados).length === 0) notificarAviso(mensajeDe(e));
      } else {
        notificarAviso(mensajeDe(e));
      }
    } finally {
      setPublicando(false);
    }
  };

  const camposConError = Object.keys(errores).length > 0;

  return (
    <MarcoApp titulo="Publicar un anuncio">

      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-10">
          {/* ---------- Formulario ---------- */}
          {/* `min-w-0` es imprescindible: un item de rejima tiene min-width auto
              y, como el título de la previa va con `truncate` (que es nowrap),
              sin esto la columna crece hasta el ancho del texto y desborda. */}
          <div className="min-w-0">
            {/* En móvil la vista previa va arriba y plegada; en escritorio se
                corre a la columna lateral. Se declara una sola vez. */}
            <section className="mb-6 min-w-0 lg:hidden">
              <PreviaAnuncio
                abierta={verPrevia}
                onAlternar={() => setVerPrevia((v) => !v)}
                pilar={pilar}
                titulo={previa.titulo}
                precio={previa.precio}
                ubicacion={previa.ubicacion}
                borrador={!previa.vacio}
                ayuda={
                  previa.vacio
                    ? 'Se actualiza mientras completas el formulario.'
                    : 'Así aparecerá en el feed, con su categoría y su color.'
                }
                foto={portada}
              />
            </section>

            <SegmentadoPilar
              activo={pilar}
              onCambio={cambiarPilar}
              tono={estilo.solido}
              tonoOscuro={estilo.solidoOscuro}
              sobreTono={estilo.sobreSolido}
            />

            <form
              className={`${tarjeta} mt-5 flex flex-col gap-5`}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                publicar();
              }}
            >
              <FormularioAnuncio
                form={form}
                cambiar={cambiar}
                errores={errores}
                catalogos={catalogos}
                pilar={pilar}
                tieneTelefono={tieneTelefono}
        telefonoNuevo={telefonoNuevo}
        onTelefonoNuevo={setTelefonoNuevo}
        telefonoNuevoValido={telefonoNuevoValido}
                avisos={
                  <>
                    {borrador && (
                      <p className={avisoInfo}>
                        <IconoInfo />
                        <span>
                          Recuperamos lo que tenías escrito. Las fotos hay que volver a
                          elegirlas.
                        </span>
                      </p>
                    )}

                    {sinCatalogos && (
                      <p className={alertaError} role="alert">
                        <IconoAlerta />
                        <span>
                          No se pudo cargar el catálogo del servidor, así que no se
                          puede publicar. Se muestran los datos de respaldo.
                        </span>
                      </p>
                    )}

                    {camposConError && !sinCatalogos && (
                      <p className={alertaError} role="alert">
                        <IconoAlerta />
                        <span>
                          Revisa los campos marcados antes de publicar tu anuncio.
                        </span>
                      </p>
                    )}
                  </>
                }
                fotos={
                  <HuecosFoto
                    fotos={form.fotos}
                    onCambio={(fotos) => cambiar('fotos', fotos)}
                    maxFotos={catalogos.maxFotos}
                    maxBytes={catalogos.maxBytesFoto}
                  />
                }
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={ubicacion !== null}
                    disabled={pidiendoUbicacion}
                    onChange={alternarUbicacion}
                    className="mt-0.5 size-4 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="block text-[14px] font-medium text-foreground">
                      {pidiendoUbicacion ? <BaknazoLoader tamano="boton" mensaje="Buscando tu ubicación" /> : 'Aparecer en «Cerca de ti»'}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
                      {ubicacion
                        ? 'Listo. Guardamos una ubicación aproximada (a 1 km), nunca tu dirección.'
                        : 'Quien busque cerca te encontrará primero. Usamos una ubicación aproximada, nunca tu dirección.'}
                    </span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={publicando || sinCatalogos}
                  className={`mt-1 flex h-[52px] items-center justify-center gap-2 rounded-full text-[15.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${estilo.solido} ${estilo.solidoOscuro} ${estilo.sobreSolido}`}
                >
                  {publicando ? <BaknazoLoader tamano="boton" mensaje="Publicando" /> : 'Publicar anuncio'}
                </button>
              </FormularioAnuncio>
            </form>
          </div>

          {/* ---------- Vista previa, escritorio ---------- */}
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
                foto={portada}
                distintivo={previa.vacio ? undefined : 'borrador'}
              />
              <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
                {previa.vacio
                  ? 'Se actualiza mientras completas el formulario.'
                  : 'Así aparecerá en el feed, con su categoría y su color.'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </MarcoApp>
  );
}

/* ---------- Piezas ---------- */

/** El mensaje del servidor es más útil que un texto genérico de "falló". */
function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : 'No se pudo publicar el anuncio.';
}

function SegmentadoPilar({
  activo,
  onCambio,
  tono,
  tonoOscuro,
  sobreTono,
}: {
  activo: Pilar;
  onCambio: (p: Pilar) => void;
  tono: string;
  tonoOscuro: string;
  sobreTono: string;
}) {
  const opciones: { id: Pilar; label: string }[] = [
    { id: 'productos', label: 'Producto' },
    { id: 'servicios', label: 'Servicio' },
    { id: 'empleo', label: 'Empleo' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Tipo de anuncio"
      className="inline-flex w-full gap-1 rounded-full border border-border bg-white p-1 sm:w-auto"
    >
      {opciones.map((opcion) => {
        const seleccionado = opcion.id === activo;
        return (
          <button
            key={opcion.id}
            type="button"
            role="tab"
            aria-selected={seleccionado}
            onClick={() => onCambio(opcion.id)}
            className={`h-10 flex-1 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors sm:flex-none ${
              seleccionado
                ? `${tono} ${sobreTono} ${tonoOscuro}`
                : 'text-foreground hover:bg-background'
            }`}
          >
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}
