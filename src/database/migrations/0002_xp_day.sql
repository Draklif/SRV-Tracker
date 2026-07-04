-- 0002_xp_day.sql — Idempotencia de XP.
-- `day` guarda la fecha local del usuario a la que corresponde el premio.
-- El índice único permite INSERT OR IGNORE: un mismo premio (usuario, motivo,
-- fuente, día) solo puede otorgarse una vez. Nunca se resta XP.

ALTER TABLE xp_events ADD COLUMN day TEXT;

CREATE UNIQUE INDEX idx_xp_dedupe
  ON xp_events(user_id, reason, source_type, source_id, day);
