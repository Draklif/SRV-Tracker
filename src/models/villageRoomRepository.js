'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de salas de la colonia. Único lugar con SQL de `village_rooms`.
 * Una sala nace en 'constructing' con un `construct_finish_at`; al vencer el
 * timer pasa a 'built' (resolución perezosa al leer, no hay scheduler).
 */

const statements = {
  byId: db.prepare('SELECT * FROM village_rooms WHERE id = ?'),
  byVillageSlot: db.prepare(
    'SELECT * FROM village_rooms WHERE village_id = @village_id AND slot_index = @slot_index'
  ),
  listByVillage: db.prepare('SELECT * FROM village_rooms WHERE village_id = ? ORDER BY slot_index'),
  insert: db.prepare(`
    INSERT INTO village_rooms (village_id, room_type, slot_index, status, construct_finish_at)
    VALUES (@village_id, @room_type, @slot_index, 'constructing', @construct_finish_at)
  `),
  // Sube de nivel una sala YA construida y la pone a construir de nuevo (el
  // nivel objetivo se fija de una; el timer solo controla cuándo vuelve a 'built').
  startUpgrade: db.prepare(`
    UPDATE village_rooms
    SET level = level + 1, status = 'constructing', construct_finish_at = @construct_finish_at
    WHERE id = @id AND status = 'built'
  `),
  // Completa las construcciones/mejoras cuyo timer ya venció.
  completeDue: db.prepare(`
    UPDATE village_rooms SET status = 'built', construct_finish_at = NULL
    WHERE village_id = @village_id AND status = 'constructing' AND construct_finish_at <= @now
  `),
  // Completa una sala concreta al instante (pagar para acelerar).
  markBuilt: db.prepare(
    "UPDATE village_rooms SET status = 'built', construct_finish_at = NULL WHERE id = ?"
  ),
};

function findById(id) {
  return statements.byId.get(id);
}

/** Sala ocupando un slot de la colonia (o undefined si libre). */
function findBySlot(villageId, slotIndex) {
  return statements.byVillageSlot.get({ village_id: villageId, slot_index: slotIndex });
}

function listByVillage(villageId) {
  return statements.listByVillage.all(villageId);
}

/** Crea una sala en construcción. Devuelve la fila. */
function insert({ villageId, roomType, slotIndex, constructFinishAt }) {
  const info = statements.insert.run({
    village_id: villageId,
    room_type: roomType,
    slot_index: slotIndex,
    construct_finish_at: constructFinishAt,
  });
  return statements.byId.get(info.lastInsertRowid);
}

/** Inicia la mejora de una sala construida. Devuelve true si era elegible. */
function startUpgrade(id, constructFinishAt) {
  return statements.startUpgrade.run({ id, construct_finish_at: constructFinishAt }).changes > 0;
}

/** Pasa a 'built' las construcciones vencidas. Devuelve cuántas se completaron. */
function completeDue(villageId, nowIso) {
  return statements.completeDue.run({ village_id: villageId, now: nowIso }).changes;
}

/** Completa una sala concreta al instante. */
function markBuilt(id) {
  statements.markBuilt.run(id);
}

module.exports = { findById, findBySlot, listByVillage, insert, startUpgrade, completeDue, markBuilt };
