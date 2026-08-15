// Utilidades de notificaciones push (Web Push / VAPID) con el service worker.
import { fetchApi } from './api.js';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
};

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const getPushSubscription = async () => {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
};

// Suscribe el dispositivo del usuario al push y lo guarda en el backend.
export const subscribeToPush = async () => {
  if (!isPushSupported()) throw new Error('Las notificaciones no están soportadas en este navegador.');
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await saveSubscription(existing);
    return existing;
  }
  const { vapidPublicKey } = await fetchApi('/push/config');
  if (!vapidPublicKey) throw new Error('Las notificaciones aún no están configuradas.');
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  await saveSubscription(subscription);
  return subscription;
};

const saveSubscription = async (subscription) => {
  await fetchApi('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: base64UrlToBase64(subscription.getKey('p256dh')),
        auth: base64UrlToBase64(subscription.getKey('auth')),
      },
    }),
  });
};

// Cancela la suscripción push y la elimina del backend.
export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      try {
        await fetchApi('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: existing.endpoint }) });
      } catch (e) {
        // Si el backend no responde, seguimos y cancelamos la suscripción local
      }
      await existing.unsubscribe();
    }
  } catch (e) {
    // Silencioso: no hay suscripción activa
  }
};

const base64UrlToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
