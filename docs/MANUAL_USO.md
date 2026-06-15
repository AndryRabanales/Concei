# Manual de Uso — Sistema de Registro ConCEI 2026

Este manual explica cómo usar la aplicación, tanto desde el punto de vista
de un **participante/asistente** que se registra al congreso, como desde el
**panel de administración**.

---

## Parte A — Participantes

### 1. Crear una cuenta

1. Abrir `index.html` (página de inicio de sesión).
2. Dar clic en **"¡Crea tu Cuenta y Regístrate Aquí!"**, lo que lleva a
   `crear-cuenta.html`.
3. Llenar:
   - **Email** (será el usuario para iniciar sesión).
   - **Teléfono** (opcional).
   - **Contraseña** y **Repetir contraseña**.
4. Dar clic en **"Guardar y Continuar"**. Si todo es correcto, se crea la
   cuenta y se pasa directamente al formulario de registro al congreso.

### 2. Iniciar sesión

Si ya tienes cuenta, desde `index.html` ingresa tu **correo** y
**contraseña** y da clic en **"Ingresar"**. Esto te lleva al formulario de
registro (`registro.html`).

### 3. Llenar el formulario de registro (`registro.html`)

El formulario está dividido en secciones:

#### 3.1 Información Personal
Nombre(s), Apellido(s), Institución/Compañía, Ciudad, Estado (opcional) y
País.

#### 3.2 Tipo de Registro
Selecciona tu categoría:

- **General** — cuota completa.
- **Estudiante** (externo) — cuota reducida.
- **Estudiante/Profesor UADY** — sin costo. Al elegir esta opción o
  "Estudiante", se solicita **subir una credencial o comprobante** que
  valide tu condición.
- **Registro por Código** — si la organización te proporcionó un código de
  acceso especial, ingrésalo y da clic en **"Verificar"**. Si el código es
  válido y no ha sido usado, tu registro queda exento de costo de
  inscripción.

Todas las categorías incluyen: acceso a conferencias y sesiones técnicas,
kit de bienvenida, constancia de participación y coffee breaks.

#### 3.3 Registro de Trabajos (solo para autores)
Si vas a presentar un artículo o póster:

1. Da clic en **"Agregar Contribución"** (hasta 2 contribuciones).
2. Para cada una, indica tipo (artículo/póster), área temática, modalidad y
   título.
3. Si tu trabajo pudiera publicarse en un número especial de revista, marca
   tu **revista de preferencia** (IEEE Latin America Transactions —
   requiere pago adicional de USD $250 si es aceptado—, Ingeniería Revista
   Académica, Abstraction & Application, o "Ninguna").

> Nota: para estudiantes/profesores UADY, la modalidad de participación de
> las contribuciones es obligatoriamente presencial.

#### 3.4 Talleres
Selecciona los talleres a los que deseas asistir (todos se imparten el 6 de
octubre). Cada taller muestra su cupo disponible en tiempo real — si se
llena, dejará de poder seleccionarse. Revisa si tu tipo de registro incluye
algún taller sin costo extra.

#### 3.5 Visitas Industriales
Igual que los talleres, selecciona las visitas industriales de tu interés
(cupo limitado). Las empresas anfitrionas pueden modificar o cancelar
fechas.

#### 3.6 Comprobante Fiscal (Factura)
Si necesitas factura, marca **"Requerida"** y completa: RFC, Razón Social,
Dirección Fiscal, Código Postal, Ciudad, Estado y Correo para factura, y
sube tu **Constancia de Situación Fiscal** (PDF o imagen).

> **El ConCEI no emite facturas a nombre de la Universidad Autónoma de
> Yucatán.**

#### 3.7 Política de Cancelación
Las cuotas de inscripción, talleres y visitas industriales **no son
reembolsables** bajo ninguna circunstancia. Léela antes de continuar.

#### 3.8 Pago
- El **total a pagar** se calcula automáticamente según tu tipo de registro,
  talleres y visitas seleccionados.
- Si tu registro tiene costo, se muestran los **datos bancarios** (banco,
  beneficiario, número de cuenta y CLABE) y un **concepto de pago generado
  automáticamente** — usa exactamente ese concepto al hacer tu transferencia
  o depósito para que se pueda validar tu pago.
- Sube tu **Comprobante de Pago** (de preferencia el comprobante SPEI de
  Banxico) en formato PDF o imagen.
- Si tu registro es **gratuito** (por ejemplo, estudiante/profesor UADY o
  código de acceso válido), no se solicita comprobante de pago — solo debes
  finalizar el registro.
- Da clic en **"Completar Registro y Pagar"**.

### 4. Confirmación

Al completar el registro, se muestra `confirmacion.html` con:

- Tu **folio** (identificador único de tu inscripción, formato
  `CONCEI-2026-XXXX`).
- Tus datos (nombre, correo, fecha).
- Un resumen de los conceptos pagados y el total.

Además, recibirás un **correo de confirmación** con esta información (si la
configuración de correo del servidor está activa).

### 5. Seguimiento y re-subida de documentos

Si vuelves a iniciar sesión, el sistema muestra el **estado de revisión** de
tus documentos subidos (comprobante de pago, identificación/credencial,
constancia fiscal):

