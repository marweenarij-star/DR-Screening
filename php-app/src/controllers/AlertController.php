<?php
/**
 * Alert Controller
 * Manage alerts for doctors
 */

namespace App\Controllers;

use App\Services\Database;
use App\Middleware\AuthMiddleware;

class AlertController extends BaseController
{
    /**
     * GET /api/doctor/alerts
     * List alerts for logged-in doctor
     */
    public function index(): void
    {
        $user = AuthMiddleware::requireDoctor();
        if (!$user) return;

        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;

        // Filters
        $status = $_GET['status'] ?? 'all'; // all, unread, unresolved, resolved
        $where = "a.doctor_id = ?";
        $params = [$user['id']];

        switch ($status) {
            case 'unread':
                $where .= " AND a.is_read = 0";
                break;
            case 'unresolved':
                $where .= " AND a.is_resolved = 0";
                break;
            case 'resolved':
                $where .= " AND a.is_resolved = 1";
                break;
        }

        // Get total count
        $countResult = Database::queryOne(
            "SELECT COUNT(*) as count FROM alerts a WHERE {$where}",
            $params
        );
        $total = (int)$countResult['count'];

        // Get alerts with exam and patient info
        $alerts = Database::query(
            "SELECT a.*, 
                    e.grade, e.confidence, e.image_path, e.created_at as exam_date,
                    p.full_name as patient_name, p.medical_record_number
             FROM alerts a
             JOIN exams e ON a.exam_id = e.id
             JOIN patients p ON e.patient_id = p.id
             WHERE {$where}
             ORDER BY a.is_resolved ASC, a.is_read ASC, a.created_at DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        $this->success([
            'alerts' => $alerts,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => ceil($total / $perPage)
            ],
            'counts' => [
                'total' => Database::count('alerts', 'doctor_id = ?', [$user['id']]),
                'unread' => Database::count('alerts', 'doctor_id = ? AND is_read = 0', [$user['id']]),
                'unresolved' => Database::count('alerts', 'doctor_id = ? AND is_resolved = 0', [$user['id']]),
                'resolved' => Database::count('alerts', 'doctor_id = ? AND is_resolved = 1', [$user['id']])
            ]
        ]);
    }

    /**
     * PUT /api/doctor/alerts/{id}/read
     * Mark alert as read
     */
    public function markRead(array $params): void
    {
        $user = AuthMiddleware::requireDoctor();
        if (!$user) return;

        $id = (int)$params['id'];

        // Verify alert belongs to doctor
        $alert = Database::queryOne(
            "SELECT id, is_read FROM alerts WHERE id = ? AND doctor_id = ?",
            [$id, $user['id']]
        );

        if (!$alert) {
            $this->error('Alerte non trouvée', 404);
        }

        if (!$alert['is_read']) {
            Database::execute(
                "UPDATE alerts SET is_read = 1, read_at = NOW() WHERE id = ?",
                [$id]
            );
        }

        $this->success(null, 'Alerte marquée comme lue');
    }

    /**
     * PUT /api/doctor/alerts/{id}/resolve
     * Resolve alert with optional comment
     */
    public function resolve(array $params): void
    {
        $user = AuthMiddleware::requireDoctor();
        if (!$user) return;

        $id = (int)$params['id'];
        $data = $this->getJsonBody();

        // Verify alert belongs to doctor
        $alert = Database::queryOne(
            "SELECT id, is_resolved FROM alerts WHERE id = ? AND doctor_id = ?",
            [$id, $user['id']]
        );

        if (!$alert) {
            $this->error('Alerte non trouvée', 404);
        }

        $comment = $data['comment'] ?? null;

        Database::execute(
            "UPDATE alerts SET 
                is_read = 1,
                read_at = COALESCE(read_at, NOW()),
                is_resolved = 1, 
                resolved_at = NOW(),
                resolved_comment = ?
             WHERE id = ?",
            [$comment, $id]
        );

        $updatedAlert = Database::queryOne("SELECT * FROM alerts WHERE id = ?", [$id]);

        $this->success($updatedAlert, 'Alerte résolue avec succès');
    }
}
