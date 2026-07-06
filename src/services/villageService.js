'use strict';

const villageRepository = require('../models/villageRepository');
const memberRepository = require('../models/villageMemberRepository');
const resourceRepository = require('../models/villageResourceRepository');
const roomRepository = require('../models/villageRoomRepository');
const secondaryRepository = require('../models/villageSecondaryResourceRepository');
const friendshipRepository = require('../models/friendshipRepository');
const withTransaction = require('../database/withTransaction');
const { isProgress } = require('../utils/logProgress');
const { todayFor } = require('../utils/date');
const {
  RESOURCE_TYPE_KEYS,
  RESOURCE_RULES,
  ROOM_META,
  ROOM_TYPES,
  RUSH_CREDITS_PER_MINUTE,
  SECONDARY_RESOURCE_TYPES,
  ROLES,
  MEMBER_STATUS,
  FRIENDSHIP_STATUS,
  NUCLEO_ROOM_TYPE,
} = require('../config/constants');
const { NotFoundError, ConflictError, ForbiddenError, ValidationError } = require('../utils/errors');

/**
 * Reglas de "La Colonia". Fase A: sistema físico de construcción sobre un mapa 2D
 * ilimitado que crece por ADYACENCIA desde un Núcleo. Las salas se construyen
 * ancho-1 y se FUSIONAN con iguales adyacentes hasta ancho 3. Toda la geometría
 * (solape, adyacencia) se calcula aquí sobre la lista de salas — el servidor es la
 * fuente de verdad; el cliente solo calcula anchors candidatos para el snap.
 *
 * Economía de dos capas: los PRIMARIOS (de hábitos) son la única moneda de
 * construcción; los SECUNDARIOS se modelan pero permanecen inertes en Fase A.
 */

/* ─────────────────────────────  Membresía  ───────────────────────────── */

/** Crea una colonia con el usuario como admin activo y ambos tesoros en 0. */
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
    secondaryRepository.ensureRows(village.id, SECONDARY_RESOURCE_TYPES);
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

/* ──────────────────────  Núcleo, desbloqueo, geometría  ────────────────── */

/**
 * Garantiza el Núcleo: si la colonia no tiene salas, siembra un Núcleo en (0,0)
 * ya construido. Cubre colonias nuevas y la dev recién limpiada. Idempotente.
 */
function ensureNucleo(villageId) {
  if (roomRepository.countByVillage(villageId) > 0) return;
  roomRepository.insert({
    villageId,
    roomType: NUCLEO_ROOM_TYPE,
    floor: 0,
    col: 0,
    width: ROOM_META[NUCLEO_ROOM_TYPE].baseWidth,
    status: 'built',
    constructFinishAt: null,
  });
}

/** Tier desbloqueado = nivel del Laboratorio CONSTRUIDO de mayor nivel (0 si no hay). */
function unlockedTier(rooms) {
  let tier = 0;
  for (const r of rooms) {
    if (r.room_type === ROOM_TYPES.LABORATORY && r.status === 'built' && r.level > tier) {
      tier = r.level;
    }
  }
  return tier;
}

/** Tipos de sala construibles ahora mismo (buildable y con tier desbloqueado). */
function unlockedRoomTypes(rooms) {
  const tier = unlockedTier(rooms);
  return Object.keys(ROOM_META).filter((k) => ROOM_META[k].buildable !== false && ROOM_META[k].unlockTier <= tier);
}

/** Celdas ocupadas por una sala: [{ floor, col }] para col..col+width-1. */
function cellsOf(room) {
  const out = [];
  for (let c = room.col; c < room.col + room.width; c += 1) out.push({ floor: room.floor, col: c });
  return out;
}

/** ¿La huella (floor, col, width) solapa con alguna sala existente? (excludeId ignora una). */
function overlaps(rooms, floor, col, width, excludeId = null) {
  const end = col + width; // exclusivo
  return rooms.some((r) => r.id !== excludeId && r.floor === floor && r.col < end && col < r.col + r.width);
}

