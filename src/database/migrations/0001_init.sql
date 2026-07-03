-- 0001_init.sql — Esquema inicial de Tracker.
-- Fechas como texto ISO. `log_date` es la fecha LOCAL en la zona horaria del usuario.

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  email          TEXT UNIQUE,                    -- opcional
  display_name   TEXT NOT NULL,
  avatar_path    TEXT,                            -- null = avatar por defecto
  bio            TEXT,
  timezone       TEXT NOT NULL DEFAULT 'America/Mexico_City',
  theme          TEXT NOT NULL DEFAULT 'dark',    -- 'dark' | 'light'
  xp             INTEGER NOT NULL DEFAULT 0,       -- denormalizado (verdad: xp_events)
  role           TEXT NOT NULL DEFAULT 'member',   -- 'member' | 'admin'
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT
);

CREATE TABLE invites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at    TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE habits (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '⭐',
  color         TEXT NOT NULL DEFAULT 'blue',
  type          TEXT NOT NULL,                     -- checkbox|quantity|duration|scale|numeric|text
  unit          TEXT,
  target_daily  REAL,
  settings      TEXT NOT NULL DEFAULT '{}',        -- JSON: config específica del tipo
  resource_type TEXT,                              -- FUTURO aldea
  resource_rate REAL,                              -- FUTURO aldea
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  is_archived   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_habits_user ON habits(user_id, is_archived, sort_order);

CREATE TABLE habit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date   TEXT NOT NULL,                        -- 'YYYY-MM-DD' en tz del usuario
  value_num  REAL,
  value_text TEXT,
  completed  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id, log_date)
);
CREATE INDEX idx_logs_habit_date ON habit_logs(habit_id, log_date);
CREATE INDEX idx_logs_user_date  ON habit_logs(user_id, log_date);

CREATE TABLE habit_streaks (
  habit_id            INTEGER PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  longest_streak      INTEGER NOT NULL DEFAULT 0,
  last_completed_date TEXT
);

CREATE TABLE xp_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,                     -- siempre >= 0 (nunca se resta XP)
  reason      TEXT NOT NULL,
  source_type TEXT,
  source_id   INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_xp_user ON xp_events(user_id, created_at);

CREATE TABLE achievements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  category    TEXT NOT NULL,                        -- streak|consistency|milestone|social
  tier        TEXT,                                  -- bronze|silver|gold
  criteria    TEXT NOT NULL,                         -- JSON evaluable
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE user_achievements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress       TEXT,
  unlocked_at    TEXT,                               -- null = en progreso
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE activity_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',            -- JSON para render
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_created ON activity_events(created_at DESC);

CREATE TABLE reactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_event_id INTEGER NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji             TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(activity_event_id, user_id, emoji)
);
CREATE INDEX idx_reactions_event ON reactions(activity_event_id);
