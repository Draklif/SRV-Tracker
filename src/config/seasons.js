'use strict';

/**
 * Temporadas del PASE DE BATALLA: fuente única de verdad, como cosmetics.js.
 *
 * Cada temporada es una ventana de fechas [startDay, endDay] con una lista de
 * niveles (`tiers`), cada uno con hasta dos recompensas: la del carril GRATUITO
 * (para todos) y la del carril PREMIUM (solo si has desbloqueado el premium de
 * esa temporada, que se paga UNA vez con monedas).
 *
 * El progreso del pase = la XP que el usuario gana DENTRO de la ventana de la
 * temporada (se suma de xp_events por `day`). No es un contador nuevo: es tu XP
 * de siempre, pero acotada a la temporada, así que reinicia en cada una. El
 * nivel sale de dividir esa XP entre `xpPerLevel` (tope: el último tier).
 *
 * Una recompensa es { type, ... }:
 *   { type: 'coins',    amount }        → acredita monedas
 *   { type: 'cosmetic', key }           → concede un cosmético del catálogo
 *   { type: 'lootbox',  box }           → añade una caja al inventario
 * El carril premium es el sitio natural para los cosméticos `hidden`
 * (exclusivos del pase). Un tier puede tener `free: null` o `premium: null`.
 *
 * Añadir una temporada = una entrada aquí. Las ventanas NO deben solaparse:
 * activeSeason() devuelve la primera que contenga el día.
 *
 * ⚠️ REGLA CRÍTICA: `startDay` NUNCA debe ser anterior a la fecha en la que la
 * temporada estuvo REALMENTE disponible. Como el progreso = SUM(xp_events) dentro
 * de la ventana, un startDay que preceda al lanzamiento cuenta XP de hábitos ya
 * acumulada y completa el pase de golpe para todo usuario activo. Fue exactamente
 * lo que pasó con s1 (startDay '2026-07-01' vs. lanzamiento del pase el 14-jul):
 * la ventana se movió a la fecha de deploy para reiniciar el progreso a ~0. Los
 * cosméticos, monedas, cajas y battlepass_claims ya otorgados se conservan.
 */

const SEASONS = Object.freeze([
  {
    id: 's1',
    name: 'Temporada 1: Primeros pasos',
    startDay: '2026-07-16',
    endDay: '2026-09-16',
    premiumPrice: 800,
    xpPerLevel: 200,
    tiers: Object.freeze([
      { level: 1, free: { type: 'coins', amount: 50 }, premium: { type: 'cosmetic', key: 'title-pionero' } },
      { level: 2, free: { type: 'lootbox', box: 'caja-comun' }, premium: { type: 'coins', amount: 100 } },
      { level: 3, free: { type: 'coins', amount: 75 }, premium: { type: 'cosmetic', key: 'deco-cometa' } },
      { level: 4, free: { type: 'coins', amount: 100 }, premium: { type: 'lootbox', box: 'caja-rara' } },
      { level: 5, free: { type: 'lootbox', box: 'caja-comun' }, premium: { type: 'coins', amount: 200 } },
      { level: 6, free: { type: 'coins', amount: 150 }, premium: { type: 'cosmetic', key: 'frame-vortice' } },
      { level: 7, free: { type: 'coins', amount: 200 }, premium: { type: 'lootbox', box: 'caja-rara' } },
      { level: 8, free: { type: 'coins', amount: 300 }, premium: { type: 'lootbox', box: 'caja-legendaria' } },
    ]),
  },
]);

const SEASONS_BY_ID = Object.freeze(Object.fromEntries(SEASONS.map((s) => [s.id, s])));

/**
 * La temporada activa para un día 'YYYY-MM-DD' (comparación lexicográfica, que
 * en ese formato coincide con el orden cronológico). null si ninguna lo cubre.
 */
function activeSeason(day) {
  return SEASONS.find((s) => day >= s.startDay && day <= s.endDay) || null;
}

module.exports = { SEASONS, SEASONS_BY_ID, activeSeason };
