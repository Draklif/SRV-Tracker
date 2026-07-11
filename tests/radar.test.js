'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { computeRadar } = require('../src/services/resourceService');
const { axisLevel } = require('../src/utils/level');
const { RESOURCE_LEVEL_BASE } = require('../src/config/constants');

const TODAY = '2026-07-11';

/** Atajo: totales por dimensión, con 0 en las no mencionadas. */
const dims = (o) => ({ body: 0, mind: 0, calm: 0, social: 0, craft: 0, order: 0, ...o });

/** Atajo: primer día de cada dimensión (las no mencionadas, nunca tocadas). */
const since = (o) => ({ ...o });

const axis = (radar, key) => radar.find((a) => a.key === key);

/* ────────────────  La propiedad central del gráfico  ──────────────── */

test('ritmo constante: los dos polígonos COINCIDEN', () => {
  // 10 semanas produciendo 20/semana en Cuerpo: 200 en total, 20 esta semana.
  // El baseline se calcula sobre las 9 ventanas PREVIAS (180 pts) → 20/ventana.
  const radar = computeRadar({
    totals: dims({ body: 200, calm: 50 }),
    windowTotals: dims({ body: 20, calm: 5 }),
    firstDays: since({ body: '2026-05-03', calm: '2026-05-03' }), // 70 días → 10 ventanas
    today: TODAY,
  });

  assert.equal(axis(radar, 'body').baseline, 20);
  assert.equal(axis(radar, 'body').current, 20);
  assert.equal(axis(radar, 'calm').baseline, 5);
  assert.equal(axis(radar, 'calm').current, 5);
  // Si esto falla, el radar deja de contar lo único que tiene que contar.
});

test('eje abandonado: se hunde a fondo, y el baseline NO se amortigua', () => {
  // Ritmo real de 21/semana en Social durante 7 semanas previas (147 pts), y
  // esta semana, cero. El baseline debe seguir diciendo 21 —el listón del que
  // te has caído—, no una media rebajada por la propia semana que fallaste.
  const radar = computeRadar({
    totals: dims({ body: 200, social: 147 }),
    windowTotals: dims({ body: 20, social: 0 }),
    firstDays: since({ body: '2026-05-03', social: '2026-05-17' }), // social: 56 días
    today: TODAY,
  });

  const social = axis(radar, 'social');
  assert.equal(social.baseline, 21, 'el listón no debe bajar porque hayas fallado');
  assert.equal(social.current, 0);
  assert.equal(axis(radar, 'body').current, axis(radar, 'body').baseline); // los demás, intactos
});

test('semana excepcional: el vértice SOBRESALE, no se recorta', () => {
  const radar = computeRadar({
    totals: dims({ craft: 100 }),
    windowTotals: dims({ craft: 45 }),
    firstDays: since({ craft: '2026-05-03' }),
    today: TODAY,
  });

  const craft = axis(radar, 'craft');
  assert.ok(craft.current > craft.baseline, 'una buena semana debe poder pasarse');
});

/* ──────  El bug que reportó el usuario: dimensión recién estrenada  ────── */

test('dimensión ESTRENADA esta semana: baseline 0, no un eco de la semana', () => {
  // Cuenta con historia en Cuerpo, pero Calma se crea HOY y se completa una vez.
  // El bug: la media dividía el total (que ES solo esta semana) entre la
  // antigüedad de la CUENTA, devolviendo un baseline pegado al current — como si
  // ya tuvieras un ritmo en Calma. No lo tienes: no existía.
  const radar = computeRadar({
    totals: dims({ body: 24, calm: 3 }),
    windowTotals: dims({ body: 12, calm: 3 }),
    firstDays: since({ body: '2026-07-04', calm: TODAY }), // Calma nace hoy
    today: TODAY,
  });

  const calm = axis(radar, 'calm');
  assert.equal(calm.baseline, 0, 'sin pasado no hay ritmo: el listón es 0');
  assert.equal(calm.current, 3);
  assert.ok(calm.current > calm.baseline, 'y el vértice debe sobresalir, no empatar');
});

