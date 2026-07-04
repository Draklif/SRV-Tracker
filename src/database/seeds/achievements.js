'use strict';

const db = require('../connection');

/**
 * Catálogo de logros (data-driven, tono anti-culpa: celebran, nunca exigen).
 * Idempotente por `key`: se puede correr en cada arranque sin duplicar.
 */
const ACHIEVEMENTS = [
  // Primeros pasos
  { key: 'primer-paso', name: 'Primer paso', description: 'Completa tu primer registro', icon: '🌱', category: 'milestone', tier: 'bronze', criteria: { type: 'logs_count', value: 1 }, xp: 10 },
  { key: 'en-marcha', name: 'En marcha', description: 'Completa 25 registros', icon: '👟', category: 'milestone', tier: 'bronze', criteria: { type: 'logs_count', value: 25 }, xp: 25 },
  { key: 'imparable', name: 'Imparable', description: 'Completa 100 registros', icon: '🚀', category: 'milestone', tier: 'silver', criteria: { type: 'logs_count', value: 100 }, xp: 50 },
  { key: 'leyenda', name: 'Leyenda', description: 'Completa 500 registros', icon: '🏛️', category: 'milestone', tier: 'gold', criteria: { type: 'logs_count', value: 500 }, xp: 100 },

  // Rachas
  { key: 'chispa', name: 'Chispa', description: 'Racha de 3 días en un hábito', icon: '✨', category: 'streak', tier: 'bronze', criteria: { type: 'streak', value: 3 }, xp: 15 },
  { key: 'fuego', name: 'Fuego', description: 'Racha de 7 días en un hábito', icon: '🔥', category: 'streak', tier: 'bronze', criteria: { type: 'streak', value: 7 }, xp: 25 },
  { key: 'incendio', name: 'Incendio', description: 'Racha de 30 días en un hábito', icon: '🌋', category: 'streak', tier: 'silver', criteria: { type: 'streak', value: 30 }, xp: 60 },
  { key: 'sol', name: 'Sol', description: 'Racha de 100 días en un hábito', icon: '☀️', category: 'streak', tier: 'gold', criteria: { type: 'streak', value: 100 }, xp: 120 },

  // Días completos
  { key: 'dia-redondo', name: 'Día redondo', description: 'Completa todos tus hábitos en un día', icon: '⭕', category: 'consistency', tier: 'bronze', criteria: { type: 'day_complete_count', value: 1 }, xp: 20 },
  { key: 'semana-de-oro', name: 'Semana de oro', description: 'Siete días redondos', icon: '🏆', category: 'consistency', tier: 'silver', criteria: { type: 'day_complete_count', value: 7 }, xp: 50 },
  { key: 'mes-legendario', name: 'Mes legendario', description: 'Treinta días redondos', icon: '👑', category: 'consistency', tier: 'gold', criteria: { type: 'day_complete_count', value: 30 }, xp: 100 },

  // Colección y nivel
  { key: 'coleccionista', name: 'Coleccionista', description: 'Crea 5 hábitos', icon: '🎨', category: 'milestone', tier: 'bronze', criteria: { type: 'habits_count', value: 5 }, xp: 15 },
  { key: 'nivel-5', name: 'Estrella en ascenso', description: 'Alcanza el nivel 5', icon: '⭐', category: 'milestone', tier: 'silver', criteria: { type: 'level', value: 5 }, xp: 40 },
  { key: 'nivel-10', name: 'Constelación', description: 'Alcanza el nivel 10', icon: '🌟', category: 'milestone', tier: 'gold', criteria: { type: 'level', value: 10 }, xp: 80 },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO achievements (key, name, description, icon, category, tier, criteria, xp_reward)
  VALUES (@key, @name, @description, @icon, @category, @tier, @criteria, @xp)
`);

function seedAchievements() {
  let added = 0;
  for (const a of ACHIEVEMENTS) {
    added += insert.run({ ...a, criteria: JSON.stringify(a.criteria) }).changes;
  }
  if (added > 0) console.log(`[seed] ${added} logro(s) nuevos sembrados.`);
}

module.exports = { seedAchievements };
