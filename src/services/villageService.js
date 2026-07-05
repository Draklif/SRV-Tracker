'use strict';

const villageRepository = require('../models/villageRepository');
const memberRepository = require('../models/villageMemberRepository');
const resourceRepository = require('../models/villageResourceRepository');
const roomRepository = require('../models/villageRoomRepository');
const friendshipRepository = require('../models/friendshipRepository');
const withTransaction = require('../database/withTransaction');
const { isProgress } = require('../utils/logProgress');
const { todayFor } = require('../utils/date');
const {
  RESOURCE_TYPE_KEYS,
  RESOURCE_RULES,
  ROOM_META,
  ROLES,
  MEMBER_STATUS,
  FRIENDSHIP_STATUS,
  VILLAGE_MAX_SLOTS,
} = require('../config/constants');
const { NotFoundError, ConflictError, ForbiddenError, ValidationError } = require('../utils/errors');

/**
 * Reglas de "La Colonia" (Fase 1): crear/unir, aportar recursos con hábitos a un
 * tesoro compartido, y construir/mejorar salas directamente (sin propuestas ni
 * votos — el grupo se organiza hablando). El tesoro es mutable (sube por aportes,
 * baja al construir); el ledger personal `resource_events` queda intacto.
 *
 * Por ahora un usuario solo puede ser miembro ACTIVO de una colonia.
 */

/* ─────────────────────────────  Membresía  ───────────────────────────── */

/** Crea una colonia con el usuario como admin activo y el tesoro en 0. */
function create(user, name) {
  const clean = String(name || '').trim();
  if (clean.length < 2 || clean.length > 40) {
    throw new ValidationError({ name: 'El nombre debe tener entre 2 y 40 caracteres.' });
  }
  if (memberRepository.hasActiveMembership(user.id)) {
    throw new ConflictError('Ya perteneces a una colonia.');
  }
  return withTransaction(() => {
    const village = villageRepository.create(clean, user.id);
    memberRepository.insert({
      villageId: village.id,
      userId: user.id,
      role: ROLES.ADMIN,
      status: MEMBER_STATUS.ACTIVE,
      invitedBy: user.id,
      joinedAt: new Date().toISOString(),
    });
    resourceRepository.ensureRows(village.id, RESOURCE_TYPE_KEYS);
    return village;
  });
}

/** Invita a un amigo (aceptado) a la colonia activa del usuario. */
function inviteFriend(user, friendId) {
  const targetId = Number(friendId);
  if (!Number.isInteger(targetId) || targetId === user.id) {
    throw new ValidationError({ friendId: 'Persona no válida.' });
  }
  const friendship = friendshipRepository.findBetween(user.id, targetId);
  if (!friendship || friendship.status !== FRIENDSHIP_STATUS.ACCEPTED) {
    throw new ForbiddenError('Solo puedes invitar a tus amigos.');
  }
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('Primero crea o únete a una colonia.');

  if (memberRepository.hasActiveMembership(targetId)) {
    throw new ConflictError('Esa persona ya pertenece a una colonia.');
  }
  const existing = memberRepository.findMembership(village.id, targetId);
  if (existing) {
    throw new ConflictError(
      existing.status === MEMBER_STATUS.ACTIVE ? 'Ya es miembro.' : 'Ya tiene una invitación pendiente.'
    );
  }
  memberRepository.insert({
    villageId: village.id,
    userId: targetId,
    role: ROLES.MEMBER,
    status: MEMBER_STATUS.PENDING,
    invitedBy: user.id,
  });
  return village;
}

/** Acepta una invitación pendiente y pasa a miembro activo. */
function accept(user, villageId) {
  const membership = memberRepository.findMembership(Number(villageId), user.id);
  if (!membership || membership.status !== MEMBER_STATUS.PENDING) {
    throw new NotFoundError('Esa invitación ya no está disponible.');
  }
  if (memberRepository.hasActiveMembership(user.id)) {
    throw new ConflictError('Ya perteneces a una colonia.');
  }
  memberRepository.activate(membership.id);
  return villageRepository.findById(Number(villageId));
}

/* ───────────────────────  Aporte al tesoro (hábitos)  ─────────────────── */

/** Acredita `amount` de un recurso al tesoro, idempotente por (colonia,usuario,recurso,motivo,fuente,día). */
function creditOnce(villageId, actorId, resourceType, amount, reason, sourceId, day) {
  if (amount <= 0) return;
  const isNew = resourceRepository.insertContributionIfNew({
    village_id: villageId,
    resource_type: resourceType,
    amount,
    reason,
    actor_id: actorId,
    source_type: 'habit',
    source_id: sourceId,
    day,
  });
  if (isNew) resourceRepository.addBalance(villageId, resourceType, amount);
}

/**
 * Aporta al tesoro de la colonia del usuario cuando registra un hábito. Espejo de
 * resourceService.processLog pero contra el tesoro compartido. Side-effect only:
 * no toca ctx.rewards ni los toasts. Si el usuario no tiene colonia, no hace nada.
 */
function creditContribution(ctx) {
  const { habit, log, date } = ctx;
  if (!habit || !habit.resource_type || !isProgress(log)) return;
  const village = villageRepository.findActiveByUser(habit.user_id);
  if (!village) return;
  withTransaction(() => {
    creditOnce(village.id, habit.user_id, habit.resource_type, RESOURCE_RULES.ON_PROGRESS, 'resource_progress', habit.id, date);
    if (log.completed) {
      creditOnce(village.id, habit.user_id, habit.resource_type, RESOURCE_RULES.ON_COMPLETE, 'resource_complete', habit.id, date);
    }
  });
}

