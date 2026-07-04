'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { addDays, previousDay, diffDays, todayFor } = require('../src/utils/date');

test('addDays cruza fin de mes y de año', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('previousDay resta un día', () => {
  assert.equal(previousDay('2026-07-04'), '2026-07-03');
  assert.equal(previousDay('2026-01-01'), '2025-12-31');
});

test('diffDays cuenta días de calendario con signo', () => {
  assert.equal(diffDays('2026-07-04', '2026-07-04'), 0);
  assert.equal(diffDays('2026-07-04', '2026-07-03'), 1);
  assert.equal(diffDays('2026-07-03', '2026-07-04'), -1);
  assert.equal(diffDays('2026-03-01', '2026-02-28'), 1); // no bisiesto
});

test('todayFor devuelve YYYY-MM-DD y respeta timezone', () => {
  assert.match(todayFor('UTC'), /^\d{4}-\d{2}-\d{2}$/);
  // A la medianoche+ en Tokio, Los Ángeles sigue en el día anterior.
  const tokyo = todayFor('Asia/Tokyo');
  const la = todayFor('America/Los_Angeles');
  assert.ok(diffDays(tokyo, la) >= 0 && diffDays(tokyo, la) <= 1);
});
