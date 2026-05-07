<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../vendor/autoload.php';

/**
 * Función para enviar correos de confirmación usando Gmail SMTP
 */
function sendRegistrationEmail($to, $subject, $body) {
    $mail = new PHPMailer(true);

    try {
        // --- CONFIGURACIÓN DEL SERVIDOR GMAIL ---
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        
        // --- CREDENCIALES ---
        // El usuario debe poner su correo y su "App Password" de Google aquí
        $mail->Username   = 'TU_CORREO_GMAIL@gmail.com'; 
        $mail->Password   = 'TU_APP_PASSWORD_AQUI';      
        
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';

        // --- DESTINATARIO ---
        $mail->setFrom('TU_CORREO_GMAIL@gmail.com', 'Dr. Anabel - Congreso ConCEI');
        $mail->addAddress($to);

        // --- CONTENIDO ---
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("MAILER ERROR: No se pudo enviar el correo a $to. Detalle: {$mail->ErrorInfo}");
        return false;
    }
}
