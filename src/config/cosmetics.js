'use strict';

/**
 * Catálogo de cosméticos: fuente única de verdad.
 *
 * Todo es PURAMENTE VISUAL y OPCIONAL. Ningún objeto de aquí da XP, ventaja ni
 * toca el registro de hábitos: quien ignore la tienda no pierde nada.
 *
 * El catálogo vive en el repo (no en la BD) por la misma razón que el changelog
 * y los logros: es contenido, se versiona con el código y se revisa en el PR.
 * La BD solo guarda CLAVES de este archivo (ver 0015_cosmetics.sql).
 *
 * Añadir un cosmético = una entrada en ITEMS + una clase en
 * public/css/components/cosmetics.css. Nunca se guarda CSS en la BD: la CSP de
 * la app es estricta y un estilo venido de datos sería una vía de inyección.
 */

/**
 * Rarezas, de más común a más rara. `weight` es la probabilidad relativa en las
 * cajas (fase 4) y `color` tiñe el borde/etiqueta de la ficha en la tienda.
 */
const RARITIES = Object.freeze({
  common: { label: 'Común', color: '#9aa4b2', weight: 60 },
  uncommon: { label: 'Poco común', color: '#4fce8f', weight: 25 },
  rare: { label: 'Raro', color: '#4f8cff', weight: 10 },
  epic: { label: 'Muy raro', color: '#8f7bf2', weight: 4 },
  legendary: { label: 'Legendario', color: '#ffcf66', weight: 1 },
});

/** Orden canónico de las rarezas (para ordenar rejillas y filtros). */
const RARITY_KEYS = Object.freeze(Object.keys(RARITIES));

/**
 * Slots equipables. Cada usuario lleva como mucho un objeto por slot; el blob
 * `users.cosmetics` es exactamente un mapa slot → item_key.
 */
const SLOTS = Object.freeze({
  avatar_frame: { label: 'Marco de avatar', desc: 'Rodea tu retrato' },
  avatar_deco: { label: 'Decoración', desc: 'Se posa sobre tu retrato' },
  card_bg: { label: 'Fondo de tarjeta', desc: 'El papel de tu perfil' },
  card_frame: { label: 'Marco de tarjeta', desc: 'El borde de tu perfil' },
  title: { label: 'Título', desc: 'Una línea bajo tu nombre' },
});

const SLOT_KEYS = Object.freeze(Object.keys(SLOTS));

/**
 * Los objetos. `css` es la clase que pinta el objeto (escrita a mano en
 * cosmetics.css); `glyph` es el emoji de las decoraciones; `text` el texto de
 * los títulos. `price` se usa en la tienda (fase 2).
 *
 * `hidden: true` saca el objeto de la TIENDA y de los descuentos: no se puede
 * comprar. Se reserva para lo exclusivo del pase de batalla (fase 3), que solo
 * se consigue subiendo niveles de temporada. Un objeto oculto NO debe aparecer
 * nunca en el `pool` de una caja (ver src/config/lootboxes.js): la caja solo
 * reparte cosas comprables. La colección sí los muestra (bloqueados si no los
 * tienes), para que se vea que existen y de dónde salen.
 */
