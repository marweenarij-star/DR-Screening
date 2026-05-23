/**
 * Doctor Management Routes (for center admin)
 */

const express = require('express');
const db = require('../config/database');
const { authMiddleware, roleMiddleware, generateActivationToken } = require('../middleware/auth');
const { sendActivationEmail } = require('../services/mailService');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('center_admin'));

const DOCTOR_CODE_PATTERN = /^OPH\d{3}$/;

const generateDoctorCode = async (centerId) => {
    const row = await db.queryOne(
        `SELECT MAX(CAST(SUBSTR(doctor_code, 4) AS INTEGER)) as max_seq
         FROM users
         WHERE center_id = ? AND role = 'doctor' AND doctor_code LIKE 'OPH%'`,
        [centerId]
    );
    const next = ((row && row.max_seq) || 0) + 1;
    return `OPH${String(next).padStart(3, '0')}`;
};

// GET /api/doctors
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 20;
        const centerId = req.user.center_id;
        
        const total = await db.count('users', 'center_id = ? AND role = ?', [centerId, 'doctor']);
        
        const offset = (page - 1) * perPage;
        const doctorsRaw = await db.query(`
            SELECT u.id, u.email, u.name, u.identity, u.phone, u.address, u.role, u.speciality, u.doctor_code, u.account_status, u.created_at,
                   (SELECT COUNT(*) FROM exams WHERE doctor_id = u.id) as exam_count,
                   (SELECT MAX(created_at) FROM exams WHERE doctor_id = u.id) as last_exam_date
            FROM users u
            WHERE u.center_id = ? AND u.role = 'doctor'
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [centerId, perPage, offset]);
        
        // Transform to expected format
        const doctors = doctorsRaw.map(d => {
            const nameParts = (d.name || '').split(' ');
            return {
                ...d,
                specialty: d.speciality || null,
                doctor_code: d.doctor_code || null,
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || ''
            };
        });
        
        res.json({
            success: true,
            data: {
                doctors,
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total,
                    total_pages: Math.ceil(total / perPage)
                }
            }
        });
        
    } catch (error) {
        console.error('Get doctors error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctors/:id
router.get('/:id', async (req, res) => {
    try {
        const doctorRaw = await db.queryOne(
            `SELECT id, email, name, identity, phone, address, role, speciality, doctor_code, account_status, created_at 
             FROM users WHERE id = ? AND center_id = ? AND role = 'doctor'`,
            [req.params.id, req.user.center_id]
        );
        
        if (!doctorRaw) {
            return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
        }
        
        const nameParts = (doctorRaw.name || '').split(' ');
        const doctor = {
            ...doctorRaw,
            specialty: doctorRaw.speciality || null,
            doctor_code: doctorRaw.doctor_code || null,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || ''
        };
        
        res.json({ success: true, data: doctor });
        
    } catch (error) {
        console.error('Get doctor error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/doctors
router.post('/', async (req, res) => {
    try {
        const { email, identity, first_name, last_name, address, phone, specialty } = req.body;
        
        if (!email || !identity || !first_name || !last_name) {
            return res.status(400).json({
                success: false,
                error: 'Email, identité, prénom et nom sont requis'
            });
        }
        
        // Check if email exists
        const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Cet email est déjà utilisé'
            });
        }
        
        const { doctor_code } = req.body;

        let resolvedDoctorCode = (doctor_code || '').trim().toUpperCase();
        if (!resolvedDoctorCode) {
            resolvedDoctorCode = await generateDoctorCode(req.user.center_id);
        }

        if (!DOCTOR_CODE_PATTERN.test(resolvedDoctorCode)) {
            return res.status(400).json({
                success: false,
                error: 'Code médecin invalide (format attendu: OPH001)'
            });
        }

        const existingDoctorCode = await db.queryOne(
            `SELECT id FROM users
             WHERE center_id = ? AND role = 'doctor' AND doctor_code = ?`,
            [req.user.center_id, resolvedDoctorCode]
        );

        if (existingDoctorCode) {
            return res.status(400).json({
                success: false,
                error: 'Ce code médecin est déjà utilisé'
            });
        }
        
        // Generate activation token (valid for 24 hours)
        const activationToken = generateActivationToken({
            user_email: email,
            action: 'account_activation'
        });
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        const id = await db.insert('users', {
            center_id: req.user.center_id,
            identity: identity,
            email,
            name: `${first_name} ${last_name}`,
            doctor_code: resolvedDoctorCode,
            speciality: specialty || 'Ophtalmologie',
            address: address || null,
            phone: phone || null,
            role: 'doctor',
            account_status: 'pending',
            activation_token: activationToken,
            token_expires_at: expiresAt.toISOString(),
            password_hash: ''  // Will be set when doctor activates their account
        });
        
        // Construct activation link
        const activationLink = `${process.env.APP_URL || 'http://localhost:3000'}/activate/${activationToken}`;
        
        // Send activation email without blocking doctor creation.
        const emailPromise = sendActivationEmail(email, `${first_name} ${last_name}`, activationLink);
        emailPromise.catch((error) => {
            console.error('Activation email error:', error);
        });
        
        const doctorRaw = await db.queryOne(
            'SELECT id, email, name, identity, phone, role, speciality, doctor_code, address, account_status, created_at FROM users WHERE id = ?',
            [id]
        );
        
        const nameParts = (doctorRaw.name || '').split(' ');
        const doctor = {
            ...doctorRaw,
            specialty: doctorRaw.speciality || null,
            doctor_code: doctorRaw.doctor_code || null,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || ''
        };
        
        res.status(201).json({
            success: true,
            data: doctor,
            message: 'Médecin créé avec succès. Un lien d\'activation a été envoyé par email.',
            activation_email_sent: null,
            activation_email_queued: true,
            activation_link: activationLink
        });
        
    } catch (error) {
        console.error('Create doctor error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/doctors/:id
router.put('/:id', async (req, res) => {
    try {
        const doctor = await db.queryOne(
            `SELECT * FROM users WHERE id = ? AND center_id = ? AND role = 'doctor'`,
            [req.params.id, req.user.center_id]
        );
        
        if (!doctor) {
            return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
        }
        
        // Prevent password changes for pending accounts - they must use activation link
        if (doctor.account_status === 'pending' && req.body.password) {
            return res.status(403).json({
                success: false,
                error: 'Le mot de passe doit être défini via le lien d\'activation envoyé par email'
            });
        }
        
        const { email, password, first_name, last_name, phone, doctor_code, specialty, address } = req.body;
        
        const updateData = {};
        if (first_name || last_name) {
            updateData.name = `${first_name || ''} ${last_name || ''}`.trim();
        }
        if (phone !== undefined) {
            updateData.phone = phone;
        }
        if (address !== undefined) {
            updateData.address = address;
        }
        if (specialty !== undefined) {
            updateData.speciality = specialty || null;
        }
        if (email) {
            const existing = await db.queryOne(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, req.params.id]
            );
            if (existing) {
                return res.status(400).json({ success: false, error: 'Email déjà utilisé' });
            }
            updateData.email = email;
        }
        if (doctor_code !== undefined) {
            const normalizedDoctorCode = String(doctor_code || '').trim().toUpperCase();
            if (!normalizedDoctorCode) {
                return res.status(400).json({ success: false, error: 'Code médecin requis' });
            }
            if (!DOCTOR_CODE_PATTERN.test(normalizedDoctorCode)) {
                return res.status(400).json({ success: false, error: 'Code médecin invalide (format attendu: OPH001)' });
            }

            const existingCode = await db.queryOne(
                `SELECT id FROM users
                 WHERE center_id = ? AND role = 'doctor' AND doctor_code = ? AND id != ?`,
                [req.user.center_id, normalizedDoctorCode, req.params.id]
            );
            if (existingCode) {
                return res.status(400).json({ success: false, error: 'Ce code médecin est déjà utilisé' });
            }
            updateData.doctor_code = normalizedDoctorCode;
        }
        if (password) {
            const bcrypt = require('bcryptjs');
            updateData.password_hash = await bcrypt.hash(password, 10);
            updateData.must_change_password = 1;
        }
        
        if (Object.keys(updateData).length > 0) {
            await db.update('users', updateData, 'id = ?', [req.params.id]);
        }
        
        const updatedRaw = await db.queryOne(
            'SELECT id, email, name, identity, phone, address, role, speciality, doctor_code, account_status, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        const nameParts = (updatedRaw.name || '').split(' ');
        const updated = {
            ...updatedRaw,
            specialty: updatedRaw.speciality || null,
            doctor_code: updatedRaw.doctor_code || null,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || ''
        };
        
        res.json({ success: true, data: updated });
        
    } catch (error) {
        console.error('Update doctor error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// DELETE /api/doctors/:id
router.delete('/:id', async (req, res) => {
    try {
        const doctor = await db.queryOne(
            `SELECT * FROM users WHERE id = ? AND center_id = ? AND role = 'doctor'`,
            [req.params.id, req.user.center_id]
        );
        
        if (!doctor) {
            return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
        }
        
        await db.delete('users', 'id = ?', [req.params.id]);
        
        res.json({ success: true, message: 'Médecin supprimé' });
        
    } catch (error) {
        console.error('Delete doctor error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
