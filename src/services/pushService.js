'use strict';

const webpush = require('web-push');

const config = require('../config');
const pushSubscriptionRepository = require('../models/pushSubscriptionRepository');

/**
 * Envío de notificaciones Web Push. Envuelve la librería `web-push` y las
 * suscripciones guardadas por usuario.
 *
 * Las claves VAPID se leen de config.push (variables de entorno). Si no están
 * configuradas, el envío queda deshabilitado silenciosamente: la app sigue
 * funcionando, solo que no manda notificaciones.
 */

const enabled = Boolean(config.push.vapidPublic && config.push.vapidPrivate);

if (enabled) {
  webpush.setVapidDetails(
    config.push.vapidSubject,
    config.push.vapidPublic,
    config.push.vapidPrivate
  );
} else {
  console.warn(
    '[push] VAPID sin configurar (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Notificaciones deshabilitadas.'
  );
}

function isConfigured() {
  return enabled;
}

/** Reconstruye el objeto de suscripción que espera `web-push` desde la fila DB. */
function toWebPushSubscription(row) {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

/**
 * Envía un payload a todas las suscripciones de un usuario. Fire-and-forget:
 * los errores se registran y, si el endpoint ya no existe (404/410), se borra la
 * suscripción muerta. Devuelve el número de envíos exitosos.
 */
async function sendToUser(userId, payload) {
  if (!enabled) return 0;

  const subs = pushSubscriptionRepository.findByUser(userId);
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(row), body);
        sent += 1;
      } catch (err) {
        const status = err && err.statusCode;
        if (status === 404 || status === 410) {
          // Suscripción caducada/revocada: la limpiamos.
          pushSubscriptionRepository.deleteByEndpoint(row.endpoint);
        } else {
          console.error(`[push] Error enviando a user ${userId}:`, status || err.message);
        }
      }
    })
  );

  return sent;
}

module.exports = { isConfigured, sendToUser };
