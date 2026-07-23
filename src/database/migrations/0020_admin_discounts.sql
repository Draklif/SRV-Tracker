-- 0020_admin_discounts.sql — Descuentos manuales editables desde el panel de admin.
--
-- Hasta ahora los descuentos manuales vivían SOLO en src/config/discounts.js
-- (array MANUAL). Esta tabla es la CAPA DE BASE DE DATOS de esos mismos
-- descuentos: discountService fusiona config.MANUAL con estas filas
-- (catalogService.manualDiscounts). No sustituye a la config, la amplía: así el
-- admin puede poner rebajas en caliente sin desplegar, y las de config siguen
-- valiendo. Las rebajas SEMANALES automáticas (WEEKLY) no se tocan desde aquí.
--
-- Mismo contrato que un elemento de MANUAL: itemKey + percent (0..90) + ventana
-- de fechas opcional 'YYYY-MM-DD' inclusiva. Una manual vigente manda sobre la
-- semanal del mismo objeto (regla ya existente en discountService).

CREATE TABLE admin_discounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key   TEXT    NOT NULL,                          -- clave del catálogo (config o, más adelante, db_cosmetics)
  percent    INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 90),
  starts_on  TEXT,                                      -- 'YYYY-MM-DD' inclusivo, NULL = sin inicio
  ends_on    TEXT,                                      -- 'YYYY-MM-DD' inclusivo, NULL = sin fin
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_admin_discounts_item ON admin_discounts(item_key);
