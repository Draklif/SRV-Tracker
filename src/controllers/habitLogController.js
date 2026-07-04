'use strict';

const habitLogService = require('../services/habitLogService');
const dashboardService = require('../services/dashboardService');
const { logSchema } = require('../validators/logValidators');
const { getSchedule } = require('../utils/schedule');
const asyncHandler = require('../utils/asyncHandler');

/** POST /api/habits/:id/log — registra un avance del día. */
const log = asyncHandler(async (req, res) => {
  const input = logSchema.parse(req.body);
  const habitId = Number(req.params.id);
  const { habit, log: logRow, streak, date, rewards } = habitLogService.log(habitId, req.user, input);
  const dayProgress = dashboardService.dayProgress(req.user.id, date);

  // Progreso semanal (hábitos "N veces/semana") para refrescar el chip al instante.
  const schedule = getSchedule(habit);
  const week =
    schedule.type === 'weekly'
      ? { done: dashboardService.weekCompletedCount(habitId, date), target: schedule.timesPerWeek }
      : null;

  res.json({
    habitId,
    date, // fecha local del registro: el cliente recarga si su render es de otro día
    value: logRow ? logRow.value_num : 0,
    valueText: logRow ? logRow.value_text : null,
    completed: logRow ? Boolean(logRow.completed) : false,
    streak: { current: streak.current_streak, longest: streak.longest_streak },
    week, // { done, target } para weekly; null en el resto
    dayProgress,
    rewards, // XP, subida de nivel y logros para los toasts (null si no aplica)
  });
});

module.exports = { log };
