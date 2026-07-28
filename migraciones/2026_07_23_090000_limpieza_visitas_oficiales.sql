-- =============================================================
-- MIGRACIÓN — Limpieza del catálogo de visitas (observación 23-jul)
-- Archivo: 2026_07_23_090000_limpieza_visitas_oficiales.sql
--
-- La dueña reportó en producción una visita DUPLICADA y una con solo
-- 1 lugar (creadas a mano al probar). Esta migración deja el catálogo
-- EXACTAMENTE con las 7 visitas oficiales (V01..V07), sin duplicados ni
-- visitas de prueba, y con los datos/cupos correctos.
--
-- SEGURIDAD: solo elimina visitas que NO tengan inscripciones reales.
-- Cualquier visita con registros asociados se CONSERVA (no se toca).
-- Como en fase de montaje no hay inscripciones a visitas, el resultado
-- es el catálogo oficial limpio. SEGURA de reejecutar (idempotente).
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

-- 1. Eliminar visitas SIN inscripciones (duplicadas, de prueba, cupo=1, etc.)
--    Las que tengan registros reales quedan intactas por seguridad.
DELETE FROM `cat_visitas`
 WHERE `id` NOT IN (
   SELECT DISTINCT `item_id` FROM `reg_evento_detalles` WHERE `tipo_item` = 'visita'
 );

-- 2. Reasentar las 7 visitas oficiales con sus datos correctos.
--    INSERT ... ON DUPLICATE KEY UPDATE: crea las que falten y corrige las
--    que hubieran quedado con datos alterados (p. ej. un cupo de prueba).
INSERT INTO `cat_visitas`
  (`id`, `nombre`, `descripcion`, `precio`, `horario`, `instructor`, `dependencia`, `modalidad`, `cupo`, `cupo_actual`, `activo`) VALUES
('V01', 'Proalmex',
 'Dirección: Carretera Mérida-Motul, Tablaje Catastral 13601, C.P. 97300, Mérida, Yucatán, México. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Miércoles 7 de octubre, 11:00 hrs (Salida F.I.Q. 10:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 29, 0, 1),
('V02', 'Centro GEO',
 'Dirección: Carretera Sierra Papacal, Chuburná Puerto, Sierra Papacal. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Miércoles 7 de octubre, 12:00 a 13:30 hrs (Salida F.I.Q. 11:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 19, 0, 1),
('V03', 'KEKÉN - Planta procesadora (SAHÉ)',
 'Dirección: Carretera costera del Golfo, C.P. 97388. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Jueves 8 de octubre (Salida F.I.Q. por definir)', NULL, 'Visita Industrial', 'Presencial', 19, 0, 1),
('V04', 'Laboratorio de Ingeniería Biomédica CIR UADY',
 'Dirección: Av. Itzáes No. 490 x 59, Col. Centro. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Jueves 8 de octubre, 10:00 a 12:00 hrs (Salida F.I.Q. 9:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 14, 0, 1),
('V05', 'La Anita',
 'Dirección: C. 19 425, Cd. Industrial, C.P. 97288, Mérida, Yucatán. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Jueves 8 de octubre, 9:30 a 11:30 hrs (Salida F.I.Q. 8:00 hrs)', NULL, 'Visita Industrial', 'Presencial', 24, 0, 1),
('V06', 'Leoni (planta 2)',
 'Dirección: Tablaje catastral 18753, C.P. 97390, Mérida, Yucatán. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Viernes 9 de octubre (fecha por confirmar; Salida F.I.Q. por definir)', NULL, 'Visita Industrial', 'Presencial', 19, 0, 1),
('V07', 'UCHIYAMA',
 'Dirección: Km 11.2 Carretera Mérida-Tetíz, Lote 125, Tab. 3559, C.P. 97357, Ucú, Yucatán, México. Punto de reunión: explanada de la Facultad de Ingeniería Química. Requisitos de acceso: zapatos cerrados, pantalón largo (sin roturas), cabello recogido, sin aretes, anillos, pulseras y similares. Prohibido el uso del celular y la toma de fotografías.',
 70.00, 'Viernes 9 de octubre, 9:00 a 11:30 hrs (Salida F.I.Q. 08:15 hrs)', NULL, 'Visita Industrial', 'Presencial', 24, 0, 1)
ON DUPLICATE KEY UPDATE
  `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `precio` = VALUES(`precio`),
  `horario` = VALUES(`horario`), `dependencia` = VALUES(`dependencia`), `modalidad` = VALUES(`modalidad`),
  `cupo` = VALUES(`cupo`), `activo` = VALUES(`activo`);

-- 3. Mantener el contador de secuencia de visitas al día.
INSERT INTO `cat_ajustes` (`clave`, `valor`)
  VALUES ('seq_visita', (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_visitas))
  ON DUPLICATE KEY UPDATE `valor` = GREATEST(`valor`, (SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM cat_visitas));

INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_23_090000_limpieza_visitas_oficiales.sql');
