'use strict';

const CHANGELOG = require('../config/changelog');
const userRepository = require('../models/userRepository');

/**
 * Novedades. El contenido vive en src/config/changelog.js; aquí solo está la
 * lógica de "qué ha visto ya este usuario", para que ni las vistas ni los
 * controladores toquen el array directamente.
 *
 * El seguimiento es por versión, no por entrada: guardamos en el usuario la
 * última versión publicada cuando visitó /novedades y comparamos por igualdad.
 */

/** La entrada más reciente (el array va de más nueva a más vieja), o null. */
function latest() {
  return CHANGELOG.length ? CHANGELOG[0] : null;
}

/** La versión más reciente publicada. */
function latestVersion() {
  return CHANGELOG.length ? CHANGELOG[0].version : '';
}

/** ¿Tiene el usuario novedades sin leer? */
function hasUnseen(user) {
  if (!user || !CHANGELOG.length) return false;
  return user.changelog_seen !== latestVersion();
}

/**
 * Las entradas para un usuario, marcando con `isNew` las que no había visto.
 * Como el array está ordenado, todo lo que hay por encima de la versión que
 * tenía guardada es nuevo para él (si no había visto ninguna, todas lo son).
 */
function entriesFor(user) {
  const seen = (user && user.changelog_seen) || '';
  const seenIndex = CHANGELOG.findIndex((entry) => entry.version === seen);
  const newCount = seenIndex === -1 ? CHANGELOG.length : seenIndex;
  return CHANGELOG.map((entry, i) => ({ ...entry, isNew: i < newCount }));
}

/** Marca al usuario al día: ya ha visto todo lo publicado hasta ahora. */
function markSeen(userId) {
  userRepository.setChangelogSeen(userId, latestVersion());
}

module.exports = { latest, latestVersion, hasUnseen, entriesFor, markSeen };
