'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de salas de la colonia. Único lugar con SQL de `village_rooms`.
 * Cada sala ocupa una huella horizontal `(floor, col, width)` en un mapa 2D
 * ilimitado. El solape y la adyacencia se calculan en el servicio sobre
 * `listByVillage` (no en SQL) — aquí solo hay CRUD plano.
 *
 * Una sala nace en 'constructing' con un `construct_finish_at`; al vencer el
 * timer pasa a 'built' (resolución perezosa al leer, no hay scheduler).
 */

const statements = {
  byId: db.prepare('SELECT * FROM village_rooms WHERE id = ?'),
  listByVillage: db.prepare(
    'SELECT * FROM village_rooms WHERE village_id = ? ORDER BY floor, col'
  ),
  countByVillage: db.prepare('SELECT COUNT(*) AS n FROM village_rooms WHERE village_id = ?'),
  insert: db.prepare(`
    INSERT INTO village_rooms (village_id, room_type, floor, col, width, status, construct_finish_at)
    VALUES (@village_id, @room_type, @floor, @col, @width, @status, @construct_finish_at)
  `),
  // Sube de nivel una sala YA construida y la pone a construir de nuevo (el
  // nivel objetivo se fija de una; el timer solo controla cuándo vuelve a 'built').
  startUpgrade: db.prepare(`
    UPDATE village_rooms
    SET level = level + 1, status = 'constructing', construct_finish_at = @construct_finish_at
    WHERE id = @id AND status = 'built'
  `),
  // Redimensiona la huella de una sala (fusión: se le suma el ancho de la vecina).
  resize: db.prepare('UPDATE village_rooms SET col = @col, width = @width WHERE id = @id'),
  // Mueve una sala a otra celda; entra en estado 'moving' (medio timer) y recuerda
  // el origen para poder revertir si se cancela el movimiento.
  relocate: db.prepare(`
    UPDATE village_rooms
    SET floor = @floor, col = @col, status = 'moving', construct_finish_at = @construct_finish_at,
        move_from_floor = @from_floor, move_from_col = @from_col
    WHERE id = @id AND status = 'built'
  `),
  // Revierte un movimiento en curso: vuelve al origen y a 'built' (cancelar move).
  revertMove: db.prepare(`
    UPDATE village_rooms
    SET floor = move_from_floor, col = move_from_col, status = 'built',
        construct_finish_at = NULL, move_from_floor = NULL, move_from_col = NULL
    WHERE id = @id AND status = 'moving'
  `),
  // Revierte una mejora en curso: baja un nivel y vuelve a 'built' (cancelar upgrade).
  revertUpgrade: db.prepare(`
    UPDATE village_rooms
    SET level = level - 1, status = 'built', construct_finish_at = NULL
    WHERE id = @id AND status = 'constructing' AND level > 1
  `),
  delete: db.prepare('DELETE FROM village_rooms WHERE id = ?'),
  // Completa las obras (construcción/mejora/movimiento) cuyo timer ya venció.
  completeDue: db.prepare(`
    UPDATE village_rooms
    SET status = 'built', construct_finish_at = NULL, move_from_floor = NULL, move_from_col = NULL
    WHERE village_id = @village_id AND status IN ('constructing', 'moving') AND construct_finish_at <= @now
  `),
  // Completa una sala concreta al instante (pagar para acelerar).
  markBuilt: db.prepare(
    "UPDATE village_rooms SET status = 'built', construct_finish_at = NULL, move_from_floor = NULL, move_from_col = NULL WHERE id = ?"
  ),
};

function findById(id) {
  return statements.byId.get(id);
}

function listByVillage(villageId) {
  return statements.listByVillage.all(villageId);
}

/** Nº de salas de una colonia (para decidir si sembrar el Núcleo). */
function countByVillage(villageId) {
  return statements.countByVillage.get(villageId).n;
}

/** Crea una sala. `status` por defecto 'constructing'. Devuelve la fila. */
function insert({ villageId, roomType, floor, col, width, status = 'constructing', constructFinishAt = null }) {
  const info = statements.insert.run({
    village_id: villageId,
    room_type: roomType,
    floor,
    col,
    width,
    status,
    construct_finish_at: constructFinishAt,
  });
  return statements.byId.get(info.lastInsertRowid);
}

/** Inicia la mejora de una sala construida. Devuelve true si era elegible. */
function startUpgrade(id, constructFinishAt) {
  return statements.startUpgrade.run({ id, construct_finish_at: constructFinishAt }).changes > 0;
}

/** Redimensiona la huella de una sala (usado en la fusión). */
function resize(id, col, width) {
  statements.resize.run({ id, col, width });
}

/** Mueve una sala construida a otra celda (estado 'moving'). True si era elegible. */
function relocate(id, floor, col, fromFloor, fromCol, constructFinishAt) {
  return statements.relocate.run({
    id, floor, col, from_floor: fromFloor, from_col: fromCol, construct_finish_at: constructFinishAt,
  }).changes > 0;
}

/** Revierte un movimiento en curso (vuelve al origen, built). True si aplicó. */
function revertMove(id) {
  return statements.revertMove.run({ id }).changes > 0;
}

/** Revierte una mejora en curso (baja un nivel, vuelve a built). True si aplicó. */
function revertUpgrade(id) {
  return statements.revertUpgrade.run({ id }).changes > 0;
}

/** Borra una sala (usado en la fusión: la vecina absorbida). */
function remove(id) {
  statements.delete.run(id);
}

/** Pasa a 'built' las construcciones vencidas. Devuelve cuántas se completaron. */
function completeDue(villageId, nowIso) {
  return statements.completeDue.run({ village_id: villageId, now: nowIso }).changes;
}

/** Completa una sala concreta al instante. */
function markBuilt(id) {
  statements.markBuilt.run(id);
}

module.exports = {
  findById,
  listByVillage,
  countByVillage,
  insert,
  startUpgrade,
  resize,
  relocate,
  revertMove,
  revertUpgrade,
  remove,
  completeDue,
  markBuilt,
};