/**
 * ¿(floor, col, width) es un anchor válido para una sala de tipo `roomType`? Solo
 * se coloca pegado a lo TERMINADO (nada en obras sostiene una construcción nueva):
 *  - HORIZONTAL: una sala construida del mismo piso toca el borde izq/der.
 *  - VERTICAL: SOLO un elevador puede colocarse sobre/bajo otro elevador construido.
 *    Para cambiar de piso hay que apilar dos elevadores; desde ellos el piso nuevo
 *    crece en horizontal. Ninguna otra sala se ancla en vertical.
 * `excludeId` ignora una sala (para validar un movimiento respecto a sí misma).
 */
function isValidAnchor(rooms, floor, col, width, roomType, excludeId = null) {
  const start = col;
  const end = col + width - 1; // inclusivo
  const built = rooms.filter((r) => r.id !== excludeId && r.status === 'built');
  // Horizontal: una sala construida del mismo piso que toque el borde izq o der.
  const horizontal = built.some(
    (r) => r.floor === floor && (r.col + r.width === start || r.col === end + 1)
  );
  if (horizontal) return true;
  // Vertical: solo un elevador puede apilarse sobre/bajo otro elevador construido.
  if (roomType !== ROOM_TYPES.ELEVATOR) return false;
  return built.some(
    (r) =>
      r.room_type === ROOM_TYPES.ELEVATOR &&
      (r.floor === floor - 1 || r.floor === floor + 1) &&
      r.col <= end &&
      start <= r.col + r.width - 1
  );
}

/**
 * ¿Dos salas están FÍSICAMENTE conectadas? (para detectar huérfanas). Horizontal:
 * mismo piso, bordes tocando. Vertical: pisos contiguos, con un elevador de por
 * medio y columnas solapadas. A diferencia del anchor, aquí cuentan también las
 * salas en obras (existen físicamente) — lo que importa es que nada quede aislado.
 */
function connected(a, b) {
  if (a.floor === b.floor) return a.col + a.width === b.col || b.col + b.width === a.col;
  if (Math.abs(a.floor - b.floor) === 1) {
    const viaElevator = a.room_type === ROOM_TYPES.ELEVATOR || b.room_type === ROOM_TYPES.ELEVATOR;
    const colsOverlap = a.col < b.col + b.width && b.col < a.col + a.width;
    return viaElevator && colsOverlap;
  }
  return false;
}

