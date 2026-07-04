'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { computeStreak } = require('../src/services/streakService');

const TODAY = '2026-07-04';

test('sin registros: racha 0', () => {
  assert.deepEqual(computeStreak([], TODAY), { current: 0, longest: 0, last: null });
});

test('racha activa terminando hoy', () => {
  const r = computeStreak(['2026-07-02', '2026-07-03', '2026-07-04'], TODAY);
  assert.equal(r.current, 3);
  assert.equal(r.longest, 3);
});

test('racha viva si el último día es ayer (aún no registra hoy)', () => {
  const r = computeStreak(['2026-07-02', '2026-07-03'], TODAY);
  assert.equal(r.current, 2);
});

test('anti-culpa: hueco de 2+ días reinicia la actual, conserva la mejor', () => {
  const r = computeStreak(['2026-06-20', '2026-06-21', '2026-06-22', '2026-07-01'], TODAY);
  assert.equal(r.current, 0); // último completado (07-01) es hace 3 días
  assert.equal(r.longest, 3); // la mejor racha histórica se conserva
});

test('ignora duplicados y desorden', () => {
  const r = computeStreak(['2026-07-04', '2026-07-03', '2026-07-04', '2026-07-02'], TODAY);
  assert.equal(r.current, 3);
});

test('un solo día hoy: racha 1', () => {
  assert.equal(computeStreak(['2026-07-04'], TODAY).current, 1);
});

// ---- Programación por días de la semana (lun y jue = [1, 4]) ----------------
// Semana lun 06-29 … dom 07-05: lunes=06-29, jueves=07-02. 07-04 es sábado.
const MON_THU = { type: 'weekdays', days: [1, 4] };

test('weekdays: un día no programado (sábado) no rompe la racha', () => {
  // Cumplió lunes y jueves; hoy es sábado (día libre) → racha sigue en 2.
  const r = computeStreak(['2026-06-29', '2026-07-02'], TODAY, MON_THU);
  assert.equal(r.current, 2);
  assert.equal(r.longest, 2);
});

test('weekdays: faltar un día programado (jueves) rompe la racha', () => {
  // Solo hizo el lunes; el jueves 07-02 ya pasó sin marcar → racha 0.
  const r = computeStreak(['2026-06-29'], TODAY, MON_THU);
  assert.equal(r.current, 0);
  assert.equal(r.longest, 1);
});

test('weekdays: gracia el día programado en curso (jueves aún sin marcar)', () => {
  // Hoy jueves 07-09, aún sin registrar; racha viva desde los días anteriores.
  const r = computeStreak(['2026-06-29', '2026-07-02', '2026-07-06'], '2026-07-09', MON_THU);
  assert.equal(r.current, 3);
  assert.equal(r.longest, 3);
});

// ---- Programación N veces por semana (cuota 3) ------------------------------
const THREE_WEEK = { type: 'weekly', timesPerWeek: 3 };

test('weekly: semanas consecutivas que cumplen la cuota', () => {
  // Semana 06-22 (lun-mié) y semana 06-29 (lun-mié) cumplen 3 → racha 2 semanas.
  const dates = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-29', '2026-06-30', '2026-07-01'];
  const r = computeStreak(dates, TODAY, THREE_WEEK);
  assert.equal(r.current, 2);
  assert.equal(r.longest, 2);
});

test('weekly: la semana en curso sin cumplir aún no rompe la racha', () => {
  // Semana pasada (06-29) cumplió 3; esta semana (07-06) solo 1 → racha 1 (viva).
  const dates = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-06'];
  const r = computeStreak(dates, '2026-07-08', THREE_WEEK);
  assert.equal(r.current, 1);
});

test('weekly: no cumplir la cuota de la semana anterior rompe la racha', () => {
  // Esta semana (07-06) sin cumplir y la anterior (06-29) solo 2 de 3 → racha 0.
  const dates = ['2026-06-29', '2026-06-30', '2026-07-06'];
  const r = computeStreak(dates, '2026-07-08', THREE_WEEK);
  assert.equal(r.current, 0);
});
