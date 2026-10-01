import { useEffect, useState } from 'react';
import {
  completarRegistro,
  obtenerCategorias,
  type Categoria,
} from '../../api/auth';
import { correoEsValido } from '../../lib/password';
import {
  archivoRegistrado,
  borradorInicial,
  guardarBorrador,
  registrarArchivo,
} from '../../lib/borrador';
import { BUSCAR_PROVINCIA, CANTONES_DE, PROVINCIAS_EC } from '../../data/ecuador';
import BaknazoLoader from '../../components/BaknazoLoader';
import Emblema from '../../components/Emblema';
import { notificarError } from '../../lib/notificar';
import {
  IconoAlerta,
  IconoFoto,
  IconoNegocio,
} from '../../components/Iconos';
import MapaUbicacion from '../../components/MapaUbicacion';
import RecortadorImagen from '../../components/RecortadorImagen';
import type {
  Consentimiento,
  DatosRegistroNegocio,
  HorarioDia,
  RegistroPendiente,
  Sesion,
} from '../../types/auth';

interface Props {
  pendiente: RegistroPendiente;
  foto: File | null;
  consentimiento: Consentimiento;
  onListo: (sesion: Sesion) => void;
  onVolver: () => void;
  /** El registro manual terminó pero falta verificar el correo. */
  onVerificacionNecesaria: (correo: string, mensaje: string) => void;
}

const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;
const EXTENSIONES_IMAGEN = /\.(jpe?g|png|webp|avif)$/i;
const PATRON_TELEFONO = /^[+\d\s()-]{7,20}$/;
const MAX_DESCRIPCION = 500;

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface RedSocial {
  nombre: string;
  url: string;
}

const REDES_PREDEFINIDAS: RedSocial[] = [
  { nombre: 'Instagram', url: '' },
  { nombre: 'Facebook', url: '' },
  { nombre: 'TikTok', url: '' },
  { nombre: 'YouTube', url: '' },
];

const inputBase =
  'h-11 w-full rounded-lg border border-claro bg-white px-3.5 text-[15px] text-carbon placeholder:text-medio/70 transition-colors duration-150 focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15 disabled:cursor-not-allowed disabled:opacity-50';

const etiqueta = 'mb-1.5 block text-[13px] font-medium text-medio';

function validaTelefono(valor: string): boolean {
  return valor.trim() === '' || PATRON_TELEFONO.test(valor.trim());
}

