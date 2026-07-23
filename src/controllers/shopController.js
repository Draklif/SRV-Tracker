'use strict';

const shopService = require('../services/shopService');
const battlePassService = require('../services/battlePassService');
const giftService = require('../services/giftService');
const asyncHandler = require('../utils/asyncHandler');
const { buySchema } = require('../validators/shopValidators');

/**
 * GET /tienda — el catálogo con precios y tu saldo, el acceso al pase, tu bandeja
 * de regalos (cajas que te han enviado) y tus amigos (para regalar cajas desde el
 * modal de una caja).
 */
const page = (req, res) => {
  res.render('pages/shop', {
    title: 'Tienda',
    shop: shopService.catalogFor(req.user.id, req.user),
    pass: battlePassService.stateFor(req.user),
    gifts: giftService.inboxFor(req.user.id),
    friends: giftService.friendsFor(req.user.id),
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
