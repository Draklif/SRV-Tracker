'use strict';

const logger = require('../utils/logger');

/**
 * Tiempo real por SSE. Mantiene las conexiones abiertas y empuja eventos a
 * todos los navegadores del grupo. Desacoplado del transporte: si algún día
 * migramos a WebSockets, solo cambia este archivo.
 */

const clients = new Set();
const HEARTBEAT_MS = 25000;

// Latido periódico para que proxies/navegadores no cierren la conexión.
setInterval(() => {
  for (const res of clients) {
    try {
      res.write(': ping\n\n');
    } catch {
      clients.delete(res);
    }
  }
}, HEARTBEAT_MS).unref();

/** Registra una conexión SSE ya inicializada (headers enviados). */
function addClient(res) {
  clients.add(res);
  return () => clients.delete(res);
}

/** Empuja un evento a todos los clientes conectados. */
function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(frame);
    } catch (err) {
      clients.delete(res);
      logger.warn('[realtime] cliente desconectado con error:', err.message);
    }
  }
}

function clientCount() {
  return clients.size;
}

module.exports = { addClient, broadcast, clientCount };
