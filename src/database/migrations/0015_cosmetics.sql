-- 0015_cosmetics.sql — Cosméticos: inventario y equipamiento.
--
-- Capa puramente visual y OPCIONAL: nada de lo que hay aquí afecta a los
-- hábitos, al XP ni a las dimensiones. Un usuario sin cosméticos ve la app
-- exactamente igual que antes de esta migración.
--
-- Nada se regala: la colección nace vacía y todo se desbloquea (tienda, pase
-- o caja, en fases posteriores). El catálogo de objetos NO vive en la BD sino
-- en src/config/cosmetics.js; aquí solo se guardan claves de ese catálogo.

-- Inventario: qué objetos posee cada usuario y de dónde salieron.
CREATE TABLE user_cosmetics (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key    TEXT    NOT NULL, -- clave del catálogo (src/config/cosmetics.js)
  source      TEXT    NOT NULL DEFAULT 'grant', -- grant | shop | battlepass | lootbox
  acquired_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Un objeto se posee una sola vez: hace idempotente cualquier concesión.
CREATE UNIQUE INDEX idx_user_cosmetics_unique ON user_cosmetics(user_id, item_key);
CREATE INDEX idx_user_cosmetics_user ON user_cosmetics(user_id);

-- Equipado: blob JSON slot→item_key ('{}' = nada puesto).
--
-- Va DENORMALIZADO en users a propósito. Los avatares se pintan en el feed, en
-- las listas de amigos y en la nav, y esas consultas ya traen u.avatar_path; con
-- un blob cada una añade UNA columna y cero JOINs. La integridad la garantiza
-- cosmeticsService.equip(), que valida catálogo + propiedad antes de escribir.
-- Mismo patrón que habits.settings y activity_events.payload.
ALTER TABLE users ADD COLUMN cosmetics TEXT NOT NULL DEFAULT '{}';

-- El lema es texto libre del usuario, no un objeto del catálogo.
ALTER TABLE users ADD COLUMN motto TEXT;
