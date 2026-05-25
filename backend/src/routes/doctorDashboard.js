/**
 * Doctor Dashboard Routes
 */

const express = require('express');
const db = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { syncPatientToSupabase, shouldSyncToSupabase } = require('../services/supabaseSync');

const router = express.Router();

// Public debug endpoint (no auth) to list all pending exams for troubleshooting only.
// Remove or protect in production.
router.get('/debug/pending-all-public', async (req, res) => {
    try {
        const exams = await db.query(`
            SELECT e.id, e.created_at, e.eye, e.notes, e.image_path, e.is_new_for_doctor, e.doctor_id,
                   p.id as patient_id, p.full_name, p.medical_record_number, p.date_of_birth, p.notes as medical_history
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            WHERE e.grade = -1
            ORDER BY e.created_at DESC
        `, []);

        const result = exams.map((exam) => {
            let age = null;
            if (exam.date_of_birth) {
                age = Math.floor((new Date() - new Date(exam.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
            }

            return {
                id: exam.id,
                patient_id: exam.patient_id,
                patient_name: exam.full_name,
                patient_age: age,
                medical_record_number: exam.medical_record_number,
                medical_history: exam.medical_history,
                eye_type: exam.eye,
                notes: exam.notes,
                image_url: `/uploads/${toUrlPath(exam.image_path)}`,
                image_display_url: `/api/exams/${exam.id}/preview-image`,
                created_at: exam.created_at,
                doctor_id: exam.doctor_id,
                status: exam.is_new_for_doctor ? 'nouveau' : 'en_attente'
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Debug pending-all-public error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

router.use(authMiddleware);
router.use(roleMiddleware('doctor'));

// DEBUG: Unauthenticated endpoint to list all pending exams (grade = -1)
// Used only for troubleshooting UI issues. Remove before production.
router.get('/debug/pending-all', async (req, res) => {
    try {
        const exams = await db.query(`
            SELECT e.id, e.created_at, e.eye, e.notes, e.image_path, e.is_new_for_doctor, e.doctor_id,
                   p.id as patient_id, p.full_name, p.medical_record_number, p.date_of_birth, p.notes as medical_history
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            WHERE e.grade = -1
            ORDER BY e.created_at DESC
        `, []);

        const result = exams.map((exam) => {
            let age = null;
            if (exam.date_of_birth) {
                age = Math.floor((new Date() - new Date(exam.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
            }

            return {
                id: exam.id,
                patient_id: exam.patient_id,
                patient_name: exam.full_name,
                patient_age: age,
                medical_record_number: exam.medical_record_number,
                medical_history: exam.medical_history,
                eye_type: exam.eye,
                notes: exam.notes,
                image_url: `/uploads/${toUrlPath(exam.image_path)}`,
                image_display_url: `/api/exams/${exam.id}/preview-image`,
                created_at: exam.created_at,
                doctor_id: exam.doctor_id,
                status: exam.is_new_for_doctor ? 'nouveau' : 'en_attente'
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Debug pending-all error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

const GRADE_LABELS = {
    0: 'Pas de RD',
    1: 'RD Legere',
    2: 'RD Moderee',
    3: 'RD Severe',
    4: 'RD Proliferante'
};

const GRADE_CLASSES = {
    0: 'badge-success',
    1: 'badge-info',
    2: 'badge-warning',
    3: 'badge-danger',
    4: 'badge-critical'
};

const toUrlPath = (filePath) => {
    if (!filePath) return null;
    let normalized = String(filePath).replace(/\\/g, '/');
    const uploadsMarker = '/uploads/';
    const markerIndex = normalized.lastIndexOf(uploadsMarker);
    if (markerIndex >= 0) {
        normalized = normalized.substring(markerIndex + uploadsMarker.length);
    }
    if (normalized.startsWith('uploads/')) {
        normalized = normalized.substring('uploads/'.length);
    }
    normalized = normalized.replace(/^\/+/, '').replace(/^\.\//, '');
    return normalized;
};

const fs = require('fs');

const toVersionedUrlPath = (filePath) => {
    const normalized = toUrlPath(filePath);
    if (!normalized) return null;
    return `/uploads/${normalized}?v=${Date.now()}`;
};

const fileExists = (relativePath) => {
    try {
        const abs = path.join(__dirname, '../../', relativePath);
        return fs.existsSync(abs);
    } catch (e) {
        return false;
    }
};

const normalizeConfidence = (value, grade) => {
    const v = parseFloat(value) || 0;
    if (grade === -1) return 0;
    return Math.max(60.1, v);
};

const splitPatientName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || ''
    };
};

const composeMedicalHistory = (selectedAntecedents = [], manualNotes = '') => {
    const parts = [];
    const standards = selectedAntecedents
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    const manual = String(manualNotes || '').trim();

    if (standards.length > 0) {
        parts.push(`Antécédents standards: ${standards.join(', ')}`);
    }

    if (manual) {
        parts.push(manual);
    }

    return parts.join('\n');
};

const buildDoctorPatientRecordNumber = async (doctorId, doctorCode) => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `${doctorCode}_${today}_`;
    const row = await db.queryOne(
        `SELECT MAX(CAST(SUBSTR(medical_record_number, LENGTH(?) + 11) AS INTEGER)) AS max_seq
         FROM patients
         WHERE created_by_doctor_id = ? AND medical_record_number LIKE ?`,
        [doctorCode, doctorId, `${prefix}%`]
    );
    const nextSeq = ((row && row.max_seq) || 0) + 1;
    return `${doctorCode}_${today}_${String(nextSeq).padStart(3, '0')}`;
};

const formatDoctorPatient = (patient) => {
    const nameParts = splitPatientName(patient.full_name);
    // For doctor view: show 'nouveau' if new exams, else 'en_attente'
    const doctorDossierStatus = patient.new_count > 0 ? 'nouveau' : 'en_attente';
    let age = null;
    if (patient.date_of_birth) {
        age = Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
    }
    return {
        id: patient.id,
        medical_record_number: patient.medical_record_number,
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        full_name: patient.full_name,
        address: patient.address || '',
        phone: patient.phone || null,
        email: patient.email || null,
        birth_date: patient.date_of_birth || null,
        age: age,
        gender: patient.gender || null,
        medical_history: patient.notes || '',
        dossier_status: doctorDossierStatus,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        exam_count: Number(patient.exam_count) || 0,
        last_exam_date: patient.last_exam_date || null
    };
};

// GET /api/doctor/patients-summary
router.get('/patients-summary', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 50;
        const search = req.query.search || '';

        let where = `(
            p.created_by_doctor_id = ?
            OR EXISTS (
                SELECT 1
                FROM exams e0
                WHERE e0.patient_id = p.id
                  AND e0.doctor_id = ?
                  AND (e0.grade = -1 OR (e0.grade >= 0 AND COALESCE(e0.is_new_for_doctor, 0) = 1))
            )
        )`;
        let params = [doctorId, doctorId];

        if (search) {
            where += ' AND (p.full_name LIKE ? OR p.medical_record_number LIKE ? OR p.address LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const countRow = await db.queryOne(`
            SELECT COUNT(*) as count
            FROM patients p
            JOIN centers c ON p.center_id = c.id
            WHERE ${where}
        `, params);
        const total = countRow ? countRow.count : 0;

        const offset = (page - 1) * perPage;
        const rows = await db.query(`
            SELECT
                p.id as patient_id,
                p.full_name,
                p.medical_record_number,
                p.address,
                p.date_of_birth,
                p.dossier_status,
                p.created_by_doctor_id,
                p.created_at,
                (
                    SELECT e2.id
                    FROM exams e2
                    WHERE e2.patient_id = p.id
                      AND e2.doctor_id = ?
                      AND e2.grade >= 0
                    ORDER BY e2.created_at DESC
                    LIMIT 1
                ) as last_exam_id,
                (
                    SELECT e2.grade
                    FROM exams e2
                    WHERE e2.patient_id = p.id
                      AND e2.doctor_id = ?
                      AND e2.grade >= 0
                    ORDER BY e2.created_at DESC
                    LIMIT 1
                ) as last_grade,
                (
                    SELECT e2.confidence
                    FROM exams e2
                    WHERE e2.patient_id = p.id
                      AND e2.doctor_id = ?
                      AND e2.grade >= 0
                    ORDER BY e2.created_at DESC
                    LIMIT 1
                ) as last_confidence,
                (
                    SELECT e2.eye
                    FROM exams e2
                    WHERE e2.patient_id = p.id
                      AND e2.doctor_id = ?
                      AND e2.grade >= 0
                    ORDER BY e2.created_at DESC
                    LIMIT 1
                ) as last_eye,
                (
                    SELECT e2.created_at
                    FROM exams e2
                    WHERE e2.patient_id = p.id
                      AND e2.doctor_id = ?
                      AND e2.grade >= 0
                    ORDER BY e2.created_at DESC
                    LIMIT 1
                ) as last_exam_date,
                (
                    SELECT COUNT(*)
                    FROM exams ep
                    WHERE ep.patient_id = p.id
                      AND ep.doctor_id = ?
                      AND ep.grade = -1
                ) as pending_count,
                (
                    SELECT COUNT(*)
                    FROM exams en
                    WHERE en.patient_id = p.id
                      AND en.doctor_id = ?
                      AND en.grade >= 0
                      AND COALESCE(en.is_new_for_doctor, 0) = 1
                ) as new_count,
                (
                    SELECT en.id
                    FROM exams en
                    WHERE en.patient_id = p.id
                      AND en.doctor_id = ?
                      AND en.grade >= 0
                      AND COALESCE(en.is_new_for_doctor, 0) = 1
                    ORDER BY en.created_at DESC
                    LIMIT 1
                ) as latest_new_exam_id,
                (
                    SELECT en.created_at
                    FROM exams en
                    WHERE en.patient_id = p.id
                      AND en.doctor_id = ?
                      AND en.grade >= 0
                      AND COALESCE(en.is_new_for_doctor, 0) = 1
                    ORDER BY en.created_at DESC
                    LIMIT 1
                ) as latest_new_exam_date,
                (
                    SELECT ep.id
                    FROM exams ep
                    WHERE ep.patient_id = p.id
                      AND ep.doctor_id = ?
                      AND ep.grade = -1
                    ORDER BY ep.created_at DESC
                    LIMIT 1
                ) as latest_pending_exam_id,
                (
                    SELECT ep.created_at
                    FROM exams ep
                    WHERE ep.patient_id = p.id
                      AND ep.doctor_id = ?
                      AND ep.grade = -1
                    ORDER BY ep.created_at DESC
                    LIMIT 1
                ) as latest_pending_date,
                (
                    SELECT COUNT(*)
                    FROM exams et
                    WHERE et.patient_id = p.id
                      AND et.doctor_id = ?
                ) as total_exam_count
            FROM patients p
            WHERE ${where}
            ORDER BY datetime(COALESCE(latest_new_exam_date, latest_pending_date, last_exam_date, p.created_at)) DESC
            LIMIT ? OFFSET ?
        `, [doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, doctorId, ...params, perPage, offset]);

        const patients = rows.map((row) => {
            let age = null;
            if (row.date_of_birth) {
                age = Math.floor((new Date() - new Date(row.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
            }
            const gradeValue = row.last_grade === null || row.last_grade === undefined
                ? null
                : parseInt(row.last_grade);
            const pendingCount = parseInt(row.pending_count) || 0;
            const newCount = parseInt(row.new_count) || 0;
            const totalExamCount = parseInt(row.total_exam_count) || 0;
            const centerDossierStatus = String(row.dossier_status || '').trim();
            
            // Status logic:
            // - "en_attente" = patient created by doctor but has NO exams yet
            // - "nouveau" = patient has new exams (is_new_for_doctor = 1)
            // - "consulte" = patient has been consulted (all exams viewed)
            const dossierStatus = centerDossierStatus === 'en_attente'
                ? 'en_attente'
                : (row.created_by_doctor_id === doctorId && totalExamCount === 0)
                ? 'en_attente'
                : (newCount > 0 ? 'nouveau' : 'consulte');
            
            console.log(`[DOSSIER_STATUS] Patient: ${row.full_name} (ID: ${row.patient_id}), created_by_doctor: ${row.created_by_doctor_id}, doctorId: ${doctorId}, totalExams: ${totalExamCount}, newCount: ${newCount}, status: ${dossierStatus}`);
            
            return {
                patient_id: row.patient_id,
                patient_name: row.full_name,
                patient_age: age,
                medical_record_number: row.medical_record_number,
                address: row.address,
                last_exam_id: row.last_exam_id,
                grade: gradeValue,
                grade_label: gradeValue === null ? 'En attente' : GRADE_LABELS[gradeValue],
                grade_class: gradeValue === null ? 'badge-info' : GRADE_CLASSES[gradeValue],
                confidence: parseFloat(row.last_confidence) || 0,
                is_urgent: gradeValue !== null && gradeValue >= 3,
                eye_type: row.last_eye,
                has_new_exam: !!row.latest_new_exam_id || newCount > 0,
                latest_new_exam_id: row.latest_new_exam_id,
                pending_count: pendingCount,
                pending_exam_id: row.latest_pending_exam_id,
                dossier_status: dossierStatus,
                created_at: row.latest_new_exam_date || row.latest_pending_date || row.last_exam_date || row.created_at
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
        console.error('Get doctor patients summary error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/patients/managed
router.get('/patients/managed', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const perPage = Math.min(50, Math.max(5, parseInt(req.query.per_page, 10) || 20));
        const search = String(req.query.search || '').trim();

        let where = 'p.created_by_doctor_id = ?';
        const params = [doctorId];

        if (search) {
            where += ' AND (p.full_name LIKE ? OR p.medical_record_number LIKE ? OR p.address LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const totalRow = await db.queryOne(
            `SELECT COUNT(*) AS count FROM patients p WHERE ${where}`,
            params
        );

        const offset = (page - 1) * perPage;
        const rows = await db.query(`
            SELECT p.*, 
                   (SELECT COUNT(*) FROM exams e WHERE e.patient_id = p.id AND e.doctor_id = ?) AS exam_count,
                   (SELECT MAX(created_at) FROM exams e WHERE e.patient_id = p.id AND e.doctor_id = ?) AS last_exam_date
            FROM patients p
            WHERE ${where}
            ORDER BY datetime(p.created_at) DESC
            LIMIT ? OFFSET ?
        `, [doctorId, doctorId, ...params, perPage, offset]);

        res.json({
            success: true,
            data: {
                patients: (rows || []).map(formatDoctorPatient),
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total: totalRow ? totalRow.count : 0,
                    total_pages: Math.ceil((totalRow ? totalRow.count : 0) / perPage)
                }
            }
        });
    } catch (error) {
        console.error('Get managed patients error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/patients/:id
router.get('/patients/:id', async (req, res) => {
    try {
        const doctorId = req.user.user_id;

        const patient = await db.queryOne(`
            SELECT p.*, c.name as center_name
            FROM patients p
            JOIN centers c ON p.center_id = c.id
            WHERE p.id = ? AND p.center_id = ?
              AND (
                    p.created_by_doctor_id = ?
                    OR EXISTS(
                        SELECT 1 FROM exams e WHERE e.patient_id = p.id AND e.doctor_id = ?
                    )
                  )
        `, [req.params.id, req.user.center_id, doctorId, doctorId]);

        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }

        // Check if there are new exams BEFORE marking them as read
        const newExamsCount = await db.queryOne(
            `SELECT COUNT(*) as count FROM exams
             WHERE patient_id = ? AND doctor_id = ? AND grade >= 0 AND COALESCE(is_new_for_doctor, 0) = 1`,
            [req.params.id, doctorId]
        );
        const hasNewExams = newExamsCount && newExamsCount.count > 0;

        // Mark exams as read for this patient
        await db.query(
            `UPDATE exams
             SET is_new_for_doctor = 0
             WHERE patient_id = ? AND doctor_id = ? AND grade >= 0 AND COALESCE(is_new_for_doctor, 0) = 1`,
            [req.params.id, doctorId]
        );

        const exams = await db.query(`
            SELECT e.id, e.grade, e.confidence, e.eye, e.created_at, e.notes, e.image_path
            FROM exams e
            WHERE e.patient_id = ? AND e.doctor_id = ?
            ORDER BY e.created_at ASC
        `, [req.params.id, doctorId]);

        const nameParts = splitPatientName(patient.full_name);
        // For doctor view: show 'nouveau' if had new exams, else 'en_attente'
        const doctorDossierStatus = hasNewExams ? 'nouveau' : 'en_attente';

        res.json({
            success: true,
            data: {
                id: patient.id,
                first_name: nameParts.first_name,
                last_name: nameParts.last_name,
                full_name: patient.full_name,
                medical_record_number: patient.medical_record_number,
                birth_date: patient.date_of_birth,
                gender: patient.gender,
                phone: patient.phone,
                email: patient.email,
                address: patient.address,
                medical_history: patient.notes,
                dossier_status: doctorDossierStatus,
                center_name: patient.center_name,
                exams: exams.map(e => ({
                    id: e.id,
                    grade: e.grade,
                    grade_label: e.grade >= 0 ? GRADE_LABELS[e.grade] : 'Nouveau',
                    confidence: e.confidence,
                    eye_type: e.eye,
                    notes: e.notes,
                    exam_date: e.created_at,
                    created_at: e.created_at,
                    image_url: e.image_path ? `/uploads/${toUrlPath(e.image_path)}` : null
                })),
                created_at: patient.created_at
            }
        });
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/doctor/patients/:id/request-exam
// Re-open the patient dossier for the center admin so a new exam can be prepared.
router.post('/patients/:id/request-exam', async (req, res) => {
    try {
        const doctorId = req.user.user_id;

        const patient = await db.queryOne(
            `SELECT p.id, p.full_name, p.dossier_status
             FROM patients p
             WHERE p.id = ? AND p.center_id = ?
               AND (
                    p.created_by_doctor_id = ?
                    OR EXISTS(
                        SELECT 1 FROM exams e WHERE e.patient_id = p.id AND e.doctor_id = ?
                    )
               )`,
            [req.params.id, req.user.center_id, doctorId, doctorId]
        );

        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }

        if (patient.dossier_status !== 'en_attente') {
            await db.update(
                'patients',
                { dossier_status: 'en_attente' },
                'id = ? AND center_id = ?',
                [req.params.id, req.user.center_id]
            );
        }

        res.json({
            success: true,
            message: 'Demande envoyée au centre. Le dossier est maintenant en attente.',
            data: {
                patient_id: patient.id,
                full_name: patient.full_name,
                dossier_status: 'en_attente'
            }
        });
    } catch (error) {
        console.error('Request exam error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/doctor/patients
router.post('/patients', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const doctor = await db.queryOne(
            'SELECT id, doctor_code, center_id FROM users WHERE id = ? AND role = ? AND center_id = ?',
            [doctorId, 'doctor', req.user.center_id]
        );

        if (!doctor) {
            return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
        }

        const firstName = String(req.body?.first_name || '').trim();
        const lastName = String(req.body?.last_name || '').trim();
        const address = String(req.body?.address || '').trim();
        const medicalHistory = String(req.body?.medical_history || '').trim();
        const standardAntecedents = Array.isArray(req.body?.standard_antecedents)
            ? req.body.standard_antecedents
            : (req.body?.standard_antecedents ? [req.body.standard_antecedents] : []);
        const manualMedicalHistory = String(req.body?.manual_medical_history || '').trim();

        if (!firstName || !lastName) {
            return res.status(400).json({ success: false, error: 'Prénom et nom requis' });
        }

        const fullName = `${firstName} ${lastName}`.trim();
        const existing = await db.queryOne(
            `SELECT id FROM patients
             WHERE center_id = ? AND created_by_doctor_id = ? AND LOWER(TRIM(full_name)) = LOWER(TRIM(?))`,
            [req.user.center_id, doctorId, fullName]
        );

        if (existing) {
            return res.status(409).json({ success: false, error: 'Un patient avec ce nom existe déjà' });
        }

        const medicalRecordNumber = await buildDoctorPatientRecordNumber(doctorId, doctor.doctor_code);
        const notes = medicalHistory || composeMedicalHistory(standardAntecedents, manualMedicalHistory);

        // Accept birth_date (ISO yyyy-mm-dd) and gender ('M'|'F') from the client
        const birthDate = String(req.body?.birth_date || '').trim() || null;
        const gender = String(req.body?.gender || '').trim() || null;

        const patientId = await db.insert('patients', {
            center_id: req.user.center_id,
            created_by_doctor_id: doctorId,
            medical_record_number: medicalRecordNumber,
            dossier_status: 'en_attente',
            full_name: fullName,
            address: address || null,
            phone: req.body?.phone ? String(req.body.phone).trim() : null,
            email: req.body?.email ? String(req.body.email).trim() : null,
            notes: notes || null,
            date_of_birth: birthDate,
            gender: gender || null
        });

        const patient = await db.queryOne(
            'SELECT * FROM patients WHERE id = ? AND created_by_doctor_id = ? AND center_id = ?',
            [patientId, doctorId, req.user.center_id]
        );

        if (await shouldSyncToSupabase(req.user.center_id)) {
            await syncPatientToSupabase(patient);
        }

        res.status(201).json({ success: true, data: formatDoctorPatient(patient) });
    } catch (error) {
        console.error('Create doctor patient error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/doctor/patients/:id
router.put('/patients/:id', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const patient = await db.queryOne(
            'SELECT * FROM patients WHERE id = ? AND created_by_doctor_id = ? AND center_id = ?',
            [req.params.id, doctorId, req.user.center_id]
        );

        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }

        const firstName = String(req.body?.first_name || '').trim();
        const lastName = String(req.body?.last_name || '').trim();
        const address = String(req.body?.address || '').trim();
        const medicalHistory = String(req.body?.medical_history || '').trim();
        const standardAntecedents = Array.isArray(req.body?.standard_antecedents)
            ? req.body.standard_antecedents
            : (req.body?.standard_antecedents ? [req.body.standard_antecedents] : []);
        const manualMedicalHistory = String(req.body?.manual_medical_history || '').trim();

        const currentName = splitPatientName(patient.full_name);
        const updateData = {};
        if (firstName || lastName) {
            updateData.full_name = `${firstName || currentName.first_name} ${lastName || currentName.last_name}`.trim();
        }
        if (address !== undefined) {
            updateData.address = address || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
            updateData.phone = req.body.phone ? String(req.body.phone).trim() : null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
            updateData.email = req.body.email ? String(req.body.email).trim() : null;
        }
        if (medicalHistory || standardAntecedents.length > 0 || manualMedicalHistory) {
            updateData.notes = medicalHistory || composeMedicalHistory(standardAntecedents, manualMedicalHistory);
        }

        // Allow updating birth date and gender (explicit presence check so empty string can clear value)
        if (Object.prototype.hasOwnProperty.call(req.body, 'birth_date')) {
            updateData.date_of_birth = req.body.birth_date ? String(req.body.birth_date).trim() : null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'gender')) {
            updateData.gender = req.body.gender ? String(req.body.gender).trim() : null;
        }

        if (Object.keys(updateData).length > 0) {
            await db.update('patients', updateData, 'id = ? AND created_by_doctor_id = ?', [req.params.id, doctorId]);
        }

        const updated = await db.queryOne(
            'SELECT * FROM patients WHERE id = ? AND created_by_doctor_id = ? AND center_id = ?',
            [req.params.id, doctorId, req.user.center_id]
        );

        if (await shouldSyncToSupabase(req.user.center_id)) {
            await syncPatientToSupabase(updated);
        }

        res.json({ success: true, data: formatDoctorPatient(updated) });
    } catch (error) {
        console.error('Update doctor patient error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// DELETE /api/doctor/patients/:id
router.delete('/patients/:id', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const patient = await db.queryOne(
            'SELECT id FROM patients WHERE id = ? AND created_by_doctor_id = ? AND center_id = ?',
            [req.params.id, doctorId, req.user.center_id]
        );

        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }

        await db.delete('patients', 'id = ? AND created_by_doctor_id = ?', [req.params.id, doctorId]);

        res.json({ success: true, message: 'Patient supprimé' });
    } catch (error) {
        console.error('Delete doctor patient error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/exams
router.get('/exams', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 20;
        const search = req.query.search || '';
        const grade = req.query.grade;

        let where = 'e.doctor_id = ?';
        let params = [doctorId];

        if (search) {
            where += ' AND (p.full_name LIKE ? OR p.medical_record_number LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (grade !== undefined && grade !== '') {
            where += ' AND e.grade = ?';
            params.push(parseInt(grade));
        }

        const countResult = await db.queryOne(`
            SELECT COUNT(*) as count
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            WHERE ${where}
        `, params);
        const total = countResult.count;

        const offset = (page - 1) * perPage;
        const exams = await db.query(`
            SELECT e.id, e.patient_id, e.grade, e.confidence, e.created_at, e.eye,
                   p.full_name, p.medical_record_number, p.date_of_birth
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            WHERE ${where}
            ORDER BY e.grade DESC, e.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, perPage, offset]);

        const result = exams.map(exam => {
            let age = null;
            if (exam.date_of_birth) {
                age = Math.floor((new Date() - new Date(exam.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
            }

            return {
                id: exam.id,
                patient_id: exam.patient_id,
                patient_name: exam.full_name,
                patient_age: age,
                medical_record_number: exam.medical_record_number,
                grade: exam.grade,
                grade_label: GRADE_LABELS[exam.grade],
                grade_class: GRADE_CLASSES[exam.grade],
                confidence: parseFloat(exam.confidence) || 0,
                is_urgent: exam.grade >= 3,
                eye_type: exam.eye,
                created_at: exam.created_at
            };
        });

        res.json({
            success: true,
            data: {
                exams: result,
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total,
                    total_pages: Math.ceil(total / perPage)
                }
            }
        });
    } catch (error) {
        console.error('Get doctor exams error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/exams/:id
router.get('/exams/:id', async (req, res) => {
    try {
        const exam = await db.queryOne(`
            SELECT e.*, c.name as center_name,
                   p.full_name as patient_name,
                   p.medical_record_number, p.date_of_birth, p.gender,
                   p.phone as patient_phone, p.email as patient_email,
                   p.notes as medical_notes, p.diabetes_type, p.diabetic_years,
                   p.address as patient_address
            FROM exams e
            JOIN centers c ON e.center_id = c.id
            JOIN patients p ON e.patient_id = p.id
            WHERE e.id = ? AND e.doctor_id = ?
        `, [req.params.id, req.user.user_id]);

        if (!exam) {
            return res.status(404).json({ success: false, error: 'Examen non trouvé' });
        }

        await db.update('exams', { is_new_for_doctor: 0 }, 'id = ? AND doctor_id = ?', [req.params.id, req.user.user_id]);

        const nameParts = (exam.patient_name || '').split(' ');

        const medicalHistory = [];
        if (exam.diabetes_type) {
            const diabetesLabels = {
                type1: 'Diabète de Type 1',
                type2: 'Diabète de Type 2',
                gestational: 'Diabète gestationnel',
                other: 'Autre type de diabète'
            };
            medicalHistory.push(`• ${diabetesLabels[exam.diabetes_type] || exam.diabetes_type}`);
        }
        if (exam.diabetic_years) {
            medicalHistory.push(`• Durée du diabète: ${exam.diabetic_years} ans`);
        }
        if (exam.medical_notes) {
            medicalHistory.push(`• Notes: ${exam.medical_notes}`);
        }

        let pairedExamData = null;
        let oppositeEye = null;
        if (exam.eye === 'left') oppositeEye = 'right';
        else if (exam.eye === 'right') oppositeEye = 'left';

        if (oppositeEye) {
            const pairedExam = await db.queryOne(`
                SELECT id, grade, confidence, eye, created_at, image_path, heatmap_path,
                       ABS(strftime('%s', created_at) - strftime('%s', ?)) AS time_diff_seconds
                FROM exams
                WHERE patient_id = ?
                  AND doctor_id = ?
                  AND eye = ?
                  AND grade >= 0
                  AND id <> ?
                ORDER BY time_diff_seconds ASC, created_at DESC
                LIMIT 1
            `, [exam.created_at, exam.patient_id, req.user.user_id, oppositeEye, exam.id]);

            const pairingWindowSeconds = 15 * 60;
            const isSameSession = pairedExam
                && Number.isFinite(Number(pairedExam.time_diff_seconds))
                && Number(pairedExam.time_diff_seconds) <= pairingWindowSeconds;

            if (isSameSession) {
                pairedExamData = {
                    exists: true,
                    id: pairedExam.id,
                    eye_type: pairedExam.eye,
                    grade: pairedExam.grade,
                    grade_label: GRADE_LABELS[pairedExam.grade],
                    grade_class: GRADE_CLASSES[pairedExam.grade],
                    confidence: normalizeConfidence(pairedExam.confidence, pairedExam.grade),
                    created_at: pairedExam.created_at,
                    image_url: `/uploads/${toUrlPath(pairedExam.image_path)}`,
                    image_display_url: `/api/exams/${pairedExam.id}/preview-image`,
                        heatmap_url: toVersionedUrlPath(pairedExam.heatmap_path || pairedExam.image_path)
                };
            } else {
                pairedExamData = { exists: false, eye_type: oppositeEye };
            }
        }

        res.json({
            success: true,
            data: {
                id: exam.id,
                grade: exam.grade,
                confidence: normalizeConfidence(exam.confidence, exam.grade),
                eye_type: exam.eye,
                notes: exam.notes,
                doctor_report_notes: exam.doctor_report_notes,
                image_url: `/uploads/${toUrlPath(exam.image_path)}`,
                image_display_url: `/api/exams/${exam.id}/preview-image`,
                heatmap_url: toVersionedUrlPath(exam.heatmap_path || exam.image_path),
                image_preview_url: (function() {
                    try {
                        const previewRel = String(exam.image_path || '').replace(/\.[^.]+$/, '_preview.jpg');
                        if (previewRel && fs.existsSync(path.join(__dirname, '../../', previewRel))) {
                            return `/uploads/${toUrlPath(previewRel)}?v=${Date.now()}`;
                        }
                    } catch (e) {}
                    return null;
                })(),
                overlay_url: null,
                center: { id: exam.center_id, name: exam.center_name },
                patient: {
                    id: exam.patient_id,
                    first_name: nameParts[0] || '',
                    last_name: nameParts.slice(1).join(' ') || '',
                    medical_record_number: exam.medical_record_number,
                    birth_date: exam.date_of_birth,
                    gender: exam.gender,
                    phone: exam.patient_phone,
                    email: exam.patient_email,
                    medical_history: medicalHistory.length > 0 ? medicalHistory.join('\n') : 'Aucun antécédent renseigné',
                    diabetes_type: exam.diabetes_type,
                    diabetic_years: exam.diabetic_years,
                    address: exam.patient_address
                },
                created_at: exam.created_at,
                paired_exam: pairedExamData
            }
        });
    } catch (error) {
        console.error('Get exam detail error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/doctor/exams/:id/report
router.put('/exams/:id/report', async (req, res) => {
    try {
        const examId = req.params.id;
        const doctorId = req.user.user_id;
        const doctorReportNotes = String(req.body?.doctor_report_notes || '').trim();

        const exam = await db.queryOne('SELECT id FROM exams WHERE id = ? AND doctor_id = ?', [examId, doctorId]);
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Examen non trouvé' });
        }

        await db.update('exams', { doctor_report_notes: doctorReportNotes || null }, 'id = ? AND doctor_id = ?', [examId, doctorId]);

        res.json({
            success: true,
            data: { id: Number(examId), doctor_report_notes: doctorReportNotes }
        });
    } catch (error) {
        console.error('Save doctor report error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/stats
router.get('/stats', async (req, res) => {
    try {
        const doctorId = req.user.user_id;

        const totalExams = await db.count('exams', 'doctor_id = ? AND grade >= 0', [doctorId]);
        const pendingExams = await db.count('exams', 'doctor_id = ? AND grade = -1', [doctorId]);
        const severeCases = await db.count('exams', 'doctor_id = ? AND grade >= 3', [doctorId]);
        const unreadAlerts = await db.count('alerts', 'doctor_id = ? AND read_at IS NULL AND resolved_at IS NULL', [doctorId]);

        const today = new Date().toISOString().split('T')[0];
        const examsToday = await db.count('exams', 'doctor_id = ? AND DATE(created_at) = ?', [doctorId, today]);

        const gradeDistribution = await db.query(`
            SELECT grade, COUNT(*) as count
            FROM exams
            WHERE doctor_id = ? AND grade >= 0
            GROUP BY grade
            ORDER BY grade
        `, [doctorId]);

        const distribution = [];
        for (let i = 0; i <= 4; i++) {
            const found = gradeDistribution.find((g) => g.grade === i);
            distribution.push({ grade: i, label: GRADE_LABELS[i], count: found ? found.count : 0 });
        }

        const weeklyTrend = await db.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM exams
            WHERE doctor_id = ? AND created_at >= date('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [doctorId]);

        res.json({
            success: true,
            data: {
                total_exams: totalExams,
                pending_exams: pendingExams,
                severe_cases: severeCases,
                unread_alerts: unreadAlerts,
                exams_today: examsToday,
                grade_distribution: distribution,
                weekly_trend: weeklyTrend
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/pending
router.get('/pending', async (req, res) => {
    try {
        const doctorId = req.user.user_id;

        const exams = await db.query(`
            SELECT e.id, e.created_at, e.eye, e.notes, e.image_path, e.is_new_for_doctor,
                   p.id as patient_id, p.full_name, p.medical_record_number, p.date_of_birth, p.notes as medical_history
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            WHERE e.doctor_id = ? AND e.grade = -1
            ORDER BY e.created_at DESC
        `, [doctorId]);

        const result = exams.map((exam) => {
            let age = null;
            if (exam.date_of_birth) {
                age = Math.floor((new Date() - new Date(exam.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000));
            }

            return {
                id: exam.id,
                patient_id: exam.patient_id,
                patient_name: exam.full_name,
                patient_age: age,
                medical_record_number: exam.medical_record_number,
                medical_history: exam.medical_history,
                eye_type: exam.eye,
                notes: exam.notes,
                image_url: `/uploads/${toUrlPath(exam.image_path)}`,
                image_display_url: `/api/exams/${exam.id}/preview-image`,
                created_at: exam.created_at,
                status: exam.is_new_for_doctor ? 'nouveau' : 'en_attente'
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Get pending exams error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
