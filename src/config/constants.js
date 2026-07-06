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

/* ── Economía de dos capas ──
 * PRIMARIOS (RESOURCE_TYPES: water/energy/knowledge/food) vienen de hábitos y son
 * la ÚNICA moneda de construcción (regla sagrada, intacta). Los SECUNDARIOS se
 * producen DENTRO de la colonia (capa de supervivencia) y son data-driven: añadir
 * uno nuevo = solo metadatos + una sala productora, sin tocar esquema. En Fase A
 * se modelan pero permanecen INERTES (no hay colonos que los operen).
 */

/** Tipos de recurso secundario (producidos en la colonia). */
const SECONDARY_RESOURCE_TYPES = Object.freeze(['o2', 'prepared_food', 'treated_water']);
// Hueco documentado para el futuro (Fase B+): 'science', 'medicine', 'ammo'.
// Añadir = agregar la clave aquí + su meta abajo + una sala que lo produzca.

/** Metadatos de cada secundario para la UI. Mismo patrón que RESOURCE_TYPE_META. */
const SECONDARY_RESOURCE_META = Object.freeze({
  o2: { label: 'Oxígeno', icon: '🫧', desc: 'Aire respirable de los generadores.' },
  prepared_food: { label: 'Raciones', icon: '🥫', desc: 'Comida preparada en el comedor.' },
  treated_water: { label: 'Agua tratada', icon: '🚰', desc: 'Agua potable de la planta.' },
});

/**
 * Créditos: TERCERA capa económica (ni primaria ni secundaria). Moneda de
 * aceleración/comercio. Acelerar una construcción cuesta créditos según el tiempo
 * que aún le falte (redondeado hacia arriba, mínimo 1).
 */
const CREDITS_META = Object.freeze({ label: 'Créditos', icon: '🪙', desc: 'Moneda para acelerar y comerciar.' });
const RUSH_CREDITS_PER_MINUTE = 1;

/** Categorías de sala. Determinan el rol de la sala en el sistema. */
const ROOM_CATEGORIES = Object.freeze({
  PRODUCTION: 'production', // Produce un secundario
  CAPACITY: 'capacity', // Amplía capacidad de almacenamiento
  TRAINING: 'training', // Entrena colonos (Fase B)
  EXPEDITION: 'expedition', // Lanza expediciones (Fase B)
  INFRASTRUCTURE: 'infrastructure', // Núcleo, laboratorio, elevador…
});

/**
 * Constantes de la rejilla. La unidad horizontal es la MEDIA casilla: una sala
 * cuadrada mide 2 unidades de ancho y un elevador 1 (media casilla, ilusión de
 * conector fino). Así el mapa hace snap fino y las salas siguen viéndose
 * cuadradas. `col`/`width` en village_rooms están en estas unidades.
 */
const ROOM_BASE_WIDTH = 2; // Una sala cuadrada nace de 2 unidades (1 casilla)…
const ROOM_MAX_WIDTH = 6; // …y se fusiona con iguales hasta 6 unidades (3 salas).

/**
 * Tipos de sala construibles. El Núcleo es infraestructura sembrada (no
 * construible). Reskin sci-fi (base espacial).
 */
const ROOM_TYPES = Object.freeze({
  NUCLEO: 'nucleo',
  O2_GENERATOR: 'o2_generator',
  DINER: 'diner',
  WATER_TREATMENT: 'water_treatment',
  STORAGE: 'storage',
  LABORATORY: 'laboratory',
  ELEVATOR: 'elevator',
  TRAINING_ROOM: 'training_room',
  EXPEDITION_BAY: 'expedition_bay',
});

const ROOM_TYPE_KEYS = Object.freeze(Object.values(ROOM_TYPES));

/**
 * Metadatos de cada sala. Mismo patrón que RESOURCE_TYPE_META. Campos:
 *  - label, icon, category, desc — UI.
 *  - cost:{<primario>:n} — coste base (nivel 1); las mejoras escalan por nivel.
 *  - buildMinutes — duración de la construcción (timer perezoso).
 *  - unlockTier — tier requerido; se desbloquea con el nivel del Laboratorio
 *    (tier 0 siempre disponible). El Laboratorio ES el que sube el tier.
 *  - baseWidth / maxWidth — huella en celdas (fusión de iguales adyacentes).
 *  - workerSlotsPerCell — plazas de colono por celda (Fase B; inerte en A).
 *  - produces:{<secundario>:perMin} — producción por minuto (Fase B; inerte).
 *  - consumesO2 — O₂/min que consume (Fase B; inerte).
 *  - caps:{<secundario>:+n} — capacidad de almacenamiento que aporta.
 *  - buildable — false para el Núcleo (sembrado, no se construye).
 * Valores tuneables.
 */
