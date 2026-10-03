import { Encabezado } from '../ui';
import ListaAnuncios from './ListaAnuncios';

export default function Denuncias() {
  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Denuncias"
        descripcion="Anuncios con denuncias abiertas, los más denunciados primero. Al llegar al umbral configurado, un anuncio sale del feed y espera revisión."
      />
      <ListaAnuncios
        ruta="/denuncias"
        textoVacio={{ titulo: 'Sin denuncias abiertas', texto: 'Cuando alguien denuncie un anuncio, aparecerá aquí.' }}
      />
    </div>
  );
}
