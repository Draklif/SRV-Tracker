'use strict';

const habitService = require('./habitService');
const streakService = require('./streakService');
const habitLogRepository = require('../models/habitLogRepository');
const withTransaction = require('../database/withTransaction');
const bus = require('../events/eventBus');
const EVENTS = require('../events/events');
const { HABIT_TYPES } = require('../config/constants');
const { todayFor } = require('../utils/date');
const { ValidationError } = require('../utils/errors');

function invalidOp() {
  return new ValidationError({ op: 'Operación no válida para este tipo de hábito' });
}

/**
 * Calcula el nuevo estado del log según el tipo y la operación.
 * Devuelve null si la operación borra el registro del día ('clear').
 */
function computeState(habit, input, existing) {
  if (input.op === 'clear') return null;

  switch (habit.type) {
    case HABIT_TYPES.CHECKBOX: {
      if (input.op !== 'toggle') throw invalidOp();
      const now = existing && existing.completed ? 0 : 1;
      return { value_num: now, value_text: null, completed: now };
    }
    case HABIT_TYPES.QUANTITY:
    case HABIT_TYPES.DURATION: {
      let v = existing && existing.value_num != null ? existing.value_num : 0;
      if (input.op === 'increment') v += input.amount || 0;
      else if (input.op === 'set') v = input.value || 0;
      else throw invalidOp();
      if (v < 0) v = 0;
      const target = habit.target_daily;
      const completed = target ? (v >= target ? 1 : 0) : v > 0 ? 1 : 0;
      return { value_num: v, value_text: null, completed };
    }
    case HABIT_TYPES.SCALE:
    case HABIT_TYPES.NUMERIC: {
      if (input.op !== 'set') throw invalidOp();
      if (input.value == null || Number.isNaN(input.value)) {
        throw new ValidationError({ value: 'Indica un valor' });
      }
      return { value_num: input.value, value_text: null, completed: 1 };
    }
    case HABIT_TYPES.TEXT: {
      if (input.op !== 'text') throw invalidOp();
      const txt = (input.text || '').trim();
      return { value_num: null, value_text: txt || null, completed: txt ? 1 : 0 };
    }
    default:
      throw invalidOp();
  }
}

/**
 * Registra un avance de hábito para HOY (en la tz del usuario), recalcula la
 * racha y emite `habit.logged` en el bus (los subscribers escriben sus
 * recompensas en el contexto). La escritura del log y la racha van en una
 * misma transacción para mantener la coherencia.
 */
function log(habitId, user, input) {
  const habit = habitService.getOwned(habitId, user.id); // valida propiedad
  const date = todayFor(user.timezone);
  const existing = habitLogRepository.get(habitId, date);
  const state = computeState(habit, input, existing);

  const result = withTransaction(() => {
    let logRow = null;
    if (state === null) {
      habitLogRepository.remove(habitId, date);
    } else {
      logRow = habitLogRepository.upsert({
        habit_id: habitId,
        user_id: user.id,
        log_date: date,
        value_num: state.value_num,
        value_text: state.value_text,
        completed: state.completed,
      });
    }
    const streak = streakService.recompute(habitId, date);
    return { log: logRow, streak };
  });

  // Los subscribers (gamificación, feed, recursos) reaccionan aquí.
  const newlyCompleted = Boolean(
    state && state.completed && !(existing && existing.completed)
  );
  const ctx = { user, habit, log: result.log, streak: result.streak, date, newlyCompleted, rewards: null };
  bus.emit(EVENTS.HABIT_LOGGED, ctx);

  return { habit, date, log: result.log, streak: result.streak, rewards: ctx.rewards };
}

module.exports = { log };
