-- =============================================================
-- MIGRACIÓN — Rastreo de códigos de registro
-- Archivo: 2026_07_14_100500_rastreo_codigos.sql
--
-- Agrega a cat_codigos: quién usó el código (correo) y cuándo. Sirve para que
-- el admin, en "Códigos de Registro", vea qué usuario ocupó cada código y lo
-- pueda rastrear.
--
-- SEGURA de reejecutar: verifica que las columnas no existan antes de agregarlas.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cat_codigos' AND COLUMN_NAME = 'usado_por');
SET @s1 := IF(@c1 = 0,
  'ALTER TABLE `cat_codigos` ADD COLUMN `usado_por` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `usado`',
  'DO 0');
PREPARE s FROM @s1; EXECUTE s; DEALLOCATE PREPARE s;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cat_codigos' AND COLUMN_NAME = 'fecha_uso');
SET @s2 := IF(@c2 = 0,
  'ALTER TABLE `cat_codigos` ADD COLUMN `fecha_uso` DATETIME DEFAULT NULL AFTER `usado_por`',
  'DO 0');
PREPARE s FROM @s2; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_14_100500_rastreo_codigos.sql');
