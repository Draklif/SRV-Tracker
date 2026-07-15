'use strict';

const battlePassService = require('../services/battlePassService');
const asyncHandler = require('../utils/asyncHandler');
const { claimSchema } = require('../validators/battlePassValidators');

/** GET /pase — el pase de la temporada activa (se llega desde la tienda). */
const page = (req, res) => {
  res.render('pages/pass', {
    title: 'Pase de batalla',
    pass: battlePassService.stateFor(req.user),
  });
};

/** POST /api/pase/premium — desbloquea el carril premium de la temporada. */
const premium = asyncHandler(async (req, res) => {
  res.json({ ok: true, ...battlePassService.unlockPremium(req.user) });
});

/** POST /api/pase/claim — { level, track }. Reclama la recompensa de un tier. */
const claim = asyncHandler(async (req, res) => {
  const { level, track } = claimSchema.parse(req.body || {});
  res.json({ ok: true, ...battlePassService.claim(req.user, level, track) });
});

module.exports = { page, premium, claim };
