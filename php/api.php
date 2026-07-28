<?php
header('Content-Type: application/json');
require_once 'config.php';

error_reporting(E_ALL);
ini_set('display_errors', 0);

// Recalcula el estatus general de un registro a partir de TODOS los documentos
// subidos por el correo (no solo el más reciente por tipo):
// - 'denegado'           si AL MENOS 1 documento está rechazado
// - 'aceptado'           si y solo si TODOS los documentos están aceptados
// - 'revision_pendiente' si hay documentos pero aún falta resolver alguno
// - 'pendiente'          si aún no se ha subido ningún documento
function recalcEstatusDocumentos($pdo, $correo) {
    // Si el administrador fijó un estatus MANUALMENTE (update_reg_status),
    // el recálculo automático no debe pisarlo. El flag se resetea cuando el
    // usuario sube un documento nuevo o el admin revisa un documento.
    $stmtCur = $pdo->prepare("SELECT folio, estatus, estatus_manual FROM reg_inscripciones WHERE correo = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
    $stmtCur->execute([$correo]);
    $cur = $stmtCur->fetch();
    if ($cur && (int)$cur['estatus_manual'] === 1) {
        return $cur['estatus'];
    }

    // Se evalúa la versión MÁS RECIENTE de cada "hilo" de documento:
    // - Documentos con correcciones vinculadas (reemplaza_id): cada cadena
    //   original+correcciones cuenta por separado (cada pago es independiente,
    //   un pago rechazado no queda tapado por el comprobante de otro pago).
    // - Documentos sueltos (sin vínculo, incluye datos anteriores a este cambio):
    //   solo cuenta el más reciente de cada tipo, como antes.
    $stmtAll = $pdo->prepare("SELECT id, tipo_doc, estado, reemplaza_id FROM reg_documentos WHERE correo = ? ORDER BY fecha_subida ASC, id ASC");
    $stmtAll->execute([$correo]);
    $docs = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

    $linkedRoots = [];
    foreach ($docs as $d) {
        if (!empty($d['reemplaza_id'])) $linkedRoots[(int)$d['reemplaza_id']] = true;
    }

    $estados = [];
    $chainLatest = [];   // raíz => estado de la versión más nueva de la cadena
    $looseLatest = [];   // tipo  => estado del doc suelto más nuevo
    foreach ($docs as $d) {
        $id = (int)$d['id'];
        $root = !empty($d['reemplaza_id']) ? (int)$d['reemplaza_id'] : $id;
        $enCadena = !empty($d['reemplaza_id']) || isset($linkedRoots[$id]);
        if ($enCadena) {
            $chainLatest[$root] = $d['estado']; // orden ASC: la última asignación es la más nueva
        } else {
            $looseLatest[$d['tipo_doc']] = $d['estado'];
        }
    }
    $estados = array_merge(array_values($chainLatest), array_values($looseLatest));

    $hasDocs = count($estados) > 0;
    $allAccepted = $hasDocs;
    $anyRejected = false;
    foreach ($estados as $estado) {
        if ($estado === 'rechazado') { $anyRejected = true; $allAccepted = false; }
        elseif ($estado !== 'aceptado') { $allAccepted = false; }
    }

    if ($anyRejected) $newStatus = 'denegado';
    elseif ($hasDocs && $allAccepted) $newStatus = 'aceptado';
    elseif ($hasDocs) $newStatus = 'revision_pendiente';
    else $newStatus = 'pendiente';

    if ($cur && $cur['folio']) {
        $pdo->prepare("UPDATE reg_inscripciones SET estatus = ? WHERE folio = ?")->execute([$newStatus, $cur['folio']]);
    }

    return $newStatus;
}

// Vuelve el estatus del registro al modo automático (quita el candado manual).
// Se llama cuando hay nueva evidencia: subida de documento o revisión del admin.
function resetEstatusManual($pdo, $correo) {
    $pdo->prepare("UPDATE reg_inscripciones SET estatus_manual = 0 WHERE correo = ?")->execute([$correo]);
}

// --- Seguridad: límite de intentos y sesiones de administrador ---
const ADMIN_SESSION_TIMEOUT_MINUTES = 30;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MINUTES = 15;

function getClientIp() {
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// Verifica si un identificador (ip+correo) excedió el número de intentos
// fallidos permitidos en la ventana de tiempo indicada.
function isRateLimited($pdo, $identifier, $maxAttempts = LOGIN_MAX_ATTEMPTS, $windowMinutes = LOGIN_WINDOW_MINUTES) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE identifier = ? AND attempted_at > NOW() - INTERVAL ? MINUTE");
    $stmt->execute([$identifier, $windowMinutes]);
    return $stmt->fetchColumn() >= $maxAttempts;
}

function recordFailedAttempt($pdo, $identifier) {
    $pdo->prepare("INSERT INTO login_attempts (identifier, attempted_at) VALUES (?, NOW())")->execute([$identifier]);
}

function clearFailedAttempts($pdo, $identifier) {
    $pdo->prepare("DELETE FROM login_attempts WHERE identifier = ?")->execute([$identifier]);
}

// Verifica que la petición incluya un token de sesión de admin válido y no
// expirado (cabecera X-Admin-Token). Si no es válido, responde 401 y termina.
function requireAdmin($pdo) {
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sesión no válida', 'session_expired' => true]);
        exit;
    }
    // La comparación de expiración se hace en SQL (NOW() - INTERVAL ...) para
    // evitar discrepancias si PHP y MySQL tienen zonas horarias distintas.
    $stmt = $pdo->prepare("SELECT s.admin_id, a.username, a.rol, (s.last_activity > NOW() - INTERVAL ? MINUTE) AS vigente FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id WHERE s.token = ?");
    $stmt->execute([ADMIN_SESSION_TIMEOUT_MINUTES, $token]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session || !$session['vigente']) {
        if ($session) $pdo->prepare("DELETE FROM admin_sessions WHERE token = ?")->execute([$token]);
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sesión expirada', 'session_expired' => true]);
        exit;
    }

    $pdo->prepare("UPDATE admin_sessions SET last_activity = NOW() WHERE token = ?")->execute([$token]);
    return $session;
}

