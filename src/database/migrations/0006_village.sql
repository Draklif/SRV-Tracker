-- 0006_village.sql — "La Colonia" (Fase 1): base cooperativa alimentada por hábitos.
-- Aditivo: no toca ninguna tabla existente. Reusa el patrón de membresía anticipado
-- en 0005_friendships.sql y el ledger idempotente de 0003_resources.sql.
--
-- El ledger personal `resource_events` (append-only, sagrado, nunca se resta) se
-- mantiene intacto. La colonia lleva su PROPIO tesoro MUTABLE (`village_resources`),
-- que sube por aportes de hábitos y baja al construir. `village_transactions` es el
-- historial de ese tesoro; su índice único parcial hace idempotentes los aportes.

-- Una colonia compartida por un grupo de amigos.
CREATE TABLE villages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Membresía. Mismo patrón que friendships: la fila es a la vez invitación y
-- pertenencia según `status`. 'pending' = invitado sin aceptar; 'active' = miembro.
-- (Por ahora un usuario solo puede ser miembro activo de UNA colonia; se valida en
-- el servicio, no con constraint, para permitir invitaciones pendientes múltiples.)
CREATE TABLE village_members (
  village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT NOT NULL DEFAULT 'member',   -- 'admin' | 'member'
  status     TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active'
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  joined_at  TEXT,                              -- se fija al aceptar
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(village_id, user_id)
);

CREATE INDEX idx_village_members_user ON village_members(user_id, status);
CREATE INDEX idx_village_members_village ON village_members(village_id, status);

-- Tesoro compartido MUTABLE: una fila por (colonia, recurso). Sube con aportes,
-- baja al construir. balance >= 0 siempre.
CREATE TABLE village_resources (
  village_id    INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,                  -- water|energy|knowledge|food
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  PRIMARY KEY (village_id, resource_type)
);

-- Historial del tesoro. amount > 0 aporte, amount < 0 gasto de construcción.
-- El índice único parcial hace idempotentes los aportes de hábito (espejo del
-- dedupe de resource_events): un mismo premio por (colonia, usuario, recurso,
-- motivo, fuente, día) solo se acredita una vez, vía INSERT OR IGNORE.
CREATE TABLE village_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  village_id    INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  amount        INTEGER NOT NULL,               -- +aporte / -gasto
  reason        TEXT NOT NULL,                  -- resource_progress | resource_complete | construction
  actor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source_type   TEXT NOT NULL,                  -- 'habit' | 'room'
  source_id     INTEGER NOT NULL,
  day           TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_village_contrib_dedupe
  ON village_transactions(village_id, actor_id, resource_type, reason, source_type, source_id, day)
  WHERE reason IN ('resource_progress', 'resource_complete');

CREATE INDEX idx_village_transactions_village ON village_transactions(village_id);

-- Salas construidas en la rejilla. Cada slot (posición) es único por colonia.
CREATE TABLE village_rooms (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  village_id          INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  room_type           TEXT NOT NULL,
  slot_index          INTEGER NOT NULL,
  level               INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'constructing', -- 'built' | 'constructing'
  construct_finish_at TEXT,                                  -- ISO; null cuando 'built'
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(village_id, slot_index)
);

CREATE INDEX idx_village_rooms_village ON village_rooms(village_id);
