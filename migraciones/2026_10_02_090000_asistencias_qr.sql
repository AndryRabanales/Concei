-- =============================================================
-- MIGRACIÓN — Registro de asistencia por código QR
-- Archivo: 2026_10_02_090000_asistencias_qr.sql
--
-- Crea la tabla reg_asistencias: un renglón por cada vez que el staff
-- escanea el QR de un participante (o captura su ID a mano) en la entrada.
-- El QR de cada participante se genera a partir de su folio existente; NO se
-- modifica ninguna tabla ni columna actual.
--
-- SEGURA de reejecutar: CREATE TABLE IF NOT EXISTS.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

CREATE TABLE IF NOT EXISTS `reg_asistencias` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `correo`         VARCHAR(255) NOT NULL,
  `folio`          VARCHAR(50)  NOT NULL,
  `fecha_hora`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `metodo`         ENUM('qr','manual') NOT NULL DEFAULT 'qr',
  `registrado_por` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_asist_correo` (`correo`),
  KEY `idx_asist_folio`  (`folio`),
  KEY `idx_asist_fecha`  (`fecha_hora`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_10_02_090000_asistencias_qr.sql');
