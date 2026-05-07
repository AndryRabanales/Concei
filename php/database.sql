-- Script de Base de Datos DrAnabel v8 (Tablas con Prefijo, Columnas SIN Prefijo - 100% ESPAÑOL)
-- Este script organiza las tablas por módulo pero usa nombres de columna limpios.

CREATE DATABASE IF NOT EXISTS dranabel_db;
USE dranabel_db;

-- ==========================================
-- 0. DESTRUCCIÓN DE TODO LO EXISTENTE
-- ==========================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS reg_archivos, reg_facturacion, reg_evento, reg_personal, reg_inscripciones, ini_usuarios, cat_talleres, cat_visitas, cat_codigos, cat_ajustes;
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- 1. MÓDULO INICIO / CUENTAS (ini_)
-- ==========================================
CREATE TABLE ini_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(255) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. MÓDULO REGISTRO AL CONGRESO (reg_)
-- ==========================================

-- Tabla Principal
CREATE TABLE reg_inscripciones (
    folio VARCHAR(50) PRIMARY KEY,
    correo VARCHAR(255) NOT NULL,
    estatus VARCHAR(50) DEFAULT 'pendiente',
    fecha_inscripcion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rama Personal
CREATE TABLE reg_personal (
    folio VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    institucion VARCHAR(255),
    ciudad VARCHAR(100),
    estado VARCHAR(100),
    pais VARCHAR(100),
    FOREIGN KEY (folio) REFERENCES reg_inscripciones(folio) ON DELETE CASCADE
);

-- Rama Detalles Evento
CREATE TABLE reg_evento (
    folio VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    total VARCHAR(50),
    concepto VARCHAR(100),
    FOREIGN KEY (folio) REFERENCES reg_inscripciones(folio) ON DELETE CASCADE
);

-- NUEVA TABLA: Detalles de Talleres y Visitas (Muchos a Muchos)
CREATE TABLE reg_evento_detalles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(50),
    item_id VARCHAR(50),
    tipo_item ENUM('taller', 'visita'),
    FOREIGN KEY (folio) REFERENCES reg_inscripciones(folio) ON DELETE CASCADE
);

-- NUEVA TABLA: Contribuciones de Autores
CREATE TABLE reg_contribuciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(50),
    tipo VARCHAR(50),
    area VARCHAR(100),
    modalidad VARCHAR(50),
    titulo TEXT,
    revista VARCHAR(100), -- COLUMNA MOVIDA AQUÍ
    FOREIGN KEY (folio) REFERENCES reg_inscripciones(folio) ON DELETE CASCADE
);

-- Rama Facturación
CREATE TABLE reg_facturacion (
    folio VARCHAR(50) PRIMARY KEY,
    razon VARCHAR(255),
    rfc VARCHAR(20),
    direccion TEXT,
    cp VARCHAR(10),
    ciudad VARCHAR(100),
    estado VARCHAR(100),
    correo VARCHAR(255),
    FOREIGN KEY (folio) REFERENCES reg_inscripciones(folio) ON DELETE CASCADE
);

-- Rama Archivos
CREATE TABLE reg_archivos (
    folio VARCHAR(50) PRIMARY KEY,
    comprobante VARCHAR(255),
    identificacion VARCHAR(255),
    constancia VARCHAR(255),
    FOREIGN KEY (folio) REFERENCES reg_inscripciones(folio) ON DELETE CASCADE
);

-- ==========================================
-- 3. MÓDULO CATÁLOGOS / CONFIG (cat_)
-- ==========================================

CREATE TABLE cat_talleres (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) DEFAULT 70.00,
    horario VARCHAR(100),
    instructor VARCHAR(255),
    dependencia VARCHAR(255),
    modalidad VARCHAR(50) DEFAULT 'Presencial',
    cupo INT DEFAULT 30
);

CREATE TABLE cat_visitas (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) DEFAULT 70.00,
    horario VARCHAR(100),
    instructor VARCHAR(255),
    dependencia VARCHAR(255),
    modalidad VARCHAR(50) DEFAULT 'Presencial',
    cupo INT DEFAULT 30
);

CREATE TABLE cat_codigos (
    id VARCHAR(50) PRIMARY KEY,
    usado BOOLEAN DEFAULT FALSE,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cat_ajustes (
    clave VARCHAR(50) PRIMARY KEY,
    valor DECIMAL(10, 2) NOT NULL
);

-- ==========================================
-- 4. DATOS INICIALES
-- ==========================================
INSERT INTO cat_ajustes (clave, valor) VALUES 
('general', 1000.00),
('student_external', 800.00),
('student_uady', 0.00);

INSERT INTO cat_talleres (id, nombre, precio, horario, instructor, dependencia, modalidad, cupo) VALUES 
('ws1', 'IA EN INGENIERÍA', 70.00, '9:00 am - 1:00 pm', 'DRA JESSICA CANTO', 'UADY', 'Virtual', 25),
('ws2', 'VIDEOJUEGOS 2D', 70.00, '10:00 am - 1:00 pm', 'MANUEL ESCALANTE', 'UADY', 'Virtual', 40),
('ws3', 'MINERÍA DE DATOS', 70.00, '9:00 am - 1:00 pm', 'VÍCTOR MENÉNDEZ', 'UADY', 'Presencial', 20);
