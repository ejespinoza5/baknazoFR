import type { ReactNode } from 'react';
import {
  IconoAlerta,
  IconoBocadillo,
  IconoCandado,
  IconoCheck,
  IconoDocumento,
  IconoEtiqueta,
  IconoGuardar,
  IconoMaletin,
  IconoPapelera,
  IconoPersona,
  IconoPulgar,
  IconoReloj,
  IconoSoporte,
} from './Iconos';
import { urlCompleta } from '../lib/imagen';
import { haceCuanto, inicialesDe } from '../lib/tarjeta';
import type { Notificacion, TipoNotificacion } from '../types/notificacion';

/**
 * Cómo se ve cada tipo: su ícono y su color. Los colores salen de la paleta de
 * siempre: azul para lo social, dorado para lo que gusta, rojo de empleo para
 * vacantes, y los de éxito, aviso y peligro para lo que pasa con tus anuncios
 * y tu cuenta.
 */
const ESTILO: Record<TipoNotificacion, { icono: ReactNode; tono: string }> = {
  SEGUIDOR: { icono: <IconoPersona />, tono: 'bg-accent text-white' },
  ME_GUSTA: { icono: <IconoPulgar lleno />, tono: 'bg-accent text-white' },
  COMENTARIO: { icono: <IconoBocadillo />, tono: 'bg-accent text-white' },
  RESPUESTA: { icono: <IconoBocadillo />, tono: 'bg-accent text-white' },
  GUARDADO: { icono: <IconoGuardar />, tono: 'bg-brand text-foreground' },
  MENSAJE: { icono: <IconoBocadillo />, tono: 'bg-accent text-white' },
  ANUNCIO_APROBADO: { icono: <IconoCheck ok />, tono: 'bg-success text-white' },
  ANUNCIO_RECHAZADO: { icono: <IconoAlerta />, tono: 'bg-danger text-white' },
  ANUNCIO_VENCIDO: { icono: <IconoReloj />, tono: 'bg-warning text-white' },
  NUEVA_VACANTE: { icono: <IconoMaletin />, tono: 'bg-empleo text-white' },
  POSTULACION_NUEVA: { icono: <IconoDocumento />, tono: 'bg-empleo text-white' },
  POSTULACION_ESTADO: { icono: <IconoMaletin />, tono: 'bg-empleo text-white' },
  CV_REVISADO: { icono: <IconoDocumento />, tono: 'bg-empleo text-white' },
  SEGURIDAD: { icono: <IconoCandado />, tono: 'bg-danger text-white' },
  SOPORTE: { icono: <IconoSoporte />, tono: 'bg-carbon text-brand' },
};

const RESPALDO = { icono: <IconoEtiqueta />, tono: 'bg-carbon text-white' };

/**
 * Una notificación: quién (su foto con el sello del tipo) o, si no hay
 * persona detrás, el ícono del tipo. Las no leídas llevan fondo y un punto.
 */
export default function FilaNotificacion({
  notificacion: n,
  onAbrir,
  onEliminar,
  compacta = false,
}: {
  notificacion: Notificacion;
  onAbrir: () => void;
  /** Solo en la pantalla completa: en la campana no hay sitio. */
  onEliminar?: () => void;
  compacta?: boolean;
}) {
  const estilo = ESTILO[n.tipo] ?? RESPALDO;
  const foto = n.actor ? urlCompleta(n.actor.foto) : null;
  const tamano = compacta ? 'size-10' : 'size-11';

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl px-3 transition-colors ${compacta ? 'py-2.5' : 'py-3'} ${
        n.leida ? 'hover:bg-background' : 'bg-accent/[0.05] hover:bg-accent/[0.08]'
      }`}
    >
      <span className="relative shrink-0">
        {n.actor ? (
          foto ? (
            <img src={foto} alt="" className={`${tamano} rounded-full object-cover ring-1 ring-black/5`} />
          ) : (
            <span
              aria-hidden="true"
              className={`grid ${tamano} place-items-center rounded-full text-[13px] font-semibold text-white ${
                n.actor.esNegocio ? 'bg-accent' : 'bg-carbon'
              }`}
            >
              {inicialesDe(n.actor.nombre)}
            </span>
          )
        ) : (
          <span aria-hidden="true" className={`grid ${tamano} place-items-center rounded-full ${estilo.tono}`}>
            {estilo.icono}
          </span>
        )}
        {n.actor && (
          <span
            aria-hidden="true"
            className={`absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-white [&>svg]:size-3 ${estilo.tono}`}
          >
            {estilo.icono}
          </span>
        )}
      </span>

      {/* El enlace estirado cubre la fila: un solo punto de entrada con nombre. */}
      <button
        type="button"
        onClick={onAbrir}
        className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
      >
        <span className={`block text-[13.5px] leading-snug ${n.leida ? 'text-foreground/85' : 'font-medium text-foreground'}`}>
          {n.texto}
        </span>
        <span className={`mt-0.5 block text-[12px] ${n.leida ? 'text-muted' : 'font-semibold text-accent'}`}>
          {haceCuanto(n.actualizadaEn)}
        </span>
      </button>

      {!n.leida && (
        <span aria-label="Sin leer" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
      )}

      {onEliminar && (
        <button
          type="button"
          onClick={onEliminar}
          aria-label="Eliminar notificación"
          className="relative z-10 grid size-8 shrink-0 place-items-center rounded-lg text-muted opacity-100 transition-colors hover:bg-white hover:text-danger-deep sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <IconoPapelera />
        </button>
      )}
    </div>
  );
}
