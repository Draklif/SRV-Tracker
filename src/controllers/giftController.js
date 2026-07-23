'use strict';

const giftService = require('../services/giftService');
const asyncHandler = require('../utils/asyncHandler');
const { sendGiftSchema } = require('../validators/giftValidators');
const { ValidationError } = require('../utils/errors');

/**
 * POST /api/gifts/send — { recipientId, key }. Regala una caja a un amigo. El
 * servidor decide el precio y cobra al emisor; el cliente solo señala qué caja.
 */
const send = asyncHandler(async (req, res) => {
  const data = sendGiftSchema.parse(req.body || {});
  const { label, boxKey } = giftService.send(req.user, data);
  res.json({ ok: true, label, boxKey });
});

/** POST /api/gifts/:id/claim — reclama un regalo pendiente. */
const claim = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ValidationError({ id: 'Regalo no válido.' });
  const result = giftService.claim(req.user, id);
  res.json({ ok: true, ...result });
});

/** DELETE /api/gifts/:id — quita de la bandeja un regalo ya reclamado. */
const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ValidationError({ id: 'Regalo no válido.' });
  giftService.remove(req.user, id);
  res.json({ ok: true });
});

module.exports = { send, claim, remove };
