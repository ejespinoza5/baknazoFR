import { useEffect, useState } from 'react';

/**
 * URL temporal de un archivo, liberada al cambiar o al desmontar.
 *
 * Se usa para enseñar una foto que todavía no está en el servidor —la portada
 * de la vista previa, la recién recortada— sin guardarla en el estado.
 *
 * La URL se rehace durante el render, no en un efecto: un efecto que solo
 * guardara el resultado provocaría un render extra en cada cambio de foto.
 * Solo queda viva la URL actual: al cambiar, el efecto anterior revoca la suya.
 */
export function useObjectUrl(archivo: File | null | undefined): string | null {
  const [estado, setEstado] = useState(() => ({
    archivo,
    url: archivo ? URL.createObjectURL(archivo) : null,
  }));

  if (estado.archivo !== archivo) {
    setEstado({ archivo, url: archivo ? URL.createObjectURL(archivo) : null });
  }

  useEffect(
    () => () => {
      if (estado.url) URL.revokeObjectURL(estado.url);
    },
    [estado.url]
  );

  return estado.archivo === archivo ? estado.url : null;
}
