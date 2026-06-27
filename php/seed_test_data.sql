-- Datos de prueba para testing local del CSV
-- Contraseña de todos los usuarios de prueba: Test1234!

USE concei_db;

-- ==========================================
-- USUARIOS
-- ==========================================
INSERT INTO ini_usuarios (correo, contrasena, telefono) VALUES
('pedro.garcia@uady.mx',      '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9991112233'),
('maria.lopez@gmail.com',     '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9992223344'),
('luis.martinez@itmerida.mx', '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9993334455'),
('ana.rodriguez@uady.mx',     '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9994445566'),
('carlos.sanchez@tec.mx',     '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9995556677'),
('elena.perez@unam.mx',       '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9996667788'),
('sofia.diaz@gmail.com',      '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9997778899'),
('diego.ruiz@cinvestav.mx',   '$2y$10$Li.BMxhoWweEc4RbJ7Dc.u1SWwf.xsYDXTMn8MikM8grpDc3oZKQu', '9998889900');

-- ==========================================
-- INSCRIPCIONES
-- ==========================================
INSERT INTO reg_inscripciones (folio, correo, estatus) VALUES
('CONCEI-2026-0001', 'pedro.garcia@uady.mx',      'aceptado'),
('CONCEI-2026-0002', 'maria.lopez@gmail.com',     'revision_pendiente'),
('CONCEI-2026-0003', 'luis.martinez@itmerida.mx', 'pendiente'),
('CONCEI-2026-0004', 'ana.rodriguez@uady.mx',     'aceptado'),
('CONCEI-2026-0005', 'carlos.sanchez@tec.mx',     'revision_pendiente'),
('CONCEI-2026-0006', 'elena.perez@unam.mx',       'pendiente'),
('CONCEI-2026-0007', 'sofia.diaz@gmail.com',      'denegado'),
('CONCEI-2026-0008', 'diego.ruiz@cinvestav.mx',   'aceptado');

-- ==========================================
-- DATOS PERSONALES
-- ==========================================
INSERT INTO reg_personal (folio, nombre, apellido, institucion, ciudad, estado, pais) VALUES
('CONCEI-2026-0001', 'PEDRO',  'GARCIA LOPEZ',     'UADY Facultad de Matemáticas', 'Mérida',     'Yucatán',          'México'),
('CONCEI-2026-0002', 'MARIA',  'LOPEZ MENDEZ',     'Empresa Tech S.A. de C.V.',    'Mérida',     'Yucatán',          'México'),
('CONCEI-2026-0003', 'LUIS',   'MARTINEZ PEREZ',   'ITESM Campus Mérida',          'Mérida',     'Yucatán',          'México'),
('CONCEI-2026-0004', 'ANA',    'RODRIGUEZ SOSA',   'UADY FING',                    'Mérida',     'Yucatán',          'México'),
('CONCEI-2026-0005', 'CARLOS', 'SANCHEZ AVILA',    'Tecnológico de Monterrey',     'Monterrey',  'Nuevo León',       'México'),
('CONCEI-2026-0006', 'ELENA',  'PEREZ GUTIERREZ',  'UNAM',                         'Ciudad de México', 'CDMX',       'México'),
('CONCEI-2026-0007', 'SOFIA',  'DIAZ CANUL',       'Instituto Politécnico Nacional','Mérida',    'Yucatán',          'México'),
('CONCEI-2026-0008', 'DIEGO',  'RUIZ FERRER',      'CINVESTAV Mérida',             'Mérida',     'Yucatán',          'México');

-- ==========================================
-- DATOS DE EVENTO (tipo + monto + concepto)
-- ==========================================
INSERT INTO reg_evento (folio, tipo, total, concepto) VALUES
('CONCEI-2026-0001', 'student_uady',     '$140.00', '0001U'),
('CONCEI-2026-0002', 'general',          '$1070.00','0002G'),
('CONCEI-2026-0003', 'student_external', '$870.00', '0003E'),
('CONCEI-2026-0004', 'student_uady',     '$70.00',  '0004U'),
('CONCEI-2026-0005', 'general',          '$1140.00','0005G'),
('CONCEI-2026-0006', 'general',          '$1000.00','0006G'),
('CONCEI-2026-0007', 'student_external', '$800.00', '0007E'),
('CONCEI-2026-0008', 'student_uady',     '$0.00',   '0008U');

-- ==========================================
-- HISTORIAL DE CONCEPTOS
-- ==========================================
INSERT INTO reg_conceptos_historial (correo, folio, concepto, total) VALUES
('pedro.garcia@uady.mx',      'CONCEI-2026-0001', '0001U', '$140.00'),
('maria.lopez@gmail.com',     'CONCEI-2026-0002', '0002G', '$1070.00'),
('luis.martinez@itmerida.mx', 'CONCEI-2026-0003', '0003E', '$870.00'),
('ana.rodriguez@uady.mx',     'CONCEI-2026-0004', '0004U', '$70.00'),
('carlos.sanchez@tec.mx',     'CONCEI-2026-0005', '0005G', '$1140.00'),
('elena.perez@unam.mx',       'CONCEI-2026-0006', '0006G', '$1000.00'),
('sofia.diaz@gmail.com',      'CONCEI-2026-0007', '0007E', '$800.00'),
('diego.ruiz@cinvestav.mx',   'CONCEI-2026-0008', '0008U', '$0.00');

