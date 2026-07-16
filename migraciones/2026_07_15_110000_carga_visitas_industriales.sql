-- =============================================================
-- MIGRACIÓN — Carga de Visitas Industriales ConCEI-3
-- Archivo: 2026_07_15_110000_carga_visitas_industriales.sql
--
-- Fuente: https://concei3.uady.mx/talleres3/visitas-industriales
-- Precio uniforme: $70.00. Modalidad: Presencial. IDs V01..V07.
-- Cupos definidos por la organización. Air Temp y Grupo Modelo NO se
-- incluyen (fecha/participación aún sin definir).
--
-- SEGURA de reejecutar (INSERT IGNORE + contador con GREATEST).
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

INSERT IGNORE INTO `cat_visitas`
  (`id`, `nombre`, `descripcion`, `precio`, `horario`, `instructor`, `dependencia`, `modalidad`, `cupo`) VALUES

('V01', 'Proalmex',
 'Dirección: Carretera Mérida-Motul, Tablaje Catastral 13601, C.P. 97300, Mérida, Yucatán, México. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Miércoles 7 de octubre, 11:00 hrs (Salida F.I.Q. 10:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 29),

('V02', 'Centro GEO',
 'Dirección: Carretera Sierra Papacal, Chuburná Puerto, Sierra Papacal. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Miércoles 7 de octubre, 12:00 a 13:30 hrs (Salida F.I.Q. 11:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 19),

('V03', 'KEKÉN - Planta procesadora (SAHÉ)',
 'Dirección: Carretera costera del Golfo, C.P. 97388. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Jueves 8 de octubre (Salida F.I.Q. por definir)', NULL, 'Visita Industrial', 'Presencial', 19),

('V04', 'Laboratorio de Ingeniería Biomédica CIR UADY',
 'Dirección: Av. Itzáes No. 490 x 59, Col. Centro. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Jueves 8 de octubre, 10:00 a 12:00 hrs (Salida F.I.Q. 9:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 14),

('V05', 'La Anita',
 'Dirección: C. 19 425, Cd. Industrial, C.P. 97288, Mérida, Yucatán. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Jueves 8 de octubre, 9:30 a 11:30 hrs (Salida F.I.Q. 8:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 24),

('V06', 'Leoni (planta 2)',
 'Dirección: Tablaje catastral 18753, C.P. 97390, Mérida, Yucatán. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Viernes 9 de octubre (fecha por confirmar; Salida F.I.Q. por definir)', NULL, 'Visita Industrial', 'Presencial', 19),

('V07', 'UCHIYAMA',
 'Dirección: Km 11.2 Carretera Mérida-Tetíz, Lote 125, Tab. 3559, C.P. 97357, Ucú, Yucatán, México. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Viernes 9 de octubre, 9:00 a 11:30 hrs (Salida F.I.Q. 08:15 hrs)', NULL, 'Visita Industrial', 'Presencial', 24);

-- Mantener el contador de secuencia de visitas al día (para futuras altas
-- desde el panel: la siguiente será V08 sin reutilizar números).
INSERT INTO `cat_ajustes` (`clave`, `valor`)
  VALUES ('seq_visita', (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_visitas))
  ON DUPLICATE KEY UPDATE `valor` = GREATEST(`valor`, (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_visitas));

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_15_110000_carga_visitas_industriales.sql');
