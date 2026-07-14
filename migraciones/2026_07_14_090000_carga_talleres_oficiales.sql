-- =============================================================
-- MIGRACIÓN — Carga de los 31 talleres oficiales ConCEI-3
-- Archivo: 2026_07_14_090000_carga_talleres_oficiales.sql
--
-- Fuente: "Listado de Talleres ConCEI-3" (PDF oficial, 9 páginas).
-- Precio uniforme: $70.00 en todos los talleres.
--
-- - Actualiza ws1, ws2 y ws3 (semilla) con su nombre, descripción,
--   instructor y horario oficiales (son los talleres 1-3 del PDF).
-- - Inserta ws4..ws31 con INSERT IGNORE (no duplica si ya existen).
-- - Los IDs ws1..ws31 generan los conceptos de pago T01..T31 en orden.
--
-- SEGURA de reejecutar. No borra ni modifica registros de usuarios.
-- Al final se registra a sí misma en la tabla `migraciones`.
-- =============================================================

SET NAMES utf8mb4;
USE `concei_db`;

-- -------------------------------------------------------------
-- 1-3: actualizar los talleres semilla con los datos oficiales
-- -------------------------------------------------------------
UPDATE `cat_talleres` SET
  `nombre` = 'Desarrollo de Proyectos de Innovación con Inteligencia Artificial',
  `descripcion` = 'Taller virtual de 4 horas dirigido a estudiantes de ingeniería para integrar herramientas de Inteligencia Artificial en el desarrollo de proyectos de innovación. A través de metodología de aprendizaje basado en proyectos, los participantes identificarán oportunidades, estructurarán soluciones, elaborarán documentación técnica y evaluarán la viabilidad de su propuesta. Al concluir, cada estudiante contará con un anteproyecto de innovación estructurado, listo para presentación académica o vinculación con proyectos de investigación.',
  `precio` = 70.00,
  `horario` = '9:00 am a 1:00 pm (4 horas)',
  `instructor` = 'Jessica Alejandra Canto Maldonado',
  `dependencia` = 'Facultad de Ingeniería Química, UADY',
  `modalidad` = 'Virtual',
  `cupo` = 25
WHERE `id` = 'ws1';

UPDATE `cat_talleres` SET
  `nombre` = 'Rescate Espacial: Trayectorias y Sistemas de Locomoción 2D para Videojuegos con TurboWarp e IA',
  `descripcion` = 'Este taller te invita a explorar cómo se genera el movimiento en los videojuegos 2D mediante la creación de una animación sobre el rescate de un astronauta. Durante el proceso incorporarás conceptos clave de animación al diseñar trayectorias y movimientos (rápido-lento, lento-rápido y rectilíneo uniforme). Con TurboWarp programarás estas dinámicas y, con apoyo de IA, las optimizarás. La experiencia integra creatividad, matemáticas y programación para que diseñes tus propias mecánicas de movimiento. Requerimientos: Tener instalado el software TurboWarp y estar registrado en alguna IA.',
  `precio` = 70.00,
  `horario` = '10:00 am - 1:00 pm (3 horas)',
  `instructor` = 'Manuel Jesús David Escalante Torres / Teresita del Jesús Montañez May',
  `dependencia` = 'Facultad de Matemáticas, UADY',
  `modalidad` = 'Virtual',
  `cupo` = 40
WHERE `id` = 'ws2';

UPDATE `cat_talleres` SET
  `nombre` = 'Principios de Minería de Datos',
  `descripcion` = 'Este taller introduce los fundamentos de la minería de datos mediante el enfoque metodológico de KDD y su aplicación práctica con WEKA. A lo largo de la sesión se desarrolla el ciclo completo de descubrimiento de conocimiento aplicando técnicas de clasificación, agrupamiento y reglas de asociación sobre conjuntos de datos reales. El énfasis está en comprender integralmente la metodología y en interpretar adecuadamente los resultados obtenidos. Requerimientos: Software Weka.',
  `precio` = 70.00,
  `horario` = '9:00 am a 1:00 pm (4 horas)',
  `instructor` = 'Víctor Hugo Menéndez Domínguez',
  `dependencia` = 'Facultad de Matemáticas, UADY',
  `modalidad` = 'Presencial',
  `cupo` = 20
