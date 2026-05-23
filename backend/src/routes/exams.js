/**
 * Exam Routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const aiService = require('../services/aiService');
const mailService = require('../services/mailService');
const smsService = require('../services/smsService');
const { notifyNewExam, notifyNewAlert } = require('../services/websocket');

const router = express.Router();

// Configure multer
const uploadDir = path.join(__dirname, '../../uploads/exams');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const tempUploadDir = path.join(uploadDir, 'tmp');
if (!fs.existsSync(tempUploadDir)) {
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

function getTimestampString(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
}

function getPatientExamDir(patientId) {
    const dir = path.join(uploadDir, `patient_${patientId}`);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function ensureUniqueFilePath(dir, baseName, ext) {
    let candidateName = `${baseName}${ext}`;
    let candidatePath = path.join(dir, candidateName);
    let index = 1;

    while (fs.existsSync(candidatePath)) {
        candidateName = `${baseName}_${index}${ext}`;
        candidatePath = path.join(dir, candidateName);
        index += 1;
    }

    return candidatePath;
}

function moveUploadToPatientFolder(fileObj, patientId, eye = null) {
    const patientDir = getPatientExamDir(patientId);
    const originalExt = (path.extname(fileObj.originalname || '') || '').toLowerCase();
    const mimeType = String(fileObj.mimetype || '').toLowerCase();
    const ext = originalExt || (mimeType === 'application/dicom' ? '.dcm' : '.jpg');
    const suffix = eye ? `_${eye}` : '';
    const baseName = `${getTimestampString()}${suffix}`;
    const targetPath = ensureUniqueFilePath(patientDir, baseName, ext);
    fs.renameSync(fileObj.path, targetPath);

    // Always generate a preview cache next to the original file.
    try {
        const previewPath = targetPath.replace(/\.[^.]+$/, '_preview.jpg');
        if (ext === '.dcm') {
            const py = process.env.PYTHON || process.env.AI_SERVICE_PYTHON || path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
            const script = path.join(__dirname, '..', 'scripts', 'convert_dicom_to_jpeg.py');
            const spawnSync = require('child_process').spawnSync;
            const result = spawnSync(py, [script, targetPath, previewPath], { timeout: 15000 });
            if (result.status !== 0) {
                // Log but don't fail the upload flow
                console.warn('DICOM preview generation failed', result.stderr ? result.stderr.toString().slice(0,200) : result.stdout?.toString()?.slice(0,200));
            }
        } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            fs.copyFileSync(targetPath, previewPath);
        }
    } catch (e) {
        console.warn('Preview generation error', e && e.message);
    }

    return targetPath;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempUploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/dicom', 'application/octet-stream'];
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (allowedTypes.includes(file.mimetype) || ext === '.dcm') {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'), false);
        }
    }
});

const GRADE_LABELS = {
    0: 'Pas de RD',
    1: 'RD Légère',
    2: 'RD Modérée',
    3: 'RD Sévère',
    4: 'RD Proliférante'
};

const GRADE_CLASSES = {
    0: 'badge-success',
    1: 'badge-info',
    2: 'badge-warning',
    3: 'badge-danger',
    4: 'badge-critical'
};

// Helper to normalize file paths for URLs (Windows backslash to forward slash)
// Also strips the 'uploads/' or 'uploads\' prefix if present since we add it back
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

const toVersionedUrlPath = (filePath) => {
    const normalized = toUrlPath(filePath);
    if (!normalized) return null;
    const absolutePath = path.join(__dirname, '../../', normalized);
    let version = Date.now();
    try {
        if (fs.existsSync(absolutePath)) {
            version = Math.floor(fs.statSync(absolutePath).mtimeMs);
        }
    } catch (error) {
        version = Date.now();
    }
    return `/uploads/${normalized}?v=${version}`;
};

router.use(authMiddleware);

// POST /api/exams/preview - Temporary preview generation for admin file selection
router.post('/preview', roleMiddleware('center_admin'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file || !req.file.path) return res.status(400).json({ success: false, error: 'Fichier requis' });

        const tmpIn = req.file.path;
        const tmpOut = path.join(tempUploadDir, `${path.basename(req.file.filename).replace(/\.[^.]+$/, '')}_preview_tmp.jpg`);

        // If the uploaded file is an image, return a data URL directly
        const ext = path.extname(req.file.originalname || '').toLowerCase();
        const isDicom = ext === '.dcm' || req.file.mimetype === 'application/dicom' || req.file.mimetype === 'application/octet-stream';

        if (!isDicom && req.file.mimetype && req.file.mimetype.startsWith('image/')) {
            const buffer = fs.readFileSync(tmpIn);
            const mime = req.file.mimetype || 'image/jpeg';
            const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
            // Cleanup temp file
            try { fs.unlinkSync(tmpIn); } catch (e) {}
            return res.json({ success: true, preview_data: dataUrl, filename: req.file.originalname });
        }

        // For DICOM: call conversion script to produce a small JPEG preview
        const py = process.env.PYTHON || process.env.AI_SERVICE_PYTHON || path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
        const script = path.join(__dirname, '..', 'scripts', 'convert_dicom_to_jpeg.py');
        const spawnSync = require('child_process').spawnSync;
        const result = spawnSync(py, [script, tmpIn, tmpOut], { timeout: 15000 });

        if (result.status !== 0 || !fs.existsSync(tmpOut)) {
            // Cleanup
            try { fs.unlinkSync(tmpIn); } catch (e) {}
            console.warn('Preview conversion failed:', result.stderr ? String(result.stderr).slice(0,200) : result.stdout && String(result.stdout).slice(0,200));
            return res.status(500).json({ success: false, error: 'Conversion DICOM impossible' });
        }

        const buffer = fs.readFileSync(tmpOut);
        const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // Cleanup temp files
        try { fs.unlinkSync(tmpIn); } catch (e) {}
        try { fs.unlinkSync(tmpOut); } catch (e) {}

        return res.json({ success: true, preview_data: dataUrl, filename: req.file.originalname });
    } catch (err) {
        console.error('Preview API error:', err && err.message);
        return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/exams/submit - Submit exam without analysis (for admin)
router.post('/submit', roleMiddleware('center_admin'), upload.single('image'), async (req, res) => {
    let createdExamId = null;
    let createdImagePath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Image requise' });
        }
        
        const { patient_id, doctor_id, eye_type, notes } = req.body;
        
        if (!patient_id || !doctor_id) {
            return res.status(400).json({ success: false, error: 'Patient et médecin requis' });
        }
        
        // Verify patient belongs to center
        const patient = await db.queryOne(
            'SELECT * FROM patients WHERE id = ? AND center_id = ?',
            [patient_id, req.user.center_id]
        );
        
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }
        
        // Verify doctor belongs to center
        const doctor = await db.queryOne(
            'SELECT * FROM users WHERE id = ? AND center_id = ? AND role = ?',
            [doctor_id, req.user.center_id, 'doctor']
        );
        
        if (!doctor) {
            return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
        }
        
        // Map eye_type early for duplicate check
        let eyeValue = 'unknown';
        if (eye_type === 'OD') eyeValue = 'right';
        else if (eye_type === 'OG') eyeValue = 'left';
        
        // Check for duplicate exam (same patient, same eye, within 5 minutes)
        const recentExam = await db.queryOne(`
            SELECT id, created_at FROM exams
            WHERE patient_id = ? AND eye = ? AND created_at > datetime('now', '-5 minutes')
            ORDER BY created_at DESC LIMIT 1
        `, [patient_id, eyeValue]);
        
        if (recentExam) {
            // Delete uploaded file to avoid orphans
            if (req.file && req.file.path) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(409).json({ 
                success: false, 
                error: `Un examen pour cet œil a déjà été créé il y a moins de 5 minutes (ID: ${recentExam.id})`,
                existing_exam_id: recentExam.id
            });
        }
        
        // Move upload into patient-specific folder with timestamped filename.
        const finalImagePath = moveUploadToPatientFolder(req.file, patient_id, eyeValue);
        createdImagePath = finalImagePath;

        // Relative path for database
        const imagePath = path.relative(path.join(__dirname, '../../'), finalImagePath);
        const fullImagePath = finalImagePath;
        
        // Create exam with status 'pending' (grade = -1 means not analyzed yet)
        const examId = await db.insert('exams', {
            center_id: req.user.center_id,
            patient_id,
            doctor_id,
            image_path: imagePath,
            grade: -1,  // Pending analysis
            confidence: 0,
            heatmap_path: null,
            eye: eyeValue,
            notes: notes || null,
            is_new_for_doctor: 1
        });
        createdExamId = examId;
        
        // Once the exam is sent, move the patient dossier back to historical on the admin side.
        await db.update('patients', { dossier_status: 'historique' }, 'id = ?', [patient_id]);
        
        setImmediate(() => {
            autoAnalyzeExam(
                examId,
                fullImagePath,
                patient.full_name,
                req.user.center_id,
                doctor_id,
                { throwOnError: false, markAsNew: true }
            ).catch((bgError) => {
                console.error(`Background analysis failed for exam ${examId}:`, bgError);
            });
        });

        res.status(201).json({
            success: true,
            data: {
                id: examId,
                patient_id,
                doctor_id,
                status: 'pending_analysis',
                grade: -1,
                confidence: 0,
                message: 'Examen reçu. Analyse IA en cours puis transmission au médecin.'
            }
        });
        
    } catch (error) {
        if (createdExamId) {
            try {
                await db.query('DELETE FROM exams WHERE id = ? AND grade = -1', [createdExamId]);
            } catch (cleanupErr) {
                console.error(`Cleanup failed for exam ${createdExamId}:`, cleanupErr);
            }
        }
        if (createdImagePath && fs.existsSync(createdImagePath)) {
            try {
                fs.unlinkSync(createdImagePath);
            } catch (fileErr) {
                console.error(`Image cleanup failed for ${createdImagePath}:`, fileErr);
            }
        }
        console.error('Submit exam error:', error);
        res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
    }
});

// POST /api/exams/submit-both - Submit both eye images in a single exam (for admin)
router.post(
    '/submit-both',
    roleMiddleware('center_admin'),
    upload.fields([
        { name: 'image_od', maxCount: 1 },
        { name: 'image_og', maxCount: 1 }
    ]),
    async (req, res) => {
        let createdExamIdRight = null;
        let createdExamIdLeft = null;
        let createdImagePathRight = null;
        let createdImagePathLeft = null;
        try {
            const files = req.files || {};
            const fileOd = files.image_od && files.image_od[0];
            const fileOg = files.image_og && files.image_og[0];

            if (!fileOd || !fileOg) {
                // Clean up any uploaded file if the other is missing
                if (fileOd && fileOd.path) fs.unlink(fileOd.path, () => {});
                if (fileOg && fileOg.path) fs.unlink(fileOg.path, () => {});
                return res.status(400).json({ success: false, error: 'Les deux images (OD et OG) sont requises' });
            }

            const { patient_id, doctor_id, notes } = req.body;

            if (!patient_id || !doctor_id) {
                fs.unlink(fileOd.path, () => {});
                fs.unlink(fileOg.path, () => {});
                return res.status(400).json({ success: false, error: 'Patient et médecin requis' });
            }

            // Verify patient belongs to center
            const patient = await db.queryOne(
                'SELECT * FROM patients WHERE id = ? AND center_id = ?',
                [patient_id, req.user.center_id]
            );

            if (!patient) {
                fs.unlink(fileOd.path, () => {});
                fs.unlink(fileOg.path, () => {});
                return res.status(404).json({ success: false, error: 'Patient non trouvé' });
            }

            // Verify doctor belongs to center
            const doctor = await db.queryOne(
                'SELECT * FROM users WHERE id = ? AND center_id = ? AND role = ?',
                [doctor_id, req.user.center_id, 'doctor']
            );

            if (!doctor) {
                fs.unlink(fileOd.path, () => {});
                fs.unlink(fileOg.path, () => {});
                return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
            }

            // Relative paths for database
            const finalImagePathOd = moveUploadToPatientFolder(fileOd, patient_id, 'OD');
            const finalImagePathOg = moveUploadToPatientFolder(fileOg, patient_id, 'OG');
            createdImagePathRight = finalImagePathOd;
            createdImagePathLeft = finalImagePathOg;

            const imagePathOd = path.relative(path.join(__dirname, '../../'), finalImagePathOd);
            const imagePathOg = path.relative(path.join(__dirname, '../../'), finalImagePathOg);

            // Create two exams (right and left) with status 'pending' (grade = -1 means not analyzed yet)
            const examIdRight = await db.insert('exams', {
                center_id: req.user.center_id,
                patient_id,
                doctor_id,
                image_path: imagePathOd,
                grade: -1,
                confidence: 0,
                heatmap_path: null,
                eye: 'right',
                notes: notes || null,
                is_new_for_doctor: 1
            });
            createdExamIdRight = examIdRight;

            const examIdLeft = await db.insert('exams', {
                center_id: req.user.center_id,
                patient_id,
                doctor_id,
                image_path: imagePathOg,
                grade: -1,
                confidence: 0,
                heatmap_path: null,
                eye: 'left',
                notes: notes || null,
                is_new_for_doctor: 1
            });
            createdExamIdLeft = examIdLeft;

            // Once the exam is sent, move the patient dossier back to historical on the admin side.
            await db.update('patients', { dossier_status: 'historique' }, 'id = ?', [patient_id]);

            setImmediate(() => {
                Promise.all([
                    autoAnalyzeExam(
                        examIdRight,
                        finalImagePathOd,
                        patient.full_name,
                        req.user.center_id,
                        doctor_id,
                        { throwOnError: false, markAsNew: true }
                    ),
                    autoAnalyzeExam(
                        examIdLeft,
                        finalImagePathOg,
                        patient.full_name,
                        req.user.center_id,
                        doctor_id,
                        { throwOnError: false, markAsNew: true }
                    )
                ]).catch((bgError) => {
                    console.error(
                        `Background analysis failed for exams ${examIdRight} and/or ${examIdLeft}:`,
                        bgError
                    );
                });
            });

            res.status(201).json({
                success: true,
                data: {
                    patient_id,
                    doctor_id,
                    status: 'pending_analysis',
                    exams: [
                        {
                            id: examIdRight,
                            eye_type: 'OD',
                            grade: -1,
                            confidence: 0,
                            grade_label: 'En attente'
                        },
                        {
                            id: examIdLeft,
                            eye_type: 'OG',
                            grade: -1,
                            confidence: 0,
                            grade_label: 'En attente'
                        }
                    ],
                    message: 'Examens reçus. Analyse IA en cours puis transmission au médecin.'
                }
            });
        } catch (error) {
            if (createdExamIdRight) {
                try {
                    await db.query('DELETE FROM exams WHERE id = ? AND grade = -1', [createdExamIdRight]);
                } catch (cleanupErr) {
                    console.error(`Cleanup failed for exam ${createdExamIdRight}:`, cleanupErr);
                }
            }
            if (createdExamIdLeft) {
                try {
                    await db.query('DELETE FROM exams WHERE id = ? AND grade = -1', [createdExamIdLeft]);
                } catch (cleanupErr) {
                    console.error(`Cleanup failed for exam ${createdExamIdLeft}:`, cleanupErr);
                }
            }
            if (createdImagePathRight && fs.existsSync(createdImagePathRight)) {
                try {
                    fs.unlinkSync(createdImagePathRight);
                } catch (fileErr) {
                    console.error(`Image cleanup failed for ${createdImagePathRight}:`, fileErr);
                }
            }
            if (createdImagePathLeft && fs.existsSync(createdImagePathLeft)) {
                try {
                    fs.unlinkSync(createdImagePathLeft);
                } catch (fileErr) {
                    console.error(`Image cleanup failed for ${createdImagePathLeft}:`, fileErr);
                }
            }
            console.error('Submit both-eyes exam error:', error);
            res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
        }
    }
);

// Shared analysis function used by automatic submission flow and catch-up analysis.
async function autoAnalyzeExam(examId, fullImagePath, patientName, centerId, doctorId, options = {}) {
    const { throwOnError = false, markAsNew = true } = options;
    try {
        console.log(`Auto-analyzing exam ${examId}...`);
        
        // Get doctor email and phone for notifications
        const doctor = await db.queryOne('SELECT email, name, phone FROM users WHERE id = ?', [doctorId]);
        
        // Get AI prediction
        const prediction = await aiService.predict(fullImagePath);
        console.log(`Prediction for exam ${examId}:`, prediction);
        
        // Get Grad-CAM
        let gradcamRelPath = null;
        try {
            const gradcamBuffer = await aiService.getGradCAM(fullImagePath, prediction.grade);
            if (gradcamBuffer) {
                const gradcamPath = fullImagePath.replace(/\.[^.]+$/, '_gradcam.png');
                fs.writeFileSync(gradcamPath, gradcamBuffer);
                gradcamRelPath = path.relative(path.join(__dirname, '../../'), gradcamPath);
                console.log(`Grad-CAM saved for exam ${examId}: ${gradcamRelPath}`);
            }
        } catch (gradcamError) {
            console.error(`Grad-CAM generation failed for exam ${examId}:`, gradcamError);
        }

        // Fallback: keep visualization available even if Grad-CAM generation fails.
        if (!gradcamRelPath) {
            gradcamRelPath = path.relative(path.join(__dirname, '../../'), fullImagePath);
            console.warn(`Grad-CAM unavailable for exam ${examId}, fallback to original image`);
        }
        
        // Update exam with results
        await db.update('exams', {
            grade: prediction.grade,
            confidence: prediction.confidence,
            heatmap_path: gradcamRelPath,
            is_new_for_doctor: markAsNew ? 1 : 0
        }, 'id = ?', [examId]);

        notifyNewExam(centerId, {
            exam_id: examId,
            patient_name: patientName,
            doctor_id: doctorId,
            is_pending: false,
            is_new: true,
            grade: prediction.grade,
            confidence: prediction.confidence,
            is_urgent: prediction.grade >= 3,
            message: `Nouvel examen analysé pour ${patientName}`
        });
        
        // If urgent (grade >= 3), create alert and send email
        if (prediction.grade >= 3) {
            await db.insert('alerts', {
                exam_id: examId,
                doctor_id: doctorId,
                type: 'urgent',
                message: `Rétinopathie ${prediction.grade >= 4 ? 'proliférante' : 'sévère'} détectée (Grade ${prediction.grade}) - Confiance: ${prediction.confidence.toFixed(1)}%`
            });
            
            // Send WebSocket notification
            notifyNewAlert([doctorId], {
                exam_id: examId,
                patient_name: patientName,
                grade: prediction.grade,
                confidence: prediction.confidence,
                message: `URGENT: Rétinopathie de grade ${prediction.grade} détectée pour ${patientName}`
            });
            
            // Send email notification
            if (doctor && doctor.email) {
                console.log(`Sending urgent email to ${doctor.email} for exam ${examId}...`);
                try {
                    await mailService.sendUrgentAlert(
                        doctor.email,
                        patientName,
                        prediction.grade,
                        prediction.confidence,
                        examId,
                        doctor.name || `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
                    );
                    console.log(`Email sent successfully to ${doctor.email}`);
                } catch (emailError) {
                    console.error(`Failed to send email to ${doctor.email}:`, emailError.message);
                }
            }
            
            // Send SMS notification
            if (doctor && doctor.phone) {
                console.log(`Sending urgent SMS to ${doctor.phone} for exam ${examId}...`);
                try {
                    await smsService.sendUrgentSMS(
                        doctor.phone,
                        doctor.name,
                        patientName,
                        prediction.grade,
                        prediction.confidence,
                        examId
                    );
                    console.log(`SMS sent successfully to ${doctor.phone}`);
                } catch (smsError) {
                    console.error(`Failed to send SMS to ${doctor.phone}:`, smsError.message);
                }
            }
        }
        
        console.log(`Auto-analysis complete for exam ${examId}`);
        return { prediction, gradcamRelPath };
    } catch (error) {
        console.error(`Auto-analyze failed for exam ${examId}:`, error);
        if (throwOnError) {
            throw error;
        }
        return null;
    }
}

// POST /api/exams/:id/analyze - Doctor analyzes an exam
router.post('/:id/analyze', roleMiddleware('doctor'), async (req, res) => {
    try {
        const examId = req.params.id;
        const doctor = await db.queryOne('SELECT email, name, phone FROM users WHERE id = ?', [req.user.user_id]);
        
        // Get the exam
        const exam = await db.queryOne(`
            SELECT e.*, p.full_name as patient_name
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            WHERE e.id = ? AND e.doctor_id = ?
        `, [examId, req.user.user_id]);
        
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Examen non trouvé' });
        }
        
        // Check if already analyzed
        if (exam.grade >= 0) {
            return res.json({
                success: true,
                data: {
                    id: exam.id,
                    grade: exam.grade,
                    confidence: parseFloat(exam.confidence) || 0,
                    grade_label: GRADE_LABELS[exam.grade],
                    is_urgent: exam.grade >= 3,
                    image_url: `/uploads/${toUrlPath(exam.image_path)}`,
                    image_display_url: `/api/exams/${exam.id}/preview-image`,
                    heatmap_url: exam.heatmap_path ? toVersionedUrlPath(exam.heatmap_path) : null,
                    already_analyzed: true
                }
            });
        }
        
        // Get full image path
        const fullImagePath = path.join(__dirname, '../../', exam.image_path);
        
        // Get AI prediction
        const prediction = await aiService.predict(fullImagePath);
        
        // Get Grad-CAM
        let gradcamPath = null;
        let gradcamRelPath = null;
        const gradcamBuffer = await aiService.getGradCAM(fullImagePath, prediction.grade);
        if (gradcamBuffer) {
            gradcamPath = fullImagePath.replace(/\.[^.]+$/, '_gradcam.png');
            fs.writeFileSync(gradcamPath, gradcamBuffer);
            gradcamRelPath = path.relative(path.join(__dirname, '../../'), gradcamPath);
        }
        
        // Update exam with results
        await db.update('exams', {
            grade: prediction.grade,
            confidence: prediction.confidence,
            heatmap_path: gradcamRelPath
        }, 'id = ?', [examId]);
        
        // If urgent (grade >= 3), create alert
        if (prediction.grade >= 3) {
            await db.insert('alerts', {
                exam_id: examId,
                doctor_id: req.user.user_id,
                type: 'urgent',
                message: `Rétinopathie ${prediction.grade >= 4 ? 'proliférante' : 'sévère'} détectée (Grade ${prediction.grade}) - Confiance: ${prediction.confidence.toFixed(1)}%`
            });

            notifyNewAlert([req.user.user_id], {
                exam_id: examId,
                patient_name: exam.patient_name,
                grade: prediction.grade,
                confidence: prediction.confidence,
                message: `URGENT: Rétinopathie de grade ${prediction.grade} détectée pour ${exam.patient_name}`
            });

            if (doctor && doctor.email) {
                try {
                    await mailService.sendUrgentAlert(
                        doctor.email,
                        exam.patient_name,
                        prediction.grade,
                        prediction.confidence,
                        examId,
                        doctor.name || `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
                    );
                    console.log(`Email urgent envoyé au médecin ${doctor.email} pour l'examen ${examId}`);
                } catch (mailError) {
                    console.error(`Échec envoi email urgent pour l'examen ${examId}:`, mailError.message);
                }
            }
        }
        
        res.json({
            success: true,
            data: {
                id: examId,
                grade: prediction.grade,
                confidence: prediction.confidence,
                grade_label: GRADE_LABELS[prediction.grade],
                is_urgent: prediction.grade >= 3,
                image_url: `/uploads/${toUrlPath(exam.image_path)}`,
                image_display_url: `/api/exams/${examId}/preview-image`,
                heatmap_url: gradcamRelPath ? toVersionedUrlPath(gradcamRelPath) : null
            }
        });
        
    } catch (error) {
        console.error('Analyze exam error:', error);
        res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
    }
});

// POST /api/exams - Original route with immediate analysis (keep for backwards compatibility)
router.post('/', roleMiddleware('center_admin'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Image requise' });
        }
        
        const { patient_id, doctor_id, eye_type, notes } = req.body;
        
        if (!patient_id || !doctor_id) {
            return res.status(400).json({ success: false, error: 'Patient et médecin requis' });
        }
        
        // Verify patient belongs to center
        const patient = await db.queryOne(
            'SELECT * FROM patients WHERE id = ? AND center_id = ?',
            [patient_id, req.user.center_id]
        );
        
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient non trouvé' });
        }
        
        // Verify doctor belongs to center
        const doctor = await db.queryOne(
            'SELECT * FROM users WHERE id = ? AND center_id = ? AND role = ?',
            [doctor_id, req.user.center_id, 'doctor']
        );
        
        if (!doctor) {
            return res.status(404).json({ success: false, error: 'Médecin non trouvé' });
        }
        
        // Map eye_type to database enum values
        let eyeValue = 'unknown';
        if (eye_type === 'OD') eyeValue = 'right';
        else if (eye_type === 'OG') eyeValue = 'left';

        // Move upload into patient-specific folder with timestamped filename.
        const finalImagePath = moveUploadToPatientFolder(req.file, patient_id, eyeValue);

        // Get AI prediction
        const prediction = await aiService.predict(finalImagePath);
        
        // Get Grad-CAM
        let gradcamPath = null;
        const gradcamBuffer = await aiService.getGradCAM(finalImagePath, prediction.grade);
        if (gradcamBuffer) {
            gradcamPath = finalImagePath.replace(/\.[^.]+$/, '_gradcam.png');
            fs.writeFileSync(gradcamPath, gradcamBuffer);
        }
        
        // Relative paths for database
        const imagePath = path.relative(path.join(__dirname, '../../'), finalImagePath);
        const gradcamRelPath = gradcamPath ? path.relative(path.join(__dirname, '../../'), gradcamPath) : null;
        
        // Create exam
        const examId = await db.insert('exams', {
            center_id: req.user.center_id,
            patient_id,
            doctor_id,
            image_path: imagePath,
            grade: prediction.grade,
            confidence: prediction.confidence,
            heatmap_path: gradcamRelPath,
            eye: eyeValue,
            notes: notes || null,
            is_new_for_doctor: 1
        });
        
        // Once the exam is sent, move the patient dossier back to historical on the admin side.
        await db.update('patients', { dossier_status: 'historique' }, 'id = ?', [patient_id]);
        
        // If urgent (grade >= 3), create alert and send email
        if (prediction.grade >= 3) {
            // Create alert
            await db.insert('alerts', {
                exam_id: examId,
                doctor_id,
                type: 'urgent',
                message: `Rétinopathie ${prediction.grade >= 4 ? 'proliférante' : 'sévère'} détectée (Grade ${prediction.grade}) - Confiance: ${prediction.confidence.toFixed(1)}%`
            });
            
            // Send email
            const patientName = patient.full_name;
            await mailService.sendUrgentAlert(
                doctor.email,
                patientName,
                prediction.grade,
                prediction.confidence,
                examId,
                doctor.name || `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
            );
            
            // WebSocket notification
            notifyNewAlert([doctor_id], {
                exam_id: examId,
                message: `Cas urgent: ${patientName} - Grade ${prediction.grade}`
            });
        }
        
        // Notify via WebSocket
        notifyNewExam(req.user.center_id, {
            exam_id: examId,
            patient_name: patient.full_name,
            grade: prediction.grade,
            is_urgent: prediction.grade >= 3
        });
        
        res.status(201).json({
            success: true,
            data: {
                id: examId,
                patient_id,
                doctor_id,
                grade: prediction.grade,
                confidence: prediction.confidence,
                grade_label: GRADE_LABELS[prediction.grade],
                is_urgent: prediction.grade >= 3,
                image_path: `/uploads/${imagePath}`,
                gradcam_path: gradcamRelPath ? `/uploads/${gradcamRelPath}` : null
            }
        });
        
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
    }
});

// GET /api/exams/:id
router.get('/:id', async (req, res) => {
    try {
        const exam = await db.queryOne(`
            SELECT e.*,
                   p.full_name as patient_name,
                   p.medical_record_number, p.date_of_birth, p.gender, p.phone as patient_phone, p.email as patient_email,
                   u.name as doctor_name
            FROM exams e
            JOIN patients p ON e.patient_id = p.id
            JOIN users u ON e.doctor_id = u.id
            WHERE e.id = ?
        `, [req.params.id]);
        
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Examen non trouvé' });
        }
        
        const patientNameParts = (exam.patient_name || '').split(' ');
        const doctorNameParts = (exam.doctor_name || '').split(' ');
        
        const result = {
            id: exam.id,
            grade: exam.grade,
            confidence: parseFloat(exam.confidence) || 0,
            eye_type: exam.eye,
            notes: exam.notes,
            image_url: `/uploads/${toUrlPath(exam.image_path)}`,
            image_preview_url: null,
            heatmap_url: exam.heatmap_path ? toVersionedUrlPath(exam.heatmap_path) : null,
            overlay_url: null,
            patient: {
                id: exam.patient_id,
                first_name: patientNameParts[0] || '',
                last_name: patientNameParts.slice(1).join(' ') || '',
                medical_record_number: exam.medical_record_number,
                birth_date: exam.date_of_birth,
                gender: exam.gender,
                phone: exam.patient_phone,
                email: exam.patient_email
            },
            doctor: {
                id: exam.doctor_id,
                first_name: doctorNameParts[0] || '',
                last_name: doctorNameParts.slice(1).join(' ') || ''
            },
            created_at: exam.created_at
        };

        // If a JPEG preview exists next to the original image, expose it as image_preview_url
        try {
            const previewRel = String(exam.image_path || '').replace(/\.[^.]+$/, '_preview.jpg');
            const previewAbs = path.join(__dirname, '../../', previewRel);
            if (previewRel && fs.existsSync(previewAbs)) {
                result.image_preview_url = `/uploads/${toUrlPath(previewRel)}`;
            }
        } catch (e) {
            // ignore
        }
        
        res.json({ success: true, data: result });
        
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/exams/:id/preview-image - Serve a JPEG preview for the exam image (generate from DICOM if needed)
router.get('/:id/preview-image', async (req, res) => {
    try {
        const exam = await db.queryOne('SELECT image_path FROM exams WHERE id = ?', [req.params.id]);
        if (!exam || !exam.image_path) return res.status(404).json({ success: false, error: 'Examen non trouvé' });

        const rel = String(exam.image_path || '');
        const abs = path.join(__dirname, '../../', rel);
        const ext = path.extname(abs).toLowerCase();

        // If a permanent preview exists, serve it
        const previewRel = rel.replace(/\.[^.]+$/, '_preview.jpg');
        const previewAbs = path.join(__dirname, '../../', previewRel);
        if (previewRel && fs.existsSync(previewAbs)) {
            return res.sendFile(previewAbs);
        }

        // If original is a DICOM, try to convert on-the-fly using the existing script
        if (ext === '.dcm' || ext === '.dicom') {
            const py = process.env.PYTHON || process.env.AI_SERVICE_PYTHON || path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
            const script = path.join(__dirname, '..', 'scripts', 'convert_dicom_to_jpeg.py');
            const tmpOut = abs.replace(/\.[^.]+$/, '_preview_tmp.jpg');
            try {
                const spawnSync = require('child_process').spawnSync;
                const result = spawnSync(py, [script, abs, tmpOut], { timeout: 20000 });
                if (result.status === 0 && fs.existsSync(tmpOut)) {
                    res.setHeader('Content-Type', 'image/jpeg');
                    return res.sendFile(tmpOut, (err) => {
                        // Do not delete the temp file immediately to avoid race conditions; leave as cache
                        if (err) console.error('SendFile error:', err && err.message);
                    });
                }
                console.warn('On-the-fly DICOM conversion failed', result.stderr ? result.stderr.toString().slice(0,200) : result.stdout?.toString()?.slice(0,200));
            } catch (e) {
                console.error('Preview generation error (on-the-fly):', e && e.message);
            }
        }

        // Fallback: if it's an image file we can serve it directly
        if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
            return res.sendFile(abs);
        }

        return res.status(404).json({ success: false, error: 'Aperçu indisponible' });
    } catch (error) {
        console.error('Preview image error:', error && error.message);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
