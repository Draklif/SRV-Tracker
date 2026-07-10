'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { localClock } = require('../utils/date');
const userRepository = require('../models/userRepository');
const notificationLog = require('../models/notificationLogRepository');
const dashboardService = require('./dashboardService');
const pushService = require('./pushService');
const messages = require('../config/notificationMessages');

/**
 * Scheduler de recordatorios de hábitos. Un único `setInterval` en proceso
 * (el despliegue es de un solo contenedor) que cada 30s revisa a los usuarios
 * con notificaciones activas y, según su hora local, les envía:
 *   - "reminder": a la hora que eligieron, si tienen hábitos obligatorios sin
 *      completar hoy.
 *   - "streak_guard": a la hora de guardia (config.push.streakGuardHour), si
 *      además alguno de esos hábitos tiene una racha activa en juego.
 *
 * El `notification_log` evita repetir el mismo aviso más de una vez por día local.
 */

const TICK_MS = 30 * 1000;
let timer = null;

/** Envía un aviso a un usuario y lo registra para no repetirlo hoy. */
async function fire(user, kind, date, pendingCount) {
  const { title, body } = messages.pick(kind, pendingCount);
  // Registramos ANTES de enviar: aunque el envío tarde, el próximo tick (a 30s)
  // no volverá a dispararlo. El envío es best-effort.
  notificationLog.markSent(user.id, kind, date);
  try {
    await pushService.sendToUser(user.id, { title, body, url: '/', tag: kind });
  } catch (err) {
    logger.error(`[reminder] Error enviando ${kind} a user ${user.id}: ${err.message}`);
  }
}

/** Evalúa a un usuario en el instante actual y dispara lo que corresponda. */
async function evaluateUser(user) {
  const clock = localClock(user.timezone);
  const wantsReminder = clock.hhmm === user.notify_reminder_time;
  const wantsStreakGuard =
    user.notify_streak_guard && clock.hour === config.push.streakGuardHour;

  // Sin nada que evaluar en este minuto: salimos antes de tocar la BD de hábitos.
  if (!wantsReminder && !wantsStreakGuard) return;

  const summary = dashboardService.reminderSummary(user);
  if (summary.pendingCount === 0) return; // todo hecho: no molestamos.

  const date = summary.today;

  if (wantsStreakGuard && summary.atRisk && !notificationLog.wasSent(user.id, 'streak_guard', date)) {
    await fire(user, 'streak_guard', date, summary.pendingCount);
    return; // el aviso de racha ya cubre el recordatorio en ese minuto.
  }

  if (wantsReminder && !notificationLog.wasSent(user.id, 'reminder', date)) {
    await fire(user, 'reminder', date, summary.pendingCount);
  }
}

async function tick() {
  try {
    const users = userRepository.listNotifiable();
    for (const user of users) {
      try {
        await evaluateUser(user);
      } catch (err) {
        logger.error(`[reminder] Fallo evaluando user ${user.id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`[reminder] Fallo en el tick: ${err.message}`);
  }
}

/** Arranca el scheduler (idempotente). No hace nada si el push no está configurado. */
function start() {
  if (timer) return;
  if (!pushService.isConfigured()) {
    logger.info('[reminder] Scheduler inactivo: Web Push sin configurar (VAPID).');
    return;
  }
  timer = setInterval(tick, TICK_MS);
  timer.unref(); // no impedir que el proceso cierre.
  logger.info('[reminder] Scheduler de recordatorios activo (cada 30s).');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, evaluateUser };