export default function DatosNegocioScreen({
  pendiente,
  foto,
  consentimiento,
  onListo,
  onVolver,
  onVerificacionNecesaria,
}: Props) {
  const borrador = borradorInicial();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [errorCategorias, setErrorCategorias] = useState<string | null>(null);

  const [nombreComercial, setNombreComercial] = useState(
    borrador.nombreComercial
  );
  const [categoria, setCategoria] = useState(borrador.categoria);
  const [descripcion, setDescripcion] = useState(borrador.descripcion);
  const [logo, setLogo] = useState<File | null>(() =>
    archivoRegistrado('logo')
  );
  const [logoBruto, setLogoBruto] = useState<File | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const [provincia, setProvincia] = useState(borrador.provincia);
  const [ciudad, setCiudad] = useState(borrador.ciudad);
  const [provinciaOtro, setProvinciaOtro] = useState(borrador.provinciaOtro);
  const [ciudadOtro, setCiudadOtro] = useState(borrador.ciudadOtro);
  const [sector, setSector] = useState(borrador.sector);
  const [tieneLocal, setTieneLocal] = useState(borrador.tieneLocal);
  const [direccionLocal, setDireccionLocal] = useState(borrador.direccionLocal);
  const [zonaCobertura, setZonaCobertura] = useState(borrador.zonaCobertura);
  const [latitud, setLatitud] = useState(borrador.latitud);
  const [longitud, setLongitud] = useState(borrador.longitud);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  const [telefono, setTelefono] = useState(borrador.telefono);
  const [whatsapp, setWhatsapp] = useState(borrador.whatsapp);
  const [correoContacto, setCorreoContacto] = useState(borrador.correoContacto);
  const [entregaDomicilio, setEntregaDomicilio] = useState(
    borrador.entregaDomicilio
  );
  const [redes, setRedes] = useState<RedSocial[]>(
    borrador.redes.length ? borrador.redes : REDES_PREDEFINIDAS
  );
  const [diasAgregados, setDiasAgregados] = useState<HorarioDia[]>(
    borrador.horario
  );
  const [diaQueSeAgrega, setDiaQueSeAgrega] = useState(
    borrador.diaQueSeAgrega
  );
  const [aperturaNueva, setAperturaNueva] = useState(borrador.aperturaNueva);
  const [cierreNuevo, setCierreNuevo] = useState(borrador.cierreNuevo);
  const [cargandoCiudad, setCargandoCiudad] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    guardarBorrador({
      nombreComercial,
      categoria,
      descripcion,
      provincia,
      ciudad,
      provinciaOtro,
      ciudadOtro,
      sector,
      tieneLocal,
      direccionLocal,
      zonaCobertura,
      latitud,
      longitud,
      telefono,
      whatsapp,
      correoContacto,
      entregaDomicilio,
      redes,
      horario: diasAgregados,
      aperturaNueva,
      cierreNuevo,
      diaQueSeAgrega,
    });
    registrarArchivo('logo', logo);
  }, [
    nombreComercial,
    categoria,
    descripcion,
    provincia,
    ciudad,
    provinciaOtro,
    ciudadOtro,
    sector,
    tieneLocal,
    direccionLocal,
    zonaCobertura,
    latitud,
    longitud,
    telefono,
    whatsapp,
    correoContacto,
    entregaDomicilio,
    redes,
    diasAgregados,
    aperturaNueva,
    cierreNuevo,
    diaQueSeAgrega,
    logo,
  ]);

  useEffect(() => {
    let activo = true;

    obtenerCategorias()
      .then((lista) => {
        if (!activo) return;
        setCategorias(lista);
        setErrorCategorias(null);
      })
      .catch((e) => {
        if (!activo) return;
        setErrorCategorias(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar las categorías.'
        );
      });

    return () => {
      activo = false;
    };
  }, []);

  const elegirLogo = (archivo: File | null) => {
    setErrorLogo(null);
    setLogoBruto(null);
    if (!archivo) {
      setLogo(null);
      return;
    }
    if (!EXTENSIONES_IMAGEN.test(archivo.name)) {
      setErrorLogo('El logo debe ser JPG, JPEG, PNG, WEBP o AVIF.');
      setLogo(null);
      return;
    }
    if (archivo.size > MAX_IMAGEN_BYTES) {
      setErrorLogo('El logo no puede superar los 8 MB.');
      setLogo(null);
      return;
    }
    setLogoBruto(archivo);
  };

  const terminarRecorteLogo = (archivo: File) => {
    setLogo(archivo);
    setLogoBruto(null);
    setErrorLogo(null);
  };

  const cambiarConMapa = (lat: number, lng: number) => {
    setLatitud(String(lat));
    setLongitud(String(lng));
    buscarCiudadDesdeCoordenadas(lat, lng);
  };

  const buscarCiudadDesdeCoordenadas = async (lat: number, lng: number) => {
    if (cargandoCiudad) return;
    setCargandoCiudad(true);
    try {
      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      const addr = datos?.address as
        | Record<string, string>
        | undefined;
      if (!addr) return;

      const canton = addr.city ?? addr.town ?? addr.village;
      const provinciaNom =
        addr.state ?? addr.province ?? addr.region ?? addr.county;

      if (canton) {
        const provinciaMatch = BUSCAR_PROVINCIA(provinciaNom ?? '');
        if (provinciaMatch) {
          setProvincia(provinciaMatch);
          setProvinciaOtro(false);
        } else if (provinciaNom) {
          setProvincia(provinciaNom);
          setProvinciaOtro(true);
        }
        const esCantonConocido =
          provinciaMatch &&
          CANTONES_DE(provinciaMatch).some(
            (c) => c.toLowerCase() === canton.toLowerCase()
          );
        if (esCantonConocido) {
          setCiudad(canton);
          setCiudadOtro(false);
        } else {
          setCiudad(canton);
          setCiudadOtro(true);
        }
      }
    } catch {
      /* reverse geocoding falla silencioso */
    } finally {
      setCargandoCiudad(false);
    }
  };

  const usarUbicacion = () => {
    if (buscandoUbicacion) return;
    if (!navigator.geolocation) {
      setError('Tu navegador no permite obtener la ubicación.');
      return;
    }

    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const lat = Number(posicion.coords.latitude.toFixed(6));
        const lng = Number(posicion.coords.longitude.toFixed(6));
        setLatitud(String(lat));
        setLongitud(String(lng));
        buscarCiudadDesdeCoordenadas(lat, lng);
        setBuscandoUbicacion(false);
      },
      () => {
        setBuscandoUbicacion(false);
        setError('No se pudo obtener la ubicación. Usa el mapa o escríbela manualmente.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const cambiarRed = (indice: number, clave: 'nombre' | 'url', valor: string) =>
    setRedes((anterior) =>
      anterior.map((red, i) => (i === indice ? { ...red, [clave]: valor } : red))
    );

  const agregarRed = () =>
    setRedes((anterior) => [...anterior, { nombre: '', url: '' }]);

  const quitarRed = (indice: number) =>
    setRedes((anterior) => anterior.filter((_, i) => i !== indice));

  const quitarHorario = (dia: string) =>
    setDiasAgregados((anterior) => anterior.filter((d) => d.dia !== dia));

  const confirmar = async () => {
    setTocado(true);
    setError(null);

    if (!nombreComercial.trim()) {
      setError('Escribe el nombre comercial de tu negocio.');
      return;
    }
    if (!categoria) {
      setError('Elige la categoría de tu negocio.');
      return;
    }

    if (descripcion.trim().length > MAX_DESCRIPCION) {
      setError('La descripción no puede superar los 500 caracteres.');
      return;
    }

    if (!validaTelefono(telefono)) {
      setError('El teléfono debe tener entre 7 y 20 caracteres: +, dígitos, espacios, - o ().');
      return;
    }
    if (!validaTelefono(whatsapp)) {
      setError('El WhatsApp debe tener el mismo formato que el teléfono.');
      return;
    }
    if (correoContacto.trim() && !correoEsValido(correoContacto)) {
      setError('Escribe un correo de contacto válido o déjalo vacío.');
      return;
    }

    if (tieneLocal && !direccionLocal.trim()) {
      setError('Como marcas que tienes local, escribe la dirección.');
      return;
    }
    if (!tieneLocal && !zonaCobertura.trim()) {
      setError('Como no tienes local, indica tu zona de cobertura.');
      return;
    }

    const latNum = latitud.trim() ? Number(latitud) : null;
    const lngNum = longitud.trim() ? Number(longitud) : null;
    if (
      latNum === null ||
      lngNum === null ||
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      setError(
        'La latitud (entre -90 y 90) y la longitud (entre -180 y 180) son obligatorias. Elige un punto en el mapa o usa tu ubicación.'
      );
      return;
    }

    const redesLimpio: Record<string, string> = {};
    for (const red of redes) {
      const url = red.url.trim();
      if (red.nombre.trim() && url) redesLimpio[red.nombre.trim()] = url;
    }

    const datos: DatosRegistroNegocio = {
      nombre_comercial: nombreComercial.trim(),
      categoria,
      descripcion_breve: descripcion.trim(),
      logo,
      provincia: provincia.trim(),
      ciudad: ciudad.trim(),
      sector: sector.trim(),
      tiene_local: tieneLocal,
      direccion_local: direccionLocal.trim(),
      zona_cobertura: zonaCobertura.trim(),
      latitud: latNum,
      longitud: lngNum,
      telefono: telefono.trim(),
      whatsapp: whatsapp.trim(),
      correo_contacto: correoContacto.trim(),
      entrega_domicilio: entregaDomicilio,
      redes_sociales: redesLimpio,
      horario_atencion: diasAgregados,
    };

    setEnviando(true);
    try {
      const resultado = await completarRegistro(
        pendiente,
        'NEGOCIO',
        consentimiento,
        foto,
        datos
      );
      if (resultado.caso === 'sesion') {
        onListo(resultado.sesion);
      } else {
        onVerificacionNecesaria(resultado.correo, resultado.mensaje);
      }
    } catch (e) {
      notificarError(
        e instanceof Error ? e.message : 'No se pudo crear la cuenta.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const tituloSeccion =
    'text-[12px] font-semibold tracking-[0.14em] text-medio uppercase';

  return (
    <div className="min-h-svh px-6 py-12">
      <div className="mx-auto w-full max-w-[860px]">
        {enviando ? (
          <div className="animate-bkn-in mt-24 grid place-items-center rounded-2xl border border-border bg-white px-5 py-20 shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.35)]">
            <BaknazoLoader mensaje="Creando tu cuenta de negocio…" />
          </div>
        ) : (
          <>
            {logoBruto && (
              <RecortadorImagen
                imagen={logoBruto}
                onRecortada={terminarRecorteLogo}
                onCancelar={() => {
                  setLogoBruto(null);
                  setLogo(null);
                }}
              />
            )}

            <div className="flex items-center gap-3">
              <Emblema tamano={38} />
              <span className="text-[15px] font-semibold tracking-tight text-carbon">
                Baknazo
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-andino">
                <IconoNegocio />
                Negocio
              </span>
            </div>

            <h1 className="mt-8 text-[25px] leading-tight font-semibold tracking-tight text-carbon">
              Datos de tu negocio
            </h1>
            <span
              className="mt-3 block h-[3px] w-10 bg-andino"
              aria-hidden="true"
            />
            <p className="mt-4 text-[14px] leading-relaxed text-medio">
              Completa la información de tu negocio para publicar y vender en
              Baknazo.
            </p>

            {error && (
              <div
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-terracota/25 bg-terracota/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-[#a32531]"
                role="alert"
              >
                <IconoAlerta />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-7 rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.35)] sm:p-7">
              <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                <div className="space-y-5">
                  <div>
                    <h2 className={tituloSeccion}>Información general</h2>
                  </div>

                  <label className="block">
                    <span className={etiqueta}>Nombre comercial *</span>
                    <input
                      type="text"
                      autoComplete="organization"
                      placeholder="Panadería El Sol"
                      value={nombreComercial}
                      onChange={(e) => setNombreComercial(e.target.value)}
                      className={tocado && !nombreComercial.trim() ? 'border-terracota/60 ' + inputBase : inputBase}
                    />
                  </label>

                  <label className="block">
                    <span className={etiqueta}>Categoría *</span>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      disabled={errorCategorias !== null || !categorias.length}
                      className={`${inputBase} appearance-none disabled:opacity-50 ${
                        tocado && !categoria ? 'border-terracota/60' : ''
                      }`}
                    >
                      <option value="">
                        {errorCategorias
                          ? 'No se pudieron cargar las categorías'
                          : categorias.length
                            ? 'Elige una categoría'
                            : 'Cargando categorías…'}
                      </option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    {errorCategorias && (
                      <p className="mt-1.5 text-[12px] text-terracota">
                        {errorCategorias}
                      </p>
                    )}
                  </label>

                  <label className="block">
                    <span className={etiqueta}>
                      Descripción breve{' '}
                      <span className="font-normal text-medio/70">(opcional)</span>
                    </span>
                    <textarea
                      placeholder="Pan artesanal y repostería"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={2}
                      maxLength={MAX_DESCRIPCION}
                      className={`w-full resize-none rounded-lg border border-claro bg-white px-3.5 py-2.5 text-[15px] text-carbon placeholder:text-medio/70 transition-colors duration-150 focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15 disabled:cursor-not-allowed disabled:opacity-50`}
                    />
                    <span className="mt-1 block text-right text-[11px] text-medio/70">
                      {descripcion.length}/{MAX_DESCRIPCION}
                    </span>
                  </label>

                  <div>
                    <span className={etiqueta}>
                      Logo{' '}
                      <span className="font-normal text-medio/70">(opcional)</span>
                    </span>
                    {logo ? (
                      <div className="flex items-center gap-4 rounded-lg border border-andino bg-white p-3">
                        <img
                          src={URL.createObjectURL(logo)}
                          alt="Vista previa del logo"
                          className="size-14 shrink-0 rounded-full border border-claro object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-carbon">
                            {logo.name}
                          </span>
                          <span className="block text-[12px] text-medio">
                            {(logo.size / 1024 / 1024).toFixed(2)} MB · círculo
                          </span>
                          <div className="mt-1.5 flex gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setLogoBruto(
                                  new File([logo], logo.name, { type: logo.type })
                                )
                              }
                              className="text-[12px] font-medium text-andino hover:underline"
                            >
                              Ajustar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLogo(null);
                                setLogoBruto(null);
                                setErrorLogo(null);
                              }}
                              className="text-[12px] font-medium text-[#a32531] hover:underline"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-claro bg-white px-3.5 py-3 transition-colors hover:border-medio focus-within:border-andino">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-andino">
                          <IconoFoto />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-carbon">
                            Elegir logo
                          </span>
                          <span className="block text-[12px] text-medio">
                            JPG, PNG, WEBP o AVIF · máximo 8 MB
                          </span>
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            elegirLogo(e.target.files?.[0] ?? null);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    {errorLogo && (
                      <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-[#a32531]">
                        <IconoAlerta />
                        {errorLogo}
                      </p>
                    )}
                  </div>

                  <div>
                    <h2 className={tituloSeccion}>Contacto y venta</h2>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={etiqueta}>
                        Teléfono{' '}
                        <span className="font-normal text-medio/70">(opcional)</span>
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="0991234567"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className={inputBase}
                      />
                    </label>
                    <label className="block">
                      <span className={etiqueta}>
                        WhatsApp{' '}
                        <span className="font-normal text-medio/70">(opcional)</span>
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="0991234567"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        className={inputBase}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className={etiqueta}>
                      Correo de contacto{' '}
                      <span className="font-normal text-medio/70">(opcional)</span>
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="panaderia@ejemplo.com"
                      value={correoContacto}
                      onChange={(e) => setCorreoContacto(e.target.value)}
                      className={inputBase}
                    />
                    <span className="mt-1 block text-[11px] text-medio/70">
                      Si lo dejas vacío, usaremos el correo de tu cuenta.
                    </span>
                  </label>

                  <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-carbon">
                    <input
                      type="checkbox"
                      checked={entregaDomicilio}
                      onChange={(e) => setEntregaDomicilio(e.target.checked)}
                      className="size-4 accent-andino"
                    />
                    Hago entregas a domicilio
                  </label>

                  <div>
                    <h2 className={tituloSeccion}>Ubicación</h2>
                    <p className="mt-1.5 text-[12px] text-medio">
                      Elige en el mapa y la provincia/ciudad se autocompletan.
                      Si no existe, escribe «Otra».
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span className={etiqueta}>
                        Provincia{' '}
                        <span className="font-normal text-medio/70">(opcional)</span>
                      </span>
                      {provinciaOtro ? (
                        <div className="flex items-stretch gap-2">
                          <input
                            type="text"
                            placeholder="Escribe la provincia…"
                            value={provincia}
                            onChange={(e) => setProvincia(e.target.value)}
                            className={inputBase}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setProvinciaOtro(false);
                              setProvincia('');
                              setCiudad('');
                              setCiudadOtro(false);
                            }}
                            className="shrink-0 rounded-md border border-claro px-3 text-[12px] font-medium text-carbon hover:border-medio"
                          >
                            Lista
                          </button>
                        </div>
                      ) : (
                        <select
                          value={provincia}
                          onChange={(e) => {
                            const valor = e.target.value;
                            if (valor === '__otra__') {
                              setProvinciaOtro(true);
                              setProvincia('');
                              setCiudadOtro(true);
                              setCiudad('');
                              return;
                            }
                            setProvincia(valor);
                            setCiudad('');
                            setCiudadOtro(false);
                          }}
                          className={`${inputBase} appearance-none`}
                        >
                          <option value="">Elige una provincia</option>
                          {Object.keys(PROVINCIAS_EC).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                          <option value="__otra__">Otra (escribir)…</option>
                        </select>
                      )}
                      {cargandoCiudad && (
                        <span className="mt-1 block text-[11px] text-medio">
                          <BaknazoLoader tamano="boton" mensaje="Detectando ubicación" />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className={etiqueta}>
                        Ciudad{' '}
                        <span className="font-normal text-medio/70">(opcional)</span>
                      </span>
                      {ciudadOtro || provinciaOtro ? (
                        <div className="flex items-stretch gap-2">
                          <input
                            type="text"
                            placeholder="Escribe la ciudad…"
                            value={ciudad}
                            onChange={(e) => setCiudad(e.target.value)}
                            className={inputBase}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCiudadOtro(false);
                              setCiudad('');
                            }}
                            className="shrink-0 rounded-md border border-claro px-3 text-[12px] font-medium text-carbon hover:border-medio"
                          >
                            Lista
                          </button>
                        </div>
                      ) : (
                        <select
                          value={provinciaOtro || !CANTONES_DE(provincia).includes(ciudad) ? '__otra__' : ciudad}
                          onChange={(e) => {
                            const valor = e.target.value;
                            if (valor === '__otra__') {
                              setCiudadOtro(true);
                              setCiudad('');
                            } else {
                              setCiudad(valor);
                            }
                          }}
                          disabled={!provincia || provinciaOtro}
                          className={`${inputBase} appearance-none disabled:opacity-50`}
                        >
                          {!provincia || provinciaOtro ? (
                            <option value="">
                              {provinciaOtro
                                ? 'Escribe la ciudad arriba'
                                : 'Primero elige la provincia'}
                            </option>
                          ) : (
                            <>
                              <option value="">Elige una ciudad</option>
                              {CANTONES_DE(provincia).map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                              <option value="__otra__">Otra (escribir)…</option>
                            </>
                          )}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <h2 className={tituloSeccion}>Mapa y coordenadas</h2>
                  </div>

                  <MapaUbicacion
                    latitud={latitud.trim() ? Number(latitud) : null}
                    longitud={longitud.trim() ? Number(longitud) : null}
                    onChange={cambiarConMapa}
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={usarUbicacion}
                      disabled={buscandoUbicacion}
                      className="rounded-md border border-claro px-3 py-2 text-[13px] font-medium text-carbon transition-colors hover:border-medio disabled:opacity-50"
                    >
                      {buscandoUbicacion ? <BaknazoLoader tamano="boton" mensaje="Buscando" /> : 'Usar mi ubicación'}
                    </button>
                    <div className="flex flex-1 items-center gap-2 sm:min-w-0">
                      <label className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0 text-[12px] text-medio">Lat</span>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="-2.19616"
                          value={latitud}
                          onChange={(e) => setLatitud(e.target.value)}
                          className={inputBase}
                        />
                      </label>
                      <label className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0 text-[12px] text-medio">Lng</span>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="-79.92187"
                          value={longitud}
                          onChange={(e) => setLongitud(e.target.value)}
                          className={inputBase}
                        />
                      </label>
                    </div>
                  </div>

                  <label className="block">
                    <span className={etiqueta}>
                      Sector{' '}
                      <span className="font-normal text-medio/70">(opcional)</span>
                    </span>
                    <input
                      type="text"
                      placeholder="Urdesa"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className={inputBase}
                    />
                  </label>

                  <div>
                    <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-carbon">
                      <input
                        type="checkbox"
                        checked={tieneLocal}
                        onChange={(e) => setTieneLocal(e.target.checked)}
                        className="size-4 accent-andino"
                      />
                      Tengo un local físico
                    </label>

                    {tieneLocal ? (
                      <label className="mt-3 block">
                        <span className={etiqueta}>Dirección del local *</span>
                        <input
                          type="text"
                          placeholder="Av. Principal 123"
                          value={direccionLocal}
                          onChange={(e) => setDireccionLocal(e.target.value)}
                          className={tocado && tieneLocal && !direccionLocal.trim() ? 'border-terracota/60 ' + inputBase : inputBase}
                        />
                      </label>
                    ) : (
                      <label className="mt-3 block">
                        <span className={etiqueta}>Zona de cobertura *</span>
                        <input
                          type="text"
                          placeholder="Por cantón o ciudad"
                          value={zonaCobertura}
                          onChange={(e) => setZonaCobertura(e.target.value)}
                          className={tocado && !tieneLocal && !zonaCobertura.trim() ? 'border-terracota/60 ' + inputBase : inputBase}
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <h2 className={tituloSeccion}>Redes sociales</h2>
                    <p className="mt-1.5 text-[12px] text-medio">
                      Las que dejes con enlace se guardarán. Puedes agregar otras.
                    </p>

                    <div className="mt-3 space-y-2.5">
                      {redes.map((red, indice) => (
                        <div
                          key={indice}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="text"
                            placeholder="Instagram"
                            value={red.nombre}
                            onChange={(e) =>
                              cambiarRed(indice, 'nombre', e.target.value)
                            }
                            className={`${inputBase} min-w-0 flex-1`}
                          />
                          <input
                            type="url"
                            inputMode="url"
                            placeholder="https://…"
                            value={red.url}
                            onChange={(e) =>
                              cambiarRed(indice, 'url', e.target.value)
                            }
                            className={`${inputBase} min-w-0 flex-[1.5]`}
                          />
                          <button
                            type="button"
                            onClick={() => quitarRed(indice)}
                            aria-label={`Quitar ${red.nombre || 'red social'}`}
                            className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-andino hover:underline"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={agregarRed}
                      className="mt-3 w-full rounded-md border border-dashed border-claro py-2 text-[13px] font-medium text-andino transition-colors hover:border-andino/60 sm:w-auto sm:px-4"
                    >
                      + Agregar red
                    </button>
                  </div>

                  <div>
                    <h2 className={tituloSeccion}>Horario de atención</h2>
                    <p className="mt-1.5 text-[12px] text-medio">
                      Elige un rango de días o usa «Personalizado» día por día.
                      Define la hora una sola vez.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(
                        [
                          { clave: 'lun-vie', etiqueta: 'Lunes a Viernes', dias: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] },
                          { clave: 'lun-sab', etiqueta: 'Lunes a Sábado', dias: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] },
                          { clave: 'todos', etiqueta: 'Todos los días', dias: [...DIAS] },
                        ] as { clave: string; etiqueta: string; dias: string[] }[]
                      ).map((preset) => {
                        const activo =
                          diasAgregados.length === preset.dias.length &&
                          preset.dias.every((dia) =>
                            diasAgregados.some((d) => d.dia === dia)
                          );
                        return (
                          <button
                            key={preset.clave}
                            type="button"
                            onClick={() => {
                              const replicada =
                                diasAgregados.find((d) =>
                                  preset.dias.includes(d.dia)
                                ) ?? null;
                              const apertura = aperturaNueva || replicada?.apertura || '';
                              const cierre = cierreNuevo || replicada?.cierre || '';
                              if (!apertura || !cierre) {
                                setError(
                                  'Primero define la hora de apertura y cierre.'
                                );
                                return;
                              }
                              setDiasAgregados(
                                preset.dias.map((dia) => ({
                                  dia,
                                  apertura,
                                  cierre,
                                }))
                              );
                              setError(null);
                            }}
                            className={`rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${
                              activo
                                ? 'border-andino bg-andino/10 text-andino'
                                : 'border-claro bg-white text-carbon hover:border-medio'
                            }`}
                          >
                            {preset.etiqueta}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={aperturaNueva}
                        aria-label="Hora de apertura"
                        onChange={(e) => setAperturaNueva(e.target.value)}
                        className="h-10 rounded-md border border-claro bg-white px-2 text-[13px] text-carbon focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15"
                      />
                      <span className="text-[12px] text-medio">a</span>
                      <input
                        type="time"
                        value={cierreNuevo}
                        aria-label="Hora de cierre"
                        onChange={(e) => setCierreNuevo(e.target.value)}
                        className="h-10 rounded-md border border-claro bg-white px-2 text-[13px] text-carbon focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15"
                      />
                      <select
                        value={diaQueSeAgrega}
                        onChange={(e) => setDiaQueSeAgrega(e.target.value)}
                        aria-label="Día personalizado"
                        className="h-10 rounded-md border border-claro bg-white px-2.5 text-[13px] text-carbon focus:border-andino/70 focus:outline-none focus:ring-[3px] focus:ring-andino/15"
                      >
                        {DIAS.map((dia) => (
                          <option key={dia} value={dia}>
                            {dia}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!aperturaNueva || !cierreNuevo) {
                            setError('Primero define la hora de apertura y cierre.');
                            return;
                          }
                          if (diasAgregados.some((d) => d.dia === diaQueSeAgrega)) {
                            setError(
                              'Ese día ya está en el horario. Quítalo primero.'
                            );
                            return;
                          }
                          setDiasAgregados((anterior) => [
                            ...anterior,
                            {
                              dia: diaQueSeAgrega,
                              apertura: aperturaNueva,
                              cierre: cierreNuevo,
                            },
                          ]);
                          setError(null);
                        }}
                        className="rounded-md bg-amarillo px-3 py-2 text-[13px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro"
                      >
                        Agregar día
                      </button>
                    </div>

                    {diasAgregados.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-claro">
                        {diasAgregados.map((dia, indice) => (
                          <div
                            key={dia.dia}
                            className={`flex items-center gap-3 px-3.5 py-2.5 ${
                              indice % 2 ? 'bg-background/60' : 'bg-white'
                            }`}
                          >
                            <span className="w-20 shrink-0 text-[13px] font-medium text-carbon">
                              {dia.dia}
                            </span>
                            <span className="flex-1 text-[13px] text-carbon">
                              {dia.apertura} a {dia.cierre}
                            </span>
                            <button
                              type="button"
                              onClick={() => quitarHorario(dia.dia)}
                              className="rounded-md px-2 py-1 text-[12px] font-medium text-andino hover:underline"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDiasAgregados([])}
                          className="block w-full border-t border-claro bg-background/40 px-3.5 py-2 text-[12px] font-medium text-andino hover:underline"
                        >
                          Borrar horario
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                className="mt-7 w-full rounded-md bg-amarillo py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99] disabled:opacity-60"
              >
                Continuar
              </button>
            </div>

            <p className="mt-5 text-center">
              <button
                type="button"
                onClick={onVolver}
                disabled={enviando}
                className="text-[13px] font-medium text-andino hover:underline disabled:opacity-50"
              >
                Volver
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}