WHERE `id` = 'ws3';

-- -------------------------------------------------------------
-- 4-31: talleres nuevos (INSERT IGNORE: no duplica si ya existen)
-- -------------------------------------------------------------
INSERT IGNORE INTO `cat_talleres`
  (`id`, `nombre`, `descripcion`, `precio`, `horario`, `instructor`, `dependencia`, `modalidad`, `cupo`) VALUES

('ws4', 'Graficación usando Gnuplot',
 'Gnuplot es una utilidad que permite crear gráficas de tipo científico desde el comando en línea, que puede ser usada en diversos SO. Requerimientos: GNUplot en Windows y Linux.',
 70.00, '8:00 am a 12:00 pm (4 horas)', 'Ricardo Legarda Sáenz', 'Facultad de Matemáticas, UADY', 'Presencial', 20),

('ws5', 'Arquitectura y Programación de Microcontroladores ARM con un Enfoque hacia el Software Embebido y Sistemas de Tiempo Real',
 'Curso basado en las plataformas: STM32F103-Blue-Pill y EK-TM4C1294XL. Plataforma de programación: Keil uvision. Lenguaje de programación: Lenguaje C y ensamblador sin librerías. Dirigido a: Persona interesada en software embebido y sistemas de tiempo real. TEMARIO: 1. Registros internos del microcontrolador, 2. Memoria de datos y de programa, 3. Puertos de entrada/salida digitales, 4. Protocolos de comunicación SPI, UART, etc., 5. Timers, 6. Interrupciones, 7. Sistemas de Reloj, 8. RTC.',
 70.00, '8:00 am a 12:00 pm - 2:00 pm a 6:00 pm (8 horas)', 'Otilio Santos Aguilar / Fernando Ruiz Cardeña', 'Facultad de Matemáticas, UADY', 'Presencial', 10),

('ws6', 'Origami Modular para la Enseñanza de la Geometría',
 '¿Quieres aprender a realizar cuerpos geométricos sólo con el doblado de papel? En este taller no sólo realizaremos figuras geométricas utilizando origami modular, sino le daremos un sentido para el apoyo de la enseñanza de la geometría como innovación para el aprendizaje, ya que permite la motricidad y combinación de colores que el arte del origami contempla.',
 70.00, '9:00 am a 12:00 pm (3 horas)', 'Isabel Tuyub Sánchez', 'Facultad de Matemáticas, UADY', 'Presencial', 20),

('ws7', 'Elaboración de Diagramas de Flujo de Proceso para Ingenieros',
 'Aprenderemos a utilizar nomenclatura estándar internacional para dibujar Diagramas de Bloques, sin tener que recurrir a software especializado, y Diagramas de Flujo de Proceso, para procesos industriales y plantas químicas. Requerimientos: Paquetería Office.',
 70.00, '9:00 am a 1:00 pm - 2:00 pm a 6:00 pm (8 horas)', 'Julio César Sacramento Rivero', 'Facultad de Ingeniería Química, UADY', 'Presencial', 20),

('ws8', 'Predicción y Modelado de la Distribución de Especies y sus Aplicaciones en Química Analítica',
 'Este taller aborda los fundamentos para elaborar representaciones gráficas para el estudio de los equilibrios iónicos en disolución acuosa, así como su aplicación en el laboratorio. Para aprovechar al máximo esta experiencia, se recomienda que los alumnos hayan cursado y aprobado previamente la asignatura de Química Analítica. Requerimientos: Excel.',
 70.00, '9:00 am a 1:00 pm - 2:00 pm a 6:00 pm (8 horas)', 'David Muñoz Rodríguez / Jesús Alberto Barrón Zambrano', 'Facultad de Ingeniería Química, UADY', 'Presencial', 16),

