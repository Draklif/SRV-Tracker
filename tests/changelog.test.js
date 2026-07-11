'use strict';

const test = require('node:test');
const assert = require('node:assert');
const CHANGELOG = require('../src/config/changelog');

/**
 * El aviso de novedades depende de dos invariantes del array: que la primera
 * entrada sea de verdad la más reciente y que las versiones sean únicas. Si se
 * rompen, el punto de la navegación se queda encendido para siempre o no
 * aparece nunca, y eso no lo detecta ningún otro test.
 */

const TYPES = ['new', 'change', 'fix', 'remove'];

test('las versiones son únicas', () => {
  const versions = CHANGELOG.map((e) => e.version);
  assert.strictEqual(new Set(versions).size, versions.length);
});

test('el array va de más nueva a más vieja', () => {
  const dates = CHANGELOG.map((e) => Date.parse(e.date));
  const sorted = [...dates].sort((a, b) => b - a);
  assert.deepStrictEqual(dates, sorted, 'la entrada nueva va arriba del todo');
});

test('cada entrada está bien formada', () => {
  assert.ok(CHANGELOG.length > 0);
  CHANGELOG.forEach((entry) => {
    assert.match(entry.version, /^\d+\.\d+\.\d+$/);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.title, 'toda versión tiene título');
    assert.ok(entry.items.length > 0, 'una versión sin cambios no se publica');
    entry.items.forEach((item) => {
      assert.ok(TYPES.includes(item.type), `tipo desconocido: ${item.type}`);
      assert.ok(item.text.trim().length > 0);
    });
  });
});

/* changelogService toca la DB al cargarse (userRepository prepara statements),
   así que aquí replicamos su comparación —que es toda su lógica— sin arrastrar
   SQLite a un test unitario. */
test('un usuario está al día solo si ha visto la última versión', () => {
  const latest = CHANGELOG[0].version;
  const hasUnseen = (user) => user.changelog_seen !== latest;

  assert.strictEqual(hasUnseen({ changelog_seen: '' }), true, 'usuario de antes del changelog');
  assert.strictEqual(hasUnseen({ changelog_seen: latest }), false, 'usuario al día');
  assert.strictEqual(hasUnseen({ changelog_seen: '0.0.1' }), true, 'versión vieja');
});
