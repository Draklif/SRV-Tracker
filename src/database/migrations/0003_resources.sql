-- 0003_resources.sql — Recursos generados por hábitos (base para la aldea).
-- Ledger append-only espejo de xp_events. El índice único (usuario, recurso,
-- motivo, fuente, día) hace la inserción idempotente vía INSERT OR IGNORE:
-- un mismo premio solo puede otorgarse una vez por día. Nunca se restan recursos.

CREATE TABLE resource_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,                       -- water|energy|rest|knowledge|food
  amount        INTEGER NOT NULL,                    -- siempre >= 0 (nunca se resta)
  reason        TEXT NOT NULL,                       -- resource_progress | resource_complete
  source_type   TEXT NOT NULL,
  source_id     INTEGER NOT NULL,
  day           TEXT NOT NULL,                        -- fecha local del usuario del premio
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_resource_dedupe
  ON resource_events(user_id, resource_type, reason, source_type, source_id, day);

CREATE INDEX idx_resource_user ON resource_events(user_id);

-- Los hábitos previos no tenían recurso. El recurso es obligatorio, así que se
-- rellena con un valor por defecto para que su edición no falle la validación.
UPDATE habits SET resource_type = 'knowledge' WHERE resource_type IS NULL;
