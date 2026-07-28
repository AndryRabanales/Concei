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

    $correo = $_POST['email'] ?? '';

    // Bug 4 — Validar que el correo no esté vacío y tenga formato válido
    if (empty($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'Correo electrónico inválido o no proporcionado.']);
        exit;
    }

    // 0. Folio basado en el ID de cuenta del usuario (ini_usuarios.id), para que
    // el folio del comprobante, el asunto del correo y el ID de concepto que ve
    // el usuario/admin SIEMPRE coincidan (antes se usaba un consecutivo aparte
    // que se desfasaba si alguien creaba cuenta sin concretar su registro).
    $stmtAcc = $pdo->prepare("SELECT id FROM ini_usuarios WHERE correo = ?");
    $stmtAcc->execute([$correo]);
    $accountId = (int)$stmtAcc->fetchColumn();
    if ($accountId > 0) {
        $folio = 'CONCEI-2026-' . str_pad($accountId, 4, '0', STR_PAD_LEFT);
    } else {
        // Respaldo (registro sin cuenta, no debería ocurrir en el flujo normal):
        // consecutivo clásico con FOR UPDATE, seguro dentro de la transacción.
        $lastNum = $pdo->query("SELECT MAX(CAST(SUBSTRING_INDEX(folio, '-', -1) AS UNSIGNED)) FROM reg_inscripciones FOR UPDATE")->fetchColumn();
        $folio = 'CONCEI-2026-' . str_pad((int)$lastNum + 1, 4, '0', STR_PAD_LEFT);
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

    // Preservar contribuciones y facturación antes del DELETE CASCADE
    $prevContributions = [];
    $prevBilling = null;
    if ($esActualizacion) {
        $stmtOldContrib = $pdo->prepare("SELECT tipo, area, modalidad, titulo, revista FROM reg_contribuciones c JOIN reg_inscripciones i ON c.folio = i.folio WHERE i.correo = ?");
        $stmtOldContrib->execute([$correo]);
        $prevContributions = $stmtOldContrib->fetchAll(PDO::FETCH_ASSOC);

        $stmtOldBill = $pdo->prepare("SELECT f.razon, f.rfc, f.direccion, f.cp, f.ciudad, f.estado, f.correo AS bill_correo FROM reg_facturacion f JOIN reg_inscripciones i ON f.folio = i.folio WHERE i.correo = ? LIMIT 1");
        $stmtOldBill->execute([$correo]);
        $prevBilling = $stmtOldBill->fetch(PDO::FETCH_ASSOC) ?: null;
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

    // Bandera: actualización SIN ítems nuevos (evita el "movimiento fantasma"
    // de $0 que se generaba al deseleccionar y aun así finalizar).
    $sinItemsNuevos = false;

    // Seguridad: el total SIEMPRE se recalcula del lado servidor desde la BD.
    // Nunca se confía en el total_hidden del navegador porque el cliente
    // puede manipularlo (precios, descuento de taller gratis, etc.).
    if ($esActualizacion) {
        // Actualización: solo se cobran los ítems NUEVOS, sin descuento.
        $newWorkshops = array_diff(isset($_POST['workshop']) ? array_unique((array)$_POST['workshop']) : [], $prevWorkshopIds);
        $newVisits    = array_diff(isset($_POST['visit'])    ? array_unique((array)$_POST['visit'])    : [], $prevVisitIds);
        $sinItemsNuevos = empty($newWorkshops) && empty($newVisits);

        $extraTotal = 0.0;
        foreach ($newWorkshops as $wid) {
            $r = $pdo->prepare("SELECT precio FROM cat_talleres WHERE id = ?");
            $r->execute([$wid]);
            $extraTotal += (float)($r->fetchColumn() ?: 0);
        }
        foreach ($newVisits as $vid) {
            $r = $pdo->prepare("SELECT precio FROM cat_visitas WHERE id = ?");
            $r->execute([$vid]);
            $extraTotal += (float)($r->fetchColumn() ?: 0);
        }

        // Reconstruir total: base ya pagada ($0 en actualización) + nuevos ítems
        // (number_format sin separador de miles: "$1,000.00" rompe parseos posteriores)
        $total = '$' . number_format($extraTotal, 2, '.', '');
    } else {
        // Primer registro: precio base del tipo (cat_ajustes) + talleres/visitas.
        $stmtBase = $pdo->prepare("SELECT valor FROM cat_ajustes WHERE clave = ?");
        $stmtBase->execute([$tipo]);
        $serverTotal = (float)($stmtBase->fetchColumn() ?: 0); // code_access no está en cat_ajustes => base $0

        // Precios reales de los ítems seleccionados
        $itemPrices = [];
        foreach (array_unique((array)($_POST['workshop'] ?? [])) as $wid) {
            $r = $pdo->prepare("SELECT precio FROM cat_talleres WHERE id = ?");
            $r->execute([$wid]);
            $p = $r->fetchColumn();
            if ($p !== false) $itemPrices[] = (float)$p;
        }
        foreach (array_unique((array)($_POST['visit'] ?? [])) as $vid) {
            $r = $pdo->prepare("SELECT precio FROM cat_visitas WHERE id = ?");
            $r->execute([$vid]);
            $p = $r->fetchColumn();
            if ($p !== false) $itemPrices[] = (float)$p;
        }
        $serverTotal += array_sum($itemPrices);

        // Descuento "taller gratis" solo en primera compra: aplica a general,
        // student_external y code_access (misma regla que el frontend).
        // El ítem con costo más barato queda en $0. UADY no recibe descuento.
        $paidPrices = array_filter($itemPrices, function ($p) { return $p > 0; });
        if (in_array($tipo, ['general', 'student_external', 'code_access'], true) && count($paidPrices) > 0) {
            $serverTotal -= min($paidPrices); // el más barato es gratis
        }

        $total = '$' . number_format(max(0, $serverTotal), 2, '.', '');
    }

    $stmt3 = $pdo->prepare("INSERT INTO reg_evento (folio, tipo, total, concepto) VALUES (?, ?, ?, ?)");
    $stmt3->execute([$folio, $tipo, $total, $concepto]);

    // Historial de conceptos generados (append-only, sobrevive a la Lógica de Sobreescritura).
    // Red de seguridad: si es una actualización SIN ítems nuevos, NO se registra el
    // movimiento (evita el concepto fantasma de $0.00 en las vistas de usuario y admin).
    // Las compras previas se conservan igual (se reinsertan más abajo por la fusión).
    if (!$sinItemsNuevos) {
        $stmtConcepto = $pdo->prepare("INSERT INTO reg_conceptos_historial (correo, folio, concepto, total) VALUES (?, ?, ?, ?)");
        $stmtConcepto->execute([$correo, $folio, $concepto, $total]);
    }

    // 3.1 DETALLES DE EVENTO (Talleres y Visitas)
    // IMPORTANTE: como el DELETE por correo borró (CASCADE) los detalles del folio
    // anterior, aquí se reinsertan. Para NO perder compras previas cuando el
    // navegador manda datos viejos (p. ej. dos ventanas abiertas), se hace la UNIÓN
    // de lo que llega en el POST con lo que el usuario YA tenía comprado en la BD
    // (prevWorkshopIds/prevVisitIds). Así una compra hecha en otra ventana nunca se
    // pierde. La verificación de cupo solo se aplica a los ítems NUEVOS.
    $postWorkshops = array_map('strval', array_unique((array)($_POST['workshop'] ?? [])));
    $workshops = array_values(array_unique(array_merge($postWorkshops, array_map('strval', $prevWorkshopIds))));
    if (!empty($workshops)) {
        foreach ($workshops as $w_id) {
            if (in_array($w_id, $prevWorkshopIds)) continue; // ya comprado: conserva su lugar, no re-verificar
            // VERIFICAR CUPO EN TIEMPO REAL (Seguridad extra) solo para ítems nuevos
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
    $postVisits = array_map('strval', array_unique((array)($_POST['visit'] ?? [])));
    $visits = array_values(array_unique(array_merge($postVisits, array_map('strval', $prevVisitIds))));
    if (!empty($visits)) {
        foreach ($visits as $v_id) {
            if (in_array($v_id, $prevVisitIds)) continue; // ya comprada: conserva su lugar
            // VERIFICAR CUPO EN TIEMPO REAL solo para ítems nuevos
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
    $newContribInserted = false;
    for ($i = 1; $i <= 2; $i++) {
        if (!empty($_POST["contribTitle_$i"])) {
            $cTipo = $_POST["contribType_$i"] ?? '';
            $cArea = $_POST["contribArea_$i"] ?? '';
            $cMod = $_POST["contribModality_$i"] ?? '';
            $cTitulo = $_POST["contribTitle_$i"];

            $stmtC = $pdo->prepare("INSERT INTO reg_contribuciones (folio, tipo, area, modalidad, titulo, revista) VALUES (?, ?, ?, ?, ?, ?)");
            $stmtC->execute([$folio, $cTipo, $cArea, $cMod, $cTitulo, $revista]);
            $newContribInserted = true;
        }
    }
    // Si es actualización, restaurar SIEMPRE las contribuciones anteriores que no
    // vengan repetidas en el POST. Antes solo se restauraban cuando no llegaba
    // ninguna nueva, y si el usuario enviaba 1 nueva se perdían las previas.
    if ($esActualizacion && !empty($prevContributions)) {
        // Títulos ya insertados en esta pasada (normalizados) para no duplicar
        $titulosNuevos = [];
        for ($i = 1; $i <= 2; $i++) {
            if (!empty($_POST["contribTitle_$i"])) {
                $titulosNuevos[] = mb_strtolower(trim($_POST["contribTitle_$i"]));
            }
        }
        $stmtC = $pdo->prepare("INSERT INTO reg_contribuciones (folio, tipo, area, modalidad, titulo, revista) VALUES (?, ?, ?, ?, ?, ?)");
        foreach ($prevContributions as $pc) {
            if (in_array(mb_strtolower(trim($pc['titulo'])), $titulosNuevos, true)) continue; // ya reenviada
            $stmtC->execute([$folio, $pc['tipo'], $pc['area'], $pc['modalidad'], $pc['titulo'], $pc['revista']]);
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
    } elseif ($esActualizacion && $prevBilling) {
        // El usuario ya tenía datos fiscales y en esta actualización no envió
        // nuevos: restaurarlos para que el DELETE CASCADE no los pierda.
        $stmt4 = $pdo->prepare("INSERT INTO reg_facturacion (folio, razon, rfc, direccion, cp, ciudad, estado, correo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt4->execute([$folio, $prevBilling['razon'], $prevBilling['rfc'], $prevBilling['direccion'], $prevBilling['cp'], $prevBilling['ciudad'], $prevBilling['estado'], $prevBilling['bill_correo']]);
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

    // Si se usó un código, marcarlo como usado y registrar QUIÉN lo usó
    // (correo) y cuándo, para poder rastrearlo desde el panel de admin.
    if ($tipo === 'code_access') {
        $codigo = $_POST['specialCode'] ?? '';
        $stmtCode = $pdo->prepare("UPDATE cat_codigos SET usado = 1, usado_por = ?, fecha_uso = NOW() WHERE id = ?");
        $stmtCode->execute([$correo, $codigo]);
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
        // Se recolectan primero para aplicar el descuento de "taller gratis":
        // en la PRIMERA compra (general/externo/código), el ítem con costo más
        // barato se muestra en $0.00, igual que en la pantalla y el total real.
        $mailItems = [];
        if (!empty($workshops)) {
            foreach ($workshops as $w_id) {
                if ($esActualizacion && in_array($w_id, $prevWorkshopIds)) continue; // ya lo tenía
                $stmtTW = $pdo->prepare("SELECT nombre, precio FROM cat_talleres WHERE id = ?");
                $stmtTW->execute([$w_id]);
                $tw = $stmtTW->fetch();
                if ($tw) $mailItems[] = ['grupo' => 'taller', 'etiqueta' => 'Taller', 'nombre' => $tw['nombre'], 'precio' => (float)$tw['precio']];
            }
        }
        if (!empty($visits)) {
            foreach ($visits as $v_id) {
                if ($esActualizacion && in_array($v_id, $prevVisitIds)) continue; // ya la tenía
                $stmtVV = $pdo->prepare("SELECT nombre, precio FROM cat_visitas WHERE id = ?");
                $stmtVV->execute([$v_id]);
                $vv = $stmtVV->fetch();
                if ($vv) $mailItems[] = ['grupo' => 'visita', 'etiqueta' => 'Visita Industrial', 'nombre' => $vv['nombre'], 'precio' => (float)$vv['precio']];
            }
        }

        // Descuento "taller gratis": misma regla que el total del servidor.
        if (!$esActualizacion && in_array($tipo, ['general', 'student_external', 'code_access'], true)) {
            $cheapestIdx = null;
            foreach ($mailItems as $idx => $mi) {
                if ($mi['precio'] > 0 && ($cheapestIdx === null || $mi['precio'] < $mailItems[$cheapestIdx]['precio'])) {
                    $cheapestIdx = $idx;
                }
            }
            if ($cheapestIdx !== null) {
                $mailItems[$cheapestIdx]['precio'] = 0.0;
                $mailItems[$cheapestIdx]['nombre'] .= ' (incluido sin costo)';
            }
        }

        $talleresRows = '';
        $visitasRows = '';
        foreach ($mailItems as $mi) {
            $rowHtml = "<tr>
                <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0;'>{$mi['etiqueta']}: {$mi['nombre']}</td>
                <td style='padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align:right;'>\$" . number_format($mi['precio'], 2, '.', '') . "</td>
            </tr>";
            if ($mi['grupo'] === 'taller') $talleresRows .= $rowHtml;
            else $visitasRows .= $rowHtml;
        }

        // Contribuciones del autor
        $contribBlock = '';
        $stmtContribMail = $pdo->prepare("SELECT titulo, tipo, area, modalidad FROM reg_contribuciones WHERE folio = ?");
        $stmtContribMail->execute([$folio]);
        $contribsForMail = $stmtContribMail->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($contribsForMail)) {
            $contribItems = '';
            foreach ($contribsForMail as $c) {
                $contribItems .= "<li style='margin-bottom:8px;'><strong>" . htmlspecialchars($c['titulo']) . "</strong><br>
                    <small style='color:#64748b;'>" . htmlspecialchars($c['tipo']) . " · " . htmlspecialchars($c['area']) . " · " . htmlspecialchars($c['modalidad']) . "</small></li>";
            }
            $contribBlock = "
                <div style='margin: 20px 0;'>
                    <p style='margin: 0 0 10px; font-weight: bold; color: #1e3a8a; font-size: 14px;'>Contribuciones Registradas</p>
                    <ul style='margin:0; padding-left:18px; font-size:14px; color:#334155;'>$contribItems</ul>
                </div>";
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
            ? "Actualización de Registro ConCEI-3 — Folio $folio"
            : "Confirmación de Registro ConCEI-3 — Folio $folio";
        $emailBody = "
        <div style='font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;'>

            <div style='background: #1e3a8a; color: white; padding: 28px 30px;'>
                <h1 style='margin: 0 0 6px; font-size: 22px;'>Congreso ConCEI-3</h1>
                <p style='margin: 0; font-size: 14px; opacity: 0.85;'>Confirmación de Registro</p>
            </div>

            <div style='padding: 30px; color: #334155; line-height: 1.7;'>

                <p style='font-size: 16px;'>Estimado/a <strong style='color: #1e3a8a;'>$nombre $apellido</strong>,</p>
                <p>" . ($esActualizacion
                    ? "Hemos recibido una <strong>actualización</strong> a tu registro en el <strong>3er Congreso de Ciencias Exactas e Ingeniería — ConCEI-3</strong>. A continuación el resumen actualizado de tu compra:"
                    : "Gracias por registrarte en el <strong>3er Congreso de Ciencias Exactas e Ingeniería — ConCEI-3</strong>. Hemos recibido tu solicitud correctamente. A continuación encontrarás el resumen de tu registro:") . "</p>

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

                $contribBlock

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
                &copy; 2026 Congreso ConCEI-3 &mdash; Este es un correo automático, por favor no respondas a este mensaje.
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
