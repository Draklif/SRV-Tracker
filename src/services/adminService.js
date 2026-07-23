'use strict';

const adminDiscountRepository = require('../models/adminDiscountRepository');
const shopOverrideRepository = require('../models/shopOverrideRepository');
const dbLootboxRepository = require('../models/dbLootboxRepository');
const dbCosmeticRepository = require('../models/dbCosmeticRepository');
const userRepository = require('../models/userRepository');
const catalogService = require('./catalogService');
const giftService = require('./giftService');
const { ART_KEYS } = require('../config/lootboxes');
const { SLOT_KEYS, RARITY_KEYS } = require('../config/cosmetics');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Orquesta las escrituras del panel de admin. Es el ÚNICO sitio que muta el
 * overlay de catálogo, y tras cada cambio invalida catalogService para que el
 * resto de la app vea el contenido nuevo al instante (ningún controlador tiene
 * que acordarse de invalidar: se centraliza aquí).
 *
 * Todo lo que crea se valida contra los catálogos congelados (claves, rangos,
 * allowlists). El admin AMPLÍA el contenido; no puede referirse a algo que no
 * existe ni inyectar CSS (el campo `css` de un cosmético es solo un NOMBRE de
 * clase que un dev ha escrito en el repo).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CSS_CLASS_RE = /^[a-z][a-z0-9-]{0,63}$/; // nombre de clase, no CSS
const CSS_SLOTS = new Set(['avatar_frame', 'card_bg', 'card_frame']); // necesitan clase
const INK_VALUES = new Set(['dark', 'light']);

/** Convierte un nombre en un slug seguro para una clave ([a-z0-9-]). */
function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Genera una clave `prefix-slug` única frente a un conjunto de claves ya usadas. */
function uniqueKey(prefix, name, taken) {
  const base = slugify(name) || 'x';
  let key = `${prefix}-${base}`;
  let n = 2;
  while (taken.has(key)) {
    key = `${prefix}-${base}-${n}`;
    n += 1;
  }
  return key;
}

// ---- Descuentos manuales --------------------------------------------------

function listDiscounts() {
  return adminDiscountRepository.listAll();
}

function createDiscount({ itemKey, percent, startsOn, endsOn }, adminId) {
  const item = catalogService.itemsByKey()[itemKey];
  if (!item) throw new ValidationError({ itemKey: 'Ese objeto no existe.' });
  if (item.hidden || !(item.price > 0)) {
    throw new ValidationError({ itemKey: 'Ese objeto no está a la venta, no admite rebaja.' });
  }
  const p = Number(percent);
  if (!Number.isInteger(p) || p < 0 || p > 90) {
    throw new ValidationError({ percent: 'El porcentaje va de 0 a 90.' });
  }
  if (startsOn && !DATE_RE.test(startsOn)) throw new ValidationError({ startsOn: 'Fecha no válida.' });
  if (endsOn && !DATE_RE.test(endsOn)) throw new ValidationError({ endsOn: 'Fecha no válida.' });
  if (startsOn && endsOn && startsOn > endsOn) {
    throw new ValidationError({ endsOn: 'La fecha de fin es anterior a la de inicio.' });
  }

  const row = adminDiscountRepository.create({
    itemKey,
    percent: p,
    startsOn: startsOn || null,
    endsOn: endsOn || null,
    createdBy: adminId,
  });
  catalogService.invalidate();
  return row;
}

function removeDiscount(id) {
  if (!adminDiscountRepository.remove(id)) throw new NotFoundError('Ese descuento ya no existe.');
  catalogService.invalidate();
}

// ---- Overrides de tienda (precio / visibilidad) ---------------------------

function listOverrides() {
  return shopOverrideRepository.listAll();
}

/**
 * Fija (o quita) el override de precio/visibilidad de un objeto. `price`/`hidden`
 * = null significa "sin ese override". Si ambos quedan en null, se elimina.
 */
function setOverride({ itemKey, price, hidden }, adminId) {
  const item = catalogService.itemsByKey()[itemKey];
  if (!item) throw new ValidationError({ itemKey: 'Ese objeto no existe.' });

  let priceVal = null;
  if (price != null && price !== '') {
    priceVal = Number(price);
    if (!Number.isInteger(priceVal) || priceVal < 0) {
      throw new ValidationError({ price: 'El precio debe ser un entero ≥ 0.' });
    }
  }
  const hiddenVal = hidden == null ? null : hidden ? 1 : 0;

  if (priceVal == null && hiddenVal == null) {
    shopOverrideRepository.remove(itemKey);
  } else {
    shopOverrideRepository.upsert({ itemKey, price: priceVal, hidden: hiddenVal, updatedBy: adminId });
  }
  catalogService.invalidate();
}

function removeOverride(itemKey) {
  if (!shopOverrideRepository.remove(itemKey)) throw new NotFoundError('Ese ajuste ya no existe.');
  catalogService.invalidate();
}

// ---- Cajas (db_lootboxes) -------------------------------------------------

function listLootboxes() {
  return dbLootboxRepository.listAll();
}

/**
 * Crea una caja de admin. `art` debe ser uno de los ART_KEYS (SVG del repo);
 * `pool` un array de claves de cosméticos NO ocultos que existan. La clave se
 * genera namespaced ('box-…') sin chocar con ninguna caja existente.
 */
