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

// ---- Caída del servidor: días excusados (16-21 jul), server vuelve el 22 -----
const OUTAGE = new Set([
  '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21',
]);
const AFTER = '2026-07-22';

test('caída (daily): el hueco excusado no rompe; une sin sumar los 6 días', () => {
  // Completó 13,14,15; caída 16-21; registra hoy 22. Racha = 3 previos + hoy = 4.
  const dates = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-22'];
  const r = computeStreak(dates, AFTER, { type: 'daily' }, OUTAGE);
  assert.equal(r.current, 4); // no +6 por los días caídos
});

test('caída (daily): racha viva aunque aún no marque hoy tras volver', () => {
  // Completó hasta 15, caída 16-21; hoy 22 todavía sin marcar → sigue viva (gracia).
  const dates = ['2026-07-14', '2026-07-15'];
  const r = computeStreak(dates, AFTER, { type: 'daily' }, OUTAGE);
  assert.equal(r.current, 2);
});

test('caída (daily): un hueco REAL antes de la caída sí rompe', () => {
  // Falló el 12 y 13 (hueco real), completó 14,15; luego caída. Solo cuenta 14,15 y hoy.
  const dates = ['2026-07-10', '2026-07-14', '2026-07-15', '2026-07-22'];
  const r = computeStreak(dates, AFTER, { type: 'daily' }, OUTAGE);
  assert.equal(r.current, 3); // 14,15,22 — el 10 queda aislado por el hueco 11-13
});

test('caída (weekdays): día programado dentro de la caída no rompe', () => {
  // Lun/jue [1,4]. Jueves 16 y lunes 20 cayeron en la caída; retoma jueves 23.
  const dates = ['2026-07-09', '2026-07-13', '2026-07-23'];
  const r = computeStreak(dates, '2026-07-23', { type: 'weekdays', days: [1, 4] }, OUTAGE);
  assert.equal(r.current, 3); // 09-jue, 13-lun, 23-jue; puentea jue16 y lun20
});

test('caída (weekly): semana tocada por la caída no rompe la racha', () => {
  // Cuota 3. Semana 06-29 y 07-06 cumplen; semana 07-13 y 07-20 caen en la caída.
  const dates = [
    '2026-06-29', '2026-06-30', '2026-07-01',
    '2026-07-06', '2026-07-07', '2026-07-08',
  ];
  const r = computeStreak(dates, AFTER, { type: 'weekly', timesPerWeek: 3 }, OUTAGE);
  assert.equal(r.current, 2); // las 2 semanas cumplidas; las caídas puentean sin sumar
});
