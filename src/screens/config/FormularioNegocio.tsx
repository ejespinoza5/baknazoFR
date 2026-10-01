import { useEffect, useState } from 'react';
import { obtenerCategorias, type Categoria } from '../../api/auth';
import { BUSCAR_PROVINCIA, CANTONES_DE, PROVINCIAS_EC } from '../../data/ecuador';
import MapaUbicacion from '../../components/MapaUbicacion';
import RecortadorImagen from '../../components/RecortadorImagen';
import { IconoAlerta, IconoFoto } from '../../components/Iconos';
import {
  DIAS,
  EXTENSIONES_IMAGEN,
  MAX_DESCRIPCION,
  MAX_IMAGEN_BYTES,
  type EstadoNegocio,
} from './negocio';
import { etiqueta, inputBase, tituloSeccion } from './ui';
import BaknazoLoader from '../../components/BaknazoLoader';

const PRESETS_HORARIO: { clave: string; etiqueta: string; dias: string[] }[] = [
  { clave: 'lun-vie', etiqueta: 'Lunes a Viernes', dias: DIAS.slice(0, 5) },
  { clave: 'lun-sab', etiqueta: 'Lunes a Sábado', dias: DIAS.slice(0, 6) },
  { clave: 'todos', etiqueta: 'Todos los días', dias: DIAS },
];

interface Props {
  estado: EstadoNegocio;
  onCambio: (cambios: Partial<EstadoNegocio>) => void;
  logoArchivo: File | null;
  onLogoArchivo: (archivo: File | null) => void;
  /** URL de lo que se ve ahora: el archivo nuevo si lo hay, si no el del servidor. */
  logoVisible: string | null;
  onQuitarLogo: () => void;
  onAmpliar: () => void;
  deshabilitado: boolean;
}

