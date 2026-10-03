import { Campo, GrupoChips } from './Campos';
import EditorCuestionario from './EditorCuestionario';
import Selector from './Selector';
import { opcionesCiudad } from '../lib/opcionesSelector';
import { IconoAlerta, IconoTelefono } from './Iconos';
import { inputBase, etiqueta as claseEtiqueta } from '../screens/config/ui';
import {
  DETALLE_POR_PILAR,
  ETIQUETA_DETALLE,
  PRECIO,
  TITULO_MAX,
  fotoObligatoria,
  type ErrorCampo,
  type Formulario,
} from '../lib/formularioAnuncio';
import { EJEMPLO_TITULO } from '../screens/publicar/datos';
import { ESTILO_PILAR, type Pilar } from '../lib/pilares';
import type { Catalogos } from '../types/anuncio';

/**
 * Los campos de un anuncio, tal cual los ve el usuario.
 *
 * Es el mismo bloque en publicar y en editar: mismo orden, mismos textos, mismos
 * chips. La pantalla decide qué hay alrededor (el segmented de tipo en publicar,
 * la insignia de tipo fijo en editar, porque el backend no deja cambiarlo) y qué
 * pasa con las fotos, pero los campos son uno solo.
 */
export interface Props {
  form: Formulario;
  cambiar: <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => void;
  errores: Partial<Record<ErrorCampo, string>>;
  catalogos: Catalogos;
  pilar: Pilar;
  /** El selector de fotos de cada pantalla: `HuecosFoto` o `GaleriaFoto`. */
  fotos: React.ReactNode;
  /** Avisos de la pantalla (borrador recuperado, fallo de red, campos con error). */
  avisos?: React.ReactNode;
  /**
   * Si quien publica tiene un número en su perfil.
   *
   * Sin número el interruptor no se enseña: marcarlo solo produciría un anuncio
   * con la promesa de un teléfono que no existe. La pantalla de publicación
   * decide esto leyendo el perfil, que es el único que sabe si lo hay.
   */
  tieneTelefono?: boolean;
  /**
   * El número que se está escribiendo ahora mismo, para el caso de que la
   * cuenta todavía no tenga ninguno.
   *
   * Es un campo aquí y no un viaje a Configuración porque el sitio donde se
   * decide si se muestra el teléfono es este: obligar a salir del formulario
   * para dar el número, y volver después sin perder lo escrito, es el modo más
   * rápido de que la gente se lo salte.
   */
  telefonoNuevo?: string;
  onTelefonoNuevo?: (valor: string) => void;
  /**
   * Si lo tecleado ya tiene forma de teléfono. Mientras no lo sea, el
   * interruptor sigue sin aparecer: la casilla solo se ofrece cuando hay algo
   * real que marcar.
   */
  telefonoNuevoValido?: boolean;
  /** Botón de envío, que es lo único que cambia entre publicar y editar. */
  children?: React.ReactNode;
}

