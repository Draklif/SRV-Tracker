'use strict';

const lootboxService = require('../services/lootboxService');
const asyncHandler = require('../utils/asyncHandler');
const { boxSchema } = require('../validators/lootboxValidators');

/** GET /api/lootbox/:boxKey/preview — qué puede salir y con qué probabilidad. */
const preview = asyncHandler(async (req, res) => {
  const { boxKey } = boxSchema.parse({ boxKey: req.params.boxKey });
  res.json({ ok: true, box: lootboxService.preview(boxKey) });
});

/** POST /api/lootbox/buy — { boxKey }. Compra con monedas y abre en el acto. */
const buy = asyncHandler(async (req, res) => {
  const { boxKey } = boxSchema.parse(req.body || {});
  res.json({ ok: true, ...lootboxService.open(req.user, boxKey, { fromInventory: false }) });
});

/** POST /api/lootbox/purchase — { boxKey }. Compra sin abrir: va al inventario. */
const purchase = asyncHandler(async (req, res) => {
  const { boxKey } = boxSchema.parse(req.body || {});
  res.json({ ok: true, ...lootboxService.buyToInventory(req.user, boxKey) });
});

/** POST /api/lootbox/open — { boxKey }. Abre una caja del inventario (del pase). */
const open = asyncHandler(async (req, res) => {
  const { boxKey } = boxSchema.parse(req.body || {});
  res.json({ ok: true, ...lootboxService.open(req.user, boxKey, { fromInventory: true }) });
});

module.exports = { preview, buy, purchase, open };
