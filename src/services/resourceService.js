'use strict';

const resourceEventRepository = require('../models/resourceEventRepository');
const withTransaction = require('../database/withTransaction');
const { RESOURCE_RULES, RESOURCE_TYPE_KEYS } = require('../config/constants');
const { isProgress } = require('../utils/logProgress');

/**
 * Otorga recursos de forma idempotente (índice único user+resource+reason+
 * source+day). Devuelve la cantidad otorgada (0 si ya existía). Nunca resta.
 */
function award(userId, resourceType, amount, reason, sourceType, sourceId, day) {
  if (amount <= 0) return 0;
  const inserted = resourceEventRepository.insertIfNew({
    user_id: userId,
    resource_type: resourceType,
    amount,
    reason,
    source_type: sourceType,
    source_id: sourceId,
    day,
  });
  return inserted ? amount : 0;
}

/**
 * Genera el recurso del hábito al registrar un avance: +ON_PROGRESS por avance
 * real y +ON_COMPLETE adicional al alcanzar la meta diaria (completar da la
 * suma). Idempotente por día. Todo se acumula en el ledger del usuario. No
 * devuelve nada al cliente (no altera los toasts).
 */
function processLog({ habit, log, date }) {
  if (!habit || !habit.resource_type) return;
  withTransaction(() => {
    if (isProgress(log)) {
      award(habit.user_id, habit.resource_type, RESOURCE_RULES.ON_PROGRESS, 'resource_progress', 'habit', habit.id, date);
      if (log.completed) {
        award(habit.user_id, habit.resource_type, RESOURCE_RULES.ON_COMPLETE, 'resource_complete', 'habit', habit.id, date);
      }
    }
  });
}

/**
 * Totales del usuario por recurso: objeto con las 4 claves de recurso, cada una
 * con su total acumulado (0 por defecto). Para la vitrina del perfil.
 */
function totalsForUser(userId) {
  const totals = Object.fromEntries(RESOURCE_TYPE_KEYS.map((k) => [k, 0]));
  for (const row of resourceEventRepository.totalsByUser(userId)) {
    if (row.resource_type in totals) totals[row.resource_type] = row.total;
  }
  return totals;
}

module.exports = { award, processLog, totalsForUser };
