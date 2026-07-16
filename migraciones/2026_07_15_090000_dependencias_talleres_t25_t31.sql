-- =============================================================
-- MIGRACIÓN — Corregir dependencias de 2 talleres
-- Archivo: 2026_07_15_090000_dependencias_talleres_t25_t31.sql
--
-- Observaciones del 15 de julio:
--   - T25 "Aplicaciones de Inteligencia Artificial a Biomedicina"
--     -> dependencia: Universidad de Chile
--   - T31 "Uso de Notion para la Enseñanza de las Matemáticas..."
--     -> dependencia: ConexaMath Academy
--
-- SEGURA de reejecutar (UPDATE idempotente).
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

UPDATE `cat_talleres` SET `dependencia` = 'Universidad de Chile'
 WHERE `id` = 'T25' AND `nombre` LIKE 'Aplicaciones de Inteligencia Artificial%';

UPDATE `cat_talleres` SET `dependencia` = 'ConexaMath Academy'
 WHERE `id` = 'T31' AND `nombre` LIKE 'Uso de Notion%';

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_15_090000_dependencias_talleres_t25_t31.sql');