const ITEMS = Object.freeze([
  // ---- Marcos de avatar ----
  // `gap`: el marco se separa del retrato (si no, va pegado a su borde).
  // `innerBorder`: el retrato conserva su borde propio bajo el marco (si no, se
  // oculta y el único borde es el del marco). Ambos por defecto en false.
  { key: 'frame-tinta', slot: 'avatar_frame', name: 'Tinta', rarity: 'common', price: 120, css: 'cos-frame-tinta', gap: true, innerBorder: true },
  { key: 'frame-bruma', slot: 'avatar_frame', name: 'Bruma', rarity: 'common', price: 130, css: 'cos-frame-bruma', gap: true, innerBorder: true },
  { key: 'frame-cobre', slot: 'avatar_frame', name: 'Cobre', rarity: 'uncommon', price: 260, css: 'cos-frame-cobre' },
  { key: 'frame-jade', slot: 'avatar_frame', name: 'Jade', rarity: 'uncommon', price: 270, css: 'cos-frame-jade' },
  { key: 'frame-brasa', slot: 'avatar_frame', name: 'Brasa', rarity: 'rare', price: 500, css: 'cos-frame-brasa' },
  { key: 'frame-neon', slot: 'avatar_frame', name: 'Neón', rarity: 'epic', price: 900, css: 'cos-frame-neon' },
  { key: 'frame-aurora', slot: 'avatar_frame', name: 'Aurora', rarity: 'legendary', price: 2000, css: 'cos-frame-aurora' },
  // Exclusivo del pase (oculto): no está a la venta, solo se gana por temporada.
  { key: 'frame-vortice', slot: 'avatar_frame', name: 'Vórtice', rarity: 'epic', price: 0, css: 'cos-frame-vortice', hidden: true },

  // ---- Decoraciones de avatar ----
  { key: 'deco-hoja', slot: 'avatar_deco', name: 'Brote', rarity: 'common', price: 150, css: 'cos-deco-hoja', glyph: '🌱' },
  { key: 'deco-gota', slot: 'avatar_deco', name: 'Gota', rarity: 'common', price: 150, css: 'cos-deco-gota', glyph: '💧' },
  { key: 'deco-chispa', slot: 'avatar_deco', name: 'Chispa', rarity: 'uncommon', price: 300, css: 'cos-deco-chispa', glyph: '✨' },
  { key: 'deco-llama', slot: 'avatar_deco', name: 'Llama', rarity: 'rare', price: 550, css: 'cos-deco-llama', glyph: '🔥' },
  { key: 'deco-rayo', slot: 'avatar_deco', name: 'Rayo', rarity: 'rare', price: 560, css: 'cos-deco-rayo', glyph: '⚡' },
  { key: 'deco-corona', slot: 'avatar_deco', name: 'Corona', rarity: 'legendary', price: 1800, css: 'cos-deco-corona', glyph: '👑' },
  // Exclusivo del pase (oculto).
  { key: 'deco-cometa', slot: 'avatar_deco', name: 'Cometa', rarity: 'epic', price: 0, css: 'cos-deco-cometa', glyph: '☄️', hidden: true },

  // ---- Fondos de tarjeta ----
  // `ink`: qué tono tiene el fondo, para que la tarjeta use letras legibles
  // encima. 'dark' = fondo oscuro → tinta clara; 'light' = fondo claro → tinta
  // oscura. Sin `ink`, el fondo es translúcido y sigue al tema (la tinta del
  // tema ya contrasta). OJO: un fondo con `ink` debe pintarse OPACO, si no en el
  // otro tema cambiaría de tono y la tinta forzada quedaría ilegible.
  { key: 'bg-cuadricula', slot: 'card_bg', name: 'Cuadrícula', rarity: 'common', price: 120, css: 'cos-bg-cuadricula' },
  { key: 'bg-papel', slot: 'card_bg', name: 'Papel viejo', rarity: 'common', price: 120, css: 'cos-bg-papel' },
  { key: 'bg-crepusculo', slot: 'card_bg', name: 'Crepúsculo', rarity: 'uncommon', price: 320, css: 'cos-bg-crepusculo', ink: 'dark' },
  { key: 'bg-olas', slot: 'card_bg', name: 'Olas', rarity: 'uncommon', price: 330, css: 'cos-bg-olas' },
  { key: 'bg-vetas', slot: 'card_bg', name: 'Vetas', rarity: 'rare', price: 600, css: 'cos-bg-vetas' },
  { key: 'bg-circuito', slot: 'card_bg', name: 'Circuito', rarity: 'rare', price: 620, css: 'cos-bg-circuito' },
  { key: 'bg-nocturno', slot: 'card_bg', name: 'Nocturno', rarity: 'epic', price: 1000, css: 'cos-bg-nocturno', ink: 'dark' },

  // ---- Marcos de tarjeta ----
  // `replaceBorder`: oculta el borde base de la .card (los marcos con contorno
  // propio, como dorado y prisma, lo sustituyen; costura convive con él).
  // `gap`: mete el marco hacia dentro, separado del borde de la tarjeta (costura);
  // sin gap, el marco va pegado al borde, de donde sale la sombra.
  { key: 'cframe-linea', slot: 'card_frame', name: 'Línea', rarity: 'common', price: 180, css: 'cos-cframe-linea', gap: true },
  { key: 'cframe-costura', slot: 'card_frame', name: 'Costura', rarity: 'uncommon', price: 280, css: 'cos-cframe-costura', gap: true },
  { key: 'cframe-runas', slot: 'card_frame', name: 'Runas', rarity: 'rare', price: 640, css: 'cos-cframe-runas', replaceBorder: true },
  { key: 'cframe-dorado', slot: 'card_frame', name: 'Filo dorado', rarity: 'epic', price: 1100, css: 'cos-cframe-dorado', replaceBorder: true },
  { key: 'cframe-prisma', slot: 'card_frame', name: 'Prisma', rarity: 'legendary', price: 2200, css: 'cos-cframe-prisma', replaceBorder: true },

  // ---- Títulos ----
  { key: 'title-constante', slot: 'title', name: 'Constante', rarity: 'common', price: 150, text: 'Constante' },
  { key: 'title-tenaz', slot: 'title', name: 'Tenaz', rarity: 'common', price: 150, text: 'Tenaz' },
  { key: 'title-madrugador', slot: 'title', name: 'Madrugador', rarity: 'uncommon', price: 300, text: 'Madrugador' },
  { key: 'title-vigia', slot: 'title', name: 'Vigía', rarity: 'uncommon', price: 300, text: 'Vigía' },
  { key: 'title-imparable', slot: 'title', name: 'Imparable', rarity: 'rare', price: 600, text: 'Imparable' },
  { key: 'title-alba', slot: 'title', name: 'Leyenda', rarity: 'epic', price: 1000, text: 'Leyenda' },
  { key: 'title-mito', slot: 'title', name: 'Mito', rarity: 'legendary', price: 2500, text: 'Mito' },
  { key: 'title-guardian', slot: 'title', name: 'Guardián', rarity: 'legendary', price: 3000, text: 'Guardián' },
  // Exclusivo del pase (oculto).
  { key: 'title-pionero', slot: 'title', name: 'Pionero', rarity: 'rare', price: 0, text: 'Pionero', hidden: true },
]);

/** Índice por clave, para resolver en O(1) lo que hay equipado. */
const ITEMS_BY_KEY = Object.freeze(
  Object.fromEntries(ITEMS.map((item) => [item.key, item]))
);

module.exports = {
  RARITIES,
  RARITY_KEYS,
  SLOTS,
  SLOT_KEYS,
  ITEMS,
  ITEMS_BY_KEY,
};
