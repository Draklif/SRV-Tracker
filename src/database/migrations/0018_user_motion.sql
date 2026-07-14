-- 0018_user_motion.sql — Killswitch de animaciones de la interfaz.
--
-- Junto al tema y al acento, cada persona decide si la app se mueve: transiciones
-- entre pantallas, entradas escalonadas, brillo de los skeletons, toasts. 'on' es
-- el valor por defecto (la app de siempre).
--
-- NO apaga los efectos de los cosméticos equipados (marcos que giran, decoraciones
-- que parpadean): son contenido que el usuario compró, no cromo de la interfaz.
-- El mapeo a CSS vive en public/css/motion.css (:root[data-motion='off']).

ALTER TABLE users ADD COLUMN motion TEXT NOT NULL DEFAULT 'on';  -- 'on' | 'off'
