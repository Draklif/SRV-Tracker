-- 0011_notifications.sql — Notificaciones push (recordatorios de hábitos).
--
-- Añade el opt-in y las preferencias de aviso al usuario, la tabla de
-- suscripciones push del navegador (una por dispositivo) y un registro de
-- envíos para no repetir la misma notificación dos veces el mismo día local.
--
-- Las claves VAPID viven en el entorno (config.push); aquí solo persistimos las
-- suscripciones y las preferencias. Ver src/services/pushService.js.

-- Preferencias de notificación por usuario.
ALTER TABLE users ADD COLUMN notify_enabled       INTEGER NOT NULL DEFAULT 0;   -- 0|1 opt-in general
ALTER TABLE users ADD COLUMN notify_reminder_time TEXT    NOT NULL DEFAULT '20:00'; -- HH:MM en la zona del usuario
ALTER TABLE users ADD COLUMN notify_streak_guard  INTEGER NOT NULL DEFAULT 0;   -- 0|1 avisar si la racha peligra

-- Suscripciones push del navegador (Web Push). Un usuario puede tener varias
-- (varios dispositivos/navegadores). El endpoint identifica de forma única a cada
-- suscripción; si el navegador la revoca, el envío devuelve 404/410 y la borramos.
CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

-- Registro de notificaciones enviadas: dedupe de "como máximo un aviso de cada
-- tipo por día local del usuario". `kind` = 'reminder' | 'streak_guard'.
CREATE TABLE notification_log (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  local_date TEXT NOT NULL,   -- 'YYYY-MM-DD' en la zona del usuario
  sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, local_date)
);
