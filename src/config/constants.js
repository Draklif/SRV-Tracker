'use strict';

/**
 * Constantes de dominio compartidas por toda la app.
 * Fuente única de verdad para enums, reglas de XP, paletas, etc.
 */

/** Tipos de hábito soportados. Cada uno determina cómo se registra y se muestra. */
const HABIT_TYPES = Object.freeze({
  CHECKBOX: 'checkbox', // Hecho / no hecho (ej. "Hice ejercicio")
  QUANTITY: 'quantity', // Cantidad acumulable con unidad (ej. agua, pasos)
  DURATION: 'duration', // Tiempo, con unidad configurable (min por defecto; ej. dormir, estudiar)
  SCALE: 'scale', // Escala 1..N (ej. ánimo, estrés, energía)
  NUMERIC: 'numeric', // Valor puntual con unidad (ej. peso)
  TEXT: 'text', // Texto corto (ej. "¿Qué agradeces hoy?")
});

const HABIT_TYPE_LIST = Object.freeze(Object.values(HABIT_TYPES));

/**
 * Metadatos de cada tipo de hábito para la UI (etiqueta, icono sugerido,
 * descripción y qué campos del formulario aplican). Fuente única para el
 * selector de tipo y para la lógica de campos dinámicos del cliente.
 */
const HABIT_TYPE_META = Object.freeze({
  checkbox: { label: 'Sí / No', icon: '✅', desc: 'Hecho o no hecho', fields: [] },
  quantity: { label: 'Cantidad', icon: '💧', desc: 'Suma con unidad (agua, pasos…)', fields: ['unit', 'target', 'quickAdd'] },
  duration: { label: 'Tiempo', icon: '⏱️', desc: 'Duración (dormir, estudiar…)', fields: ['unit', 'target', 'quickAdd'] },
  scale: { label: 'Escala', icon: '😊', desc: 'Del 1 al N (ánimo, energía…)', fields: ['scale'] },
  numeric: { label: 'Número', icon: '⚖️', desc: 'Un valor con unidad (peso…)', fields: ['unit', 'target'] },
  text: { label: 'Nota', icon: '📝', desc: 'Texto corto (gratitud…)', fields: [] },
});

/**
 * Paleta de colores de hábito: clave → hex. Se guarda la clave en la BD y se
 * resuelve el hex en las vistas. Alineada con el tema azul cozy.
 */
const HABIT_COLORS = Object.freeze({
  blue: '#4f8cff',
  teal: '#39c6d6',
  green: '#4fce8f',
  purple: '#8f7bf2',
  pink: '#d97ba8',
  coral: '#e8945a',
  amber: '#ffcf66',
  red: '#ff6b6b',
});

const HABIT_COLOR_KEYS = Object.freeze(Object.keys(HABIT_COLORS));

/** Emojis sugeridos en el selector de icono (se puede escribir uno propio). */
const HABIT_ICON_SUGGESTIONS = Object.freeze([
  '💧', '🏋️', '📖', '🧘', '🏃', '🚶', '😴', '🥗', '💊', '🧠',
  '✍️', '🎨', '🎸', '💻', '🌱', '☀️', '💤', '🚭', '🙏', '⚖️',
  '🦷', '💦', '🍎', '☕', '🎯',
]);

/**
 * Las seis DIMENSIONES de vida. Cada hábito pertenece a una, y registrarlo
 * genera puntos en ella. Por eso el total de un usuario es un VECTOR de seis
 * números, no un escalar: el XP dice cuánto esfuerzo hizo, las dimensiones
 * dicen en qué áreas lo repartió. De ahí sale el radar del perfil.
 *
 * (En el código se siguen llamando "recursos" —`resource_type`,
 * `resource_events`— por continuidad con el esquema; en la UI son dimensiones.)
 */
const RESOURCE_TYPES = Object.freeze({
  BODY: 'body', // Ejercicio, dormir, comer, hidratarse
  MIND: 'mind', // Leer, estudiar, aprender
  CALM: 'calm', // Meditar, escribir, respirar
  SOCIAL: 'social', // Gente: llamar, quedar, escribir
  CRAFT: 'craft', // Crear, trabajo profundo, proyectos
  ORDER: 'order', // Limpiar, finanzas, papeleo
});

const RESOURCE_TYPE_KEYS = Object.freeze(Object.values(RESOURCE_TYPES));

/**
 * Metadatos de cada dimensión para la UI (etiqueta, icono, descripción).
 * Fuente única para el selector del formulario y el radar del perfil.
 * Mismo patrón que HABIT_TYPE_META.
 */
const RESOURCE_TYPE_META = Object.freeze({
  body: { label: 'Cuerpo', icon: '🏃', desc: 'Ejercicio, sueño, comida, agua' },
  mind: { label: 'Mente', icon: '📚', desc: 'Leer, estudiar, aprender' },
  calm: { label: 'Calma', icon: '🧘', desc: 'Meditar, escribir, respirar' },
  social: { label: 'Social', icon: '💬', desc: 'Cuidar a los tuyos' },
  craft: { label: 'Oficio', icon: '🎨', desc: 'Crear, construir, trabajo profundo' },
  order: { label: 'Orden', icon: '🧹', desc: 'Casa, cuentas, papeleo' },
});

/**
 * Puntos generados por registrar un hábito, en la dimensión del hábito. Como el
 * XP, nunca se restan. Un avance real otorga ON_PROGRESS; alcanzar la meta
 * diaria otorga ON_COMPLETE adicional (completar da la suma, 3). Idempotente
 * por día: el techo de un hábito es 3 pts/día, 21 pts/semana.
 */
const RESOURCE_RULES = Object.freeze({
  ON_PROGRESS: 1, // Registrar cualquier avance real en un hábito
  ON_COMPLETE: 2, // Alcanzar la meta diaria (además del avance)
});

/**
 * Curva del nivel de cada dimensión (la insignia de cada vértice del radar):
 * nivel(total) = 1 + √(total / base). Es la inversa continua de la curva de XP
 * (`base·n²`, ver utils/level.js) pero con su propia escala: los puntos de
 * dimensión se acumulan a ~3/día/hábito frente a los ~15/día del XP.
 *
 * El nivel es la capa de PROGRESIÓN (acumulado de siempre, nunca baja). El
 * radar es la capa de COMPARACIÓN (media semanal vs. últimos 7 días). Van
 * aparte a propósito: la media semanal se estanca, el nivel no.
 */
const RESOURCE_LEVEL_BASE = 20;

/** Ventana RODANTE del polígono interior del radar. Rodante y no semana natural
 *  a propósito: con semana de calendario el radar estaría hundido cada lunes y
 *  lleno cada domingo, un artefacto que parecería una señal. */
const RADAR_WINDOW_DAYS = 7;

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

/** Vida de un código de invitación generado por un usuario (minutos). */
const INVITE_TTL_MINUTES = 60;

/** Roles de usuario. */
const ROLES = Object.freeze({
  MEMBER: 'member',
  ADMIN: 'admin',
});

/** Estado de una relación de amistad (tabla friendships). */
const FRIENDSHIP_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
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
  HABIT_TYPE_META,
  HABIT_COLORS,
  HABIT_COLOR_KEYS,
  HABIT_ICON_SUGGESTIONS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_KEYS,
  RESOURCE_TYPE_META,
  RESOURCE_RULES,
  RESOURCE_LEVEL_BASE,
  RADAR_WINDOW_DAYS,
  REACTIONS,
  XP_RULES,
  LEVEL_CURVE,
  INVITE_TTL_MINUTES,
  ROLES,
  FRIENDSHIP_STATUS,
  ACTIVITY_TYPES,
};
