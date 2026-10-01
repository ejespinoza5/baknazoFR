import { useEffect, useState } from 'react';
import { completarRegistro, obtenerPoliticas } from '../../api/auth';
import {
  archivoRegistrado,
  borradorInicial,
  guardarBorrador,
  registrarArchivo,
} from '../../lib/borrador';
import BaknazoLoader from '../../components/BaknazoLoader';
import Emblema from '../../components/Emblema';
import ModalPolitica from '../../components/ModalPolitica';
import { notificarError } from '../../lib/notificar';
import {
  IconoAlerta,
  IconoFoto,
  IconoNegocio,
  IconoPersona,
} from '../../components/Iconos';
import RecortadorImagen from '../../components/RecortadorImagen';
import SelectorImagen from '../../components/SelectorImagen';
import DatosNegocioScreen from './DatosNegocioScreen';
import type {
  Consentimiento,
  PoliticaVigente,
  RegistroPendiente,
  Sesion,
  TipoCuenta,
} from '../../types/auth';

interface Props {
  pendiente: RegistroPendiente;
  onListo: (sesion: Sesion) => void;
  onCancelar: () => void;
  /** El registro manual terminó pero falta verificar el correo. */
  onVerificacionNecesaria: (correo: string, mensaje: string) => void;
}

const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const EXTENSIONES_FOTO = /\.(jpe?g|png|webp|avif)$/i;

const OPCIONES: Array<{
  valor: TipoCuenta;
  titulo: string;
  detalle: string;
  icono: () => React.JSX.Element;
}> = [
  {
    valor: 'PERSONA',
    titulo: 'Persona',
    detalle: 'Cuenta personal para comprar y contratar servicios.',
    icono: IconoPersona,
  },
  {
    valor: 'NEGOCIO',
    titulo: 'Negocio',
    detalle: 'Cuenta comercial para publicar y vender tus productos.',
    icono: IconoNegocio,
  },
];

const ETIQUETA_PROVEEDOR: Record<RegistroPendiente['proveedor'], string> = {
  google: 'Google',
  manual: 'correo y contraseña',
};

