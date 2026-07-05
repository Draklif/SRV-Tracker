-- 0005_friendships.sql — Sistema de amigos real (relación mutua).
-- Una fila representa a la vez la solicitud y la amistad: la dirección la dan
-- requester/addressee. status 'pending' = solicitud; 'accepted' = amistad.
-- Rechazar/cancelar/quitar = borrar la fila (no guardamos historial de rechazos).
-- Sustrato para la futura "aldea": una tabla villages/village_members reusará
-- este patrón de membresía (ver src/models/friendshipRepository.js).

CREATE TABLE friendships (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'accepted'
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id, status);

-- Migración del modelo antiguo (todos amigos): auto-conectar a TODOS los
-- usuarios actuales entre sí, una fila por par (canónica requester_id < addressee_id).
-- Así el grupo existente conserva su feed; el modelo nuevo aplica de aquí en adelante.
INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
SELECT a.id, b.id, 'accepted', datetime('now')
FROM users a JOIN users b ON a.id < b.id;