('ws9', 'La Mecánica Clásica en la Seguridad Vial',
 'Analizar las condiciones viales a través de los conceptos planteados por la Cinética y la Cinemática y sus implicaciones en el reglamento de tránsito.',
 70.00, '9:00 am a 1:00 pm - 2:00 pm a 6:00 pm (8 horas)', 'Carlos Martín Rubio Atoche / Miguel Ángel Escalante Solís', 'Facultad de Ingeniería Química, UADY', 'Presencial', 30),

('ws10', 'Del Experimento al Gráfico: Uso de Origin en Ciencias e Ingeniería',
 'Taller práctico de 4 horas para aprender a procesar, analizar y visualizar datos experimentales con Origin. Se trabajará con ejemplos reales para generar gráficas científicas, realizar ajustes básicos e interpretar resultados. Al finalizar, los participantes podrán transformar datos crudos en figuras listas para reportes, tesis o publicaciones.',
 70.00, '2:00 pm a 6:00 pm (4 horas)', 'Yamile Pérez Padilla / Rita del Rosario Sulub Sulub', 'Facultad de Ingeniería Química, UADY', 'Virtual', 10),

('ws11', 'Diseño Molecular Asistido por Computadora con Aplicación en Química Analítica',
 'En este taller se darán las bases para el uso de herramientas computacionales para el diseño molecular con aplicaciones en química analítica. Requerimientos: ASPEN PLUS.',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'Ashanty Estefanía Kuk González / Fanny Yaretzy Rodríguez Carrillo', 'Facultad de Ingeniería Química, UADY', 'Presencial', 10),

('ws12', 'El Costo del Consumo y la Cadena de Valor',
 'En 4 horas transforma datos en decisiones: modela costos agroalimentarios de la parcela al plato, simula escenarios de riesgo, mide resiliencia y construye dashboards en Power BI/R. Integrarás costos fijos, variables y ocultos, y detectarás fugas de valor por eslabón. Entregables: modelo matemático, simulaciones y dashboard funcional, propuesta estratégica para fortalecer la soberanía alimentaria, mejorar márgenes, asegurar precios accesibles y redes. Requerimientos: Software Power BI y R.',
 70.00, '2:00 pm a 6:00 pm (4 horas)', 'Carla Karina Chávez Moreno / Jesús Francisco Escalante Euán / Javier González Correa', 'Facultad de Ingeniería, UADY', 'Virtual', 20),

('ws13', 'CoreLab: Habilidades Clave para el Trabajo Experimental',
 'CoreLab: Habilidades Clave para el Trabajo Experimental es un curso práctico diseñado para desarrollar competencias esenciales en el laboratorio. Aprenderás técnicas correctas de pipeteo, pesado y medición, así como la preparación de soluciones con precisión y buenas prácticas. Ideal para fortalecer tu desempeño experimental desde las bases y mejorar la calidad de tus resultados en áreas de ingeniería.',
 70.00, '8:00 am a 2:00 pm (6 horas)', 'Zulema Osiris Cantillo Ciau / José del Carmen Chin Vera', 'Facultad de Ingeniería Química y Facultad de Química, UADY', 'Presencial', 16),

('ws14', 'Ingenieros que Construyen Realidades: Capital, Colaboración e Innovación Social',
 '¿Qué separa a un ingeniero que resuelve problemas técnicos de uno que transforma su región? Este taller conecta el rigor STEM con frameworks del Center for Design Research de Stanford para explorar el origen del capital, el valor de salirse de lo establecido y cómo escuchar, hacer mejores preguntas y dar feedback cambia lo que un equipo es capaz de construir juntos. El objetivo: que cada participante descubra que la innovación no empieza con recursos ni con permiso. Empieza con ellos. Requerimientos: Un equipo de cómputo con micrófono y cámara.',
 70.00, '8:00 am a 1:00 pm (5 horas)', 'Jorge Ríos Martínez / Jesica Leticia González Robles', 'Facultad de Matemáticas, UADY', 'Presencial', 30),

('ws15', 'Electroquímica para No Electroquímicos',
 'Mostrar a los participantes las diversas aplicaciones de la electroquímica, como la corrosión, el electrodepósito y los biosensores electroquímicos.',
 70.00, '9:00 am a 1:00 pm - 2:00 pm a 6:00 pm (8 horas)', 'Manuel Alejandro Estrella Gutiérrez / Erbin Guillermo Uc Cayetano / Francisco Iván Lizama Tzec', 'Facultad de Ingeniería Química, UADY', 'Presencial', 15),