export default function TipoCuentaScreen({
  pendiente,
  onListo,
  onCancelar,
  onVerificacionNecesaria,
}: Props) {
  const borrador = borradorInicial();
  const [seleccion, setSeleccion] = useState<TipoCuenta | null>(
    borrador.tipoCuenta
  );
  const [foto, setFoto] = useState<File | null>(() =>
    archivoRegistrado('foto')
  );
  const [fotoBruta, setFotoBruta] = useState<File | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrandoNegocio, setMostrandoNegocio] = useState(false);
  const [consentimientoListo, setConsentimientoListo] =
    useState<Consentimiento | null>(null);

  // ---------- Consentimiento (términos y política de privacidad) ----------
  const [politicas, setPoliticas] = useState<PoliticaVigente[]>([]);
  const [errorPoliticas, setErrorPoliticas] = useState<string | null>(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [soyMayor, setSoyMayor] = useState(false);
  const [politicaAbierta, setPoliticaAbierta] = useState<PoliticaVigente | null>(
    null
  );

  const cargarPoliticas = async (): Promise<PoliticaVigente[]> =>
    obtenerPoliticas();

  useEffect(() => {
    let activo = true;

    cargarPoliticas().then(
      (lista) => {
        if (!activo) return;
        setPoliticas(lista);
        setErrorPoliticas(null);
      },
      (e) => {
        if (!activo) return;
        setErrorPoliticas(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar los términos y condiciones.'
        );
      }
    );

    return () => {
      activo = false;
    };
  }, []);

  const terminos = politicas.find((p) => p.clave === 'TERMINOS') ?? null;
  const privacidad = politicas.find((p) => p.clave === 'PRIVACIDAD') ?? null;
  const consentimiento: Consentimiento | null =
    terminos && privacidad && aceptaTerminos && aceptaPrivacidad && soyMayor
      ? {
          terminos_version: terminos.version,
          privacidad_version: privacidad.version,
        }
      : null;

  useEffect(() => {
    guardarBorrador({ tipoCuenta: seleccion });
    registrarArchivo('foto', foto);
  }, [seleccion, foto]);

  const elegirFoto = (archivo: File | null) => {
    setErrorFoto(null);
    if (!archivo) {
      setFoto(null);
      setFotoBruta(null);
      return;
    }

    if (!EXTENSIONES_FOTO.test(archivo.name)) {
      setErrorFoto(
        'Solo se admiten imágenes JPG, JPEG, PNG, WEBP o AVIF.'
      );
      setFoto(null);
      setFotoBruta(null);
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      setErrorFoto('La foto no puede superar los 8 MB.');
      setFoto(null);
      setFotoBruta(null);
      return;
    }

    setFotoBruta(archivo);
  };

  const terminarRecorte = (archivo: File) => {
    setFoto(archivo);
    setFotoBruta(null);
    setErrorFoto(null);
  };

  const confirmar = async () => {
    if (!seleccion) return;
    setError(null);

    if (!terminos || !privacidad) {
      setError(
        'No se pudieron cargar los Términos y Condiciones. Reintenta en un momento.'
      );
      return;
    }
    if (!aceptaTerminos || !aceptaPrivacidad || !soyMayor) {
      setError(
        'Para continuar debes aceptar los Términos y Condiciones, la Política de Privacidad y confirmar que eres mayor de edad.'
      );
      return;
    }
    if (!consentimiento) return;

    setConsentimientoListo(consentimiento);

    if (seleccion === 'NEGOCIO') {
      setMostrandoNegocio(true);
      return;
    }

    setEnviando(true);
    try {
      const resultado = await completarRegistro(
        pendiente,
        seleccion,
        consentimiento,
        foto
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

  if (mostrandoNegocio) {
    return (
      <DatosNegocioScreen
        pendiente={pendiente}
        foto={foto}
        consentimiento={consentimientoListo!}
        onListo={onListo}
        onVolver={() => setMostrandoNegocio(false)}
        onVerificacionNecesaria={onVerificacionNecesaria}
      />
    );
  }

  if (fotoBruta) {
    return (
      <RecortadorImagen
        imagen={fotoBruta}
        onRecortada={terminarRecorte}
        onCancelar={() => setFotoBruta(null)}
      />
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px]">
        {enviando ? (
          <div className="animate-bkn-in grid place-items-center rounded-2xl border border-border bg-white px-5 py-16 shadow-[0_1px_2px_rgba(31,41,55,0.04),0_24px_48px_-32px_rgba(31,41,55,0.35)]">
            <BaknazoLoader mensaje="Creando tu cuenta…" />
          </div>
        ) : (
          <>
        <div className="flex items-center gap-3">
          <Emblema tamano={38} />
          <span className="text-[15px] font-semibold tracking-tight text-carbon">
            Baknazo
          </span>
        </div>

        <h1 className="mt-9 text-[25px] leading-tight font-semibold tracking-tight text-carbon">
          ¿Cómo vas a usar tu cuenta?
        </h1>
        <span className="mt-3 block h-[3px] w-10 bg-andino" aria-hidden="true" />
        <p className="mt-4 text-[14px] leading-relaxed text-medio">
          Verificamos tu identidad con {ETIQUETA_PROVEEDOR[pendiente.proveedor]}
          . Elige cómo vas a usar Baknazo para terminar el registro.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-2 text-[13px] leading-snug text-[#a32531]">
            <IconoAlerta />
            <span>{error}</span>
          </div>
        )}

        <div
          className="mt-8 grid gap-3"
          role="radiogroup"
          aria-label="Tipo de cuenta"
        >
          {OPCIONES.map((opcion) => {
            const Icono = opcion.icono;
            const activa = seleccion === opcion.valor;

            return (
              <button
                key={opcion.valor}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => setSeleccion(opcion.valor)}
                disabled={enviando}
                className={`flex w-full items-center gap-3.5 border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  activa ? 'border-carbon' : 'border-claro hover:border-medio'
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center ${activa ? 'text-carbon' : 'text-medio'}`}
                >
                  <Icono />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <strong className="text-[14px] font-medium text-carbon">
                    {opcion.titulo}
                  </strong>
                  <small className="text-[12px] leading-snug text-medio">
                    {opcion.detalle}
                  </small>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                    activa ? 'border-carbon' : 'border-claro'
                  }`}
                >
                  {activa && (
                    <span className="h-2 w-2 rounded-full bg-carbon" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {seleccion && (
          <div className="mt-6">
            <span className="mb-1.5 block text-[13px] font-medium text-medio">
              Foto de perfil <span className="font-normal text-medio/70">(opcional)</span>
            </span>
            {foto ? (
              <div className="flex items-center gap-4 rounded-lg border border-andino bg-white p-3">
                <img
                  src={URL.createObjectURL(foto)}
                  alt="Vista previa de tu foto de perfil"
                  className="size-16 shrink-0 rounded-full border border-claro object-cover"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-carbon">
                    {foto.name}
                  </span>
                  <span className="block text-[12px] text-medio">
                    {(foto.size / 1024 / 1024).toFixed(2)} MB · círculo
                  </span>
                  <div className="mt-1.5 flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFotoBruta(
                          new File(
                            [foto],
                            foto.name,
                            { type: foto.type }
                          )
                        )
                      }
                      className="text-[12px] font-medium text-andino hover:underline"
                    >
                      Ajustar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFoto(null);
                        setErrorFoto(null);
                      }}
                      className="text-[12px] font-medium text-[#a32531] hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-claro bg-white p-3">
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-andino">
                    <IconoFoto />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-carbon">
                      Foto de perfil
                    </span>
                    <span className="block text-[12px] text-medio">
                      JPG, PNG, WEBP o AVIF · máximo 8 MB
                    </span>
                  </span>
                </div>
                <SelectorImagen deshabilitado={enviando} onElegir={elegirFoto} />
              </div>
            )}
            {errorFoto && (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-[#a32531]">
                <IconoAlerta />
                {errorFoto}
              </p>
            )}
          </div>
        )}

        {errorPoliticas && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-terracota/25 bg-terracota/[0.04] px-3.5 py-2.5 text-[13px] leading-snug text-[#a32531]">
            <span className="flex items-start gap-2">
              <IconoAlerta />
              <span>{errorPoliticas}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setErrorPoliticas(null);
                cargarPoliticas()
                  .then((lista) => setPoliticas(lista))
                  .catch((e) =>
                    setErrorPoliticas(
                      e instanceof Error
                        ? e.message
                        : 'No se pudieron cargar los términos y condiciones.'
                    )
                  );
              }}
              disabled={enviando}
              className="text-[13px] font-medium text-andino hover:underline disabled:opacity-50"
            >
              Reintentar
            </button>
          </div>
        )}

        {(terminos || privacidad) && (
          <div className="mt-7 rounded-lg border border-claro bg-white p-4">
            <span className="mb-3 block text-[12px] font-semibold tracking-[0.14em] text-medio uppercase">
              Consentimiento y privacidad
            </span>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-carbon">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  disabled={enviando}
                  className="mt-0.5 size-4 shrink-0 accent-andino"
                />
                <span>
                  Acepto los{' '}
                  {terminos ? (
                    <button
                      type="button"
                      onClick={() => setPoliticaAbierta(terminos)}
                      disabled={enviando}
                      className="text-andino underline decoration-andino/40 underline-offset-2 hover:decoration-andino"
                    >
                      Términos y Condiciones
                    </button>
                  ) : (
                    'Términos y Condiciones'
                  )}{' '}
                  (v{terminos?.version}).
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-carbon">
                <input
                  type="checkbox"
                  checked={aceptaPrivacidad}
                  onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                  disabled={enviando}
                  className="mt-0.5 size-4 shrink-0 accent-andino"
                />
                <span>
                  Acepto la{' '}
                  {privacidad ? (
                    <button
                      type="button"
                      onClick={() => setPoliticaAbierta(privacidad)}
                      disabled={enviando}
                      className="text-andino underline decoration-andino/40 underline-offset-2 hover:decoration-andino"
                    >
                      Política de Privacidad
                    </button>
                  ) : (
                    'Política de Privacidad'
                  )}{' '}
                  y el tratamiento de mis datos personales.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-carbon">
                <input
                  type="checkbox"
                  checked={soyMayor}
                  onChange={(e) => setSoyMayor(e.target.checked)}
                  disabled={enviando}
                  className="mt-0.5 size-4 shrink-0 accent-andino"
                />
                <span>
                  Confirmo que soy mayor de 18 años o cuento con la autorización
                  correspondiente.
                </span>
              </label>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={!seleccion || enviando || !consentimiento}
          className="mt-7 w-full rounded-md bg-amarillo py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-amarillo-oscuro active:scale-[0.99] disabled:opacity-60"
        >
          {enviando ? <BaknazoLoader tamano="boton" mensaje="Creando cuenta" /> : 'Continuar'}
        </button>

        <p className="mt-5 text-center">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="text-[13px] font-medium text-andino hover:underline disabled:opacity-50"
          >
            Volver
          </button>
        </p>
          </>
        )}
      </div>

      <ModalPolitica
        politica={politicaAbierta}
        onCerrar={() => setPoliticaAbierta(null)}
      />
    </div>
  );
}
