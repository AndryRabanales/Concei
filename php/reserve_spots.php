<?php
header('Content-Type: application/json');
require_once 'config.php';

$data = json_decode(file_get_contents('php://input'), true);
$email = $data['email'] ?? '';
$newWorkshops = $data['workshops'] ?? [];
$newVisits = $data['visits'] ?? [];

if (empty($email) || $email === 'No proporcionado') {
    echo json_encode(['success' => false, 'error' => 'Debe iniciar sesión o proporcionar un correo válido.']);
    exit;
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT items_json FROM reg_reservas_temp WHERE correo = ?");
    $stmt->execute([$email]);
    $prev = $stmt->fetch();
    
    $prevItems = ['workshops' => [], 'visits' => []];
    if ($prev && !empty($prev['items_json'])) {
        $decoded = json_decode($prev['items_json'], true);
        if (is_array($decoded)) {
            if (isset($decoded['workshops']) && is_array($decoded['workshops'])) $prevItems['workshops'] = $decoded['workshops'];
            if (isset($decoded['visits']) && is_array($decoded['visits'])) $prevItems['visits'] = $decoded['visits'];
        }
    }

    // 2. Liberar cupos previos para permitir re-selección
    foreach ($prevItems['workshops'] as $w_id) {
        // Al liberar, simplemente restamos y luego sincronizamos para asegurar exactitud
        $pdo->prepare("UPDATE cat_talleres SET cupo_actual = GREATEST(0, cupo_actual - 1) WHERE id = ?")->execute([$w_id]);
        syncCapacity($pdo, $w_id, 'workshop');
    }
    foreach ($prevItems['visits'] as $v_id) {
        $pdo->prepare("UPDATE cat_visitas SET cupo_actual = GREATEST(0, cupo_actual - 1) WHERE id = ?")->execute([$v_id]);
        syncCapacity($pdo, $v_id, 'visit');
    }

    // 3. Guardar el nuevo estado de reserva TEMPORALMENTE para que syncCapacity lo vea
    $newItemsJson = json_encode(['workshops' => $newWorkshops, 'visits' => $newVisits]);
    $stmtSave = $pdo->prepare("REPLACE INTO reg_reservas_temp (correo, items_json) VALUES (?, ?)");
    $stmtSave->execute([$email, $newItemsJson]);

    // 4. Verificar nuevos cupos (Ahora syncCapacity contará la reserva que acabamos de hacer)
    foreach ($newWorkshops as $w_id) {
        $stmt = $pdo->prepare("SELECT nombre, cupo FROM cat_talleres WHERE id = ? FOR UPDATE");
        $stmt->execute([$w_id]);
        $item = $stmt->fetch();
        
        if ($item) {
            $actual = syncCapacity($pdo, $w_id, 'workshop');
            if ($actual > (int)$item['cupo']) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                echo json_encode([
                    'success' => false, 
                    'error' => "El taller '{$item['nombre']}' ya está lleno. Por favor, selecciona otro.", 
                    'full_id' => $w_id,
                    'name' => $item['nombre'],
                    'current' => $actual,
                    'max' => $item['cupo']
                ]);
                exit;
            }
        }
    }

    foreach ($newVisits as $v_id) {
        $stmt = $pdo->prepare("SELECT nombre, cupo FROM cat_visitas WHERE id = ? FOR UPDATE");
        $stmt->execute([$v_id]);
        $item = $stmt->fetch();
        if ($item) {
            $actual = syncCapacity($pdo, $v_id, 'visit');
            if ($actual > (int)$item['cupo']) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                echo json_encode([
                    'success' => false, 
                    'error' => "La visita '{$item['nombre']}' ya está lleno. Por favor, selecciona otro.", 
                    'full_id' => $v_id,
                    'name' => $item['nombre'],
                    'current' => $actual,
                    'max' => $item['cupo']
                ]);
                exit;
            }
        }
    }

    $pdo->commit();
    
    // Devolver éxito con el conteo actualizado si es posible (opcional pero útil)
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
