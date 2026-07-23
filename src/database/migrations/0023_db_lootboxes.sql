-- 0023_db_lootboxes.sql — Cajas creadas desde el panel de admin.
--
-- Las cajas de fábrica siguen en src/config/lootboxes.js. Esta tabla deja al
-- admin crear cajas nuevas: nombre, precio, arte (uno de los ART_KEYS que ya
-- existen como SVG en partials/box-art.ejs — NUNCA arte venido de datos) y un
-- `pool` de claves de cosméticos NO ocultos. catalogService fusiona config +
-- estas filas. Las probabilidades siguen derivando de los `weight` de RARITIES
-- según las rarezas presentes en el pool, como las de config.
--
-- No se borra una caja que alguien pueda tener en su inventario: se deshabilita
-- (enabled = 0). Las claves muertas ya se toleran al resolver (poolItems filtra).

CREATE TABLE db_lootboxes (
  key         TEXT PRIMARY KEY,                 -- 'box-<slug>' (namespaced, sin chocar con config)
  name        TEXT    NOT NULL,
  price       INTEGER NOT NULL CHECK (price >= 0),
  art         TEXT    NOT NULL,                 -- ∈ ART_KEYS (validado en el service)
  description TEXT,
  pool        TEXT    NOT NULL,                 -- JSON: array de claves de cosméticos no ocultos
  enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
