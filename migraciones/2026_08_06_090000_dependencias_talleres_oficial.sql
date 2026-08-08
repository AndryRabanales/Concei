-- =============================================================
-- MIGRACIÓN — Sincronizar dependencia (facultad) de talleres con la
-- página oficial https://concei3.uady.mx/talleres3/listado-talleres
-- Archivo: 2026_08_06_090000_dependencias_talleres_oficial.sql
--
-- La dueña reportó que T26–T30 solo decían "UADY". Se completan con su
-- facultad y, de paso, se alinean con la página los pocos que diferían
-- (T01, T22, T25). Solo se actualiza la columna `dependencia`: NO se toca
-- ninguna otra columna ni la estructura de la BD.
--
-- SEGURA e idempotente (solo UPDATE de la dependencia).
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

UPDATE `cat_talleres` SET `dependencia` = 'Facultad de Ingeniería, UADY'   WHERE `id` = 'T01';
UPDATE `cat_talleres` SET `dependencia` = 'Johns Hopkins University, JHU'  WHERE `id` = 'T22';
UPDATE `cat_talleres` SET `dependencia` = 'Universidad de Chile, Chile'    WHERE `id` = 'T25';
UPDATE `cat_talleres` SET `dependencia` = 'Facultad de Matemáticas, UADY'  WHERE `id` = 'T26';
UPDATE `cat_talleres` SET `dependencia` = 'Facultad de Matemáticas, UADY'  WHERE `id` = 'T27';
UPDATE `cat_talleres` SET `dependencia` = 'Facultad de Ingeniería, UADY'   WHERE `id` = 'T28';
UPDATE `cat_talleres` SET `dependencia` = 'Facultad de Matemáticas, UADY'  WHERE `id` = 'T29';
UPDATE `cat_talleres` SET `dependencia` = 'Facultad de Matemáticas, UADY'  WHERE `id` = 'T30';

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_08_06_090000_dependencias_talleres_oficial.sql');