('ws16', 'Introducción a Octave, Software de Programación Científico',
 'Este curso habilita al estudiante para resolver problemas numéricos por medio del software libre GNU Octave. Está estructurado en cuatro bloques. Bloque 1: Interfaz del usuario, cómo citar el software, obtención de ayuda, definición de variables, paquetes, operadores, constantes, números aleatorios, solución de ecuaciones lineales y evaluación de polinomios. Bloque 2: Ecuaciones y gráficos 2D. Bloque 3: Gráficos 3D. Bloque 4: Histograma, función densidad de probabilidad, distribución de probabilidad y ajuste a modelos. Requerimientos: El estudiante deberá asistir con el software libre ya instalado en su computadora personal.',
 70.00, '8:00 am a 12:00 pm (4 horas)', 'Eduardo Ernesto Ordóñez López', 'Facultad de Ingeniería, UADY', 'Presencial', 20),

('ws17', 'Mi Primer Impresión 3D',
 'El objetivo de este taller es introducir a los estudiantes a tecnologías de impresión 3D mediante una exposición teórica y acompañamiento de un ejercicio práctico, con el propósito de desarrollar competencias básicas en manufactura aditiva y evidenciar su aplicabilidad en distintos sectores.',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'Bassam Ali / Luis José Ricalde Castellanos / Luis Daniel Marín Uc / Anthony Jair Hernández Bautista', 'Facultad de Ingeniería, UADY', 'Presencial', 16),

('ws18', 'Cuando la Luz Revela la Materia: Introducción a la Espectroscopía',
 'Este taller invita a descubrir cómo la luz permite comprender lo que no vemos. Exploraremos de forma accesible cómo la luz interactúa con la materia y qué información revela sobre su composición. Conocerás los principios básicos de la espectroscopía, técnicas elementales y ejemplos de aplicación en física, química y ciencia de materiales. Es tu oportunidad de interpretar el lenguaje invisible de la materia, con herramientas que transforman observación en conocimiento.',
 70.00, '8:00 am a 1:00 pm (5 horas)', 'Rudy Amilcar Trejo Tzab', 'Facultad de Ingeniería Química, UADY', 'Presencial', 10),

('ws19', 'Tecnologías Alimentarias Compartidas entre la Industria de Alimentos para Animales y para Humanos. ¿Es Posible?',
 'En la industria de los alimentos se utilizan tecnologías tales como: deshidratado, molienda, mezclado, extrusión, peleteado, recurriendo a aditivos como antioxidantes, antiapelmazantes, saborizantes, colorantes, etc. ¿Cuál es el destino de estos alimentos? Los humanos o los animales. La respuesta era obvia: para ambos. Este es el tema de este breve curso.',
 70.00, '8:00 am a 1:00 pm (5 horas)', 'Arturo Francisco Castellanos Ruelas / David Abram Betancur Ancona', 'Facultad de Ingeniería Química, UADY', 'Presencial', 20),

('ws20', 'Utilización del Interferómetro de Michelson',
 'Taller de 8 horas sobre el interferómetro de Michelson que integra teoría, simulación y práctica. Se estudian principios de interferencia, coherencia y formación de franjas. Incluye un software desarrollado para visualizar en tiempo real el efecto de distintos parámetros. Los participantes aplican lo aprendido en un sistema experimental, fortaleciendo la comprensión y su uso en metrología óptica.',
 70.00, '8:00 am a 12:00 pm (4 horas)', 'Mario Pérez Cortés / Mauricio Ortíz Gutiérrez', 'Facultad de Ingeniería, UADY', 'Presencial', 20),

