-- 0009_village_room_move.sql — "La Colonia": mover salas con estado propio.
--
-- Mover una sala la pone en obras a mitad de timer. Necesita un estado distinto
-- de 'constructing' para no confundir "mover" con "construir de cero": una obra
-- nueva de nivel 1 se cancela ELIMINÁNDOLA, pero cancelar un MOVIMIENTO debe
-- REVERTIR la sala a su posición previa (no borrarla). Guardamos el origen para
-- poder revertir. `status` pasa a admitir 'moving' además de 'built'/'constructing'.

ALTER TABLE village_rooms ADD COLUMN move_from_floor INTEGER; -- origen al mover (null si no)
ALTER TABLE village_rooms ADD COLUMN move_from_col   INTEGER;
