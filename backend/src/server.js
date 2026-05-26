/**
 * DR Screening - Node.js Backend Server
 * Main entry point
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { createServer } = require('http');
const bcrypt = require('bcryptjs');

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const doctorRoutes = require('./routes/doctors');
const examRoutes = require('./routes/exams');
const doctorDashboardRoutes = require('./routes/doctorDashboard');
const alertRoutes = require('./routes/alerts');
const superAdminRoutes = require('./routes/superAdmin');
const centerAdminRoutes = require('./routes/centerAdmin');

// Import WebSocket
const { initWebSocket } = require('./services/websocket');

// Import database
const db = require('./config/database');
const { initDatabase } = require('./config/initDb');
const { backfillPreviewImages } = require('./../scripts/backfill-preview-images');

const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
// Public preview endpoint for exams: serve or convert DICOM to JPEG without auth
app.get('/api/exams/:id/preview-image', async (req, res) => {
    try {
        const id = req.params.id;
        const exam = await db.queryOne('SELECT image_path FROM exams WHERE id = ?', [id]);
        if (!exam || !exam.image_path) return res.status(404).json({ success: false, error: 'Examen non trouvé' });

        // If the image is already stored in Supabase (or any remote URL), redirect there directly
        const imgPath = String(exam.image_path || '');
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
            return res.redirect(imgPath);
        }

        const rel = imgPath;

        // Try both project-root-relative and backend-relative locations
        const candidateOriginalProject = path.join(__dirname, '../../', rel);
        const candidateOriginalBackend = path.join(__dirname, '..', rel);
        const originalAbs = fs.existsSync(candidateOriginalBackend) ? candidateOriginalBackend : candidateOriginalProject;
        const ext = path.extname(originalAbs).toLowerCase();

        const previewRel = rel.replace(/\.[^.]+$/, '_preview.jpg');
        const previewAbsProject = path.join(__dirname, '../../', previewRel);
        const previewAbsBackend = path.join(__dirname, '..', previewRel);
        console.log('Preview DEBUG candidates:', { id, rel, previewAbsProject, previewAbsBackend, originalAbs, origExists: fs.existsSync(originalAbs) });

        if (fs.existsSync(previewAbsBackend)) return res.sendFile(previewAbsBackend);
        if (fs.existsSync(previewAbsProject)) return res.sendFile(previewAbsProject);

        // If original exists and is a DICOM, attempt on-the-fly conversion producing a preview next to original
        if (fs.existsSync(originalAbs) && ['.dcm', '.dicom'].includes(path.extname(originalAbs).toLowerCase())) {
            const py = process.env.PYTHON || process.env.AI_SERVICE_PYTHON || path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
            const script = path.join(__dirname, '..', 'scripts', 'convert_dicom_to_jpeg.py');
            const tmpOut = originalAbs.replace(/\.[^.]+$/, '_preview_tmp.jpg');
            try {
                const spawnSync = require('child_process').spawnSync;
                const result = spawnSync(py, [script, originalAbs, tmpOut], { timeout: 20000 });
                console.log('On-the-fly conversion result:', { status: result.status, error: result.error && String(result.error).slice(0,200), stderr: result.stderr && String(result.stderr).slice(0,200) });
                if (result.status === 0 && fs.existsSync(tmpOut)) {
                    res.setHeader('Content-Type', 'image/jpeg');
                    return res.sendFile(tmpOut, (err) => {
                        if (err) console.error('SendFile error preview-image:', err && err.message);
                    });
                }
            } catch (e) {
                console.error('Public preview generation error (on-the-fly):', e && e.message);
            }
        }

        return res.status(404).json({ success: false, error: 'Aperçu indisponible' });
    } catch (error) {
        console.error('Public preview image error:', error && error.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

app.use('/api/exams', examRoutes);
app.use('/api/doctor', doctorDashboardRoutes);
app.use('/api/doctor/alerts', alertRoutes);
app.use('/api/super', superAdminRoutes);
app.use('/api/center', centerAdminRoutes);

// Quick-access PACS viewer (prototype) - no auth, for local testing
app.get('/pacs', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/pacs.html'));
});

// Simple WADO-like proxy to serve local DICOM or image files safely.
// Usage: /pacs/wado?file=/uploads/patient_1/image.jpg
app.get('/pacs/wado', (req, res) => {
    try {
        const file = String(req.query.file || '').trim();
        if (!file) return res.status(400).json({ success: false, error: 'file param required' });

        // Only allow serving files from /uploads or /public
        if (!(file.startsWith('/uploads/') || file.startsWith('/assets/') || file.startsWith('/public/'))) {
            return res.status(403).json({ success: false, error: 'forbidden' });
        }

        // Map to filesystem
        let fsPath;
        if (file.startsWith('/uploads/')) {
            fsPath = path.join(__dirname, '../../', file.replace(/^\//, ''));
        } else if (file.startsWith('/assets/') || file.startsWith('/public/')) {
            fsPath = path.join(__dirname, '../public', file.replace(/^\//, '').replace(/^public\//, ''));
        } else {
            return res.status(403).json({ success: false, error: 'forbidden' });
        }

        if (!fs.existsSync(fsPath)) {
            return res.status(404).json({ success: false, error: 'not found' });
        }

        const stat = fs.statSync(fsPath);
        const ext = path.extname(fsPath).toLowerCase();
        const contentType = ext === '.dcm' ? 'application/dicom' : (ext === '.png' ? 'image/png' : 'image/jpeg');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        const stream = fs.createReadStream(fsPath);
        stream.pipe(res);
    } catch (err) {
        console.error('WADO proxy error:', err.message);
        res.status(500).json({ success: false, error: 'server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database diagnostics — reports which backend is active and runs a live query
app.get('/api/debug/db', async (req, res) => {
    const backend = process.env.DATABASE_URL ? 'postgres' : 'sqlite';
    try {
        const userCount = await db.queryOne('SELECT COUNT(*) AS count FROM users');
        const examCount = await db.queryOne('SELECT COUNT(*) AS count FROM exams');
        const patientCount = await db.queryOne('SELECT COUNT(*) AS count FROM patients');
        res.json({
            ok: true,
            backend,
            counts: {
                users: userCount ? userCount.count : null,
                patients: patientCount ? patientCount.count : null,
                exams: examCount ? examCount.count : null
            }
        });
    } catch (err) {
        res.json({ ok: false, backend, error: err.message });
    }
});

// SMTP diagnostics — GET (browser-friendly) shows config; POST also sends a test email
app.get('/api/debug/smtp-test', async (req, res) => {
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const config = {
        brevoConfigured: !!process.env.BREVO_API_KEY,
        brevoSender: process.env.BREVO_SENDER || process.env.SMTP_FROM || smtpUser || '(not set)',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: smtpUser,
        passLength: smtpPass.length,
        passSet: !!smtpPass,
        appUrl: process.env.APP_URL || '(not set)'
    };
    // Brevo is the active transport when configured — no SMTP connection to verify.
    if (process.env.BREVO_API_KEY) {
        return res.json({ ok: true, transport: 'brevo', config, message: 'Brevo HTTP API configured. POST {"to":"email"} to send a test email.' });
    }
    if (!smtpUser || !smtpPass) {
        return res.json({ ok: false, config, error: 'No BREVO_API_KEY and SMTP_USER/SMTP_PASS not set' });
    }
    try {
        const nodemailer = require('nodemailer');
        const t = nodemailer.createTransport({
            host: config.host, port: config.port,
            secure: config.port === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
        });
        await t.verify();
        res.json({ ok: true, config, message: 'SMTP connection OK — POST to this URL with {"to":"email"} to send a test email' });
    } catch (err) {
        res.json({ ok: false, config, error: err.message, code: err.code });
    }
});

app.post('/api/debug/smtp-test', async (req, res) => {
    const { to } = req.body;
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');

    // Show config (mask password)
    const config = {
        brevoConfigured: !!process.env.BREVO_API_KEY,
        host: smtpHost,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
        user: smtpUser,
        passLength: smtpPass.length,
        passSet: !!smtpPass,
        toAddress: to || smtpUser
    };

    // If Brevo is configured, test the real send path (mailService routes through Brevo).
    if (process.env.BREVO_API_KEY) {
        if (!to) return res.json({ ok: false, config, error: 'Provide {"to":"email"} to send a Brevo test email' });
        const mailService = require('./services/mailService');
        const sent = await mailService.sendEmail(to, 'DR Screening — Brevo test', '<p>If you received this, Brevo email works correctly.</p>');
        return res.json({ ok: sent, transport: 'brevo', config, message: sent ? `Test email sent to ${to} via Brevo` : 'Brevo send failed — check server logs and BREVO_SENDER verification' });
    }

    if (!smtpUser || !smtpPass) {
        return res.json({ ok: false, config, error: 'SMTP_USER or SMTP_PASS not set in environment' });
    }

    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
        });

        await transporter.verify();
        config.verifyOk = true;

        if (to) {
            await transporter.sendMail({
                from: `"DR Screening Test" <${smtpUser}>`,
                to,
                subject: 'DR Screening — SMTP test',
                text: 'If you receive this email, SMTP is working correctly.'
            });
            config.emailSent = true;
        }

        res.json({ ok: true, config });
    } catch (err) {
        res.json({ ok: false, config, error: err.message, code: err.code });
    }
});

// View Routes - Serve HTML pages
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/login.html'));
});

app.get('/center/patients', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/center/patients.html'));
});

app.get('/center/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/center/dashboard.html'));
});

app.get('/center/doctors', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/center/doctors.html'));
});

app.get('/center/history', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/center/history.html'));
});

app.get('/center/new-exam', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/center/new-exam.html'));
});

app.get('/center/support', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/center/support.html'));
});

app.get('/doctor/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/login.html'));
});

app.get('/doctor/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/doctor/dashboard.html'));
});

app.get('/doctor/patients', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/doctor/dashboard.html'));
});

app.get('/doctor/exams/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/doctor/exam-detail.html'));
});

app.get('/doctor/alerts', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/doctor/alerts.html'));
});

app.get('/super/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/views/super/dashboard.html'));
});

app.get('/activate', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/activate.html'));
});

// Activation route - must be before 404 handler
app.get('/activate/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/activate.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Initialize WebSocket
initWebSocket(server);

async function ensureDemoData() {
    try {
        // Ensure at least one center exists
        let center = await db.queryOne('SELECT * FROM centers LIMIT 1');
        if (!center) {
            const centerId = await db.insert('centers', {
                name: 'Centre Ophtalmo Démo',
                mode: 'full_platform',
                address: 'Adresse du centre démo',
                phone: '+33 1 23 45 67 89',
                email: 'contact@centre-ophtalmo.fr'
            });
            center = await db.queryOne('SELECT * FROM centers WHERE id = ?', [centerId]);
            console.log(`✓ Centre démo créé (ID: ${centerId})`);
        }

        // Ensure demo admin user exists
        const adminEmail = 'admin@centre-ophtalmo.fr';
        let admin = await db.queryOne('SELECT * FROM users WHERE email = ?', [adminEmail]);
        if (!admin) {
            const passwordHash = await bcrypt.hash('admin123', 10);
            const adminId = await db.insert('users', {
                center_id: center.id,
                role: 'center_admin',
                name: 'Admin Centre',
                email: adminEmail,
                password_hash: passwordHash,
                phone: '+33 1 23 45 67 90'
            });
            admin = await db.queryOne('SELECT * FROM users WHERE id = ?', [adminId]);
            console.log(`✓ Compte admin démo créé: ${adminEmail} / admin123`);
        }

        // Ensure demo doctor user exists
        const doctorEmail = 'dr.martin@centre-ophtalmo.fr';
        let doctor = await db.queryOne('SELECT * FROM users WHERE email = ?', [doctorEmail]);
        if (!doctor) {
            const passwordHash = await bcrypt.hash('doctor123', 10);
            const doctorId = await db.insert('users', {
                center_id: center.id,
                role: 'doctor',
                name: 'Martin Dupont',
                email: doctorEmail,
                password_hash: passwordHash,
                phone: '+33 1 23 45 67 91'
            });
            doctor = await db.queryOne('SELECT * FROM users WHERE id = ?', [doctorId]);
            console.log(`✓ Compte médecin démo créé: ${doctorEmail} / doctor123`);
        }

        // Ensure demo super admin exists
        const superAdminEmail = 'superadmin@drscreening.com';
        let superAdmin = await db.queryOne('SELECT * FROM users WHERE email = ?', [superAdminEmail]);
        if (!superAdmin) {
            const passwordHash = await bcrypt.hash('super123', 10);
            const superAdminId = await db.insert('users', {
                center_id: center.id,
                role: 'super_admin',
                name: 'Super Admin',
                email: superAdminEmail,
                password_hash: passwordHash,
                phone: '+33 1 23 45 67 00'
            });
            superAdmin = await db.queryOne('SELECT * FROM users WHERE id = ?', [superAdminId]);
            console.log(`✓ Compte super admin démo créé: ${superAdminEmail} / super123`);
        }

        // Ensure at least one demo patient exists
        const existingPatient = await db.queryOne(
            'SELECT id FROM patients WHERE center_id = ? LIMIT 1',
            [center.id]
        );

        if (!existingPatient) {
            const year = new Date().getFullYear();
            await db.insert('patients', {
                center_id: center.id,
                medical_record_number: `DM-${year}-001`,
                full_name: 'Jean Patient',
                date_of_birth: '1978-05-14',
                gender: 'M',
                phone: '+33 6 11 22 33 44',
                email: 'jean.patient.demo@example.com',
                address: 'Adresse patient demo',
                notes: 'Patient de démonstration'
            });
            console.log('✓ Patient démo créé');
        }
    } catch (err) {
        console.error('Erreur lors de la création des données de démonstration:', err.message);
    }
}

// Start server
server.listen(PORT, HOST, async () => {
    console.log('====================================');
    console.log('  DR Screening - Node.js Backend');
    console.log('====================================');
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`WebSocket running on ws://${HOST}:${process.env.WS_PORT || 8080}`);
    console.log('');
    console.log('Routes:');
    console.log(`  - Login:     http://localhost:${PORT}/login`);
    console.log(`  - Patients:  http://localhost:${PORT}/center/patients`);
    console.log(`  - Doctors:   http://localhost:${PORT}/center/doctors`);
    console.log(`  - New Exam:  http://localhost:${PORT}/center/new-exam`);
    console.log(`  - Dashboard: http://localhost:${PORT}/doctor/dashboard`);
    console.log(`  - Super:     http://localhost:${PORT}/super/dashboard`);
    console.log('');
    
    // Initialize database
    try {
        // Initialize SQLite database schema
        console.log('Initializing SQLite database...');
        await initDatabase();
        console.log('✓ Database schema initialized');
        
        // Test database connection
        await db.query('SELECT 1');
        console.log('✓ Database connected');
        await ensureDemoData();
        backfillPreviewImages()
            .then((stats) => {
                console.log(`✓ Preview auto-backfill complete: ${stats.generatedFromDicom} DICOM, ${stats.generatedFromImage} images, ${stats.alreadyPresent} existing`);
            })
            .catch((err) => {
                console.error('✗ Preview auto-backfill failed:', err.message);
            });
    } catch (err) {
        console.error('✗ Database initialization failed:', err.message);
    }
});

module.exports = app;