('ws21', 'Manejo y Procesamiento de Datos del INEGI usando Python',
 'Este taller tiene como objetivo introducir a los participantes en el manejo, procesamiento y análisis de datos abiertos del INEGI utilizando Python. A través del uso de herramientas como Pandas y Folium, los asistentes aprenderán a limpiar, estructurar y explorar bases de datos reales, así como a generar visualizaciones geoespaciales que faciliten la interpretación de la información.',
 70.00, '2:00 pm a 6:00 pm (4 horas)', 'Enrique Camacho Pérez', 'Facultad de Ingeniería, UADY', 'Presencial', 10),

('ws22', 'Introducción a la IA Fundacional para el Análisis de Imágenes en Cirugía',
 'La IA tiene el potencial de asistir a los cirujanos proporcionándoles herramientas de análisis capaces de identificar estructuras y de modelar la anatomía del paciente a partir de imágenes. Con el desarrollo de los modelos fundacionales, hoy es posible adaptar estos modelos para atender problemas complejos y, en algunos casos, con poco o ningún reentrenamiento. Este taller introduce estos modelos fundacionales y explora sus aplicaciones en cirugía. Requerimientos: Computadora con acceso a internet.',
 70.00, '11:00 am a 3:00 pm (4 horas)', 'Roger D. Soberanis Mukul', 'Johns Hopkins University', 'Virtual', 20),

('ws23', 'Figuras Equivalentes y Equidescomponibles',
 'La Geometría tiene una gran variedad de ramificaciones y enfoques, aplicaciones en la vida cotidiana, desde lo tangible y visual, hasta lo formal y abstracto. Para un aprendiz de Matemáticas puede ser interesante y retador enfrentarse a problemas de Geometría, en cualquiera de sus ramas y aplicaciones, o tal vez pudieran mirar algunos aspectos sencillos y entretenidos de la Geometría como parte de las Matemáticas recreativas. Con relación a esto último, se presentará este taller, dirigido a estudiantes de la Facultad de Matemáticas que tengan gusto por este aspecto de la Geometría. Requerimientos: Hojas en blanco o de colores, regla y compás, tijeras.',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'María del Pilar Rosado Ocaña', 'Facultad de Matemáticas, UADY', 'Presencial', 30),

('ws24', 'Resolución de Problemas de Teoría de Números (Divisibilidad y Congruencias)',
 'Que el estudiante conozca y profundice en la teoría básica de divisibilidad y congruencias como herramientas de resolución de problemas.',
 70.00, '8:00 am a 1:00 pm y 3:00 pm a 6:00 pm (8 horas)', 'Carlos Jacob Rubio Barrios', 'Facultad de Matemáticas, UADY', 'Presencial', 30),

('ws25', 'Aplicaciones de Inteligencia Artificial a Biomedicina',
 'Este taller tiene como objetivo introducir a los participantes en el uso de la inteligencia artificial (IA) aplicada al ámbito de la biomedicina, explorando sus capacidades actuales, oportunidades y limitaciones. A través de ejemplos concretos, se presentarán distintas aplicaciones de la IA en áreas como el análisis de imágenes médicas, el procesamiento de señales biomédicas y el apoyo a la toma de decisiones clínicas. Se abordarán también aspectos fundamentales que deben considerarse al implementar soluciones basadas en IA en biología y medicina, incluyendo la calidad de los datos, sesgos en los modelos, validación clínica, interpretabilidad y consideraciones éticas y regulatorias. Requerimientos: Laptop con Python con bibliotecas de Pytorch.',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'Víctor Castañeda Zeman', 'UADY', 'Virtual', 20),

('ws26', 'Análisis y Visualización Interactiva en Python',
 'En este taller, el participante utilizará las principales librerías del ecosistema de Python para transformar datos en visualizaciones claras, dinámicas e interactivas. Aprenderá a crear gráficos profesionales con Matplotlib y Seaborn, mapas geoespaciales con Folium, dashboards interactivos con Plotly y Dash, y visualizaciones web con Bokeh. Es un taller práctico, pensado para que el participante cree visualizaciones que realmente cuenten historias y le permitan tomar decisiones informadas.',
 70.00, '10:00 am a 2:00 pm - 4:00 pm a 6:00 pm (6 horas)', 'Luis Ramiro Basto Díaz / Luis Fernando Curi Quintal', 'UADY', 'Presencial', 25),

