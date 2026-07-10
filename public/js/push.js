'use strict';

/**
 * Web Push en el cliente.
 *
 * 1) En cualquier página: registra el service worker (necesario para el PWA y
 *    para recibir notificaciones en segundo plano).
 * 2) En el perfil (si existen los controles): gestiona el opt-in — pedir permiso,
 *    suscribirse al PushManager y guardar/borrar la suscripción en el servidor.
 */
(function () {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Registro del service worker (silencioso; no bloquea la página).
  let swReadyPromise = null;
  function ensureServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('SW no soportado'));
    if (!swReadyPromise) {
      swReadyPromise = navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready);
    }
    return swReadyPromise;
  }

  if ('serviceWorker' in navigator) {
    // Registrar cuanto antes, en todas las páginas.
    ensureServiceWorker().catch(() => {});
  }

  // A partir de aquí, solo si estamos en la pantalla con los controles de push.
  const root = document.getElementById('push-settings');
  if (!root) return;

  const btnEnable = document.getElementById('push-enable');
  const btnDisable = document.getElementById('push-disable');
  const btnTest = document.getElementById('push-test');
  const statusEl = document.getElementById('push-status');

  const vapidKey = document
    .querySelector('meta[name="vapid-public-key"]')
    ?.getAttribute('content');

  function toast(msg, type) {
    if (window.toast) window.toast.show(msg, { type: type || 'info', duration: 2200 });
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  /** Convierte la clave pública VAPID (base64url) al formato que espera el navegador. */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  /** Refleja en la UI el estado actual (soporte, permiso, suscripción). */
  async function refresh() {
    if (!supported) {
      setStatus(
        'Tu navegador no soporta notificaciones aquí. En iPhone: añade la app a la pantalla de inicio y ábrela desde ahí.'
      );
      if (btnEnable) btnEnable.disabled = true;
      if (btnDisable) btnDisable.hidden = true;
      if (btnTest) btnTest.hidden = true;
      return;
    }

    if (!vapidKey) {
      setStatus('Las notificaciones no están configuradas en el servidor todavía.');
      if (btnEnable) btnEnable.disabled = true;
      if (btnDisable) btnDisable.hidden = true;
      if (btnTest) btnTest.hidden = true;
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('Bloqueaste las notificaciones en el navegador. Actívalas en los ajustes del sitio.');
      if (btnEnable) btnEnable.disabled = true;
      if (btnDisable) btnDisable.hidden = true;
      if (btnTest) btnTest.hidden = true;
      return;
    }

    const reg = await ensureServiceWorker().catch(() => null);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const subscribed = Boolean(sub);

    if (btnEnable) {
      btnEnable.hidden = subscribed;
      btnEnable.disabled = false;
    }
    if (btnDisable) btnDisable.hidden = !subscribed;
    if (btnTest) btnTest.hidden = !subscribed;
    setStatus(
      subscribed
        ? 'Notificaciones activadas en este dispositivo. Te avisaremos de tus hábitos pendientes.'
        : 'Recibe un recordatorio para no perder tus hábitos ni tu racha.'
    );
  }

  async function enable() {
    try {
      if (btnEnable) btnEnable.disabled = true;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast('Permiso de notificaciones no concedido.', 'info');
        await refresh();
        return;
      }

      const reg = await ensureServiceWorker();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await window.api.post('/api/push/subscribe', { subscription: sub.toJSON() });
      toast('¡Notificaciones activadas! 🔔', 'info');
    } catch (err) {
      toast(err.message || 'No se pudo activar. Inténtalo de nuevo.', 'error');
    } finally {
      await refresh();
    }
  }

  async function disable() {
    try {
      if (btnDisable) btnDisable.disabled = true;
      const reg = await ensureServiceWorker();
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub ? sub.endpoint : null;
      if (sub) await sub.unsubscribe();
      await window.api.post('/api/push/unsubscribe', endpoint ? { endpoint } : {});
      toast('Notificaciones desactivadas en este dispositivo.', 'info');
    } catch (err) {
      toast(err.message || 'No se pudo desactivar.', 'error');
    } finally {
      if (btnDisable) btnDisable.disabled = false;
      await refresh();
    }
  }

  async function sendTest() {
    try {
      if (btnTest) btnTest.disabled = true;
      await window.api.post('/api/push/test', {});
      toast('Prueba enviada. Debería llegarte en un momento 📲', 'info');
    } catch (err) {
      toast(err.message || 'No se pudo enviar la prueba.', 'error');
    } finally {
      if (btnTest) btnTest.disabled = false;
    }
  }

  if (btnEnable) btnEnable.addEventListener('click', enable);
  if (btnDisable) btnDisable.addEventListener('click', disable);
  if (btnTest) btnTest.addEventListener('click', sendTest);

  refresh();
})();
