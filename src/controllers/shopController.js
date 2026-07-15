'use strict';

const shopService = require('../services/shopService');
const battlePassService = require('../services/battlePassService');
const asyncHandler = require('../utils/asyncHandler');
const { buySchema } = require('../validators/shopValidators');

/** GET /tienda — el catálogo con precios y tu saldo (y el acceso al pase). */
const page = (req, res) => {
  res.render('pages/shop', {
    title: 'Tienda',
    shop: shopService.catalogFor(req.user.id, req.user),
    pass: battlePassService.stateFor(req.user),
  });
};

/**
 * POST /api/shop/buy — { itemKey }. El servidor decide precio, saldo y propiedad;
 * el cliente solo señala qué quiere.
 */
const buy = asyncHandler(async (req, res) => {
  const { itemKey } = buySchema.parse(req.body || {});
  res.json({ ok: true, ...shopService.buy(req.user, itemKey) });
});

module.exports = { page, buy };
