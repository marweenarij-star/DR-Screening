<?php
/**
 * Authentication Controller
 * Handles login, logout, and token verification
 */

namespace App\Controllers;

use App\Services\Database;
use App\Services\JWTService;
use App\Middleware\AuthMiddleware;

class AuthController extends BaseController
{
    /**
     * POST /api/auth/login
     * Login for both center_admin and doctor
     */
    public function login(): void
    {
        $data = $this->getJsonBody();
        
        // Validate required fields
        $errors = $this->validateRequired($data, ['email', 'password']);
        if (!empty($errors)) {
            $this->error('Données invalides', 400, $errors);
        }

        $email = strtolower(trim($data['email']));
        $password = $data['password'];

        // Validate email format
        if (!$this->validateEmail($email)) {
            $this->error('Format d\'email invalide');
        }

        // Find user
        $user = Database::queryOne(
            "SELECT id, center_id, role, name, email, password_hash, is_active 
             FROM users WHERE email = ?",
            [$email]
        );

        if (!$user) {
            $this->error('Email ou mot de passe incorrect', 401);
        }

        if (!$user['is_active']) {
            $this->error('Compte désactivé. Contactez l\'administrateur.', 401);
        }

        // Verify password
        if (!password_verify($password, $user['password_hash'])) {
            $this->error('Email ou mot de passe incorrect', 401);
        }

        // Update last login
        Database::execute(
            "UPDATE users SET last_login = NOW() WHERE id = ?",
            [$user['id']]
        );

        // Generate JWT token
        $token = JWTService::generate([
            'user_id' => $user['id'],
            'center_id' => $user['center_id'],
            'role' => $user['role'],
            'email' => $user['email']
        ]);

        // Return response
        $this->success([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'center_id' => $user['center_id']
            ]
        ], 'Connexion réussie');
    }

    /**
     * GET /api/auth/verify
     * Verify JWT token and return user info
     */
    public function verify(): void
    {
        $token = JWTService::extractFromHeader();

        if (!$token) {
            $this->error('Token manquant', 401);
        }

        $payload = JWTService::validate($token);

        if (!$payload) {
            $this->error('Token invalide ou expiré', 401);
        }

        // Get fresh user data
        $user = Database::queryOne(
            "SELECT id, center_id, role, name, email, is_active 
             FROM users WHERE id = ?",
            [$payload['user_id']]
        );

        if (!$user || !$user['is_active']) {
            $this->error('Utilisateur non trouvé ou désactivé', 401);
        }

        $this->success([
            'valid' => true,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'center_id' => $user['center_id']
            ],
            'expires_at' => $payload['exp']
        ]);
    }

    /**
     * POST /api/auth/logout
     * Logout (client-side token removal)
     */
    public function logout(): void
    {
        // JWT is stateless, so logout is handled client-side
        // We just return success
        $this->success(null, 'Déconnexion réussie');
    }
}
