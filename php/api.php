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
    // Solo se considera la subida MÁS RECIENTE de cada tipo de documento.
    // Si un documento fue rechazado y luego se volvió a subir y aceptar,
    // la subida anterior (rechazada) ya no debe contar para el estatus general.
    $stmt = $pdo->prepare("
        SELECT estado FROM reg_documentos d
        WHERE correo = ?
        AND id = (SELECT MAX(id) FROM reg_documentos d2 WHERE d2.correo = d.correo AND d2.tipo_doc = d.tipo_doc)
    ");
    $stmt->execute([$correo]);
    $estados = $stmt->fetchAll(PDO::FETCH_COLUMN);

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

    $stmtCurFolio = $pdo->prepare("SELECT folio FROM reg_inscripciones WHERE correo = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
    $stmtCurFolio->execute([$correo]);
    $curFolio = $stmtCurFolio->fetchColumn();
    if ($curFolio) {
        $pdo->prepare("UPDATE reg_inscripciones SET estatus = ? WHERE folio = ?")->execute([$newStatus, $curFolio]);
    }

    return $newStatus;
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

            // Traducimos los nombres de las columnas para que el JS los entienda siempre
            $workshops = $pdo->query("SELECT id, nombre as name, descripcion as description, precio as price, horario as hours, instructor, dependencia as dependency, modalidad as modality, cupo as capacity, cupo_actual, activo FROM cat_talleres")->fetchAll(PDO::FETCH_ASSOC);
            $visits = $pdo->query("SELECT id, nombre as name, descripcion as description, precio as price, horario as hours, instructor, dependencia as dependency, modalidad as modality, cupo as capacity, cupo_actual, activo FROM cat_visitas")->fetchAll(PDO::FETCH_ASSOC);
            $settings = $pdo->query("SELECT * FROM cat_ajustes")->fetchAll(PDO::FETCH_ASSOC);
            $codes = $pdo->query("SELECT * FROM cat_codigos")->fetchAll(PDO::FETCH_ASSOC);

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
                    GROUP_CONCAT(DISTINCT
                        CONCAT_WS(' - ', c.titulo, c.tipo, c.area, c.modalidad, c.revista)
                        ORDER BY c.id SEPARATOR ' | '
                    ) AS contribuciones
                FROM reg_inscripciones r
                LEFT JOIN reg_personal p        ON r.folio = p.folio
                LEFT JOIN ini_usuarios u         ON r.correo = u.correo
                LEFT JOIN reg_evento e           ON r.folio = e.folio
                LEFT JOIN reg_facturacion f      ON r.folio = f.folio
                LEFT JOIN reg_evento_detalles dt ON r.folio = dt.folio AND dt.tipo_item = 'taller'
                LEFT JOIN cat_talleres t         ON dt.item_id = t.id
                LEFT JOIN reg_evento_detalles dv ON r.folio = dv.folio AND dv.tipo_item = 'visita'
                LEFT JOIN cat_visitas v          ON dv.item_id = v.id
                LEFT JOIN reg_contribuciones c   ON r.folio = c.folio
                GROUP BY r.folio
                ORDER BY CAST(e.concepto AS UNSIGNED) ASC, r.fecha_inscripcion DESC
            ";
            $rows = $pdo->query($query)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'registrations' => $rows]);
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
            $stmtDocs = $pdo->prepare("SELECT id, folio, tipo_doc, archivo, fecha_subida, estado, comentario, revisado_por, fecha_revision FROM reg_documentos WHERE correo = ? ORDER BY tipo_doc ASC, fecha_subida DESC");
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

        try {
            $cupo_actual = isset($data['cupo_actual']) ? $data['cupo_actual'] : 0;
            $activo = isset($data['activo']) ? (int)$data['activo'] : 1;
            $stmt = $pdo->prepare("REPLACE INTO $table (id, nombre, descripcion, precio, horario, instructor, dependencia, modalidad, cupo, cupo_actual, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['id'], $data['name'], $data['description'], $data['price'],
                $data['hours'], $data['instructor'], $data['dependency'],
                $data['modality'], $data['capacity'], $cupo_actual, $activo
            ]);
            echo json_encode(['success' => true]);
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
        $code = $_GET['code'] ?? '';
        try {
            $stmt = $pdo->prepare("SELECT * FROM cat_codigos WHERE id = ?");
            $stmt->execute([$code]);
            $codeData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($codeData) {
                if ($codeData['usado'] == 1) {
                    echo json_encode(['success' => false, 'error' => 'Este código ya ha sido utilizado.']);
                } else {
                    echo json_encode(['success' => true, 'message' => 'Código válido.']);
                }
            } else {
                echo json_encode(['success' => false, 'error' => 'El código ingresado no existe.']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'mark_code_used':
        $code = $_GET['code'] ?? '';
        try {
            error_log("Intentando marcar código como usado: " . $code);
            // Solo marcar si aún no ha sido usado (usado = 0)
            $stmt = $pdo->prepare("UPDATE cat_codigos SET usado = 1 WHERE id = ? AND usado = 0");
            $stmt->execute([$code]);
            
            $count = $stmt->rowCount();
            error_log("Filas afectadas: " . $count);

            if ($count > 0) {
                echo json_encode(['success' => true, 'message' => 'Código invalidado correctamente.']);
            } else {
                echo json_encode(['success' => false, 'error' => 'El código ya estaba invalidado o no existe.']);
            }
        } catch (Exception $e) {
            error_log("ERROR en mark_code_used: " . $e->getMessage());
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

            $stmtDocs = $pdo->prepare("SELECT * FROM reg_documentos WHERE correo = ? ORDER BY tipo_doc ASC, fecha_subida DESC");
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
            $pdo->prepare("UPDATE reg_documentos SET estado=?, comentario=?, revisado_por=?, fecha_revision=? WHERE id=?")
                ->execute([$estado, $comentario, $revisado_por, $fechaRevision, $id]);

            $newStatus = recalcEstatusDocumentos($pdo, $correo);

            // Notificar por correo cuando el estatus general cambia a "aceptado"
            // (todos los documentos aprobados) o "denegado" (al menos uno rechazado).
            if ($newStatus !== $prevStatus && ($newStatus === 'aceptado' || $newStatus === 'denegado')) {
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

                    if ($newStatus === 'aceptado') {
                        $emailSubject = "Documentos Aprobados - ConCEI 2026 — Folio $folioPersonal";
                        $statusBanner = "<div style='background:#dcfce7; border-left:4px solid #16a34a; padding:14px 18px; border-radius:0 8px 8px 0; font-size:14px; color:#14532d;'><strong>¡Tus documentos han sido aprobados!</strong> Tu registro al 3er Congreso de Ciencias Exactas e Ingeniería &mdash; ConCEI 2026 ha quedado confirmado.</div>";
                    } else {
                        $emailSubject = "Documentos Rechazados - ConCEI 2026 — Folio $folioPersonal";
                        $statusBanner = "<div style='background:#fee2e2; border-left:4px solid #dc2626; padding:14px 18px; border-radius:0 8px 8px 0; font-size:14px; color:#7f1d1d;'><strong>Uno o más de tus documentos fueron rechazados.</strong> Por favor, ingresa nuevamente a la plataforma con tu correo y contraseña para revisar el motivo y volver a subir el documento correspondiente.</div>";
                    }

                    $emailBody = "
                    <div style='font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;'>
                        <div style='background: #1e3a8a; color: white; padding: 28px 30px;'>
                            <h1 style='margin: 0 0 6px; font-size: 22px;'>Congreso ConCEI 2026</h1>
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
            $stmt = $pdo->prepare("UPDATE reg_inscripciones SET estatus = ? WHERE folio = ?");
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
            $stmtDocs = $pdo->prepare("SELECT id, folio, tipo_doc, archivo, fecha_subida, estado, comentario, fecha_revision FROM reg_documentos WHERE correo = ? ORDER BY tipo_doc ASC, fecha_subida DESC");
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

            // Solo se permite volver a subir si el documento más reciente de este tipo
            // fue rechazado (o si aún no se ha subido ninguno de este tipo).
            $stmtLatest = $pdo->prepare("SELECT estado FROM reg_documentos WHERE correo = ? AND tipo_doc = ? ORDER BY fecha_subida DESC LIMIT 1");
            $stmtLatest->execute([$correo, $tipo_doc]);
            $latestEstado = $stmtLatest->fetchColumn();
            if ($latestEstado !== false && $latestEstado !== 'rechazado') {
                echo json_encode(['success' => false, 'error' => 'Este documento ya fue revisado y no puede modificarse.']); break;
            }

            $safeOriginal = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name']));
            $filename = time() . '_' . $tipo_doc . '_' . $safeOriginal;
            $uploadDir = dirname(__DIR__) . '/uploads/';
            if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
                echo json_encode(['success' => false, 'error' => 'No se pudo guardar el archivo']); break;
            }

            // Cada subida es un registro NUEVO en el historial, asociado al folio actual.
            $pdo->prepare("INSERT INTO reg_documentos (correo, folio, tipo_doc, archivo, fecha_subida, estado) VALUES (?,?,?,?,NOW(),'pendiente')")
                ->execute([$correo, $currentFolio, $tipo_doc, $filename]);
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
        $correo = $data['email'] ?? '';
        $pass = $data['password'] ?? '';
        $tel = $data['cellphone'] ?? '';

        $registerIdentifier = 'register:' . getClientIp();
        if (isRateLimited($pdo, $registerIdentifier, 10, 60)) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Demasiados intentos de registro. Intenta de nuevo más tarde.']);
            break;
        }
        recordFailedAttempt($pdo, $registerIdentifier);

        try {
            $hashedPassword = password_hash($pass, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO ini_usuarios (correo, contrasena, telefono) VALUES (?, ?, ?)");
            $stmt->execute([$correo, $hashedPassword, $tel]);
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
                echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
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
        $expira = date('Y-m-d H:i:s', strtotime('+15 minutes'));

        // Invalidar códigos anteriores
        $pdo->prepare("UPDATE password_resets SET used = 1 WHERE email = ? AND type = ?")->execute([$correo, $tipo]);

        $pdo->prepare("INSERT INTO password_resets (email, code, type, expires_at) VALUES (?, ?, ?, ?)")
            ->execute([$correo, $codigo, $tipo, $expira]);

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
                $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE username = ?")->execute([$hashed, $correo]);
            } else {
                $pdo->prepare("UPDATE ini_usuarios SET contrasena = ? WHERE correo = ?")->execute([$hashed, $correo]);
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
