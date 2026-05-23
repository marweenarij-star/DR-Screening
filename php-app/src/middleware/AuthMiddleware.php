<?php
/**
 * JWT Authentication Middleware
 */

namespace App\Middleware;

use App\Services\JWTService;
use App\Services\Database;

class AuthMiddleware
{
    /**
     * Authenticate request via JWT
     * Returns user data or sends 401 response
     */
    public static function authenticate(): ?array
    {
        $token = JWTService::extractFromHeader();

        if (!$token) {
            self::unauthorized('Token manquant');
            return null;
        }

        $payload = JWTService::validate($token);

        if (!$payload) {
            self::unauthorized('Token invalide ou expiré');
            return null;
        }

        // Get user from database
        $user = Database::queryOne(
            "SELECT id, center_id, role, name, email, is_active FROM users WHERE id = ?",
            [$payload['user_id']]
        );

        if (!$user || !$user['is_active']) {
            self::unauthorized('Utilisateur non trouvé ou désactivé');
            return null;
        }

        return $user;
    }

    /**
     * Require center_admin role
     */
    public static function requireCenterAdmin(): ?array
    {
        $user = self::authenticate();
        
        if ($user && $user['role'] !== 'center_admin') {
            self::forbidden('Accès réservé aux administrateurs');
            return null;
        }

        return $user;
    }

    /**
     * Require doctor role
     */
    public static function requireDoctor(): ?array
    {
        $user = self::authenticate();
        
        if ($user && $user['role'] !== 'doctor') {
            self::forbidden('Accès réservé aux médecins');
            return null;
        }

        return $user;
    }

    /**
     * Send 401 Unauthorized response
     */
    private static function unauthorized(string $message): void
    {
        http_response_code(401);
        echo json_encode([
            'error' => 'Non autorisé',
            'message' => $message
        ]);
        exit;
    }

    /**
     * Send 403 Forbidden response
     */
    private static function forbidden(string $message): void
    {
        http_response_code(403);
        echo json_encode([
            'error' => 'Accès interdit',
            'message' => $message
        ]);
        exit;
    }
}
