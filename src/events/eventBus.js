'use strict';

const { EventEmitter } = require('events');

/**
 * Bus de eventos de dominio (singleton). Los services emiten hechos
 * ("habit.logged") y los subscribers reaccionan sin acoplarse entre sí.
 *
 * `emit` de EventEmitter es SÍNCRONO: los subscribers pueden escribir sus
 * resultados en el payload (ctx.rewards) y el emisor los lee al volver.
 * Las features futuras se enchufan aquí sin tocar el flujo existente.
 */
const bus = new EventEmitter();
bus.setMaxListeners(30);

module.exports = bus;