export default function FormularioAnuncio({
  form,
  cambiar,
  errores,
  catalogos,
  pilar,
  fotos,
  avisos,
  tieneTelefono = true,
  telefonoNuevo = '',
  onTelefonoNuevo,
  telefonoNuevoValido = false,
  children,
}: Props) {
  const estilo = ESTILO_PILAR[pilar];
  const campoPrecio = PRECIO[pilar];
  const categorias = catalogos.categorias.filter((c) => c.pilar === pilar);

  return (
    <>
      {avisos}

      <Campo etiqueta="Título del anuncio" error={errores.titulo} id="titulo">
        <input
          id="titulo"
          type="text"
          value={form.titulo}
          maxLength={TITULO_MAX}
          onChange={(e) => cambiar('titulo', e.target.value)}
          placeholder={EJEMPLO_TITULO[pilar]}
          aria-invalid={Boolean(errores.titulo)}
          className={inputBase}
        />
        <p className="mt-1.5 text-right text-[11.5px] text-muted">
          {form.titulo.length}/{TITULO_MAX}
        </p>
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Categoría" error={errores.categoria} id="categoria">
          <Selector
            id="categoria"
            etiqueta="Categoría"
            valor={form.categoriaId === '' ? '' : String(form.categoriaId)}
            onCambiar={(v) => cambiar('categoriaId', v === '' ? '' : Number(v))}
            opciones={categorias.map((c) => ({ valor: String(c.id), texto: c.nombre }))}
            placeholder="Elige una categoría"
            textoBusqueda="Buscar categoría"
            invalido={Boolean(errores.categoria)}
          />
        </Campo>

        <Campo etiqueta="Ciudad" error={errores.ciudad} id="ciudad">
          <Selector
            id="ciudad"
            etiqueta="Ciudad"
            valor={form.cantonCodigo}
            onCambiar={(v) => cambiar('cantonCodigo', v)}
            opciones={opcionesCiudad(catalogos)}
            placeholder="Elige una ciudad"
            textoBusqueda="Busca tu ciudad o provincia"
            invalido={Boolean(errores.ciudad)}
          />
        </Campo>
      </div>

      <Campo etiqueta="Descripción (opcional)" id="descripcion">
        <textarea
          id="descripcion"
          rows={4}
          value={form.descripcion}
          onChange={(e) => cambiar('descripcion', e.target.value)}
          placeholder="Describe el estado, las características y los detalles que importan."
          className={`${inputBase} h-auto resize-y py-3`}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta={`${campoPrecio.etiqueta} (opcional)`}
          error={errores.precio}
          id="precio"
        >
          <input
            id="precio"
            type="text"
            inputMode="decimal"
            value={form.precio}
            onChange={(e) => cambiar('precio', e.target.value)}
            placeholder={`${campoPrecio.placeholder} — o a convenir`}
            aria-invalid={Boolean(errores.precio)}
            className={inputBase}
          />
        </Campo>

        {DETALLE_POR_PILAR[pilar].map((clave) => (
          <GrupoChips
            key={clave}
            etiqueta={ETIQUETA_DETALLE[clave]}
            opciones={catalogos.enumeraciones[clave]}
            valor={form[clave]}
            error={errores[clave]}
            onElegir={(valor) => cambiar(clave, valor)}
            tono={estilo.solido}
            sobreTono={estilo.sobreSolido}
          />
        ))}
      </div>

      {pilar === 'empleo' && (
        <EditorCuestionario
          modo={form.modoPostulacion}
          preguntas={form.preguntas}
          error={errores.preguntas}
          onModo={(modo) => cambiar('modoPostulacion', modo)}
          onPreguntas={(preguntas) => cambiar('preguntas', preguntas)}
        />
      )}

      <div>
        <span className={claseEtiqueta}>
          Fotos{fotoObligatoria(pilar) ? '' : ' (opcional)'}
        </span>
        {fotos}
        {errores.fotos && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-danger-deep">
            <IconoAlerta />
            {errores.fotos}
          </p>
        )}
      </div>

      {/* El teléfono va después de las fotos y antes del botón: es una decisión
          más del anuncio, ni la primera que se lee ni la última que se pasa. Y es
          una casilla, no un campo obligatorio, porque quien no lo marca sigue
          publicando igual. */}
      <div className="rounded-xl border border-border bg-background/50 px-3.5 py-3">
        {/* El campo solo aparece a quien no tiene número. Para el resto la
            casilla sola basta, y añadir un input que ya está relleno en otro
            sitio solo invita a tener dos números distintos. */}
        {!tieneTelefono && (
          <label className="mb-3 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <IconoTelefono />
              Tu número de teléfono
            </span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefonoNuevo}
              onChange={(e) => onTelefonoNuevo?.(e.target.value)}
              placeholder="+593 99 123 4567"
              className={inputBase}
            />
            <span className="mt-1.5 block text-[12px] text-muted">
              {telefonoNuevoValido
                ? 'Ahora sí puedes marcarlo para mostrarlo en el anuncio.'
                : 'Se guardará en tu perfil, pero no se mostrará en ningún anuncio hasta que lo marques.'}
            </span>
          </label>
        )}

        {tieneTelefono || telefonoNuevoValido ? (
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={form.mostrarTelefono}
              onChange={(e) => cambiar('mostrarTelefono', e.target.checked)}
              className="size-4 accent-accent"
            />
            <span className="inline-flex items-center gap-1.5">
              <IconoTelefono />
              Mostrar mi número de teléfono en este anuncio
            </span>
          </label>
        ) : (
          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-muted">
            <span className="mt-0.5 shrink-0 text-muted">
              <IconoTelefono />
            </span>
            <span>
              Si quieres que te contacten desde el anuncio, escribe arriba tu
              número. Puedes dejarlo para otro momento.
            </span>
          </p>
        )}
        {(tieneTelefono || telefonoNuevoValido) && (
          <p className="mt-1.5 pl-[26px] text-[12px] text-muted">
            Quien lo abra tendrá un botón para verlo. El número no aparece en el
            anuncio hasta que pulse ese botón.
          </p>
        )}
      </div>

      {children}
    </>
  );
}
