'use strict';

/**
 * Logger minimalista con niveles y timestamp. Suficiente para el proyecto;
 * se puede sustituir por pino/winston sin cambiar los llamadores.
 */

function ts() {
  return new Date().toISOString();
}

function log(level, args) {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${ts()}] ${level.toUpperCase()}`, ...args);
}

module.exports = {
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
};
