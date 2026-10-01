import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { actualizarPerfil } from '../../api/auth';
import {
  IconoCheck,
  IconoEstrella,
  IconoNegocio,
  IconoOjo,
  IconoPersona,
  IconoPin,
  IconoPulgar,
  IconoReloj,
  IconoTelefono,
} from '../../components/Iconos';
import { notificarAviso, notificarError } from '../../lib/notificar';
import {
  privacidadCompleta,
  type PerfilUsuario,
  type PrivacidadPerfil,
} from '../../types/auth';
import { tarjeta } from './ui';

type Clave = keyof PrivacidadPerfil;

interface Opcion {
  clave: Clave;
  titulo: string;
  ayuda: string;
  icono: ReactNode;
}

const ACTIVIDAD: Opcion[] = [
  {
    clave: 'vendidos',
    titulo: 'Lo que ya vendiste',
    ayuda: 'La pestaña "Vendidos" y el número de ventas. Suele dar confianza a quien compra.',
    icono: <IconoCheck ok />,
  },
  {
    clave: 'me_gusta',
    titulo: 'Me gusta recibidos',
    ayuda: 'El total de "me gusta" que suman tus anuncios.',
    icono: <IconoPulgar />,
  },
  {
    clave: 'seguidores',
    titulo: 'Seguidores y seguidos',
    ayuda: 'Las cifras y las listas de quién te sigue y a quién sigues.',
    icono: <IconoPersona />,
  },
];

const SOBRE_TI: Opcion[] = [
  {
    clave: 'ubicacion',
    titulo: 'Ciudad',
    ayuda: 'La ciudad o el sector que aparece bajo tu nombre.',
    icono: <IconoPin />,
  },
  {
    clave: 'miembro_desde',
    titulo: 'Fecha en que te uniste',
    ayuda: '"Miembro desde", que ayuda a ver que la cuenta no es nueva.',
    icono: <IconoReloj />,
  },
];

const NEGOCIO: Opcion[] = [
  {
    clave: 'contacto_negocio',
    titulo: 'Botones de WhatsApp y llamada',
    ayuda: 'Si los apagas, solo te podrán contactar desde tus anuncios.',
    icono: <IconoTelefono />,
  },
  {
    clave: 'direccion',
    titulo: 'Dirección y mapa',
    ayuda: 'La dirección del local y el botón para abrirla en el mapa.',
    icono: <IconoPin />,
  },
  {
    clave: 'horario',
    titulo: 'Horario de atención',
    ayuda: 'Los días y horas en que atiendes.',
    icono: <IconoReloj />,
  },
  {
    clave: 'redes',
    titulo: 'Redes sociales',
    ayuda: 'Los enlaces a Instagram, Facebook o TikTok del negocio.',
    icono: <IconoEstrella />,
  },
];

/**
 * "Qué ven los demás": el dueño decide qué partes de su perfil son públicas.
 *
 * Cada interruptor se guarda al tocarlo, sin botón de guardar: es lo que se
 * espera de un ajuste de privacidad en cualquier red social, y un "Guardar" al
 * final de una lista de casillas se olvida con facilidad. Si el servidor falla,
 * la casilla vuelve a donde estaba y se avisa.
 *
 * Tu nombre, tu foto y tus anuncios disponibles no aparecen aquí a propósito:
 * sin ellos el perfil no sirve para vender, que es para lo que existe.
 */
