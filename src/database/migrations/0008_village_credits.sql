-- 0008_village_credits.sql — "La Colonia": moneda de aceleración (créditos).
--
-- Los créditos son una TERCERA capa económica, distinta de los PRIMARIOS (de
-- hábitos, moneda de construcción) y de los SECUNDARIOS (producidos dentro de la
-- colonia, supervivencia). Sirven para acelerar construcciones ("pagar para
-- terminar ya") y, más adelante, para comerciar. Se guardan como un contador
-- mutable en la propia colonia (no necesitan ledger idempotente todavía).

ALTER TABLE villages ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;
