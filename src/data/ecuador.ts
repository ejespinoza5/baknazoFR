/**
 * Provincias y cantones de Ecuador (lista fija, sin API).
 * 24 provincias; cada una con sus cantones.
 */
export const PROVINCIAS_EC: Record<string, string[]> = {
  Azuay: ['Cuenca', 'Girón', 'Gualaceo', 'Nabón', 'Paute', 'Pucará', 'San Fernando', 'Santa Isabel', 'Sevilla de Oro', 'Sígsig', 'Oña', 'Chordeleg', 'El Pan', 'Guachapala', 'Camilo Ponce Enríquez'],
  Bolívar: ['Guaranda', 'Chillanes', 'Chimbo', 'Echeandía', 'San Miguel', 'Caluma', 'Las Naves'],
  Cañar: ['Azogues', 'Biblián', 'Cañar', 'Déleg', 'El Tambo', 'La Troncal', 'Suscal'],
  Carchi: ['Tulcán', 'Bolívar', 'Espejo', 'Mira', 'Montúfar', 'San Pedro de Huaca'],
  Chimborazo: ['Riobamba', 'Alausí', 'Colta', 'Cumandá', 'Guamote', 'Guano', 'Pallatanga', 'Penipe', 'Chambo', 'Chunchi'],
  Cotopaxi: ['Latacunga', 'La Maná', 'Pangua', 'Pujilí', 'Salcedo', 'Saquisilí', 'Sigchos'],
  'El Oro': ['Machala', 'Arenillas', 'Atahualpa', 'Balsas', 'Chilla', 'El Guabo', 'Huaquillas', 'Marcabelí', 'Pasaje', 'Piñas', 'Portovelo', 'Santa Rosa', 'Zaruma', 'Las Lajas'],
  Esmeraldas: ['Esmeraldas', 'Eloy Alfaro', 'Muisne', 'Quinindé', 'San Lorenzo', 'Atacames', 'Río Verde'],
  Galápagos: ['San Cristóbal', 'Isabela', 'Santa Cruz'],
  Guayas: ['Guayaquil', 'Alfredo Baquerizo Moreno', 'Balao', 'Balzar', 'Colimes', 'Coronel Marcelino Maridueña', 'Daule', 'Durán', 'El Empalme', 'El Triunfo', 'General Antonio Elizalde', 'Isidro Ayora', 'Lomas de Sargentillo', 'Milagro', 'Naranjal', 'Naranjito', 'Nobol', 'Palestina', 'Pedro Carbo', 'Playas', 'Salitre', 'Samborondón', 'Santa Lucía', 'Simón Bolívar', 'Yaguachi'],
  Imbabura: ['Ibarra', 'Antonio Ante', 'Cotacachi', 'Otavalo', 'Pimampiro', 'San Miguel de Urcuquí'],
  Loja: ['Loja', 'Calvas', 'Catamayo', 'Celica', 'Chaguarpamba', 'Espíndola', 'Gonzanamá', 'Macará', 'Paltas', 'Pindal', 'Puyango', 'Quilanga', 'Saraguro', 'Sozoranga', 'Zapotillo', 'Olmedo'],
  'Los Ríos': ['Babahoyo', 'Baba', 'Buena Fe', 'Mocache', 'Montalvo', 'Palenque', 'Pueblo Viejo', 'Quevedo', 'Quinsaloma', 'Urdaneta', 'Valencia', 'Ventanas', 'Vinces'],
  Manabí: ['Portoviejo', 'Bolívar', 'Chone', 'El Carmen', 'Flavio Alfaro', 'Jipijapa', 'Junín', 'Manta', 'Montecristi', 'Olmedo', 'Paján', 'Pedernales', 'Pichincha', 'Rocafuerte', 'Santa Ana', 'Sucre', 'Tosagua', '24 de Mayo', 'Puerto López', 'Jama', 'Jaramijó', 'San Vicente'],
  'Morona Santiago': ['Macas', 'Gualaquiza', 'Limón Indanza', 'Palora', 'Santiago', 'San Juan Bosco', 'Huamboya', 'San José de Morona', 'Sucúa', 'Taisha', 'Tiwintza', 'Pablo Sexto'],
  Napo: ['Tena', 'Archidona', 'El Chaco', 'Quijos', 'Carlos Julio Arosemena Tola'],
  Orellana: ['Francisco de Orellana', 'Aguarico', 'La Joya de los Sachas', 'Loreto'],
  Pastaza: ['Pastaza', 'Mera', 'Santa Clara', 'Arajuno'],
  Pichincha: ['Quito', 'Cayambe', 'Mejía', 'Pedro Moncayo', 'Pedro Vicente Maldonado', 'Puerto Quito', 'San Miguel de Los Bancos', 'Rumiñahui'],
  'Santa Elena': ['Santa Elena', 'La Libertad', 'Salinas'],
  'Santo Domingo de los Tsáchilas': ['Santo Domingo', 'La Concordia'],
  Sucumbíos: ['Lago Agrio', 'Cascales', 'Cuyabeno', 'Gonzalo Pizarro', 'Putumayo', 'Shushufindi'],
  Tungurahua: ['Ambato', 'Baños de Agua Santa', 'Cevallos', 'Mocha', 'Patate', 'Quero', 'San Pedro de Pelileo', 'Santiago de Píllaro', 'Tisaleo'],
  'Zamora Chinchipe': ['Zamora', 'Chinchipe', 'El Pangui', 'Nangaritza', 'Palanda', 'Paquisha', 'Yacuambi', 'Yantzaza', 'Centinela del Cóndor'],
};

export const CANTONES_DE = (provincia: string): string[] =>
  PROVINCIAS_EC[provincia] ?? [];

export const BUSCAR_PROVINCIA = (texto: string): string | null => {
  const limpio = texto.trim().toLowerCase();
  const candidato = PROVINCIAS_EC[texto.trim()];
  if (candidato) return texto.trim();

  for (const provincia of Object.keys(PROVINCIAS_EC)) {
    if (provincia.toLowerCase() === limpio) return provincia;
  }
  return null;
};

/** Detecta en qué provincia entra un cantón dado. */
export const PROVINCIA_DE_CANTON = (canton: string): string | null => {
  const limpio = canton.trim().toLowerCase();
  for (const [provincia, cantones] of Object.entries(PROVINCIAS_EC)) {
    if (cantones.some((c) => c.toLowerCase() === limpio)) return provincia;
  }
  return null;
};