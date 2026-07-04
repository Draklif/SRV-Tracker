'use strict';

const gamification = require('./gamification');
const activity = require('./activity');

/**
 * Registra todos los subscribers del bus. Se llama una vez al crear la app.
 * EL ORDEN IMPORTA: activity lee ctx.rewards que escribe gamification.
 * Los módulos futuros (village…) se añaden aquí.
 */
let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  gamification.register();
  activity.register();
}

module.exports = { registerAll };
