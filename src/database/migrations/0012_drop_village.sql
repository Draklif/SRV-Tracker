-- 0012_drop_village.sql — Se retira "La Colonia". El módulo se elimina entero:
-- rutas, servicios, vistas y estas tablas (creadas en 0006–0009, que se quedan
-- en el histórico sin editar).
--
-- Los RECURSOS SOBREVIVEN: el ledger personal `resource_events` (0003) y la
-- columna `habits.resource_type` no se tocan. Eran la única frontera entre la
-- colonia y el resto de la app: la colonia leía los aportes de hábitos y llevaba
-- su propio tesoro mutable aparte, así que dropear su tesoro no pierde nada del
-- ledger del usuario.
--
-- Orden de DROP: primero las hijas (FK → villages) y luego la raíz.

DROP TABLE IF EXISTS village_secondary_resources;
DROP TABLE IF EXISTS village_rooms;
DROP TABLE IF EXISTS village_transactions;
DROP TABLE IF EXISTS village_resources;
DROP TABLE IF EXISTS village_members;
DROP TABLE IF EXISTS villages;
