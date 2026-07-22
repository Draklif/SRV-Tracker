'use strict';

const streakRepository = require('../models/streakRepository');
const habitLogRepository = require('../models/habitLogRepository');
const habitRepository = require('../models/habitRepository');
const { getSchedule } = require('../utils/schedule');
const { OUTAGE_DATES } = require('../config/constants');
const { diffDays, previousDay, addDays, isoWeekday, weekStart } = require('../utils/date');

/** Días excusados por caída del servidor (ver constants.OUTAGE_DATES). */
const OUTAGE = new Set(OUTAGE_DATES);

/**
 * Calcula racha actual y mejor racha a partir de las fechas completadas.
 * Función PURA (sin BD) para poder testearla con facilidad.
 *
 * Filosofía anti-culpa: si el último periodo esperado ya pasó sin completar, la
 * racha actual es 0 (se reinicia sin castigo); la mejor racha nunca disminuye.
 * El periodo esperado depende de la programación del hábito (ver utils/schedule):
 *   - daily:    cada día calendario.
 *   - weekdays: solo los días de la semana programados (los demás no rompen).
 *   - weekly:   cada semana (racha medida en semanas que cumplen la cuota).
 *
 * Los días EXCUSADOS (caída del servidor, ver constants.OUTAGE_DATES) no rompen
 * la racha ni suman a su longitud: solo la UNEN por encima del hueco, igual que
 * un día no programado en `weekdays`. Así una indisponibilidad ajena al usuario
 * no le reinicia la racha, sin inventar completaciones.
 *
 * @param {string[]} dates     Fechas 'YYYY-MM-DD' con el hábito completado.
 * @param {string} today       Fecha local de hoy 'YYYY-MM-DD'.
 * @param {object} [schedule]  Programación normalizada; diaria por defecto.
 * @param {Set<string>} [excused]  Fechas excusadas; caída del servidor por defecto.
 */
function computeStreak(dates, today, schedule = { type: 'daily' }, excused = OUTAGE) {
  if (!dates.length) return { current: 0, longest: 0, last: null };

  const sorted = [...new Set(dates)].sort();
  const latest = sorted[sorted.length - 1];

  if (schedule.type === 'weekly') return computeWeekly(sorted, today, schedule.timesPerWeek, latest, excused);
  if (schedule.type === 'weekdays') return computeWeekdays(sorted, today, schedule.days, latest, excused);
  return computeDaily(sorted, today, latest, excused);
}

/** Racha por días calendario consecutivos (comportamiento histórico). */
function computeDaily(sorted, today, latest, excused) {
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // Racha actual: se camina hacia atrás desde hoy. Hoy tiene "gracia" (si aún no
  // se marca, no cuenta pero tampoco rompe). Los días completados suman; los
  // excusados unen la cadena sin sumar; el primer día ni completado ni excusado
  // la corta.
  const set = new Set(sorted);
  let current = 0;
  let d = today;
  if (!set.has(d)) d = previousDay(d); // gracia de hoy
  while (set.has(d) || excused.has(d)) {
    if (set.has(d)) current += 1;
    d = previousDay(d);
  }

  return { current, longest, last: latest };
}

/** Día esperado (weekday ∈ days) inmediatamente anterior a `d`. */
function prevScheduledDay(d, days) {
  let p = previousDay(d);
  while (!days.includes(isoWeekday(p))) p = previousDay(p);
  return p;
}

/** Racha sobre los días de la semana programados; los días libres no rompen. */
function computeWeekdays(sorted, today, days, latest, excused) {
  const set = new Set(sorted);

  // Mejor racha: corrida más larga de días esperados consecutivos completados.
  // Las completadas en días no programados (bonus) no participan en la corrida.
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    if (!days.includes(isoWeekday(d))) continue;
    run = prev && prevScheduledDay(d, days) === prev ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // Ancla: día esperado más reciente ≤ hoy. Si ese día es hoy y aún no se marca,
  // gracia (ranura abierta): se cuenta desde el día esperado anterior.
  let cursor = today;
  while (!days.includes(isoWeekday(cursor))) cursor = previousDay(cursor);
  if (!set.has(cursor) && cursor === today) cursor = prevScheduledDay(cursor, days);

  // Un día programado excusado (caída) une la cadena sin sumar; los libres ya
  // los salta prevScheduledDay.
  let current = 0;
  while (set.has(cursor) || excused.has(cursor)) {
    if (set.has(cursor)) current += 1;
    cursor = prevScheduledDay(cursor, days);
  }

  return { current, longest, last: latest };
}

/** Racha en semanas: cada semana (lun–dom) que alcanza la cuota `n`. */
function computeWeekly(sorted, today, n, latest, excused) {
  const counts = new Map(); // lunes de la semana → nº de días completados
  for (const d of sorted) {
    const w = weekStart(d);
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const met = (w) => (counts.get(w) || 0) >= n;

  // Semana excusada: tocada por la caída y sin cumplir la cuota (el usuario no
  // pudo). Une la cadena sin sumar; una semana que igual cumplió cuenta normal.
  const outageWeeks = new Set([...excused].map(weekStart));
  const excusedWeek = (w) => outageWeeks.has(w) && !met(w);

  // Mejor racha: semanas consecutivas que cumplieron la cuota.
  const metWeeks = [...counts.keys()].filter(met).sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const w of metWeeks) {
    run = prev && diffDays(w, prev) === 7 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = w;
  }

  // Racha actual: la semana en curso mantiene viva la racha aunque no cumpla aún.
  let cursor = weekStart(today);
  if (!met(cursor) && !excusedWeek(cursor)) cursor = addDays(cursor, -7);
  let current = 0;
  while (met(cursor) || excusedWeek(cursor)) {
    if (met(cursor)) current += 1;
    cursor = addDays(cursor, -7);
  }

  return { current, longest, last: latest };
}

/** Programación normalizada de un hábito desde su fila cruda. */
function scheduleOf(habitId) {
  const row = habitRepository.findById(habitId);
  let settings = {};
  try {
    settings = JSON.parse((row && row.settings) || '{}');
  } catch {
    settings = {};
  }
  return getSchedule({ settings });
}

/**
 * Recomputa y persiste la racha de un hábito desde su histórico de logs.
 * La mejor racha almacenada nunca decrece (se preserva aunque se edite un día).
 */
function recompute(habitId, today) {
  const dates = habitLogRepository.completedDates(habitId);
  const { current, longest, last } = computeStreak(dates, today, scheduleOf(habitId));
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
