'use strict';

const cosmeticsService = require('../services/cosmeticsService');
const asyncHandler = require('../utils/asyncHandler');
const { levelProgress } = require('../utils/level');

/** GET /coleccion — el catálogo completo, marcando lo que tienes y lo que llevas. */
const page = (req, res) => {
  const collection = cosmeticsService.collectionFor(req.user.id, req.user);
  // El nivel va a la vista previa para que sea idéntica al perfil real.
  res.render('pages/collection', {
    title: 'Colección',
    collection,
    level: levelProgress(req.user.xp),
  });
};

/**
 * POST /api/cosmetics/equip — { slot, itemKey }. `itemKey` null o '' desequipa.
 * El service valida catálogo + propiedad: el cliente nunca decide qué es válido.
 */
const equip = asyncHandler(async (req, res) => {
  const { slot, itemKey } = req.body || {};
  const equipped = cosmeticsService.equip(req.user.id, slot, itemKey || null);
  res.json({ ok: true, equipped });
});

module.exports = { page, equip };
