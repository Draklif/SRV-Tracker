'use strict';

const pushService = require('../services/pushService');
const pushSubscriptionRepository = require('../models/pushSubscriptionRepository');
const userRepository = require('../models/userRepository');
const asyncHandler = require('../utils/asyncHandler');

/** Extrae y valida una suscripción Web Push del cuerpo de la petición. */
function parseSubscription(body) {
  const sub = body && body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys) return null;
  const { p256dh, auth } = sub.keys;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  return { endpoint: sub.endpoint, p256dh, auth };
}

/** POST /api/push/subscribe — guarda la suscripción del navegador y activa el opt-in. */
const subscribe = asyncHandler(async (req, res) => {
  const sub = parseSubscription(req.body);
  if (!sub) return res.status(400).json({ error: 'Suscripción push no válida.' });

  pushSubscriptionRepository.save({
    userId: req.user.id,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    userAgent: req.get('user-agent') || null,
  });
  userRepository.setNotifyEnabled(req.user.id, true);

  return res.json({ ok: true });
});

/** POST /api/push/unsubscribe — borra la suscripción (una o todas) y ajusta el opt-in. */
const unsubscribe = asyncHandler(async (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (endpoint) {
    pushSubscriptionRepository.deleteForUser(req.user.id, endpoint);
  } else {
    pushSubscriptionRepository.deleteAllForUser(req.user.id);
  }

  if (pushSubscriptionRepository.countForUser(req.user.id) === 0) {
    userRepository.setNotifyEnabled(req.user.id, false);
  }

  return res.json({ ok: true });
});

/** POST /api/push/test — envío de prueba al propio usuario. */
const test = asyncHandler(async (req, res) => {
  if (!pushService.isConfigured()) {
    return res.status(503).json({ error: 'Las notificaciones no están configuradas en el servidor.' });
  }

  const sent = await pushService.sendToUser(req.user.id, {
    title: '¡Funciona! 🎉',
    body: 'Así se verán tus recordatorios de hábitos.',
    url: '/',
    tag: 'test',
  });

  if (sent === 0) {
    return res.status(409).json({ error: 'No hay ningún dispositivo suscrito. Activa las notificaciones primero.' });
  }
  return res.json({ ok: true, sent });
});

module.exports = { subscribe, unsubscribe, test };
