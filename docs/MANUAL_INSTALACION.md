# Manual de Instalación — Sistema de Registro ConCEI 2026

Este manual está dirigido al personal de TI/CGTIC que va a desplegar el
sistema en un servidor nuevo. Describe los requisitos, los pasos de
instalación y la configuración mínima que **debe** completarse antes de
poner el sitio en producción.

El sistema es una aplicación PHP + MySQL/MariaDB con frontend en
HTML/JS, pensada para correr sobre un stack tipo XAMPP/LAMP (Apache +
PHP + MariaDB).

---

## 1. Requisitos previos

- **PHP 8.x** con las extensiones: `pdo_mysql`, `curl`, `mbstring`, `fileinfo`,
  `json` (todas vienen activas por defecto en XAMPP).
- **MySQL / MariaDB** (probado con MariaDB 10.4).
- **Apache** (o cualquier servidor web que sirva PHP) con `mod_rewrite` no es
  estrictamente necesario, no se usan rutas amigables.
- Acceso al panel de Azure AD / Microsoft 365 de la institución (CGTIC UADY)
  para configurar el envío de correos vía Microsoft Graph API.
- (Opcional) Composer, si se desea actualizar dependencias de
  `vendor/` (PHPMailer está listado en `composer.json` pero el envío de
  correo actual usa Microsoft Graph directamente vía cURL, no PHPMailer).

---

## 2. Estructura del proyecto

```
/                       Raíz del sitio (carpeta htdocs)
├── index.html          Login de usuarios
├── crear-cuenta.html   Creación de cuenta de usuario
├── registro.html       Formulario de registro al congreso
├── confirmacion.html   Página de confirmación con folio
├── admin-login.html    Login del panel de administración
├── admin-dashboard.html Panel de administración
├── css/, js/, images/  Recursos estáticos
├── uploads/            Archivos subidos por los usuarios (comprobantes, etc.)
└── php/
    ├── config.php      Conexión a la base de datos (EDITAR)
    ├── mailer.php       Envío de correos vía Microsoft Graph (EDITAR)
    ├── api.php          API principal (todas las acciones del sistema)
    ├── register.php     Procesa el envío del formulario de registro
    ├── reserve_spots.php Reserva temporal de cupos de talleres/visitas
    └── database.sql     Script de creación de la base de datos
```

---

## 3. Pasos de instalación

### 3.1 Copiar el proyecto al servidor

