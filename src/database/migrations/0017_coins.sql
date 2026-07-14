-- 0017_coins.sql — Monedas: ganar y gastar (fase 2 de cosméticos).
--
-- DOS TABLAS, NO UNA, y esa es la decisión de fondo:
--
--   coin_events    → lo GANADO. Ledger append-only, espejo exacto de xp_events:
--                    misma tupla (usuario, motivo, fuente, día) y mismo índice
--                    único, así que INSERT OR IGNORE lo hace idempotente. Nunca
--                    hay importes negativos: como el XP y las dimensiones, aquí
--                    no se resta.
--   shop_purchases → lo GASTADO. Una compra NO es un premio diario: su clave
--                    natural es (usuario, objeto) PARA SIEMPRE, no (usuario,
--                    motivo, fuente, día). Meterla en el ledger de arriba la
--                    dejaría a merced de un índice que puede IGNORARLA en
--                    silencio, y un cargo ignorado junto a una concesión que sí
--                    ocurre es un objeto gratis.
--
-- users.coins es el SALDO (contador denormalizado, como users.xp), y es lo único
-- que sube y baja. La verdad siempre se puede reconstruir:
--   saldo == SUM(coin_events.amount) - SUM(shop_purchases.price)

CREATE TABLE coin_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),  -- nunca se resta aquí
  reason      TEXT NOT NULL,   -- habit_log|daily_target|day_complete|streak_milestone|achievement
  source_type TEXT NOT NULL,   -- habit | day | achievement
  source_id   INTEGER NOT NULL,
  day         TEXT NOT NULL,   -- fecha local del usuario (NOT NULL: ver abajo)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MISMA TUPLA que idx_xp_dedupe. Es lo que hace que el subscriber en vivo y el
-- backfill escriban exactamente las mismas filas y no puedan pisarse.
--
-- `day` va NOT NULL a propósito: en SQLite dos NULL son DISTINTOS dentro de un
-- índice único, así que una fila con día nulo se duplicaría en cada pasada del
-- backfill. En xp_events la columna nació nullable (0002_xp_day), de modo que
-- las filas legado sin día existen; el backfill las salta y este NOT NULL
-- garantiza que no puedan colarse aquí.
CREATE UNIQUE INDEX idx_coin_dedupe
  ON coin_events(user_id, reason, source_type, source_id, day);

CREATE INDEX idx_coin_user ON coin_events(user_id, created_at);

-- La acuñación pregunta "qué xp_events de este usuario y este día aún no tienen
-- moneda". idx_xp_dedupe empieza por (user_id, reason), así que no sirve para
-- filtrar por día: hace falta este.
CREATE INDEX idx_xp_user_day ON xp_events(user_id, day);

CREATE TABLE shop_purchases (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,                        -- clave del catálogo (src/config/cosmetics.js)
  price      INTEGER NOT NULL CHECK (price >= 0),  -- lo que costó EN SU MOMENTO
  day        TEXT NOT NULL,                        -- fecha local del usuario
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un objeto se compra UNA vez y ya. Espeja idx_user_cosmetics_unique: dos compras
-- distintas el mismo día no colisionan (claves distintas), y recomprar lo que ya
-- tienes es imposible por partida doble (aquí y en user_cosmetics).
CREATE UNIQUE INDEX idx_shop_purchase_unique ON shop_purchases(user_id, item_key);
CREATE INDEX idx_shop_purchase_user ON shop_purchases(user_id, created_at);

-- El saldo. Denormalizado como users.xp, pero este SÍ baja (se gasta). Quien lo
-- resta es un UPDATE con guarda (... WHERE id = ? AND coins >= ?), y eso es lo
-- que hace imposible un saldo negativo aunque lleguen dos compras a la vez.
ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;
