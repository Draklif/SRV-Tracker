'use strict';

const habitLogRepository = require('../models/habitLogRepository');
const streakRepository = require('../models/streakRepository');
const { addDays, diffDays } = require('../utils/date');
const { MONTHS } = require('../utils/format');

const HEATMAP_WEEKS = 20;
const CHART_DAYS = 30;

/** Índice lunes-primero (0=lunes … 6=domingo) de una fecha 'YYYY-MM-DD'. */
function mondayIndex(dateStr) {
  return (new Date(dateStr + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

/** Nivel de intensidad 0–4 de un log según el tipo de hábito. */
function intensity(habit, log) {
  if (!log) return 0;
  const settings = habit.settings || {};
  switch (habit.type) {
    case 'quantity':
    case 'duration': {
      const target = habit.target_daily;
      const v = log.value_num || 0;
      if (!target) return v > 0 ? 4 : 0;
      const r = v / target;
      if (r >= 1) return 4;
      if (r >= 0.66) return 3;
      if (r >= 0.33) return 2;
      return v > 0 ? 1 : 0;
    }
    case 'scale': {
      const max = settings.scaleMax || 5;
      const r = (log.value_num || 0) / max;
      if (r >= 0.99) return 4;
      if (r >= 0.7) return 3;
      if (r >= 0.4) return 2;
      return 1;
    }
    default:
      // checkbox, numeric, text: registrado/completado o nada.
      return log.completed ? 4 : log.value_num != null || log.value_text ? 2 : 0;
  }
}

/**
 * Heatmap tipo mapa de commits: columnas = semanas (lunes arriba), celdas con
 * nivel 0–4. Devuelve también etiquetas de mes por columna.
 */
function heatmap(habit, today) {
  const start = addDays(addDays(today, -mondayIndex(today)), -(HEATMAP_WEEKS - 1) * 7);
  const logs = habitLogRepository.findByHabitSince(habit.id, start);
  const byDate = new Map(logs.map((l) => [l.log_date, l]));

  const weeks = [];
  const monthLabels = [];
  for (let w = 0; w < HEATMAP_WEEKS; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, w * 7 + d);
      const future = diffDays(date, today) > 0;
      days.push({ date, future, level: future ? 0 : intensity(habit, byDate.get(date)) });
      if (date.endsWith('-01')) {
        monthLabels.push({ week: w, label: MONTHS[Number(date.slice(5, 7)) - 1] });
      }
    }
    weeks.push(days);
  }
  return { weeks, monthLabels };
}

/** Serie de los últimos 30 días para la gráfica (tipos con valor numérico). */
function chartSeries(habit, today) {
  if (!['quantity', 'duration', 'scale', 'numeric'].includes(habit.type)) return null;

  const start = addDays(today, -(CHART_DAYS - 1));
  const logs = habitLogRepository.findByHabitSince(habit.id, start);
  const byDate = new Map(logs.map((l) => [l.log_date, l.value_num]));

  const points = [];
  let max = 0;
  let min = Infinity;
  for (let i = 0; i < CHART_DAYS; i += 1) {
    const date = addDays(start, i);
    const value = byDate.has(date) ? byDate.get(date) : null;
    if (value != null) {
      if (value > max) max = value;
      if (value < min) min = value;
    }
    points.push({ date, value });
  }
  if (min === Infinity) return null; // sin datos aún

  // Barras para acumulables; línea para valores puntuales.
  const style = habit.type === 'quantity' || habit.type === 'duration' ? 'bars' : 'line';
  const floor = style === 'bars' ? 0 : Math.max(0, min - (max - min) * 0.2);
  return { points, max, min, floor, style, target: habit.target_daily };
}

/** Resumen de estadísticas del hábito. */
function summary(habit) {
  const raw = habitLogRepository.statsByHabit(habit.id);
  const streak = streakRepository.get(habit.id) || { current_streak: 0, longest_streak: 0 };
  const hasValue = ['quantity', 'duration', 'scale', 'numeric'].includes(habit.type);
  return {
    totalLogs: raw.total || 0,
    done: raw.done || 0,
    average: hasValue && raw.avg_value != null ? Math.round(raw.avg_value * 10) / 10 : null,
    record: hasValue && raw.max_value != null ? raw.max_value : null,
    current: streak.current_streak,
    longest: streak.longest_streak,
  };
}

module.exports = { heatmap, chartSeries, summary, intensity };