/** ¿Todas las salas alcanzan el Núcleo por adyacencia física? (BFS). */
function allReachFromNucleo(rooms) {
  const nucleo = rooms.find((r) => r.room_type === ROOM_TYPES.NUCLEO);
  if (!nucleo) return true; // sin Núcleo no hay nada que anclar
  const seen = new Set([nucleo.id]);
  const stack = [nucleo];
  while (stack.length) {
    const cur = stack.pop();
    for (const r of rooms) {
      if (!seen.has(r.id) && connected(cur, r)) {
        seen.add(r.id);
        stack.push(r);
      }
    }
  }
  return seen.size === rooms.length;
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

/** Construye una sala nueva (ancho base) en un anchor adyacente válido. */
function build(user, { roomType, floor, col }) {
  const meta = ROOM_META[roomType];
  if (!meta || meta.buildable === false) throw new ValidationError({ roomType: 'Tipo de sala no válido.' });
  const f = Number(floor);
  const c = Number(col);
  if (!Number.isInteger(f) || !Number.isInteger(c)) {
    throw new ValidationError({ col: 'Posición no válida.' });
  }
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    ensureNucleo(village.id);
    const rooms = roomRepository.listByVillage(village.id);
    if (!unlockedRoomTypes(rooms).includes(roomType)) {
      throw new ConflictError('Esa sala aún no está desbloqueada. Sube el Laboratorio.');
    }
    if (meta.unique && rooms.some((r) => r.room_type === roomType)) {
      throw new ConflictError('Solo puedes tener una de estas en la colonia.');
    }
    const width = meta.baseWidth;
    if (overlaps(rooms, f, c, width)) throw new ConflictError('Ese espacio ya está ocupado.');
    if (!isValidAnchor(rooms, f, c, width, roomType)) {
      throw new ConflictError('Solo puedes construir pegado a lo que ya existe.');
    }
    const cost = costFor(roomType, 1);
    assertAffordable(village.id, cost);
    const room = roomRepository.insert({
      villageId: village.id,
      roomType,
      floor: f,
      col: c,
      width,
      status: 'constructing',
      constructFinishAt: finishAtAfter(meta.buildMinutes),
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
    if (ROOM_META[room.room_type].buildable === false) throw new ConflictError('Esa sala no se puede mejorar.');

    const nextLevel = room.level + 1;
    const cost = costFor(room.room_type, nextLevel);
    assertAffordable(village.id, cost);
    roomRepository.startUpgrade(room.id, finishAtAfter(ROOM_META[room.room_type].buildMinutes));
    spend(village.id, user.id, cost, room.id, day);
    return roomRepository.findById(room.id);
  });
}

/**
 * Fusiona dos salas iguales y contiguas del mismo piso y nivel en una más ancha.
 * Absorbe la vecina: la izquierda se redimensiona a la suma, la otra se borra.
 */
function merge(user, roomIdA, roomIdB) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    const a = roomRepository.findById(Number(roomIdA));
    const b = roomRepository.findById(Number(roomIdB));
    if (!a || !b || a.village_id !== village.id || b.village_id !== village.id || a.id === b.id) {
      throw new NotFoundError('Esas salas no existen.');
    }
    if (a.room_type !== b.room_type) throw new ConflictError('Solo se fusionan salas del mismo tipo.');
    if (a.floor !== b.floor) throw new ConflictError('Las salas deben estar en el mismo piso.');
    if (a.level !== b.level) throw new ConflictError('Las salas deben tener el mismo nivel.');
    if (a.status !== 'built' || b.status !== 'built') throw new ConflictError('Ambas salas deben estar construidas.');

    // Contigüidad: el borde de una toca el inicio de la otra.
    const left = a.col <= b.col ? a : b;
    const right = a.col <= b.col ? b : a;
    if (left.col + left.width !== right.col) throw new ConflictError('Las salas no son contiguas.');

    const combinedWidth = left.width + right.width;
    if (combinedWidth > ROOM_META[a.room_type].maxWidth) {
      throw new ConflictError('La sala fusionada sería demasiado ancha.');
    }

    const cost = costFor(a.room_type, 1);
    assertAffordable(village.id, cost);
    roomRepository.resize(left.id, left.col, combinedWidth);
    roomRepository.remove(right.id);
    spend(village.id, user.id, cost, left.id, day);
    return roomRepository.findById(left.id);
  });
}

/** Reembolsa materiales al tesoro y lo registra. Dentro de la transacción. */
function refund(villageId, actorId, amounts, roomId, day) {
  for (const [resource, amount] of Object.entries(amounts)) {
    if (amount <= 0) continue;
    resourceRepository.addBalance(villageId, resource, amount);
    resourceRepository.insertSpend({
      village_id: villageId,
      resource_type: resource,
      amount, // positivo: es una devolución
      reason: 'refund',
      actor_id: actorId,
      source_type: 'room',
      source_id: roomId,
      day,
    });
  }
}

/**
 * Cancela una construcción EN OBRAS y devuelve el 100% de los materiales.
 *  - Sala nueva (nivel 1): se elimina y se reembolsa su coste base.
 *  - Mejora en curso (nivel > 1): se revierte al nivel anterior (sigue existiendo)
 *    y se reembolsa el coste de esa mejora.
 * Una construcción en obras nunca sostiene a otra (rule de adyacencia), así que
 * cancelar una sala nueva jamás deja huérfanas.
 */
