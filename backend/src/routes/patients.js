/**
 * Patient Routes
 */

const express = require('express');
const db = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user.impersonated_by_superadmin) {
        res.status(403).json({ success: false, error: 'Action non autorisée en mode impersonation' });
    } else {
        next();
    }
});
router.use(roleMiddleware('center_admin'));

// GET /api/patients/center/info
router.get('/center/info', async (req, res) => {
    try {
        const center = await db.queryOne(
            'SELECT id, name, address, phone, email FROM centers WHERE id = ?',
            [req.user.center_id]
        );
        
        if (!center) {
            return res.status(404).json({ success: false, error: 'Centre non trouvé' });
        }
        
        res.json({ success: true, data: center });
        
    } catch (error) {
        console.error('Get center info error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/patients
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 20;
        const search = req.query.search || '';
        const centerId = req.user.center_id;
        
        let where = 'center_id = ?';
        let params = [centerId];
        
        if (search) {
            where += ' AND (full_name LIKE ? OR medical_record_number LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        // Get total count
        const total = await db.count('patients', where, params);
        
        // Get patients
        const offset = (page - 1) * perPage;
        const patientsRaw = await db.query(`
            SELECT p.*,
                   (SELECT COUNT(*) FROM exams WHERE patient_id = p.id) as exam_count,
                   (SELECT MAX(created_at) FROM exams WHERE patient_id = p.id) as last_exam_date
            FROM patients p
            WHERE ${where}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, perPage, offset]);

        // Transform to match frontend expectations (first_name, last_name, birth_date, last_exam)
        const patients = patientsRaw.map(p => {
            const nameParts = (p.full_name || '').split(' ');
            return {
                id: p.id,
                medical_record_number: p.medical_record_number,
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                birth_date: p.date_of_birth,
                gender: p.gender,
                phone: p.phone,
                email: p.email,
                address: p.address,
                medical_history: p.notes,
                last_exam: p.last_exam_date,
                exam_count: p.exam_count
            };
        });

        res.json({
            success: true,
            data: {
                patients,
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total,
                    total_pages: Math.ceil(total / perPage)
                }
            }
        });
        
    } catch (error) {
        console.error('Get patients error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/patients/:id
router.get('/:id', async (req, res) => {
    try {
        const patientRow = await db.queryOne(
            'SELECT * FROM patients WHERE id = ? AND center_id = ?',
            [req.params.id, req.user.center_id]
        );
        
        if (!patientRow) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }
        
        // Get exams
        const exams = await db.query(
            'SELECT id, grade, confidence, created_at FROM exams WHERE patient_id = ? ORDER BY created_at DESC',
            [patientRow.id]
        );
        
        const nameParts = (patientRow.full_name || '').split(' ');
        const patient = {
            id: patientRow.id,
            medical_record_number: patientRow.medical_record_number,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            birth_date: patientRow.date_of_birth,
            gender: patientRow.gender,
            phone: patientRow.phone,
            email: patientRow.email,
            address: patientRow.address,
            medical_history: patientRow.notes,
            exams
        };
        
        res.json({ success: true, data: patient });
        
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/patients
router.post('/', async (req, res) => {
    return res.status(403).json({
        success: false,
        error: 'La création de patients est réservée aux médecins dans leur tableau de bord.'
    });
});

// PUT /api/patients/:id
router.put('/:id', async (req, res) => {
    return res.status(403).json({
        success: false,
        error: 'La modification des patients est réservée aux médecins dans leur tableau de bord.'
    });
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res) => {
    return res.status(403).json({
        success: false,
        error: 'La suppression des patients est réservée aux médecins dans leur tableau de bord.'
    });
});

module.exports = router;
