'use strict';

const xpEventRepository = require('../models/xpEventRepository');
const battlePassRepository = require('../models/battlePassRepository');
const cosmeticsService = require('./cosmeticsService');
const coinService = require('./coinService');
const lootboxService = require('./lootboxService');
const withTransaction = require('../database/withTransaction');
const { todayFor } = require('../utils/date');
const { NotFoundError, ConflictError, ForbiddenError, ValidationError } = require('../utils/errors');
const { activeSeason } = require('../config/seasons');
const { ITEMS_BY_KEY, RARITIES } = require('../config/cosmetics');
const { BOXES_BY_KEY } = require('../config/lootboxes');

/**
 * Pase de batalla. El progreso NO se guarda: el nivel sale de la XP que el
 * usuario ganó dentro de la ventana de la temporada (xpEventRepository.sumBetween),
 * así que reinicia solo en cada temporada. Lo único persistente es si desbloqueó
 * el premium y qué tiers reclamó (battlePassRepository).
 *
 * Como la tienda: el servidor decide todo (nivel alcanzado, precio del premium,
 * si una recompensa ya se cobró) dentro de una transacción. El cliente solo pide.
 */

const TRACKS = ['free', 'premium'];

/** Nivel del pase para una XP de temporada, con tope en el último tier. */
function levelFor(passXp, season) {
  const maxLevel = season.tiers[season.tiers.length - 1].level;
  return Math.max(0, Math.min(Math.floor(passXp / season.xpPerLevel), maxLevel));
}

/** Convierte una recompensa de config en algo pintable por la vista. */
function describeReward(reward) {
  if (!reward) return null;
  if (reward.type === 'coins') {
    return { type: 'coins', amount: reward.amount, label: `${reward.amount} monedas` };
  }
  if (reward.type === 'cosmetic') {
    const item = ITEMS_BY_KEY[reward.key];
    if (!item) return null;
    return {
      type: 'cosmetic',
      item,
      rarity: item.rarity,
      color: RARITIES[item.rarity].color,
      label: item.name,
    };
  }
  if (reward.type === 'lootbox') {
    const box = BOXES_BY_KEY[reward.box];
    return { type: 'lootbox', box: reward.box, label: box ? box.name : 'Caja' };
  }
  return null;
}

/**
 * Estado del pase para pintar /pase. Si no hay temporada activa, devuelve
 * `{ season: null }` y la vista muestra el cartel de "sin temporada".
 */
function stateFor(user) {
  const day = todayFor(user.timezone);
  const season = activeSeason(day);
  if (!season) return { season: null };

  const passXp = xpEventRepository.sumBetween(user.id, season.startDay, season.endDay);
  const maxLevel = season.tiers[season.tiers.length - 1].level;
  const level = levelFor(passXp, season);
  const premium = battlePassRepository.isPremium(user.id, season.id);
  const claimed = battlePassRepository.claimedSet(user.id, season.id);

  // Progreso dentro del nivel actual (barra). Al llegar al tope, lleno.
  const atMax = level >= maxLevel;
  const intoLevel = atMax ? season.xpPerLevel : passXp - level * season.xpPerLevel;
  const percent = atMax ? 100 : Math.round((intoLevel / season.xpPerLevel) * 100);

  const tiers = season.tiers.map((tier) => {
    const reached = level >= tier.level;
    const row = { level: tier.level, reached };
    for (const track of TRACKS) {
      const reward = describeReward(tier[track]);
      if (!reward) {
        row[track] = null;
        continue;
      }
      const isClaimed = claimed.has(`${tier.level}:${track}`);
      const locked = track === 'premium' && !premium;
      row[track] = {
        ...reward,
        claimed: isClaimed,
        locked,
        claimable: reached && !isClaimed && !locked,
      };
    }
    return row;
  });

  return {
    season: {
      id: season.id,
      name: season.name,
      startDay: season.startDay,
      endDay: season.endDay,
      premiumPrice: season.premiumPrice,
      xpPerLevel: season.xpPerLevel,
    },
    passXp,
    level,
    maxLevel,
    atMax,
    percent,
    toNext: atMax ? 0 : season.xpPerLevel - intoLevel,
    premium,
    tiers,
    balance: user.coins || 0,
  };
}

/** Desbloquea el carril premium de la temporada activa (se paga una vez). */
function unlockPremium(user) {
  const day = todayFor(user.timezone);
  const season = activeSeason(day);
  if (!season) throw new NotFoundError('No hay ninguna temporada activa.');

  return withTransaction(() => {
    if (battlePassRepository.isPremium(user.id, season.id)) {
      throw new ConflictError('Ya tienes el premium de esta temporada.');
    }
    if (!coinService.spend(user.id, season.premiumPrice, 'battlepass_premium', season.id, day)) {
      throw new ConflictError('Todavía no te alcanzan las monedas para el premium.');
    }
    battlePassRepository.unlockPremium(user.id, season.id);
    return { premium: true, balance: coinService.balance(user.id) };
  });
}

/**
 * Reclama la recompensa de un tier/carril. Valida nivel alcanzado, premium (si
 * aplica) y que no se haya reclamado ya, todo dentro de la transacción.
 */
function claim(user, level, track) {
  if (!TRACKS.includes(track)) throw new ValidationError({ track: 'Carril inválido.' });

  const day = todayFor(user.timezone);
  const season = activeSeason(day);
  if (!season) throw new NotFoundError('No hay ninguna temporada activa.');

  const tier = season.tiers.find((t) => t.level === level);
  if (!tier) throw new NotFoundError('Ese nivel no existe.');
  const reward = tier[track];
  if (!reward) throw new NotFoundError('No hay recompensa en ese hueco.');

  return withTransaction(() => {
    const passXp = xpEventRepository.sumBetween(user.id, season.startDay, season.endDay);
    if (levelFor(passXp, season) < level) {
      throw new ConflictError('Todavía no has llegado a ese nivel.');
    }
    if (track === 'premium' && !battlePassRepository.isPremium(user.id, season.id)) {
      throw new ForbiddenError('Necesitas el premium para esa recompensa.');
    }
    if (battlePassRepository.isClaimed(user.id, season.id, level, track)) {
      throw new ConflictError('Ya reclamaste esa recompensa.');
    }

    if (reward.type === 'coins') {
      coinService.credit(user.id, reward.amount, 'battlepass', day);
    } else if (reward.type === 'cosmetic') {
      cosmeticsService.grant(user.id, reward.key, 'battlepass');
    } else if (reward.type === 'lootbox') {
      lootboxService.grantBox(user.id, reward.box, 1);
    }

    battlePassRepository.claim(user.id, season.id, level, track);

    return { reward: describeReward(reward), level, track, balance: coinService.balance(user.id) };
  });
}

module.exports = { stateFor, unlockPremium, claim };