function cancel(user, roomId) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    const room = roomRepository.findById(Number(roomId));
    if (!room || room.village_id !== village.id) throw new NotFoundError('Esa sala no existe.');

    if (room.status === 'moving') {
      // Cancelar un MOVIMIENTO: la sala vuelve a su posición previa (sin coste ni
      // reembolso; el movimiento no gastó materiales).
      roomRepository.revertMove(room.id);
      return roomRepository.findById(room.id);
    }
    if (room.status !== 'constructing') throw new ConflictError('Esa sala no está en obras.');

    if (room.level > 1) {
      // Cancelar una MEJORA: revierte y reembolsa el coste de la mejora en curso.
      refund(village.id, user.id, costFor(room.room_type, room.level), room.id, day);
      roomRepository.revertUpgrade(room.id);
      return roomRepository.findById(room.id);
    }
    // Cancelar una construcción NUEVA: elimina y reembolsa el 100% de lo gastado.
    refund(village.id, user.id, resourceRepository.spentByRoom(village.id, room.id), room.id, day);
    roomRepository.remove(room.id);
    return { removed: true, roomId: room.id };
  });
}

/**
 * Destruye una sala CONSTRUIDA y devuelve el 50% de los materiales invertidos.
 * No se puede destruir el Núcleo, ni si dejaría otra sala huérfana (desconectada
 * del Núcleo).
 */
function destroy(user, roomId) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');
  const day = todayFor(user.timezone);

  return withTransaction(() => {
    const room = roomRepository.findById(Number(roomId));
    if (!room || room.village_id !== village.id) throw new NotFoundError('Esa sala no existe.');
    if (room.room_type === ROOM_TYPES.NUCLEO) throw new ConflictError('El Núcleo no se puede destruir.');
    if (room.status !== 'built') throw new ConflictError('Cancela la obra en vez de destruir.');

    const rooms = roomRepository.listByVillage(village.id);
    const remaining = rooms.filter((r) => r.id !== room.id);
    if (!allReachFromNucleo(remaining)) {
      throw new ConflictError('No puedes destruirla: dejaría salas aisladas del Núcleo.');
    }
    const spent = resourceRepository.spentByRoom(village.id, room.id);
    const back = Object.fromEntries(Object.entries(spent).map(([r, n]) => [r, Math.floor(n * 0.5)]));
    refund(village.id, user.id, back, room.id, day);
    roomRepository.remove(room.id);
    return { removed: true, roomId: room.id };
  });
}

/**
 * Mueve una sala construida a otra celda válida. Cuesta TIEMPO (la mitad del
 * timer normal de esa sala), sin materiales. No puede dejar huérfanas ni mover el
 * Núcleo, y el destino debe ser un anchor válido (pegado a algo construido).
 */
function move(user, roomId, floor, col) {
  const f = Number(floor);
  const c = Number(col);
  if (!Number.isInteger(f) || !Number.isInteger(c)) throw new ValidationError({ col: 'Posición no válida.' });
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');

  return withTransaction(() => {
    const room = roomRepository.findById(Number(roomId));
    if (!room || room.village_id !== village.id) throw new NotFoundError('Esa sala no existe.');
    if (room.room_type === ROOM_TYPES.NUCLEO) throw new ConflictError('El Núcleo no se puede mover.');
    if (room.status !== 'built') throw new ConflictError('Espera a que termine la obra para moverla.');

    if (f === room.floor && c === room.col) throw new ConflictError('La sala ya está en esa posición.');
    const rooms = roomRepository.listByVillage(village.id);
    if (overlaps(rooms, f, c, room.width, room.id)) throw new ConflictError('Ese espacio ya está ocupado.');
    if (!isValidAnchor(rooms, f, c, room.width, room.room_type, room.id)) {
      throw new ConflictError('El destino debe estar pegado a algo construido.');
    }
    // Config resultante con la sala ya en su destino: nada puede quedar aislado.
    const resulting = rooms.map((r) => (r.id === room.id ? { ...r, floor: f, col: c } : r));
    if (!allReachFromNucleo(resulting)) {
      throw new ConflictError('No puedes moverla ahí: dejaría salas aisladas del Núcleo.');
    }
    const minutes = Math.ceil(ROOM_META[room.room_type].buildMinutes / 2);
    roomRepository.relocate(room.id, f, c, room.floor, room.col, finishAtAfter(minutes));
    return roomRepository.findById(room.id);
  });
}

