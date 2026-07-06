-- 0007_village_rooms_footprint.sql — "La Colonia" Fase A (sistema de construcción).
--
-- Reestructura la rejilla: de slots planos (1 slot = 1 sala, UNIQUE(slot_index))
-- a un mapa 2D ilimitado con huella horizontal — `floor` (fila entera), `col`
-- (columna entera de inicio) y `width` (1–3 celdas). El crecimiento es por
-- adyacencia desde un Núcleo (no hay contador de pisos), así que NO hay tabla de
-- tech ni `floors_unlocked`: el desbloqueo se deriva del nivel del Laboratorio.
--
-- SQLite no permite quitar el UNIQUE(slot_index) de la tabla vieja, así que se
-- reconstruye: tabla nueva + DROP + RENAME. NO se copian las filas viejas — las
-- salas del catálogo experimental se descartan (el catálogo se reemplaza). El
-- tesoro, los miembros y la colonia se conservan. El Núcleo NO se siembra aquí;
-- se garantiza *lazy* en getViewModel (colonia con 0 salas → inserta Núcleo).

-- Rebuild de village_rooms con huella (floor, col, width).
CREATE TABLE village_rooms_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  village_id          INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  room_type           TEXT NOT NULL,
  floor               INTEGER NOT NULL,          -- fila (positiva/negativa), 0 = piso del Núcleo
  col                 INTEGER NOT NULL,          -- columna de inicio (positiva/negativa)
  width               INTEGER NOT NULL DEFAULT 1, -- celdas ocupadas (1–3)
  level               INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'constructing', -- 'built' | 'constructing'
  construct_finish_at TEXT,                                  -- ISO; null cuando 'built'
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sin copiar filas: se limpian las salas experimentales del catálogo viejo.
DROP TABLE village_rooms;
ALTER TABLE village_rooms_new RENAME TO village_rooms;

CREATE INDEX idx_village_rooms_village ON village_rooms(village_id);

-- Capa de supervivencia: recursos SECUNDARIOS producidos dentro de la colonia.
-- Scaffold data-driven; inerte en Fase A (sin colonos que operen). Una fila por
-- (colonia, recurso). `cap` es la capacidad de almacenamiento (sube con salas de
-- capacidad); `amount` el stock actual.
CREATE TABLE village_secondary_resources (
  village_id    INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,                  -- o2 | prepared_food | treated_water | …
  amount        INTEGER NOT NULL DEFAULT 0,
  cap           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (village_id, resource_type)
);
