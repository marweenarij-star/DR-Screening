<?php
/**
 * Doctor Controller
 * Manage doctor accounts (center admin)
 */

namespace App\Controllers;

use App\Services\Database;
use App\Middleware\AuthMiddleware;

class DoctorController extends BaseController
{
    /**
     * GET /api/center/doctors
     * List all doctors for the center
     */
    public function index(): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $doctors = Database::query(
            "SELECT id, name, email, speciality, phone, is_active, created_at, last_login
             FROM users 
             WHERE center_id = ? AND role = 'doctor'
             ORDER BY name ASC",
            [$user['center_id']]
        );

        // Add exam counts
        foreach ($doctors as &$doctor) {
            $stats = Database::queryOne(
                "SELECT 
                    COUNT(*) as total_exams,
                    SUM(CASE WHEN grade >= 3 THEN 1 ELSE 0 END) as severe_cases
                 FROM exams WHERE doctor_id = ?",
                [$doctor['id']]
            );
            $doctor['total_exams'] = (int)$stats['total_exams'];
            $doctor['severe_cases'] = (int)$stats['severe_cases'];
        }

        $this->success(['doctors' => $doctors]);
    }

    /**
     * POST /api/center/doctors
     * Create new doctor account
     */
    public function store(): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $data = $this->getJsonBody();

        // Validate required fields
        $errors = $this->validateRequired($data, ['name', 'email', 'password']);
        if (!empty($errors)) {
            $this->error('Données invalides', 400, $errors);
        }

        $email = strtolower(trim($data['email']));

        // Validate email format
        if (!$this->validateEmail($email)) {
            $this->error('Format d\'email invalide');
        }

        // Validate password strength
        if (strlen($data['password']) < 8) {
            $this->error('Le mot de passe doit contenir au moins 8 caractères');
        }

        // Check if email already exists
        $existing = Database::queryOne("SELECT id FROM users WHERE email = ?", [$email]);
        if ($existing) {
            $this->error('Cette adresse email est déjà utilisée');
        }

        // Hash password
        $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT);

        $id = Database::insert(
            "INSERT INTO users (center_id, role, name, email, password_hash, speciality, phone, is_active)
             VALUES (?, 'doctor', ?, ?, ?, ?, ?, 1)",
            [
                $user['center_id'],
                $this->sanitize($data['name']),
                $email,
                $passwordHash,
                $data['speciality'] ?? null,
                $data['phone'] ?? null
            ]
        );

        $doctor = Database::queryOne(
            "SELECT id, name, email, speciality, phone, is_active, created_at 
             FROM users WHERE id = ?",
            [$id]
        );

        $this->success($doctor, 'Médecin créé avec succès', 201);
    }

    /**
     * GET /api/center/doctors/{id}
     * Get single doctor details
     */
    public function show(array $params): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $id = (int)$params['id'];

        $doctor = Database::queryOne(
            "SELECT id, name, email, speciality, phone, is_active, created_at, last_login
             FROM users 
             WHERE id = ? AND center_id = ? AND role = 'doctor'",
            [$id, $user['center_id']]
        );

        if (!$doctor) {
            $this->error('Médecin non trouvé', 404);
        }

        // Get stats
        $stats = Database::queryOne(
            "SELECT 
                COUNT(*) as total_exams,
                SUM(CASE WHEN grade >= 3 THEN 1 ELSE 0 END) as severe_cases,
                AVG(grade) as avg_grade
             FROM exams WHERE doctor_id = ?",
            [$id]
        );

        $doctor['stats'] = [
            'total_exams' => (int)$stats['total_exams'],
            'severe_cases' => (int)$stats['severe_cases'],
            'avg_grade' => round((float)$stats['avg_grade'], 2)
        ];

        // Get recent exams
        $doctor['recent_exams'] = Database::query(
            "SELECT e.id, e.grade, e.confidence, e.created_at, p.full_name as patient_name
             FROM exams e
             JOIN patients p ON e.patient_id = p.id
             WHERE e.doctor_id = ?
             ORDER BY e.created_at DESC
             LIMIT 5",
            [$id]
        );

        $this->success($doctor);
    }

    /**
     * PUT /api/center/doctors/{id}
     * Update doctor (name, speciality, phone, active status)
     */
    public function update(array $params): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $id = (int)$params['id'];
        $data = $this->getJsonBody();

        // Check if doctor exists
        $doctor = Database::queryOne(
            "SELECT id FROM users WHERE id = ? AND center_id = ? AND role = 'doctor'",
            [$id, $user['center_id']]
        );

        if (!$doctor) {
            $this->error('Médecin non trouvé', 404);
        }

        // Build update query dynamically
        $updates = [];
        $params = [];

        if (isset($data['name'])) {
            $updates[] = "name = ?";
            $params[] = $this->sanitize($data['name']);
        }

        if (isset($data['speciality'])) {
            $updates[] = "speciality = ?";
            $params[] = $data['speciality'];
        }

        if (isset($data['phone'])) {
            $updates[] = "phone = ?";
            $params[] = $data['phone'];
        }

        if (isset($data['is_active'])) {
            $updates[] = "is_active = ?";
            $params[] = (int)$data['is_active'];
        }

        // Update password if provided
        if (!empty($data['password'])) {
            if (strlen($data['password']) < 8) {
                $this->error('Le mot de passe doit contenir au moins 8 caractères');
            }
            $updates[] = "password_hash = ?";
            $params[] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (empty($updates)) {
            $this->error('Aucune donnée à mettre à jour');
        }

        $updates[] = "updated_at = NOW()";
        $params[] = $id;

        Database::execute(
            "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?",
            $params
        );

        $doctor = Database::queryOne(
            "SELECT id, name, email, speciality, phone, is_active, created_at, last_login 
             FROM users WHERE id = ?",
            [$id]
        );

        $this->success($doctor, 'Médecin mis à jour avec succès');
    }
}
