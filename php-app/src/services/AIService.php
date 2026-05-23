<?php
/**
 * AI Service Client
 * Communicates with FastAPI AI microservice
 */

namespace App\Services;

use App\Config\Config;

class AIService
{
    private string $baseUrl;
    private int $timeout;

    public function __construct()
    {
        $config = Config::ai();
        $this->baseUrl = rtrim($config['url'], '/');
        $this->timeout = $config['timeout'];
    }

    /**
     * Send image to AI service for prediction
     * 
     * @param string $imagePath Absolute path to image file
     * @return array|null Response with grade, confidence, heatmap_path, overlay_path
     */
    public function predict(string $imagePath): ?array
    {
        if (!file_exists($imagePath)) {
            throw new \RuntimeException("Image file not found: {$imagePath}");
        }

        $url = $this->baseUrl . '/predict';
        
        // Prepare multipart form data
        $boundary = uniqid();
        $fileName = basename($imagePath);
        $fileContent = file_get_contents($imagePath);
        $mimeType = mime_content_type($imagePath) ?: 'image/jpeg';

        $body = "--{$boundary}\r\n";
        $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"{$fileName}\"\r\n";
        $body .= "Content-Type: {$mimeType}\r\n\r\n";
        $body .= $fileContent . "\r\n";
        $body .= "--{$boundary}--\r\n";

        // Make request
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => [
                    "Content-Type: multipart/form-data; boundary={$boundary}",
                    "Content-Length: " . strlen($body)
                ],
                'content' => $body,
                'timeout' => $this->timeout,
                'ignore_errors' => true
            ]
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            error_log("AI Service request failed: Could not connect to {$url}");
            return null;
        }

        $data = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("AI Service returned invalid JSON: {$response}");
            return null;
        }

        if (isset($data['error'])) {
            error_log("AI Service error: " . $data['error']);
            return null;
        }

        return $data;
    }

    /**
     * Download image from AI service to local path
     * 
     * @param string $remotePath Path returned by AI service
     * @param string $localPath Local destination path
     * @return bool Success status
     */
    public function downloadImage(string $remotePath, string $localPath): bool
    {
        // If it's already a full URL
        if (strpos($remotePath, 'http') === 0) {
            $url = $remotePath;
        } else {
            // Build URL from base and path
            $url = $this->baseUrl . '/' . ltrim($remotePath, '/');
        }

        $content = @file_get_contents($url);

        if ($content === false) {
            error_log("Failed to download image from: {$url}");
            return false;
        }

        // Ensure directory exists
        $dir = dirname($localPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return file_put_contents($localPath, $content) !== false;
    }

    /**
     * Check if AI service is available
     */
    public function healthCheck(): bool
    {
        $url = $this->baseUrl . '/health';
        
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 5,
                'ignore_errors' => true
            ]
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            return false;
        }

        $data = json_decode($response, true);
        return isset($data['status']) && $data['status'] === 'ok';
    }
}
