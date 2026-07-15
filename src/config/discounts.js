'use strict';

/**
 * DESCUENTOS de la tienda: fuente única de verdad.
 *
 * Dos capas, ambas resueltas en el servidor (discountService.js). El cliente
 * nunca ve ni influye en el precio: solo recibe el ya calculado.
 *
 *   WEEKLY → rebajas ROTATIVAS semanales. Se eligen solas cada semana con un
 *            azar SEMBRADO por el número de semana, así que son las mismas para
 *            todos y reproducibles (no hace falta guardarlas en la BD). Rotan
 *            solas cada lunes. Nunca tocan objetos ocultos.
 *
 *   MANUAL → rebajas puestas A MANO aquí. Con ventana de fechas opcional
 *            (`from`/`to`, 'YYYY-MM-DD' inclusivas; sin ellas = siempre). Una
 *            rebaja manual vigente MANDA sobre la semanal del mismo objeto.
 *
 * El descuento es un entero de 0..90 (por ciento). El precio efectivo se
 * redondea (ver discountService.effectivePrice).
 */

/**
 * Rebajas semanales automáticas.
 *   count    → cuántos objetos entran en oferta cada semana.
 *   percents → de qué porcentajes, elegido al azar por objeto.
 */
const WEEKLY = Object.freeze({
  count: 4,
  percents: Object.freeze([10, 15, 20, 25, 30]),
});

/**
 * Rebajas a mano. Ejemplo de forma (déjalas o quítalas a gusto):
 *   { itemKey: 'frame-neon', percent: 25, from: '2026-07-10', to: '2026-07-20' }
 *   { itemKey: 'bg-nocturno', percent: 15 }  // sin fechas = permanente
 */
const MANUAL = Object.freeze([]);

module.exports = { WEEKLY, MANUAL };
