-- ==========================================
-- MIGRACIÓN PARA SERVIDOR DE PRODUCCIÓN
-- ConCEI-3 - Ejecutar con BD existente
--
-- IMPORTANTE: Este archivo NO borra datos.
-- Solo limpia duplicados y agrega índices/columnas nuevas.
-- ==========================================

USE `concei_db`;

-- Paso 1: eliminar talleres/visitas duplicados
DELETE d1 FROM reg_evento_detalles d1
INNER JOIN reg_evento_detalles d2
    ON  d1.folio     = d2.folio
    AND d1.item_id   = d2.item_id
    AND d1.tipo_item = d2.tipo_item
    AND d1.id > d2.id;

-- Paso 2: agregar UNIQUE KEY si no existe
SET @exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'reg_evento_detalles'
      AND INDEX_NAME = 'uq_detalle'
);
SET @sql = IF(@exists = 0,
    'ALTER TABLE reg_evento_detalles ADD UNIQUE KEY uq_detalle (folio, item_id, tipo_item)',
    'SELECT ''uq_detalle ya existe, sin cambios'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Paso 3: crear tabla password_resets si no existe
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

-- Paso 4: agregar recovery_email a admin_users si no existe
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'admin_users'
      AND COLUMN_NAME = 'recovery_email'
);
SET @sql2 = IF(@col_exists = 0,
    'ALTER TABLE admin_users ADD COLUMN recovery_email VARCHAR(255) DEFAULT NULL AFTER rol',
    'SELECT ''recovery_email ya existe'' AS info'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
