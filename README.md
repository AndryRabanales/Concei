# Sistema de Registro — ConCEI 2026

Aplicación web para el registro de asistentes, talleres y visitas
industriales del **3° Congreso de Ciencias Exactas e Ingenierías
(ConCEI-3)**, UADY.

## Stack

- **Backend**: PHP 8.x + PDO (MySQL/MariaDB)
- **Base de datos**: MySQL/MariaDB (`concei_db`), ver [`php/database.sql`](php/database.sql)
- **Frontend**: HTML + JavaScript + CSS (sin frameworks)
- **Correo**: Microsoft Graph API (cuenta institucional UADY)
- Pensado para correr sobre **XAMPP/LAMP** (Apache + PHP + MariaDB)

## Estructura del proyecto

```
├── index.html           Login de usuarios
├── crear-cuenta.html    Creación de cuenta de usuario
├── registro.html        Formulario de registro al congreso
├── confirmacion.html     Página de confirmación con folio
├── admin-login.html      Login del panel de administración
├── admin-dashboard.html   Panel de administración
├── css/, js/, images/    Recursos estáticos
├── uploads/              Archivos subidos por los usuarios (no versionado)
└── php/
    ├── config.php        Conexión a la base de datos
    ├── mailer.php          Envío de correos vía Microsoft Graph
    ├── api.php             API principal (todas las acciones del sistema)
    ├── register.php        Procesa el envío del formulario de registro
    ├── reserve_spots.php   Reserva temporal de cupos de talleres/visitas
    └── database.sql        Script de creación de la base de datos
```

## Documentación

- [Manual de Instalación](docs/MANUAL_INSTALACION.md) — requisitos, despliegue,
  configuración de base de datos y correo, checklist de producción.
- [Manual de Uso](docs/MANUAL_USO.md) — flujo de registro de asistentes y
  operación del panel de administración.
