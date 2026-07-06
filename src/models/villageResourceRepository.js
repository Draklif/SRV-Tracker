'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos del tesoro compartido y su historial. Único lugar con SQL de
 * `village_resources` (balance mutable) y `village_transactions` (ledger).
 *
 * A diferencia de resource_events (personal, append-only, nunca resta), el
 * tesoro de la colonia SÍ es mutable: sube con aportes, baja al construir.
 * Los aportes se hacen idempotentes por el índice único parcial de la tabla.
 */

const statements = {
  ensureRow: db.prepare(
    'INSERT OR IGNORE INTO village_resources (village_id, resource_type, balance) VALUES (@village_id, @resource_type, 0)'
  ),
  balances: db.prepare('SELECT resource_type, balance FROM village_resources WHERE village_id = ?'),
  addBalance: db.prepare(`
    UPDATE village_resources SET balance = balance + @delta
    WHERE village_id = @village_id AND resource_type = @resource_type
  `),
  // Fija el balance a un valor (upsert). Solo para utilidades de desarrollo.
  setBalance: db.prepare(`
    INSERT INTO village_resources (village_id, resource_type, balance)
    VALUES (@village_id, @resource_type, @balance)
    ON CONFLICT(village_id, resource_type) DO UPDATE SET balance = @balance
  `),
  // Aporte idempotente: si ya existía (mismo dedupe), INSERT OR IGNORE no inserta.
  insertContributionIfNew: db.prepare(`
    INSERT OR IGNORE INTO village_transactions
      (village_id, resource_type, amount, reason, actor_id, source_type, source_id, day)
    VALUES (@village_id, @resource_type, @amount, @reason, @actor_id, @source_type, @source_id, @day)
  `),
  // Gasto (construcción): siempre se registra.
  insertSpend: db.prepare(`
    INSERT INTO village_transactions
      (village_id, resource_type, amount, reason, actor_id, source_type, source_id, day)
    VALUES (@village_id, @resource_type, @amount, @reason, @actor_id, @source_type, @source_id, @day)
  `),
  // Materiales gastados en una sala (suma de gastos de construcción, positivo).
  spentByRoom: db.prepare(`
    SELECT resource_type, COALESCE(SUM(-amount), 0) AS spent
    FROM village_transactions
    WHERE village_id = @village_id AND source_type = 'room' AND source_id = @room_id AND reason = 'construction'
    GROUP BY resource_type
  `),
};

/** Crea (si faltan) las filas de balance en 0 para los recursos dados. */
function ensureRows(villageId, resourceTypes) {
  for (const rt of resourceTypes) {
    statements.ensureRow.run({ village_id: villageId, resource_type: rt });
  }
}

/** Balances actuales: [{ resource_type, balance }]. */
function balances(villageId) {
  return statements.balances.all(villageId);
}

/** Suma (o resta, con delta negativo) al balance de un recurso. */
function addBalance(villageId, resourceType, delta) {
  statements.addBalance.run({ village_id: villageId, resource_type: resourceType, delta });
}

/** Fija el balance de un recurso (utilidad de desarrollo). */
function setBalance(villageId, resourceType, balance) {
  statements.setBalance.run({ village_id: villageId, resource_type: resourceType, balance });
}

/** Registra un aporte idempotente. Devuelve true si era nuevo (se acreditó). */
function insertContributionIfNew(tx) {
  return statements.insertContributionIfNew.run(tx).changes > 0;
}

/** Registra un gasto en el ledger (delta ya viene negativo). */
function insertSpend(tx) {
  statements.insertSpend.run(tx);
}

/** Materiales gastados en una sala: { resource_type: spent(+) }. */
function spentByRoom(villageId, roomId) {
  const rows = statements.spentByRoom.all({ village_id: villageId, room_id: roomId });
  return Object.fromEntries(rows.map((r) => [r.resource_type, r.spent]));
}

module.exports = { ensureRows, balances, addBalance, setBalance, insertContributionIfNew, insertSpend, spentByRoom };
