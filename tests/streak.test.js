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
