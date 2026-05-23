<?php
/**
 * Patient Controller
 * CRUD operations for patients (center admin)
 */

namespace App\Controllers;

use App\Services\Database;
use App\Middleware\AuthMiddleware;

class PatientController extends BaseController
{
    /**
     * GET /api/center/patients
     * List patients with pagination and search
     */
    public function index(): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
        $search = trim($_GET['search'] ?? '');
        $offset = ($page - 1) * $perPage;

        $where = "center_id = ?";
        $params = [$user['center_id']];

        if ($search) {
            $where .= " AND (full_name LIKE ? OR medical_record_number LIKE ? OR phone LIKE ?)";
            $searchTerm = "%{$search}%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        // Get total count
        $total = Database::count('patients', $where, $params);

        // Get patients
        $patients = Database::query(
            "SELECT id, medical_record_number, full_name, date_of_birth, age, gender, 
                    diabetic_years, diabetes_type, phone, email, created_at
             FROM patients 
             WHERE {$where}
             ORDER BY created_at DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        $this->success([
            'patients' => $patients,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => ceil($total / $perPage)
            ]
        ]);
    }

    /**
     * POST /api/center/patients
     * Create new patient
     */
    public function store(): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $data = $this->getJsonBody();

        // Validate required fields
        $errors = $this->validateRequired($data, ['full_name']);
        if (!empty($errors)) {
            $this->error('Données invalides', 400, $errors);
        }

        // Validate email if provided
        if (!empty($data['email']) && !$this->validateEmail($data['email'])) {
            $this->error('Format d\'email invalide');
        }

        // Generate medical record number if not provided
        $mrn = $data['medical_record_number'] ?? null;
        if (!$mrn) {
            $year = date('Y');
            $count = Database::count('patients', 'center_id = ? AND YEAR(created_at) = ?', [$user['center_id'], $year]);
            $mrn = sprintf('DM-%s-%03d', $year, $count + 1);
        }

        // Calculate age from date of birth if provided
        $age = $data['age'] ?? null;
        if (!empty($data['date_of_birth'])) {
            $dob = new \DateTime($data['date_of_birth']);
            $now = new \DateTime();
            $age = $now->diff($dob)->y;
        }

        $id = Database::insert(
            "INSERT INTO patients (center_id, medical_record_number, full_name, date_of_birth, 
                                   age, gender, diabetic_years, diabetes_type, phone, email, address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $user['center_id'],
                $mrn,
                $this->sanitize($data['full_name']),
                $data['date_of_birth'] ?? null,
                $age,
                $data['gender'] ?? null,
                $data['diabetic_years'] ?? null,
                $data['diabetes_type'] ?? null,
                $data['phone'] ?? null,
                $data['email'] ?? null,
                $data['address'] ?? null,
                $data['notes'] ?? null
            ]
        );

        $patient = Database::queryOne("SELECT * FROM patients WHERE id = ?", [$id]);

        $this->success($patient, 'Patient créé avec succès', 201);
    }

    /**
     * GET /api/center/patients/{id}
     * Get single patient with exam history
     */
    public function show(array $params): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $id = (int)$params['id'];

        $patient = Database::queryOne(
            "SELECT * FROM patients WHERE id = ? AND center_id = ?",
            [$id, $user['center_id']]
        );

        if (!$patient) {
            $this->error('Patient non trouvé', 404);
        }

        // Get exam history
        $exams = Database::query(
            "SELECT e.*, u.name as doctor_name 
             FROM exams e
             LEFT JOIN users u ON e.doctor_id = u.id
             WHERE e.patient_id = ?
             ORDER BY e.created_at DESC",
            [$id]
        );

        $patient['exams'] = $exams;

        $this->success($patient);
    }

    /**
     * PUT /api/center/patients/{id}
     * Update patient
     */
    public function update(array $params): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $id = (int)$params['id'];
        $data = $this->getJsonBody();

        // Check if patient exists
        $patient = Database::queryOne(
            "SELECT id FROM patients WHERE id = ? AND center_id = ?",
            [$id, $user['center_id']]
        );

        if (!$patient) {
            $this->error('Patient non trouvé', 404);
        }

        // Validate email if provided
        if (!empty($data['email']) && !$this->validateEmail($data['email'])) {
            $this->error('Format d\'email invalide');
        }

        // Calculate age from date of birth if provided
        $age = $data['age'] ?? null;
        if (!empty($data['date_of_birth'])) {
            $dob = new \DateTime($data['date_of_birth']);
            $now = new \DateTime();
            $age = $now->diff($dob)->y;
        }

        Database::execute(
            "UPDATE patients SET 
                full_name = COALESCE(?, full_name),
                date_of_birth = COALESCE(?, date_of_birth),
                age = COALESCE(?, age),
                gender = COALESCE(?, gender),
                diabetic_years = COALESCE(?, diabetic_years),
                diabetes_type = COALESCE(?, diabetes_type),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                address = COALESCE(?, address),
                notes = COALESCE(?, notes),
                updated_at = NOW()
             WHERE id = ?",
            [
                isset($data['full_name']) ? $this->sanitize($data['full_name']) : null,
                $data['date_of_birth'] ?? null,
                $age,
                $data['gender'] ?? null,
                $data['diabetic_years'] ?? null,
                $data['diabetes_type'] ?? null,
                $data['phone'] ?? null,
                $data['email'] ?? null,
                $data['address'] ?? null,
                $data['notes'] ?? null,
                $id
            ]
        );

        $patient = Database::queryOne("SELECT * FROM patients WHERE id = ?", [$id]);

        $this->success($patient, 'Patient mis à jour avec succès');
    }

    /**
     * DELETE /api/center/patients/{id}
     * Delete patient
     */
    public function destroy(array $params): void
    {
        $user = AuthMiddleware::requireCenterAdmin();
        if (!$user) return;

        $id = (int)$params['id'];

        // Check if patient exists
        $patient = Database::queryOne(
            "SELECT id FROM patients WHERE id = ? AND center_id = ?",
            [$id, $user['center_id']]
        );

        if (!$patient) {
            $this->error('Patient non trouvé', 404);
        }

        // Check for existing exams
        $examCount = Database::count('exams', 'patient_id = ?', [$id]);
        if ($examCount > 0) {
            $this->error('Impossible de supprimer: ce patient a des examens associés');
        }

        Database::execute("DELETE FROM patients WHERE id = ?", [$id]);

        $this->success(null, 'Patient supprimé avec succès');
    }
}
