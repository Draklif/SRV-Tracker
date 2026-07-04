'use strict';

/**
 * Programación (frecuencia) de un hábito. Función PURA sobre el objeto
 * `settings.schedule` guardado en la BD. Un hábito puede ser:
 *   - daily:    todos los días (comportamiento por defecto e histórico).
 *   - weekdays: solo ciertos días de la semana (ISO 1=lunes … 7=domingo).
 *   - weekly:   una cuota de N veces por semana, cualquier día (flexible).
 * La semana empieza en lunes (ISO). Ver utils/date (isoWeekday, weekStart).
 */

const { isoWeekday } = require('./date');

const DAILY = Object.freeze({ type: 'daily' });

/** Nombres cortos de día para las etiquetas (índice ISO 1..7). */
const DAY_LABELS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Devuelve el schedule normalizado de un hábito; diario si no tiene. */
function getSchedule(habit) {
  const s = habit && habit.settings && habit.settings.schedule;
  if (!s || !s.type || s.type === 'daily') return DAILY;
  if (s.type === 'weekdays') {
    const days = Array.isArray(s.days) ? s.days : [];
    // 0 o 7 días equivale a diario: normalizamos para no tratar casos raros.
    if (!days.length || days.length >= 7) return DAILY;
    return { type: 'weekdays', days };
  }
  if (s.type === 'weekly') {
    const n = Number(s.timesPerWeek);
    if (!n || n >= 7) return DAILY;
    return { type: 'weekly', timesPerWeek: n };
  }
  return DAILY;
}

/** ¿El hábito "toca" (está programado) en esa fecha? Weekly toca cualquier día. */
function isScheduledOn(schedule, dateStr) {
  if (schedule.type === 'weekdays') return schedule.days.includes(isoWeekday(dateStr));
  return true; // daily y weekly están disponibles cualquier día
}

/**
 * ¿Cuenta el hábito para el "progreso del día" en esa fecha?
 * Weekly es flexible: nunca es obligatorio un día concreto, así que no bloquea
 * el día completo. Weekdays solo obliga en sus días. Daily siempre.
 */
function isRequiredOn(schedule, dateStr) {
  if (schedule.type === 'weekly') return false;
  return isScheduledOn(schedule, dateStr);
}

/** ¿Es un día de descanso (weekday no programado) para esa fecha? */
function isRestDay(schedule, dateStr) {
  return schedule.type === 'weekdays' && !isScheduledOn(schedule, dateStr);
}

/** Unidad de la racha según la programación (weekly cuenta semanas). */
function streakUnit(schedule) {
  return schedule.type === 'weekly' ? 'semanas' : 'días';
}

/** Etiqueta corta y legible de la frecuencia, para las tarjetas. */
function describe(schedule) {
  if (schedule.type === 'weekly') return `${schedule.timesPerWeek}× por semana`;
  if (schedule.type === 'weekdays') {
    const labels = [...schedule.days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]);
    if (labels.length === 2) return labels.join(' y ');
    return labels.join(', ');
  }
  return 'Diario';
}

module.exports = {
  DAY_LABELS,
  getSchedule,
  isScheduledOn,
  isRequiredOn,
  isRestDay,
  streakUnit,
  describe,
};
