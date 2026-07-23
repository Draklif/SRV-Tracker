-- 0022_shop_overrides.sql — Ajustes de tienda por objeto, editables desde admin.
--
-- El catálogo de cosméticos sigue en src/config/cosmetics.js (precio y visibilidad
-- de fábrica). Esta tabla deja al admin AJUSTAR encima, sin desplegar: cambiar el
-- precio de un objeto o esconderlo/mostrarlo en la tienda. catalogService fusiona
-- config + estas filas; una columna NULL = "sin override, usa lo de config".
--
-- La clave puede apuntar a un objeto de config O a uno creado por admin
-- (db_cosmetics, 0024). No hay FK a un catálogo que vive en el repo.

CREATE TABLE shop_item_overrides (
  item_key   TEXT PRIMARY KEY,
  price      INTEGER CHECK (price >= 0),        -- NULL = sin override de precio
  hidden     INTEGER CHECK (hidden IN (0, 1)),  -- NULL = sin override de visibilidad
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
