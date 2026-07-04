'use strict';

const gamification = require('./gamification');

/**
 * Registra todos los subscribers del bus. Se llama una vez al crear la app.
 * Los milestones futuros (activity, realtime, village…) se añaden aquí.
 */
let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  gamification.register();
}

module.exports = { registerAll };
