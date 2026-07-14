'use strict';

const gamification = require('./gamification');
const coins = require('./coins');
const activity = require('./activity');
const resource = require('./resource');

/**
 * Registra todos los subscribers del bus. Se llama una vez al crear la app.
 * EL ORDEN IMPORTA: gamification va primero porque los demás dependen de lo que
 * deja hecho. activity lee el ctx.rewards que escribe; coins lee las filas de
 * xp_events que escribe (y añade las suyas a ctx.rewards sin pisar las de nadie).
 * resource no toca ctx.rewards, así que su orden es indiferente.
 */
let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  gamification.register();
  coins.register();
  activity.register();
  resource.register();
}

module.exports = { registerAll };