function createLootbox({ name, price, art, description, pool }, adminId) {
  if (!name || !String(name).trim()) throw new ValidationError({ name: 'Ponle un nombre.' });
  const priceVal = Number(price);
  if (!Number.isInteger(priceVal) || priceVal < 0) {
    throw new ValidationError({ price: 'El precio debe ser un entero ≥ 0.' });
  }
  if (!ART_KEYS.includes(art)) throw new ValidationError({ art: 'Ese arte no existe.' });

  const list = Array.isArray(pool) ? pool : [];
  if (list.length < 2) throw new ValidationError({ pool: 'Elige al menos 2 objetos para el pool.' });
  const byKey = catalogService.itemsByKey();
  const clean = [];
  for (const key of list) {
    const it = byKey[key];
    if (!it) throw new ValidationError({ pool: `El objeto "${key}" no existe.` });
    if (it.hidden) throw new ValidationError({ pool: `"${it.name}" está oculto y no puede ir en una caja.` });
    if (!clean.includes(key)) clean.push(key);
  }

  const taken = new Set(Object.keys(catalogService.boxesByKey()));
  const key = uniqueKey('box', name, taken);

  const row = dbLootboxRepository.create({
    key,
    name: String(name).trim(),
    price: priceVal,
    art,
    description: description ? String(description).trim() : null,
    pool: clean,
    enabled: true,
    createdBy: adminId,
  });
  catalogService.invalidate();
  return row;
}

function setLootboxEnabled(key, enabled) {
  if (!dbLootboxRepository.setEnabled(key, enabled)) throw new NotFoundError('Esa caja no existe.');
  catalogService.invalidate();
}

function removeLootbox(key) {
  if (!dbLootboxRepository.remove(key)) throw new NotFoundError('Esa caja no existe.');
  catalogService.invalidate();
}

// ---- Cosméticos (db_cosmetics) --------------------------------------------

function listCosmetics() {
  return dbCosmeticRepository.listAll();
}

/**
 * Crea un cosmético de admin. Valida hueco/rareza contra las listas congeladas.
 * Por hueco: título → `text`; decoración → `glyph` (emoji); marcos/fondos →
 * `css` (NOMBRE de una clase escrita a mano en cosmetics.css, no CSS). La clave
 * se genera 'c-…' sin chocar con el catálogo.
 */
function createCosmetic(data, adminId) {
  const { slot, name, rarity } = data;
  if (!SLOT_KEYS.includes(slot)) throw new ValidationError({ slot: 'Hueco no válido.' });
  if (!RARITY_KEYS.includes(rarity)) throw new ValidationError({ rarity: 'Rareza no válida.' });
  if (!name || !String(name).trim()) throw new ValidationError({ name: 'Ponle un nombre.' });

  const priceVal = Number(data.price || 0);
  if (!Number.isInteger(priceVal) || priceVal < 0) {
    throw new ValidationError({ price: 'El precio debe ser un entero ≥ 0.' });
  }

  const css = data.css ? String(data.css).trim() : null;
  if (css && !CSS_CLASS_RE.test(css)) {
    throw new ValidationError({ css: 'La clase debe ser un nombre tipo "cos-frame-x" (minúsculas y guiones).' });
  }
  const glyph = data.glyph ? String(data.glyph).trim() : null;
  if (glyph && glyph.length > 8) throw new ValidationError({ glyph: 'El emoji es demasiado largo.' });
  const text = data.text ? String(data.text).trim().slice(0, 40) : null;
  const ink = data.ink ? String(data.ink) : null;
  if (ink && !INK_VALUES.has(ink)) throw new ValidationError({ ink: 'Tinta no válida.' });

  // Requisitos mínimos por hueco para que el objeto se vea.
  if (slot === 'title' && !text) throw new ValidationError({ text: 'Un título necesita su texto.' });
  if (slot === 'avatar_deco' && !glyph) throw new ValidationError({ glyph: 'Una decoración necesita un emoji.' });
  if (CSS_SLOTS.has(slot) && !css) {
    throw new ValidationError({ css: 'Este hueco necesita el nombre de una clase (creada en el repo).' });
  }

  const taken = new Set(Object.keys(catalogService.itemsByKey()));
  const key = uniqueKey('c', name, taken);

  const row = dbCosmeticRepository.create({
    key,
    slot,
    name: String(name).trim(),
    rarity,
    price: priceVal,
    hidden: Boolean(data.hidden),
    css,
    glyph,
    text,
    gap: Boolean(data.gap),
    innerBorder: Boolean(data.innerBorder),
    replaceBorder: Boolean(data.replaceBorder),
    ink,
    createdBy: adminId,
  });
  catalogService.invalidate();
  return row;
}

function setCosmeticHidden(key, hidden) {
  if (!dbCosmeticRepository.setHidden(key, hidden)) throw new NotFoundError('Ese cosmético no existe.');
  catalogService.invalidate();
}

function removeCosmetic(key) {
  if (!dbCosmeticRepository.remove(key)) throw new NotFoundError('Ese cosmético no existe.');
  catalogService.invalidate();
}

// ---- Difusión de regalos (broadcast) --------------------------------------

function broadcastGift({ type, key, amount, message }) {
  return giftService.broadcast({ type, key, amount, message });
}

// ---- Datos del panel ------------------------------------------------------

function dashboard() {
  return {
    userCount: userRepository.allIds().length,
    discountCount: adminDiscountRepository.listAll().length,
    overrideCount: shopOverrideRepository.listAll().length,
    lootboxCount: dbLootboxRepository.listAll().length,
    cosmeticCount: dbCosmeticRepository.listAll().length,
  };
}

module.exports = {
  listDiscounts,
  createDiscount,
  removeDiscount,
  listOverrides,
  setOverride,
  removeOverride,
  listLootboxes,
  createLootbox,
  setLootboxEnabled,
  removeLootbox,
  listCosmetics,
  createCosmetic,
  setCosmeticHidden,
  removeCosmetic,
  broadcastGift,
  dashboard,
};
