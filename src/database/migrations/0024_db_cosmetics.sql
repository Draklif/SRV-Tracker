-- 0024_db_cosmetics.sql — Cosméticos creados desde el panel de admin.
--
-- Los cosméticos de fábrica siguen en src/config/cosmetics.js. Esta tabla deja al
-- admin crear cosméticos nuevos, PERO nunca guarda CSS (la CSP es estricta): el
-- campo `css` es el NOMBRE de una clase escrita a mano en cosmetics.css por un
-- dev, no estilo. Títulos (text) y decoraciones (glyph, un emoji) no necesitan
-- clase. catalogService mapea cada fila a la misma forma que un objeto de ITEMS.
--
-- Rareza/hueco se validan contra RARITY_KEYS/SLOT_KEYS en el service. La clave va
-- namespaced ('c-<slug>') y no puede chocar con una de config.

CREATE TABLE db_cosmetics (
  key            TEXT PRIMARY KEY,               -- 'c-<slug>'
  slot           TEXT    NOT NULL,               -- ∈ SLOT_KEYS
  name           TEXT    NOT NULL,
  rarity         TEXT    NOT NULL,               -- ∈ RARITY_KEYS
  price          INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  hidden         INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  css            TEXT,                            -- NOMBRE de clase (slug), la escribe un dev
  glyph          TEXT,                            -- avatar_deco: 1 emoji
  text           TEXT,                            -- title: el texto a mostrar
  gap            INTEGER NOT NULL DEFAULT 0 CHECK (gap IN (0, 1)),
  inner_border   INTEGER NOT NULL DEFAULT 0 CHECK (inner_border IN (0, 1)),
  replace_border INTEGER NOT NULL DEFAULT 0 CHECK (replace_border IN (0, 1)),
  ink            TEXT,                            -- 'dark' | 'light' | NULL (card_bg)
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
