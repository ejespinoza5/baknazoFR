/**
 * La ubicación de quien usa la app, para "Cerca de ti" y para publicar.
 *
 * Se redondea a 2 decimales (unos 1,1 km) antes de usarla en cualquier sitio:
 * para saber qué hay cerca no hace falta la casa exacta de nadie, y un anuncio
 * publicado con coordenadas precisas señalaría el domicilio del vendedor.
 *
 * Se guarda en `sessionStorage` para no volver a pedir permiso en cada pantalla
 * de la misma visita; al cerrar la pestaña se olvida.
 */

export interface Punto {
  lat: number;
  lng: number;
}

const CLAVE = 'bkn:ubicacion';

const redondear = (n: number) => Math.round(n * 100) / 100;

export function ubicacionGuardada(): Punto | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const p = JSON.parse(crudo) as Punto;
    return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
  } catch {
    return null;
  }
}

/** Mensaje entendible para cada forma en que el navegador dice que no. */
function motivo(e: GeolocationPositionError | Error): string {
  if ('code' in e) {
    if (e.code === e.PERMISSION_DENIED) {
      return 'No diste permiso de ubicación. Actívalo en el candado de la barra de direcciones, o filtra por ciudad.';
    }
    if (e.code === e.TIMEOUT) return 'Tu ubicación tardó demasiado. Inténtalo otra vez.';
    return 'No pudimos saber dónde estás. Revisa que el GPS esté encendido.';
  }
  return e.message;
}

export function pedirUbicacion(): Promise<Punto> {
  const guardada = ubicacionGuardada();
  if (guardada) return Promise.resolve(guardada);

  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('Tu navegador no permite compartir la ubicación. Filtra por ciudad.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = { lat: redondear(pos.coords.latitude), lng: redondear(pos.coords.longitude) };
        try {
          sessionStorage.setItem(CLAVE, JSON.stringify(punto));
        } catch {
          /* sin almacenamiento se volverá a pedir; no es grave */
        }
        resolver(punto);
      },
      (e) => rechazar(new Error(motivo(e))),
      // Precisión baja: basta la antena o el wifi, que responde en segundos.
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 }
    );
  });
}
