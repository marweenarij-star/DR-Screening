/**
 * Center Admin Routes
 */

const express = require('express');
const db = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

const GRADE_LABELS = {
    '-1': 'En attente',
    0: 'Pas de RD',
    1: 'RD Legere',
    2: 'RD Moderee',
    3: 'RD Severe',
    4: 'RD Proliferante'
};

const GRADE_CLASSES = {
    '-1': 'badge-info',
    0: 'badge-success',
    1: 'badge-info',
    2: 'badge-warning',
    3: 'badge-danger',
    4: 'badge-critical'
};

router.use(authMiddleware);
router.use((req, res, next) => {
    // Prevent actions during super admin impersonation
    if (req.user.impersonated_by_superadmin) {
        // Allow viewing but prevent sending new support messages
        return next();
    }
    next();
});
router.use(roleMiddleware('center_admin'));

// GET /api/center/dashboard - Get center admin dashboard info
router.get('/dashboard', async (req, res) => {
    try {
        const center = await db.queryOne(
            'SELECT id, name, location, address, status FROM centers WHERE id = ?',
            [req.user.center_id]
        );

        if (!center) {
            return res.status(404).json({ success: false, error: 'Centre non trouvé' });
        }

        const exams_count = await db.count('exams', 'center_id = ?', [req.user.center_id]);
        const pending_exams = await db.count('exams', 'center_id = ? AND grade = -1', [req.user.center_id]);
        const patients_count = await db.count('patients', 'center_id = ?', [req.user.center_id]);
        const doctors_count = await db.count(
            'users',
            'center_id = ? AND role = ? AND is_active = 1',
            [req.user.center_id, 'doctor']
        );

        res.json({
            success: true,
            data: {
                center,
                stats: {
                    exams_count,
                    pending_exams,
                    patients_count,
                    doctors_count
                }
            }
        });
    } catch (error) {
        console.error('Get center dashboard error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/center/exams/recent - Get latest submitted exams for this center
router.get('/exams/recent', async (req, res) => {
    try {
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

        const exams = await db.query(
            `SELECT e.id, e.grade, e.confidence, e.eye, e.created_at,
                    p.full_name AS patient_name,
                    p.medical_record_number,
                    u.name AS doctor_name
             FROM exams e
             JOIN patients p ON p.id = e.patient_id
             JOIN users u ON u.id = e.doctor_id
             WHERE e.center_id = ?
             ORDER BY e.created_at DESC
             LIMIT ?`,
            [req.user.center_id, limit]
        );

        const formatted = exams.map((exam) => {
            const gradeKey = String(exam.grade);
            return {
                ...exam,
                grade_label: GRADE_LABELS[gradeKey] ?? `Grade ${exam.grade}`,
                grade_class: GRADE_CLASSES[gradeKey] ?? 'badge-secondary',
                is_pending: Number(exam.grade) === -1,
                is_urgent: Number(exam.grade) >= 3,
                confidence: Number(exam.confidence) || 0
            };
        });

        res.json({
            success: true,
            data: {
                exams: formatted
            }
        });
    } catch (error) {
        console.error('Get recent center exams error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/center/exams/history - Historical exams for the center
router.get('/exams/history', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const perPage = Math.min(50, Math.max(10, parseInt(req.query.per_page, 10) || 20));
        const search = String(req.query.search || '').trim();

        let where = `e.center_id = ? AND e.grade >= 0`;
        const params = [req.user.center_id];

        if (search) {
            where += ` AND (p.full_name LIKE ? OR p.medical_record_number LIKE ? OR u.name LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const totalRow = await db.queryOne(
            `SELECT COUNT(*) as count
             FROM exams e
             JOIN patients p ON p.id = e.patient_id
             JOIN users u ON u.id = e.doctor_id
             WHERE ${where}`,
            params
        );

        const rawExams = await db.query(
            `SELECT e.id, e.grade, e.confidence, e.eye, e.created_at,
                    e.patient_id,
                    p.full_name AS patient_name,
                    p.medical_record_number,
                    u.name AS doctor_name
             FROM exams e
             JOIN patients p ON p.id = e.patient_id
             JOIN users u ON u.id = e.doctor_id
             WHERE ${where}
             ORDER BY e.created_at DESC`,
            params
        );

        const grouped = new Map();
        for (const exam of rawExams || []) {
            const createdAt = new Date(exam.created_at).getTime();
            const validTimestamp = Number.isFinite(createdAt) ? createdAt : Date.now();
            const timeBucket = Math.floor(validTimestamp / (5 * 60 * 1000));
            const key = `${exam.patient_id}|${exam.doctor_name || '-'}|${timeBucket}`;

            if (!grouped.has(key)) {
                grouped.set(key, {
                    patient_id: exam.patient_id,
                    patient_name: exam.patient_name,
                    medical_record_number: exam.medical_record_number,
                    doctor_name: exam.doctor_name,
                    created_at: exam.created_at,
                    timestamp: validTimestamp,
                    eyes: new Set(),
                    grades: [],
                    confidences: []
                });
            }

            const item = grouped.get(key);
            item.eyes.add(exam.eye);
            item.grades.push(Number(exam.grade));
            item.confidences.push(Number(exam.confidence) || 0);
            if (validTimestamp > item.timestamp) {
                item.timestamp = validTimestamp;
                item.created_at = exam.created_at;
            }
        }

        const groupedList = Array.from(grouped.values()).map((item) => {
            const eyes = Array.from(item.eyes).sort();
            const eyeGroup = eyes.includes('left') && eyes.includes('right')
                ? 'OG&OD'
                : eyes.includes('left')
                    ? 'OG'
                    : eyes.includes('right')
                        ? 'OD'
                        : 'Non spécifié';
            const nameParts = String(item.patient_name || '').trim().split(/\s+/).filter(Boolean);
            return {
                id: item.patient_id,
                medical_record_number: item.medical_record_number,
                last_name: nameParts.slice(1).join(' ') || '',
                first_name: nameParts[0] || '',
                eye: eyeGroup,
                created_at: item.created_at
            };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const total = groupedList.length;
        const offset = (page - 1) * perPage;
        const exams = groupedList.slice(offset, offset + perPage);

        res.json({
            success: true,
            data: {
                exams: exams || [],
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total,
                    total_pages: Math.ceil(total / perPage)
                }
            }
        });
    } catch (error) {
        console.error('Get center history error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/center/patients/pending-dossiers
// Default: show patients created by doctors and still in en_attente.
router.get('/patients/pending-dossiers', async (req, res) => {
    try {
        const doctorId = req.query.doctor_id ? parseInt(req.query.doctor_id, 10) : null;
        const dossierId = String(req.query.dossier_id || '').trim();

        let where = `
            p.center_id = ?
            AND p.created_by_doctor_id IS NOT NULL
            AND p.dossier_status = 'en_attente'
        `;
        const params = [req.user.center_id];

        if (doctorId) {
            where += ' AND p.created_by_doctor_id = ?';
            params.push(doctorId);
        }

        if (dossierId) {
            where += ' AND p.medical_record_number = ?';
            params.push(dossierId);
        }

        const rows = await db.query(
            `SELECT p.id, p.medical_record_number, p.full_name, p.date_of_birth, p.created_at,
                    p.dossier_status, p.created_by_doctor_id,
                    u.name AS doctor_name,
                    u.doctor_code
             FROM patients p
             JOIN users u ON u.id = p.created_by_doctor_id
             WHERE ${where}
             ORDER BY p.created_at DESC`,
            params
        );

        if (dossierId && (!rows || rows.length === 0)) {
            return res.status(404).json({
                success: false,
                error: 'ID dossier introuvable ou dossier non en attente. Merci de vérifier avec le médecin.'
            });
        }

        const doctors = await db.query(
            `SELECT id, name, doctor_code
             FROM users
             WHERE center_id = ? AND role = 'doctor' AND is_active = 1
             ORDER BY doctor_code ASC, name ASC`,
            [req.user.center_id]
        );

        res.json({
            success: true,
            data: {
                patients: rows || [],
                doctors: doctors || []
            }
        });
    } catch (error) {
        console.error('Get pending dossiers error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/center/patients/:id/start-exam
// Confirm patient presence without removing the dossier from the pending queue.
router.post('/patients/:id/start-exam', async (req, res) => {
    try {
        const patient = await db.queryOne(
            `SELECT p.id, p.medical_record_number, p.dossier_status, p.created_by_doctor_id,
                    u.name AS doctor_name, u.doctor_code
             FROM patients p
             LEFT JOIN users u ON u.id = p.created_by_doctor_id
             WHERE p.id = ? AND p.center_id = ?`,
            [req.params.id, req.user.center_id]
        );

        if (!patient) {
            return res.status(404).json({ success: false, error: 'Dossier patient non trouvé' });
        }

        if (patient.dossier_status !== 'en_attente') {
            return res.status(400).json({
                success: false,
                error: `Le dossier n'est pas en attente (statut actuel: ${patient.dossier_status})`
            });
        }

        res.json({
            success: true,
            message: 'Patient confirmé, vous pouvez envoyer l\'examen au médecin',
            data: {
                patient_id: patient.id,
                medical_record_number: patient.medical_record_number,
                dossier_status: patient.dossier_status,
                doctor_id: patient.created_by_doctor_id,
                doctor_name: patient.doctor_name,
                doctor_code: patient.doctor_code
            }
        });
    } catch (error) {
        console.error('Start exam error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/center/support/messages - Get support messages sent by this admin
router.get('/support/messages', async (req, res) => {
    try {
        const messages = await db.query(`
            SELECT id, subject, message, status, priority, 
                   created_at, updated_at, resolved_at
            FROM support_messages
            WHERE admin_id = ? AND center_id = ?
            ORDER BY created_at DESC
        `, [req.user.user_id, req.user.center_id]);

        const unresolved_count = await db.count(
            'support_messages',
            'admin_id = ? AND center_id = ? AND status != ?',
            [req.user.user_id, req.user.center_id, 'resolved']
        );

        res.json({
            success: true,
            data: {
                messages,
                unresolved_count
            }
        });
    } catch (error) {
        console.error('Get support messages error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/center/support/send - Send support message to super admin
router.post('/support/send', async (req, res) => {
    try {
        // Prevent sending messages during impersonation
        if (req.user.impersonated_by_superadmin) {
            return res.status(403).json({ success: false, error: 'Action non autorisée en mode impersonation' });
        }

        const { subject, message, priority } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ success: false, error: 'Sujet et message requis' });
        }

        if (!['low', 'medium', 'high'].includes(priority || 'medium')) {
            return res.status(400).json({ success: false, error: 'Priorité invalide' });
        }

        const result = await db.insert('support_messages', {
            center_id: req.user.center_id,
            admin_id: req.user.user_id,
            subject,
            message,
            priority: priority || 'medium',
            status: 'open',
            is_read_by_superadmin: 0,
            created_at: new Date(),
            updated_at: new Date()
        });

        res.json({
            success: true,
            message: 'Message envoyé avec succès',
            data: {
                id: result.lastID
            }
        });
    } catch (error) {
        console.error('Send support message error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/center/support/status - Get global support status (for dashboard badge)
router.get('/support/status', async (req, res) => {
    try {
        const unresolved = await db.count(
            'support_messages',
            'admin_id = ? AND center_id = ? AND status != ?',
            [req.user.user_id, req.user.center_id, 'resolved']
        );

        const latest_status = await db.queryOne(`
            SELECT status, updated_at
            FROM support_messages
            WHERE admin_id = ? AND center_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
        `, [req.user.user_id, req.user.center_id]);

        res.json({
            success: true,
            data: {
                unresolved_count: unresolved,
                latest_status: latest_status ? latest_status.status : null,
                last_update: latest_status ? latest_status.updated_at : null
            }
        });
    } catch (error) {
        console.error('Get support status error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
