-- =============================================================
-- MIGRACIÓN — Corrección de documentos anclada a cada pago
-- Archivo: 2026_07_15_100000_reemplaza_id_en_documentos.sql
--
-- Agrega `reemplaza_id` a reg_documentos: cuando un usuario sube la
-- corrección de un documento rechazado, la nueva fila apunta al documento
-- ORIGINAL (raíz) que corrige. Con esto:
--   - Cada pago/compra conserva su propio hilo de comprobante + correcciones.
--   - El botón "Subir corrección" ya no se pierde al hacer otra compra.
--   - El concepto de pago de una corrección es el del pago original.
--
-- SEGURA de reejecutar: verifica que la columna no exista antes de agregarla.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reg_documentos' AND COLUMN_NAME = 'reemplaza_id');
SET @s := IF(@c = 0,
  'ALTER TABLE `reg_documentos` ADD COLUMN `reemplaza_id` INT DEFAULT NULL AFTER `estado`, ADD KEY `idx_reemplaza` (`reemplaza_id`)',
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_15_100000_reemplaza_id_en_documentos.sql');
