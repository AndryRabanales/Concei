-- =============================================================
-- MIGRACIÓN — Agregar el LUGAR (salón/laboratorio) a los talleres
-- Archivo: 2026_08_06_100000_lugar_en_talleres.sql
--
-- Fuente: https://concei3.uady.mx/talleres3/listado-talleres
--
-- `modalidad` y `lugar` son COMPLEMENTARIOS, no intercambiables:
--   - Talleres Virtuales  -> lugar vacío (no hay salón físico).
--   - Talleres Presenciales -> lugar con el salón/laboratorio asignado.
--   - Algunos presenciales usan DOS espacios (teoría + laboratorio); se
--     guardan en el mismo campo separados por " | ".
--
-- Solo AGREGA una columna nueva y la rellena. No modifica ni borra ningún
-- otro dato existente. SEGURA de reejecutar.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

-- 1. Columna `lugar` en talleres (solo si no existe)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cat_talleres' AND COLUMN_NAME = 'lugar');
SET @s := IF(@c = 0,
  'ALTER TABLE `cat_talleres` ADD COLUMN `lugar` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `modalidad`',
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. Misma columna en visitas, para que el panel de admin sea consistente
SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cat_visitas' AND COLUMN_NAME = 'lugar');
SET @s2 := IF(@c2 = 0,
  'ALTER TABLE `cat_visitas` ADD COLUMN `lugar` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `modalidad`',
  'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- 3. Lugar oficial de cada taller PRESENCIAL (los virtuales quedan NULL)
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FMAT)'                                  WHERE `id` = 'T03';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FMAT)'                                  WHERE `id` = 'T04';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FMAT)'                                  WHERE `id` = 'T05';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FMAT)'                                               WHERE `id` = 'T06';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FIQ)'                                   WHERE `id` = 'T07';
UPDATE `cat_talleres` SET `lugar` = 'Audiovisual 1 (FIQ) | Lab. Análisis Instrumental (FIQ)'    WHERE `id` = 'T08';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FIQ)'                                                WHERE `id` = 'T09';
UPDATE `cat_talleres` SET `lugar` = 'Lab. Simulación Dinámica (FIQ)'                            WHERE `id` = 'T11';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FIQ) | Lab. Química General (FIQ)'                   WHERE `id` = 'T13';
UPDATE `cat_talleres` SET `lugar` = 'Aula H5 (FMAT)'                                            WHERE `id` = 'T14';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FIQ) | Lab. Química Inorgánica (FIQ)'                WHERE `id` = 'T15';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FI)'                                    WHERE `id` = 'T16';
UPDATE `cat_talleres` SET `lugar` = 'Audiovisual 2 (FI)'                                        WHERE `id` = 'T17';
UPDATE `cat_talleres` SET `lugar` = 'Postgrado 2 (FIQ) | Lab. Ingeniería de Procesos (FIQ)'     WHERE `id` = 'T18';
UPDATE `cat_talleres` SET `lugar` = 'Audiovisual 2 (FIQ)'                                       WHERE `id` = 'T19';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FI)'                                    WHERE `id` = 'T20';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FI)'                                    WHERE `id` = 'T21';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FMAT)'                                               WHERE `id` = 'T23';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FMAT)'                                               WHERE `id` = 'T24';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FMAT)'                                  WHERE `id` = 'T26';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FMAT)'                                               WHERE `id` = 'T27';
UPDATE `cat_talleres` SET `lugar` = 'Aula (FI)'                                                 WHERE `id` = 'T28';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FMAT)'                                  WHERE `id` = 'T29';
UPDATE `cat_talleres` SET `lugar` = 'Centro de Cómputo (FMAT)'                                  WHERE `id` = 'T30';

-- 4. Los talleres virtuales no tienen salón físico
UPDATE `cat_talleres` SET `lugar` = NULL WHERE `modalidad` = 'Virtual';

-- 5. Punto de reunión de las visitas industriales (todas salen del mismo sitio)
UPDATE `cat_visitas` SET `lugar` = 'Explanada de la Facultad de Ingeniería Química (punto de reunión)'
 WHERE `lugar` IS NULL OR `lugar` = '';

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_08_06_100000_lugar_en_talleres.sql');