- **Pendiente** — aún no ha sido revisado por el equipo organizador.
- **Aceptado** — el documento fue validado.
- **Rechazado** — el documento no fue válido; se muestra el motivo indicado
  por el administrador y se habilita un campo para **volver a subir** el
  documento corregido.

Puedes editar tu registro (cambiar talleres, visitas, etc.) volviendo a
`registro.html` mientras tu inscripción no haya sido finalizada por un
administrador.

---

## Parte B — Panel de Administración

URL: `admin-login.html`

### 1. Iniciar sesión

Ingresa tu **correo** y **contraseña** de administrador y da clic en
**"Ingresar al Panel"**.

- Si **no existe ningún administrador** registrado todavía, el sistema
  muestra el aviso *"Modo Configuración Activo"*: basta con dar clic en
  **"Ingresar al Panel"** sin llenar nada para acceder directamente a la
  sección **Administradores** y crear el primer **Superadministrador**.
- Tras 5 intentos fallidos en 15 minutos, el acceso se bloquea
  temporalmente por seguridad.
- La sesión expira automáticamente tras **30 minutos de inactividad**; al
  expirar, se regresa a la pantalla de login.

### 2. Secciones del panel (menú lateral)

| Sección | Para qué sirve |
|---|---|
| **Usuarios Registrados** | Lista de todas las inscripciones, búsqueda, detalle de cada participante, revisión de documentos y estado de pago, exportar a CSV. |
| **Talleres** | Catálogo de talleres: crear, editar, activar/desactivar y ver cupos. |
| **Visitas Industriales** | Catálogo de visitas industriales: igual que talleres. |
| **Códigos de Registro** | Generar y administrar códigos de acceso especiales (registro gratuito sin pago). |
| **Administradores** | (solo Superadministrador) Crear, editar y eliminar cuentas de administrador. |

### 3. Usuarios Registrados

- La tabla muestra folio, nombre, correo, tipo de registro, estatus de pago
  y fecha.
- Usa la **barra de búsqueda** para filtrar por nombre, correo o folio.
- Da clic en un registro para abrir el **detalle del usuario**, donde puedes
  ver toda la información capturada (datos personales, contribuciones,
  talleres/visitas, facturación) y los **documentos subidos**.
- **Revisión de documentos**: desde el detalle del usuario, abre el revisor
  de documentos para cada archivo subido (comprobante de pago,
  identificación, constancia fiscal). Puedes:
  - Ver el archivo.
  - Marcarlo como **Aceptado** o **Rechazado** (con un comentario indicando
    el motivo, que el usuario verá al volver a iniciar sesión).
  - Consultar el **historial completo** de revisiones y re-subidas de cada
    documento.
- **Actualizar estatus de la inscripción**: cambia el estatus general del
  registro (por ejemplo, de "pendiente" a "confirmado") con el botón
  correspondiente ("Finalizar Revisión" / actualizar estatus).
- **Eliminar un registro**: usa el botón de eliminar (con confirmación) para
  borrar por completo una inscripción y sus datos asociados.
- **Exportar a CSV**: el botón de descarga genera un archivo CSV con todas
  las inscripciones, útil para reportes o listas de asistencia.

### 4. Talleres / Visitas Industriales

- **Agregar Taller/Visita**: abre el modal "Agregar Taller" (o equivalente
  para visitas) para definir nombre, descripción, precio, horario,
  instructor, dependencia, modalidad y cupo máximo.
- **Editar**: da clic sobre un elemento existente para modificar sus datos.
- **Activar/Desactivar**: usa el interruptor de "activo" para ocultar
  temporalmente un taller/visita del formulario de registro sin borrarlo
  (por ejemplo, si se cancela).
- **Cupo actual**: se calcula y actualiza automáticamente según las
  inscripciones confirmadas y las reservas temporales en curso; no se edita
  manualmente.

### 5. Códigos de Registro

- Sección para generar **códigos de acceso** que los participantes pueden
  usar en la opción "Registro por Código" del formulario, para obtener
  inscripción sin costo.
- **Generador de Códigos en Bloque**: permite crear varios códigos a la vez
  (por ejemplo, con un prefijo común como `UADY-`).
- Cada código solo puede usarse **una vez**: al ser utilizado por un
  participante, queda marcado como "usado" y no puede reutilizarse.

### 6. Administradores (solo Superadministrador)

- Lista de cuentas de administrador con su rol (`superadmin` o `admin`).
- **Crear Administrador**: define correo (usuario) y contraseña para una
  nueva cuenta.
- **Editar Administrador**: cambia la contraseña o el rol de una cuenta
  existente.
- **Eliminar Administrador**: elimina una cuenta (con confirmación).

> Se recomienda que cada miembro del equipo organizador tenga su propia
> cuenta de administrador (en vez de compartir una sola), y que la cuenta
> por defecto `admin@dranabel.com` tenga la contraseña cambiada o sea
> eliminada una vez creadas las cuentas reales.

### 7. Cerrar sesión

Usa el botón de cerrar sesión del panel para invalidar tu token de acceso de
inmediato (recomendado al terminar de usar una computadora compartida). De
lo contrario, la sesión se cierra automáticamente tras 30 minutos de
inactividad.
