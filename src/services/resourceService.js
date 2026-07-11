'use strict';

const resourceEventRepository = require('../models/resourceEventRepository');
const withTransaction = require('../database/withTransaction');
const { RESOURCE_RULES, RESOURCE_TYPE_KEYS, RADAR_WINDOW_DAYS } = require('../config/constants');
const { isProgress } = require('../utils/logProgress');
const { axisLevel } = require('../utils/level');
const { todayFor, addDays, diffDays } = require('../utils/date');

/**
 * Otorga puntos de forma idempotente (índice único user+reason+source+day).
 * Devuelve la cantidad otorgada (0 si ya existía). Nunca resta.
 *
 * `resourceType` va a NULL cuando la fuente es un hábito: la dimensión se deduce
 * del hábito al leer, no se copia aquí. Solo se pasa para fuentes que no sean
 * hábitos (aún no hay ninguna).
 */
function award(userId, resourceType, amount, reason, sourceType, sourceId, day) {
  if (amount <= 0) return 0;
  const inserted = resourceEventRepository.insertIfNew({
    user_id: userId,
    resource_type: sourceType === 'habit' ? null : resourceType,
    amount,
    reason,
    source_type: sourceType,
    source_id: sourceId,
    day,
  });
  return inserted ? amount : 0;
}

/**
 * Genera los puntos del hábito al registrar un avance: +ON_PROGRESS por avance
 * real y +ON_COMPLETE adicional al alcanzar la meta diaria (completar da la
 * suma). Idempotente por día. No devuelve nada al cliente (no altera los toasts).
 *
 * En qué dimensión caen no se decide aquí: se deriva del hábito al leer, así que
 * si el usuario reetiqueta el hábito, estos puntos se mudan con él.
 */
function processLog({ habit, log, date }) {
  if (!habit) return;
  withTransaction(() => {
    if (isProgress(log)) {
      award(habit.user_id, null, RESOURCE_RULES.ON_PROGRESS, 'resource_progress', 'habit', habit.id, date);
      if (log.completed) {
        award(habit.user_id, null, RESOURCE_RULES.ON_COMPLETE, 'resource_complete', 'habit', habit.id, date);
      }
    }
  });
}

/**
 * Filas [{ resource_type, total }] → objeto con las 6 claves (0 por defecto).
 * Descarta dimensiones desconocidas (p. ej. eventos huérfanos sin hábito).
 */
function byDimension(rows) {
  const totals = Object.fromEntries(RESOURCE_TYPE_KEYS.map((k) => [k, 0]));
  for (const row of rows) {
    if (row.resource_type in totals) totals[row.resource_type] = row.total;
  }
  return totals;
}

/**
 * Totales del usuario por dimensión: objeto con las 6 claves, cada una con su
 * total acumulado (0 por defecto).
 */
function totalsForUser(userId) {
  return byDimension(resourceEventRepository.totalsByUser(userId));
}

/**
 * Matemática del radar. FUNCIÓN PURA (sin BD) para poder testearla entera.
 *
 * Los dos polígonos se miden en LA MISMA UNIDAD —puntos por ventana—, y por eso
 * son directamente comparables sin normalizar nada:
 *
 *   baseline = total / ventanas_vividas   → el polígono EXTERIOR: tu ritmo habitual
 *   current  = puntos de la ventana actual → el polígono INTERIOR: cómo vas ahora
 *
 * Mantener tu ritmo ⇒ current ≈ baseline ⇒ los polígonos COINCIDEN. Donde aflojas,
 * el interior se hunde; donde aprietas, sobresale (y eso es honesto: no se capa,
 * la escala del gráfico se expande para acomodarlo).
 *
 * El divisor es la ventana, no un 7 literal: si RADAR_WINDOW_DAYS sube a 14, el
 * exterior pasa a ser "producción media por quincena" y sigue siendo comparable
 * con el interior. Si fuera un 7 fijo, cambiar la ventana rompería la comparación.
 *
 * `ventanas_vividas` tiene SUELO DE 1. Sin él, un usuario de dos días tendría una
 * "media semanal" inflada (sus 6 puntos ÷ 0.28 semanas = 21) y su semana real se
 * vería como un socavón. Con el suelo, un usuario nuevo tiene baseline == current
 * y su hexágono nace sólido, que es lo correcto: aún no tiene un ritmo del que
 * desviarse.
 *
 * `level` va aparte del radar: es la capa de PROGRESIÓN (acumulado de siempre,
 * nunca baja, no se estanca) y se pinta como insignia en cada vértice. El radar
 * es la capa de COMPARACIÓN. Son dos preguntas distintas.
 */
function computeRadar({ totals, windowTotals, firstDay, today }) {
  const daysLived = firstDay ? diffDays(today, firstDay) + 1 : 0;
  const windowsLived = Math.max(daysLived / RADAR_WINDOW_DAYS, 1);

  return RESOURCE_TYPE_KEYS.map((key) => {
    const total = totals[key] || 0;
    return {
      key,
      total,
      level: axisLevel(total),
      baseline: total / windowsLived,
      current: windowTotals[key] || 0,
    };
  });
}

/** El radar de un usuario: lee el ledger y aplica computeRadar. */
function radarForUser(userId, timezone) {
  const today = todayFor(timezone);
  // Ventana RODANTE que incluye hoy: [hoy-6, hoy] son 7 días.
  const since = addDays(today, -(RADAR_WINDOW_DAYS - 1));
  return computeRadar({
    totals: byDimension(resourceEventRepository.totalsByUser(userId)),
    windowTotals: byDimension(resourceEventRepository.totalsByUserSince(userId, since)),
    firstDay: resourceEventRepository.firstDay(userId),
    today,
  });
}

module.exports = { award, processLog, totalsForUser, computeRadar, radarForUser };
