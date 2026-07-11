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
 *   baseline → EXTERIOR: tu ritmo ANTES de esta ventana. El listón.
 *   current  → INTERIOR: lo que llevas en la ventana actual.
 *
 * Mantener el ritmo ⇒ current ≈ baseline ⇒ los polígonos COINCIDEN. Donde aflojas,
 * el interior se hunde; donde aprietas, sobresale (y eso es honesto: no se capa,
 * la escala del gráfico se expande para acomodarlo).
 *
 * DOS SUTILEZAS QUE PARECEN DETALLES Y NO LO SON:
 *
 * 1) El baseline EXCLUYE la ventana actual (del numerador Y del denominador). Si
 *    no, la semana que mides contamina la vara con la que la mides: abandonar un
 *    eje baja su total, baja su media, y la abolladura sale más pequeña de lo que
 *    es. Excluyéndola, un ritmo constante sigue dando baseline == current exacto
 *    (180 pts en 9 ventanas previas = 20/ventana = los 20 de esta), pero ahora la
 *    comparación no se muerde la cola.
 *
 * 2) La antigüedad se mide POR DIMENSIÓN, no por usuario. El "ritmo en Calma" hay
 *    que medirlo sobre el tiempo que llevas con Calma. Con la antigüedad de la
 *    cuenta, empezar Calma hoy tras un año de uso daría un ritmo ridículo, y
 *    abandonar un eje adoptado hace dos semanas no produciría abolladura ninguna.
 *
 * El divisor es la ventana, no un 7 literal: si RADAR_WINDOW_DAYS sube a 14, el
 * exterior pasa a ser "producción media por quincena" y sigue siendo comparable
 * con el interior. Con un 7 fijo, cambiar la ventana rompería la comparación.
 *
 * Una dimensión estrenada dentro de la ventana no tiene pasado: baseline 0 y el
 * vértice sobresale. Correcto — no tenías ritmo del que desviarte, lo estás
 * creando.
 *
 * `level` va aparte del radar: es la capa de PROGRESIÓN (acumulado de siempre,
 * nunca baja, no se estanca) y se pinta como insignia en cada vértice. El radar
 * es la capa de COMPARACIÓN. Son dos preguntas distintas.
 */
function computeRadar({ totals, windowTotals, firstDays, today }) {
  return RESOURCE_TYPE_KEYS.map((key) => {
    const total = totals[key] || 0;
    const current = windowTotals[key] || 0;
    const prior = total - current; // puntos ANTERIORES a la ventana actual

    // Ventanas de historia previa de ESTA dimensión, con suelo de 1: por debajo
    // de una ventana no hay ritmo que estimar, y dividir por una fracción
    // diminuta inflaría la media hasta lo absurdo.
    const firstDay = firstDays[key];
    const daysLived = firstDay ? diffDays(today, firstDay) + 1 : 0;
    const priorWindows = Math.max((daysLived - RADAR_WINDOW_DAYS) / RADAR_WINDOW_DAYS, 1);

    return {
      key,
      total,
      level: axisLevel(total),
      baseline: prior / priorWindows,
      current,
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
    firstDays: resourceEventRepository.firstDayByDimension(userId),
    today,
  });
}

module.exports = { award, processLog, totalsForUser, computeRadar, radarForUser };
