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

    // 0. Preparar datos base — folio secuencial usando FOR UPDATE (seguro dentro de transacción)
    $lastNum = $pdo->query("SELECT MAX(CAST(SUBSTRING_INDEX(folio, '-', -1) AS UNSIGNED)) FROM reg_inscripciones FOR UPDATE")->fetchColumn();
    $nextNum = (int)$lastNum + 1;
    $folio   = 'CONCEI-2026-' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);
    $correo = $_POST['email'] ?? '';

    // Bug 4 — Validar que el correo no esté vacío y tenga formato válido
    if (empty($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'Correo electrónico inválido o no proporcionado.']);
        exit;
    }

    // Detectar si es primera vez o actualización
    $stmtExiste = $pdo->prepare("SELECT COUNT(*) FROM reg_inscripciones WHERE correo = ?");
    $stmtExiste->execute([$correo]);
    $esActualizacion = (int)$stmtExiste->fetchColumn() > 0;

    // NUEVO: Lógica de Sobreescritura (Para permitir un solo registro por correo)
    // Antes de borrar, debemos devolver los cupos que este usuario ya tenía ocupados
    // También guardamos los IDs previos para saber qué es nuevo en el correo
    $prevWorkshopIds = [];
    $prevVisitIds    = [];
    $stmtOldItems = $pdo->prepare("SELECT item_id, tipo_item FROM reg_evento_detalles d JOIN reg_inscripciones i ON d.folio = i.folio WHERE i.correo = ?");
    $stmtOldItems->execute([$correo]);
    while ($old = $stmtOldItems->fetch()) {
        $tableType = ($old['tipo_item'] === 'taller') ? 'workshop' : 'visit';
        syncCapacity($pdo, $old['item_id'], $tableType);
        if ($old['tipo_item'] === 'taller') $prevWorkshopIds[] = $old['item_id'];
        else                                $prevVisitIds[]    = $old['item_id'];
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

    // Historial de conceptos generados (append-only, sobrevive a la Lógica de Sobreescritura)
    $stmtConcepto = $pdo->prepare("INSERT INTO reg_conceptos_historial (correo, folio, concepto, total) VALUES (?, ?, ?, ?)");
    $stmtConcepto->execute([$correo, $folio, $concepto, $total]);

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
                $limit = (int)$item['cupo'];
                if ($tipo === 'general') {
                    $limit += 2;
                }
                if ($actual > $limit) {
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
    for ($i = 1; $i <= 2; $i++) {
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

    // 5. RAMA ARCHIVOS (reg_documentos) — historial append-only por correo,
    // cada archivo subido se guarda como un registro nuevo, nunca se sobreescribe.
    $stmtDoc = $pdo->prepare("INSERT INTO reg_documentos (correo, folio, tipo_doc, archivo, fecha_subida, estado) VALUES (?, ?, ?, ?, NOW(), 'pendiente')");

    if (isset($_FILES['paymentProof']) && $_FILES['paymentProof']['error'] === UPLOAD_ERR_OK) {
        $newProof = time() . '_proof_' . basename($_FILES['paymentProof']['name']);
        if (move_uploaded_file($_FILES['paymentProof']['tmp_name'], $uploadDir . $newProof)) {
            $stmtDoc->execute([$correo, $folio, 'comprobante', $newProof]);
        }
    }
    if (isset($_FILES['uadyIdFile']) && $_FILES['uadyIdFile']['error'] === UPLOAD_ERR_OK) {
        $newId = time() . '_id_' . basename($_FILES['uadyIdFile']['name']);
        if (move_uploaded_file($_FILES['uadyIdFile']['tmp_name'], $uploadDir . $newId)) {
            $stmtDoc->execute([$correo, $folio, 'identificacion', $newId]);
        }
    }
    if (isset($_FILES['constanciaFile']) && $_FILES['constanciaFile']['error'] === UPLOAD_ERR_OK) {
        $newConst = time() . '_const_' . basename($_FILES['constanciaFile']['name']);
        if (move_uploaded_file($_FILES['constanciaFile']['tmp_name'], $uploadDir . $newConst)) {
            $stmtDoc->execute([$correo, $folio, 'constancia', $newConst]);
        }
    }

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

        // Etiqueta del tipo de registro
        $tipoLabels = [
            'general'          => 'Público General / Profesional',
            'student_external' => 'Estudiante Externo',
            'student_uady'     => 'Estudiante UADY',
            'code_access'      => 'Acceso por Código / Convenio',
        ];
        $tipoLabel = $tipoLabels[$tipo] ?? $tipo;

        // Para primera compra: todos los items
        // Para actualización: solo los items NUEVOS (no estaban antes)
        $talleresRows = '';
        if (!empty($workshops)) {
            foreach ($workshops as $w_id) {
                if ($esActualizacion && in_array($w_id, $prevWorkshopIds)) continue; // ya lo tenía
                $stmtTW = $pdo->prepare("SELECT nombre, precio FROM cat_talleres WHERE id = ?");
                $stmtTW->execute([$w_id]);
                $tw = $stmtTW->fetch();
                if ($tw) {
                    $talleresRows .= "<tr>
                        <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0;'>Taller: {$tw['nombre']}</td>
                        <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align:right;'>\${$tw['precio']}</td>
                    </tr>";
                }
            }
        }

        $visitasRows = '';
        if (!empty($visits)) {
            foreach ($visits as $v_id) {
                if ($esActualizacion && in_array($v_id, $prevVisitIds)) continue; // ya la tenía
                $stmtVV = $pdo->prepare("SELECT nombre, precio FROM cat_visitas WHERE id = ?");
                $stmtVV->execute([$v_id]);
                $vv = $stmtVV->fetch();
                if ($vv) {
                    $visitasRows .= "<tr>
                        <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0;'>Visita Industrial: {$vv['nombre']}</td>
                        <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align:right;'>\${$vv['precio']}</td>
                    </tr>";
                }
            }
        }

        // Bug 1 — Obtener precio base del tipo de registro desde cat_ajustes
        $stmtBasePrice = $pdo->prepare("SELECT valor FROM cat_ajustes WHERE clave = ?");
        $stmtBasePrice->execute([$tipo]);
        $basePrice = (float)($stmtBasePrice->fetchColumn() ?: 0);
        $basePriceFormatted = '$' . number_format($basePrice, 2);

        // Fila de tipo de registro (solo en primera compra)
        $tipoRow = !$esActualizacion ? "<tr>
            <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0;'>Registro — $tipoLabel</td>
            <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align:right;'>$basePriceFormatted</td>
        </tr>" : '';

        $emailSubject = $esActualizacion
            ? "Actualización de Registro ConCEI 2026 — Folio $folio"
            : "Confirmación de Registro ConCEI 2026 — Folio $folio";
        $emailBody = "
        <div style='font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;'>

            <div style='background: #1e3a8a; color: white; padding: 28px 30px;'>
                <h1 style='margin: 0 0 6px; font-size: 22px;'>Congreso ConCEI 2026</h1>
                <p style='margin: 0; font-size: 14px; opacity: 0.85;'>Confirmación de Registro</p>
            </div>

            <div style='padding: 30px; color: #334155; line-height: 1.7;'>

                <p style='font-size: 16px;'>Estimado/a <strong style='color: #1e3a8a;'>$nombre $apellido</strong>,</p>
                <p>" . ($esActualizacion
                    ? "Hemos recibido una <strong>actualización</strong> a tu registro en el <strong>3er Congreso de Ciencias Exactas e Ingeniería — ConCEI 2026</strong>. A continuación el resumen actualizado de tu compra:"
                    : "Gracias por registrarte en el <strong>3er Congreso de Ciencias Exactas e Ingeniería — ConCEI 2026</strong>. Hemos recibido tu solicitud correctamente. A continuación encontrarás el resumen de tu registro:") . "</p>

                <!-- Datos personales -->
                <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;'>
                    <p style='margin: 0 0 12px; font-weight: bold; color: #1e3a8a; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;'>Datos del Participante</p>
                    <table style='width: 100%; font-size: 14px; border-collapse: collapse;'>
                        <tr><td style='padding: 5px 0; color: #64748b; width: 40%;'>Nombre completo</td><td><strong>$nombre $apellido</strong></td></tr>
                        <tr><td style='padding: 5px 0; color: #64748b;'>Correo</td><td>$correo</td></tr>
                        <tr><td style='padding: 5px 0; color: #64748b;'>Institución</td><td>$institucion</td></tr>
                        <tr><td style='padding: 5px 0; color: #64748b;'>Procedencia</td><td>$ciudad, $estado, $pais</td></tr>
                    </table>
                </div>

                <!-- Resumen de compra -->
                <div style='margin: 20px 0;'>
                    <p style='margin: 0 0 10px; font-weight: bold; color: #1e3a8a; font-size: 14px;'>Resumen de Compra</p>
                    <table style='width: 100%; font-size: 14px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;'>
                        <thead>
                            <tr style='background: #1e3a8a; color: white;'>
                                <th style='padding: 10px; text-align: left;'>Concepto</th>
                                <th style='padding: 10px; text-align: right;'>Importe</th>
                            </tr>
                        </thead>
                        <tbody>
                            $tipoRow
                            $talleresRows
                            $visitasRows
                        </tbody>
                        <tfoot>
                            <tr style='background: #f1f5f9;'>
                                <td style='padding: 10px; font-weight: bold;'>Total</td>
                                <td style='padding: 10px; font-weight: bold; text-align:right; color: #1e3a8a;'>$total</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Folio y concepto -->
                <div style='background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 14px;'>
                    <p style='margin: 0 0 6px;'><strong>Folio de registro:</strong> <span style='color: #1e3a8a; font-family: monospace; font-size: 15px;'>$folio</span></p>
                    <p style='margin: 0;'><strong>Concepto de pago:</strong> <span style='font-family: monospace;'>$concepto</span></p>
                </div>

                <!-- Nota -->
                <div style='background: #fefce8; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 0 8px 8px 0; font-size: 14px; color: #78350f;'>
                    <strong>Nota:</strong> Para consultar el estado de tus documentos, ingresa a la plataforma con tu correo y contraseña. Ahí podrás ver si tus documentos han sido aceptados, están en revisión o requieren corrección.
                </div>

            </div>

            <div style='background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;'>
                &copy; 2026 Congreso ConCEI 2026 &mdash; Este es un correo automático, por favor no respondas a este mensaje.
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