test('la antigüedad se mide por DIMENSIÓN, no por la cuenta', () => {
  // Cuenta de un año. Social se adoptó hace 3 semanas a 21/semana y esta semana
  // se abandona. Con la antigüedad de la cuenta (52 ventanas) el baseline saldría
  // ~0.8 y la abolladura sería invisible. Con la del eje, sale el listón real.
  const radar = computeRadar({
    totals: dims({ social: 42 }), // 2 ventanas previas × 21
    windowTotals: dims({ social: 0 }), // abandonado esta semana
    firstDays: since({ social: '2026-06-20' }), // 22 días → 3 ventanas
    today: TODAY,
  });

  const social = axis(radar, 'social');
  assert.ok(social.baseline > 15, `el listón debe reflejar su ritmo real, no ${social.baseline}`);
  assert.equal(social.current, 0);
});

/* ────────────────────────  Casos borde  ──────────────────────── */

test('usuario nuevo: sin pasado, todo sobresale (aún no hay ritmo)', () => {
  const radar = computeRadar({
    totals: dims({ body: 6 }),
    windowTotals: dims({ body: 6 }),
    firstDays: since({ body: '2026-07-10' }), // ayer
    today: TODAY,
  });

  const body = axis(radar, 'body');
  assert.equal(body.baseline, 0);
  assert.equal(body.current, 6);
  assert.ok(Number.isFinite(body.baseline));
});

test('usuario sin un solo evento: todo a cero, sin dividir por cero', () => {
  const radar = computeRadar({
    totals: dims({}),
    windowTotals: dims({}),
    firstDays: since({}),
    today: TODAY,
  });

  assert.equal(radar.length, 6);
  for (const a of radar) {
    assert.equal(a.baseline, 0);
    assert.equal(a.current, 0);
    assert.ok(Number.isFinite(a.baseline), `${a.key}: debe ser finito, no NaN/Infinity`);
    assert.equal(a.level, 1, `${a.key}: el nivel suelo es 1, nunca 0`);
  }
});

test('dimensión virgen junto a otra muy usada: la virgen no rompe nada', () => {
  const radar = computeRadar({
    totals: dims({ mind: 600 }),
    windowTotals: dims({ mind: 42 }),
    firstDays: since({ mind: '2026-05-03' }),
    today: TODAY,
  });

  const order = axis(radar, 'order');
  assert.equal(order.baseline, 0);
  assert.equal(order.level, 1); // suelo: no colapsa al centro del hexágono
  assert.ok(Number.isFinite(order.baseline));
});

test('baseline nunca es negativo (current jamás excede al total)', () => {
  const radar = computeRadar({
    totals: dims({ body: 10 }),
    windowTotals: dims({ body: 10 }), // todo el histórico cae dentro de la ventana
    firstDays: since({ body: '2026-07-08' }),
    today: TODAY,
  });
  assert.equal(axis(radar, 'body').baseline, 0);
});

/* ──────────────────────  La curva de nivel  ────────────────────── */

test('nivel: suelo en 1, creciente, y comprime la cima', () => {
  assert.equal(axisLevel(0), 1); // el suelo que impide el colapso al centro
  assert.equal(axisLevel(RESOURCE_LEVEL_BASE), 2); // base ⇒ nivel 2 exacto
  assert.ok(axisLevel(100) > axisLevel(50), 'debe ser creciente');

  // 600 vs 10 son 60:1 en crudo. Comprimidos deben seguir siendo claramente
  // distintos, pero sin convertir el radar en una aguja.
  const ratio = axisLevel(600) / axisLevel(10);
  assert.ok(ratio > 2, `600 vs 10 debe verse claramente mayor (ratio ${ratio.toFixed(1)})`);
  assert.ok(ratio < 6, `pero no como una aguja (ratio ${ratio.toFixed(1)})`);
});

test('nivel: nunca baja ni da NaN con entradas raras', () => {
  assert.equal(axisLevel(-5), 1);
  assert.ok(Number.isFinite(axisLevel(999999)));
});
