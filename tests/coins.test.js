'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { XP_RULES, COIN_RULES } = require('../src/config/constants');
const { coinsForXpEvent, scaleCoins } = require('../src/utils/coinRules');

/**
 * La moneda se acuña replicando el ledger de XP: por cada fila de xp_events se
 * escribe una de coin_events. Toda esa traducción vive en una función pura, así
 * que se puede probar entera sin tocar la BD — y hay que probarla, porque el
 * subscriber en vivo y el backfill dependen los dos de ella y tienen que acuñar
 * exactamente lo mismo.
 */

test('cada motivo de XP se traduce a sus monedas', () => {
  assert.strictEqual(coinsForXpEvent({ reason: 'habit_log' }), COIN_RULES.HABIT_LOG);
  assert.strictEqual(coinsForXpEvent({ reason: 'daily_target' }), COIN_RULES.DAILY_TARGET);
  assert.strictEqual(coinsForXpEvent({ reason: 'day_complete' }), COIN_RULES.DAY_COMPLETE);
  assert.strictEqual(coinsForXpEvent({ reason: 'achievement' }), COIN_RULES.ACHIEVEMENT);
});

test('el logro paga plano, sin importar el XP que diera', () => {
  // El xp_reward de los logros va de 10 a 120, pero la moneda no lo mira: así,
  // añadir un logro nuevo no reajusta la economía sin querer.
  assert.strictEqual(coinsForXpEvent({ reason: 'achievement', amount: 10 }), COIN_RULES.ACHIEVEMENT);
  assert.strictEqual(coinsForXpEvent({ reason: 'achievement', amount: 120 }), COIN_RULES.ACHIEVEMENT);
});

test('un hito de racha se reconoce por el XP que dio', () => {
  // Una fila vieja de xp_events guarda el XP, no los días de racha. El backfill
  // tiene que poder deducir de qué hito era mirando solo el importe.
  Object.entries(XP_RULES.STREAK_MILESTONES).forEach(([days, xp]) => {
    assert.strictEqual(
      coinsForXpEvent({ reason: 'streak_milestone', amount: xp }),
      COIN_RULES.STREAK_MILESTONES[days],
      `el hito de ${days} días (${xp} XP) debe pagar ${COIN_RULES.STREAK_MILESTONES[days]} monedas`
    );
  });
});

test('los hitos de racha dan importes de XP distintos entre sí', () => {
  // ESTA es la guarda del backfill: si dos hitos dieran el mismo XP, una fila
  // vieja sería ambigua y el backfill repartiría las monedas del hito
  // equivocado, en silencio. Que falle aquí y no en producción.
  const xps = Object.values(XP_RULES.STREAK_MILESTONES);
  assert.strictEqual(new Set(xps).size, xps.length);
});

test('los hitos de moneda cubren los mismos días que los de XP', () => {
  assert.deepStrictEqual(
    Object.keys(COIN_RULES.STREAK_MILESTONES),
    Object.keys(XP_RULES.STREAK_MILESTONES)
  );
});

test('un motivo desconocido no acuña nada', () => {
  // La moneda no se inventa premios: si mañana aparece un motivo de XP nuevo,
  // hay que decidir a mano cuánto vale.
  assert.strictEqual(coinsForXpEvent({ reason: 'resource_progress' }), 0);
  assert.strictEqual(coinsForXpEvent({ reason: 'lo_que_sea' }), 0);
  assert.strictEqual(coinsForXpEvent(null), 0);
  assert.strictEqual(coinsForXpEvent({}), 0);
});

test('un hito de racha con un XP que no existe no acuña nada', () => {
  assert.strictEqual(coinsForXpEvent({ reason: 'streak_milestone', amount: 37 }), 0);
});

test('el multiplicador del entorno escala lo que se acuña', () => {
  assert.strictEqual(scaleCoins(10, 1), 10); // identidad
  assert.strictEqual(scaleCoins(10, 2), 20); // el doble
  assert.strictEqual(scaleCoins(5, 0.5), 3); // redondea
  assert.strictEqual(scaleCoins(10, 0), 0); // economía congelada
  assert.strictEqual(scaleCoins(0, 2), 0); // nada por nada
  assert.strictEqual(scaleCoins(5, NaN), 0); // basura => nada (config ya lo filtra)
});

test('un premio que existe nunca se redondea a cero', () => {
  // Con un rate pequeño, 2 * 0.1 = 0.2 redondearía a 0 y el premio desaparecería.
  assert.strictEqual(scaleCoins(COIN_RULES.HABIT_LOG, 0.1), 1);
});

test('el ritmo es el acordado: 38 monedas en un día de 4 hábitos', () => {
  // Ancla de la economía. Con esto, el objeto común (120) cae en ~3 días y el
  // legendario (2000) en ~2 meses. Si alguien toca COIN_RULES y revienta el
  // ritmo, que se entere aquí y no cuando la tienda quede inalcanzable.
  const dia = 4 * (COIN_RULES.HABIT_LOG + COIN_RULES.DAILY_TARGET) + COIN_RULES.DAY_COMPLETE;
  assert.strictEqual(dia, 38);
});