-- ==========================================
-- TALLERES Y VISITAS
-- ==========================================
INSERT INTO reg_evento_detalles (folio, item_id, tipo_item) VALUES
-- Pedro: ws1 + ws2
('CONCEI-2026-0001', 'ws1', 'taller'),
('CONCEI-2026-0001', 'ws2', 'taller'),
-- Maria: ws1
('CONCEI-2026-0002', 'ws1', 'taller'),
-- Luis: ws3
('CONCEI-2026-0003', 'ws3', 'taller'),
-- Ana: ws1
('CONCEI-2026-0004', 'ws1', 'taller'),
-- Carlos: ws1 + ws2 + ws3
('CONCEI-2026-0005', 'ws1', 'taller'),
('CONCEI-2026-0005', 'ws2', 'taller'),
('CONCEI-2026-0005', 'ws3', 'taller'),
-- Elena: sin talleres (solo registro general)
-- Sofia: ws2
('CONCEI-2026-0007', 'ws2', 'taller'),
-- Diego: sin talleres (acceso gratuito UADY)
('CONCEI-2026-0008', 'ws1', 'taller');

-- ==========================================
-- CONTRIBUCIONES
-- ==========================================
INSERT INTO reg_contribuciones (folio, tipo, area, modalidad, titulo, revista) VALUES
-- Pedro: 2 contribuciones
('CONCEI-2026-0001', 'ponencia', 'ia',         'virtual',    'Aplicación de redes neuronales en diagnóstico médico', 'ieee'),
('CONCEI-2026-0001', 'poster',   'robotica',   'presencial', 'Sistema de visión computacional para robots industriales', 'none'),
-- Maria: 1 contribución
('CONCEI-2026-0002', 'ponencia', 'software',   'virtual',    'Arquitectura de microservicios para sistemas distribuidos', 'ingenieria'),
-- Luis: 1 contribución
('CONCEI-2026-0003', 'ponencia', 'matematicas','presencial', 'Métodos numéricos para ecuaciones diferenciales parciales', 'none'),
-- Ana: 2 contribuciones
('CONCEI-2026-0004', 'ponencia', 'ia',         'presencial', 'Detección de anomalías en redes industriales con ML', 'ieee'),
('CONCEI-2026-0004', 'poster',   'educacion',  'presencial', 'Gamificación aplicada a la enseñanza de programación', 'none'),
-- Carlos: 1 contribución
('CONCEI-2026-0005', 'ponencia', 'energias',   'virtual',    'Optimización de paneles solares mediante algoritmos genéticos', 'ingenieria'),
-- Diego: 2 contribuciones
('CONCEI-2026-0008', 'ponencia', 'cuantico',   'presencial', 'Implementación de algoritmos cuánticos en hardware real', 'ieee'),
('CONCEI-2026-0008', 'poster',   'fisica',     'presencial', 'Caracterización de materiales semiconductores 2D', 'none');

-- ==========================================
-- FACTURACIÓN (solo algunos)
-- ==========================================
INSERT INTO reg_facturacion (folio, razon, rfc, direccion, cp, ciudad, estado, correo) VALUES
('CONCEI-2026-0002', 'Tech Solutions S.A. de C.V.', 'TSO201015AB1', 'Calle 60 No. 492 Col. Centro', '97000', 'Mérida', 'Yucatán', 'facturacion@techsolutions.mx'),
('CONCEI-2026-0005', 'Tecnológico de Monterrey AC', 'TEC860515AZ4', 'Av. Eugenio Garza Sada 2501',  '64849', 'Monterrey', 'Nuevo León', 'cfsanchez@tec.mx');

-- ==========================================
-- DOCUMENTOS (comprobantes e identificaciones)
-- ==========================================
INSERT INTO reg_documentos (correo, folio, tipo_doc, archivo, estado) VALUES
('pedro.garcia@uady.mx',      'CONCEI-2026-0001', 'comprobante',    '1750000001_proof_pedro.jpg',    'aceptado'),
('pedro.garcia@uady.mx',      'CONCEI-2026-0001', 'identificacion', '1750000002_id_pedro.jpg',       'aceptado'),
('maria.lopez@gmail.com',     'CONCEI-2026-0002', 'comprobante',    '1750000003_proof_maria.pdf',    'pendiente'),
('luis.martinez@itmerida.mx', 'CONCEI-2026-0003', 'comprobante',    '1750000004_proof_luis.jpg',     'pendiente'),
('luis.martinez@itmerida.mx', 'CONCEI-2026-0003', 'identificacion', '1750000005_id_luis.jpg',        'aceptado'),
('ana.rodriguez@uady.mx',     'CONCEI-2026-0004', 'comprobante',    '1750000006_proof_ana.jpg',      'aceptado'),
('ana.rodriguez@uady.mx',     'CONCEI-2026-0004', 'identificacion', '1750000007_id_ana.jpg',         'aceptado'),
('carlos.sanchez@tec.mx',     'CONCEI-2026-0005', 'comprobante',    '1750000008_proof_carlos.pdf',   'pendiente'),
('carlos.sanchez@tec.mx',     'CONCEI-2026-0005', 'constancia',     '1750000009_const_carlos.pdf',   'pendiente'),
('sofia.diaz@gmail.com',      'CONCEI-2026-0007', 'comprobante',    '1750000010_proof_sofia.jpg',    'rechazado'),
('diego.ruiz@cinvestav.mx',   'CONCEI-2026-0008', 'identificacion', '1750000011_id_diego.jpg',       'aceptado');
