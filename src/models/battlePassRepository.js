'use strict';

const db = require('../database/connection');

/**
 * Estado del pase por usuario y temporada: si tiene el premium desbloqueado
 * (battlepass_progress) y qué recompensas de tier ya reclamó (battlepass_claims).
 * El PROGRESO (nivel) no se guarda: se calcula de la XP de la temporada.
 */

const statements = {
  premiumRow: db.prepare(
    'SELECT premium FROM battlepass_progress WHERE user_id = ? AND season_id = ?'
  ),
  unlockPremium: db.prepare(`
    INSERT INTO battlepass_progress (user_id, season_id, premium, unlocked_at)
    VALUES (@user_id, @season_id, 1, @now)
    ON CONFLICT(user_id, season_id) DO UPDATE SET premium = 1, unlocked_at = @now
  `),
  claims: db.prepare(
    'SELECT level, track FROM battlepass_claims WHERE user_id = ? AND season_id = ?'
  ),
  // INSERT llano: la PK (usuario, temporada, nivel, carril) es la guarda contra
  // el doble cobro. changes === 0 nunca pasa (colisión lanza), pero validamos
  // antes en el service, así que aquí llega limpio.
  claim: db.prepare(`
    INSERT INTO battlepass_claims (user_id, season_id, level, track)
    VALUES (@user_id, @season_id, @level, @track)
  `),
  isClaimed: db.prepare(
    'SELECT 1 FROM battlepass_claims WHERE user_id = ? AND season_id = ? AND level = ? AND track = ?'
  ),
};

/** ¿Tiene el usuario el premium de esa temporada? */
function isPremium(userId, seasonId) {
  const row = statements.premiumRow.get(userId, seasonId);
  return !!(row && row.premium);
}

/** Marca el premium de la temporada como desbloqueado. */
function unlockPremium(userId, seasonId) {
  statements.unlockPremium.run({
    user_id: userId,
    season_id: seasonId,
    now: new Date().toISOString(),
  });
}

/** Set de recompensas reclamadas, como claves `${level}:${track}`. */
function claimedSet(userId, seasonId) {
  const set = new Set();
  for (const row of statements.claims.all(userId, seasonId)) set.add(`${row.level}:${row.track}`);
  return set;
}

/** ¿Ya reclamó ese usuario ese tier/carril? */
function isClaimed(userId, seasonId, level, track) {
  return !!statements.isClaimed.get(userId, seasonId, level, track);
}

/** Registra la reclamación (la PK impide repetirla). */
function claim(userId, seasonId, level, track) {
  statements.claim.run({ user_id: userId, season_id: seasonId, level, track });
}

module.exports = { isPremium, unlockPremium, claimedSet, isClaimed, claim };
