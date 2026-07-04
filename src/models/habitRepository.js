'use strict';

const db = require('../database/connection');

/**
 * Acceso a datos de hábitos. Único lugar con SQL de la tabla `habits`.
 * `settings` se guarda/lee como texto JSON; el mapeo lo hace el service.
 */

const statements = {
  insert: db.prepare(`
    INSERT INTO habits (user_id, name, icon, color, type, unit, target_daily, settings, sort_order)
    VALUES (@user_id, @name, @icon, @color, @type, @unit, @target_daily, @settings, @sort_order)
  `),
  byId: db.prepare('SELECT * FROM habits WHERE id = ?'),
  activeByUser: db.prepare(`
    SELECT * FROM habits WHERE user_id = ? AND is_archived = 0 ORDER BY sort_order, id
  `),
  archivedByUser: db.prepare(`
    SELECT * FROM habits WHERE user_id = ? AND is_archived = 1 ORDER BY updated_at DESC
  `),
  update: db.prepare(`
    UPDATE habits
    SET name = @name, icon = @icon, color = @color, unit = @unit,
        target_daily = @target_daily, settings = @settings, updated_at = datetime('now')
    WHERE id = @id
  `),
  setArchived: db.prepare(`
    UPDATE habits SET is_archived = @archived, updated_at = datetime('now') WHERE id = @id
  `),
  setSort: db.prepare('UPDATE habits SET sort_order = @sortOrder WHERE id = @id'),
  maxSort: db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM habits WHERE user_id = ?'),
};

function create(habit) {
  const info = statements.insert.run(habit);
  return statements.byId.get(info.lastInsertRowid);
}

function findById(id) {
  return statements.byId.get(id);
}

function findActiveByUser(userId) {
  return statements.activeByUser.all(userId);
}

function findArchivedByUser(userId) {
  return statements.archivedByUser.all(userId);
}

function update(id, fields) {
  statements.update.run({ id, ...fields });
  return statements.byId.get(id);
}

function setArchived(id, archived) {
  statements.setArchived.run({ id, archived: archived ? 1 : 0 });
  return statements.byId.get(id);
}

function nextSortOrder(userId) {
  return statements.maxSort.get(userId).m + 1;
}

/** Reordena en una transacción: sort_order = posición en `orderedIds`. */
function applyOrder(orderedIds) {
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => statements.setSort.run({ id, sortOrder: index }));
  });
  tx(orderedIds);
}

module.exports = {
  create,
  findById,
  findActiveByUser,
  findArchivedByUser,
  update,
  setArchived,
  nextSortOrder,
  applyOrder,
};
