-- 0014_changelog_seen.sql — Novedades: hasta qué versión ha leído cada usuario.
--
-- Guarda la última versión del changelog que el usuario ha visto (la que había
-- publicada cuando visitó /novedades). Si no coincide con la versión más nueva
-- de src/config/changelog.js, la navegación le muestra un punto discreto.
--
-- El default '' hace que los usuarios ya existentes vean el aviso de la versión
-- que anuncia las dimensiones; los que se registren a partir de ahora nacen con
-- la última versión marcada como vista (ver src/services/authService.js).

ALTER TABLE users ADD COLUMN changelog_seen TEXT NOT NULL DEFAULT '';
