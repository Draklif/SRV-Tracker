'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { computeRadar } = require('../src/services/resourceService');
const { axisLevel } = require('../src/utils/level');
const { RESOURCE_LEVEL_BASE } = require('../src/config/constants');

const TODAY = '2026-07-11';

/** Atajo: construye los totales por dimensión con 0 en las no mencionadas. */
const dims = (o) => ({ body: 0, mind: 0, calm: 0, social: 0, craft: 0, order: 0, ...o });

/** Busca un eje del radar por clave. */
const axis = (radar, key) => radar.find((a) => a.key === key);

/* ────────────────  La propiedad central del gráfico  ──────────────── */

test('ritmo constante: los dos polígonos COINCIDEN', () => {
  // 10 semanas de vida produciendo 20/semana en Cuerpo y 5/semana en Calma.
  // Esta semana hizo exactamente lo mismo.
  const radar = computeRadar({
    totals: dims({ body: 200, calm: 50 }),
    windowTotals: dims({ body: 20, calm: 5 }),
    firstDay: '2026-05-03', // 70 días antes de TODAY → 10 ventanas exactas
    today: TODAY,
  });

  assert.equal(axis(radar, 'body').baseline, 20);
  assert.equal(axis(radar, 'body').current, 20);
  assert.equal(axis(radar, 'calm').baseline, 5);
  assert.equal(axis(radar, 'calm').current, 5);
  // Si esto falla, el radar deja de contar lo único que tiene que contar.
});

test('eje abandonado: solo ESE vértice se hunde, los demás no se mueven', () => {
  const radar = computeRadar({
    totals: dims({ body: 200, social: 100 }),
    windowTotals: dims({ body: 20, social: 0 }), // esta semana no vio a nadie
    firstDay: '2026-05-03',
    today: TODAY,
  });

  const body = axis(radar, 'body');
  const social = axis(radar, 'social');

  assert.equal(body.current, body.baseline); // Cuerpo intacto
  assert.equal(social.baseline, 10); // su ritmo era 10/semana…
  assert.equal(social.current, 0); // …y esta semana, cero: se hunde a fondo
});

test('semana excepcional: el vértice SOBRESALE, no se recorta', () => {
  const radar = computeRadar({
    totals: dims({ craft: 100 }),
    windowTotals: dims({ craft: 45 }), // el triple de su media
    firstDay: '2026-05-03',
    today: TODAY,
  });

  const craft = axis(radar, 'craft');
  assert.equal(craft.baseline, 10);
  assert.equal(craft.current, 45);
  assert.ok(craft.current > craft.baseline, 'una buena semana debe poder pasarse');
});

/* ────────────────────────  Casos borde  ──────────────────────── */

test('usuario nuevo: baseline == current, el hexágono nace sólido', () => {
  // Dos días de vida, 6 puntos. Sin el suelo de 1 ventana, su "media semanal"
  // sería 6 / (2/7) = 21 y su semana real (6) parecería un socavón.
  const radar = computeRadar({
    totals: dims({ body: 6 }),
    windowTotals: dims({ body: 6 }),
    firstDay: '2026-07-10', // ayer
    today: TODAY,
  });

  const body = axis(radar, 'body');
  assert.equal(body.baseline, 6);
  assert.equal(body.current, 6);
  assert.equal(body.baseline, body.current, 'aún no tiene un ritmo del que desviarse');
});

test('usuario sin un solo evento: todo a cero, sin dividir por cero', () => {
  const radar = computeRadar({
    totals: dims({}),
    windowTotals: dims({}),
    firstDay: null,
    today: TODAY,
  });

  assert.equal(radar.length, 6);
  for (const a of radar) {
    assert.equal(a.baseline, 0);
    assert.equal(a.current, 0);
    assert.ok(Number.isFinite(a.baseline), `${a.key}: baseline debe ser finito, no NaN/Infinity`);
    assert.equal(a.level, 1, `${a.key}: el nivel suelo es 1, nunca 0`);
  }
});

test('dimensión virgen junto a otra muy usada: la virgen no rompe nada', () => {
  const radar = computeRadar({
    totals: dims({ mind: 600 }), // nunca ha tocado las otras cinco
    windowTotals: dims({ mind: 42 }),
    firstDay: '2026-05-03',
    today: TODAY,
  });

  const order = axis(radar, 'order');
  assert.equal(order.baseline, 0);
  assert.equal(order.level, 1); // suelo: no colapsa al centro del hexágono
  assert.ok(Number.isFinite(order.baseline));
});

/* ──────────────────────  La curva de nivel  ────────────────────── */

test('nivel: suelo en 1, creciente, y comprime la cima', () => {
  assert.equal(axisLevel(0), 1); // el suelo que impide el colapso al centro
  assert.equal(axisLevel(RESOURCE_LEVEL_BASE), 2); // base ⇒ nivel 2 exacto
  assert.ok(axisLevel(100) > axisLevel(50), 'debe ser creciente');

  // El caso que motivó la curva: 600 vs 10 son 60:1 en crudo. Comprimidos deben
  // seguir siendo claramente distintos, pero sin convertir el radar en una aguja.
  const ratio = axisLevel(600) / axisLevel(10);
  assert.ok(ratio > 2, `600 vs 10 debe verse claramente mayor (ratio ${ratio.toFixed(1)})`);
  assert.ok(ratio < 6, `pero no como una aguja (ratio ${ratio.toFixed(1)})`);
});

test('nivel: nunca baja ni da NaN con entradas raras', () => {
  assert.equal(axisLevel(-5), 1); // total negativo es imposible, pero no debe explotar
  assert.ok(Number.isFinite(axisLevel(999999)));
});
