'use strict';

const adminService = require('../services/adminService');
const catalogService = require('../services/catalogService');
const discountService = require('../services/discountService');
const asyncHandler = require('../utils/asyncHandler');
const { todayFor } = require('../utils/date');
const { ART_KEYS } = require('../config/lootboxes');
const { SLOTS, SLOT_KEYS, RARITIES, RARITY_KEYS } = require('../config/cosmetics');
const {
  createDiscountSchema,
  broadcastSchema,
  setOverrideSchema,
  createLootboxSchema,
  createCosmeticSchema,
} = require('../validators/adminValidators');

/**
 * Panel de administración (desktop-only). Todo detrás de requireAuth +
 * requireAdmin. Es UNA sola página: las pestañas cambian el contenido en el
 * cliente (como el hub de amigos). Controladores finos: parsean, llaman a
 * adminService y responden JSON.
 */

/** Cosméticos vendibles (no ocultos, con precio) para los selectores de venta. */
function sellableItems(day) {
  return catalogService
    .items()
    .filter((it) => !it.hidden && it.price > 0)
    .map((it) => ({
      key: it.key,
      name: it.name,
      slot: it.slot,
      rarity: it.rarity,
      price: discountService.effectivePrice(it, day),
    }));
}

/** Todos los objetos del catálogo (incluidos ocultos) para overrides y pools. */
function allItems() {
  return catalogService.items().map((it) => ({
    key: it.key,
    name: it.name,
    slot: it.slot,
    rarity: it.rarity,
    price: it.price,
    hidden: Boolean(it.hidden),
  }));
}

/** Cajas habilitadas para el selector de difusión. */
function boxOptions() {
  return catalogService
    .boxes()
    .filter((b) => b.enabled !== false)
    .map((b) => ({ key: b.key, name: b.name, price: b.price }));
}

// ---- Página (única) -------------------------------------------------------

const page = (req, res) => {
  const day = todayFor(req.user.timezone);
  const items = sellableItems(day);
  const sellableByKey = Object.fromEntries(items.map((it) => [it.key, it]));
  const catalog = allItems();
  const catalogByKey = Object.fromEntries(catalog.map((it) => [it.key, it]));

  const discounts = adminService.listDiscounts().map((d) => ({
    ...d,
    itemName: sellableByKey[d.item_key] ? sellableByKey[d.item_key].name : d.item_key,
  }));
  const overrides = adminService.listOverrides().map((o) => ({
    ...o,
    itemName: catalogByKey[o.item_key] ? catalogByKey[o.item_key].name : o.item_key,
  }));

  res.render('pages/admin', {
    title: 'Panel',
    hideBottomNav: true, // desktop-only: sin nav móvil
    stats: adminService.dashboard(),
    // Descuentos
    items,
    discounts,
    // Tienda (overrides)
    catalog,
    overrides,
    // Difusión
    boxes: boxOptions(),
    cosmetics: items,
    // Cajas
    artKeys: ART_KEYS,
    poolItems: catalog.filter((it) => !it.hidden),
    lootboxes: adminService.listLootboxes(),
    // Cosméticos
    slots: SLOT_KEYS.map((k) => ({ key: k, label: SLOTS[k].label })),
    rarities: RARITY_KEYS.map((k) => ({ key: k, label: RARITIES[k].label })),
    dbCosmetics: adminService.listCosmetics(),
  });
};

// ---- API: descuentos ------------------------------------------------------

const createDiscount = asyncHandler(async (req, res) => {
  const data = createDiscountSchema.parse(req.body || {});
  const row = adminService.createDiscount(
    { itemKey: data.itemKey, percent: data.percent, startsOn: data.startsOn, endsOn: data.endsOn },
    req.user.id
  );
  res.json({ ok: true, id: row.id });
});

const deleteDiscount = asyncHandler(async (req, res) => {
  adminService.removeDiscount(Number(req.params.id));
  res.json({ ok: true });
});

// ---- API: overrides de tienda ---------------------------------------------

const setOverride = asyncHandler(async (req, res) => {
  const data = setOverrideSchema.parse(req.body || {});
  const hidden = data.hidden === 'keep' ? null : data.hidden === 'hide';
  adminService.setOverride(
    { itemKey: data.itemKey, price: data.price == null ? null : data.price, hidden },
    req.user.id
  );
  res.json({ ok: true });
});

const deleteOverride = asyncHandler(async (req, res) => {
  adminService.removeOverride(req.params.itemKey);
  res.json({ ok: true });
});

// ---- API: cajas -----------------------------------------------------------

const createLootbox = asyncHandler(async (req, res) => {
  const data = createLootboxSchema.parse(req.body || {});
  const row = adminService.createLootbox(data, req.user.id);
  res.json({ ok: true, key: row.key });
});

const toggleLootbox = asyncHandler(async (req, res) => {
  adminService.setLootboxEnabled(req.params.key, Boolean(req.body && req.body.enabled));
  res.json({ ok: true });
});

const deleteLootbox = asyncHandler(async (req, res) => {
  adminService.removeLootbox(req.params.key);
  res.json({ ok: true });
});

// ---- API: cosméticos ------------------------------------------------------

const createCosmetic = asyncHandler(async (req, res) => {
  const data = createCosmeticSchema.parse(req.body || {});
  const row = adminService.createCosmetic(data, req.user.id);
  res.json({ ok: true, key: row.key });
});

const toggleCosmetic = asyncHandler(async (req, res) => {
  adminService.setCosmeticHidden(req.params.key, Boolean(req.body && req.body.hidden));
  res.json({ ok: true });
});

const deleteCosmetic = asyncHandler(async (req, res) => {
  adminService.removeCosmetic(req.params.key);
  res.json({ ok: true });
});

// ---- API: difusión --------------------------------------------------------

const broadcast = asyncHandler(async (req, res) => {
  const data = broadcastSchema.parse(req.body || {});
  const { count, label } = adminService.broadcastGift(data);
  res.json({ ok: true, count, label });
});

module.exports = {
  page,
  createDiscount,
  deleteDiscount,
  setOverride,
  deleteOverride,
  createLootbox,
  toggleLootbox,
  deleteLootbox,
  createCosmetic,
  toggleCosmetic,
  deleteCosmetic,
  broadcast,
};
