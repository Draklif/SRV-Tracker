'use strict';

/**
 * Constantes de dominio compartidas por toda la app.
 * Fuente única de verdad para enums, reglas de XP, paletas, etc.
 */

/** Tipos de hábito soportados. Cada uno determina cómo se registra y se muestra. */
const HABIT_TYPES = Object.freeze({
  CHECKBOX: 'checkbox', // Hecho / no hecho (ej. "Hice ejercicio")
  QUANTITY: 'quantity', // Cantidad acumulable con unidad (ej. agua, pasos)
  DURATION: 'duration', // Tiempo, se guarda en minutos (ej. dormir, estudiar)
  SCALE: 'scale', // Escala 1..N (ej. ánimo, estrés, energía)
  NUMERIC: 'numeric', // Valor puntual con unidad (ej. peso)
  TEXT: 'text', // Texto corto (ej. "¿Qué agradeces hoy?")
});

const HABIT_TYPE_LIST = Object.freeze(Object.values(HABIT_TYPES));

/**
 * Tipos de recurso para la futura "aldea compartida".
 * Se declaran ya para poder asociarlos a hábitos desde el inicio.
 */
const RESOURCE_TYPES = Object.freeze({
  WATER: 'water', // Agua → agua
  ENERGY: 'energy', // Ejercicio → energía
  REST: 'rest', // Sueño → descanso
  KNOWLEDGE: 'knowledge', // Lectura → conocimiento
  FOOD: 'food', // Comida saludable → comida
});

/** Emojis permitidos como reacciones en el feed (solo reacciones, sin comentarios). */
const REACTIONS = Object.freeze(['👏', '🔥', '💪', '❤️', '🎉', '🌱']);

/**
 * Reglas de XP. La app NUNCA resta XP: todos los valores son positivos.
 * Fallar un día solo reinicia la racha (ver streakService).
 */
const XP_RULES = Object.freeze({
  HABIT_LOG: 5, // Registrar cualquier avance en un hábito
  DAILY_TARGET: 10, // Alcanzar la meta diaria de un hábito (1×/día/hábito)
  DAY_COMPLETE: 25, // Completar todos los hábitos activos del día
  // Bonus por hito de racha (días => XP).
  STREAK_MILESTONES: Object.freeze({
    7: 25,
    14: 40,
    30: 60,
    50: 80,
    100: 100,
  }),
});

/** Curva de nivel: XP acumulado necesario para alcanzar el nivel n. */
const LEVEL_CURVE = Object.freeze({
  base: 50, // xpForLevel(n) = base * n^2
});

/** Roles de usuario. */
const ROLES = Object.freeze({
  MEMBER: 'member',
  ADMIN: 'admin',
});

/** Tipos de evento del feed de actividad. */
const ACTIVITY_TYPES = Object.freeze({
  HABIT_COMPLETED: 'habit_completed',
  STREAK_MILESTONE: 'streak_milestone',
  LEVEL_UP: 'level_up',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
});

module.exports = {
  HABIT_TYPES,
  HABIT_TYPE_LIST,
  RESOURCE_TYPES,
  REACTIONS,
  XP_RULES,
  LEVEL_CURVE,
  ROLES,
  ACTIVITY_TYPES,
};
