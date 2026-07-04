-- 0004_drop_rest_resource.sql — Se elimina el recurso 'rest' (redundante con
-- 'energy'). Los hábitos que lo usaran se reasignan a 'energy' para que sigan
-- pasando la validación (el recurso es obligatorio e inmutable). Los eventos
-- históricos de 'rest' en resource_events se ignoran solos (ya no está en el
-- enum), así que no hace falta tocarlos.

UPDATE habits SET resource_type = 'energy' WHERE resource_type = 'rest';
