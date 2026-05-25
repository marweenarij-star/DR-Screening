/**
 * Supabase Storage Service
 * Uploads exam images and heatmaps to Supabase Storage for free persistent storage.
 * Falls back gracefully if Supabase is not configured.
 */

const fs = require('fs');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'exam-images';

// Lazy-load client so the server doesn't crash if Supabase env vars are missing
function getClient() {
    try {
        return require('./supabaseClient').supabase;
    } catch (e) {
        console.warn('[supabaseStorage] Supabase client unavailable:', e.message);
        return null;
    }
}

/**
 * Upload a local file to Supabase Storage.
 * @param {string} localFilePath  - Absolute path to the file on disk
 * @param {string} storageKey     - Path inside the bucket, e.g. "exams/patient_1/photo.jpg"
 * @param {string} contentType    - MIME type, e.g. "image/jpeg" | "image/png"
 * @returns {string|null}         - Public URL on success, null on failure
 */
async function uploadFile(localFilePath, storageKey, contentType = 'image/jpeg') {
    const client = getClient();
    if (!client) return null;

    try {
        const buffer = fs.readFileSync(localFilePath);
        return await uploadBuffer(buffer, storageKey, contentType);
    } catch (err) {
        console.error('[supabaseStorage] uploadFile error:', err.message);
        return null;
    }
}

/**
 * Upload a Buffer to Supabase Storage.
 * @param {Buffer} buffer         - File content
 * @param {string} storageKey     - Path inside the bucket
 * @param {string} contentType    - MIME type
 * @returns {string|null}         - Public URL on success, null on failure
 */
async function uploadBuffer(buffer, storageKey, contentType = 'image/jpeg') {
    const client = getClient();
    if (!client) return null;

    try {
        const { error } = await client.storage
            .from(BUCKET)
            .upload(storageKey, buffer, { contentType, upsert: true });

        if (error) {
            console.error('[supabaseStorage] upload error:', error.message);
            return null;
        }

        const { data } = client.storage.from(BUCKET).getPublicUrl(storageKey);
        const url = data?.publicUrl || null;
        if (url) console.log('[supabaseStorage] uploaded:', url);
        return url;
    } catch (err) {
        console.error('[supabaseStorage] uploadBuffer error:', err.message);
        return null;
    }
}

/**
 * Check whether a stored path/URL is already an absolute Supabase Storage URL.
 */
function isStorageUrl(value) {
    if (!value) return false;
    return String(value).startsWith('http://') || String(value).startsWith('https://');
}

module.exports = { uploadFile, uploadBuffer, isStorageUrl };
