import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconoAlerta, IconoCheck, IconoDocumento, IconoMaletin, IconoPapelera } from './Iconos';
import { postular } from '../api/postulaciones';
import { erroresDeValidacion } from '../api/anuncios';
import { useNavegacion } from '../lib/navegacion';
import { notificarError, notificarExito } from '../lib/notificar';
import { formatearBytes, prepararCv, type CvPreparado } from '../lib/pdf';
import { ESTADO_POSTULANTE, TONO_ESTADO } from '../lib/postulaciones';
import type { Anuncio } from '../types/anuncio';
import BaknazoLoader from './BaknazoLoader';

/**
 * Todo lo de postularse a una vacante, dentro de la ficha del anuncio.
 *
 * Va en línea y no en otra ventana: quien se postula quiere seguir viendo la
 * oferta mientras escribe. Tres casos:
 *
 * - El dueño ve cuántas postulaciones tiene y va a su bandeja.
 * - Quien ya se postuló ve en qué estado va.
 * - Los demás se postulan con su CV en PDF, que se comprime antes de subirlo.
 */
export default function BloquePostulacion({
  anuncio,
  onPostulado,
}: {
  anuncio: Anuncio;
  onPostulado?: (estado: { id: number }) => void;
}) {
  const navegar = useNavigate();
  const { sesion, perfil, irAlLogin } = useNavegacion();
  const [abierto, setAbierto] = useState(false);
  const [cv, setCv] = useState<CvPreparado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [telefono, setTelefono] = useState(perfil?.contacto?.telefono ?? '');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviada, setEnviada] = useState(false);

  if (anuncio.pilar !== 'empleo') return null;

  /* ---------- Dueño de la vacante ---------- */
  if (anuncio.esMio) {
    const total = anuncio.postulaciones?.total ?? 0;
    const nuevas = anuncio.postulaciones?.nuevas ?? 0;
    return (
      <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-empleo/10 text-empleo-deep">
            <IconoMaletin />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-foreground">
              {total === 0 ? 'Aún sin postulaciones' : total === 1 ? '1 postulación' : `${total} postulaciones`}
            </p>
            <p className="text-[12.5px] text-muted">
              {nuevas > 0 ? `${nuevas} sin revisar` : 'Los CV llegan a tu bandeja de Postulaciones.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navegar(`/postulaciones?anuncio=${anuncio.id}`)}
            className="h-10 shrink-0 rounded-lg bg-foreground px-3.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Ver postulaciones
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Ya se postuló ---------- */
  const mia = anuncio.miPostulacion;
  if (mia || enviada) {
    const estado = mia?.estado ?? 'NUEVA';
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-success/25 bg-success/[0.06] p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
          <IconoCheck ok />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[14.5px] font-semibold text-foreground">Ya te postulaste</p>
          <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
            Estado:
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TONO_ESTADO[estado]}`}>
              {ESTADO_POSTULANTE[estado]}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => navegar('/postulaciones?vista=enviadas')}
          className="h-10 shrink-0 rounded-lg border border-border bg-white px-3.5 text-[13.5px] font-semibold text-foreground transition-colors hover:border-muted"
        >
          Mis postulaciones
        </button>
      </div>
    );
  }

  /* ---------- Vacante cerrada ---------- */
  if (anuncio.vendido || anuncio.estado !== 'PUBLICADO') {
    return (
      <p className="mt-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-[13.5px] text-muted">
        Esta vacante ya no recibe postulaciones.
      </p>
    );
  }

  /* ---------- Postularse ---------- */

  const elegirCv = async (archivo: File | null) => {
    setErrores((e) => ({ ...e, cv: '' }));
    if (!archivo) return;
    setProcesando(true);
    try {
      setCv(await prepararCv(archivo));
    } catch (e) {
      setCv(null);
      setErrores((x) => ({ ...x, cv: e instanceof Error ? e.message : 'No se pudo leer el PDF.' }));
    } finally {
      setProcesando(false);
    }
  };

  const enviar = async () => {
    if (!cv) {
      setErrores({ cv: 'Adjunta tu hoja de vida en PDF.' });
      return;
    }
    setEnviando(true);
    setErrores({});
    try {
      const r = await postular(anuncio.id, { cv: cv.archivo, mensaje, telefono });
      setEnviada(true);
      onPostulado?.(r);
      notificarExito('Postulación enviada. La empresa ya puede ver tu hoja de vida.');
    } catch (e) {
      const porCampo = erroresDeValidacion(e);
      if (porCampo) setErrores(porCampo as Record<string, string>);
      else notificarError(e instanceof Error ? e.message : 'No se pudo enviar la postulación.');
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => (sesion ? setAbierto(true) : irAlLogin())}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-empleo text-[15px] font-semibold text-white transition-colors hover:bg-empleo-deep"
        >
          <IconoMaletin />
          {sesion ? 'Postularme a esta vacante' : 'Entra para postularte'}
        </button>
        <p className="mt-1.5 text-center text-[12px] text-muted">Envía tu hoja de vida en PDF. Toma un minuto.</p>
      </div>
    );
  }

  return (
    <form
      className="animate-bkn-in mt-4 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      noValidate
    >
      <div>
        <h3 className="text-[15.5px] font-semibold text-foreground">Tu postulación</h3>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          {anuncio.autor.nombre} verá tu nombre, tu correo, el teléfono que escribas y tu hoja de vida.
        </p>
      </div>

      {/* ---------- CV ---------- */}
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-muted">Hoja de vida (PDF) *</span>
        {cv ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <span className="text-danger-deep">
              <IconoDocumento />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-foreground">{cv.archivo.name}</p>
              <p className="text-[12px] text-muted">
                {cv.bytesFinal < cv.bytesOriginal
                  ? `Comprimido de ${formatearBytes(cv.bytesOriginal)} a ${formatearBytes(cv.bytesFinal)}`
                  : formatearBytes(cv.bytesFinal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCv(null)}
              aria-label="Quitar el PDF"
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-danger-deep"
            >
              <IconoPapelera />
            </button>
          </div>
        ) : (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              errores.cv ? 'border-danger/50 bg-danger/[0.03]' : 'border-border hover:border-muted hover:bg-background/60'
            } ${procesando ? 'pointer-events-none opacity-70' : ''}`}
          >
            <span className="text-muted">
              <IconoDocumento />
            </span>
            <span className="text-[13.5px] font-semibold text-foreground">
              {procesando ? <BaknazoLoader tamano="boton" mensaje="Preparando tu PDF" /> : 'Elegir PDF'}
            </span>
            <span className="text-[12px] text-muted">Máximo 5 MB. Lo comprimimos por ti.</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={procesando}
              onChange={(e) => {
                elegirCv(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {errores.cv && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-danger-deep">
            <IconoAlerta />
            {errores.cv}
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-muted">
          Teléfono <span className="font-normal text-muted/70">(opcional)</span>
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+593 99 123 4567"
          className="h-11 w-full rounded-lg border border-border bg-white px-3.5 text-[15px] text-foreground placeholder:text-muted/70 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
        {errores.telefono && <p className="mt-1 text-[12.5px] text-danger-deep">{errores.telefono}</p>}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-muted">
          Mensaje <span className="font-normal text-muted/70">(opcional)</span>
        </span>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, 1500))}
          rows={4}
          placeholder="Cuéntale en pocas líneas por qué eres buena opción para el puesto."
          className="w-full resize-y rounded-lg border border-border bg-white px-3.5 py-2.5 text-[14.5px] leading-relaxed text-foreground placeholder:text-muted/70 focus:border-accent/70 focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
        <span className="mt-1 block text-right text-[11.5px] text-muted tabular-nums">{mensaje.length}/1500</span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          disabled={enviando}
          className="h-11 flex-1 rounded-lg border border-border text-[14px] font-semibold text-foreground transition-colors hover:border-muted disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando || procesando}
          className="h-11 flex-[2] rounded-lg bg-empleo text-[14px] font-semibold text-white transition-colors hover:bg-empleo-deep disabled:opacity-60"
        >
          {enviando ? <BaknazoLoader tamano="boton" mensaje="Enviando" /> : 'Enviar postulación'}
        </button>
      </div>
    </form>
  );
}
