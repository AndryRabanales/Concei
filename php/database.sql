-- Script de Base de Datos ConCEI 2026
-- Compatible con MySQL 9.x y MariaDB 10.x
-- Generado con formato phpMyAdmin para máxima compatibilidad

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- ==========================================
-- 0. LIMPIEZA
-- ==========================================
CREATE DATABASE IF NOT EXISTS `concei_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `concei_db`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `login_attempts`, `admin_sessions`, `admin_users`,
    `reg_reservas_temp`, `reg_conceptos_historial`, `reg_documentos`,
    `reg_contribuciones`, `reg_evento_detalles`, `reg_archivos`,
    `reg_facturacion`, `reg_evento`, `reg_personal`, `reg_inscripciones`,
    `ini_usuarios`, `cat_ajustes`, `cat_codigos`, `cat_visitas`, `cat_talleres`;
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- 1. MÓDULO INICIO / CUENTAS (ini_)
-- ==========================================

CREATE TABLE IF NOT EXISTS `ini_usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contrasena` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_registro` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 2. MÓDULO REGISTRO AL CONGRESO (reg_)
-- ==========================================

CREATE TABLE IF NOT EXISTS `reg_inscripciones` (
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `estatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pendiente',
  `fecha_inscripcion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reg_personal` (
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellido` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `institucion` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ciudad` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pais` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reg_evento` (
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `concepto` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reg_evento_detalles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_item` enum('taller','visita') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_detalle` (`folio`,`item_id`,`tipo_item`),
  KEY `fk-reg_evento_detalles-folio` (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reg_contribuciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `area` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modalidad` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `titulo` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `revista` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk-reg_contribuciones-folio` (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reg_facturacion` (
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `razon` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rfc` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `cp` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ciudad` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LEGACY: reemplazada por reg_documentos, se conserva por compatibilidad
CREATE TABLE IF NOT EXISTS `reg_archivos` (
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `comprobante` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `identificacion` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `constancia` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comprobante_adicional` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `constancia_adicional` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial de documentos (append-only, indexado por correo)
CREATE TABLE IF NOT EXISTS `reg_documentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_doc` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `archivo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_subida` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('pendiente','aceptado','rechazado') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `comentario` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revisado_por` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_revision` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doc` (`correo`,`tipo_doc`,`archivo`),
  KEY `idx_correo` (`correo`),
  KEY `idx_folio` (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial de conceptos de pago (append-only)
CREATE TABLE IF NOT EXISTS `reg_conceptos_historial` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `folio` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `concepto` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_generado` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reservas temporales de cupos
CREATE TABLE IF NOT EXISTS `reg_reservas_temp` (
  `correo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `items_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 3. MÓDULO CATÁLOGOS / CONFIG (cat_)
-- ==========================================

CREATE TABLE IF NOT EXISTS `cat_talleres` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `precio` decimal(10,2) DEFAULT '70.00',
  `horario` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instructor` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dependencia` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modalidad` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Presencial',
  `cupo` int DEFAULT '30',
  `cupo_actual` int NOT NULL DEFAULT '0',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cat_visitas` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `precio` decimal(10,2) DEFAULT '70.00',
  `horario` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instructor` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dependencia` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modalidad` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Presencial',
  `cupo` int DEFAULT '30',
  `cupo_actual` int NOT NULL DEFAULT '0',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cat_codigos` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `usado` tinyint(1) DEFAULT '0',
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cat_ajustes` (
  `clave` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 4. DATOS INICIALES
-- ==========================================

INSERT INTO `cat_ajustes` (`clave`, `valor`) VALUES
('general', 1000.00),
('student_external', 800.00),
('student_uady', 0.00);

INSERT INTO `cat_talleres` (`id`, `nombre`, `precio`, `horario`, `instructor`, `dependencia`, `modalidad`, `cupo`) VALUES
('ws1', 'IA EN INGENIERÍA', 70.00, '9:00 am - 1:00 pm', 'DRA JESSICA CANTO', 'UADY', 'Virtual', 25),
('ws2', 'VIDEOJUEGOS 2D', 70.00, '10:00 am - 1:00 pm', 'MANUEL ESCALANTE', 'UADY', 'Virtual', 40),
('ws3', 'MINERÍA DE DATOS', 70.00, '9:00 am - 1:00 pm', 'VÍCTOR MENÉNDEZ', 'UADY', 'Presencial', 20);

-- ==========================================
-- 4.5 RECUPERACIÓN DE CONTRASEÑA
-- ==========================================

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

-- ==========================================
-- 5. MÓDULO ADMINISTRACIÓN (admin_)
-- ==========================================

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('superadmin','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'admin',
  `recovery_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contraseña por defecto: ConCEI2026Admin!
-- IMPORTANTE: Cambiar después del primer inicio de sesión
INSERT INTO `admin_users` (`username`, `password_hash`, `rol`) VALUES
('admin@dranabel.com', '$2y$10$8He5LuumfIhg45c26wCFbO.mFhUeiDOQrOeekgH0udtr.Ry/N01iO', 'superadmin');

CREATE TABLE IF NOT EXISTS `admin_sessions` (
  `token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_id` int NOT NULL,
  `last_activity` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `fk-admin_sessions-admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_identifier_time` (`identifier`,`attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 6. FOREIGN KEYS
-- ==========================================

ALTER TABLE `admin_sessions`
  ADD CONSTRAINT `fk-admin_sessions-admin_id` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE;

ALTER TABLE `reg_personal`
  ADD CONSTRAINT `fk-reg_personal-folio` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

ALTER TABLE `reg_evento`
  ADD CONSTRAINT `fk-reg_evento-folio` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

ALTER TABLE `reg_evento_detalles`
  ADD CONSTRAINT `fk-reg_evento_detalles-folio` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

ALTER TABLE `reg_contribuciones`
  ADD CONSTRAINT `fk-reg_contribuciones-folio` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

ALTER TABLE `reg_facturacion`
  ADD CONSTRAINT `fk-reg_facturacion-folio` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

ALTER TABLE `reg_archivos`
  ADD CONSTRAINT `fk-reg_archivos-folio` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

COMMIT;

-- ==========================================
-- 7. MIGRACIÓN (solo para BD ya existentes)
-- Ejecutar SOLO si la BD ya existe con datos.
-- NO ejecutar en instalación nueva.
-- ==========================================

-- Paso 1: limpiar talleres/visitas duplicados
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
