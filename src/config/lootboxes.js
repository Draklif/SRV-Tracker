'use strict';

/**
 * Catálogo de CAJAS (lootboxes): fuente única de verdad, como cosmetics.js.
 *
 * Una caja es un puñado de claves del catálogo de cosméticos (su `pool`) y un
 * precio. Al abrirla, el servidor tira una rareza según los `weight` de
 * RARITIES (src/config/cosmetics.js) y luego elige uniforme un objeto de esa
 * rareza dentro del pool. La tirada SIEMPRE ocurre en el servidor: el navegador
 * solo recibe el resultado ya decidido (ver services/lootboxService.js).
 *
 * Reglas del pool:
 *   - Solo claves NO ocultas: la caja reparte cosas comprables, nunca los
 *     exclusivos del pase (`hidden: true`).
 *   - Conviene que cubra varias rarezas; si una rareza no está en el pool,
 *     su peso se ignora y se reparte entre las presentes.
 *
 * Duplicados: si sale algo que ya tienes, no se concede el objeto sino su
 * REEMBOLSO en monedas según DUP_REFUND (por rareza). Así abrir una caja nunca
 * "se desperdicia".
 *
 * Arte (`art`): cada caja elige uno de los 5 diseños SVG del pool (ver
 * ART_KEYS y partials/box-art.ejs). Es puramente cosmético; si se omite, la
 * vista cae en el diseño por defecto.
 */

// Pool de diseños de arte disponibles para las cajas (deben existir en
// partials/box-art.ejs). Referencia para saber entre qué elegir en `art`.
const ART_KEYS = Object.freeze(['carton', 'madera', 'hierro', 'dorada', 'prisma']);

const BOXES = Object.freeze([
  {
    key: 'caja-comun',
    name: 'Caja común',
    price: 250,
    art: 'carton',
    desc: 'Un surtido de lo más habitual, con un guiño a algo mejor.',
    pool: Object.freeze([
      'frame-tinta', 'frame-bruma', 'frame-cobre', 'frame-jade', 'frame-brasa',
      'deco-hoja', 'deco-gota', 'deco-chispa', 'deco-llama',
      'bg-cuadricula', 'bg-papel', 'bg-crepusculo', 'bg-olas', 'bg-vetas',
      'cframe-linea', 'cframe-costura',
      'title-constante', 'title-tenaz', 'title-madrugador', 'title-vigia', 'title-imparable',
    ]),
  },
  {
    key: 'caja-rara',
    name: 'Caja rara',
    price: 600,
    art: 'hierro',
    desc: 'Mejores probabilidades para lo raro y lo muy raro.',
    pool: Object.freeze([
      'frame-cobre', 'frame-jade', 'frame-brasa', 'frame-neon',
      'deco-chispa', 'deco-llama', 'deco-rayo',
      'bg-crepusculo', 'bg-olas', 'bg-vetas', 'bg-circuito', 'bg-nocturno',
      'cframe-costura', 'cframe-runas', 'cframe-dorado',
      'title-madrugador', 'title-vigia', 'title-imparable', 'title-alba',
    ]),
  },
  {
    key: 'caja-legendaria',
    name: 'Caja legendaria',
    price: 1400,
    art: 'dorada',
    desc: 'La única que puede soltar una pieza legendaria.',
    pool: Object.freeze([
      'frame-brasa', 'frame-neon', 'frame-aurora',
      'deco-llama', 'deco-rayo', 'deco-corona',
      'bg-vetas', 'bg-circuito', 'bg-nocturno',
      'cframe-runas', 'cframe-dorado', 'cframe-prisma',
      'title-imparable', 'title-alba', 'title-mito', 'title-guardian',
    ]),
  },
]);

/** Índice por clave, para resolver una caja en O(1). */
const BOXES_BY_KEY = Object.freeze(Object.fromEntries(BOXES.map((b) => [b.key, b])));

/**
 * Reembolso en monedas de un duplicado, por rareza del objeto repetido. El
 * usuario pidió "un valor por rareza": es plano, no un % del precio, para que
 * repetir un objeto barato de rareza alta siga compensando. Ronda la mitad del
 * precio típico de esa rareza en la tienda.
 */
const DUP_REFUND = Object.freeze({
  common: 40,
  uncommon: 90,
  rare: 180,
  epic: 360,
  legendary: 700,
});

module.exports = { BOXES, BOXES_BY_KEY, DUP_REFUND, ART_KEYS };
