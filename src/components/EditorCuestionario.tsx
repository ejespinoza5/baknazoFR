import type { ReactNode } from 'react';
import { IconoAlerta, IconoChevron, IconoCerrar, IconoDocumento, IconoLista, IconoMas, IconoPapelera } from './Iconos';
import { etiqueta as claseEtiqueta, inputBase } from '../screens/config/ui';
import { CUESTIONARIO, nuevoIdPregunta, type ModoPostulacion } from '../lib/formularioAnuncio';
import type { PreguntaEmpleo, TipoPregunta } from '../types/anuncio';

const TIPOS: { id: TipoPregunta; texto: string }[] = [
  { id: 'TEXTO', texto: 'Respuesta abierta' },
  { id: 'SI_NO', texto: 'Sí o no' },
  { id: 'OPCION', texto: 'Elegir una opción' },
];

/** Ideas para empezar: se agregan con un toque y se pueden editar. */
const SUGERENCIAS: Omit<PreguntaEmpleo, 'id'>[] = [
  { texto: '¿Cuántos años de experiencia tienes en un puesto similar?', tipo: 'TEXTO', obligatoria: true },
  { texto: '¿Tienes disponibilidad inmediata?', tipo: 'SI_NO', obligatoria: true },
  {
    texto: '¿Cuál es tu nivel de estudios?',
    tipo: 'OPCION',
    obligatoria: false,
    opciones: ['Bachillerato', 'Tecnología', 'Tercer nivel', 'Cuarto nivel'],
  },
  { texto: '¿Cuál es tu aspiración salarial?', tipo: 'TEXTO', obligatoria: false },
  { texto: '¿Tienes licencia de conducir?', tipo: 'SI_NO', obligatoria: false },
];

/**
 * Cómo se postulan a la vacante: con la hoja de vida y nada más, o además
 * respondiendo preguntas que decide el negocio (cuáles son obligatorias,
 * de qué tipo y en qué orden).
 */
