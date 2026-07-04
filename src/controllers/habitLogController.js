'use strict';

const habitLogService = require('../services/habitLogService');
const dashboardService = require('../services/dashboardService');
const { logSchema } = require('../validators/logValidators');
const asyncHandler = require('../utils/asyncHandler');

/** POST /api/habits/:id/log — registra un avance del día. */
const log = asyncHandler(async (req, res) => {
  const input = logSchema.parse(req.body);
  const habitId = Number(req.params.id);
  const { log: logRow, streak, date } = habitLogService.log(
    habitId,
    req.user.id,
    req.user.timezone,
    input
  );
  const dayProgress = dashboardService.dayProgress(req.user.id, date);

  res.json({
    habitId,
    value: logRow ? logRow.value_num : 0,
    valueText: logRow ? logRow.value_text : null,
    completed: logRow ? Boolean(logRow.completed) : false,
    streak: { current: streak.current_streak, longest: streak.longest_streak },
    dayProgress,
  });
});

module.exports = { log };
