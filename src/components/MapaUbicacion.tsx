import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  latitud: number | null;
  longitud: number | null;
  onChange: (latitud: number, longitud: number) => void;
}

const ICONO = L.divIcon({
  className: 'baknazo-marcador',
  html: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0a6ebd" stroke-width="2" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))"><circle cx="12" cy="12" r="10" fill="#ffffff"/><circle cx="12" cy="12" r="4.5" fill="#ffb800"/></svg>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function posicionValida(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null;
}

export default function MapaUbicacion({
  latitud,
  longitud,
  onChange,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!contenedor.current || mapaRef.current) return;

    const inicialLat = latitud ?? -2.19616;
    const inicialLng = longitud ?? -79.92187;

    const mapa = L.map(contenedor.current, {
      center: [inicialLat, inicialLng],
      zoom: 12,
      attributionControl: true,
      // Sin esto, la rueda del ratón hace zoom al mapa en vez de desplazar la
      // página, y el formulario se queda atrapado: el usuario rueda sobre el
      // mapa esperando avanzar y no pasa nada. El zoom sigue disponible con los
      // botones y con el pellizco en móvil.
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(mapa);

    if (posicionValida(latitud, longitud)) {
      marcadorRef.current = L.marker([inicialLat, inicialLng], {
        icon: ICONO,
      }).addTo(mapa);
    }

    mapa.on('click', (evento: L.LeafletMouseEvent) => {
      const { lat, lng } = evento.latlng;

      if (marcadorRef.current) {
        mapa.removeLayer(marcadorRef.current);
      }
      marcadorRef.current = L.marker([lat, lng], { icon: ICONO }).addTo(mapa);
      onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    });

    mapaRef.current = mapa;

    return () => {
      mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (latitud === null || longitud === null || !mapa) return;

    const lat: number = latitud;
    const lng: number = longitud;

    if (marcadorRef.current) {
      mapa.removeLayer(marcadorRef.current);
    }
    marcadorRef.current = L.marker([lat, lng], {
      icon: ICONO,
    }).addTo(mapa);
    mapa.setView([lat, lng], Math.max(mapa.getZoom(), 14));
  }, [latitud, longitud]);

  return (
    <div
      ref={contenedor}
      role="application"
      aria-label="Mapa para elegir la ubicación del negocio"
      className="h-64 w-full isolate overflow-hidden rounded-lg border border-claro bg-white"
    />
  );
}