/* ────────────────────────────  Construcción  ──────────────────────────── */

/** Coste de construir/mejorar una sala a un nivel dado. Nivel 1 = coste base; escala lineal. */
function costFor(roomType, level) {
  const base = ROOM_META[roomType].cost;
  return Object.fromEntries(Object.entries(base).map(([r, n]) => [r, n * level]));
}

/** Lanza si el tesoro no cubre el coste. Debe llamarse dentro de la transacción. */
function assertAffordable(villageId, cost) {
  const balances = Object.fromEntries(resourceRepository.balances(villageId).map((b) => [b.resource_type, b.balance]));
  for (const [resource, amount] of Object.entries(cost)) {
    if ((balances[resource] || 0) < amount) {
      throw new ConflictError('El tesoro no alcanza para esto todavía.');
    }
  }
}

/** Descuenta el coste del tesoro y registra el gasto. Dentro de la transacción. */
function spend(villageId, actorId, cost, roomId, day) {
  for (const [resource, amount] of Object.entries(cost)) {
    resourceRepository.addBalance(villageId, resource, -amount);
    resourceRepository.insertSpend({
      village_id: villageId,
      resource_type: resource,
      amount: -amount,
      reason: 'construction',
      actor_id: actorId,
      source_type: 'room',
      source_id: roomId,
      day,
    });
  }
}

function finishAtAfter(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

/** Construye una sala nueva en un slot libre de la colonia del usuario. */
function build(user, { roomType, slotIndex }) {
  if (!ROOM_META[roomType]) throw new ValidationError({ roomType: 'Tipo de sala no válido.' });
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 0 || slot >= VILLAGE_MAX_SLOTS) {
    throw new ValidationError({ slotIndex: 'Espacio no válido.' });
  }
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    if (roomRepository.findBySlot(village.id, slot)) {
      throw new ConflictError('Ese espacio ya está ocupado.');
    }
    const cost = costFor(roomType, 1);
    assertAffordable(village.id, cost);
    const room = roomRepository.insert({
      villageId: village.id,
      roomType,
      slotIndex: slot,
      constructFinishAt: finishAtAfter(ROOM_META[roomType].buildMinutes),
    });
    spend(village.id, user.id, cost, room.id, day);
    return room;
  });
}

/** Mejora una sala construida al siguiente nivel. */
function upgrade(user, roomId) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    const room = roomRepository.findById(Number(roomId));
    if (!room || room.village_id !== village.id) throw new NotFoundError('Esa sala no existe.');
    if (room.status !== 'built') throw new ConflictError('Esa sala ya está en obras.');

    const nextLevel = room.level + 1;
    const cost = costFor(room.room_type, nextLevel);
    assertAffordable(village.id, cost);
    roomRepository.startUpgrade(room.id, finishAtAfter(ROOM_META[room.room_type].buildMinutes));
    spend(village.id, user.id, cost, room.id, day);
    return roomRepository.findById(room.id);
  });
}

/**
 * Completa una construcción al instante ("pagar para acelerar"). GRATIS por
 * ahora: cuando exista la moneda (créditos), esto costará. Cualquier miembro
 * puede acelerar.
 */
function rushConstruction(user, roomId) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const room = roomRepository.findById(Number(roomId));
  if (!room || room.village_id !== village.id) throw new NotFoundError('Esa sala no existe.');
  if (room.status !== 'constructing') throw new ConflictError('Esa sala no está en construcción.');
  // TODO(fase créditos): descontar el coste de acelerar del tesoro de créditos.
  roomRepository.markBuilt(room.id);
  return roomRepository.findById(room.id);
}

/**
 * Utilidad SOLO de desarrollo: rellena el tesoro de la colonia del usuario a un
 * valor enorme para poder probar la construcción sin farmear hábitos. El
 * controlador la bloquea fuera de desarrollo.
 */
function devRefill(user, amount = 1_000_000) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('Primero crea una colonia.');
  for (const rt of RESOURCE_TYPE_KEYS) {
    resourceRepository.setBalance(village.id, rt, amount);
  }
  return village;
}

/* ────────────────────────────  Vista  ─────────────────────────────────── */

/** Resuelve construcciones vencidas y devuelve el modelo de vista de la colonia. */
function getViewModel(user) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) {
    return { village: null, invites: memberRepository.pendingInvites(user.id) };
  }

  roomRepository.completeDue(village.id, new Date().toISOString());

  const treasury = Object.fromEntries(RESOURCE_TYPE_KEYS.map((k) => [k, 0]));
  for (const row of resourceRepository.balances(village.id)) {
    if (row.resource_type in treasury) treasury[row.resource_type] = row.balance;
  }

  const rooms = roomRepository.listByVillage(village.id);
  const bySlot = new Map(rooms.map((r) => [r.slot_index, r]));
  const slots = Array.from({ length: VILLAGE_MAX_SLOTS }, (_, i) => bySlot.get(i) || null);

  return {
    village,
    members: memberRepository.listByVillage(village.id),
    treasury,
    slots,
  };
}

module.exports = {
  create,
  inviteFriend,
  accept,
  creditContribution,
  build,
  upgrade,
  rushConstruction,
  devRefill,
  getViewModel,
};
