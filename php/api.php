<?php
header('Content-Type: application/json');
require_once 'config.php';

error_reporting(E_ALL);
ini_set('display_errors', 0);

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_initial_data':
        try {
            // Limpiar reservas antiguas antes de cargar
            $pdo->prepare("DELETE FROM reg_reservas_temp WHERE updated_at < NOW() - INTERVAL 30 MINUTE")->execute();

            // Traducimos los nombres de las columnas para que el JS los entienda siempre
            $workshops = $pdo->query("SELECT id, nombre as name, descripcion as description, precio as price, horario as hours, instructor, dependencia as dependency, modalidad as modality, cupo as capacity, cupo_actual FROM cat_talleres")->fetchAll(PDO::FETCH_ASSOC);
            $visits = $pdo->query("SELECT id, nombre as name, descripcion as description, precio as price, horario as hours, instructor, dependencia as dependency, modalidad as modality, cupo as capacity, cupo_actual FROM cat_visitas")->fetchAll(PDO::FETCH_ASSOC);
            $settings = $pdo->query("SELECT * FROM cat_ajustes")->fetchAll(PDO::FETCH_ASSOC);
            $codes = $pdo->query("SELECT * FROM cat_codigos")->fetchAll(PDO::FETCH_ASSOC);

            $email = $_GET['email'] ?? '';
            $purchased = [];
            $userInfo = null;

            if ($email) {
                // Get purchased items
                $stmtP = $pdo->prepare("
                    SELECT d.item_id 
                    FROM reg_evento_detalles d 
                    JOIN reg_inscripciones i ON d.folio = i.folio 
                    WHERE i.correo = ?
                ");
                $stmtP->execute([$email]);
                $purchased = $stmtP->fetchAll(PDO::FETCH_COLUMN);

                // Get personal info
                $stmtU = $pdo->prepare("
                    SELECT p.*, e.tipo as regType 
                    FROM reg_personal p 
                    JOIN reg_inscripciones i ON p.folio = i.folio 
                    JOIN reg_evento e ON i.folio = e.folio
                    WHERE i.correo = ?
                ");
                $stmtU->execute([$email]);
                $userInfo = $stmtU->fetch(PDO::FETCH_ASSOC);
            }

            echo json_encode([
                'success' => true,
                'workshop' => $workshops,
                'visit' => $visits,
                'prices' => $prices,
                'code' => $codes,
                'purchased' => $purchased,
                'userInfo' => $userInfo
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'check_capacity':
        $id = $_GET['id'] ?? '';
        $type = $_GET['type'] ?? 'workshop';
        $table = ($type === 'workshop') ? 'cat_talleres' : 'cat_visitas';
        
        try {
            // Sincronizar antes de informar
            syncCapacity($pdo, $id, $type);

            $stmt = $pdo->prepare("SELECT nombre, cupo, cupo_actual FROM $table WHERE id = ?");
            $stmt->execute([$id]);
            $item = $stmt->fetch();
            if ($item) {
                $isFull = (int)$item['cupo_actual'] >= (int)$item['cupo'];
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

    case 'get_registrations':
        try {
            $query = "
                SELECT 
                    r.folio, r.correo as email, r.estatus as status, r.fecha_inscripcion as date_registered,
                    CONCAT(p.nombre, ' ', p.apellido) as fullName,
                    d.tipo as regType, d.total, d.concepto as concept,
                    a.comprobante, a.identificacion, a.constancia
                FROM reg_inscripciones r
                JOIN reg_personal p ON r.folio = p.folio
                JOIN reg_evento d ON r.folio = d.folio
                LEFT JOIN reg_archivos a ON r.folio = a.folio
                ORDER BY r.fecha_inscripcion DESC
            ";
            $registrations = $pdo->query($query)->fetchAll();
            echo json_encode(['success' => true, 'registrations' => $registrations]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'update_settings':
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
        $data = json_decode(file_get_contents('php://input'), true);
        $type = $_GET['type'] ?? 'workshop';
        $table = ($type === 'workshop') ? 'cat_talleres' : 'cat_visitas';

        try {
            $cupo_actual = isset($data['cupo_actual']) ? $data['cupo_actual'] : 0;
            $stmt = $pdo->prepare("REPLACE INTO $table (id, nombre, descripcion, precio, horario, instructor, dependencia, modalidad, cupo, cupo_actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['id'], $data['name'], $data['description'], $data['price'],
                $data['hours'], $data['instructor'], $data['dependency'],
                $data['modality'], $data['capacity'], $cupo_actual
            ]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_item':
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

    case 'update_reg_status':
        $data = json_decode(file_get_contents('php://input'), true);
        try {
            $stmt = $pdo->prepare("UPDATE reg_inscripciones SET estatus = ? WHERE folio = ?");
            $stmt->execute([$data['status'], $data['folio']]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'delete_reg':
        $folio = $_GET['folio'] ?? '';
        try {
            // Eliminar de la tabla principal (el resto debe caer por CASCADE)
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

        try {
            $hashedPassword = password_hash($pass, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO ini_usuarios (correo, contrasena, telefono) VALUES (?, ?, ?)");
            $stmt->execute([$correo, $hashedPassword, $tel]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'login_user':
        $data = json_decode(file_get_contents('php://input'), true);
        $correo = $data['email'] ?? '';
        $pass = $data['password'] ?? '';

        try {
            $stmt = $pdo->prepare("SELECT * FROM ini_usuarios WHERE correo = ?");
            $stmt->execute([$correo]);
            $user = $stmt->fetch();

            if ($user && password_verify($pass, $user['contrasena'])) {
                echo json_encode([
                    'success' => true,
                    'user' => [
                        'email' => $user['correo'],
                        'cellphone' => $user['telefono']
                    ]
                ]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Error: ' . $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        break;

}
?>
