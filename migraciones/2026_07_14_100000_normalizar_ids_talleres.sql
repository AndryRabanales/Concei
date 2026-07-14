-- =============================================================
-- MIGRACIÓN — Normalizar IDs de talleres a T01, T02, ... (y visitas a V01...)
-- Archivo: 2026_07_14_100000_normalizar_ids_talleres.sql
--
-- Antes los talleres tenían id 'ws1'..'ws31' pero el sistema mostraba el
-- concepto/ID como 'T01'..'T31', causando inconsistencia (W7). Esta migración
-- renombra el id real a 'T01'..'T31' para que el ID sea el MISMO en la base,
-- en el concepto de pago, en el panel de admin y para el usuario.
--
-- Renombra también las referencias en reg_evento_detalles (mismo cálculo, sin
-- FK que rompa). Limpia reg_reservas_temp (apartados temporales, sin valor
-- permanente). Crea contadores de secuencia en cat_ajustes para que los IDs
-- nuevos no se reutilicen aunque se elimine un taller.
--
-- SEGURA de reejecutar: tras renombrar ya no quedan ids 'ws', así que un
-- segundo pase no cambia nada.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

-- 1. Referencias en detalles de compra: ws{n} -> T{nn}
UPDATE `reg_evento_detalles`
   SET `item_id` = CONCAT('T', LPAD(CAST(REGEXP_REPLACE(`item_id`, '[^0-9]', '') AS UNSIGNED), 2, '0'))
 WHERE `tipo_item` = 'taller' AND `item_id` REGEXP '^ws[0-9]+$';

-- 2. Catálogo de talleres: ws{n} -> T{nn}
UPDATE `cat_talleres`
   SET `id` = CONCAT('T', LPAD(CAST(REGEXP_REPLACE(`id`, '[^0-9]', '') AS UNSIGNED), 2, '0'))
 WHERE `id` REGEXP '^ws[0-9]+$';

-- 3. Visitas: cualquier id que no sea ya V{n} -> V{nn} (por si hubiera datos viejos)
UPDATE `reg_evento_detalles`
   SET `item_id` = CONCAT('V', LPAD(CAST(REGEXP_REPLACE(`item_id`, '[^0-9]', '') AS UNSIGNED), 2, '0'))
 WHERE `tipo_item` = 'visita' AND `item_id` NOT REGEXP '^V[0-9]+$' AND `item_id` REGEXP '[0-9]';
UPDATE `cat_visitas`
   SET `id` = CONCAT('V', LPAD(CAST(REGEXP_REPLACE(`id`, '[^0-9]', '') AS UNSIGNED), 2, '0'))
 WHERE `id` NOT REGEXP '^V[0-9]+$' AND `id` REGEXP '[0-9]';

-- 4. Limpiar apartados temporales (guardan ids viejos; son transitorios de 30 min)
DELETE FROM `reg_reservas_temp`;

-- 5. Contadores de secuencia (para IDs nuevos sin reutilizar números)
INSERT INTO `cat_ajustes` (`clave`, `valor`)
  VALUES ('seq_taller', (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_talleres))
  ON DUPLICATE KEY UPDATE `valor` = GREATEST(`valor`, (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_talleres));

INSERT INTO `cat_ajustes` (`clave`, `valor`)
  VALUES ('seq_visita', (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_visitas))
  ON DUPLICATE KEY UPDATE `valor` = GREATEST(`valor`, (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_visitas));

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_14_100000_normalizar_ids_talleres.sql');
