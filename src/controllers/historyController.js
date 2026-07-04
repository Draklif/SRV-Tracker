'use strict';

const habitService = require('../services/habitService');
const statsService = require('../services/statsService');
const habitLogRepository = require('../models/habitLogRepository');
const { todayFor } = require('../utils/date');
const { shortDate, formatLogValue } = require('../utils/format');

/** GET /habits/:id/history — historial completo de un hábito. */
function page(req, res) {
  const habit = habitService.getOwned(Number(req.params.id), req.user.id);
  const today = todayFor(req.user.timezone);

  res.render('pages/habit-history', {
    title: `${habit.name} — historial`,
    habit,
    stats: statsService.summary(habit),
    heatmap: statsService.heatmap(habit, today),
    chart: statsService.chartSeries(habit, today),
    recent: habitLogRepository.findRecentByHabit(habit.id, 8),
    shortDate,
    formatLogValue,
  });
}

module.exports = { page };
