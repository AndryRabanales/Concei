-- =============================================================
-- MIGRACIÓN — Candado de estatus manual en inscripciones
-- Archivo: 2026_07_13_230000_estatus_manual_en_inscripciones.sql
--
-- Agrega la columna `estatus_manual` a `reg_inscripciones`.
-- Cuando un administrador fija el estatus de un registro a mano
-- (update_reg_status), este flag se activa y el recálculo automático
-- basado en documentos deja de sobreescribirlo. El flag se desactiva
-- cuando el usuario sube un documento nuevo o el admin revisa uno.
--
-- SEGURA de reejecutar: verifica que la columna no exista antes de agregarla.
-- Al final se registra a sí misma en la tabla `migraciones`.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reg_inscripciones'
    AND COLUMN_NAME = 'estatus_manual');
SET @sql := IF(@col = 0,
  'ALTER TABLE `reg_inscripciones` ADD COLUMN `estatus_manual` TINYINT(1) NOT NULL DEFAULT 0 AFTER `estatus`',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_13_230000_estatus_manual_en_inscripciones.sql');
