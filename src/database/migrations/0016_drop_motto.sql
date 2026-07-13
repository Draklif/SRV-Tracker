-- 0016_drop_motto.sql — Retira el lema (motto).
--
-- El lema resultó redundante: la bio ya permite escribir una frase libre, y el
-- lema no tenía forma propia de conseguirse/equiparse (no es un cosmético del
-- catálogo). Se elimina la columna que había añadido 0015_cosmetics.sql.

ALTER TABLE users DROP COLUMN motto;
