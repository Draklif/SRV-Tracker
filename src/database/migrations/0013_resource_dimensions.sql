-- 0013_resource_dimensions.sql — De 4 recursos de aldea a 6 DIMENSIONES de vida.
--
-- Dos cambios, y el segundo es el importante:
--
-- 1) La taxonomía. agua/energía/conocimiento/comida eran suministros de una base,
--    no áreas de una vida: no había dónde meter meditar, llamar a alguien, ordenar
--    o crear. Pasan a body/mind/calm/social/craft/order. El remapeo es mecánico y
--    quedará imperfecto (un hábito "Deporte" mal etiquetado como 'knowledge' caerá
--    en 'mind'); da igual, porque a partir de ahora la dimensión SE PUEDE CORREGIR
--    desde la app y la corrección arrastra todo el histórico. Ver punto 2.
--
-- 2) La dimensión deja de guardarse en el evento y pasa a DEDUCIRSE del hábito.
--    `resource_events.resource_type` era una copia de `habits.resource_type`, y el
--    dato duplicado se desincroniza. Al deducirlo con un JOIN por source_id,
--    cambiar la dimensión de un hábito recoloca su pasado entero GRATIS: no hay
--    segunda copia que pueda contradecir a la primera. El JOIN es seguro porque los
--    hábitos se archivan (is_archived), nunca se borran.
--
--    Esto además tapa un bug que estrenaríamos al hacer la dimensión editable: el
--    índice único viejo incluía `resource_type`, así que registrar → cambiar de
--    dimensión → volver a registrar EL MISMO DÍA producía una tupla distinta, el
--    INSERT OR IGNORE no ignoraba y se otorgaba premio doble. La clave correcta es
--    (user, reason, source, day): el premio es "este hábito, este día, este motivo";
--    la dimensión nunca tuvo nada que hacer ahí.

-- ── 1. Remapeo de la taxonomía en los hábitos ──
UPDATE habits SET resource_type = 'body' WHERE resource_type IN ('water', 'energy', 'food');
UPDATE habits SET resource_type = 'mind' WHERE resource_type = 'knowledge';

-- ── 2. Rebuild del ledger ──
-- SQLite no permite alterar un índice único ni relajar un NOT NULL in-place, así
-- que se reconstruye la tabla (mismo patrón que 0007).

-- Defensivo: si dos filas colisionaran en la clave NUEVA, crear el índice único
-- abortaría la migración entera. No debería pasar (un hábito nunca pudo tener dos
-- dimensiones, que era justo lo que la inmutabilidad garantizaba), pero más vale
-- quedarse con la primera de cada grupo que reventar al aplicar.
DELETE FROM resource_events
WHERE id NOT IN (
  SELECT MIN(id) FROM resource_events
  GROUP BY user_id, reason, source_type, source_id, day
);

CREATE TABLE resource_events_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT,                              -- NULL para hábitos: se deduce del hábito.
                                                   -- Reservado como respaldo para fuentes que
                                                   -- no sean hábitos (logros, retos…).
  amount        INTEGER NOT NULL,                  -- siempre >= 0 (nunca se resta)
  reason        TEXT NOT NULL,                     -- resource_progress | resource_complete
  source_type   TEXT NOT NULL,
  source_id     INTEGER NOT NULL,
  day           TEXT NOT NULL,                     -- fecha local del usuario del premio
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Se copian los eventos con su dimensión a NULL cuando vienen de un hábito: a
-- partir de ahora la verdad vive en `habits.resource_type` y solo ahí. El
-- histórico no se pierde — se recoloca solo al leerlo.
INSERT INTO resource_events_new (id, user_id, resource_type, amount, reason, source_type, source_id, day, created_at)
SELECT id, user_id,
       CASE WHEN source_type = 'habit' THEN NULL ELSE resource_type END,
       amount, reason, source_type, source_id, day, created_at
FROM resource_events;

DROP TABLE resource_events;
ALTER TABLE resource_events_new RENAME TO resource_events;

CREATE UNIQUE INDEX idx_resource_dedupe
  ON resource_events(user_id, reason, source_type, source_id, day);

CREATE INDEX idx_resource_user ON resource_events(user_id);

-- El radar cruza eventos con hábitos por (source_type, source_id) en cada carga
-- del perfil: sin este índice es un scan del ledger entero.
CREATE INDEX idx_resource_source ON resource_events(source_type, source_id);
