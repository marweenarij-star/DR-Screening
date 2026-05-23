<?php
/**
 * WebSocket Service Client
 * Sends events to Node.js WebSocket server
 */

namespace App\Services;

use App\Config\Config;

class WebSocketService
{
    private string $internalUrl;
    private string $secret;

    public function __construct()
    {
        $config = Config::websocket();
        $this->internalUrl = rtrim($config['internal_url'], '/');
        $this->secret = $config['internal_secret'] ?? '';
    }

    /**
     * Broadcast event to specific doctor
     */
    public function broadcast(int $doctorId, string $event, array $data): bool
    {
        if (empty($this->secret)) {
            error_log("WebSocket: No internal secret configured, skipping broadcast");
            return false;
        }

        $url = $this->internalUrl . '/internal/broadcast';

        $payload = json_encode([
            'doctor_id' => $doctorId,
            'event' => $event,
            'data' => $data
        ]);

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'X-Internal-Secret: ' . $this->secret,
                    'Content-Length: ' . strlen($payload)
                ],
                'content' => $payload,
                'timeout' => 5,
                'ignore_errors' => true
            ]
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            error_log("WebSocket: Failed to connect to {$url}");
            return false;
        }

        $result = json_decode($response, true);
        return isset($result['success']) && $result['success'] === true;
    }

    /**
     * Send new exam notification
     */
    public function notifyNewExam(int $doctorId, array $examData): bool
    {
        return $this->broadcast($doctorId, 'new_exam', $examData);
    }

    /**
     * Send new alert notification
     */
    public function notifyNewAlert(int $doctorId, array $alertData): bool
    {
        return $this->broadcast($doctorId, 'new_alert', $alertData);
    }
}
