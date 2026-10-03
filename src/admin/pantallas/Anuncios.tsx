import { Encabezado } from '../ui';
import ListaAnuncios from './ListaAnuncios';

type Vista = 'pendientes' | 'publicados' | 'rechazados' | 'pausados' | 'denunciados' | 'todos';

const VISTAS: { id: Vista; texto: string }[] = [
  { id: 'pendientes', texto: 'En revisión' },
  { id: 'publicados', texto: 'Publicados' },
  { id: 'rechazados', texto: 'Rechazados' },
  { id: 'pausados', texto: 'Pausados' },
  { id: 'denunciados', texto: 'Denunciados' },
  { id: 'todos', texto: 'Todos' },
];

export default function Anuncios() {
  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Anuncios"
        descripcion="Lo que esperas revisar aparece primero, del más antiguo al más nuevo. Las reglas automáticas solo leen el texto; las fotos se revisan aquí."
      />
      <ListaAnuncios<Vista>
        ruta="/anuncios"
        vistas={VISTAS}
        vistaInicial="pendientes"
        textoVacio={{ titulo: 'Nada por aquí', texto: 'No hay anuncios en este estado.' }}
      />
    </div>
  );
}
