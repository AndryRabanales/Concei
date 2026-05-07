-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 06, 2026 at 09:29 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dranabel_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `cat_ajustes`
--

CREATE TABLE `cat_ajustes` (
  `clave` varchar(50) NOT NULL,
  `valor` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cat_ajustes`
--

INSERT INTO `cat_ajustes` (`clave`, `valor`) VALUES
('general', 1000.00),
('student_external', 800.00),
('student_uady', 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `cat_codigos`
--

CREATE TABLE `cat_codigos` (
  `id` varchar(50) NOT NULL,
  `usado` tinyint(1) DEFAULT 0,
  `fecha` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cat_codigos`
--

INSERT INTO `cat_codigos` (`id`, `usado`, `fecha`) VALUES
('123-42821', 0, '2026-05-06 01:15:10'),
('123-56341', 0, '2026-05-06 01:15:10'),
('123-70079', 0, '2026-05-06 01:15:10'),
('123-72091', 0, '2026-05-06 01:15:10'),
('123-81364', 0, '2026-05-06 01:15:10'),
('123-86827', 0, '2026-05-06 01:15:10'),
('123-89599', 0, '2026-05-06 01:15:10'),
('123-92076', 0, '2026-05-06 01:15:10');

-- --------------------------------------------------------

--
-- Table structure for table `cat_talleres`
--

CREATE TABLE `cat_talleres` (
  `id` varchar(50) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT 70.00,
  `horario` varchar(100) DEFAULT NULL,
  `instructor` varchar(255) DEFAULT NULL,
  `dependencia` varchar(255) DEFAULT NULL,
  `modalidad` varchar(50) DEFAULT 'Presencial',
  `cupo` int(11) DEFAULT 30,
  `cupo_actual` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cat_talleres`
--

INSERT INTO `cat_talleres` (`id`, `nombre`, `descripcion`, `precio`, `horario`, `instructor`, `dependencia`, `modalidad`, `cupo`, `cupo_actual`) VALUES
('123', '123', '123', 70.00, '', '123', '123', 'Presencial', 123, 0),
('T01', 'DESARROLLO DE PROYECTOS CON IA', 'Taller virtual para integrar herramientas de IA en proyectos de innovación.', 70.00, '', 'DRA JESSICA CANTO', 'Facultad de Ingeniería Química, UADY', 'Virtual', 1, 0),
('T02', 'VIDEOJUEGOS 2D CON TURBOWARP', 'Explora el movimiento en videojuegos 2D y sistemas de locomoción.', 70.00, '10:00 am - 1:00 pm', 'MANUEL ESCALANTE / TERESITA MONTAÑEZ', 'Facultad de Matemáticas, UADY', 'Virtual', 40, 0),
('T03', 'PRINCIPIOS DE MINERÍA DE DATOS', 'Introducción a minería de datos con KDD y aplicación práctica con WEKA.', 70.00, '9:00 am a 1:00 pm', 'VÍCTOR HUGO MENÉNDEZ', 'Facultad de Matemáticas, UADY', 'Presencial', 20, 0),
('T04', 'GRAFICACIÓN USANDO GNUPLOT', 'Creación de gráficas científicas desde línea de comandos.', 70.00, '8:00 am a 12:00 pm', 'RICARDO LEGARDA SÁENZ', 'Facultad de Matemáticas, UADY', 'Presencial', 20, 0),
('T05', 'MICROCONTROLADORES ARM', 'Arquitectura y programación de microcontroladores con enfoque embebido.', 70.00, '8:00 am a 12:00 pm', 'OTILIO SANTOS / FERNANDO RUIZ', 'Facultad de Matemáticas, UADY', 'Presencial', 10, 0),
('T06', 'ORIGAMI MODULAR', 'Cuerpos geométricos con doblado de papel para enseñanza de geometría.', 70.00, '10:00 am a 12:00 pm', 'ISABEL TUYUB SÁNCHEZ', 'Facultad de Matemáticas, UADY', 'Presencial', 20, 0),
('T07', 'DIAGRAMAS DE FLUJO PARA INGENIEROS', 'Nomenclatura estándar para Diagramas de Bloques e Industriales.', 70.00, '9:00 am a 1:00 pm', 'JULIO SACRAMENTO RIVERO', 'Facultad de Ingeniería Química, UADY', 'Presencial', 20, 0),
('T08', 'PREDICCIÓN Y MODELADO QUÍMICO', 'Representaciones gráficas para equilibrios iónicos en disolución.', 70.00, '9:00 am a 1:00 pm', 'DAVID MUÑOZ / JESÚS BARRÓN', 'Facultad de Ingeniería Química, UADY', 'Presencial', 16, 0),
('T09', 'MECÁNICA CLÁSICA EN SEGURIDAD VIAL', 'Análisis de condiciones viales a través de Cinética y Cinemática.', 70.00, '9:00 am a 1:00 pm', 'CARLOS RUBIO / MIGUEL ESCALANTE', 'Facultad de Ingeniería Química, UADY', 'Presencial', 30, 0),
('T10', 'USO DE ORIGIN EN CIENCIAS', 'Procesar, analizar y visualizar datos experimentales con Origin.', 70.00, '2:00 pm a 6:00 pm', 'YAMILE PÉREZ / RITA SULUB', 'Facultad de Ingeniería Química, UADY', 'Virtual', 10, 0),
('T100', 'TEST RED BADGE', 'Testing the red badge.', 100.00, '10:00 - 12:00', 'Test Instructor', 'Test Dept', 'Presencial', 20, 0),
('T101', 'TEST RED BADGE 2', 'Testing red badge again.', 100.00, '', 'Test Instructor', 'Test Dept', 'Presencial', 20, 0),
('T102', 'TEST RED BADGE 3', '', 100.00, '', '', '', 'Presencial', 30, 0),
('T103', 'SMALL SCREEN TEST', '', 70.00, '', '', '', 'Presencial', 30, 0),
('T11', 'DISEÑO MOLECULAR COMPUTACIONAL', 'Bases de herramientas computacionales para diseño molecular.', 70.00, '9:00 am a 1:00 pm', 'ASHANTY KUK / FANNY RODRIGUEZ', 'Facultad de Ingeniería Química, UADY', 'Presencial', 10, 0),
('T12', 'COSTO DEL CONSUMO Y VALOR', 'Transforma datos en decisiones: modelado de costos agroalimentarios.', 70.00, '2:00 pm a 6:00 pm', 'CARLA CHÁVEZ / JESÚS ESCALANTE', 'Facultad de Ingeniería, UADY', 'Virtual', 20, 0),
('T13', 'CORELAB: TRABAJO EXPERIMENTAL', 'Habilidades esenciales: pipeteo, pesado y preparación de soluciones.', 70.00, '8:00 am a 2:00 pm', 'ZULEMA CANTILLO / JOSÉ CHIN', 'FIQ / Química', 'Presencial', 16, 0),
('T14', 'INGENIEROS QUE CONSTRUYEN REALIDADES', 'Capital, colaboración e innovación social con frameworks de Stanford.', 70.00, '8:00 am a 1:00 pm', 'JORGE RÍOS / JESICA GONZALEZ', 'Matemáticas, UADY', 'Virtual', 30, 0),
('T15', 'ELECTROQUÍMICA PARA NO EXPERTOS', 'Aplicaciones en corrosión, electrodepósito y biosensores.', 70.00, '9:00 am a 1:00 pm', 'MANUEL ESTRELLA / ERBIN UC', 'FIQ, UADY', 'Presencial', 15, 0),
('T16', 'INTRODUCCIÓN A OCTAVE', 'Resolución de problemas numéricos mediante software libre GNU Octave.', 70.00, '8:00 am a 12:00 pm', 'EDUARDO ORDÓÑEZ LÓPEZ', 'Ingeniería, UADY', 'Presencial', 20, 0),
('T17', 'MI PRIMERA IMPRESIÓN 3D', 'Introducción a manufactura aditiva y ejercicio práctico de impresión.', 70.00, '9:00 am a 1:00 pm', 'BASSAM ALI / LUIS RICALDE', 'Ingeniería, UADY', 'Presencial', 16, 0),
('T18', 'INTRODUCCIÓN A LA ESPECTROSCOPÍA', 'Cómo la luz interactúa con la materia y revela su composición.', 70.00, '8:00 am a 1:00 pm', 'RUDY AMILCAR TREJO', 'FIQ, UADY', 'Presencial', 10, 0),
('T19', 'TECNOLOGÍAS ALIMENTARIAS COMPARTIDAS', 'Procesos compartidos entre industria animal y humana.', 70.00, '8:00 am a 1:00 pm', 'ARTURO CASTELLANOS / DAVID BETANCUR', 'FIQ, UADY', 'Presencial', 20, 0),
('T20', 'INTERFERÓMETRO DE MICHELSON', 'Metrología óptica: teoría, simulación y práctica experimental.', 70.00, '2:00 pm a 6:00 pm', 'MARIO PÉREZ / MAURICIO ORTÍZ', 'Ingeniería, UADY', 'Presencial', 20, 0),
('T21', 'PROCESAMIENTO INEGI CON PYTHON', 'Uso de Pandas y Folium para análisis de datos abiertos y mapas.', 70.00, '2:00 pm a 6:00 pm', 'ENRIQUE CAMACHO PÉREZ', 'Ingeniería, UADY', 'Presencial', 10, 0),
('T22', 'IA PARA IMÁGENES EN CIRUGÍA', 'Modelos fundacionales aplicados al análisis médico complejo.', 70.00, '11:00 am - 3:00 pm', 'ROGER D. SOBERANIS', 'Johns Hopkins', 'Virtual', 20, 0),
('T23', 'FIGURAS EQUIVALENTES Y RECREATIVAS', 'Matemáticas recreativas a través de la geometría visual y abstracta.', 70.00, '9:00 am a 1:00 pm', 'MARÍA DEL PILAR ROSADO', 'Matemáticas, UADY', 'Presencial', 30, 0),
('T99', 'TEST RED BADGE', 'Testing the red badge.', 70.00, '', 'Test Instructor', 'Test Dept', 'Presencial', 30, 0),
('triu', 'tt', 'tt', 70.00, '', 'tt', 'tt', 'Presencial', 1, 0);

-- --------------------------------------------------------

--
-- Table structure for table `cat_visitas`
--

CREATE TABLE `cat_visitas` (
  `id` varchar(50) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT 70.00,
  `horario` varchar(100) DEFAULT NULL,
  `instructor` varchar(255) DEFAULT NULL,
  `dependencia` varchar(255) DEFAULT NULL,
  `modalidad` varchar(50) DEFAULT 'Presencial',
  `cupo` int(11) DEFAULT 30,
  `cupo_actual` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cat_visitas`
--

INSERT INTO `cat_visitas` (`id`, `nombre`, `descripcion`, `precio`, `horario`, `instructor`, `dependencia`, `modalidad`, `cupo`, `cupo_actual`) VALUES
('V02', 'CFE', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V03', 'Erbessd', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V04', 'Laboratorio de Biomédica UADY', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V05', 'CentroGEO', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V06', 'Proteínas y Oleicos', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V07', 'Proalmex', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V08', 'Uchiyama', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V09', 'Grupo Delli', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V10', 'Bepensa', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V11', 'AES', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0),
('V12', 'La Anita', NULL, 70.00, NULL, NULL, NULL, 'Presencial', 30, 0);

-- --------------------------------------------------------

--
-- Table structure for table `ini_usuarios`
--

CREATE TABLE `ini_usuarios` (
  `id` int(11) NOT NULL,
  `correo` varchar(255) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `fecha_registro` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ini_usuarios`
--

INSERT INTO `ini_usuarios` (`id`, `correo`, `contrasena`, `telefono`, `fecha_registro`) VALUES
(1, 'andry_halo2@hotmail.com', '$2y$10$GnjWMaPzDc2BKlOxF3Vheej0QoExgJLZ3CNNjkF7KDnz99P/.hKH.', 'andry_halo2@hotmail.', '2026-05-01 16:52:29'),
(2, 'dani@gmail.com', '$2y$10$TGgTuPccoTMPLKwmg2VXgOWDuvQfROXFZaLOi5qss6FowzJ3ftAAq', '123', '2026-05-06 00:06:55');

-- --------------------------------------------------------

--
-- Table structure for table `reg_archivos`
--

CREATE TABLE `reg_archivos` (
  `folio` varchar(50) NOT NULL,
  `comprobante` varchar(255) DEFAULT NULL,
  `identificacion` varchar(255) DEFAULT NULL,
  `constancia` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reg_archivos`
--

INSERT INTO `reg_archivos` (`folio`, `comprobante`, `identificacion`, `constancia`) VALUES
('CONCEI-2026-1266', '', '', ''),
('CONCEI-2026-2484', '', '', ''),
('CONCEI-2026-9927', '', '', '');

-- --------------------------------------------------------

--
-- Table structure for table `reg_contribuciones`
--

CREATE TABLE `reg_contribuciones` (
  `id` int(11) NOT NULL,
  `folio` varchar(50) DEFAULT NULL,
  `tipo` varchar(50) DEFAULT NULL,
  `area` varchar(100) DEFAULT NULL,
  `modalidad` varchar(50) DEFAULT NULL,
  `titulo` text DEFAULT NULL,
  `revista` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reg_evento`
--

CREATE TABLE `reg_evento` (
  `folio` varchar(50) NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `total` varchar(50) DEFAULT NULL,
  `concepto` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reg_evento`
--

INSERT INTO `reg_evento` (`folio`, `tipo`, `total`, `concepto`) VALUES
('CONCEI-2026-1266', 'general', '$1,000.00', '8179G'),
('CONCEI-2026-2484', 'general', '$1,070.00', '3883GT01'),
('CONCEI-2026-9927', 'general', '$1,000.00', '9692GT111');

-- --------------------------------------------------------

--
-- Table structure for table `reg_evento_detalles`
--

CREATE TABLE `reg_evento_detalles` (
  `id` int(11) NOT NULL,
  `folio` varchar(50) DEFAULT NULL,
  `item_id` varchar(50) DEFAULT NULL,
  `tipo_item` enum('taller','visita') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reg_evento_detalles`
--

INSERT INTO `reg_evento_detalles` (`id`, `folio`, `item_id`, `tipo_item`) VALUES
(1, 'CONCEI-2026-2484', 'T01', 'taller'),
(4, 'CONCEI-2026-1266', 'AAAA', 'taller'),
(5, 'CONCEI-2026-9927', '111', 'taller');

-- --------------------------------------------------------

--
-- Table structure for table `reg_facturacion`
--

CREATE TABLE `reg_facturacion` (
  `folio` varchar(50) NOT NULL,
  `razon` varchar(255) DEFAULT NULL,
  `rfc` varchar(20) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `cp` varchar(10) DEFAULT NULL,
  `ciudad` varchar(100) DEFAULT NULL,
  `estado` varchar(100) DEFAULT NULL,
  `correo` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reg_inscripciones`
--

CREATE TABLE `reg_inscripciones` (
  `folio` varchar(50) NOT NULL,
  `correo` varchar(255) NOT NULL,
  `estatus` varchar(50) DEFAULT 'pendiente',
  `fecha_inscripcion` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reg_inscripciones`
--

INSERT INTO `reg_inscripciones` (`folio`, `correo`, `estatus`, `fecha_inscripcion`) VALUES
('CONCEI-2026-1266', 'test@example.com', 'pendiente', '2026-05-05 23:56:55'),
('CONCEI-2026-2484', 'andry_halo2@hotmail.com', 'pendiente', '2026-05-05 22:47:09'),
('CONCEI-2026-9927', 'dani@gmail.com', 'pendiente', '2026-05-06 00:07:22');

-- --------------------------------------------------------

--
-- Table structure for table `reg_personal`
--

CREATE TABLE `reg_personal` (
  `folio` varchar(50) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `institucion` varchar(255) DEFAULT NULL,
  `ciudad` varchar(100) DEFAULT NULL,
  `estado` varchar(100) DEFAULT NULL,
  `pais` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reg_personal`
--

INSERT INTO `reg_personal` (`folio`, `nombre`, `apellido`, `institucion`, `ciudad`, `estado`, `pais`) VALUES
('CONCEI-2026-1266', 'Test', 'User', 'Test Org', 'Test City', 'Test State', 'Mexico'),
('CONCEI-2026-2484', 'LUIS', 'LOPEZ', 'INSTITUTO LOPEZ', 'MERIDA', '', 'MEXICO'),
('CONCEI-2026-9927', 'Test', 'User', 'Test Org', 'Test City', 'Test State', 'Mexico');

-- --------------------------------------------------------

--
-- Table structure for table `reg_reservas_temp`
--

CREATE TABLE `reg_reservas_temp` (
  `correo` varchar(255) NOT NULL,
  `items_json` text DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cat_ajustes`
--
ALTER TABLE `cat_ajustes`
  ADD PRIMARY KEY (`clave`);

--
-- Indexes for table `cat_codigos`
--
ALTER TABLE `cat_codigos`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `cat_talleres`
--
ALTER TABLE `cat_talleres`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `cat_visitas`
--
ALTER TABLE `cat_visitas`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ini_usuarios`
--
ALTER TABLE `ini_usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `correo` (`correo`);

--
-- Indexes for table `reg_archivos`
--
ALTER TABLE `reg_archivos`
  ADD PRIMARY KEY (`folio`);

--
-- Indexes for table `reg_contribuciones`
--
ALTER TABLE `reg_contribuciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `folio` (`folio`);

--
-- Indexes for table `reg_evento`
--
ALTER TABLE `reg_evento`
  ADD PRIMARY KEY (`folio`);

--
-- Indexes for table `reg_evento_detalles`
--
ALTER TABLE `reg_evento_detalles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `folio` (`folio`);

--
-- Indexes for table `reg_facturacion`
--
ALTER TABLE `reg_facturacion`
  ADD PRIMARY KEY (`folio`);

--
-- Indexes for table `reg_inscripciones`
--
ALTER TABLE `reg_inscripciones`
  ADD PRIMARY KEY (`folio`);

--
-- Indexes for table `reg_personal`
--
ALTER TABLE `reg_personal`
  ADD PRIMARY KEY (`folio`);

--
-- Indexes for table `reg_reservas_temp`
--
ALTER TABLE `reg_reservas_temp`
  ADD PRIMARY KEY (`correo`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ini_usuarios`
--
ALTER TABLE `ini_usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `reg_contribuciones`
--
ALTER TABLE `reg_contribuciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `reg_evento_detalles`
--
ALTER TABLE `reg_evento_detalles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `reg_archivos`
--
ALTER TABLE `reg_archivos`
  ADD CONSTRAINT `reg_archivos_ibfk_1` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

--
-- Constraints for table `reg_contribuciones`
--
ALTER TABLE `reg_contribuciones`
  ADD CONSTRAINT `reg_contribuciones_ibfk_1` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

--
-- Constraints for table `reg_evento`
--
ALTER TABLE `reg_evento`
  ADD CONSTRAINT `reg_evento_ibfk_1` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

--
-- Constraints for table `reg_evento_detalles`
--
ALTER TABLE `reg_evento_detalles`
  ADD CONSTRAINT `reg_evento_detalles_ibfk_1` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

--
-- Constraints for table `reg_facturacion`
--
ALTER TABLE `reg_facturacion`
  ADD CONSTRAINT `reg_facturacion_ibfk_1` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;

--
-- Constraints for table `reg_personal`
--
ALTER TABLE `reg_personal`
  ADD CONSTRAINT `reg_personal_ibfk_1` FOREIGN KEY (`folio`) REFERENCES `reg_inscripciones` (`folio`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