Copiar/clonar todo el contenido del repositorio dentro de la carpeta que
sirve Apache (por ejemplo `C:\xampp\htdocs\` en Windows o
`/var/www/html/` en Linux).

### 3.2 Crear la base de datos

El archivo [`php/database.sql`](../php/database.sql) es la fuente única de
verdad del esquema. Crea la base de datos `concei_db` con sus 18 tablas,
incluyendo datos iniciales (precios, talleres de ejemplo y una cuenta de
administrador por defecto).

> ⚠️ **IMPORTANTE**: `database.sql` incluye instrucciones `DROP TABLE IF
> EXISTS` al principio. Está pensado para una **instalación nueva sobre una
> base de datos vacía**. NO lo ejecutes contra una base de datos que ya
> tenga inscripciones reales, o se perderán.

Para una instalación nueva:

```bash
mysql -u root -p < php/database.sql
```

Esto crea automáticamente la base `concei_db` (vía `CREATE DATABASE IF
NOT EXISTS`) y todas sus tablas.

### 3.3 Configurar la conexión a la base de datos

Editar [`php/config.php`](../php/config.php) con las credenciales reales del
servidor de base de datos:

```php
$host = 'localhost';       // host de MySQL/MariaDB
$dbname = 'concei_db';      // nombre de la base de datos
$username = 'root';         // usuario de MySQL
$password = '';              // contraseña del usuario
```

Por defecto (entorno de desarrollo XAMPP) usa el usuario `root` sin
contraseña. **En producción se debe crear un usuario de MySQL dedicado con
permisos limitados** (SELECT/INSERT/UPDATE/DELETE solo sobre `concei_db`)
y una contraseña fuerte, y reflejar esos valores aquí.

### 3.4 Configurar el envío de correos (Microsoft Graph)

El sistema envía correos de confirmación a través de la **Microsoft Graph
API**, usando una cuenta institucional de UADY. Editar
[`php/mailer.php`](../php/mailer.php) y reemplazar los siguientes valores
(actualmente son placeholders `XXXXXXXX...`):

```php
$tenant_id     = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"; // ID de tenant de Azure AD
$client_id     = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"; // ID de la aplicación registrada
$client_secret = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";  // Secreto de la aplicación
$MailFrom      = "remitente@correo.uady.mx";              // Cuenta de correo emisora
```

Para obtener estos valores, la CGTIC debe:

1. Registrar una **aplicación en Azure AD** (App Registration).
2. Generar un **client secret** para esa aplicación.
3. Otorgarle el **permiso de aplicación `Mail.Send`** (tipo *Application*,
   no *Delegated*) sobre Microsoft Graph, con consentimiento de
   administrador.
4. Indicar la **cuenta de correo institucional** que se usará como
   remitente (`$MailFrom`) — esa cuenta debe existir y tener licencia de
   buzón en el tenant.

Mientras estos valores sigan siendo placeholders, el envío de correos
fallará silenciosamente (queda registrado en el log de errores de PHP), pero
**no bloquea el registro del usuario** — el folio y los datos siguen
guardándose correctamente en la base de datos.

### 3.5 Permisos de la carpeta `uploads/`

Los comprobantes de pago, identificaciones y constancias fiscales que suben
los usuarios se guardan en `uploads/`. Verificar que esta carpeta:

- Existe en la raíz del proyecto.
- Tiene permisos de escritura para el usuario con el que corre Apache/PHP
  (en Linux: `chown`/`chmod` apropiados para `www-data`; en XAMPP/Windows
  normalmente no requiere cambios).
- **No se sube al repositorio de Git** (ya está en `.gitignore`) — contiene
  documentos personales de los asistentes.
- Tiene un respaldo periódico configurado, ya que es la única copia de los
  comprobantes/documentos subidos.

### 3.6 Primer acceso al panel de administración y cambio de contraseña

`database.sql` crea una cuenta de **superadministrador** por defecto:

| Usuario              | Contraseña       |
|----------------------|------------------|
| `admin@dranabel.com` | `ConCEI2026Admin!` |

**Pasos obligatorios tras la instalación:**

1. Ir a `admin-login.html` e iniciar sesión con las credenciales anteriores.
2. Ir a la sección **Administradores** del panel.
3. Editar la cuenta `admin@dranabel.com` y asignarle una **contraseña
   nueva y segura** (o crear una nueva cuenta de superadmin con los datos
   reales del responsable y eliminar/deshabilitar la cuenta por defecto).

> Si por alguna razón la tabla `admin_users` quedara completamente vacía, el
> panel detecta automáticamente que no existe ningún administrador y entra
> en **"Modo Configuración"**: en `admin-login.html` basta con dar clic en
> "Ingresar al Panel" (sin password) para crear el primer
> superadministrador desde la sección Administradores.

### 3.7 Datos propios del evento a revisar

Antes de abrir el registro al público, revisar/ajustar estos datos
específicos de la edición del congreso (ya vienen precargados con valores
de ejemplo de ConCEI 2026, pero deben confirmarse o actualizarse cada año):

- **Precios de inscripción** (`cat_ajustes`: `general`, `student_external`,
  `student_uady`) — editables desde el panel de administración
  (Configuración) o directamente en la base de datos.
- **Catálogo de talleres y visitas industriales** (`cat_talleres`,
  `cat_visitas`) — gestionable desde el panel ("Talleres" / "Visitas
  Industriales": nombre, precio, cupo, horario, instructor, modalidad,
  activo/inactivo).
- **Datos bancarios para transferencias**, definidos en
  [`registro.html`](../registro.html) (banco, beneficiario, número de
  cuenta y CLABE). Si cambian para una nueva edición del congreso, deben
  editarse directamente en ese archivo.
- **Banner e imágenes** del congreso (`images/banner.jpg`, etc.).

### 3.8 HTTPS

El sistema maneja contraseñas, tokens de sesión y documentos personales —
**debe servirse exclusivamente sobre HTTPS** en producción. Configurar un
certificado TLS (por ejemplo Let's Encrypt) en Apache y forzar la
redirección de HTTP a HTTPS.

---

## 4. Checklist de verificación post-instalación

- [ ] La base de datos `concei_db` existe y tiene las 18 tablas (verificar
      con `SHOW TABLES;`).
- [ ] `php/config.php` apunta a las credenciales reales de producción (no
      `root` sin contraseña).
- [ ] `php/mailer.php` tiene `tenant_id`, `client_id`, `client_secret` y
      `$MailFrom` reales (no placeholders `XXXXXXXX...`).
- [ ] Se puede crear una cuenta de usuario desde `crear-cuenta.html` e
      iniciar sesión desde `index.html`.
- [ ] Se puede completar un registro de prueba en `registro.html` y se
      genera un folio en `confirmacion.html`.
- [ ] Llega el correo de confirmación al correo de prueba (verifica la
      configuración de Microsoft Graph).
- [ ] Se puede iniciar sesión en `admin-login.html` con la cuenta de
      administrador y la **contraseña por defecto ya fue cambiada**.
- [ ] La carpeta `uploads/` recibe los archivos subidos correctamente y
      tiene respaldo configurado.
- [ ] El sitio solo es accesible vía **HTTPS**.

---

## 5. Mantenimiento y seguridad

- **Sesiones de administrador**: cada login genera un token guardado en la
  tabla `admin_sessions`, con un timeout de inactividad de 30 minutos
  (constante `ADMIN_SESSION_TIMEOUT_MINUTES` en `php/api.php`). No requiere
  mantenimiento manual; los tokens vencidos se limpian automáticamente al
  usarse.
- **Límite de intentos de inicio de sesión** (`login_attempts`): bloquea
  temporalmente (HTTP 429) tras intentos fallidos repetidos de login (5 en
  15 min para admin y usuarios) o de registro (10 en 60 min). Esta tabla
  crece con el tiempo; puede limpiarse periódicamente sin afectar el
  funcionamiento (`DELETE FROM login_attempts WHERE attempted_at < NOW() -
  INTERVAL 1 DAY`).
- **Reservas temporales de cupos** (`reg_reservas_temp`): se limpian
  automáticamente (registros de más de 30 minutos) cada vez que se calcula
  la disponibilidad de un taller/visita. No requiere mantenimiento manual.
- **Respaldos**: respaldar regularmente tanto la base de datos
  (`mysqldump concei_db`) como la carpeta `uploads/` — juntas son el
  estado completo del sistema.

---

## 6. Problemas comunes

**Las sesiones de administrador expiran inmediatamente / "Sesión expirada"
nada más iniciar sesión.**
Verificar que el servidor MySQL/MariaDB y el servidor PHP estén configurados
con la misma zona horaria (o que el chequeo de expiración se haga en SQL con
`NOW() - INTERVAL ... MINUTE`, que es como ya está implementado). Si se
modificó esa lógica, revisar que no se mezclen `time()`/`strtotime()` de PHP
con timestamps de MySQL.

**No llegan los correos de confirmación.**
Revisar el log de errores de PHP — `mailer.php` registra el motivo exacto
(token de Microsoft Graph no obtenido, permisos insuficientes, código HTTP
de error de Graph, etc.). Generalmente significa que `tenant_id`,
`client_id`, `client_secret` o `$MailFrom` no están configurados
correctamente, o que falta el permiso de aplicación `Mail.Send` con
consentimiento de administrador.

**"Base table or view not found" en el panel o el formulario.**
La base de datos no coincide con `php/database.sql`. Reimportar el script
en una base de datos limpia (recordando que `database.sql` borra tablas
existentes — no ejecutarlo sobre una base con datos reales).

**Error al subir archivos (comprobantes, identificaciones, etc.).**
Verificar permisos de escritura en `uploads/` y el límite de tamaño de
subida de PHP (`upload_max_filesize` / `post_max_size` en `php.ini`).
