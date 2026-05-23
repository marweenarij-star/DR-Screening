<?php
/**
 * Mail Service
 * SMTP email sending using PHPMailer-style raw implementation
 */

namespace App\Services;

use App\Config\Config;

class MailService
{
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $fromEmail;
    private string $fromName;
    private string $encryption;

    public function __construct()
    {
        $config = Config::smtp();
        $this->host = $config['host'];
        $this->port = $config['port'];
        $this->username = $config['username'];
        $this->password = $config['password'];
        $this->fromEmail = $config['from_email'];
        $this->fromName = $config['from_name'];
        $this->encryption = $config['encryption'];
    }

    /**
     * Send email using SMTP
     */
    public function send(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
    {
        // If no SMTP credentials, log and return
        if (empty($this->username) || empty($this->password)) {
            error_log("Mail not sent (no SMTP credentials): To: {$to}, Subject: {$subject}");
            return false;
        }

        try {
            $socket = $this->connect();
            
            if (!$socket) {
                throw new \Exception('Could not connect to SMTP server');
            }

            // EHLO
            $this->sendCommand($socket, "EHLO localhost");
            
            // STARTTLS if needed
            if ($this->encryption === 'tls') {
                $this->sendCommand($socket, "STARTTLS");
                stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                $this->sendCommand($socket, "EHLO localhost");
            }

            // AUTH LOGIN
            $this->sendCommand($socket, "AUTH LOGIN");
            $this->sendCommand($socket, base64_encode($this->username));
            $this->sendCommand($socket, base64_encode($this->password));

            // FROM
            $this->sendCommand($socket, "MAIL FROM:<{$this->fromEmail}>");

            // TO
            $this->sendCommand($socket, "RCPT TO:<{$to}>");

            // DATA
            $this->sendCommand($socket, "DATA");

            // Headers and body
            $boundary = md5(time());
            $message = "From: {$this->fromName} <{$this->fromEmail}>\r\n";
            $message .= "To: {$to}\r\n";
            $message .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
            $message .= "MIME-Version: 1.0\r\n";
            $message .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";
            $message .= "\r\n";

            // Plain text part
            if ($textBody) {
                $message .= "--{$boundary}\r\n";
                $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
                $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
                $message .= chunk_split(base64_encode($textBody));
            }

            // HTML part
            $message .= "--{$boundary}\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\n";
            $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
            $message .= chunk_split(base64_encode($htmlBody));
            $message .= "--{$boundary}--\r\n";

            // Send message
            $message .= "\r\n.";
            $this->sendCommand($socket, $message);

            // QUIT
            $this->sendCommand($socket, "QUIT");

            fclose($socket);
            return true;

        } catch (\Exception $e) {
            error_log("Mail error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Connect to SMTP server
     */
    private function connect()
    {
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $protocol = $this->encryption === 'ssl' ? 'ssl://' : '';
        $socket = stream_socket_client(
            "{$protocol}{$this->host}:{$this->port}",
            $errno,
            $errstr,
            30,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if ($socket) {
            stream_set_timeout($socket, 30);
            fgets($socket, 512); // Read greeting
        }

        return $socket;
    }

    /**
     * Send SMTP command
     */
    private function sendCommand($socket, string $command): string
    {
        fwrite($socket, $command . "\r\n");
        $response = '';
        while ($line = fgets($socket, 512)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        return $response;
    }

    /**
     * Send urgent alert email
     */
    public function sendUrgentAlert(array $doctor, array $patient, array $exam): bool
    {
        $appConfig = Config::app();
        $examUrl = $appConfig['url'] . '/doctor/exams/' . $exam['id'];
        $gradeLabels = Config::gradeLabels();
        $gradeLabel = $gradeLabels[$exam['grade']] ?? 'Grade ' . $exam['grade'];

        $subject = "🚨 URGENT - Cas sévère détecté - {$patient['full_name']}";

        $htmlBody = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
                .alert-box { background: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 15px 0; }
                .btn { display: inline-block; background: #00897b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
                .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
                .label { font-weight: bold; color: #666; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>⚠️ Alerte Urgente</h1>
                    <p>Rétinopathie Diabétique Sévère Détectée</p>
                </div>
                <div class='content'>
                    <div class='alert-box'>
                        <strong>Un cas nécessitant une attention urgente a été détecté.</strong>
                    </div>
                    
                    <div class='details'>
                        <h3>Informations Patient</h3>
                        <p><span class='label'>Nom:</span> {$patient['full_name']}</p>
                        <p><span class='label'>N° Dossier:</span> {$patient['medical_record_number']}</p>
                        <p><span class='label'>Âge:</span> {$patient['age']} ans</p>
                    </div>
                    
                    <div class='details'>
                        <h3>Résultat de l'Examen</h3>
                        <p><span class='label'>Grade:</span> <strong style='color: #d32f2f;'>{$gradeLabel} (Grade {$exam['grade']})</strong></p>
                        <p><span class='label'>Confiance IA:</span> {$exam['confidence']}%</p>
                        <p><span class='label'>Date:</span> {$exam['created_at']}</p>
                    </div>
                    
                    <p>Veuillez examiner ce cas dès que possible.</p>
                    
                    <a href='{$examUrl}' class='btn'>Voir l'examen</a>
                </div>
            </div>
        </body>
        </html>
        ";

        $textBody = "
ALERTE URGENTE - Rétinopathie Diabétique Sévère

Patient: {$patient['full_name']}
N° Dossier: {$patient['medical_record_number']}
Grade: {$gradeLabel} (Grade {$exam['grade']})
Confiance: {$exam['confidence']}%

Lien vers l'examen: {$examUrl}
        ";

        return $this->send($doctor['email'], $subject, $htmlBody, $textBody);
    }
}
