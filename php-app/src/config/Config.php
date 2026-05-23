<?php
/**
 * Application Configuration
 * Central configuration access
 */

namespace App\Config;

class Config
{
    /**
     * Get database configuration
     */
    public static function database(): array
    {
        return [
            'host' => Env::get('DB_HOST', 'localhost'),
            'port' => Env::getInt('DB_PORT', 3306),
            'database' => Env::get('DB_DATABASE', 'diabetic_retinopathy'),
            'username' => Env::get('DB_USERNAME', 'root'),
            'password' => Env::get('DB_PASSWORD', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
        ];
    }

    /**
     * Get JWT configuration
     */
    public static function jwt(): array
    {
        return [
            'secret' => Env::get('JWT_SECRET'),
            'expiry' => Env::getInt('JWT_EXPIRY', 28800), // 8 hours
            'algorithm' => 'HS256',
        ];
    }

    /**
     * Get application configuration
     */
    public static function app(): array
    {
        return [
            'name' => Env::get('APP_NAME', 'Dépistage Rétinopathie Diabétique'),
            'url' => Env::get('APP_URL', 'http://localhost'),
            'env' => Env::get('APP_ENV', 'development'),
            'debug' => Env::getBool('APP_DEBUG', true),
        ];
    }

    /**
     * Get AI service configuration
     */
    public static function ai(): array
    {
        return [
            'url' => Env::get('AI_SERVICE_URL', 'http://localhost:8000'),
            'timeout' => Env::getInt('AI_SERVICE_TIMEOUT', 60),
        ];
    }

    /**
     * Get WebSocket configuration
     */
    public static function websocket(): array
    {
        return [
            'url' => Env::get('WS_SERVER_URL', 'ws://localhost:8080'),
            'internal_url' => Env::get('WS_INTERNAL_URL', 'http://localhost:8080'),
            'internal_secret' => Env::get('WS_INTERNAL_SECRET'),
        ];
    }

    /**
     * Get SMTP configuration
     */
    public static function smtp(): array
    {
        return [
            'host' => Env::get('SMTP_HOST', 'smtp.gmail.com'),
            'port' => Env::getInt('SMTP_PORT', 587),
            'username' => Env::get('SMTP_USERNAME'),
            'password' => Env::get('SMTP_PASSWORD'),
            'from_email' => Env::get('SMTP_FROM_EMAIL'),
            'from_name' => Env::get('SMTP_FROM_NAME', 'Centre Ophtalmologique'),
            'encryption' => Env::get('SMTP_ENCRYPTION', 'tls'),
        ];
    }

    /**
     * Get upload configuration
     */
    public static function upload(): array
    {
        return [
            'max_size' => Env::getInt('UPLOAD_MAX_SIZE', 10485760), // 10 MB
            'allowed_extensions' => explode(',', Env::get('ALLOWED_EXTENSIONS', 'jpg,jpeg,png')),
            'original_path' => dirname(__DIR__, 2) . '/public/uploads/original/',
            'gradcam_path' => dirname(__DIR__, 2) . '/public/uploads/gradcam/',
        ];
    }

    /**
     * Get DR grade labels in French
     */
    public static function gradeLabels(): array
    {
        return [
            0 => 'Pas de RD',
            1 => 'RD légère',
            2 => 'RD modérée',
            3 => 'RD sévère',
            4 => 'RD proliférante',
        ];
    }

    /**
     * Get grade CSS classes for badges
     */
    public static function gradeClasses(): array
    {
        return [
            0 => 'badge-success',
            1 => 'badge-info',
            2 => 'badge-warning',
            3 => 'badge-danger',
            4 => 'badge-critical',
        ];
    }
}
