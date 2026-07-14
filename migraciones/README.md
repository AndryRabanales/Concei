# Migraciones de la base de datos — ConCEI

Esta carpeta contiene los cambios de la base de datos organizados como
**migraciones** (estilo Laravel): un archivo SQL por conjunto de cambios,
nombrado con **fecha_hora_descripción** y aplicados en **orden ascendente**.

El objetivo es que **todos usemos la misma versión de la base** (local,
otros compañeros y producción) sin tener que adivinar qué SQL correr.

---

## Cómo se nombran

```
AAAA_MM_DD_HHMMSS_descripcion_corta.sql
```

- La **fecha y hora** al inicio hacen que se ordenen solos, de más antiguo
  a más nuevo. Se aplican de arriba hacia abajo.
- La **descripción** dice qué hace la migración (crear tabla, agregar
  columna, limpiar duplicados, etc.).

Ejemplo actual:

| Orden | Archivo | Qué hace |
|-------|---------|----------|
| 1 | `2026_02_01_000000_esquema_inicial.sql` | Crea la tabla de control `migraciones`, **todas** las tablas base, las llaves foráneas y los datos iniciales (precios, talleres de ejemplo y el super administrador). |
| 2 | `2026_07_05_120000_recuperacion_password_y_correo_admin.sql` | Crea `password_resets`, agrega `recovery_email` a `admin_users` y limpia duplicados + agrega la llave única `uq_detalle`. |

---

## Cómo aplicarlas (phpMyAdmin o consola)

Corre los archivos **en orden**, de arriba hacia abajo, importando cada uno
en phpMyAdmin (pestaña **Importar**) o desde consola:

```bash
mysql -u USUARIO -p concei_db < 2026_02_01_000000_esquema_inicial.sql
mysql -u USUARIO -p concei_db < 2026_07_05_120000_recuperacion_password_y_correo_admin.sql
```

Todas las migraciones son **seguras de reejecutar**: no borran datos, no
duplican registros y no fallan si algo ya existe (usan `IF NOT EXISTS`,
`INSERT IGNORE` y verificaciones antes de alterar).

---

## Cómo saber cuáles ya se aplicaron

Cada migración se registra a sí misma en la tabla `migraciones`. Para ver
las aplicadas en una base:

```sql
SELECT archivo, aplicada_en FROM migraciones ORDER BY archivo;
```

Si un archivo de esta carpeta **no aparece** en esa consulta, es que aún
no se ha aplicado a esa base de datos → hay que correrlo.

---

## Flujo de trabajo

- **Instalación nueva (local o servidor limpio):** corre **todas** las
  migraciones en orden. Al terminar tendrás el esquema completo y al día.
- **Base ya existente (producción):** corre **solo** las que falten. Cuando
  haya un cambio nuevo, se te dirá exactamente **qué archivo(s) aplicar** y
  esos son los únicos que necesitas correr — no tienes que revisar el
  contenido ni adivinar.
- **Cada cambio nuevo en la base** genera un **archivo nuevo** en esta
  carpeta (nunca se edita uno ya aplicado). Dentro de un mismo archivo se
  pueden agrupar varias instrucciones (crear tabla, agregar columnas,
  limpiar datos, etc.) según el cambio.

---

## Nota sobre los archivos antiguos

Los archivos `php/database.sql` y `php/migration_produccion.sql` se
conservan tal cual (método anterior). De aquí en adelante, **esta carpeta
`migraciones/` es la fuente oficial** para los cambios de base de datos.
