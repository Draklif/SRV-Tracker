'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { ITEMS_BY_KEY, RARITY_KEYS } = require('../src/config/cosmetics');
const { BOXES, DUP_REFUND } = require('../src/config/lootboxes');
const { SEASONS } = require('../src/config/seasons');
const { weekKey } = require('../src/utils/isoWeek');
const discountService = require('../src/services/discountService');

/**
 * Fase 3 (pase, cajas, descuentos). Todo esto es contenido escrito a mano cuyo
 * dedazo (una clave muerta en un pool, un oculto colado en la tienda, una
 * recompensa que apunta a nada) no lo detecta el arranque. Se comprueba aquí.
 */

// ---- Descuentos ----------------------------------------------------------
test('las rebajas semanales son deterministas y estables dentro de la semana', () => {
  const a = discountService.weeklyPicks('2026-07-13'); // lunes
  const b = discountService.weeklyPicks('2026-07-19'); // domingo, misma semana
  assert.strictEqual(a.size, b.size);
  for (const [k, v] of a) assert.strictEqual(b.get(k), v, `${k} cambió dentro de la semana`);
});

test('semanas distintas rotan objetos distintos', () => {
  const a = JSON.stringify([...discountService.weeklyPicks('2026-07-13')]);
  const b = JSON.stringify([...discountService.weeklyPicks('2026-07-20')]);
  assert.notStrictEqual(a, b);
});

test('ningún objeto oculto entra en las rebajas semanales', () => {
  for (const day of ['2026-07-06', '2026-07-13', '2026-07-20', '2026-08-03']) {
    for (const key of discountService.weeklyPicks(day).keys()) {
      assert.ok(!ITEMS_BY_KEY[key].hidden, `${key} está oculto y salió rebajado el ${day}`);
    }
  }
});

test('el precio efectivo aplica el porcentaje y nunca sube', () => {
  const day = '2026-07-13';
  for (const [key, percent] of discountService.weeklyPicks(day)) {
    const item = ITEMS_BY_KEY[key];
    const eff = discountService.effectivePrice(item, day);
    assert.strictEqual(eff, Math.round((item.price * (100 - percent)) / 100));
    assert.ok(eff <= item.price && eff >= 0);
  }
});

// ---- Cajas ----------------------------------------------------------------
test('los pools de las cajas solo tienen claves reales y vendibles', () => {
  for (const box of BOXES) {
    assert.ok(box.pool.length > 0, `${box.key}: pool vacío`);
    for (const key of box.pool) {
      const item = ITEMS_BY_KEY[key];
      assert.ok(item, `${box.key}: clave muerta "${key}"`);
      assert.ok(!item.hidden, `${box.key}: "${key}" es oculto (no debe repartirse en cajas)`);
    }
  }
});

test('cada rareza tiene un reembolso de duplicado', () => {
  for (const rarity of RARITY_KEYS) {
    assert.ok(DUP_REFUND[rarity] > 0, `falta DUP_REFUND para "${rarity}"`);
  }
});

// ---- Temporadas / pase ----------------------------------------------------
test('las recompensas del pase apuntan a cosméticos y cajas reales', () => {
  const boxKeys = new Set(BOXES.map((b) => b.key));
  for (const season of SEASONS) {
    for (const tier of season.tiers) {
      for (const track of ['free', 'premium']) {
        const r = tier[track];
        if (!r) continue;
        if (r.type === 'cosmetic') assert.ok(ITEMS_BY_KEY[r.key], `${season.id} L${tier.level} ${track}: cosmético inexistente "${r.key}"`);
        if (r.type === 'lootbox') assert.ok(boxKeys.has(r.box), `${season.id} L${tier.level} ${track}: caja inexistente "${r.box}"`);
        if (r.type === 'coins') assert.ok(r.amount > 0, `${season.id} L${tier.level} ${track}: monedas no positivas`);
      }
    }
  }
});

test('los niveles de cada temporada suben de uno en uno desde 1', () => {
  for (const season of SEASONS) {
    season.tiers.forEach((tier, i) => {
      assert.strictEqual(tier.level, i + 1, `${season.id}: el tier ${i} debería ser nivel ${i + 1}`);
    });
    assert.ok(season.xpPerLevel > 0 && season.premiumPrice > 0);
  }
});

// Guarda contra el incidente del pase autocompletado: un startDay anterior al
// lanzamiento cuenta XP de hábitos previa y completa el pase de golpe. s1 no debe
// volver a arrancar el '2026-07-01' (antes de que el pase existiera).
test('ninguna temporada arranca antes de su disponibilidad real', () => {
  for (const season of SEASONS) {
    assert.ok(season.startDay <= season.endDay, `${season.id}: ventana invertida`);
  }
  const s1 = SEASONS.find((s) => s.id === 's1');
  assert.ok(s1.startDay >= '2026-07-16', `s1.startDay (${s1.startDay}) no debe preceder al lanzamiento del pase`);
});

// ---- isoWeek --------------------------------------------------------------
test('weekKey agrupa lunes..domingo y cambia al siguiente lunes', () => {
  const mon = weekKey('2026-07-13');
  assert.strictEqual(weekKey('2026-07-19'), mon); // domingo misma semana
  assert.strictEqual(weekKey('2026-07-20'), mon + 1); // lunes siguiente
  assert.strictEqual(weekKey('2026-07-12'), mon - 1); // domingo anterior
});
