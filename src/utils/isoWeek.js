'use strict';

/**
 * Número de semana estable a partir de un día 'YYYY-MM-DD'.
 *
 * No pretende ser la semana ISO "de calendario": es un ENTERO monótono, uno por
 * cada semana natural (lunes→domingo), pensado para SEMBRAR el azar de las
 * rebajas semanales (ver discountService). Lo único que importa es que dos días
 * de la misma semana den el mismo número y que cambie cada lunes.
 *
 * El epoch Unix (1970-01-01) cae en jueves; restando 4 días alineamos el corte
 * en lunes, de modo que lunes..domingo comparten índice.
 */
function weekKey(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  if (!y || !m || !d) return 0;
  const daysSinceEpoch = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return Math.floor((daysSinceEpoch - 4) / 7);
}

module.exports = { weekKey };
