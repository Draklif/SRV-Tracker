'use strict';

const { LEVEL_CURVE } = require('../config/constants');

/**
 * Curva de nivel: el nivel n empieza al acumular `base * (n-1)^2` de XP.
 * Nivel 1 = 0 XP. Progresión suave al inicio, más exigente al subir.
 */
function xpForLevel(level) {
  return LEVEL_CURVE.base * (level - 1) ** 2;
}

/** Nivel actual dado un total de XP. */
function levelFromXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

/** Datos de progreso para la barra de nivel del dashboard. */
function levelProgress(xp) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const into = xp - floor;
  const span = ceil - floor;
  return {
    level,
    xp,
    into,
    span,
    toNext: ceil - xp,
    percent: span > 0 ? Math.round((into / span) * 100) : 0,
  };
}

module.exports = { xpForLevel, levelFromXp, levelProgress };