/** Créditos que cuesta acelerar una construcción según el tiempo que le falte. */
function rushCost(room, now = Date.now()) {
  if (!room.construct_finish_at) return 0;
  const remainingMs = new Date(room.construct_finish_at).getTime() - now;
  const remainingMin = Math.ceil(Math.max(0, remainingMs) / 60000);
  return Math.max(1, remainingMin * RUSH_CREDITS_PER_MINUTE);
}

/**
 * Completa una construcción al instante ("pagar para terminar ya"). Cuesta
 * CRÉDITOS (moneda de aceleración), proporcional al tiempo restante. Cualquier
 * miembro puede acelerar si la colonia tiene créditos.
 */
function rushConstruction(user, roomId) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) throw new ConflictError('No perteneces a ninguna colonia.');

  return withTransaction(() => {
    const room = roomRepository.findById(Number(roomId));
    if (!room || room.village_id !== village.id) throw new NotFoundError('Esa sala no existe.');
    if (room.status !== 'constructing' && room.status !== 'moving') {
      throw new ConflictError('Esa sala no está en obras.');
    }
    const cost = rushCost(room);
    if (village.credits < cost) {
      throw new ConflictError(`Necesitas ${cost} 🪙 para acelerar y solo hay ${village.credits}.`);
    }
    villageRepository.addCredits(village.id, -cost);
    roomRepository.markBuilt(room.id);
    return roomRepository.findById(room.id);
  });
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
  villageRepository.setCredits(village.id, amount);
  return village;
}

/* ────────────────────────────  Vista  ─────────────────────────────────── */

/** Límites del mapa (min/max floor/col) a partir de las salas, para el lienzo. */
function mapBounds(rooms) {
  if (!rooms.length) return { minFloor: 0, maxFloor: 0, minCol: 0, maxCol: 0 };
  let minFloor = Infinity;
  let maxFloor = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const r of rooms) {
    if (r.floor < minFloor) minFloor = r.floor;
    if (r.floor > maxFloor) maxFloor = r.floor;
    if (r.col < minCol) minCol = r.col;
    if (r.col + r.width - 1 > maxCol) maxCol = r.col + r.width - 1;
  }
  return { minFloor, maxFloor, minCol, maxCol };
}

/** Resuelve construcciones vencidas y devuelve el modelo de vista de la colonia. */
function getViewModel(user) {
  const village = villageRepository.findActiveByUser(user.id);
  if (!village) {
    return { village: null, invites: memberRepository.pendingInvites(user.id) };
  }

  roomRepository.completeDue(village.id, new Date().toISOString());
  ensureNucleo(village.id);

  const treasury = Object.fromEntries(RESOURCE_TYPE_KEYS.map((k) => [k, 0]));
  for (const row of resourceRepository.balances(village.id)) {
    if (row.resource_type in treasury) treasury[row.resource_type] = row.balance;
  }

  // Secundarios (inertes en Fase A): amount/cap por tipo.
  secondaryRepository.ensureRows(village.id, SECONDARY_RESOURCE_TYPES);
  const secondary = Object.fromEntries(SECONDARY_RESOURCE_TYPES.map((k) => [k, { amount: 0, cap: 0 }]));
  for (const row of secondaryRepository.balances(village.id)) {
    if (row.resource_type in secondary) secondary[row.resource_type] = { amount: row.amount, cap: row.cap };
  }

  const rooms = roomRepository.listByVillage(village.id);

  return {
    village,
    members: memberRepository.listByVillage(village.id),
    treasury,
    secondary,
    credits: village.credits || 0,
    rooms,
    bounds: mapBounds(rooms),
    unlockedTier: unlockedTier(rooms),
    unlockedRoomTypes: unlockedRoomTypes(rooms),
  };
}

module.exports = {
  create,
  inviteFriend,
  accept,
  creditContribution,
  ensureNucleo,
  unlockedRoomTypes,
  overlaps,
  isValidAnchor,
  cellsOf,
  build,
  upgrade,
  merge,
  cancel,
  destroy,
  move,
  allReachFromNucleo,
  rushCost,
  rushConstruction,
  devRefill,
  getViewModel,
};
