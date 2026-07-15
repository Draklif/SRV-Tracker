-- 0019_battlepass_lootbox.sql — Pase de batalla y cajas (fase 3 de cosméticos).
--
-- Capa puramente visual y OPCIONAL, como el resto de cosméticos: nada de aquí
-- afecta a hábitos, XP ni dimensiones. El CONTENIDO (temporadas, tiers, cajas)
-- vive en src/config/{seasons,lootboxes}.js; aquí solo se guarda el estado por
-- usuario. El progreso del pase NO se guarda: se calcula sumando la XP que el
-- usuario ganó dentro de la ventana de la temporada (xp_events por `day`).

-- Premium desbloqueado, por usuario y temporada. Su mera existencia con
-- premium=1 significa "pagó el premium de esa temporada". Se paga una vez.
CREATE TABLE battlepass_progress (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id   TEXT    NOT NULL,               -- clave de src/config/seasons.js
  premium     INTEGER NOT NULL DEFAULT 0,     -- 0 | 1
  unlocked_at TEXT,
  PRIMARY KEY (user_id, season_id)
);

-- Recompensas ya reclamadas de un tier. Evita el doble cobro de monedas y
-- cajas: los cosméticos ya son idempotentes (user_cosmetics es único), pero
-- monedas y cajas no, así que la clave (usuario, temporada, nivel, carril) es
-- lo que garantiza que cada recompensa se entrega una sola vez.
CREATE TABLE battlepass_claims (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id  TEXT    NOT NULL,
  level      INTEGER NOT NULL,
  track      TEXT    NOT NULL,                -- 'free' | 'premium'
  claimed_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, season_id, level, track)
);

-- Inventario de cajas SIN abrir: un contador por tipo. Las cajas ganadas por el
-- pase esperan aquí hasta que el usuario las abre (con su animación). Comprar en
-- la tienda no pasa por aquí: se abre en el acto.
CREATE TABLE user_lootboxes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  box_key TEXT    NOT NULL,                   -- clave de src/config/lootboxes.js
  qty     INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (user_id, box_key)
);

-- Gastos de monedas que NO son la compra de un cosmético (comprar una caja,
-- desbloquear el premium del pase). shop_purchases solo sirve para objetos del
-- catálogo (su clave es única por objeto), así que estos gastos necesitan su
-- propio ledger para que la invariante del saldo siga cuadrando:
--   saldo == SUM(coin_events) - SUM(shop_purchases) - SUM(coin_spends)
CREATE TABLE coin_spends (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),  -- lo gastado (positivo)
  reason     TEXT    NOT NULL,                      -- lootbox_buy | battlepass_premium
  ref        TEXT,                                  -- box_key o season_id
  day        TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_coin_spends_user ON coin_spends(user_id, created_at);
