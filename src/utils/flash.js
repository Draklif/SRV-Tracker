'use strict';

/**
 * Mensajes flash efímeros guardados en la sesión: se muestran una vez y se
 * consumen. `type` es 'success' | 'info' | 'warn' para el estilo (nunca "error"
 * culposo en la UI; los problemas se cuentan con cariño).
 */

function addFlash(req, type, message) {
  if (!req.session) return;
  if (!req.session.flash) req.session.flash = [];
  req.session.flash.push({ type, message });
}

function consumeFlash(req) {
  if (!req.session || !req.session.flash) return [];
  const messages = req.session.flash;
  req.session.flash = [];
  return messages;
}

module.exports = { addFlash, consumeFlash };
