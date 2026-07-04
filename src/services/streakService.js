'use strict';

const streakRepository = require('../models/streakRepository');
const habitLogRepository = require('../models/habitLogRepository');
const { diffDays, previousDay } = require('../utils/date');

/**
 * Calcula racha actual y mejor racha a partir de las fechas completadas.
 * Función PURA (sin BD) para poder testearla con facilidad.
 *
 * Filosofía anti-culpa: si el último día completado no es hoy ni ayer, la racha
 * actual es 0 (se reinicia sin castigo); la mejor racha nunca disminuye.
 *
 * @param {string[]} dates  Fechas 'YYYY-MM-DD' con el hábito completado.
 * @param {string} today    Fecha local de hoy 'YYYY-MM-DD'.
 */
function computeStreak(dates, today) {
  if (!dates.length) return { current: 0, longest: 0, last: null };

  const sorted = [...new Set(dates)].sort();

  // Mejor racha: la corrida consecutiva más larga en el histórico.
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // Racha actual: corrida que termina en el último día, solo si sigue "viva"
  // (el último día completado es hoy o ayer).
  const latest = sorted[sorted.length - 1];
  let current = 0;
  const gap = diffDays(today, latest);
  if (gap >= 0 && gap <= 1) {
    const set = new Set(sorted);
    let d = latest;
    while (set.has(d)) {
      current += 1;
      d = previousDay(d);
    }
  }

  return { current, longest, last: latest };
}

/**
 * Recomputa y persiste la racha de un hábito desde su histórico de logs.
 * La mejor racha almacenada nunca decrece (se preserva aunque se edite un día).
 */
function recompute(habitId, today) {
  const dates = habitLogRepository.completedDates(habitId);
  const { current, longest, last } = computeStreak(dates, today);
  const existing = streakRepository.get(habitId);
  const bestEver = Math.max(longest, current, existing ? existing.longest_streak : 0);

  return streakRepository.upsert({
    habit_id: habitId,
    current_streak: current,
    longest_streak: bestEver,
    last_completed_date: last,
  });
}

function findByUser(userId) {
  return streakRepository.findByUser(userId);
}

module.exports = { computeStreak, recompute, findByUser };
