-- 0010_user_accent.sql — Color de acento (marca) elegible por el usuario.
--
-- Junto al tema (dark/light), cada persona puede elegir el color de acento de
-- la app. 'blue' es el valor por defecto (la marca histórica). Los acentos
-- funcionan en ambos temas; el mapeo a tokens CSS vive en tokens.css.

ALTER TABLE users ADD COLUMN accent TEXT NOT NULL DEFAULT 'blue';  -- 'blue' | 'red' | 'green' | 'purple' | 'pink'
