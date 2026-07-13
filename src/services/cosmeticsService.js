'use strict';

const cosmeticRepository = require('../models/cosmeticRepository');
const { ITEMS, ITEMS_BY_KEY, SLOTS, SLOT_KEYS, RARITIES, RARITY_KEYS } = require('../config/cosmetics');
const { parseEquipped, resolveEquipped } = require('../utils/equipped');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Cosméticos: qué posee cada usuario y qué lleva puesto.
 *
 * Los cosméticos son una capa decorativa: este service NO conoce hábitos, XP ni
 * dimensiones, y nadie del núcleo lo llama. Si desapareciera, la app seguiría
 * funcionando igual.
 *
 * La resolución del blob equipado vive en utils/equipped.js: es pura, se llama
 * una vez por avatar pintado y se prueba sin base de datos.
 */

/**
 * Clases que visten la .card de perfil según lo equipado (fondo + marco).
 * Centralizado aquí porque lo usan las dos vistas de perfil y la vista previa
 * de la colección, y todas deben coincidir al pixel.
 *   - cos-card: abre el contexto de apilado del fondo/marco.
 *   - cos-card-bare: oculta el borde base cuando el marco trae el suyo propio.
 *   - cos-cframe-gap: mete el marco hacia dentro (separado del borde de la card).
 *   - cos-ink-dark|light: el fondo declara su tono y la tarjeta ajusta la tinta.
 */
function cardClasses(cos) {
  const bg = cos.card_bg;
  const frame = cos.card_frame;
  return [
    bg || frame ? 'cos-card' : '',
    frame && frame.replaceBorder ? 'cos-card-bare' : '',
    frame && frame.gap ? 'cos-cframe-gap' : '',
    bg && bg.ink ? `cos-ink-${bg.ink}` : '',
    bg ? bg.css : '',
    frame ? frame.css : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Objetos que posee el usuario, resueltos contra el catálogo. */
function ownedItems(userId) {
  return cosmeticRepository
    .ownedKeys(userId)
    .map((key) => ITEMS_BY_KEY[key])
    .filter(Boolean);
}

/**
 * Clases de comportamiento del envoltorio del avatar según el marco equipado:
 *   - cos-gap: el marco se separa del retrato.
 *   - cos-inner: el retrato conserva su borde propio bajo el marco.
 * Recibe el objeto marco (de `resolve().avatar_frame` o del catálogo).
 */
function frameWrapClasses(frame) {
  if (!frame) return '';
  return [frame.gap ? 'cos-gap' : '', frame.innerBorder ? 'cos-inner' : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * El catálogo completo agrupado por slot, marcando lo que el usuario posee y lo
 * que lleva puesto. Es lo que pinta la vista de Colección.
 */
function collectionFor(userId, userRow) {
  const owned = new Set(cosmeticRepository.ownedKeys(userId));
  const equipped = parseEquipped(userRow && userRow.cosmetics);

  const slots = SLOT_KEYS.map((slot) => ({
    key: slot,
    label: SLOTS[slot].label,
    desc: SLOTS[slot].desc,
    equippedKey: equipped[slot] || null,
    items: ITEMS.filter((item) => item.slot === slot)
      .map((item) => ({ ...item, owned: owned.has(item.key) }))
      .sort((a, b) => RARITY_KEYS.indexOf(a.rarity) - RARITY_KEYS.indexOf(b.rarity)),
  }));

  return { slots, ownedCount: owned.size, totalCount: ITEMS.length };
}

/**
 * Equipa un objeto en su slot. `itemKey` null/'' desequipa el slot.
 * Valida que el objeto exista, que sea de ese slot y que el usuario lo posea:
 * es la única garantía de integridad del blob, así que no se puede saltar.
 */
function equip(userId, slot, itemKey) {
  if (!SLOTS[slot]) throw new ValidationError({ slot: 'Ese hueco no existe.' });

  const equipped = parseEquipped(cosmeticRepository.equippedRaw(userId));

  if (!itemKey) {
    delete equipped[slot];
  } else {
    const item = ITEMS_BY_KEY[itemKey];
    if (!item) throw new NotFoundError('Ese objeto no existe.');
    if (item.slot !== slot) throw new ValidationError({ item: 'Ese objeto no va en ese hueco.' });
    if (!cosmeticRepository.owns(userId, itemKey)) {
      throw new ForbiddenError('Todavía no tienes ese objeto.');
    }
    equipped[slot] = itemKey;
  }

  cosmeticRepository.setEquipped(userId, JSON.stringify(equipped));
  return equipped;
}

/** Concede un objeto (tienda, pase, caja o script de dev). */
function grant(userId, itemKey, source = 'grant') {
  if (!ITEMS_BY_KEY[itemKey]) throw new NotFoundError('Ese objeto no existe.');
  return cosmeticRepository.grant(userId, itemKey, source);
}

module.exports = {
  parseEquipped,
  resolve: resolveEquipped,
  cardClasses,
  frameWrapClasses,
  ownedItems,
  collectionFor,
  equip,
  grant,
  RARITIES,
  SLOTS,
};
