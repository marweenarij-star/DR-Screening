<?php
/**
 * Doctor Exam Controller
 * Exam operations for doctors
 */

namespace App\Controllers;

use App\Services\Database;
use App\Config\Config;
use App\Middleware\AuthMiddleware;

class DoctorExamController extends BaseController
{
    /**
     * GET /api/doctor/exams
     * List exams for logged-in doctor
     * Sorted by grade DESC, then created_at DESC
     */
    public function index(): void
    {
        $user = AuthMiddleware::requireDoctor();
        if (!$user) return;

        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;

        // Filters
        $search = trim($_GET['search'] ?? '');
        $gradeFilter = isset($_GET['grade']) ? (int)$_GET['grade'] : null;
        $dateFrom = $_GET['date_from'] ?? null;
        $dateTo = $_GET['date_to'] ?? null;

        $where = "e.doctor_id = ?";
        $params = [$user['id']];

        // Search by patient name
        if ($search) {
            $where .= " AND p.full_name LIKE ?";
            $params[] = "%{$search}%";
        }

        // Filter by grade
        if ($gradeFilter !== null && $gradeFilter >= 0 && $gradeFilter <= 4) {
            $where .= " AND e.grade = ?";
            $params[] = $gradeFilter;
        }

        // Filter by date range
        if ($dateFrom) {
            $where .= " AND DATE(e.created_at) >= ?";
            $params[] = $dateFrom;
        }

        if ($dateTo) {
            $where .= " AND DATE(e.created_at) <= ?";
            $params[] = $dateTo;
        }

        // Get total count
        $countResult = Database::queryOne(
            "SELECT COUNT(*) as count FROM exams e 
             JOIN patients p ON e.patient_id = p.id 
             WHERE {$where}",
            $params
        );
        $total = (int)$countResult['count'];

        // Get exams with sorting: grade DESC, created_at DESC
        $exams = Database::query(
            "SELECT e.id, e.patient_id, e.image_path, e.overlay_path, e.grade, 
                    e.confidence, e.eye, e.created_at,
                    p.full_name as patient_name, p.age as patient_age,
                    p.medical_record_number
             FROM exams e
             JOIN patients p ON e.patient_id = p.id
             WHERE {$where}
             ORDER BY e.grade DESC, e.created_at DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        // Add grade labels
        $gradeLabels = Config::gradeLabels();
        $gradeClasses = Config::gradeClasses();
        
        foreach ($exams as &$exam) {
            $exam['grade_label'] = $gradeLabels[$exam['grade']] ?? 'Inconnu';
            $exam['grade_class'] = $gradeClasses[$exam['grade']] ?? 'badge-secondary';
            $exam['is_urgent'] = $exam['grade'] >= 3;
        }

        $this->success([
            'exams' => $exams,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => ceil($total / $perPage)
            ],
            'filters' => [
                'search' => $search,
                'grade' => $gradeFilter,
                'date_from' => $dateFrom,
                'date_to' => $dateTo
            ]
        ]);
    }

    /**
     * GET /api/doctor/exams/{id}
     * Get single exam detail for doctor
     */
    public function show(array $params): void
    {
        $user = AuthMiddleware::requireDoctor();
        if (!$user) return;

        $id = (int)$params['id'];

        $exam = Database::queryOne(
            "SELECT e.*,
                    p.full_name as patient_name, p.date_of_birth, p.age as patient_age,
                    p.gender, p.medical_record_number, p.diabetic_years, p.diabetes_type,
                    p.phone as patient_phone, p.notes as patient_notes
             FROM exams e
             JOIN patients p ON e.patient_id = p.id
             WHERE e.id = ? AND e.doctor_id = ?",
            [$id, $user['id']]
        );

        if (!$exam) {
            $this->error('Examen non trouvé', 404);
        }

        // Add grade label
        $gradeLabels = Config::gradeLabels();
        $gradeClasses = Config::gradeClasses();
        $exam['grade_label'] = $gradeLabels[$exam['grade']] ?? 'Inconnu';
        $exam['grade_class'] = $gradeClasses[$exam['grade']] ?? 'badge-secondary';
        $exam['is_urgent'] = $exam['grade'] >= 3;

        // Get related alert if exists
        $alert = Database::queryOne(
            "SELECT * FROM alerts WHERE exam_id = ? AND doctor_id = ?",
            [$id, $user['id']]
        );
        $exam['alert'] = $alert;

        // Get patient exam history (other exams for same patient)
        $history = Database::query(
            "SELECT id, grade, confidence, eye, created_at
             FROM exams
             WHERE patient_id = ? AND id != ?
             ORDER BY created_at DESC
             LIMIT 10",
            [$exam['patient_id'], $id]
        );
        $exam['patient_history'] = $history;

        $this->success($exam);
    }

    /**
     * GET /api/doctor/stats
     * Get dashboard statistics for doctor
     */
    public function stats(): void
    {
        $user = AuthMiddleware::requireDoctor();
        if (!$user) return;

        // Total exams
        $totalExams = Database::count('exams', 'doctor_id = ?', [$user['id']]);

        // Severe cases (grade >= 3)
        $severeCases = Database::count('exams', 'doctor_id = ? AND grade >= 3', [$user['id']]);

        // Unread alerts
        $unreadAlerts = Database::count(
            'alerts',
            'doctor_id = ? AND is_read = 0',
            [$user['id']]
        );

        // Pending alerts (unresolved)
        $pendingAlerts = Database::count(
            'alerts',
            'doctor_id = ? AND is_resolved = 0',
            [$user['id']]
        );

        // Grade distribution
        $gradeDistribution = Database::query(
            "SELECT grade, COUNT(*) as count
             FROM exams WHERE doctor_id = ?
             GROUP BY grade
             ORDER BY grade",
            [$user['id']]
        );

        // Format grade distribution
        $gradeLabels = Config::gradeLabels();
        $distribution = [];
        for ($i = 0; $i <= 4; $i++) {
            $count = 0;
            foreach ($gradeDistribution as $row) {
                if ((int)$row['grade'] === $i) {
                    $count = (int)$row['count'];
                    break;
                }
            }
            $distribution[] = [
                'grade' => $i,
                'label' => $gradeLabels[$i],
                'count' => $count
            ];
        }

        // Recent exams (last 7 days trend)
        $trend = Database::query(
            "SELECT DATE(created_at) as date, COUNT(*) as count
             FROM exams
             WHERE doctor_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date",
            [$user['id']]
        );

        // Exams today
        $today = Database::count(
            'exams',
            'doctor_id = ? AND DATE(created_at) = CURDATE()',
            [$user['id']]
        );

        $this->success([
            'total_exams' => $totalExams,
            'severe_cases' => $severeCases,
            'unread_alerts' => $unreadAlerts,
            'pending_alerts' => $pendingAlerts,
            'exams_today' => $today,
            'grade_distribution' => $distribution,
            'weekly_trend' => $trend
        ]);
    }
}