('ws27', 'Curvatura, Simetría y Poliedros: Un Paseo por la Geometría de Euclides a Einstein',
 'En este taller exploraremos cómo la evolución de dos conceptos fundamentales en geometría, simetría y curvatura, han contribuido a lo largo de los siglos a moldear nuestras nociones de tiempo, espacio y medida. El taller no requiere conocimientos previos.',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'Didier Solís Gamboa / Waldemar Barrera Vargas', 'UADY', 'Presencial', 30),

('ws28', 'Midiendo para Transformar: Estándares y Herramientas de Sostenibilidad en Ingeniería',
 'El taller introduce conceptos clave para cuantificar la sostenibilidad en ingeniería, incluyendo análisis de ciclo de vida (ACV), huella de carbono, declaraciones ambientales de producto (EPD) y mercados de carbono. A través de ejemplos prácticos, se mostrará cómo estas herramientas permiten evaluar impactos ambientales y apoyar la toma de decisiones. Está dirigido a quienes buscan comprender, sin tecnicismos, cómo medir y gestionar el impacto de productos y sistemas.',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'Freddy Segundo Navarro Pineda', 'UADY', 'Presencial', 30),

('ws29', 'Entrenamiento de Modelos YOLO para la Detección de Objetos en Video',
 'Este taller de visión computacional con aprendizaje profundo integra desde los fundamentos teóricos de la arquitectura YOLO hasta su implementación práctica en Python utilizando Google Colab. Se aprenderá a utilizar el modelo en videos, el alcance de la arquitectura y realizar "Transfer Learning" para detectar nuevas clases personalizadas. Requerimientos: Cuenta de Google para Google Colab, Laptop (opcional).',
 70.00, '9:00 am a 1:00 pm (4 horas)', 'Yuniel Adrián Villar del Mazo / Moisés Abraham Medina Ramírez', 'UADY', 'Presencial', 16),

('ws30', 'Construyendo Agentes Conversacionales con Langflow y FastMCP',
 'En este taller se enseñará a los participantes a construir el backend de un agente conversacional utilizando Langflow y FastMCP; dicho agente podrá obtener información en tiempo real y realizar acciones utilizando herramientas MCP. Requerimientos: Tener una clave de API válida de OpenAI, un equipo de cómputo con Docker y Docker Compose instalados.',
 70.00, '2:00 pm a 6:00 pm (4 horas)', 'Carlos Rodrigo Castillo Sánchez', 'UADY', 'Presencial', 10),

('ws31', 'Uso de Notion para la Enseñanza de las Matemáticas Orientada a la Innovación Social',
 'En el contexto actual, la educación matemática requiere evolucionar hacia enfoques que integren herramientas digitales y análisis de datos para organizar su práctica, dar seguimiento individualizado a los estudiantes y tomar decisiones pedagógicas basadas en evidencia. Este taller propone el uso de la plataforma digital Notion como una herramienta para el diseño de entornos de aprendizaje organizados, basados en datos y orientados a la innovación social. A través de un enfoque práctico, los participantes desarrollarán sistemas digitales para la automatización del trabajo docente, el seguimiento del aprendizaje y la toma de decisiones informadas. Asimismo, se integrará el uso de herramientas de inteligencia artificial, como ChatGPT, para el análisis de desempeño y retroalimentación automatizada. Como producto final, los participantes diseñarán un sistema integral aplicable a su práctica docente, enfocado en mejorar el aprendizaje de las matemáticas mediante el uso estratégico de tecnología. Requerimientos: Laptop con Notion.',
 70.00, '9:00 am a 1:00 pm - 2:00 pm a 6:00 pm (8 horas)', 'Viviana Guadalupe Azcorra Novelo', 'UADY', 'Virtual', 20);

-- -------------------------------------------------------------
-- REGISTRAR ESTA MIGRACIÓN COMO APLICADA
-- -------------------------------------------------------------
INSERT IGNORE INTO `migraciones` (`archivo`) VALUES ('2026_07_14_090000_carga_talleres_oficiales.sql');
