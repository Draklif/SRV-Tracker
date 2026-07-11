'use strict';

const resourceEventRepository = require('../models/resourceEventRepository');
const withTransaction = require('../database/withTransaction');
const { RESOURCE_RULES, RESOURCE_TYPE_KEYS } = require('../config/constants');
const { isProgress } = require('../utils/logProgress');

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
 * Totales del usuario por dimensión: objeto con las 6 claves, cada una con su
 * total acumulado (0 por defecto). Para la vitrina del perfil.
 */
function totalsForUser(userId) {
  const totals = Object.fromEntries(RESOURCE_TYPE_KEYS.map((k) => [k, 0]));
  for (const row of resourceEventRepository.totalsByUser(userId)) {
    if (row.resource_type in totals) totals[row.resource_type] = row.total;
  }
  return totals;
}

module.exports = { award, processLog, totalsForUser };
