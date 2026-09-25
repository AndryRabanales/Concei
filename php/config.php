<?php
// Configuración de la base de datos (XAMPP)
$host = 'localhost';
$dbname = 'concei_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    /**
     * Elimina las reservas temporales expiradas (> 30 min) y RECALCULA el cupo
     * de cada taller/visita que tenían apartado. Antes solo se borraban las
     * filas y el contador (cupo_actual) se quedaba con el valor viejo, por lo
     * que un taller podía verse "lleno" con reservas que ya no existían.
     * Devuelve la cantidad de reservas liberadas.
     */
    function purgeExpiredReservations($pdo) {
        return releaseReservations($pdo, "updated_at < NOW() - INTERVAL 30 MINUTE");
    }

    /**
     * Libera las reservas temporales que cumplan la condición SQL dada (por
     * defecto todas) y sincroniza los cupos afectados.
     */
    function releaseReservations($pdo, $whereSql = '1=1') {
        $rows = $pdo->query("SELECT items_json FROM reg_reservas_temp WHERE $whereSql")->fetchAll();
        if (!$rows) return 0;
        $pdo->exec("DELETE FROM reg_reservas_temp WHERE $whereSql");
        $ws = []; $vs = [];
        foreach ($rows as $r) {
            $it = json_decode($r['items_json'], true) ?: [];
            foreach ($it['workshops'] ?? [] as $id) $ws[$id] = true;
            foreach ($it['visits'] ?? [] as $id) $vs[$id] = true;
        }
        foreach (array_keys($ws) as $id) syncCapacity($pdo, $id, 'workshop');
        foreach (array_keys($vs) as $id) syncCapacity($pdo, $id, 'visit');
        return count($rows);
    }

    /**
     * Sincroniza el cupo_actual de un taller o visita basándose en:
     * 1. Registros confirmados (reg_evento_detalles)
     * 2. Reservas temporales activas (reg_reservas_temp, < 30 mins)
     */
    function syncCapacity($pdo, $itemId, $type) {
        $table = ($type === 'workshop') ? 'cat_talleres' : 'cat_visitas';
        $typeStr = ($type === 'workshop') ? 'taller' : 'visita';

        // 1. Limpieza de reservas temporales antiguas (> 30 min)
        $pdo->prepare("DELETE FROM reg_reservas_temp WHERE updated_at < NOW() - INTERVAL 30 MINUTE")->execute();

        // 2. Contar correos únicos (Confirmados + Temporales)
        // Esto evita que un usuario que está en proceso de re-registro se cuente dos veces.
        $sql = "
            SELECT COUNT(DISTINCT email) as total FROM (
                SELECT i.correo as email 
                FROM reg_evento_detalles d 
                JOIN reg_inscripciones i ON d.folio = i.folio 
                WHERE d.item_id = :id AND d.tipo_item = :type
                UNION
                SELECT correo as email 
                FROM reg_reservas_temp 
                WHERE JSON_CONTAINS(items_json, JSON_QUOTE(:id), '$.workshops') 
                   OR JSON_CONTAINS(items_json, JSON_QUOTE(:id), '$.visits')
            ) as combined
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $itemId, 'type' => $typeStr]);
        $totalReal = (int)$stmt->fetch()['total'];

        // 3. Actualizar el contador en la tabla de catálogo
        $pdo->prepare("UPDATE $table SET cupo_actual = ? WHERE id = ?")->execute([$totalReal, $itemId]);

        return $totalReal;
    }
} catch (PDOException $e) {
    die("Error de conexión: " . $e->getMessage());
}
?>