export default function FormularioNegocio({
  estado,
  onCambio,
  logoArchivo,
  onLogoArchivo,
  logoVisible,
  onQuitarLogo,
  onAmpliar,
  deshabilitado,
}: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [errorCategorias, setErrorCategorias] = useState<string | null>(null);
  const [logoBruto, setLogoBruto] = useState<File | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  const set = <K extends keyof EstadoNegocio>(
    campo: K,
    valor: EstadoNegocio[K]
  ) => onCambio({ [campo]: valor } as Partial<EstadoNegocio>);

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
    if (!archivo) return;
    if (!EXTENSIONES_IMAGEN.test(archivo.name)) {
      setErrorLogo('El logo debe ser JPG, JPEG, PNG, WEBP o AVIF.');
      return;
    }
    if (archivo.size > MAX_IMAGEN_BYTES) {
      setErrorLogo('El logo no puede superar los 8 MB.');
      return;
    }
    setLogoBruto(archivo);
  };

  /** Rellena provincia/ciudad con el punto elegido en el mapa o el GPS. */
  const deducirLugar = async (lat: number, lng: number) => {
    try {
      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      const addr = datos?.address as Record<string, string> | undefined;
      if (!addr) return;

      const canton = addr.city ?? addr.town ?? addr.village;
      const provinciaNom = addr.state ?? addr.province ?? addr.region;
      if (!canton) return;

      const provinciaMatch = BUSCAR_PROVINCIA(provinciaNom ?? '');
      const cantonConocido =
        provinciaMatch &&
        CANTONES_DE(provinciaMatch).some(
          (c) => c.toLowerCase() === canton.toLowerCase()
        );

      onCambio({
        provincia: provinciaMatch ?? provinciaNom ?? estado.provincia,
        provinciaOtro: !provinciaMatch,
        ciudad: canton,
        ciudadOtro: !cantonConocido,
      });
    } catch {
      /* el reverse geocoding falla silencioso: el usuario escribe la ciudad */
    }
  };

  const cambiarConMapa = (lat: number, lng: number) => {
    onCambio({ latitud: String(lat), longitud: String(lng) });
    void deducirLugar(lat, lng);
  };

  const usarUbicacion = () => {
    if (buscandoUbicacion) return;
    if (!navigator.geolocation) return;

    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const lat = Number(posicion.coords.latitude.toFixed(6));
        const lng = Number(posicion.coords.longitude.toFixed(6));
        onCambio({ latitud: String(lat), longitud: String(lng) });
        void deducirLugar(lat, lng);
        setBuscandoUbicacion(false);
      },
      () => setBuscandoUbicacion(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const cambiarRed = (
    indice: number,
    clave: 'nombre' | 'url',
    valor: string
  ) =>
    set(
      'redes',
      estado.redes.map((red, i) =>
        i === indice ? { ...red, [clave]: valor } : red
      )
    );

  const quitarHorario = (dia: string) =>
    set(
      'horario',
      estado.horario.filter((d) => d.dia !== dia)
    );

  const agregarDia = () => {
    if (!estado.apertura || !estado.cierre) return;
    if (estado.horario.some((d) => d.dia === estado.diaQueSeAgrega)) return;
    set('horario', [
      ...estado.horario,
      {
        dia: estado.diaQueSeAgrega,
        apertura: estado.apertura,
        cierre: estado.cierre,
      },
    ]);
  };

  return (
    <div>
      {logoBruto && (
        <RecortadorImagen
          imagen={logoBruto}
          onRecortada={(archivo) => {
            onLogoArchivo(archivo);
            onQuitarLogo();
            setErrorLogo(null);
            setLogoBruto(null);
          }}
          onCancelar={() => setLogoBruto(null)}
        />
      )}

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
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
              value={estado.nombreComercial}
              onChange={(e) => set('nombreComercial', e.target.value)}
              disabled={deshabilitado}
              className={inputBase}
            />
          </label>

          <label className="block">
            <span className={etiqueta}>Categoría *</span>
            <select
              value={estado.categoria}
              onChange={(e) => set('categoria', e.target.value)}
              disabled={
                deshabilitado || Boolean(errorCategorias) || !categorias.length
              }
              className={`${inputBase} appearance-none disabled:opacity-50`}
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
              <p className="mt-1.5 text-[12px] text-danger">
                {errorCategorias}
              </p>
            )}
          </label>

          <label className="block">
            <span className={etiqueta}>
              Descripción breve{' '}
              <span className="font-normal text-muted/70">(opcional)</span>
            </span>
            <textarea
              placeholder="Pan artesanal y repostería"
              value={estado.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              rows={2}
              maxLength={MAX_DESCRIPCION}
              disabled={deshabilitado}
              className="w-full resize-none rounded-lg border border-border bg-white px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted/70 transition-colors duration-150 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:opacity-50"
            />
            <span className="mt-1 block text-right text-[11px] text-muted/70">
              {estado.descripcion.length}/{MAX_DESCRIPCION}
            </span>
          </label>

          <div>
            <span className={etiqueta}>
              Logo{' '}
              <span className="font-normal text-muted/70">(opcional)</span>
            </span>

            {logoVisible ? (
              <div className="flex items-center gap-4 rounded-lg border border-accent/40 bg-white p-3">
                <button
                  type="button"
                  onClick={onAmpliar}
                  aria-label="Ampliar logo"
                  className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-background"
                >
                  <img
                    src={logoVisible}
                    alt="Vista previa del logo"
                    className="size-full object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {logoArchivo ? 'Logo nuevo' : 'Logo actual'}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {logoArchivo
                      ? 'Se guardará al publicar los cambios'
                      : 'Se mantiene hasta que lo reemplaces'}
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    <label
                      className={`text-[12px] font-medium text-accent hover:underline ${
                        deshabilitado ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                      }`}
                    >
                      Cambiar
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
                    <button
                      type="button"
                      onClick={() => {
                        onQuitarLogo();
                        setErrorLogo(null);
                      }}
                      className="text-[12px] font-medium text-danger-deep hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className={`flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-white px-3.5 py-3 transition-colors hover:border-muted ${
                  deshabilitado
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-accent">
                  <IconoFoto />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground">
                    Elegir logo
                  </span>
                  <span className="block text-[12px] text-muted">
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
              <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-danger-deep">
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
                <span className="font-normal text-muted/70">(opcional)</span>
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0991234567"
                value={estado.telefono}
                onChange={(e) => set('telefono', e.target.value)}
                disabled={deshabilitado}
                className={inputBase}
              />
            </label>
            <label className="block">
              <span className={etiqueta}>
                WhatsApp{' '}
                <span className="font-normal text-muted/70">(opcional)</span>
              </span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="0991234567"
                value={estado.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                disabled={deshabilitado}
                className={inputBase}
              />
            </label>
          </div>

          <label className="block">
            <span className={etiqueta}>
              Correo de contacto{' '}
              <span className="font-normal text-muted/70">(opcional)</span>
            </span>
            <input
              type="email"
              autoComplete="email"
              placeholder="panaderia@ejemplo.com"
              value={estado.correoContacto}
              onChange={(e) => set('correoContacto', e.target.value)}
              disabled={deshabilitado}
              className={inputBase}
            />
            <span className="mt-1 block text-[11px] text-muted/70">
              Si lo dejas vacío, se usará el correo de tu cuenta.
            </span>
          </label>

          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={estado.entregaDomicilio}
              onChange={(e) => set('entregaDomicilio', e.target.checked)}
              disabled={deshabilitado}
              className="size-4 accent-accent"
            />
            Hago entregas a domicilio
          </label>
        </div>

        <div className="space-y-5">
          <div>
            <h2 className={tituloSeccion}>Ubicación</h2>
            <p className="mt-1.5 text-[12px] text-muted">
              Elige en el mapa y la provincia/ciudad se autocompletan. Si no
              existe, escribe «Otra».
            </p>
          </div>

          <MapaUbicacion
            latitud={estado.latitud.trim() ? Number(estado.latitud) : null}
            longitud={estado.longitud.trim() ? Number(estado.longitud) : null}
            onChange={cambiarConMapa}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={usarUbicacion}
              disabled={buscandoUbicacion || deshabilitado}
              className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-muted disabled:opacity-50"
            >
              {buscandoUbicacion ? <BaknazoLoader tamano="boton" mensaje="Buscando" /> : 'Usar mi ubicación'}
            </button>
            <div className="flex flex-1 items-center gap-2 sm:min-w-0">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[12px] text-muted">Lat</span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="-2.19616"
                  value={estado.latitud}
                  onChange={(e) => set('latitud', e.target.value)}
                  disabled={deshabilitado}
                  className={inputBase}
                />
              </label>
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[12px] text-muted">Lng</span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="-79.92187"
                  value={estado.longitud}
                  onChange={(e) => set('longitud', e.target.value)}
                  disabled={deshabilitado}
                  className={inputBase}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={etiqueta}>
                Provincia{' '}
                <span className="font-normal text-muted/70">(opcional)</span>
              </span>
              {estado.provinciaOtro ? (
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    placeholder="Escribe la provincia…"
                    value={estado.provincia}
                    onChange={(e) => set('provincia', e.target.value)}
                    disabled={deshabilitado}
                    className={inputBase}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onCambio({
                        provinciaOtro: false,
                        provincia: '',
                        ciudad: '',
                        ciudadOtro: false,
                      })
                    }
                    className="shrink-0 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:border-muted"
                  >
                    Lista
                  </button>
                </div>
              ) : (
                <select
                  value={estado.provincia}
                  onChange={(e) => {
                    const valor = e.target.value;
                    if (valor === '__otra__') {
                      onCambio({
                        provinciaOtro: true,
                        provincia: '',
                        ciudad: '',
                        ciudadOtro: false,
                      });
                      return;
                    }
                    onCambio({
                      provincia: valor,
                      ciudad: '',
                      ciudadOtro: false,
                    });
                  }}
                  disabled={deshabilitado}
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
            </div>
            <div>
              <span className={etiqueta}>
                Ciudad{' '}
                <span className="font-normal text-muted/70">(opcional)</span>
              </span>
              {estado.ciudadOtro || estado.provinciaOtro ? (
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    placeholder="Escribe la ciudad…"
                    value={estado.ciudad}
                    onChange={(e) => set('ciudad', e.target.value)}
                    disabled={deshabilitado}
                    className={inputBase}
                  />
                  <button
                    type="button"
                    onClick={() => onCambio({ ciudadOtro: false, ciudad: '' })}
                    className="shrink-0 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:border-muted"
                  >
                    Lista
                  </button>
                </div>
              ) : (
                <select
                  value={
                    !estado.provincia ||
                    estado.provinciaOtro ||
                    !CANTONES_DE(estado.provincia).includes(estado.ciudad)
                      ? '__otra__'
                      : estado.ciudad
                  }
                  onChange={(e) => {
                    const valor = e.target.value;
                    if (valor === '__otra__') {
                      onCambio({ ciudadOtro: true, ciudad: '' });
                    } else {
                      onCambio({ ciudad: valor, ciudadOtro: false });
                    }
                  }}
                  disabled={
                    deshabilitado || !estado.provincia || estado.provinciaOtro
                  }
                  className={`${inputBase} appearance-none disabled:opacity-50`}
                >
                  <option value="">Elige una ciudad</option>
                  {CANTONES_DE(estado.provincia).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__otra__">Otra (escribir)…</option>
                </select>
              )}
            </div>
          </div>

          <label className="block">
            <span className={etiqueta}>
              Sector{' '}
              <span className="font-normal text-muted/70">(opcional)</span>
            </span>
            <input
              type="text"
              placeholder="Urdesa"
              value={estado.sector}
              onChange={(e) => set('sector', e.target.value)}
              disabled={deshabilitado}
              className={inputBase}
            />
          </label>

          <div>
            <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={estado.tieneLocal}
                onChange={(e) => set('tieneLocal', e.target.checked)}
                disabled={deshabilitado}
                className="size-4 accent-accent"
              />
              Tengo un local físico
            </label>

            {estado.tieneLocal ? (
              <label className="mt-3 block">
                <span className={etiqueta}>Dirección del local *</span>
                <input
                  type="text"
                  placeholder="Av. Principal 123"
                  value={estado.direccionLocal}
                  onChange={(e) => set('direccionLocal', e.target.value)}
                  disabled={deshabilitado}
                  className={inputBase}
                />
              </label>
            ) : (
              <label className="mt-3 block">
                <span className={etiqueta}>Zona de cobertura *</span>
                <input
                  type="text"
                  placeholder="Por cantón o ciudad"
                  value={estado.zonaCobertura}
                  onChange={(e) => set('zonaCobertura', e.target.value)}
                  disabled={deshabilitado}
                  className={inputBase}
                />
              </label>
            )}
          </div>

          <div>
            <h2 className={tituloSeccion}>Redes sociales</h2>
            <p className="mt-1.5 text-[12px] text-muted">
              Las que dejes con enlace se guardarán. Quita las que ya no
              quieras.
            </p>

            <div className="mt-3 space-y-2.5">
              {estado.redes.map((red, indice) => (
                <div key={indice} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Instagram"
                    aria-label="Red social"
                    value={red.nombre}
                    onChange={(e) => cambiarRed(indice, 'nombre', e.target.value)}
                    disabled={deshabilitado}
                    className={`${inputBase} min-w-0 flex-1`}
                  />
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    aria-label={`Enlace de ${red.nombre || 'la red social'}`}
                    value={red.url}
                    onChange={(e) => cambiarRed(indice, 'url', e.target.value)}
                    disabled={deshabilitado}
                    className={`${inputBase} min-w-0 flex-[1.5]`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'redes',
                        estado.redes.filter((_, i) => i !== indice)
                      )
                    }
                    aria-label={`Quitar ${red.nombre || 'red social'}`}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-accent hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                set('redes', [...estado.redes, { nombre: '', url: '' }])
              }
              disabled={deshabilitado}
              className="mt-3 w-full rounded-md border border-dashed border-border py-2 text-[13px] font-medium text-accent transition-colors hover:border-accent/60 sm:w-auto sm:px-4"
            >
              + Agregar red
            </button>
          </div>

          <div>
            <h2 className={tituloSeccion}>Horario de atención</h2>
            <p className="mt-1.5 text-[12px] text-muted">
              Elige un rango de días o agrega uno con el selector. Define la
              hora una sola vez.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS_HORARIO.map((preset) => {
                const activo =
                  estado.horario.length === preset.dias.length &&
                  preset.dias.every((dia) =>
                    estado.horario.some((d) => d.dia === dia)
                  );
                return (
                  <button
                    key={preset.clave}
                    type="button"
                    disabled={deshabilitado}
                    onClick={() => {
                      const replicada =
                        estado.horario.find((d) =>
                          preset.dias.includes(d.dia)
                        ) ?? null;
                      const apertura =
                        estado.apertura || replicada?.apertura || '';
                      const cierre = estado.cierre || replicada?.cierre || '';
                      if (!apertura || !cierre) return;
                      set(
                        'horario',
                        preset.dias.map((dia) => ({ dia, apertura, cierre }))
                      );
                    }}
                    className={`rounded-md border px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                      activo
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-white text-foreground hover:border-muted'
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
                value={estado.apertura}
                aria-label="Hora de apertura"
                onChange={(e) => set('apertura', e.target.value)}
                disabled={deshabilitado}
                className="h-10 rounded-md border border-border bg-white px-2 text-[13px] text-foreground focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
              />
              <span className="text-[12px] text-muted">a</span>
              <input
                type="time"
                value={estado.cierre}
                aria-label="Hora de cierre"
                onChange={(e) => set('cierre', e.target.value)}
                disabled={deshabilitado}
                className="h-10 rounded-md border border-border bg-white px-2 text-[13px] text-foreground focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
              />
              <select
                value={estado.diaQueSeAgrega}
                onChange={(e) => set('diaQueSeAgrega', e.target.value)}
                disabled={deshabilitado}
                aria-label="Día a agregar"
                className="h-10 rounded-md border border-border bg-white px-2.5 text-[13px] text-foreground focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
              >
                {DIAS.map((dia) => (
                  <option key={dia} value={dia}>
                    {dia}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={deshabilitado}
                onClick={agregarDia}
                className="rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                Agregar día
              </button>
            </div>

            {estado.horario.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                {estado.horario.map((dia, indice) => (
                  <div
                    key={dia.dia}
                    className={`flex items-center gap-3 px-3.5 py-2.5 ${
                      indice % 2 ? 'bg-background/60' : 'bg-white'
                    }`}
                  >
                    <span className="w-20 shrink-0 text-[13px] font-medium text-foreground">
                      {dia.dia}
                    </span>
                    <span className="flex-1 text-[13px] text-foreground">
                      {dia.apertura} a {dia.cierre}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarHorario(dia.dia)}
                      disabled={deshabilitado}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-accent hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('horario', [])}
                  disabled={deshabilitado}
                  className="block w-full border-t border-border bg-background/40 px-3.5 py-2 text-[12px] font-medium text-accent hover:underline"
                >
                  Borrar horario
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
