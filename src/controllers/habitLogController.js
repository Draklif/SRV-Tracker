'use strict';

const habitLogService = require('../services/habitLogService');
const dashboardService = require('../services/dashboardService');
const { logSchema } = require('../validators/logValidators');
const asyncHandler = require('../utils/asyncHandler');

/** POST /api/habits/:id/log — registra un avance del día. */
const log = asyncHandler(async (req, res) => {
  const input = logSchema.parse(req.body);
  const habitId = Number(req.params.id);
  const { log: logRow, streak, date, rewards } = habitLogService.log(habitId, req.user, input);
  const dayProgress = dashboardService.dayProgress(req.user.id, date);

  res.json({
    habitId,
    date, // fecha local del registro: el cliente recarga si su render es de otro día
    value: logRow ? logRow.value_num : 0,
    valueText: logRow ? logRow.value_text : null,
    completed: logRow ? Boolean(logRow.completed) : false,
    streak: { current: streak.current_streak, longest: streak.longest_streak },
    dayProgress,
    rewards, // XP, subida de nivel y logros para los toasts (null si no aplica)
  });
});

module.exports = { log };
