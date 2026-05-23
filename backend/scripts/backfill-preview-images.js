#!/usr/bin/env node
/*
 * Backfill preview images for old exams.
 * - DICOM (.dcm/.dicom): convert to JPEG _preview.jpg
 * - JPEG/PNG/WebP: copy original to _preview.jpg if missing
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const db = require('../src/config/database');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');

function isImageExt(ext) {
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

function isDicomExt(ext) {
    return ['.dcm', '.dicom'].includes(ext);
}

function resolveExistingPath(rawPath) {
    if (!rawPath) return null;
    const p = String(rawPath).trim();

    const candidates = [];

    if (path.isAbsolute(p)) {
        candidates.push(p);
    }

    candidates.push(path.join(backendRoot, p));
    candidates.push(path.join(projectRoot, p));

    // If path contains uploads marker, try backend/uploads and project/uploads variants.
    const normalized = p.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/uploads/');
    const fromUploads = idx >= 0 ? normalized.slice(idx + '/uploads/'.length) : normalized.replace(/^uploads\//, '');
    if (fromUploads) {
        candidates.push(path.join(backendRoot, 'uploads', fromUploads));
        candidates.push(path.join(projectRoot, 'uploads', fromUploads));
    }

    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) return c;
        } catch (_) {
            // ignore
        }
    }

    return null;
}

function getPythonExecutable() {
    const envPy = process.env.PYTHON || process.env.AI_SERVICE_PYTHON;
    if (envPy && fs.existsSync(envPy)) return envPy;

    const venvPy = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPy)) return venvPy;

    return 'python';
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function makePreviewPath(sourcePath) {
    return sourcePath.replace(/\.[^.]+$/, '_preview.jpg');
}

function backfillPreviewImages() {
    return db.query('SELECT id, image_path FROM exams ORDER BY id ASC')
        .then((exams) => {
            const py = getPythonExecutable();
            const converter = path.join(backendRoot, 'scripts', 'convert_dicom_to_jpeg.py');

            const stats = {
                total: exams.length,
                alreadyPresent: 0,
                generatedFromDicom: 0,
                generatedFromImage: 0,
                missingSource: 0,
                failed: 0
            };

            console.log(`Found ${stats.total} exams.`);

            for (const exam of exams) {
                const source = resolveExistingPath(exam.image_path);
                if (!source) {
                    stats.missingSource += 1;
                    console.log(`[MISS] exam ${exam.id}: source not found for image_path="${exam.image_path}"`);
                    continue;
                }

                const ext = path.extname(source).toLowerCase();
                const preview = makePreviewPath(source);

                if (fs.existsSync(preview)) {
                    stats.alreadyPresent += 1;
                    continue;
                }

                try {
                    ensureDir(path.dirname(preview));

                    if (isDicomExt(ext)) {
                        const result = spawnSync(py, [converter, source, preview], {
                            timeout: 30000,
                            windowsHide: true
                        });

                        if (result.status === 0 && fs.existsSync(preview)) {
                            stats.generatedFromDicom += 1;
                        } else {
                            stats.failed += 1;
                            const err = result.stderr ? String(result.stderr).trim() : '';
                            console.log(`[FAIL] exam ${exam.id}: DICOM conversion failed ${err}`);
                        }
                        continue;
                    }

                    if (isImageExt(ext)) {
                        fs.copyFileSync(source, preview);
                        stats.generatedFromImage += 1;
                        continue;
                    }

                    // For unknown extension, try copy fallback.
                    fs.copyFileSync(source, preview);
                    stats.generatedFromImage += 1;
                } catch (err) {
                    stats.failed += 1;
                    console.log(`[FAIL] exam ${exam.id}: ${err.message}`);
                }
            }

            console.log('--- Backfill summary ---');
            console.log(`Total exams: ${stats.total}`);
            console.log(`Already present: ${stats.alreadyPresent}`);
            console.log(`Generated (DICOM): ${stats.generatedFromDicom}`);
            console.log(`Generated (images): ${stats.generatedFromImage}`);
            console.log(`Missing source: ${stats.missingSource}`);
            console.log(`Failed: ${stats.failed}`);

            return stats;
        });
}

if (require.main === module) {
    backfillPreviewImages()
        .then(() => {
            db.db.close();
            process.exit(0);
        })
        .catch((err) => {
            console.error('Backfill failed:', err.message);
            try { db.db.close(); } catch (_) {}
            process.exit(1);
        });
}

module.exports = { backfillPreviewImages };
