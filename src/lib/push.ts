/**
 * Notificaciones push con Firebase Cloud Messaging.
 *
 * - **Solo con una acción explícita**: el permiso se pide al pulsar "Activar",
 *   nunca al entrar a la app.
 * - **El SDK de Firebase se carga bajo demanda**: quien no activa el push no lo
 *   descarga.
 * - **La configuración web de Firebase no es secreta** (identifica el proyecto
 *   y viaja en todo cliente). Lo privado —la cuenta de servicio que envía— vive
 *   solo en el backend.
 * - El token se guarda en este navegador para poder quitarlo del servidor al
 *   desactivar o al cerrar sesión: así la siguiente cuenta que entre aquí no
 *   recibe push de la anterior.
 */

import { eliminarDispositivoPush, registrarDispositivoPush } from '../api/notificaciones';

const CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const RUTA_SW = '/sw-notificaciones.js';
const CLAVE_TOKEN = 'bkn:push-token';

export type EstadoPush = 'no-soportado' | 'no-configurado' | 'bloqueado' | 'apagado' | 'activo';

const configurado = Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.messagingSenderId && CONFIG.appId && VAPID);

function soportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function tokenGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

function guardarToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento: el push sigue funcionando hasta cerrar el navegador.
  }
}

export function estadoPush(): EstadoPush {
  if (!soportado()) return 'no-soportado';
  if (!configurado) return 'no-configurado';
  if (Notification.permission === 'denied') return 'bloqueado';
  return Notification.permission === 'granted' && tokenGuardado() ? 'activo' : 'apagado';
}

async function firebase() {
  const [{ initializeApp, getApps }, mensajeria] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  if (!(await mensajeria.isSupported())) throw new Error('Este navegador no admite notificaciones push.');
  const app = getApps()[0] ?? initializeApp(CONFIG);
  return { mensajeria, messaging: mensajeria.getMessaging(app) };
}

async function obtenerToken(): Promise<string> {
  const registro = await navigator.serviceWorker.register(RUTA_SW, { scope: '/' });
  await navigator.serviceWorker.ready;
  const { mensajeria, messaging } = await firebase();
  const token = await mensajeria.getToken(messaging, { vapidKey: VAPID, serviceWorkerRegistration: registro });
  if (!token) throw new Error('No se pudo activar el push en este navegador.');
  return token;
}

/** Pide permiso y registra este navegador. Llamar SOLO desde un clic. */
export async function activarPush(): Promise<void> {
  if (!soportado()) throw new Error('Este navegador no admite notificaciones push.');
  if (!configurado) throw new Error('Las notificaciones push todavía no están configuradas.');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error(
      permiso === 'denied'
        ? 'Bloqueaste las notificaciones. Actívalas desde el candado de la barra de direcciones.'
        : 'No se activaron: el navegador no recibió el permiso.'
    );
  }
  const token = await obtenerToken();
  await registrarDispositivoPush(token);
  guardarToken(token);
}

/** Deja de recibir push en este navegador. */
export async function desactivarPush(): Promise<void> {
  const token = tokenGuardado();
  guardarToken(null);
  if (token) await eliminarDispositivoPush(token).catch(() => undefined);
  try {
    const { mensajeria, messaging } = await firebase();
    await mensajeria.deleteToken(messaging);
  } catch {
    // Si Firebase no carga, el token ya no está en el servidor: no llega nada.
  }
}

/**
 * Al abrir la app con sesión: FCM rota los tokens de vez en cuando. Si el push
 * sigue activo aquí, se pide el actual y se vuelve a registrar. No pide
 * permisos: solo actúa si ya estaban dados.
 */
export async function refrescarPush(): Promise<void> {
  if (estadoPush() !== 'activo') return;
  try {
    const token = await obtenerToken();
    await registrarDispositivoPush(token);
    guardarToken(token);
  } catch {
    // Sin red o sin Firebase: se intenta en la próxima apertura.
  }
}

/**
 * Un aviso del sistema con la pestaña en segundo plano (la app sigue
 * conectada, así que el servidor no manda push). Va por el service worker si
 * está registrado —en Android Chrome `new Notification` no existe— y, si no,
 * por la API directa. Sin permiso concedido, no hace nada.
 */
export async function mostrarAvisoDelSistema(aviso: {
  titulo: string;
  texto: string;
  ruta: string;
  etiqueta: string;
  silencio: boolean;
  alAbrir: () => void;
}): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opciones = { body: aviso.texto, tag: aviso.etiqueta, silent: aviso.silencio, icon: '/favicon-192.png', badge: '/badge-96.png' };
  try {
    const registro = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
    if (registro) {
      // El clic lo atiende el service worker y avisa a la app para navegar.
      await registro.showNotification(aviso.titulo, { ...opciones, data: { url: aviso.ruta } });
      return;
    }
    const n = new Notification(aviso.titulo, opciones);
    n.onclick = () => {
      window.focus();
      aviso.alAbrir();
      n.close();
    };
  } catch {
    // Sin soporte en este navegador: el aviso dentro de la app ya salió.
  }
}

/** Al cerrar sesión: este navegador deja de recibir push de la cuenta que sale. */
export async function olvidarDispositivo(): Promise<void> {
  const token = tokenGuardado();
  if (!token) return;
  guardarToken(null);
  await eliminarDispositivoPush(token).catch(() => undefined);
}
