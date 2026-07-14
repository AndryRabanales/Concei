-- =============================================================
-- MIGRACIÓN — Recuperación de contraseña y correo de admin
-- Archivo: 2026_07_05_120000_recuperacion_password_y_correo_admin.sql
--
-- Agrupa 3 cambios:
--   1. Crea la tabla `password_resets` (códigos de 6 dígitos para
--      recuperar contraseña de usuarios y administradores).
--   2. Agrega la columna `recovery_email` a `admin_users` (correo
--      Gmail de recuperación de cada administrador).
--   3. Limpia talleres/visitas duplicados y agrega la llave única
--      `uq_detalle` en `reg_evento_detalles` para impedir duplicados.
--
-- SEGURA de reejecutar: verifica antes de crear/alterar.
-- Al final se registra a sí misma en la tabla `migraciones`.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

-- -------------------------------------------------------------
-- 1. Tabla password_resets
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('user','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_type` (`email`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. Columna recovery_email en admin_users (solo si no existe)
-- -------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users'
    AND COLUMN_NAME = 'recovery_email');
SET @sql := IF(@col = 0,
  'ALTER TABLE `admin_users` ADD COLUMN `recovery_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `rol`',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- -------------------------------------------------------------
-- 3. Limpiar duplicados y agregar llave única uq_detalle
-- -------------------------------------------------------------
-- 3a. Eliminar filas duplicadas dejando solo la de menor id
DELETE d1 FROM reg_evento_detalles d1
INNER JOIN reg_evento_detalles d2
    ON  d1.folio     = d2.folio
    AND d1.item_id   = d2.item_id
    AND d1.tipo_item = d2.tipo_item
    AND d1.id > d2.id;

-- 3b. Agregar la llave única si aún no existe
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reg_evento_detalles'
    AND INDEX_NAME = 'uq_detalle');
SET @sql := IF(@idx = 0,
  'ALTER TABLE `reg_evento_detalles` ADD UNIQUE KEY `uq_detalle` (`folio`,`item_id`,`tipo_item`)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- -------------------------------------------------------------
-- 4. REGISTRAR ESTA MIGRACIÓN COMO APLICADA
-- -------------------------------------------------------------
INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_05_120000_recuperacion_password_y_correo_admin.sql');