export default function EditorCuestionario({
  modo,
  preguntas,
  error,
  onModo,
  onPreguntas,
}: {
  modo: ModoPostulacion;
  preguntas: PreguntaEmpleo[];
  error?: string;
  onModo: (modo: ModoPostulacion) => void;
  onPreguntas: (preguntas: PreguntaEmpleo[]) => void;
}) {
  const lleno = preguntas.length >= CUESTIONARIO.maxPreguntas;
  const textos = new Set(preguntas.map((p) => p.texto.trim().toLowerCase()));
  const ideas = SUGERENCIAS.filter((s) => !textos.has(s.texto.toLowerCase()));

  const cambiar = (i: number, parcial: Partial<PreguntaEmpleo>) =>
    onPreguntas(preguntas.map((p, j) => (j === i ? { ...p, ...parcial } : p)));
  const quitar = (i: number) => onPreguntas(preguntas.filter((_, j) => j !== i));
  const mover = (i: number, d: -1 | 1) => {
    const lista = [...preguntas];
    [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
    onPreguntas(lista);
  };
  const agregar = (base?: Omit<PreguntaEmpleo, 'id'>) => {
    if (lleno) return;
    onPreguntas([
      ...preguntas,
      base
        ? { ...base, id: nuevoIdPregunta(), opciones: base.opciones ? [...base.opciones] : undefined }
        : { id: nuevoIdPregunta(), texto: '', tipo: 'TEXTO', obligatoria: true },
    ]);
  };

  return (
    <div>
      <span className={claseEtiqueta}>Cómo se postulan</span>
      <div role="radiogroup" aria-label="Cómo se postulan" className="grid gap-2 sm:grid-cols-2">
        <OpcionModo
          activa={modo === 'rapida'}
          onElegir={() => onModo('rapida')}
          icono={<IconoDocumento />}
          titulo="Postulación rápida"
          texto="Solo envían su hoja de vida y, si quieren, un mensaje."
        />
        <OpcionModo
          activa={modo === 'cuestionario'}
          onElegir={() => {
            onModo('cuestionario');
            if (preguntas.length === 0) agregar();
          }}
          icono={<IconoLista />}
          titulo="Con cuestionario"
          texto="Además responden tus preguntas. Tú eliges cuáles son obligatorias."
        />
      </div>

      {modo === 'cuestionario' && (
        <div className="animate-bkn-in mt-3 space-y-3">
          <ol className="space-y-3">
            {preguntas.map((p, i) => (
              <li key={p.id}>
                <EditorPregunta
                  pregunta={p}
                  numero={i + 1}
                  primera={i === 0}
                  ultima={i === preguntas.length - 1}
                  onCambiar={(parcial) => cambiar(i, parcial)}
                  onQuitar={() => quitar(i)}
                  onSubir={() => mover(i, -1)}
                  onBajar={() => mover(i, 1)}
                />
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={() => agregar()}
              disabled={lleno}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-empleo/45 px-3.5 text-[13.5px] font-semibold text-empleo-deep transition-colors hover:bg-empleo/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconoMas />
              Agregar pregunta
            </button>
            <span className="text-[12px] text-muted tabular-nums">
              {preguntas.length} de {CUESTIONARIO.maxPreguntas}
            </span>
          </div>

          {!lleno && ideas.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-muted">Ideas para empezar</p>
              <div className="flex flex-wrap gap-1.5">
                {ideas.map((s) => (
                  <button
                    key={s.texto}
                    type="button"
                    onClick={() => agregar(s)}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-left text-[12.5px] text-foreground transition-colors hover:border-empleo/40 hover:text-empleo-deep"
                  >
                    <span className="shrink-0 text-muted [&>svg]:size-3.5">
                      <IconoMas />
                    </span>
                    <span className="truncate">{s.texto}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-danger-deep" role="alert">
          <IconoAlerta />
          {error}
        </p>
      )}
    </div>
  );
}

function OpcionModo({
  activa,
  onElegir,
  icono,
  titulo,
  texto,
}: {
  activa: boolean;
  onElegir: () => void;
  icono: ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onElegir}
      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
        activa ? 'border-empleo bg-empleo/[0.05] ring-1 ring-empleo' : 'border-border bg-white hover:border-muted'
      }`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${activa ? 'bg-empleo text-white' : 'bg-background text-muted'}`}
      >
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-foreground">{titulo}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{texto}</span>
      </span>
    </button>
  );
}

function EditorPregunta({
  pregunta: p,
  numero,
  primera,
  ultima,
  onCambiar,
  onQuitar,
  onSubir,
  onBajar,
}: {
  pregunta: PreguntaEmpleo;
  numero: number;
  primera: boolean;
  ultima: boolean;
  onCambiar: (parcial: Partial<PreguntaEmpleo>) => void;
  onQuitar: () => void;
  onSubir: () => void;
  onBajar: () => void;
}) {
  const opciones = p.opciones ?? [];
  const elegirTipo = (tipo: TipoPregunta) =>
    onCambiar({ tipo, opciones: tipo === 'OPCION' ? (opciones.length > 0 ? opciones : ['', '']) : undefined });
  const cambiarOpcion = (i: number, valor: string) => onCambiar({ opciones: opciones.map((o, j) => (j === i ? valor : o)) });

  const botonIcono =
    'grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-35';

  return (
    <div className="rounded-xl border border-border bg-white p-3.5">
      <div className="mb-2 flex items-center gap-1">
        <span className="flex-1 text-[12px] font-semibold text-muted">Pregunta {numero}</span>
        <button type="button" onClick={onSubir} disabled={primera} aria-label={`Subir la pregunta ${numero}`} className={botonIcono}>
          <IconoChevron arriba />
        </button>
        <button type="button" onClick={onBajar} disabled={ultima} aria-label={`Bajar la pregunta ${numero}`} className={botonIcono}>
          <IconoChevron />
        </button>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar la pregunta ${numero}`}
          className={`${botonIcono} hover:bg-danger/[0.06] hover:text-danger-deep`}
        >
          <IconoPapelera />
        </button>
      </div>

      <label className="block">
        <span className="sr-only">Texto de la pregunta {numero}</span>
        <input
          type="text"
          value={p.texto}
          maxLength={CUESTIONARIO.preguntaMax}
          onChange={(e) => onCambiar({ texto: e.target.value })}
          placeholder="Por ejemplo: ¿Tienes experiencia atendiendo clientes?"
          className={inputBase}
        />
      </label>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div role="radiogroup" aria-label={`Tipo de respuesta de la pregunta ${numero}`} className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => {
            const activo = p.tipo === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => elegirTipo(t.id)}
                className={`h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                  activo ? 'border-transparent bg-foreground text-white' : 'border-border bg-white text-foreground hover:border-muted'
                }`}
              >
                {t.texto}
              </button>
            );
          })}
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={p.obligatoria}
            onChange={(e) => onCambiar({ obligatoria: e.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-5 w-9 rounded-full bg-border transition-colors peer-checked:bg-empleo peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
          />
          Obligatoria
        </label>
      </div>

      {p.tipo === 'OPCION' && (
        <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
          {opciones.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-border" />
              <input
                type="text"
                value={o}
                maxLength={CUESTIONARIO.opcionMax}
                onChange={(e) => cambiarOpcion(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                aria-label={`Opción ${i + 1} de la pregunta ${numero}`}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-[14px] text-foreground placeholder:text-muted/70 focus:border-accent/70 focus:ring-[3px] focus:ring-accent/15 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onCambiar({ opciones: opciones.filter((_, j) => j !== i) })}
                disabled={opciones.length <= CUESTIONARIO.opcionesMin}
                aria-label={`Quitar la opción ${i + 1}`}
                className={botonIcono}
              >
                <IconoCerrar />
              </button>
            </div>
          ))}
          {opciones.length < CUESTIONARIO.opcionesMax && (
            <button
              type="button"
              onClick={() => onCambiar({ opciones: [...opciones, ''] })}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline [&>svg]:size-3.5"
            >
              <IconoMas />
              Agregar opción
            </button>
          )}
        </div>
      )}
    </div>
  );
}
