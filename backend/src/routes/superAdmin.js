/**
 * Super Admin Routes
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authMiddleware, roleMiddleware, generateActivationToken } = require('../middleware/auth');
const { sendActivationEmail, sendCenterAdminActivationEmail } = require('../services/mailService');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('super_admin'));

function generateTempPassword(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return `Admin-${out}`;
}

function slugify(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/(^\.|\.$)/g, '')
        .slice(0, 40);
}

async function generateUniqueAdminEmail(centerName) {
    const base = slugify(centerName) || `center.${Date.now()}`;
    let attempt = 0;

    while (attempt < 100) {
        const suffix = attempt === 0 ? '' : `.${attempt + 1}`;
        const candidate = `admin.${base}${suffix}@drscreening.local`;
        const exists = await db.queryOne('SELECT id FROM users WHERE email = ?', [candidate]);
        if (!exists) {
            return candidate;
        }
        attempt += 1;
    }

    return `admin.${Date.now()}@drscreening.local`;
}

// GET /api/super/support - Get support messages for super admin
router.get('/support', async (req, res) => {
    try {
        const status = req.query.status || 'open';
        let where = '1=1';
        let params = [];

        if (status !== 'all') {
            where += ' AND sm.status = ?';
            params.push(status);
        }

        const messages = await db.query(`
            SELECT sm.id, sm.subject, sm.message, sm.status, sm.priority,
                   sm.created_at, sm.updated_at, sm.is_read_by_superadmin,
                   u.id as admin_id, u.name as admin_name, u.email as admin_email,
                   c.id as center_id, c.name as center_name, c.location
            FROM support_messages sm
            JOIN users u ON sm.admin_id = u.id
            JOIN centers c ON sm.center_id = c.id
            WHERE ${where}
            ORDER BY CASE WHEN sm.priority = 'high' THEN 0 WHEN sm.priority = 'medium' THEN 1 ELSE 2 END,
                    sm.created_at DESC
        `, params);

        const unreadCount = await db.count('support_messages', "is_read_by_superadmin = 0 AND status = 'open'");

        res.json({
            success: true,
            data: {
                messages,
                unread_count: unreadCount
            }
        });
    } catch (error) {
        console.error('Get support messages error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/support/:id/read - Mark support message as read
router.put('/support/:id/read', async (req, res) => {
    try {
        const message = await db.queryOne('SELECT id FROM support_messages WHERE id = ?', [req.params.id]);
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        await db.update('support_messages', { is_read_by_superadmin: 1 }, 'id = ?', [req.params.id]);

        res.json({ success: true, message: 'Message marqué comme lu' });
    } catch (error) {
        console.error('Mark support message read error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/support/read-all - Mark all unread open support messages as read
router.put('/support/read-all', async (req, res) => {
    try {
        const markedRead = await db.update(
            'support_messages',
            { is_read_by_superadmin: 1 },
            "is_read_by_superadmin = 0 AND status = 'open'"
        );

        res.json({
            success: true,
            data: {
                marked_read: markedRead || 0
            }
        });
    } catch (error) {
        console.error('Mark all support messages read error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/support/:id/status - Update support message status
router.put('/support/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['open', 'in_progress', 'resolved'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Statut invalide' });
        }

        const message = await db.queryOne('SELECT id FROM support_messages WHERE id = ?', [req.params.id]);
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        const updateData = { status, updated_at: new Date(), is_read_by_superadmin: 1 };
        if (status === 'resolved') {
            updateData.resolved_at = new Date();
            updateData.resolved_by_superadmin_id = req.user.user_id;
        }

        await db.update('support_messages', updateData, 'id = ?', [req.params.id]);

        res.json({ success: true, message: 'Statut mis à jour' });
    } catch (error) {
        console.error('Update support status error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/super/impersonate/:admin_id - Get temporary token to access admin dashboard
router.post('/impersonate/:admin_id', async (req, res) => {
    try {
        const admin = await db.queryOne(
            "SELECT id, email, name, center_id FROM users WHERE id = ? AND role = 'center_admin'",
            [req.params.admin_id]
        );
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin centre non trouvé' });
        }

        const { generateToken } = require('../middleware/auth');
        const tempToken = generateToken({
            user_id: admin.id,
            email: admin.email,
            name: admin.name,
            role: 'center_admin',
            center_id: admin.center_id,
            impersonated_by_superadmin: req.user.user_id,
            impersonation_timestamp: Date.now()
        });

        res.json({
            success: true,
            data: {
                token: tempToken,
                admin_id: admin.id,
                admin_email: admin.email,
                admin_name: admin.name,
                center_id: admin.center_id
            }
        });
    } catch (error) {
        console.error('Impersonate admin error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/super/stats
router.get('/stats', async (req, res) => {
    try {
        const totalCenters = await db.count('centers');
        const activeCenters = await db.count('centers', "status = 'active'");
        const pendingCenters = await db.count('centers', "status = 'pending'");
        const suspendedCenters = await db.count('centers', "status = 'suspended'");
        const totalAdmins = await db.count('users', "role = 'center_admin'");
        const activeAdmins = await db.count('users', "role = 'center_admin' AND is_active = 1");
        const totalScreenings = await db.count('exams');

        res.json({
            success: true,
            data: {
                total_centers: totalCenters,
                active_centers: activeCenters,
                pending_centers: pendingCenters,
                suspended_centers: suspendedCenters,
                total_center_admins: totalAdmins,
                active_center_admins: activeAdmins,
                total_screenings: totalScreenings
            }
        });
    } catch (error) {
        console.error('Get super stats error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/super/alerts
router.get('/alerts', async (req, res) => {
    try {
        const staleDays = Math.max(1, Math.min(parseInt(req.query.stale_days, 10) || 30, 3650));
        const pendingThreshold = Math.max(1, Math.min(parseInt(req.query.pending_threshold, 10) || 10, 10000));
        const staleModifier = `-${staleDays} days`;

        const staleCenters = await db.query(
            `SELECT c.id,
                    c.name,
                    c.location,
                    c.status,
                    MAX(e.created_at) as last_screening_at,
                    COUNT(e.id) as screenings_count
             FROM centers c
             LEFT JOIN exams e ON e.center_id = c.id
             GROUP BY c.id
             HAVING last_screening_at IS NULL OR datetime(last_screening_at) < datetime('now', ?)
             ORDER BY CASE WHEN last_screening_at IS NULL THEN 0 ELSE 1 END, last_screening_at ASC, c.name ASC`,
            [staleModifier]
        );

        const pendingCenters = await db.query(
            `SELECT c.id,
                    c.name,
                    c.location,
                    c.status,
                    COUNT(e.id) as pending_count,
                    MIN(e.created_at) as oldest_pending_at
             FROM centers c
             LEFT JOIN exams e ON e.center_id = c.id AND e.grade = -1
             GROUP BY c.id
             HAVING pending_count >= ?
             ORDER BY pending_count DESC, c.name ASC`,
            [pendingThreshold]
        );

        const alerts = [];

        staleCenters.forEach((center) => {
            alerts.push({
                type: 'stale_screenings',
                severity: center.status === 'active' ? 'warning' : 'info',
                center_id: center.id,
                center_name: center.name,
                center_location: center.location,
                center_status: center.status,
                screenings_count: center.screenings_count || 0,
                last_screening_at: center.last_screening_at,
                message: center.last_screening_at
                    ? `Aucun dépistage depuis ${staleDays} jours pour ${center.name}`
                    : `Aucun dépistage enregistré pour ${center.name}`
            });
        });

        pendingCenters.forEach((center) => {
            alerts.push({
                type: 'pending_grading',
                severity: center.pending_count >= pendingThreshold * 2 ? 'danger' : 'warning',
                center_id: center.id,
                center_name: center.name,
                center_location: center.location,
                center_status: center.status,
                pending_count: center.pending_count || 0,
                oldest_pending_at: center.oldest_pending_at,
                message: `${center.pending_count} examens en attente de grading dans ${center.name}`
            });
        });

        alerts.sort((a, b) => {
            const rank = { danger: 0, warning: 1, info: 2 };
            return (rank[a.severity] - rank[b.severity]) || String(a.center_name).localeCompare(String(b.center_name));
        });

        res.json({
            success: true,
            data: {
                settings: {
                    stale_days: staleDays,
                    pending_threshold: pendingThreshold
                },
                summary: {
                    stale_centers: staleCenters.length,
                    pending_centers: pendingCenters.length,
                    total_alerts: alerts.length
                },
                alerts
            }
        });
    } catch (error) {
        console.error('Get super alerts error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/super/reports
router.get('/reports', async (req, res) => {
    try {
        const centers = await db.query(`
            SELECT c.id,
                   c.name,
                   c.status,
                   c.location,
                   c.created_at,
                   (SELECT COUNT(*) FROM exams e WHERE e.center_id = c.id) as screenings_count,
                   (SELECT MAX(created_at) FROM exams e2 WHERE e2.center_id = c.id) as last_screening_at,
                   (SELECT COUNT(*) FROM users u WHERE u.center_id = c.id AND u.role = 'center_admin' AND u.is_active = 1) as active_admins
            FROM centers c
            ORDER BY screenings_count DESC, c.name ASC
        `);

        const totals = centers.reduce(
            (acc, c) => {
                acc.totalCenters += 1;
                acc.totalScreenings += c.screenings_count || 0;
                if (c.status === 'active') acc.activeCenters += 1;
                if (c.status === 'pending') acc.pendingCenters += 1;
                if (c.status === 'suspended') acc.suspendedCenters += 1;
                return acc;
            },
            {
                totalCenters: 0,
                totalScreenings: 0,
                activeCenters: 0,
                pendingCenters: 0,
                suspendedCenters: 0
            }
        );

        res.json({
            success: true,
            data: {
                summary: totals,
                centers
            }
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/super/centers
router.get('/centers', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const perPage = parseInt(req.query.per_page, 10) || 20;
        const search = (req.query.search || '').trim();
        const status = (req.query.status || '').trim();

        let where = '1=1';
        const params = [];

        if (search) {
            where += ' AND (c.name LIKE ? OR c.location LIKE ? OR c.address LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
            const token = `%${search}%`;
            params.push(token, token, token, token, token);
        }

        if (status) {
            where += ' AND c.status = ?';
            params.push(status);
        }

        const totalRow = await db.queryOne(`SELECT COUNT(*) as count FROM centers c WHERE ${where}`, params);
        const total = totalRow ? totalRow.count : 0;
        const offset = (page - 1) * perPage;

        const centers = await db.query(
            `SELECT c.*, 
                    a.id as admin_id,
                    a.name as admin_name,
                    a.email as admin_email,
                    a.phone as admin_phone,
                    a.is_active as admin_is_active,
                    (SELECT COUNT(*) FROM exams e WHERE e.center_id = c.id) as screenings_count
             FROM centers c
             LEFT JOIN users a ON a.center_id = c.id AND a.role = 'center_admin'
             WHERE ${where}
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, perPage, offset]
        );

        res.json({
            success: true,
            data: {
                centers,
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total,
                    total_pages: Math.ceil(total / perPage)
                }
            }
        });
    } catch (error) {
        console.error('List centers error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/super/centers
// Validate: email, name required; check for duplicates
router.post('/centers', async (req, res) => {
    try {
        const {
            name,
            location,
            address,
            phone,
            email,
            status,
            admin_password
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Nom du centre est requis'
            });
        }

        // Validate email is provided
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email du centre est requis'
            });
        }

        // Check if email already exists (center or user email)
        const existingCenter = await db.queryOne('SELECT id FROM centers WHERE email = ?', [email]);
        if (existingCenter) {
            return res.status(400).json({
                success: false,
                error: 'Email déjà utilisé pour un autre centre'
            });
        }

        const existingUser = await db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Email déjà utilisé'
            });
        }

        const centerId = await db.insert('centers', {
            name,
            location: location || null,
            address: address || null,
            phone: phone || null,
            email: email || null,
            status: 'pending'
        });

        const adminEmail = await generateUniqueAdminEmail(name);
        const adminName = `Admin ${name}`;

        // If a password was provided by the super-admin, keep existing behaviour
        if (admin_password) {
            const passwordHash = await bcrypt.hash(admin_password, 10);
            await db.insert('users', {
                center_id: centerId,
                role: 'center_admin',
                name: adminName,
                email: adminEmail,
                password_hash: passwordHash,
                phone: null,
                is_active: 1,
                account_status: 'active'
            });

            const center = await db.queryOne('SELECT * FROM centers WHERE id = ?', [centerId]);

            return res.status(201).json({
                success: true,
                data: {
                    center,
                    generated_admin_name: adminName,
                    generated_admin_email: adminEmail,
                    generated_admin_password: null
                }
            });
        }

        // Otherwise, create the admin in pending state and send activation link
        const activationToken = generateActivationToken({ user_email: adminEmail });
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const adminId = await db.insert('users', {
            center_id: centerId,
            role: 'center_admin',
            name: adminName,
            email: adminEmail,
            phone: null,
            is_active: 0,
            account_status: 'inactive',
            activation_token: activationToken,
            token_expires_at: expiresAt.toISOString()
        });

        const center = await db.queryOne('SELECT * FROM centers WHERE id = ?', [centerId]);

        // Send activation email (non-blocking) to CENTER email with admin credentials info
        const activationLink = `${process.env.APP_URL || 'http://localhost:3000'}/activate?token=${activationToken}`;
        const emailPromise = sendCenterAdminActivationEmail(email, adminEmail, adminName, activationLink);
        emailPromise.catch((err) => console.error('Activation email error:', err));

        res.status(201).json({
            success: true,
            data: {
                center,
                generated_admin_name: adminName,
                generated_admin_email: adminEmail,
                activation_email_queued: true
            }
        });
    } catch (error) {
        console.error('Create center error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/super/centers/:id
router.get('/centers/:id', async (req, res) => {
    try {
        const center = await db.queryOne(
            `SELECT c.*, 
                    a.id as admin_id,
                    a.name as admin_name,
                    a.email as admin_email,
                    a.phone as admin_phone,
                    a.is_active as admin_is_active,
                    (SELECT COUNT(*) FROM exams e WHERE e.center_id = c.id) as screenings_count
             FROM centers c
             LEFT JOIN users a ON a.center_id = c.id AND a.role = 'center_admin'
             WHERE c.id = ?`,
            [req.params.id]
        );

        if (!center) {
            return res.status(404).json({ success: false, error: 'Centre non trouvé' });
        }

        res.json({ success: true, data: center });
    } catch (error) {
        console.error('Get center details error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/centers/:id
router.put('/centers/:id', async (req, res) => {
    try {
        const centerId = req.params.id;
        const center = await db.queryOne('SELECT * FROM centers WHERE id = ?', [centerId]);
        if (!center) {
            return res.status(404).json({ success: false, error: 'Centre non trouvé' });
        }

        const updateData = {};
        const fields = ['name', 'location', 'address', 'phone', 'email', 'status'];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (updateData.status && !['active', 'pending', 'suspended'].includes(updateData.status)) {
            return res.status(400).json({ success: false, error: 'Statut invalide' });
        }

        if (Object.keys(updateData).length) {
            await db.update('centers', updateData, 'id = ?', [centerId]);
        }

        const updated = await db.queryOne('SELECT * FROM centers WHERE id = ?', [centerId]);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update center error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// DELETE /api/super/centers/:id
router.delete('/centers/:id', async (req, res) => {
    try {
        const centerId = req.params.id;
        const center = await db.queryOne('SELECT id FROM centers WHERE id = ?', [centerId]);
        if (!center) {
            return res.status(404).json({ success: false, error: 'Centre non trouvé' });
        }

        await db.delete('centers', 'id = ?', [centerId]);
        res.json({ success: true, message: 'Centre supprimé' });
    } catch (error) {
        console.error('Delete center error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/super/admins
router.get('/admins', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const perPage = parseInt(req.query.per_page, 10) || 20;
        const search = (req.query.search || '').trim();
        const isActive = req.query.is_active;

        let where = "u.role = 'center_admin'";
        const params = [];

        if (search) {
            where += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ?)';
            const token = `%${search}%`;
            params.push(token, token, token);
        }

        if (isActive === '0' || isActive === '1') {
            where += ' AND u.is_active = ?';
            params.push(parseInt(isActive, 10));
        }

        const totalRow = await db.queryOne(
            `SELECT COUNT(*) as count FROM users u JOIN centers c ON c.id = u.center_id WHERE ${where}`,
            params
        );
        const total = totalRow ? totalRow.count : 0;
        const offset = (page - 1) * perPage;

        const admins = await db.query(
            `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
                    c.id as center_id, c.name as center_name, c.status as center_status
             FROM users u
             JOIN centers c ON c.id = u.center_id
             WHERE ${where}
             ORDER BY u.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, perPage, offset]
        );

        res.json({
            success: true,
            data: {
                admins,
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total,
                    total_pages: Math.ceil(total / perPage)
                }
            }
        });
    } catch (error) {
        console.error('List center admins error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/admins/:id
router.put('/admins/:id', async (req, res) => {
    try {
        const adminId = req.params.id;
        const admin = await db.queryOne(
            "SELECT id, email FROM users WHERE id = ? AND role = 'center_admin'",
            [adminId]
        );

        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin centre non trouvé' });
        }

        const updateData = {};
        if (typeof req.body.name === 'string') {
            const name = req.body.name.trim();
            if (!name) {
                return res.status(400).json({ success: false, error: 'Nom admin requis' });
            }
            updateData.name = name;
        }

        if (typeof req.body.email === 'string') {
            const email = req.body.email.trim().toLowerCase();
            if (!email) {
                return res.status(400).json({ success: false, error: 'Email admin requis' });
            }
            const existingEmail = await db.queryOne(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, adminId]
            );
            if (existingEmail) {
                return res.status(400).json({ success: false, error: 'Email admin déjà utilisé' });
            }
            updateData.email = email;
        }

        if (req.body.phone !== undefined) {
            const phone = req.body.phone ? String(req.body.phone).trim() : '';
            updateData.phone = phone || null;
        }

        if (!Object.keys(updateData).length) {
            return res.status(400).json({ success: false, error: 'Aucune modification fournie' });
        }

        await db.update('users', updateData, 'id = ?', [adminId]);

        const updatedAdmin = await db.queryOne(
            `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
                    c.id as center_id, c.name as center_name, c.status as center_status
             FROM users u
             JOIN centers c ON c.id = u.center_id
             WHERE u.id = ?`,
            [adminId]
        );

        res.json({ success: true, data: updatedAdmin });
    } catch (error) {
        console.error('Update center admin error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/admins/:id/reset-password
// If `password` provided in body -> set it. Otherwise send activation link so admin defines password themself.
router.put('/admins/:id/reset-password', async (req, res) => {
    try {
        const adminId = req.params.id;
        const admin = await db.queryOne(
            "SELECT id FROM users WHERE id = ? AND role = 'center_admin'",
            [adminId]
        );

        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin centre non trouvé' });
        }

        if (req.body.password) {
            const newPassword = req.body.password;
            const passwordHash = await bcrypt.hash(newPassword, 10);
            await db.update('users', { password_hash: passwordHash, must_change_password: 0 }, 'id = ?', [adminId]);

            return res.json({
                success: true,
                data: { message: 'Mot de passe mis à jour avec succès' }
            });
        }

        // Otherwise, generate activation token and send activation email
        const adminRow = await db.queryOne('SELECT email, name FROM users WHERE id = ?', [adminId]);
        if (!adminRow) {
            return res.status(404).json({ success: false, error: 'Admin centre non trouvé' });
        }

        const activationToken = generateActivationToken({ user_email: adminRow.email });
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await db.update('users', {
            activation_token: activationToken,
            token_expires_at: expiresAt.toISOString(),
            account_status: 'inactive',
            is_active: 0
        }, 'id = ?', [adminId]);

        const activationLink = `${process.env.APP_URL || 'http://localhost:3000'}/activate?token=${activationToken}`;
        const emailPromise = sendActivationEmail(adminRow.email, adminRow.name, activationLink);
        emailPromise.catch((err) => console.error('Activation email error:', err));

        res.json({ success: true, data: { message: 'Lien d\'activation envoyé', activation_email_queued: true } });
    } catch (error) {
        console.error('Reset admin password error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/super/admins/:id/active
router.put('/admins/:id/active', async (req, res) => {
    try {
        const adminId = req.params.id;
        const isActive = req.body.is_active;

        if (isActive !== 0 && isActive !== 1) {
            return res.status(400).json({ success: false, error: 'is_active doit être 0 ou 1' });
        }

        const admin = await db.queryOne(
            "SELECT id FROM users WHERE id = ? AND role = 'center_admin'",
            [adminId]
        );

        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin centre non trouvé' });
        }

        await db.update('users', { is_active: isActive }, 'id = ?', [adminId]);
        res.json({ success: true, message: 'Statut admin mis à jour' });
    } catch (error) {
        console.error('Toggle admin active error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
