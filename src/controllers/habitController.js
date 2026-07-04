'use strict';

const habitService = require('../services/habitService');
const { habitSchema } = require('../validators/habitValidators');
const asyncHandler = require('../utils/asyncHandler');
const renderPartial = require('../utils/renderPartial');

/** GET /habits — página de gestión de hábitos. */
const page = (req, res) => {
  res.render('pages/habits', {
    title: 'Tus hábitos',
    habits: habitService.listActive(req.user.id),
    archived: habitService.listArchived(req.user.id),
  });
};

/** POST /api/habits — crear. Devuelve el hábito y su tarjeta ya renderizada. */
const create = asyncHandler(async (req, res) => {
  const data = habitSchema.parse(req.body);
  const { habit, rewards } = habitService.create(req.user, data);
  const html = await renderPartial(res, 'partials/habit-card', { habit });
  res.status(201).json({ habit, html, rewards });
});

/** PATCH /api/habits/:id — editar. */
const update = asyncHandler(async (req, res) => {
  const data = habitSchema.parse(req.body);
  const habit = habitService.update(Number(req.params.id), req.user.id, data);
  const html = await renderPartial(res, 'partials/habit-card', { habit });
  res.json({ habit, html });
});

/** DELETE /api/habits/:id — archivar (soft, conserva histórico). */
const archive = asyncHandler(async (req, res) => {
  habitService.archive(Number(req.params.id), req.user.id);
  res.json({ ok: true, id: Number(req.params.id) });
});

/** POST /api/habits/:id/restore — desarchivar. */
const restore = asyncHandler(async (req, res) => {
  const habit = habitService.restore(Number(req.params.id), req.user.id);
  const html = await renderPartial(res, 'partials/habit-card', { habit });
  res.json({ habit, html });
});

/** POST /api/habits/reorder — reordenar los hábitos activos. */
const reorder = asyncHandler(async (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number) : [];
  habitService.reorder(req.user.id, order);
  res.json({ ok: true });
});

module.exports = { page, create, update, archive, restore, reorder };
