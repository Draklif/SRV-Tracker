'use strict';

/** Utilidades de presentación (fechas y valores de hábitos) en español. */

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-07-04' → '4 jul'. */
function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Tiempo relativo desde un timestamp UTC de SQLite ('YYYY-MM-DD HH:MM:SS'). */
function timeAgo(utcTimestamp) {
  const then = new Date(utcTimestamp.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

/** Valor de un log según el tipo del hábito, listo para mostrar. */
function formatLogValue(habit, log) {
  if (!log) return '—';
  switch (habit.type) {
    case 'checkbox':
      return log.completed ? '✓ Hecho' : '—';
    case 'quantity':
    case 'duration':
      return `${log.value_num ?? 0}${habit.unit ? ' ' + habit.unit : ''}`;
    case 'scale': {
      const max = (habit.settings && habit.settings.scaleMax) || '';
      return `${log.value_num}${max ? ' / ' + max : ''}`;
    }
    case 'numeric':
      return `${log.value_num}${habit.unit ? ' ' + habit.unit : ''}`;
    case 'text':
      return log.value_text || '—';
    default:
      return '—';
  }
}

module.exports = { shortDate, timeAgo, formatLogValue, MONTHS };