export default function PanelPrivacidad({
  perfil,
  onPerfilActualizado,
}: {
  perfil: PerfilUsuario;
  onPerfilActualizado: (usuario: PerfilUsuario) => void;
}) {
  const navegar = useNavigate();
  const [privacidad, setPrivacidad] = useState<PrivacidadPerfil>(() =>
    privacidadCompleta(perfil.privacidad_perfil)
  );
  const [guardando, setGuardando] = useState<Clave | null>(null);
  const esNegocio = perfil.tipo_cuenta === 'NEGOCIO';

  const cambiar = async (clave: Clave, valor: boolean) => {
    if (guardando) return;
    const anterior = privacidad;
    const siguiente = { ...privacidad, [clave]: valor };
    setPrivacidad(siguiente);
    setGuardando(clave);
    try {
      const respuesta = await actualizarPerfil({ privacidad_perfil: siguiente });
      onPerfilActualizado(respuesta.usuario);
      // Un backend sin la migración responde 200 pero no devuelve el campo: el
      // cambio no se guardó, y hay que decirlo en vez de fingir que sí.
      if (!respuesta.usuario.privacidad_perfil) {
        setPrivacidad(anterior);
        notificarAviso('El servidor todavía no guarda estos ajustes. Inténtalo más tarde.');
      }
    } catch (e) {
      setPrivacidad(anterior);
      notificarError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(null);
    }
  };

  const ocultos = (Object.keys(privacidad) as Clave[]).filter(
    (clave) => !privacidad[clave] && (esNegocio || !NEGOCIO.some((o) => o.clave === clave))
  ).length;

  return (
    <div className="space-y-5">
      <section className={tarjeta}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-[52ch]">
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
              Qué ven los demás en tu perfil
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Tu nombre, tu foto y tus anuncios disponibles siempre se ven. Lo
              demás lo decides tú, y se aplica al instante.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navegar(`/perfil/${perfil.id}?vista=visitante`)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-muted"
          >
            <IconoOjo abierto />
            Ver como visitante
          </button>
        </div>

        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-[12.5px] text-muted">
          {ocultos === 0
            ? 'Tu perfil se ve completo.'
            : ocultos === 1
              ? 'Tienes 1 dato oculto para los visitantes.'
              : `Tienes ${ocultos} datos ocultos para los visitantes.`}
        </p>

        <Grupo titulo="Tu actividad">
          {ACTIVIDAD.map((opcion) => (
            <Fila
              key={opcion.clave}
              opcion={opcion}
              activo={privacidad[opcion.clave]}
              ocupado={guardando === opcion.clave}
              bloqueado={guardando !== null}
              onCambiar={(v) => cambiar(opcion.clave, v)}
            />
          ))}
        </Grupo>

        <Grupo titulo="Sobre ti">
          {SOBRE_TI.map((opcion) => (
            <Fila
              key={opcion.clave}
              opcion={opcion}
              activo={privacidad[opcion.clave]}
              ocupado={guardando === opcion.clave}
              bloqueado={guardando !== null}
              onCambiar={(v) => cambiar(opcion.clave, v)}
            />
          ))}
        </Grupo>

        {esNegocio && (
          <Grupo titulo="Tu negocio" icono={<IconoNegocio />}>
            {NEGOCIO.map((opcion) => (
              <Fila
                key={opcion.clave}
                opcion={opcion}
                activo={privacidad[opcion.clave]}
                ocupado={guardando === opcion.clave}
                bloqueado={guardando !== null}
                onCambiar={(v) => cambiar(opcion.clave, v)}
              />
            ))}
          </Grupo>
        )}
      </section>

      <p className="px-1 text-[12.5px] leading-relaxed text-muted">
        Tu número personal nunca aparece en el perfil: solo se enseña desde un
        anuncio, a quien lo pida y si lo tienes activado en{' '}
        <strong className="font-semibold text-foreground">Editar perfil</strong>.
      </p>
    </div>
  );
}

function Grupo({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.12em] text-muted uppercase">
        {icono}
        {titulo}
      </h3>
      <ul className="mt-1 divide-y divide-border">{children}</ul>
    </div>
  );
}

function Fila({
  opcion,
  activo,
  ocupado,
  bloqueado,
  onCambiar,
}: {
  opcion: Opcion;
  activo: boolean;
  ocupado: boolean;
  bloqueado: boolean;
  onCambiar: (valor: boolean) => void;
}) {
  const id = `privacidad-${opcion.clave}`;
  return (
    <li className="flex items-center gap-3.5 py-3.5">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${
          activo ? 'bg-accent/[0.08] text-accent' : 'bg-background text-muted'
        }`}
      >
        {opcion.icono}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer text-[14px] font-medium text-foreground">
          {opcion.titulo}
        </label>
        <p id={`${id}-ayuda`} className="mt-0.5 text-[12.5px] leading-snug text-muted">
          {opcion.ayuda}
        </p>
      </div>
      <span className="hidden w-14 text-right text-[12px] font-medium text-muted sm:block">
        {ocupado ? 'Guardando' : activo ? 'Visible' : 'Oculto'}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        aria-describedby={`${id}-ayuda`}
        disabled={bloqueado}
        onClick={() => onCambiar(!activo)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-wait ${
          activo ? 'bg-success' : 'bg-border'
        } ${ocupado ? 'opacity-70' : ''}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(31,41,55,0.25)] transition-transform duration-200 ${
            activo ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </li>
  );
}