const ROOM_META = Object.freeze({
  nucleo: {
    label: 'Núcleo', icon: '🛰️', category: ROOM_CATEGORIES.INFRASTRUCTURE, buildable: false,
    desc: 'El corazón de la colonia. Todo crece a partir de aquí.',
    cost: {}, buildMinutes: 0, unlockTier: 0, baseWidth: 2, maxWidth: 2,
    workerSlotsPerCell: 0, produces: {}, consumesO2: 0, caps: {},
  },
  o2_generator: {
    label: 'Generador de O₂', icon: '🫧', category: ROOM_CATEGORIES.PRODUCTION,
    desc: 'Produce oxígeno para mantener la colonia respirable.',
    cost: { energy: 20 }, buildMinutes: 120, unlockTier: 0, baseWidth: 2, maxWidth: 6,
    workerSlotsPerCell: 1, produces: { o2: 2 }, consumesO2: 0, caps: {},
  },
  diner: {
    label: 'Comedor', icon: '🍳', category: ROOM_CATEGORIES.PRODUCTION,
    desc: 'Prepara raciones a partir de la despensa.',
    cost: { food: 20 }, buildMinutes: 120, unlockTier: 0, baseWidth: 2, maxWidth: 6,
    workerSlotsPerCell: 1, produces: { prepared_food: 2 }, consumesO2: 1, caps: {},
  },
  water_treatment: {
    label: 'Planta de agua', icon: '🚰', category: ROOM_CATEGORIES.PRODUCTION,
    desc: 'Potabiliza agua para la colonia.',
    cost: { water: 20 }, buildMinutes: 120, unlockTier: 0, baseWidth: 2, maxWidth: 6,
    workerSlotsPerCell: 1, produces: { treated_water: 2 }, consumesO2: 1, caps: {},
  },
  storage: {
    label: 'Almacén', icon: '📦', category: ROOM_CATEGORIES.CAPACITY,
    desc: 'Amplía la capacidad de almacenamiento de secundarios.',
    cost: { energy: 10, knowledge: 10 }, buildMinutes: 90, unlockTier: 0, baseWidth: 2, maxWidth: 6,
    workerSlotsPerCell: 0, produces: {}, consumesO2: 0,
    caps: { o2: 50, prepared_food: 50, treated_water: 50 },
  },
  laboratory: {
    label: 'Laboratorio', icon: '📚', category: ROOM_CATEGORIES.INFRASTRUCTURE,
    desc: 'Investigación: su nivel desbloquea salas de mayor tier.',
    cost: { knowledge: 25 }, buildMinutes: 180, unlockTier: 0, baseWidth: 2, maxWidth: 2,
    workerSlotsPerCell: 0, produces: {}, consumesO2: 0, caps: {},
  },
  elevator: {
    label: 'Elevador', icon: '🛗', category: ROOM_CATEGORIES.INFRASTRUCTURE,
    desc: 'Conector vertical: habilita construir en el piso de arriba/abajo.',
    cost: { energy: 15 }, buildMinutes: 60, unlockTier: 0, baseWidth: 1, maxWidth: 1,
    workerSlotsPerCell: 0, produces: {}, consumesO2: 0, caps: {},
  },
  training_room: {
    label: 'Sala de entrenamiento', icon: '🏋️', category: ROOM_CATEGORIES.TRAINING,
    desc: 'Entrena a los colonos para mejorar sus aptitudes.',
    cost: { energy: 30, knowledge: 20 }, buildMinutes: 240, unlockTier: 1, baseWidth: 2, maxWidth: 6,
    workerSlotsPerCell: 1, produces: {}, consumesO2: 1, caps: {},
  },
  expedition_bay: {
    label: 'Bahía de expedición', icon: '🚀', category: ROOM_CATEGORIES.EXPEDITION,
    desc: 'Lanza expediciones al exterior. Ocupa 2 casillas y solo cabe una por colonia.',
    cost: { energy: 40, knowledge: 30, food: 20 }, buildMinutes: 300, unlockTier: 2, baseWidth: 4, maxWidth: 4,
    workerSlotsPerCell: 1, produces: {}, consumesO2: 2, caps: {}, unique: true,
  },
});

/** Tipo de sala infraestructura raíz sembrada al fundar la colonia. */
const NUCLEO_ROOM_TYPE = ROOM_TYPES.NUCLEO;

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
  CREDITS_META,
  RUSH_CREDITS_PER_MINUTE,
  SECONDARY_RESOURCE_TYPES,
  SECONDARY_RESOURCE_META,
  ROOM_CATEGORIES,
  ROOM_BASE_WIDTH,
  ROOM_MAX_WIDTH,
  ROOM_TYPES,
  ROOM_TYPE_KEYS,
  ROOM_META,
  NUCLEO_ROOM_TYPE,
};
