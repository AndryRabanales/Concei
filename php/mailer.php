<?php

/**
 * Función para enviar correos de confirmación usando Microsoft Graph API (CGTIC UADY)
 */
function sendRegistrationEmail($to, $subject, $body) {
    // Parámetros de la app registration necesarios para la autenticación
    // REEMPLAZAR CON LOS VALORES PROPORCIONADOS POR LA CGTIC
    $tenant_id = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX";
    $client_id = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX";
    $client_secret = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    // Variables de correo
    $MailFrom = "remitente@correo.uady.mx"; // REEMPLAZAR CON TU CORREO INSTITUCIONAL EMISOR
    $MailTo = $to;

    // Cuerpo de la solicitud para obtener el token de acceso
    $tokenBody = [
       'grant_type' => 'client_credentials',
       'scope' => 'https://graph.microsoft.com/.default',
       'client_id' => $client_id,
       'client_secret' => $client_secret
    ];

    try {
        // Solicita el token de acceso
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://login.microsoftonline.com/$tenant_id/oauth2/v2.0/token");
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($tokenBody));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $tokenResponse = curl_exec($ch);
        
        if (curl_errno($ch)) {
            throw new Exception("CURL error: " . curl_error($ch));
        }
        curl_close($ch);

        $tokenResponse = json_decode($tokenResponse, true);
        if (!isset($tokenResponse['access_token'])) {
            throw new Exception("No se pudo obtener el token de acceso. Respuesta: " . json_encode($tokenResponse));
        }
    } catch (Exception $e) {
        error_log("Error al obtener el token de Microsoft Graph: " . $e->getMessage());
        return false;
    }

    // Encabezados para las solicitudes Graph
    $headers = [
       "Authorization: Bearer " . $tokenResponse['access_token'],
       "Content-type: application/json"
    ];

    // URL para enviar el correo
    $URLsend = "https://graph.microsoft.com/v1.0/users/$MailFrom/sendMail";

    // Cuerpo del correo en JSON
    $BodyJsonsend = json_encode([
       'message' => [
          'subject' => $subject,
          'body' => [
             'contentType' => 'HTML',
             'content' => $body
          ],
          'toRecipients' => [
             [
                'emailAddress' => [
                   'address' => $MailTo
                ]
             ]
          ]
       ],
       'saveToSentItems' => true
    ]);

    // Envío del correo
    try {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $URLsend);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $BodyJsonsend);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $sendMailResponse = curl_exec($ch);

        if (curl_errno($ch)) {
            throw new Exception("CURL error: " . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE); // Check HTTP response code
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            error_log("Correo enviado exitosamente a $to a través de Microsoft Graph API");
            return true;
        } else {
            throw new Exception("La API respondió con el código HTTP: $httpCode. Respuesta: $sendMailResponse");
        }
    } catch (Exception $e) {
        error_log("Error al enviar el correo a $to via Microsoft Graph: " . $e->getMessage());
        return false;
    }
}
