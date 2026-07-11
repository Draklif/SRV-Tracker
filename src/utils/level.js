'use strict';

const { LEVEL_CURVE, RESOURCE_LEVEL_BASE } = require('../config/constants');

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

/**
 * Nivel de una DIMENSIÓN a partir de su total acumulado. Es la inversa continua
 * de la curva de XP (`base·n²`), con su propia escala: las dimensiones se
 * acumulan a ~3 pts/día/hábito frente a los ~15 del XP.
 *
 * Continua (no entera) a propósito: así cada registro la mueve un poco. Y el
 * `+1` es el SUELO: una dimensión sin tocar vale 1, nunca 0 — lo que impide que
 * un vértice colapse al centro del radar y deforme el polígono.
 *
 * La raíz comprime la cima: sin ella, 600 puntos contra 10 serían 60:1 y el
 * hexágono sería una aguja. Con ella son ~3.8:1, distinguibles sin deformar.
 */
function axisLevel(total) {
  return 1 + Math.sqrt(Math.max(total, 0) / RESOURCE_LEVEL_BASE);
}

module.exports = { xpForLevel, levelFromXp, levelProgress, axisLevel };
