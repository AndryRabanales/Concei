-- =============================================================
-- MIGRACIÓN — Estado "rechazado_definitivo" en documentos
-- Archivo: 2026_08_06_110000_estado_rechazado_definitivo.sql
--
-- Agrega el valor 'rechazado_definitivo' al ENUM de reg_documentos.estado
-- (observación 6-ago, Cambio 3: botón "Rechazar Definitivo" que bloquea
-- nuevas subidas y libera los cupos del pago).
--
-- SEGURA de reejecutar: solo modifica el ENUM si aún no incluye el valor.
-- No toca ningún dato existente.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

SET @tiene := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reg_documentos'
    AND COLUMN_NAME = 'estado' AND COLUMN_TYPE LIKE '%rechazado_definitivo%');
SET @s := IF(@tiene = 0,
  "ALTER TABLE `reg_documentos` MODIFY COLUMN `estado` ENUM('pendiente','aceptado','rechazado','rechazado_definitivo') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente'",
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_08_06_110000_estado_rechazado_definitivo.sql');
