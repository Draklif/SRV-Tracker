'use strict';

const reactionRepository = require('../models/reactionRepository');
const realtimeService = require('./realtimeService');
const { REACTIONS } = require('../config/constants');
const { ValidationError } = require('../utils/errors');

/** Alterna una reacción y avisa en vivo a todos. Devuelve el nuevo estado. */
function toggle(eventId, userId, emoji) {
  if (!REACTIONS.includes(emoji)) {
    throw new ValidationError({ emoji: 'Reacción no válida' });
  }
  const reacted = reactionRepository.toggle(eventId, userId, emoji);
  const counts = reactionRepository.countsForEvent(eventId);
  const count = (counts.find((c) => c.emoji === emoji) || { n: 0 }).n;

  realtimeService.broadcast('reaction', { eventId, emoji, count, byUserId: userId });
  return { reacted, emoji, count };
}

module.exports = { toggle };
