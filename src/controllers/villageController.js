'use strict';

const villageService = require('../services/villageService');
const friendshipService = require('../services/friendshipService');
const asyncHandler = require('../utils/asyncHandler');
const {
  createVillageSchema,
  inviteSchema,
  acceptSchema,
  buildSchema,
  mergeSchema,
  moveSchema,
  upgradeSchema,
  cancelSchema,
  destroySchema,
  rushSchema,
} = require('../validators/villageValidators');
const {
  ROOM_META,
  ROOM_TYPE_KEYS,
  RESOURCE_TYPE_META,
  SECONDARY_RESOURCE_META,
  CREDITS_META,
  RUSH_CREDITS_PER_MINUTE,
  ROOM_BASE_WIDTH,
  ROOM_MAX_WIDTH,
} = require('../config/constants');
const config = require('../config');
const { ForbiddenError } = require('../utils/errors');

/**
 * Controlador de "La Colonia". La página renderiza la rejilla; las mutaciones
 * (crear/invitar/aceptar/construir/mejorar) devuelven JSON y el cliente recarga
 * para reflejar el nuevo estado compartido (sin tiempo real en la Fase 1).
 */

/** GET /village — página de la colonia (o estado crear/unirse). */
const page = (req, res) => {
  const vm = villageService.getViewModel(req.user);
  const friends = vm.village ? friendshipService.overview(req.user.id).friends : [];
  res.render('pages/village', {
    title: 'Colonia',
    vm,
    friends,
    roomMeta: ROOM_META,
    roomKeys: ROOM_TYPE_KEYS,
    resourceMeta: RESOURCE_TYPE_META,
    secondaryMeta: SECONDARY_RESOURCE_META,
    creditsMeta: CREDITS_META,
    rushPerMinute: RUSH_CREDITS_PER_MINUTE,
    baseWidth: ROOM_BASE_WIDTH,
    maxWidth: ROOM_MAX_WIDTH,
    isDev: !config.isProd,
  });
};

/** POST /api/village — crea una colonia. */
const create = asyncHandler(async (req, res) => {
  const { name } = createVillageSchema.parse(req.body);
  const village = villageService.create(req.user, name);
  res.json({ ok: true, villageId: village.id });
});

/** POST /api/village/invite — invita a un amigo. */
const invite = asyncHandler(async (req, res) => {
  const { friendId } = inviteSchema.parse(req.body);
  villageService.inviteFriend(req.user, friendId);
  res.json({ ok: true });
});

/** POST /api/village/accept — acepta una invitación pendiente. */
const accept = asyncHandler(async (req, res) => {
  const { villageId } = acceptSchema.parse(req.body);
  villageService.accept(req.user, villageId);
  res.json({ ok: true });
});

/** POST /api/village/build — construye una sala en una celda del mapa. */
const build = asyncHandler(async (req, res) => {
  const { roomType, floor, col } = buildSchema.parse(req.body);
  const room = villageService.build(req.user, { roomType, floor, col });
  res.json({ ok: true, roomId: room.id });
});

/** POST /api/village/merge — fusiona dos salas contiguas iguales. */
const merge = asyncHandler(async (req, res) => {
  const { roomIdA, roomIdB } = mergeSchema.parse(req.body);
  const room = villageService.merge(req.user, roomIdA, roomIdB);
  res.json({ ok: true, roomId: room.id });
});

/** POST /api/village/upgrade — mejora una sala existente. */
const upgrade = asyncHandler(async (req, res) => {
  const { roomId } = upgradeSchema.parse(req.body);
  villageService.upgrade(req.user, roomId);
  res.json({ ok: true });
});

/** POST /api/village/move — mueve una sala a otra celda (medio timer). */
const move = asyncHandler(async (req, res) => {
  const { roomId, floor, col } = moveSchema.parse(req.body);
  villageService.move(req.user, roomId, floor, col);
  res.json({ ok: true });
});

/** POST /api/village/cancel — cancela una obra en curso (reembolso 100%). */
const cancel = asyncHandler(async (req, res) => {
  const { roomId } = cancelSchema.parse(req.body);
  villageService.cancel(req.user, roomId);
  res.json({ ok: true });
});

/** POST /api/village/destroy — destruye una sala construida (reembolso 50%). */
const destroy = asyncHandler(async (req, res) => {
  const { roomId } = destroySchema.parse(req.body);
  villageService.destroy(req.user, roomId);
  res.json({ ok: true });
});

/** POST /api/village/rush — completa una construcción al instante (gratis por ahora). */
const rush = asyncHandler(async (req, res) => {
  const { roomId } = rushSchema.parse(req.body);
  villageService.rushConstruction(req.user, roomId);
  res.json({ ok: true });
});

/** POST /api/village/dev/refill — SOLO desarrollo: rellena el tesoro para probar. */
const devRefill = asyncHandler(async (req, res) => {
  if (config.isProd) throw new ForbiddenError('No disponible.');
  villageService.devRefill(req.user);
  res.json({ ok: true });
});

module.exports = { page, create, invite, accept, build, merge, move, upgrade, cancel, destroy, rush, devRefill };
