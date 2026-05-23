<?php
/**
 * Base Controller
 */

namespace App\Controllers;

abstract class BaseController
{
    /**
     * Send JSON response
     */
    protected function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Send success response
     */
    protected function success($data = null, string $message = '', int $status = 200): void
    {
        $response = ['success' => true];
        
        if ($message) {
            $response['message'] = $message;
        }
        
        if ($data !== null) {
            $response['data'] = $data;
        }

        $this->json($response, $status);
    }

    /**
     * Send error response
     */
    protected function error(string $message, int $status = 400, array $errors = []): void
    {
        $response = [
            'success' => false,
            'error' => $message
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        $this->json($response, $status);
    }

    /**
     * Get JSON body from request
     */
    protected function getJsonBody(): array
    {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        return $data ?? [];
    }

    /**
     * Render view
     */
    protected function view(string $template, array $data = []): void
    {
        extract($data);
        $viewPath = SRC_PATH . '/views/' . $template . '.php';
        
        if (!file_exists($viewPath)) {
            http_response_code(500);
            echo "View not found: {$template}";
            exit;
        }

        include $viewPath;
        exit;
    }

    /**
     * Redirect to URL
     */
    protected function redirect(string $url): void
    {
        header('Location: ' . $url);
        exit;
    }

    /**
     * Validate required fields
     */
    protected function validateRequired(array $data, array $fields): array
    {
        $errors = [];
        
        foreach ($fields as $field) {
            if (!isset($data[$field]) || trim($data[$field]) === '') {
                $errors[$field] = "Le champ {$field} est requis";
            }
        }

        return $errors;
    }

    /**
     * Validate email format
     */
    protected function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Sanitize string input
     */
    protected function sanitize(?string $input): string
    {
        if ($input === null) {
            return '';
        }
        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
}
