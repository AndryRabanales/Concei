<?php
header('Content-Type: application/json');
require_once 'config.php';

// Directorio para subida de archivos
$uploadDir = '../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

try {
    // Iniciar Transacción para asegurar que todas las ramas se guarden juntas
    $pdo->beginTransaction();

    // 0. Preparar datos base
    $folio = 'CONCEI-2026-' . rand(1000, 9999);
    $correo = $_POST['email'] ?? '';

    // NUEVO: Lógica de Sobreescritura (Para permitir un solo registro por correo)
    // Antes de borrar, debemos devolver los cupos que este usuario ya tenía ocupados
    $stmtOldItems = $pdo->prepare("SELECT item_id, tipo_item FROM reg_evento_detalles d JOIN reg_inscripciones i ON d.folio = i.folio WHERE i.correo = ?");
    $stmtOldItems->execute([$correo]);
    while ($old = $stmtOldItems->fetch()) {
        $tableType = ($old['tipo_item'] === 'taller') ? 'workshop' : 'visit';
        syncCapacity($pdo, $old['item_id'], $tableType);
    }

    $stmtDelete = $pdo->prepare("DELETE FROM reg_inscripciones WHERE correo = ?");
    $stmtDelete->execute([$correo]);
    
    // 1. RAMA PRINCIPAL (reg_inscripciones)
    $stmt1 = $pdo->prepare("INSERT INTO reg_inscripciones (folio, correo, estatus) VALUES (?, ?, 'pendiente')");
    $stmt1->execute([$folio, $correo]);

    // 2. RAMA PERSONAL (reg_personal)
    $nombre = $_POST['firstName'] ?? '';
    $apellido = $_POST['lastName'] ?? '';
    $institucion = $_POST['organization'] ?? '';
    $ciudad = $_POST['city'] ?? '';
    $estado = $_POST['state'] ?? '';
    $pais = $_POST['country'] ?? '';
    
    $stmt2 = $pdo->prepare("INSERT INTO reg_personal (folio, nombre, apellido, institucion, ciudad, estado, pais) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt2->execute([$folio, $nombre, $apellido, $institucion, $ciudad, $estado, $pais]);

    // 3. RAMA EVENTO (reg_evento)
    $tipo = $_POST['regType'] ?? '';
    $total = $_POST['total_hidden'] ?? '$0.00';
    $concepto = $_POST['concept_hidden'] ?? 'N/A';

    $stmt3 = $pdo->prepare("INSERT INTO reg_evento (folio, tipo, total, concepto) VALUES (?, ?, ?, ?)");
    $stmt3->execute([$folio, $tipo, $total, $concepto]);

    // 3.1 DETALLES DE EVENTO (Talleres y Visitas)
    if (isset($_POST['workshop'])) {
        $workshops = (array)$_POST['workshop'];
        foreach ($workshops as $w_id) {
            // VERIFICAR CUPO EN TIEMPO REAL (Seguridad extra)
            $stmtCheck = $pdo->prepare("SELECT nombre, cupo, cupo_actual FROM cat_talleres WHERE id = ? FOR UPDATE");
            $stmtCheck->execute([$w_id]);
            $item = $stmtCheck->fetch();
            
            if ($item) {
                $actual = syncCapacity($pdo, $w_id, 'workshop');
                if ($actual > (int)$item['cupo']) {
                    throw new Exception("El taller '{$item['nombre']}' ya no tiene cupo disponible.");
                }
            }
        }

        $stmtW = $pdo->prepare("INSERT INTO reg_evento_detalles (folio, item_id, tipo_item) VALUES (?, ?, 'taller')");
        foreach ($workshops as $w_id) {
            $stmtW->execute([$folio, $w_id]);
        }
    }
    if (isset($_POST['visit'])) {
        $visits = (array)$_POST['visit'];
        foreach ($visits as $v_id) {
            // VERIFICAR CUPO EN TIEMPO REAL
            $stmtCheck = $pdo->prepare("SELECT nombre, cupo, cupo_actual FROM cat_visitas WHERE id = ? FOR UPDATE");
            $stmtCheck->execute([$v_id]);
            $item = $stmtCheck->fetch();
            
            if ($item) {
                $actual = syncCapacity($pdo, $v_id, 'visit');
                if ($actual > (int)$item['cupo']) {
                    throw new Exception("La visita '{$item['nombre']}' ya no tiene cupo disponible.");
                }
            }
        }

        $stmtV = $pdo->prepare("INSERT INTO reg_evento_detalles (folio, item_id, tipo_item) VALUES (?, ?, 'visita')");
        foreach ($visits as $v_id) {
            $stmtV->execute([$folio, $v_id]);
        }
    }

    // 3.2 CONTRIBUCIONES DE AUTOR
    $revista = $_POST['journalPref'] ?? 'none';
    for ($i = 1; $i <= 3; $i++) {
        if (!empty($_POST["contribTitle_$i"])) {
            $cTipo = $_POST["contribType_$i"] ?? '';
            $cArea = $_POST["contribArea_$i"] ?? '';
            $cMod = $_POST["contribModality_$i"] ?? '';
            $cTitulo = $_POST["contribTitle_$i"];

            $stmtC = $pdo->prepare("INSERT INTO reg_contribuciones (folio, tipo, area, modalidad, titulo, revista) VALUES (?, ?, ?, ?, ?, ?)");
            $stmtC->execute([$folio, $cTipo, $cArea, $cMod, $cTitulo, $revista]);
        }
    }

    // 4. RAMA FACTURACIÓN (reg_facturacion) - Solo si es requerida
    if (isset($_POST['factura']) && $_POST['factura'] === 'required') {
        $razon = $_POST['razonSocial'] ?? '';
        $rfc = $_POST['rfc'] ?? '';
        $dir = $_POST['billingAddress'] ?? '';
        $cp = $_POST['zipCode'] ?? '';
        $fCiudad = $_POST['billingCity'] ?? '';
        $fEstado = $_POST['billingState'] ?? '';
        $fCorreo = $_POST['billingEmail'] ?? '';

        $stmt4 = $pdo->prepare("INSERT INTO reg_facturacion (folio, razon, rfc, direccion, cp, ciudad, estado, correo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt4->execute([$folio, $razon, $rfc, $dir, $cp, $fCiudad, $fEstado, $fCorreo]);
    }

    // 5. RAMA ARCHIVOS (reg_archivos)
    $archivoComprobante = '';
    $archivoIdentificacion = '';
    $archivoConstancia = '';

    if (isset($_FILES['paymentProof']) && $_FILES['paymentProof']['error'] === UPLOAD_ERR_OK) {
        $archivoComprobante = time() . '_proof_' . basename($_FILES['paymentProof']['name']);
        move_uploaded_file($_FILES['paymentProof']['tmp_name'], $uploadDir . $archivoComprobante);
    }
    if (isset($_FILES['uadyIdFile']) && $_FILES['uadyIdFile']['error'] === UPLOAD_ERR_OK) {
        $archivoIdentificacion = time() . '_id_' . basename($_FILES['uadyIdFile']['name']);
        move_uploaded_file($_FILES['uadyIdFile']['tmp_name'], $uploadDir . $archivoIdentificacion);
    }
    if (isset($_FILES['constanciaFile']) && $_FILES['constanciaFile']['error'] === UPLOAD_ERR_OK) {
        $archivoConstancia = time() . '_const_' . basename($_FILES['constanciaFile']['name']);
        move_uploaded_file($_FILES['constanciaFile']['tmp_name'], $uploadDir . $archivoConstancia);
    }

    $stmt5 = $pdo->prepare("INSERT INTO reg_archivos (folio, comprobante, identificacion, constancia) VALUES (?, ?, ?, ?)");
    $stmt5->execute([$folio, $archivoComprobante, $archivoIdentificacion, $archivoConstancia]);

    // Si se usó un código, marcarlo como usado
    if ($tipo === 'code_access') {
        $codigo = $_POST['specialCode'] ?? '';
        error_log("REGISTER.PHP: Intentando invalidar código: " . $codigo);
        $stmtCode = $pdo->prepare("UPDATE cat_codigos SET usado = 1 WHERE id = ?");
        $stmtCode->execute([$codigo]);
        error_log("REGISTER.PHP: Filas afectadas: " . $stmtCode->rowCount());
    }

    // Limpiar reserva temporal ya que el registro es definitivo
    $pdo->prepare("DELETE FROM reg_reservas_temp WHERE correo = ?")->execute([$correo]);
    
    // Sincronizar todos los items comprados para reflejar que pasaron de TEMP a REAL
    if (isset($workshops)) {
        foreach ($workshops as $w_id) syncCapacity($pdo, $w_id, 'workshop');
    }
    if (isset($visits)) {
        foreach ($visits as $v_id) syncCapacity($pdo, $v_id, 'visit');
    }

    // Confirmar todo
    $pdo->commit();

    // --- ENVÍO DE CORREO DE CONFIRMACIÓN ---
    try {
        require_once 'mailer.php';
        
        $emailSubject = "Confirmación de Registro: Folio $folio";
        $emailBody = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>
                <div style='background: #1e3a8a; color: white; padding: 20px; text-align: center;'>
                    <h1 style='margin: 0; font-size: 24px;'>¡Registro Recibido!</h1>
                </div>
                <div style='padding: 30px; line-height: 1.6; color: #334155;'>
                    <p>Hola <strong style='color: #1e3a8a;'>$nombre $apellido</strong>,</p>
                    <p>Gracias por registrarte en el <strong>Congreso ConCEI 2026</strong>. Hemos recibido tu solicitud correctamente.</p>
                    
                    <div style='background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;'>
                        <p style='margin: 0 0 10px 0; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;'>Resumen de tu Registro:</p>
                        <table style='width: 100%; font-size: 14px;'>
                            <tr><td style='padding: 5px 0;'><strong>Folio:</strong></td><td>$folio</td></tr>
                            <tr><td style='padding: 5px 0;'><strong>Concepto:</strong></td><td>$concepto</td></tr>
                            <tr><td style='padding: 5px 0;'><strong>Total:</strong></td><td>$total</td></tr>
                            <tr><td style='padding: 5px 0;'><strong>Estatus:</strong></td><td><span style='background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: bold;'>PENDIENTE</span></td></tr>
                        </table>
                    </div>
                    
                    <p>Nuestro equipo revisará tu comprobante de pago y documentación. Te notificaremos por este mismo medio en cuanto tu registro sea <strong>Aceptado</strong>.</p>
                    
                    <p style='margin-top: 30px; font-size: 0.85rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px;'>
                        <strong>Nota:</strong> Este es un correo automático. Por favor no respondas directamente si tienes dudas técnicas, contacta al soporte oficial.
                    </p>
                </div>
                <div style='background: #f1f5f9; padding: 15px; text-align: center; font-size: 0.75rem; color: #94a3b8;'>
                    &copy; 2026 Dr. Anabel - ConCEI | Congreso Internacional de Ingeniería
                </div>
            </div>
        ";
        
        sendRegistrationEmail($correo, $emailSubject, $emailBody);
    } catch (Exception $eMail) {
        error_log("Error crítico al intentar enviar correo: " . $eMail->getMessage());
    }

    echo json_encode([
        'success' => true,
        'folio' => $folio,
        'message' => 'Registro completado y correo enviado (v9)'
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>
