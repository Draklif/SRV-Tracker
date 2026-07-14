'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { ITEMS, ITEMS_BY_KEY, SLOTS, RARITIES } = require('../src/config/cosmetics');
const { parseEquipped, resolveEquipped } = require('../src/utils/equipped');

/**
 * El catálogo es contenido escrito a mano: lo que se rompe al añadir objetos es
 * el dedazo (una clave repetida, una rareza inventada, un hueco que no existe).
 * Nada de eso lo detecta el servidor al arrancar, pero deja la tienda o la
 * colección con fichas rotas, así que se comprueba aquí.
 */

test('las claves de los objetos son únicas', () => {
  const keys = ITEMS.map((i) => i.key);
  assert.strictEqual(new Set(keys).size, keys.length);
});

test('cada objeto va en un hueco y una rareza que existen', () => {
  for (const item of ITEMS) {
    assert.ok(SLOTS[item.slot], `${item.key}: hueco desconocido "${item.slot}"`);
    assert.ok(RARITIES[item.rarity], `${item.key}: rareza desconocida "${item.rarity}"`);
  }
});

test('cada objeto trae con qué pintarse', () => {
  for (const item of ITEMS) {
    // Los títulos son texto; el resto se pinta con una clase CSS.
    const paint = item.slot === 'title' ? item.text : item.css;
    assert.ok(paint, `${item.key}: no tiene ni css ni text`);
    // Las decoraciones además llevan glifo.
    if (item.slot === 'avatar_deco') assert.ok(item.glyph, `${item.key}: sin glyph`);
  }
});

test('el índice por clave cubre todo el catálogo', () => {
  assert.strictEqual(Object.keys(ITEMS_BY_KEY).length, ITEMS.length);
});

test('todo objeto tiene precio: la tienda lo cobra', () => {
  for (const item of ITEMS) {
    assert.ok(item.price > 0, `${item.key}: sin precio, la tienda no puede venderlo`);
  }
});

test('ni el objeto más caro cuesta más de tres meses de juego', () => {
  // El precio y el ritmo de la moneda son dos números que solo tienen sentido
  // juntos: 38 monedas al día (ver tests/coins.test.js). Sin esta prueba, subir
  // un precio o bajar el ritmo puede volver la tienda inalcanzable sin que nadie
  // se entere. Que la relación entre ambos sea deliberada y no un accidente.
  const DIA = 38;
  const dias = Math.max(...ITEMS.map((i) => i.price)) / DIA;
  assert.ok(dias < 90, `el objeto más caro cuesta ${Math.round(dias)} días de juego`);
});

test('parseEquipped nunca revienta: la basura equivale a "nada puesto"', () => {
  assert.deepStrictEqual(parseEquipped(null), {});
  assert.deepStrictEqual(parseEquipped(''), {});
  assert.deepStrictEqual(parseEquipped('{'), {});
  assert.deepStrictEqual(parseEquipped('[1,2]'), [1, 2]); // array: se ignora luego al resolver
  assert.deepStrictEqual(parseEquipped('{"title":"title-mito"}'), { title: 'title-mito' });
});

test('resolveEquipped devuelve los objetos del catálogo', () => {
  const row = { cosmetics: '{"avatar_frame":"frame-brasa","title":"title-mito"}' };
  const cos = resolveEquipped(row);
  assert.strictEqual(cos.avatar_frame.key, 'frame-brasa');
  assert.strictEqual(cos.title.text, 'Mito viviente');
  assert.strictEqual(cos.card_bg, undefined);
});

test('una fila sin cosméticos se resuelve a nada (perfil intacto)', () => {
  assert.deepStrictEqual(resolveEquipped({}), {});
  assert.deepStrictEqual(resolveEquipped({ cosmetics: '{}' }), {});
  assert.deepStrictEqual(resolveEquipped(null), {});
});

test('una clave retirada del catálogo se ignora en vez de romper el avatar', () => {
  const cos = resolveEquipped({ cosmetics: '{"avatar_frame":"frame-que-ya-no-existe"}' });
  assert.deepStrictEqual(cos, {});
});

test('un objeto puesto en el hueco equivocado se ignora', () => {
  // frame-brasa es un marco de avatar, no un fondo de tarjeta.
  const cos = resolveEquipped({ cosmetics: '{"card_bg":"frame-brasa"}' });
  assert.deepStrictEqual(cos, {});
});
