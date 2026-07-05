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
 * Tipos de recurso para la futura "aldea compartida".
 * Se declaran ya para poder asociarlos a hábitos desde el inicio.
 */
const RESOURCE_TYPES = Object.freeze({
  WATER: 'water', // Agua → agua
  ENERGY: 'energy', // Ejercicio / sueño → energía
  KNOWLEDGE: 'knowledge', // Lectura → conocimiento
  FOOD: 'food', // Comida saludable → comida
});

const RESOURCE_TYPE_KEYS = Object.freeze(Object.values(RESOURCE_TYPES));

/**
 * Metadatos de cada recurso para la UI (etiqueta, icono, descripción).
 * Fuente única para el selector del formulario y la vitrina del perfil.
 * Mismo patrón que HABIT_TYPE_META.
 */
const RESOURCE_TYPE_META = Object.freeze({
  water: { label: 'Agua', icon: '💧', desc: 'Hidratación y limpieza' },
  energy: { label: 'Energía', icon: '⚡', desc: 'Movimiento, ejercicio y descanso' },
  knowledge: { label: 'Conocimiento', icon: '📚', desc: 'Lectura y estudio' },
  food: { label: 'Comida', icon: '🍎', desc: 'Nutrición y alimentación' },
});

/**
 * Recursos generados por registrar un hábito. Como el XP, nunca se restan.
 * Un avance real otorga ON_PROGRESS; alcanzar la meta diaria otorga
 * ON_COMPLETE adicional (completar da la suma). Idempotente por día.
 */
const RESOURCE_RULES = Object.freeze({
  ON_PROGRESS: 1, // Registrar cualquier avance real en un hábito
  ON_COMPLETE: 2, // Alcanzar la meta diaria (además del avance)
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
  VILLAGE_ROOM_BUILT: 'village_room_built',
  VILLAGE_JOINED: 'village_joined',
});

/* ─────────────────────────  La Colonia (aldea)  ───────────────────────── */

/** Estado de una membresía de colonia (tabla village_members). */
const MEMBER_STATUS = Object.freeze({
  PENDING: 'pending', // Invitado, aún no acepta
  ACTIVE: 'active', // Miembro de pleno derecho
});

/** Nº de slots (posiciones de construcción) de la rejilla de la colonia. */
const VILLAGE_MAX_SLOTS = 12;

/**
 * Tipos de sala construibles. El reskin es sci-fi (base espacial), pero cada
 * sala se ancla a uno de los 4 recursos primarios (ver RESOURCE_TYPES).
 */
const ROOM_TYPES = Object.freeze({
  RECICLADOR: 'reciclador', // 💧 agua
  REACTOR: 'reactor', // ⚡ energía
  LABORATORIO: 'laboratorio', // 📚 conocimiento
  HIDROPONIA: 'hidroponia', // 🍞 comida
  ALMACEN: 'almacen', // 🔩 infraestructura
});

const ROOM_TYPE_KEYS = Object.freeze(Object.values(ROOM_TYPES));

/**
 * Metadatos de cada sala para la UI y la economía de construcción. Mismo patrón
 * que HABIT_TYPE_META / RESOURCE_TYPE_META. `cost` es el coste base (nivel 1);
 * las mejoras escalan el coste por nivel en el servicio. `buildMinutes` es la
 * duración de la construcción (timer perezoso). Costes tuneables.
 */
const ROOM_META = Object.freeze({
  reciclador: { label: 'Reciclador', icon: '💧', resource: 'water', desc: 'Purifica y almacena agua/O₂.', cost: { water: 20 }, buildMinutes: 120 },
  reactor: { label: 'Reactor', icon: '⚡', resource: 'energy', desc: 'Genera y distribuye energía a la base.', cost: { energy: 20 }, buildMinutes: 120 },
  laboratorio: { label: 'Laboratorio', icon: '📚', resource: 'knowledge', desc: 'Investigación: base de futuros desbloqueos.', cost: { knowledge: 25 }, buildMinutes: 180 },
  hidroponia: { label: 'Hidroponía', icon: '🍞', resource: 'food', desc: 'Cultiva raciones para la colonia.', cost: { food: 20 }, buildMinutes: 120 },
  almacen: { label: 'Almacén', icon: '🔩', resource: 'energy', desc: 'Amplía la capacidad del tesoro compartido.', cost: { energy: 10, knowledge: 10 }, buildMinutes: 90 },
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
  REACTIONS,
  XP_RULES,
  LEVEL_CURVE,
  INVITE_TTL_MINUTES,
  ROLES,
  FRIENDSHIP_STATUS,
  ACTIVITY_TYPES,
  MEMBER_STATUS,
  VILLAGE_MAX_SLOTS,
  ROOM_TYPES,
  ROOM_TYPE_KEYS,
  ROOM_META,
};
