'use strict';

const activityRepository = require('../models/activityRepository');
const reactionRepository = require('../models/reactionRepository');
const friendshipService = require('./friendshipService');
const { ACTIVITY_TYPES } = require('../config/constants');

/**
 * Feed de actividad acotado a los amigos del usuario (más su propia actividad).
 * Los eventos se crean desde el subscriber del bus; aquí vive el ensamblado y el
 * cálculo de qué autores puede ver cada usuario.
 */

/** Autores visibles para `userId`: sus amigos aceptados + él mismo (JSON). */
function visibleAuthorIds(userId) {
  return JSON.stringify([userId, ...friendshipService.friendIds(userId)]);
}

/** Adjunta las reacciones agregadas a cada evento del feed. */
function withReactions(events, userId) {
  if (!events.length) return [];
  const rows = reactionRepository.forEvents(events.map((e) => e.id), userId);
  const byEvent = new Map();
  for (const r of rows) {
    if (!byEvent.has(r.activity_event_id)) byEvent.set(r.activity_event_id, []);
    byEvent.get(r.activity_event_id).push({ emoji: r.emoji, count: r.n, mine: Boolean(r.mine) });
  }
  return events.map((e) => ({
    ...e,
    payload: JSON.parse(e.payload || '{}'),
    reactions: byEvent.get(e.id) || [],
  }));
}

function feed(userId, limit = 30) {
  return withReactions(activityRepository.feed(visibleAuthorIds(userId), limit), userId);
}

function feedAfter(userId, afterId) {
  return withReactions(activityRepository.after(visibleAuthorIds(userId), afterId), userId);
}

/** Crea un evento si no existe ya uno igual hoy (anti-spam del feed). */
function recordOncePerDay(userId, type, habitId, day, payload) {
  if (activityRepository.existsForDay(userId, type, habitId, day)) return null;
  return activityRepository.insert(userId, type, { ...payload, habitId, day });
}

function record(userId, type, payload) {
  return activityRepository.insert(userId, type, payload);
}

module.exports = { feed, feedAfter, recordOncePerDay, record, ACTIVITY_TYPES };
