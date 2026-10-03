import { useEffect, useState } from 'react';
import RecortadorImagen from '../../components/RecortadorImagen';
import { IconoCamara, IconoPapelera, IconoRecortar } from '../../components/Iconos';
import { notificarAviso } from '../../lib/notificar';
import { normalizarImagen } from '../../lib/imagen';
import { fotoEntera } from '../config/ui';
import { FORMATOS_FOTO } from '../publicar/datos';
import type { FotoAnuncio } from '../../types/anuncio';
import FormatosAceptados from '../../components/FormatosAceptados';

export interface Galeria {
  /** Las que ya están guardadas, en el orden en que se mostrarán. */
  existentes: FotoAnuncio[];
  /** Archivos nuevos que se subirán al final de la lista. */
  nuevas: File[];
}

interface Props {
  galeria: Galeria;
  onCambio: (galeria: Galeria) => void;
  /** Vienen de GET /api/catalogos: el límite es del servidor, no nuestro. */
  maxFotos: number;
  maxBytes: number;
}

/** Una foto nueva aún no está en el servidor: su URL es temporal. */
function FotoNueva({
  archivo,
  indice,
  onQuitar,
  onAjustar,
}: {
  archivo: File;
  indice: number;
  onQuitar: () => void;
  onAjustar: () => void;
}) {
  const [url] = useState(() => URL.createObjectURL(archivo));

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="relative">
      <img
        src={url}
        alt={`Foto nueva ${indice + 1}`}
        className={fotoEntera}
      />
      <button
        type="button"
        onClick={onAjustar}
        aria-label={`Ajustar la foto nueva ${indice + 1}`}
        className="absolute top-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-carbon"
      >
        <IconoRecortar />
      </button>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar foto nueva ${indice + 1}`}
        className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-danger-deep"
      >
        <IconoPapelera />
      </button>
      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
        Nueva
      </span>
    </div>
  );
}

/**
 * Las fotos de un anuncio que ya existe.
 *
 * No es `HuecosFoto`: al publicar solo hay archivos por elegir, y al editar hay
 * fotos ya guardadas que se conservan con su id, se pueden quitar y se pueden
 * reordenar. El backend lo resuelve con `fotosConservar` (los ids que quedan, en
 * el orden nuevo) y `fotos` (los archivos nuevos, que siempre se agregan al
 * final). Por eso una foto nueva no puede ser portada en la misma guardado: la
 * portada es la primera de las que se conservan.
 */
export default function GaleriaFoto({ galeria, onCambio, maxFotos, maxBytes }: Props) {
  const { existentes, nuevas } = galeria;
  /** Índice en `nuevas` de la que se está ajustando, si hay alguna. */
  const [recortando, setRecortando] = useState<number | null>(null);

  const total = existentes.length + nuevas.length;
  const lleno = total >= maxFotos;

  const quitarExistente = (id: number) =>
    onCambio({ ...galeria, existentes: existentes.filter((f) => f.id !== id) });

  const quitarNueva = (indice: number) =>
    onCambio({ ...galeria, nuevas: nuevas.filter((_, i) => i !== indice) });

  /** La portada es la primera foto conservada; se cambia moviendo a esa foto. */
  const hacerPortada = (id: number) => {
    const foto = existentes.find((f) => f.id === id);
    if (!foto) return;
    onCambio({
      ...galeria,
      existentes: [foto, ...existentes.filter((f) => f.id !== id)],
    });
  };

  const recibir = async (lista: FileList | null) => {
    const archivo = lista?.[0];
    if (!archivo) return;
    // Mismos formatos y tamaño que al publicar: el backend los rechazaría igual.
    if (!FORMATOS_FOTO.test(archivo.name)) {
      notificarAviso('Esa imagen no es JPG, PNG, WEBP ni AVIF.');
      return;
    }
    if (archivo.size > maxBytes) {
      notificarAviso(
        `La imagen supera los ${Math.round(maxBytes / 1024 / 1024)} MB. Elige una más liviana.`
      );
      return;
    }
    // Entra tal cual. El recorte es optativo y se pide con el botón de ajustar,
    // no al elegir: imponerlo aquí hacía perder media foto sin avisar. Se
    // endereza y se acota antes de guardarla, que es lo que hacía el recorte
    // automático sin la parte que cortaba.
    onCambio({ ...galeria, nuevas: [...galeria.nuevas, await normalizarImagen(archivo)] });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {existentes.map((foto, indice) => (
          <div key={foto.id} className="relative">
            <img
              src={foto.url}
              alt={`Foto ${indice + 1} del anuncio`}
              className={fotoEntera}
            />
            <button
              type="button"
              onClick={() => quitarExistente(foto.id)}
              aria-label={`Quitar foto ${indice + 1}`}
              className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-danger-deep"
            >
              <IconoPapelera />
            </button>
            {indice === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-carbon/70 px-2 py-0.5 text-[10px] font-medium text-white">
                Portada
              </span>
            ) : (
              <button
                type="button"
                onClick={() => hacerPortada(foto.id)}
                className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-muted shadow-[0_1px_3px_rgba(31,41,55,0.15)] transition-colors hover:text-foreground"
              >
                Hacer portada
              </button>
            )}
          </div>
        ))}

        {nuevas.map((archivo, indice) => (
          <FotoNueva
            key={`${archivo.name}-${indice}`}
            archivo={archivo}
            indice={indice}
            onQuitar={() => quitarNueva(indice)}
            onAjustar={() => setRecortando(indice)}
          />
        ))}

        {!lleno && (
          <label className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-white text-center transition-colors hover:border-muted">
            <IconoCamara />
            <span className="px-2 text-[11.5px] leading-tight font-medium text-muted">
              Agregar foto
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                await recibir(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      <p className="mt-2.5 text-[12px] text-muted">
        {lleno
          ? `Usaste las ${maxFotos} fotos. Quita una para cambiarla.`
          : `La portada es la primera foto. Llevas ${total} de ${maxFotos}.`}
      </p>
      {nuevas.length > 0 && (
        <p className="mt-1 text-[12px] text-muted">
          Las fotos nuevas se agregan al final: para que una sea portada, muévela
          después de guardarlas. Se publican enteras; si quieres recortarlas,
          toca el botón de ajustar.
        </p>
      )}
      <FormatosAceptados maxBytes={maxBytes} />

      {recortando !== null && nuevas[recortando] && (
        <RecortadorImagen
          imagen={nuevas[recortando]}
          forma="rectangular"
          tamanoSalida={1200}
          onCancelar={() => setRecortando(null)}
          onRecortada={(archivo) => {
            // Reemplaza la foto que se estaba ajustando. Antes se agregaba al
            // final, así que ajustar una foto dejaba la original y añadir otra.
            const siguientes = [...galeria.nuevas];
            siguientes[recortando] = archivo;
            onCambio({ ...galeria, nuevas: siguientes });
            setRecortando(null);
          }}
        />
      )}
    </>
  );
}
