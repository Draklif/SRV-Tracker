'use strict';

const habitRepository = require('../models/habitRepository');
const bus = require('../events/eventBus');
const EVENTS = require('../events/events');
const { HABIT_TYPES } = require('../config/constants');
const { todayFor } = require('../utils/date');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/** Fila cruda → objeto de hábito con `settings` ya parseado. */
function map(row) {
  if (!row) return null;
  let settings = {};
  try {
    settings = JSON.parse(row.settings || '{}');
  } catch {
    settings = {};
  }
  return { ...row, settings };
}

/**
 * Normaliza la frecuencia del input a la forma guardada en `settings.schedule`.
 * Devuelve null para diario (no se guarda: los hábitos sin schedule son diarios).
 */
function normalizeSchedule(input) {
  if (!input || !input.type || input.type === 'daily') return null;
  if (input.type === 'weekdays') {
    const days = [...new Set((input.days || []).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
    if (!days.length || days.length >= 7) return null; // 0 o 7 días = diario
    return { type: 'weekdays', days };
  }
  if (input.type === 'weekly') {
    const n = Number(input.timesPerWeek);
    if (!n || n < 1 || n >= 7) return null; // 7×/semana = diario
    return { type: 'weekly', timesPerWeek: n };
  }
  return null;
}

/** Construye el objeto `settings` (config específica del tipo + frecuencia) desde el input. */
function buildSettings(data) {
  const settings = {};
  if (data.type === HABIT_TYPES.QUANTITY || data.type === HABIT_TYPES.DURATION) {
    if (data.quickAdd && data.quickAdd.length) settings.quickAdd = data.quickAdd;
  }
  if (data.type === HABIT_TYPES.SCALE) {
    settings.scaleMin = data.scaleMin;
    settings.scaleMax = data.scaleMax;
  }
  const schedule = normalizeSchedule(data.schedule);
  if (schedule) settings.schedule = schedule;
  return settings;
}

/** Deriva las columnas unit / target_daily según el tipo. */
function deriveColumns(data) {
  switch (data.type) {
    case HABIT_TYPES.QUANTITY:
      return { unit: data.unit, target_daily: data.targetDaily };
    case HABIT_TYPES.DURATION:
      return { unit: (data.unit && data.unit.trim()) || 'min', target_daily: data.targetDaily ?? null };
    case HABIT_TYPES.NUMERIC:
      return { unit: (data.unit && data.unit.trim()) || null, target_daily: data.targetDaily ?? null };
    default: // checkbox, scale, text
      return { unit: null, target_daily: null };
  }
}

/** Reglas de negocio que la unión discriminada no cubre (ej. límites de escala). */
function validateBusiness(data) {
  if (data.type === HABIT_TYPES.SCALE && data.scaleMax <= data.scaleMin) {
    throw new ValidationError({ scaleMax: 'El máximo debe ser mayor que el mínimo' });
  }
  const sched = data.schedule;
  if (sched && sched.type === 'weekdays') {
    const days = (sched.days || []).filter((d) => d >= 1 && d <= 7);
    if (!days.length) throw new ValidationError({ schedule: 'Elige al menos un día de la semana' });
  }
  if (sched && sched.type === 'weekly') {
    const n = Number(sched.timesPerWeek);
    if (!n || n < 1 || n > 6) {
      throw new ValidationError({ schedule: 'Indica cuántas veces por semana (1 a 6)' });
    }
  }
}

function listActive(userId) {
  return habitRepository.findActiveByUser(userId).map(map);
}

function listArchived(userId) {
  return habitRepository.findArchivedByUser(userId).map(map);
}

/** Obtiene un hábito verificando que pertenezca al usuario. */
function getOwned(id, userId) {
  const habit = habitRepository.findById(id);
  if (!habit) throw new NotFoundError('Hábito no encontrado');
  if (habit.user_id !== userId) throw new ForbiddenError();
  return map(habit);
}

function create(user, data) {
  validateBusiness(data);
  const columns = deriveColumns(data);
  const row = habitRepository.create({
    user_id: user.id,
    name: data.name,
    icon: data.icon,
    color: data.color,
    type: data.type,
    resource_type: data.resourceType,
    unit: columns.unit,
    target_daily: columns.target_daily,
    settings: JSON.stringify(buildSettings(data)),
    sort_order: habitRepository.nextSortOrder(user.id),
  });
  const habit = map(row);

  const ctx = { user, habit, date: todayFor(user.timezone), rewards: null };
  bus.emit(EVENTS.HABIT_CREATED, ctx);

  return { habit, rewards: ctx.rewards };
}

/** Actualiza un hábito. El tipo es inmutable (protege el histórico). */
function update(id, userId, data) {
  const existing = getOwned(id, userId);
  if (data.type !== existing.type) {
    throw new ValidationError({ type: 'No se puede cambiar el tipo de un hábito' });
  }
  if (data.resourceType !== existing.resource_type) {
    throw new ValidationError({ resourceType: 'No se puede cambiar el recurso de un hábito' });
  }
  validateBusiness(data);
  const columns = deriveColumns(data);
  const row = habitRepository.update(id, {
    name: data.name,
    icon: data.icon,
    color: data.color,
    unit: columns.unit,
    target_daily: columns.target_daily,
    settings: JSON.stringify(buildSettings(data)),
  });
  return map(row);
}

function archive(id, userId) {
  getOwned(id, userId);
  return map(habitRepository.setArchived(id, true));
}

function restore(id, userId) {
  getOwned(id, userId);
  return map(habitRepository.setArchived(id, false));
}

/** Reordena los hábitos activos del usuario según `orderedIds`. */
function reorder(userId, orderedIds) {
  const owned = new Set(habitRepository.findActiveByUser(userId).map((h) => h.id));
  if (orderedIds.length !== owned.size || !orderedIds.every((id) => owned.has(id))) {
    throw new ValidationError({ order: 'La lista de orden no coincide con tus hábitos' });
  }
  habitRepository.applyOrder(orderedIds);
  return listActive(userId);
}

module.exports = {
  listActive,
  listArchived,
  getOwned,
  create,
  update,
  archive,
  restore,
  reorder,
};