function hasAnyAdmin($pdo) {
    return (int)$pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn() > 0;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_initial_data':
        try {
            // Limpiar reservas antiguas antes de cargar
            $pdo->prepare("DELETE FROM reg_reservas_temp WHERE updated_at < NOW() - INTERVAL 30 MINUTE")->execute();

            // Traducimos los nombres de las columnas para que el JS los entienda siempre.
            // Orden numérico por id (ws1, ws2, ... ws31) para que T01..T31 salgan en orden.
            $workshops = $pdo->query("SELECT id, nombre as name, descripcion as description, precio as price, horario as hours, instructor, dependencia as dependency, modalidad as modality, cupo as capacity, cupo_actual, activo FROM cat_talleres ORDER BY CAST(REGEXP_REPLACE(id, '[^0-9]', '') AS UNSIGNED), id")->fetchAll(PDO::FETCH_ASSOC);
            $visits = $pdo->query("SELECT id, nombre as name, descripcion as description, precio as price, horario as hours, instructor, dependencia as dependency, modalidad as modality, cupo as capacity, cupo_actual, activo FROM cat_visitas ORDER BY CAST(REGEXP_REPLACE(id, '[^0-9]', '') AS UNSIGNED), id")->fetchAll(PDO::FETCH_ASSOC);
            $settings = $pdo->query("SELECT * FROM cat_ajustes")->fetchAll(PDO::FETCH_ASSOC);
            // Público: NO exponer usado_por/fecha_uso (datos sensibles de rastreo).
            $codes = $pdo->query("SELECT id, usado, fecha FROM cat_codigos")->fetchAll(PDO::FETCH_ASSOC);

            $prices = [];
            foreach ($settings as $s) {
                $prices[$s['clave']] = $s['valor'];
            }

            $email = $_GET['email'] ?? '';
            $purchased = [];
            $userInfo = null;
            $accountId = null;

            if ($email) {
                // Get user account ID from ini_usuarios
                $stmtAcc = $pdo->prepare("SELECT id FROM ini_usuarios WHERE correo = ?");
                $stmtAcc->execute([$email]);
                $accountId = $stmtAcc->fetchColumn();

                // Get purchased items
                $stmtP = $pdo->prepare("
                    SELECT d.item_id 
                    FROM reg_evento_detalles d 
                    JOIN reg_inscripciones i ON d.folio = i.folio 
                    WHERE i.correo = ?
                ");
                $stmtP->execute([$email]);
                $purchased = $stmtP->fetchAll(PDO::FETCH_COLUMN);

                // Ítems que el usuario tiene en su RESERVA TEMPORAL propia (aún sin
                // pagar). Sirve para que, al volver, sus propias selecciones se vean
                // como "seleccionadas" y NO como "agotadas" por su propio apartado.
                $stmtR = $pdo->prepare("SELECT items_json FROM reg_reservas_temp WHERE correo = ?");
                $stmtR->execute([$email]);
                $reservaJson = $stmtR->fetchColumn();
                $reserved = [];
                if ($reservaJson) {
                    $dec = json_decode($reservaJson, true);
                    if (is_array($dec)) {
                        foreach (['workshops', 'visits'] as $k) {
                            if (!empty($dec[$k]) && is_array($dec[$k])) {
                                foreach ($dec[$k] as $rid) $reserved[] = (string)$rid;
                            }
                        }
                    }
                }

                // Get personal info (including e.concepto to preserve original concept format if needed)
                $stmtU = $pdo->prepare("
                    SELECT p.*, e.tipo as regType, e.concepto
                    FROM reg_personal p
                    JOIN reg_inscripciones i ON p.folio = i.folio
                    JOIN reg_evento e ON i.folio = e.folio
                    WHERE i.correo = ?
                ");
                $stmtU->execute([$email]);
                $userInfo = $stmtU->fetch(PDO::FETCH_ASSOC);

                // Contribuciones del usuario registradas
                $stmtContribs = $pdo->prepare("
                    SELECT c.titulo, c.tipo, c.area, c.modalidad, c.revista
                    FROM reg_contribuciones c
                    JOIN reg_inscripciones i ON c.folio = i.folio
                    WHERE i.correo = ?
                ");
                $stmtContribs->execute([$email]);
                $userContributions = $stmtContribs->fetchAll(PDO::FETCH_ASSOC);
            }

            echo json_encode([
                'success' => true,
                'workshop' => $workshops,
                'visit' => $visits,
                'prices' => $prices,
                'code' => $codes,
                'purchased' => $purchased,
                'reserved' => $reserved,
                'userInfo' => $userInfo,
                'contributions' => $userContributions ?? [],
                'accountId' => $accountId
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'check_capacity':
        $id = $_GET['id'] ?? '';
        $type = $_GET['type'] ?? 'workshop';
        $regType = $_GET['regType'] ?? 'general';
        $table = ($type === 'workshop') ? 'cat_talleres' : 'cat_visitas';
        
        try {
            // Sincronizar antes de informar
            syncCapacity($pdo, $id, $type);

            $stmt = $pdo->prepare("SELECT nombre, cupo, cupo_actual FROM $table WHERE id = ?");
            $stmt->execute([$id]);
            $item = $stmt->fetch();
            if ($item) {
                $limit = (int)$item['cupo'];
                if ($type === 'workshop' && $regType === 'general') {
                    $limit += 2;
                }
                $isFull = (int)$item['cupo_actual'] >= $limit;
                echo json_encode([
                    'success' => true, 
                    'isFull' => $isFull, 
                    'current' => $item['cupo_actual'], 
                    'max' => $item['cupo'],
                    'name' => $item['nombre']
                ]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Elemento no encontrado']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_full_registrations':
        requireAdmin($pdo);
        try {
            $query = "
                SELECT
                    r.folio,
                    r.correo          AS email,
                    r.estatus         AS status,
                    r.fecha_inscripcion AS date_registered,
                    p.nombre, p.apellido, p.institucion, p.ciudad, p.estado, p.pais,
                    u.telefono,
                    e.tipo            AS regType,
                    e.total,
                    e.concepto        AS concept,
                    f.rfc, f.razon AS razon_social, f.direccion AS domicilio_fiscal,
                    f.cp, f.ciudad AS ciudad_fiscal, f.estado AS estado_fiscal, f.correo AS correo_facturacion,
                    (SELECT GROUP_CONCAT(archivo ORDER BY fecha_subida SEPARATOR ' | ') FROM reg_documentos WHERE correo = r.correo AND tipo_doc = 'comprobante') AS comprobante,
                    (SELECT GROUP_CONCAT(archivo ORDER BY fecha_subida SEPARATOR ' | ') FROM reg_documentos WHERE correo = r.correo AND tipo_doc = 'identificacion') AS identificacion,
                    (SELECT GROUP_CONCAT(archivo ORDER BY fecha_subida SEPARATOR ' | ') FROM reg_documentos WHERE correo = r.correo AND tipo_doc = 'constancia') AS constancia,
                    GROUP_CONCAT(DISTINCT
                        CONCAT_WS(' (', t.nombre, CONCAT(t.horario, ' $', t.precio, ')'))
                        ORDER BY t.nombre SEPARATOR ' | '
                    ) AS talleres,
                    GROUP_CONCAT(DISTINCT
                        CONCAT_WS(' (', v.nombre, CONCAT(v.horario, ' $', v.precio, ')'))
                        ORDER BY v.nombre SEPARATOR ' | '
                    ) AS visitas,
                    -- Monto total ACUMULADO: suma de todos los pagos generados
                    -- (reg_conceptos_historial es append-only y sobrevive a las
                    -- sobreescrituras de folio). Se limpia '$' y ',' antes de sumar.
                    (SELECT SUM(CAST(REPLACE(REPLACE(h.total, '$', ''), ',', '') AS DECIMAL(10,2)))
                       FROM reg_conceptos_historial h WHERE h.correo = r.correo) AS total_acumulado
                FROM reg_inscripciones r
                LEFT JOIN reg_personal p        ON r.folio = p.folio
                LEFT JOIN ini_usuarios u         ON r.correo = u.correo
                LEFT JOIN reg_evento e           ON r.folio = e.folio
                LEFT JOIN reg_facturacion f      ON r.folio = f.folio
                LEFT JOIN reg_evento_detalles dt ON r.folio = dt.folio AND dt.tipo_item = 'taller'
                LEFT JOIN cat_talleres t         ON dt.item_id = t.id
                LEFT JOIN reg_evento_detalles dv ON r.folio = dv.folio AND dv.tipo_item = 'visita'
                LEFT JOIN cat_visitas v          ON dv.item_id = v.id
                GROUP BY r.folio
                ORDER BY CAST(e.concepto AS UNSIGNED) ASC, r.fecha_inscripcion DESC
            ";
            $rows = $pdo->query($query)->fetchAll(PDO::FETCH_ASSOC);

            // Contribuciones por folio (máx. 2), en columnas separadas para el CSV.
            // Se hace en consulta aparte para no inflar los GROUP_CONCAT anteriores
            // por producto cartesiano y para partir cada campo limpiamente.
            $contribStmt = $pdo->query("SELECT folio, titulo, tipo, area, modalidad, revista FROM reg_contribuciones ORDER BY folio, id");
            $contribByFolio = [];
            foreach ($contribStmt as $c) {
                $contribByFolio[$c['folio']][] = $c;
            }
            foreach ($rows as &$row) {
                $cs = $contribByFolio[$row['folio']] ?? [];
                for ($i = 0; $i < 2; $i++) {
                    $c = $cs[$i] ?? null;
                    $n = $i + 1;
                    $row["contrib_titulo$n"]    = $c['titulo']    ?? '';
                    $row["contrib_tipo$n"]      = $c['tipo']      ?? '';
                    $row["contrib_area$n"]      = $c['area']      ?? '';
                    $row["contrib_modalidad$n"] = $c['modalidad'] ?? '';
                    $row["contrib_revista$n"]   = $c['revista']   ?? '';
                }
            }
            unset($row);

            echo json_encode(['success' => true, 'registrations' => $rows]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_workshop_roster':
        // Lista de alumnos inscritos en cada taller y visita (para el reporte
        // "alumnos por taller"). Devuelve, por cada ítem, sus participantes.
        requireAdmin($pdo);
        try {
            $sql = "
                SELECT cat.tipo_item, cat.id AS item_id, cat.nombre AS item_nombre,
                       cat.horario, cat.modalidad, cat.cupo,
                       p.nombre, p.apellido, r.correo AS email, u.telefono,
                       p.institucion, r.folio, e.concepto
                FROM (
                    SELECT id, nombre, horario, modalidad, cupo, 'taller' AS tipo_item FROM cat_talleres
                    UNION ALL
                    SELECT id, nombre, horario, modalidad, cupo, 'visita' AS tipo_item FROM cat_visitas
                ) cat
                JOIN reg_evento_detalles d ON d.item_id = cat.id AND d.tipo_item = cat.tipo_item
                JOIN reg_inscripciones r   ON d.folio = r.folio
                LEFT JOIN reg_personal p   ON r.folio = p.folio
                LEFT JOIN ini_usuarios u   ON r.correo = u.correo
                LEFT JOIN reg_evento e     ON r.folio = e.folio
                ORDER BY cat.tipo_item, CAST(REGEXP_REPLACE(cat.id, '[^0-9]', '') AS UNSIGNED), cat.id, p.apellido, p.nombre
            ";
            $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

            // Columna "Pago" (obs. 23-jul): estatus del comprobante de la COMPRA que
            // incluyó ese taller/visita. Se liga por concepto: cada concepto de pago
            // contiene el ID del ítem (p.ej. 0001T03 incluye T03). Se busca el concepto
            // del alumno que contiene el ID del ítem y el estatus de su comprobante;
            // si no hay match, se usa el estatus del comprobante más reciente.
            // Se hacen consultas por correo y se cachean para no repetir.
            $comprobantesPorCorreo = [];
            $getComprobantes = function($correo) use ($pdo, &$comprobantesPorCorreo) {
                if (isset($comprobantesPorCorreo[$correo])) return $comprobantesPorCorreo[$correo];
                $st = $pdo->prepare("
                    SELECT d.estado, d.fecha_subida,
                        COALESCE(
                            (SELECT h.concepto FROM reg_conceptos_historial h
                              WHERE h.correo = d.correo AND h.fecha_generado <= (SELECT r0.fecha_subida FROM reg_documentos r0 WHERE r0.id = COALESCE(d.reemplaza_id, d.id))
                              ORDER BY h.fecha_generado DESC LIMIT 1),
                            (SELECT h2.concepto FROM reg_conceptos_historial h2 WHERE h2.correo = d.correo ORDER BY h2.fecha_generado ASC LIMIT 1)
                        ) AS concepto_pago
                    FROM reg_documentos d
                    WHERE d.correo = ? AND d.tipo_doc = 'comprobante'
                    ORDER BY d.fecha_subida ASC");
                $st->execute([$correo]);
                return $comprobantesPorCorreo[$correo] = $st->fetchAll(PDO::FETCH_ASSOC);
            };
            $estadoLabel = ['aceptado' => 'Aceptado', 'rechazado' => 'Rechazado', 'pendiente' => 'Pendiente'];
            foreach ($rows as &$row) {
                $comps = $getComprobantes($row['email']);
                $pago = '';
                // 1) Comprobante cuyo concepto contiene el ID del ítem (token exacto)
                foreach ($comps as $c) {
                    if ($c['concepto_pago'] && strpos($c['concepto_pago'], $row['item_id']) !== false) {
                        $pago = $estadoLabel[$c['estado']] ?? $c['estado'];
                    }
                }
                // 2) Fallback: estatus del comprobante más reciente
                if ($pago === '' && count($comps) > 0) {
                    $ult = end($comps);
                    $pago = ($estadoLabel[$ult['estado']] ?? $ult['estado']) . ' (general)';
                }
                if ($pago === '') $pago = 'Sin comprobante';
                $row['pago'] = $pago;
            }
            unset($row);

            echo json_encode(['success' => true, 'roster' => $rows]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_registrations':
        requireAdmin($pdo);
        try {
            $query = "
                SELECT
                    r.folio, r.correo as email, r.estatus as status, r.fecha_inscripcion as date_registered,
                    CONCAT(p.nombre, ' ', p.apellido) as fullName,
                    d.tipo as regType, d.total, d.concepto as concept,
                    (SELECT GROUP_CONCAT(estado ORDER BY fecha_subida SEPARATOR ',') FROM reg_documentos doc WHERE doc.correo=r.correo AND doc.tipo_doc='comprobante')    as docs_comprobante,
                    (SELECT GROUP_CONCAT(estado ORDER BY fecha_subida SEPARATOR ',') FROM reg_documentos doc WHERE doc.correo=r.correo AND doc.tipo_doc='identificacion') as docs_identificacion,
                    (SELECT GROUP_CONCAT(estado ORDER BY fecha_subida SEPARATOR ',') FROM reg_documentos doc WHERE doc.correo=r.correo AND doc.tipo_doc='constancia')     as docs_constancia,
                    (SELECT GROUP_CONCAT(concepto ORDER BY fecha_generado SEPARATOR '||') FROM reg_conceptos_historial h WHERE h.correo=r.correo) as conceptos_historial,
                    (SELECT GROUP_CONCAT(total ORDER BY fecha_generado SEPARATOR '||') FROM reg_conceptos_historial h WHERE h.correo=r.correo) as totales_historial
                FROM reg_inscripciones r
                JOIN reg_personal p ON r.folio = p.folio
                JOIN reg_evento d ON r.folio = d.folio
                ORDER BY CAST(d.concepto AS UNSIGNED) ASC, r.fecha_inscripcion DESC
            ";
            $registrations = $pdo->query($query)->fetchAll();
            echo json_encode(['success' => true, 'registrations' => $registrations]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_registration_detail':
        requireAdmin($pdo);
        $folio = $_GET['folio'] ?? '';
        if (empty($folio)) {
            echo json_encode(['success' => false, 'error' => 'Folio requerido']);
            break;
        }

        try {
            // 1. Datos del registro, personal, evento y archivos
            $stmt = $pdo->prepare("
                SELECT
                    r.folio, r.correo as email, r.estatus as status, r.fecha_inscripcion as date_registered,
                    p.nombre, p.apellido, p.institucion, p.ciudad, p.estado, p.pais,
                    u.telefono,
                    e.tipo as regType, e.total, e.concepto as concept
                FROM reg_inscripciones r
                LEFT JOIN reg_personal p ON r.folio = p.folio
                LEFT JOIN ini_usuarios u ON r.correo = u.correo
                LEFT JOIN reg_evento e ON r.folio = e.folio
                WHERE r.folio = ?
            ");
            $stmt->execute([$folio]);
            $mainData = $stmt->fetch();

            if (!$mainData) {
                echo json_encode(['success' => false, 'error' => 'Registro no encontrado']);
                break;
            }

            // Historial completo de documentos del usuario (todas sus subidas, sin importar el folio)
            // concepto_pago: concepto de la compra a la que pertenece cada documento
            $stmtDocs = $pdo->prepare("
                SELECT d.id, d.folio, d.tipo_doc, d.archivo, d.fecha_subida, d.estado, d.comentario, d.revisado_por, d.fecha_revision, d.reemplaza_id,
                    COALESCE(
                        (SELECT h.concepto FROM reg_conceptos_historial h
                          WHERE h.correo = d.correo AND h.fecha_generado <= (SELECT r0.fecha_subida FROM reg_documentos r0 WHERE r0.id = COALESCE(d.reemplaza_id, d.id))
                          ORDER BY h.fecha_generado DESC LIMIT 1),
                        (SELECT h2.concepto FROM reg_conceptos_historial h2
                          WHERE h2.correo = d.correo ORDER BY h2.fecha_generado ASC LIMIT 1)
                    ) AS concepto_pago
                FROM reg_documentos d WHERE d.correo = ? ORDER BY d.tipo_doc ASC, d.fecha_subida DESC");
            $stmtDocs->execute([$mainData['email']]);
            $documents = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);

            // Historial completo de conceptos de pago generados (todas las compras del usuario)
            $stmtConceptos = $pdo->prepare("SELECT folio, concepto, total, fecha_generado FROM reg_conceptos_historial WHERE correo = ? ORDER BY fecha_generado ASC");
            $stmtConceptos->execute([$mainData['email']]);
            $conceptosHistorial = $stmtConceptos->fetchAll(PDO::FETCH_ASSOC);

            // 2. Datos de facturación
            $stmtFact = $pdo->prepare("SELECT * FROM reg_facturacion WHERE folio = ?");
            $stmtFact->execute([$folio]);
            $billingData = $stmtFact->fetch();

            // 3. Talleres y Visitas registradas (DISTINCT para evitar duplicados por data corruption)
            $stmtTalleres = $pdo->prepare("
                SELECT DISTINCT t.id, t.nombre, t.horario, t.instructor, t.modalidad, t.precio
                FROM reg_evento_detalles d
                JOIN cat_talleres t ON d.item_id = t.id
                WHERE d.folio = ? AND d.tipo_item = 'taller'
            ");
            $stmtTalleres->execute([$folio]);
            $workshops = $stmtTalleres->fetchAll();

            $stmtVisitas = $pdo->prepare("
                SELECT DISTINCT v.id, v.nombre, v.horario, v.instructor, v.modalidad, v.precio
                FROM reg_evento_detalles d
                JOIN cat_visitas v ON d.item_id = v.id
                WHERE d.folio = ? AND d.tipo_item = 'visita'
            ");
            $stmtVisitas->execute([$folio]);
            $visits = $stmtVisitas->fetchAll();

            // 4. Datos de contribuciones de autor
            $stmtContrib = $pdo->prepare("SELECT * FROM reg_contribuciones WHERE folio = ?");
            $stmtContrib->execute([$folio]);
            $contribData = $stmtContrib->fetchAll();

            echo json_encode([
                'success' => true,
                'main' => $mainData,
                'billing' => $billingData ? $billingData : null,
                'workshops' => $workshops,
                'visits' => $visits,
                'contributions' => $contribData,
                'documents' => $documents,
                'conceptos_historial' => $conceptosHistorial
            ]);

        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;
    case 'get_my_contributions':
        $email = $_GET['email'] ?? '';
        if (empty($email)) { echo json_encode(['success' => false, 'error' => 'Email requerido']); break; }
        try {
            $stmt = $pdo->prepare("
                SELECT c.id, c.titulo, c.tipo, c.area, c.modalidad, c.revista
                FROM reg_contribuciones c
                JOIN reg_inscripciones i ON c.folio = i.folio
                WHERE i.correo = ?
                ORDER BY c.id ASC
            ");
            $stmt->execute([$email]);
            echo json_encode(['success' => true, 'contributions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'add_contribution':
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        if (empty($email)) { echo json_encode(['success' => false, 'error' => 'Email requerido']); break; }
        try {
            $stmtFolio = $pdo->prepare("SELECT folio FROM reg_inscripciones WHERE correo = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
            $stmtFolio->execute([$email]);
            $folio = $stmtFolio->fetchColumn();
            if (!$folio) { echo json_encode(['success' => false, 'error' => 'Registro no encontrado']); break; }
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM reg_contribuciones WHERE folio = ?");
            $stmtCount->execute([$folio]);
            if ((int)$stmtCount->fetchColumn() >= 2) {
                echo json_encode(['success' => false, 'error' => 'Máximo 2 contribuciones permitidas']); break;
            }
            $titulo = trim($data['titulo'] ?? '');
            if (empty($titulo)) { echo json_encode(['success' => false, 'error' => 'El título es obligatorio']); break; }
            $stmt = $pdo->prepare("INSERT INTO reg_contribuciones (folio, titulo, tipo, area, modalidad, revista) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$folio, $titulo, $data['tipo'] ?? 'ponencia', $data['area'] ?? '', $data['modalidad'] ?? 'presencial', $data['revista'] ?? 'none']);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'update_contribution':
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        $id = (int)($data['id'] ?? 0);
        if (empty($email) || !$id) { echo json_encode(['success' => false, 'error' => 'Datos requeridos']); break; }
        try {
            $stmtCheck = $pdo->prepare("SELECT c.id FROM reg_contribuciones c JOIN reg_inscripciones i ON c.folio = i.folio WHERE c.id = ? AND i.correo = ?");
            $stmtCheck->execute([$id, $email]);
            if (!$stmtCheck->fetchColumn()) { echo json_encode(['success' => false, 'error' => 'No autorizado']); break; }
            $titulo = trim($data['titulo'] ?? '');
            if (empty($titulo)) { echo json_encode(['success' => false, 'error' => 'El título es obligatorio']); break; }
            $stmt = $pdo->prepare("UPDATE reg_contribuciones SET titulo=?, tipo=?, area=?, modalidad=? WHERE id=?");
            $stmt->execute([$titulo, $data['tipo'] ?? 'ponencia', $data['area'] ?? '', $data['modalidad'] ?? 'presencial', $id]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_contribution':
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        $id = (int)($data['id'] ?? 0);
        if (empty($email) || !$id) { echo json_encode(['success' => false, 'error' => 'Datos requeridos']); break; }
        try {
            $stmtCheck = $pdo->prepare("SELECT c.id FROM reg_contribuciones c JOIN reg_inscripciones i ON c.folio = i.folio WHERE c.id = ? AND i.correo = ?");
            $stmtCheck->execute([$id, $email]);
            if (!$stmtCheck->fetchColumn()) { echo json_encode(['success' => false, 'error' => 'No autorizado']); break; }
            $pdo->prepare("DELETE FROM reg_contribuciones WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'update_personal':
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        if (empty($email)) { echo json_encode(['success' => false, 'error' => 'Email requerido']); break; }
        try {
            $stmtFolio = $pdo->prepare("SELECT folio FROM reg_inscripciones WHERE correo = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
            $stmtFolio->execute([$email]);
            $folio = $stmtFolio->fetchColumn();
            if (!$folio) { echo json_encode(['success' => false, 'error' => 'Registro no encontrado']); break; }
            $stmt = $pdo->prepare("UPDATE reg_personal SET nombre=?, apellido=?, institucion=?, ciudad=?, estado=?, pais=? WHERE folio=?");
            $stmt->execute([
                trim($data['nombre'] ?? ''),
                trim($data['apellido'] ?? ''),
                trim($data['institucion'] ?? ''),
                trim($data['ciudad'] ?? ''),
                trim($data['estado'] ?? ''),
                trim($data['pais'] ?? ''),
                $folio
            ]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'update_settings':
        requireAdmin($pdo);
        $data = json_decode(file_get_contents('php://input'), true);
        try {
            $stmt = $pdo->prepare("UPDATE cat_ajustes SET valor = ? WHERE clave = ?");
            foreach ($data as $key => $value) {
                $stmt->execute([$value, $key]);
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'save_item':
        requireAdmin($pdo);
        $data = json_decode(file_get_contents('php://input'), true);
        $type = $_GET['type'] ?? 'workshop';
        $table = ($type === 'workshop') ? 'cat_talleres' : 'cat_visitas';
        $prefix = ($type === 'workshop') ? 'T' : 'V';
        $seqKey = ($type === 'workshop') ? 'seq_taller' : 'seq_visita';

        try {
            $clientId = trim($data['id'] ?? '');

            // ¿Es EDICIÓN? Solo si el id enviado ya existe en el catálogo.
            $existe = false;
            if ($clientId !== '') {
                $chk = $pdo->prepare("SELECT 1 FROM $table WHERE id = ?");
                $chk->execute([$clientId]);
                $existe = (bool)$chk->fetchColumn();
            }

            if ($existe) {
                // EDICIÓN: el ID es inmutable, solo se actualizan los demás campos.
                $stmt = $pdo->prepare("UPDATE $table SET nombre=?, descripcion=?, precio=?, horario=?, instructor=?, dependencia=?, modalidad=?, cupo=?, activo=? WHERE id=?");
                $stmt->execute([
                    $data['name'], $data['description'], $data['price'], $data['hours'],
                    $data['instructor'], $data['dependency'], $data['modality'],
                    $data['capacity'], isset($data['activo']) ? (int)$data['activo'] : 1,
                    $clientId
                ]);
                echo json_encode(['success' => true, 'id' => $clientId]);
            } else {
                // ALTA: el servidor asigna el siguiente ID secuencial (T01, T02, ...).
                // Se usa un contador en cat_ajustes que SOLO incrementa, de modo que
                // un ID eliminado nunca se reutiliza. El id del cliente se ignora.
                $maxExisting = (int)$pdo->query("SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(id,'[^0-9]','') AS UNSIGNED)),0) FROM $table")->fetchColumn();
                $seqStmt = $pdo->prepare("SELECT valor FROM cat_ajustes WHERE clave = ?");
                $seqStmt->execute([$seqKey]);
                $storedSeq = (int)($seqStmt->fetchColumn() ?: 0);
                $next = max($maxExisting, $storedSeq) + 1;
                $pdo->prepare("INSERT INTO cat_ajustes (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?")
                    ->execute([$seqKey, $next, $next]);
                $newId = $prefix . str_pad($next, 2, '0', STR_PAD_LEFT);

                $cupo_actual = isset($data['cupo_actual']) ? $data['cupo_actual'] : 0;
                $activo = isset($data['activo']) ? (int)$data['activo'] : 1;
                $stmt = $pdo->prepare("INSERT INTO $table (id, nombre, descripcion, precio, horario, instructor, dependencia, modalidad, cupo, cupo_actual, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $newId, $data['name'], $data['description'], $data['price'],
                    $data['hours'], $data['instructor'], $data['dependency'],
                    $data['modality'], $data['capacity'], $cupo_actual, $activo
                ]);
                echo json_encode(['success' => true, 'id' => $newId]);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'toggle_category_active':
        requireAdmin($pdo);
        $type = $_GET['type'] ?? 'workshop';
        $active = isset($_GET['active']) && $_GET['active'] === '1' ? 1 : 0;
        $table = ($type === 'workshop') ? 'cat_talleres' : 'cat_visitas';

        try {
            $pdo->exec("UPDATE $table SET activo = $active");
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_item':
        requireAdmin($pdo);
        $id = trim($_GET['id'] ?? '');
        $type = $_GET['type'] ?? '';
        
        $tables = ['cat_talleres', 'cat_visitas', 'cat_codigos'];
        $deleted = false;
        $targetTable = "";

        try {
            foreach ($tables as $table) {
                $stmt = $pdo->prepare("DELETE FROM $table WHERE id = ?");
                $stmt->execute([$id]);
                
                if ($stmt->rowCount() > 0) {
                    $deleted = true;
                    $targetTable = $table;
                    break;
                }
            }
            
            if ($deleted) {
                echo json_encode(['success' => true, 'message' => "Eliminado de $targetTable"]);
            } else {
                echo json_encode(['success' => false, 'error' => "No se encontró el ID '$id' en ninguna tabla activa."]);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Error de BD: ' . $e->getMessage()]);
        }
        break;

    case 'verify_code':
        // Verifica Y consume el código en una sola operación atómica.
        // Esto elimina la ventana en la que dos personas podían validar el
        // mismo código a la vez (antes verificar y marcar eran dos pasos).
        $code = trim($_GET['code'] ?? '');

        // Rate limit por IP para impedir enumeración de códigos por fuerza bruta
        $codeCheckId = 'codecheck:' . getClientIp();
        if (isRateLimited($pdo, $codeCheckId, 10, 15)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Demasiados intentos. Espera unos minutos.']);
            break;
        }

        try {
            $stmt = $pdo->prepare("UPDATE cat_codigos SET usado = 1 WHERE id = ? AND usado = 0");
            $stmt->execute([$code]);

            if ($stmt->rowCount() > 0) {
                clearFailedAttempts($pdo, $codeCheckId);
                echo json_encode(['success' => true, 'message' => 'Código válido.']);
            } else {
                recordFailedAttempt($pdo, $codeCheckId);
                $exists = $pdo->prepare("SELECT usado FROM cat_codigos WHERE id = ?");
                $exists->execute([$code]);
                $row = $exists->fetch();
                if ($row) {
                    echo json_encode(['success' => false, 'error' => 'Este código ya ha sido utilizado.']);
                } else {
                    echo json_encode(['success' => false, 'error' => 'El código ingresado no existe.']);
                }
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'mark_code_used':
        // LEGACY: el consumo del código ahora ocurre atómicamente en verify_code.
        // Se conserva la acción para compatibilidad con JS cacheado: responde
        // éxito si el código ya está consumido, sin permitir quemar códigos
        // ajenos (ya no invalida nada por sí misma).
        $code = trim($_GET['code'] ?? '');
        try {
            $stmt = $pdo->prepare("SELECT usado FROM cat_codigos WHERE id = ?");
            $stmt->execute([$code]);
            $row = $stmt->fetch();
            if ($row && (int)$row['usado'] === 1) {
                echo json_encode(['success' => true, 'message' => 'Código invalidado correctamente.']);
            } else {
                echo json_encode(['success' => false, 'error' => 'El código ya estaba invalidado o no existe.']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_codes':
        // Listado de códigos para el admin, con rastreo de quién lo usó.
        requireAdmin($pdo);
        try {
            $codes = $pdo->query("
                SELECT c.id, c.usado, c.usado_por, c.fecha_uso, c.fecha AS date,
                       u.id AS usado_por_id
                FROM cat_codigos c
                LEFT JOIN ini_usuarios u ON u.correo = c.usado_por
                ORDER BY c.fecha DESC, c.id
            ")->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'codes' => $codes]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'generate_codes':
        requireAdmin($pdo);
        $data = json_decode(file_get_contents('php://input'), true);
        $codes = $data['codes'] ?? [];
        try {
            $stmt = $pdo->prepare("INSERT IGNORE INTO cat_codigos (id) VALUES (?)");
            foreach ($codes as $code) {
                $stmt->execute([$code['id']]);
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_doc_revisions':
        requireAdmin($pdo);
        $folio = $_GET['folio'] ?? '';
        if (empty($folio)) { echo json_encode(['success' => false, 'error' => 'Folio requerido']); break; }
        try {
            $stmtCorreo = $pdo->prepare("SELECT correo FROM reg_inscripciones WHERE folio = ?");
            $stmtCorreo->execute([$folio]);
            $correo = $stmtCorreo->fetchColumn();
            if (!$correo) { echo json_encode(['success' => false, 'error' => 'Folio no encontrado']); break; }

            // concepto_pago: el concepto generado inmediatamente ANTES de la subida
            // del documento (la compra a la que pertenece). Se calcula por documento
            // y no por folio, porque el folio ahora es estable entre compras.
            $stmtDocs = $pdo->prepare("
                SELECT d.*,
                    COALESCE(
                        (SELECT h.concepto FROM reg_conceptos_historial h
                          WHERE h.correo = d.correo AND h.fecha_generado <= (SELECT r0.fecha_subida FROM reg_documentos r0 WHERE r0.id = COALESCE(d.reemplaza_id, d.id))
                          ORDER BY h.fecha_generado DESC LIMIT 1),
                        (SELECT h2.concepto FROM reg_conceptos_historial h2
                          WHERE h2.correo = d.correo ORDER BY h2.fecha_generado ASC LIMIT 1)
                    ) AS concepto_pago
                FROM reg_documentos d WHERE d.correo = ? ORDER BY d.tipo_doc ASC, d.fecha_subida DESC");
            $stmtDocs->execute([$correo]);
            $grouped = [];
            foreach ($stmtDocs->fetchAll(PDO::FETCH_ASSOC) as $doc) {
                $grouped[$doc['tipo_doc']][] = $doc;
            }

            echo json_encode(['success' => true, 'documents' => $grouped]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'review_doc':
        requireAdmin($pdo);
        $data = json_decode(file_get_contents('php://input'), true);
        $id           = $data['id']           ?? null;
        $estado       = $data['estado']       ?? 'pendiente';
        $comentario   = $data['comentario']   ?? null;
        $revisado_por = $data['revisado_por'] ?? null;
        if (empty($id)) {
            echo json_encode(['success' => false, 'error' => 'Datos incompletos']); break;
        }
        try {
            $stmtDoc = $pdo->prepare("SELECT correo FROM reg_documentos WHERE id = ?");
            $stmtDoc->execute([$id]);
            $correo = $stmtDoc->fetchColumn();
            if (!$correo) { echo json_encode(['success' => false, 'error' => 'Documento no encontrado']); break; }

            // Estatus previo, para notificar por correo solo cuando realmente cambie
            $stmtPrev = $pdo->prepare("SELECT estatus FROM reg_inscripciones WHERE correo = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
            $stmtPrev->execute([$correo]);
            $prevStatus = $stmtPrev->fetchColumn();

            $fechaRevision = ($estado === 'pendiente') ? null : date('Y-m-d H:i:s');
            // COALESCE: si no llega comentario nuevo (aceptar/pendiente), se CONSERVA
            // la justificación de rechazo previa, para no perderla si el admin se
            // equivoca de botón y luego vuelve a rechazar.
            $pdo->prepare("UPDATE reg_documentos SET estado=?, comentario=COALESCE(?, comentario), revisado_por=?, fecha_revision=? WHERE id=?")
                ->execute([$estado, $comentario, $revisado_por, $fechaRevision, $id]);

            // La revisión de un documento es una acción explícita del admin:
            // el estatus vuelve al modo automático basado en documentos.
            resetEstatusManual($pdo, $correo);
            $newStatus = recalcEstatusDocumentos($pdo, $correo);

            // Notificar por correo SOLO cuando se rechaza (estatus "denegado").
            // Al aceptar no se envía correo (solicitud del 15 de julio).
            if ($newStatus !== $prevStatus && $newStatus === 'denegado') {
                try {
                    $stmtPersonal = $pdo->prepare("
                        SELECT p.nombre, p.apellido, i.folio
                        FROM reg_inscripciones i
                        LEFT JOIN reg_personal p ON p.folio = i.folio
                        WHERE i.correo = ? ORDER BY i.fecha_inscripcion DESC LIMIT 1
                    ");
                    $stmtPersonal->execute([$correo]);
                    $personal = $stmtPersonal->fetch();
                    $nombre = $personal['nombre'] ?? '';
                    $apellido = $personal['apellido'] ?? '';
                    $folioPersonal = $personal['folio'] ?? '';

                    require_once 'mailer.php';

                    $emailSubject = "Documentos Rechazados - ConCEI-3 — Folio $folioPersonal";
                    $statusBanner = "<div style='background:#fee2e2; border-left:4px solid #dc2626; padding:14px 18px; border-radius:0 8px 8px 0; font-size:14px; color:#7f1d1d;'><strong>Uno o más de tus documentos fueron rechazados.</strong> Por favor, ingresa nuevamente a la plataforma con tu correo y contraseña para revisar el motivo y volver a subir el documento correspondiente.</div>";

                    $emailBody = "
                    <div style='font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;'>
                        <div style='background: #1e3a8a; color: white; padding: 28px 30px;'>
                            <h1 style='margin: 0 0 6px; font-size: 22px;'>Congreso ConCEI-3</h1>
                            <p style='margin: 0; font-size: 14px; opacity: 0.85;'>Estatus de Documentos</p>
                        </div>
                        <div style='padding: 30px; color: #334155; line-height: 1.7;'>
                            <p style='font-size: 16px;'>Estimado/a <strong style='color: #1e3a8a;'>$nombre $apellido</strong>,</p>
                            $statusBanner
                            <p style='margin-top: 20px;'><strong>Folio de registro:</strong> <span style='color: #1e3a8a; font-family: monospace;'>$folioPersonal</span></p>
                        </div>
                        <div style='background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;'>
                            &copy; 2026 Congreso ConCEI 2026 &mdash; Este es un correo automático, por favor no respondas a este mensaje.
                        </div>
                    </div>
                    ";

                    sendRegistrationEmail($correo, $emailSubject, $emailBody);
                } catch (Exception $eMail) {
                    error_log("Error al enviar correo de notificación de documentos: " . $eMail->getMessage());
                }
            }

            echo json_encode(['success' => true, 'newStatus' => $newStatus]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'update_reg_status':
        requireAdmin($pdo);
        $data = json_decode(file_get_contents('php://input'), true);
        try {
            // El estatus fijado por el admin queda "bloqueado" (estatus_manual=1)
            // para que el recálculo automático no lo revierta.
            $stmt = $pdo->prepare("UPDATE reg_inscripciones SET estatus = ?, estatus_manual = 1 WHERE folio = ?");
            $stmt->execute([$data['status'], $data['folio']]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_user_doc_status':
        $email = $_GET['email'] ?? '';
        if (empty($email)) { echo json_encode(['success' => false, 'error' => 'Email requerido']); break; }
        try {
            $stmt = $pdo->prepare("
                SELECT r.folio, r.estatus as status, r.fecha_inscripcion as fecha, e.tipo as regType, e.total as total,
                       (SELECT COUNT(*) FROM reg_facturacion f WHERE f.folio = r.folio) as requiereFacturaCount
                FROM reg_inscripciones r
                LEFT JOIN reg_evento e ON r.folio = e.folio
                WHERE r.correo = ? ORDER BY r.fecha_inscripcion DESC LIMIT 1
            ");
            $stmt->execute([$email]);
            $regInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$regInfo) { echo json_encode(['success' => true, 'hasRegistration' => false]); break; }

            $folio = $regInfo['folio'];

            // Historial completo de documentos del usuario (todas sus subidas, sin importar el folio)
            // concepto_pago: concepto de la compra a la que pertenece cada documento
            // (el generado justo antes de su subida), calculado por documento.
            $stmtDocs = $pdo->prepare("
                SELECT d.id, d.folio, d.tipo_doc, d.archivo, d.fecha_subida, d.estado, d.comentario, d.fecha_revision, d.reemplaza_id,
                    COALESCE(
                        (SELECT h.concepto FROM reg_conceptos_historial h
                          WHERE h.correo = d.correo AND h.fecha_generado <= (SELECT r0.fecha_subida FROM reg_documentos r0 WHERE r0.id = COALESCE(d.reemplaza_id, d.id))
                          ORDER BY h.fecha_generado DESC LIMIT 1),
                        (SELECT h2.concepto FROM reg_conceptos_historial h2
                          WHERE h2.correo = d.correo ORDER BY h2.fecha_generado ASC LIMIT 1)
                    ) AS concepto_pago
                FROM reg_documentos d WHERE d.correo = ? ORDER BY d.tipo_doc ASC, d.fecha_subida DESC");
            $stmtDocs->execute([$email]);
            $grouped = [];
            foreach ($stmtDocs->fetchAll(PDO::FETCH_ASSOC) as $doc) {
                $grouped[$doc['tipo_doc']][] = $doc;
            }

            // Concepto de pago generado en cada subida (folio), para que el usuario
            // pueda identificar con qué concepto envió cada comprobante.
            $stmtConceptos = $pdo->prepare("SELECT folio, concepto, total FROM reg_conceptos_historial WHERE correo = ?");
            $stmtConceptos->execute([$email]);
            $conceptosByFolio = [];
            foreach ($stmtConceptos->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $conceptosByFolio[$row['folio']] = ['concepto' => $row['concepto'], 'total' => $row['total']];
            }

            // Recalcula y persiste el estatus general a partir de TODOS los documentos
            // (no solo el más reciente por tipo), para autocorregir estatus desactualizados.
            $status = recalcEstatusDocumentos($pdo, $email);

            echo json_encode([
                'success' => true,
                'hasRegistration' => true,
                'folio' => $folio,
                'status' => $status,
                'fecha' => $regInfo['fecha'],
                'regType' => $regInfo['regType'],
                'total' => $regInfo['total'],
                'requiereFactura' => (int)$regInfo['requiereFacturaCount'] > 0,
                'documents' => $grouped,
                'conceptosByFolio' => $conceptosByFolio
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'reupload_doc':
        $folio    = $_POST['folio']    ?? '';
        $tipo_doc = $_POST['tipo_doc'] ?? '';
        // ID del documento rechazado que esta subida corrige (opcional). Ancla la
        // corrección a SU pago específico, para que el hilo comprobante+corrección
        // de cada compra sea independiente y no se pierda al hacer otra compra.
        $reemplazaId = (int)($_POST['reemplaza_id'] ?? 0);
        $validTypes = ['comprobante','identificacion','constancia'];
        if (empty($folio) || !in_array($tipo_doc, $validTypes) || empty($_FILES['documento'])) {
            echo json_encode(['success' => false, 'error' => 'Datos incompletos']); break;
        }
        $file = $_FILES['documento'];
        if ($file['error'] !== UPLOAD_ERR_OK) { echo json_encode(['success' => false, 'error' => 'Error en la subida del archivo']); break; }
        $allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'];
        if (!in_array($file['type'], $allowed)) { echo json_encode(['success' => false, 'error' => 'Tipo de archivo no permitido (solo imágenes y PDF)']); break; }
        try {
            $stmtCorreo = $pdo->prepare("SELECT correo FROM reg_inscripciones WHERE folio = ?");
            $stmtCorreo->execute([$folio]);
            $correo = $stmtCorreo->fetchColumn();
            // Si el folio fue reemplazado por una actualización de registro, buscarlo en documentos
            if (!$correo) {
                $stmtFallback = $pdo->prepare("SELECT DISTINCT correo FROM reg_documentos WHERE folio = ? LIMIT 1");
                $stmtFallback->execute([$folio]);
                $correo = $stmtFallback->fetchColumn();
            }
            if (!$correo) { echo json_encode(['success' => false, 'error' => 'Folio no encontrado']); break; }

            // Usar el folio actual del usuario para la nueva subida
            $stmtCurrentFolio = $pdo->prepare("SELECT folio FROM reg_inscripciones WHERE correo = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
            $stmtCurrentFolio->execute([$correo]);
            $currentFolio = $stmtCurrentFolio->fetchColumn() ?: $folio;

            $rootId = null;
            if ($reemplazaId > 0) {
                // CORRECCIÓN de un documento específico: validar que el documento
                // exista, sea de este usuario/tipo, esté RECHAZADO y no tenga ya
                // una corrección propia sin resolver.
                $stmtRoot = $pdo->prepare("SELECT id, folio, reemplaza_id FROM reg_documentos WHERE id = ? AND correo = ? AND tipo_doc = ?");
                $stmtRoot->execute([$reemplazaId, $correo, $tipo_doc]);
                $rootDoc = $stmtRoot->fetch();
                if (!$rootDoc) { echo json_encode(['success' => false, 'error' => 'Documento a corregir no encontrado.']); break; }
                // Siempre anclar a la RAÍZ de la cadena (si corrigen una corrección)
                $rootId = $rootDoc['reemplaza_id'] ?: $rootDoc['id'];

                // La versión más reciente de esta cadena debe estar rechazada
                $stmtLast = $pdo->prepare("
                    SELECT estado FROM reg_documentos
                    WHERE correo = ? AND (id = ? OR reemplaza_id = ?)
                    ORDER BY fecha_subida DESC, id DESC LIMIT 1");
                $stmtLast->execute([$correo, $rootId, $rootId]);
                if ($stmtLast->fetchColumn() !== 'rechazado') {
                    echo json_encode(['success' => false, 'error' => 'Este documento no tiene una versión rechazada pendiente de corregir.']); break;
                }
                // La corrección conserva el folio del documento original (su pago)
                $currentFolio = $rootDoc['folio'];
            } else {
                // Subida "suelta" (sin corrección dirigida): se permite solo si el
                // documento más reciente de este tipo fue rechazado o no existe.
                $stmtLatest = $pdo->prepare("SELECT estado FROM reg_documentos WHERE correo = ? AND tipo_doc = ? ORDER BY fecha_subida DESC LIMIT 1");
                $stmtLatest->execute([$correo, $tipo_doc]);
                $latestEstado = $stmtLatest->fetchColumn();
                if ($latestEstado !== false && $latestEstado !== 'rechazado') {
                    echo json_encode(['success' => false, 'error' => 'Este documento ya fue revisado y no puede modificarse.']); break;
                }
            }

            $safeOriginal = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name']));
            $filename = time() . '_' . $tipo_doc . '_' . $safeOriginal;
            $uploadDir = dirname(__DIR__) . '/uploads/';
            if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
                echo json_encode(['success' => false, 'error' => 'No se pudo guardar el archivo']); break;
            }

            // Cada subida es un registro NUEVO en el historial (append-only).
            $pdo->prepare("INSERT INTO reg_documentos (correo, folio, tipo_doc, archivo, fecha_subida, estado, reemplaza_id) VALUES (?,?,?,?,NOW(),'pendiente',?)")
                ->execute([$correo, $currentFolio, $tipo_doc, $filename, $rootId]);
            // IMPORTANTE: una subida del USUARIO NO debe deshacer una aceptación
            // MANUAL del admin ("Confirmar Aceptación Total"). Por eso aquí NO se
            // llama a resetEstatusManual: si el admin fijó el estatus a mano, se
            // conserva y recalcEstatusDocumentos lo respeta (no lo reabre solo).
            // El documento nuevo queda visible en el panel para que el admin lo
            // revise cuando quiera; al revisarlo (review_doc) el modo automático
            // se reactiva. Si el registro estaba en modo automático, el recálculo
            // refleja el nuevo pendiente con normalidad.
            $newStatus = recalcEstatusDocumentos($pdo, $correo);
            echo json_encode(['success' => true, 'filename' => $filename, 'newStatus' => $newStatus]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_reg':
        requireAdmin($pdo);
        $folio = $_GET['folio'] ?? '';
        try {
            // Eliminar historial de documentos del usuario (no tiene CASCADE)
            $stmtCorreo = $pdo->prepare("SELECT correo FROM reg_inscripciones WHERE folio = ?");
            $stmtCorreo->execute([$folio]);
            $correo = $stmtCorreo->fetchColumn();
            if ($correo) {
                $pdo->prepare("DELETE FROM reg_documentos WHERE correo = ?")->execute([$correo]);
            }
            // Eliminar de la tabla principal (el resto cae por CASCADE)
            $stmt = $pdo->prepare("DELETE FROM reg_inscripciones WHERE folio = ?");
            $stmt->execute([$folio]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'error' => 'No se encontró el registro con folio: ' . $folio]);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Error al eliminar registro: ' . $e->getMessage()]);
        }
        break;
    
    case 'register_user':
        $data = json_decode(file_get_contents('php://input'), true);
        $correo = strtolower(trim($data['email'] ?? ''));
        $pass = $data['password'] ?? '';
        $tel = $data['cellphone'] ?? '';
        $codigoVerif = trim($data['code'] ?? '');

        if (empty($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'error' => 'Correo inválido.']);
            break;
        }
        if (strlen($pass) < 6) {
            echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres.']);
            break;
        }

        // Rate limit por IP+correo para no bloquear redes compartidas (NAT universitario)
        $registerIdentifier = 'register:' . getClientIp() . ':' . $correo;
        if (isRateLimited($pdo, $registerIdentifier, 10, 60)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Demasiados intentos de registro. Intenta de nuevo más tarde.']);
            break;
        }
        recordFailedAttempt($pdo, $registerIdentifier);

        // Seguridad: la cuenta SOLO se crea con un código de verificación válido
        // enviado al correo (send_verification_code type 'register'). Sin esto,
        // cualquiera podría crear cuentas con correos ajenos llamando a la API.
        $stmtCode = $pdo->prepare("SELECT id FROM password_resets WHERE email = ? AND code = ? AND type = 'user' AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmtCode->execute([$correo, $codigoVerif]);
        $verif = $stmtCode->fetch();
        if (empty($codigoVerif) || !$verif) {
            echo json_encode(['success' => false, 'error' => 'Código de verificación inválido o expirado. Verifica tu correo.']);
            break;
        }

        try {
            $hashedPassword = password_hash($pass, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO ini_usuarios (correo, contrasena, telefono) VALUES (?, ?, ?)");
            $stmt->execute([$correo, $hashedPassword, $tel]);
            // Consumir el código: un código = una cuenta
            $pdo->prepare("UPDATE password_resets SET used = 1 WHERE id = ?")->execute([$verif['id']]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            // Error code 1062 or SQLSTATE 23000 indicate a unique constraint violation in MySQL
            if ($e->getCode() == 23000 || strpos($e->getMessage(), '1062') !== false) {
                echo json_encode(['success' => false, 'error' => 'correo_duplicado']);
            } else {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'login_user':
        $data = json_decode(file_get_contents('php://input'), true);
        $correo = $data['email'] ?? '';
        $pass = $data['password'] ?? '';

        $userLoginIdentifier = 'user:' . getClientIp() . ':' . strtolower($correo);
        if (isRateLimited($pdo, $userLoginIdentifier)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.']);
            break;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM ini_usuarios WHERE correo = ?");
            $stmt->execute([$correo]);
            $user = $stmt->fetch();

            if ($user && password_verify($pass, $user['contrasena'])) {
                clearFailedAttempts($pdo, $userLoginIdentifier);
                echo json_encode([
                    'success' => true,
                    'user' => [
                        'email' => $user['correo'],
                        'cellphone' => $user['telefono']
                    ]
                ]);
            } else {
                recordFailedAttempt($pdo, $userLoginIdentifier);
                // Mensajes diferenciados (solicitud del cliente): si el correo no
                // existe se invita a crear cuenta; si existe, credenciales inválidas.
                if (!$user) {
                    echo json_encode(['success' => false, 'error' => 'Usuario no registrado. Favor de crear tu cuenta.', 'not_registered' => true]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Nombre de usuario y/o contraseña incorrecta']);
                }
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Error: ' . $e->getMessage()]);
        }
        break;
    case 'admin_login':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        $adminLoginIdentifier = 'admin:' . getClientIp() . ':' . strtolower($username);
        if (isRateLimited($pdo, $adminLoginIdentifier)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.']);
            break;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE username = ?");
            $stmt->execute([$username]);
            $admin = $stmt->fetch();

            if ($admin && password_verify($password, $admin['password_hash'])) {
                clearFailedAttempts($pdo, $adminLoginIdentifier);
                $token = bin2hex(random_bytes(32));
                $pdo->prepare("INSERT INTO admin_sessions (token, admin_id) VALUES (?, ?)")->execute([$token, $admin['id']]);
                echo json_encode([
                    'success' => true,
                    'token' => $token,
                    'admin' => [
                        'id' => $admin['id'],
                        'username' => $admin['username'],
                        'rol' => $admin['rol']
                    ]
                ]);
            } else {
                recordFailedAttempt($pdo, $adminLoginIdentifier);
                echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'admin_logout':
        $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
        if (!empty($token)) {
            $pdo->prepare("DELETE FROM admin_sessions WHERE token = ?")->execute([$token]);
        }
        echo json_encode(['success' => true]);
        break;

    case 'get_admins':
        // Sin autenticación solo si todavía no existe ningún administrador
        // (modo configuración inicial); en cualquier otro caso se requiere sesión.
        if (hasAnyAdmin($pdo)) {
            requireAdmin($pdo);
        }
        try {
            $admins = $pdo->query("SELECT id, username, rol, recovery_email FROM admin_users ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'admins' => $admins]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'save_admin':
        // Sin autenticación solo si todavía no existe ningún administrador
        // (creación del primer Super Administrador en modo configuración).
        if (hasAnyAdmin($pdo)) {
            requireAdmin($pdo);
        }
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? null;
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';
        $rol = $data['rol'] ?? 'admin';

        if (empty($username)) {
            echo json_encode(['success' => false, 'error' => 'El correo es requerido']);
            break;
        }

        try {
            if ($id) {
                // Update
                if ($rol === 'admin') {
                    $stmtCheck = $pdo->prepare("SELECT rol FROM admin_users WHERE id = ?");
                    $stmtCheck->execute([$id]);
                    $currentAdmin = $stmtCheck->fetch();
                    if ($currentAdmin && $currentAdmin['rol'] === 'superadmin') {
                        $stmtSuper = $pdo->query("SELECT COUNT(*) as total FROM admin_users WHERE rol = 'superadmin'");
                        $totalSuper = (int)$stmtSuper->fetch()['total'];
                        if ($totalSuper <= 1) {
                            echo json_encode(['success' => false, 'error' => 'No puedes degradar al único Super Administrador del sistema a Administrador. Debe haber al menos uno activo.']);
                            break;
                        }
                    }
                }

                if (!empty($password)) {
                    if (strlen($password) < 8) {
                        echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres']);
                        break;
                    }
                    $hashed = password_hash($password, PASSWORD_BCRYPT);
                    $stmt = $pdo->prepare("UPDATE admin_users SET username = ?, password_hash = ?, rol = ? WHERE id = ?");
                    $stmt->execute([$username, $hashed, $rol, $id]);
                } else {
                    $stmt = $pdo->prepare("UPDATE admin_users SET username = ?, rol = ? WHERE id = ?");
                    $stmt->execute([$username, $rol, $id]);
                }
                echo json_encode(['success' => true, 'message' => 'Administrador actualizado correctamente']);
            } else {
                // Create
                if (empty($password)) {
                    echo json_encode(['success' => false, 'error' => 'La contraseña es requerida para un nuevo administrador']);
                    break;
                }
                if (strlen($password) < 8) {
                    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres']);
                    break;
                }
                // Check if username already exists
                $stmtCheck = $pdo->prepare("SELECT id FROM admin_users WHERE username = ?");
                $stmtCheck->execute([$username]);
                if ($stmtCheck->fetch()) {
                    echo json_encode(['success' => false, 'error' => 'El correo del administrador ya está registrado']);
                    break;
                }

                // Force first administrator to be Superadmin
                $stmtCount = $pdo->query("SELECT COUNT(*) as total FROM admin_users");
                $totalAdmins = (int)$stmtCount->fetch()['total'];
                if ($totalAdmins === 0) {
                    $rol = 'superadmin';
                }

                $hashed = password_hash($password, PASSWORD_BCRYPT);
                $stmt = $pdo->prepare("INSERT INTO admin_users (username, password_hash, rol) VALUES (?, ?, ?)");
                $stmt->execute([$username, $hashed, $rol]);
                echo json_encode(['success' => true, 'message' => 'Administrador creado correctamente']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_admin':
        requireAdmin($pdo);
        $id = $_GET['id'] ?? '';
        try {
            $stmtCheck = $pdo->prepare("SELECT rol FROM admin_users WHERE id = ?");
            $stmtCheck->execute([$id]);
            $adminToDelete = $stmtCheck->fetch();

            if ($adminToDelete && $adminToDelete['rol'] === 'superadmin') {
                $stmtSuper = $pdo->query("SELECT COUNT(*) as total FROM admin_users WHERE rol = 'superadmin'");
                $totalSuper = (int)$stmtSuper->fetch()['total'];
                if ($totalSuper <= 1) {
                    echo json_encode(['success' => false, 'error' => 'No puedes eliminar al único Super Administrador del sistema. Debe haber al menos uno activo.']);
                    break;
                }
            }

            $stmt = $pdo->prepare("DELETE FROM admin_users WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Administrador eliminado correctamente']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'get_next_concept_id':
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as total FROM reg_inscripciones");
            $count = (int)$stmt->fetch()['total'];
            $nextId = $count + 1;
            echo json_encode(['success' => true, 'next_id' => $nextId]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'send_verification_code':
        // Envía código de verificación al correo (para registro o recuperación)
        $data = json_decode(file_get_contents('php://input'), true);
        $correo = strtolower(trim($data['email'] ?? ''));
        $tipo   = $data['type'] ?? 'user'; // 'user' | 'admin'

        if (empty($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'error' => 'Correo inválido.']);
            break;
        }

        $rateLimitId = 'reset:' . getClientIp() . ':' . $correo;
        if (isRateLimited($pdo, $rateLimitId, 3, 15)) {
            echo json_encode(['success' => false, 'error' => 'Demasiadas solicitudes. Espera 15 minutos.']);
            break;
        }
        recordFailedAttempt($pdo, $rateLimitId);

        // Verificar que el correo exista según el tipo
        if ($tipo === 'admin') {
            $stmt = $pdo->prepare("SELECT recovery_email FROM admin_users WHERE username = ?");
            $stmt->execute([$correo]);
            $admin = $stmt->fetch();
            if (!$admin) { echo json_encode(['success' => false, 'error' => 'Administrador no encontrado.']); break; }
            $destino = $admin['recovery_email'] ?: $correo;
        } elseif ($tipo === 'register') {
            // Nuevo usuario: verificar que el correo NO esté ya registrado
            $stmt = $pdo->prepare("SELECT correo FROM ini_usuarios WHERE correo = ?");
            $stmt->execute([$correo]);
            if ($stmt->fetch()) { echo json_encode(['success' => false, 'error' => 'correo_duplicado']); break; }
            $destino = $correo;
            $tipo = 'user'; // reusar tipo 'user' en la tabla
        } else {
            $stmt = $pdo->prepare("SELECT correo FROM ini_usuarios WHERE correo = ?");
            $stmt->execute([$correo]);
            if (!$stmt->fetch()) { echo json_encode(['success' => false, 'error' => 'Correo no registrado.']); break; }
            $destino = $correo;
        }

        // Generar código de 6 dígitos
        $codigo = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Invalidar códigos anteriores
        $pdo->prepare("UPDATE password_resets SET used = 1 WHERE email = ? AND type = ?")->execute([$correo, $tipo]);

        // IMPORTANTE: la expiración se calcula en SQL (NOW() + INTERVAL) y NO con
        // date() de PHP, porque las zonas horarias de PHP y MySQL pueden diferir
        // en este servidor y el código aparecería expirado de inmediato.
        $pdo->prepare("INSERT INTO password_resets (email, code, type, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL 15 MINUTE)")
            ->execute([$correo, $codigo, $tipo]);

        // Enviar correo
        try {
            require_once 'mailer.php';
            $subject = "Código de verificación ConCEI-3 — $codigo";
            $body = "
            <div style='font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;'>
                <div style='background:#1e3a8a;color:white;padding:24px 28px;'>
                    <h2 style='margin:0;font-size:18px;'>Congreso ConCEI-3</h2>
                    <p style='margin:4px 0 0;font-size:13px;opacity:0.85;'>Código de verificación</p>
                </div>
                <div style='padding:28px;color:#334155;'>
                    <p style='font-size:15px;'>Tu código de verificación es:</p>
                    <div style='font-size:36px;font-weight:700;letter-spacing:8px;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:18px;text-align:center;font-family:monospace;margin:20px 0;'>$codigo</div>
                    <p style='font-size:13px;color:#64748b;'>Este código expira en <strong>15 minutos</strong>. Si no solicitaste esto, ignora este mensaje.</p>
                </div>
                <div style='background:#f1f5f9;padding:12px;text-align:center;font-size:11px;color:#94a3b8;'>
                    &copy; 2026 Congreso ConCEI-3 &mdash; Correo automático.
                </div>
            </div>";
            sendRegistrationEmail($destino, $subject, $body);
        } catch (Exception $e) {
            error_log("Error enviando código: " . $e->getMessage());
        }

        echo json_encode(['success' => true, 'message' => 'Código enviado.']);
        break;

    case 'verify_reset_code':
        // Verifica código y opcionalmente cambia contraseña
        $data   = json_decode(file_get_contents('php://input'), true);
        $correo = strtolower(trim($data['email'] ?? ''));
        $codigo = trim($data['code'] ?? '');
        $newPwd = $data['new_password'] ?? '';
        $tipo   = $data['type'] ?? 'user';
        if ($tipo === 'register') $tipo = 'user'; // registro usa tipo 'user'
        $onlyCheck = !empty($data['only_check']); // solo verificar sin cambiar password

        if (empty($correo) || empty($codigo)) {
            echo json_encode(['success' => false, 'error' => 'Datos incompletos.']);
            break;
        }

        try {
            $stmt = $pdo->prepare("SELECT id FROM password_resets WHERE email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
            $stmt->execute([$correo, $codigo, $tipo]);
            $reset = $stmt->fetch();

            if (!$reset) {
                echo json_encode(['success' => false, 'error' => 'Código inválido o expirado.']);
                break;
            }

            if ($onlyCheck) {
                echo json_encode(['success' => true]);
                break;
            }

            if (empty($newPwd) || strlen($newPwd) < 6) {
                echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres.']);
                break;
            }

            $hashed = password_hash($newPwd, PASSWORD_DEFAULT);

            if ($tipo === 'admin') {
                $upd = $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE username = ?");
                $upd->execute([$hashed, $correo]);
            } else {
                $upd = $pdo->prepare("UPDATE ini_usuarios SET contrasena = ? WHERE correo = ?");
                $upd->execute([$hashed, $correo]);
            }

            // Si la cuenta no existe, no quemar el código ni reportar éxito
            if ($upd->rowCount() === 0) {
                $existe = $pdo->prepare($tipo === 'admin'
                    ? "SELECT 1 FROM admin_users WHERE username = ?"
                    : "SELECT 1 FROM ini_usuarios WHERE correo = ?");
                $existe->execute([$correo]);
                if (!$existe->fetch()) {
                    echo json_encode(['success' => false, 'error' => 'La cuenta no existe.']);
                    break;
                }
                // rowCount 0 pero la cuenta existe = misma contraseña; continuar normal
            }

            // Invalidar el código usado
            $pdo->prepare("UPDATE password_resets SET used = 1 WHERE id = ?")->execute([$reset['id']]);

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'set_recovery_email':
        // Superadmin o el propio admin puede registrar su correo de recuperación
        $session = requireAdmin($pdo);
        $data = json_decode(file_get_contents('php://input'), true);
        $targetUser = $data['username'] ?? '';
        $recoveryEmail = trim($data['recovery_email'] ?? '');

        if ($session['rol'] !== 'superadmin' && $session['username'] !== $targetUser) {
            echo json_encode(['success' => false, 'error' => 'Sin permisos.']);
            break;
        }
        try {
            $pdo->prepare("UPDATE admin_users SET recovery_email = ? WHERE username = ?")->execute([$recoveryEmail ?: null, $targetUser]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        break;

}
?>
