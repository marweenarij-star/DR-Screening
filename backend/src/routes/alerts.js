/**
 * Alerts Routes
 */

const express = require('express');
const db = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('doctor'));

function alertSignature(alert) {
    const examPart = alert.exam_id || 'no_exam';
    const typePart = (alert.alert_type || '').toLowerCase();
    const messagePart = String(alert.message || '').trim().toLowerCase();
    const patientPart = String(alert.full_name || '').trim().toLowerCase();
    return `${examPart}|${typePart}|${messagePart}|${patientPart}`;
}

function dedupeAlerts(alerts) {
    const kept = new Map();

    alerts.forEach((alert) => {
        const key = alertSignature(alert);
        const existing = kept.get(key);
        if (!existing) {
            kept.set(key, alert);
            return;
        }

        const existingCreatedAt = new Date(existing.created_at).getTime();
        const currentCreatedAt = new Date(alert.created_at).getTime();
        if (currentCreatedAt > existingCreatedAt) {
            kept.set(key, alert);
        }
    });

    return Array.from(kept.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// GET /api/doctor/alerts
router.get('/', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        const status = req.query.status || 'unread';
        
        let where = 'a.doctor_id = ?';
        let params = [doctorId];
        
        if (status === 'unread') {
            where += ' AND a.read_at IS NULL';
        } else if (status === 'unresolved') {
            where += ' AND a.resolved_at IS NULL';
        } else if (status === 'resolved') {
            where += ' AND a.resolved_at IS NOT NULL';
        }
        
        const alerts = await db.query(`
            SELECT a.id, a.type as alert_type, a.message, a.created_at, a.read_at, a.resolved_at,
                   a.exam_id, e.grade, e.confidence,
                   p.full_name, p.medical_record_number
            FROM alerts a
            LEFT JOIN exams e ON a.exam_id = e.id
            LEFT JOIN patients p ON e.patient_id = p.id
            WHERE ${where}
            ORDER BY a.created_at DESC
        `, params);

        const dedupedAlerts = dedupeAlerts(alerts);
        
        res.json({
            success: true,
            data: dedupedAlerts.map(alert => ({
                id: alert.id,
                alert_type: alert.alert_type,
                message: alert.message,
                exam_id: alert.exam_id,
                grade: alert.grade,
                patient_name: alert.full_name || null,
                medical_record_number: alert.medical_record_number,
                is_read: alert.read_at !== null,
                is_resolved: alert.resolved_at !== null,
                created_at: alert.created_at,
                read_at: alert.read_at,
                resolved_at: alert.resolved_at
            }))
        });
        
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/doctor/alerts/count
router.get('/count', async (req, res) => {
    try {
        const doctorId = req.user.user_id;

        const alerts = await db.query(`
            SELECT a.id, a.type as alert_type, a.message, a.created_at, a.read_at, a.resolved_at,
                   a.exam_id, p.full_name
            FROM alerts a
            LEFT JOIN exams e ON a.exam_id = e.id
            LEFT JOIN patients p ON e.patient_id = p.id
            WHERE a.doctor_id = ?
            ORDER BY a.created_at DESC
        `, [doctorId]);

        const deduped = dedupeAlerts(alerts);
        const unread = deduped.filter((alert) => alert.read_at === null).length;
        const unresolved = deduped.filter((alert) => alert.resolved_at === null).length;
        
        res.json({
            success: true,
            data: {
                unread,
                unresolved
            }
        });
        
    } catch (error) {
        console.error('Get alerts count error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/doctor/alerts/:id/read
router.put('/:id/read', async (req, res) => {
    try {
        const alert = await db.queryOne(
            'SELECT * FROM alerts WHERE id = ? AND doctor_id = ?',
            [req.params.id, req.user.user_id]
        );
        
        if (!alert) {
            return res.status(404).json({ success: false, error: 'Alerte non trouvée' });
        }
        
        await db.update('alerts', { read_at: new Date() }, 'id = ?', [req.params.id]);
        
        res.json({
            success: true,
            message: 'Alerte marquée comme lue'
        });
        
    } catch (error) {
        console.error('Mark alert read error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// PUT /api/doctor/alerts/:id/resolve
router.put('/:id/resolve', async (req, res) => {
    try {
        const alert = await db.queryOne(
            'SELECT * FROM alerts WHERE id = ? AND doctor_id = ?',
            [req.params.id, req.user.user_id]
        );
        
        if (!alert) {
            return res.status(404).json({ success: false, error: 'Alerte non trouvée' });
        }
        
        await db.update('alerts', { 
            read_at: alert.read_at || new Date(),
            resolved_at: new Date() 
        }, 'id = ?', [req.params.id]);
        
        res.json({
            success: true,
            message: 'Alerte résolue'
        });
        
    } catch (error) {
        console.error('Resolve alert error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/doctor/alerts/mark-all-read
router.post('/mark-all-read', async (req, res) => {
    try {
        const doctorId = req.user.user_id;
        
        await db.query(
            'UPDATE alerts SET read_at = ? WHERE doctor_id = ? AND read_at IS NULL',
            [new Date(), doctorId]
        );
        
        res.json({
            success: true,
            message: 'Toutes les alertes ont été marquées comme lues'
        });
        
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
