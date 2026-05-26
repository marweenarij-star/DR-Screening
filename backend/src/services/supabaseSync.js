const db = require('../config/database');
const { supabase } = require('./supabaseClient');

function mapCenter(center) {
    return {
        id: center.id,
        name: center.name || null,
        mamode: center.mode || 'full_platform',
        address: center.address || null,
        phone: center.phone || null,
        email: center.email || null,
        created_at: center.created_at || new Date().toISOString(),
        updated_at: center.updated_at || new Date().toISOString()
    };
}

function mapPatient(patient) {
    return {
        id: patient.id,
        center_id: patient.center_id,
        medical_record_number: patient.medical_record_number || null,
        full_name: patient.full_name || null,
        date_of_birth: patient.date_of_birth || null,
        age: patient.age || null,
        gender: patient.gender || null,
        diabetic_years: patient.diabetic_years || null,
        diabetes_type: patient.diabetes_type || null,
        phone: patient.phone || null,
        email: patient.email || null,
        address: patient.address || null,
        notes: patient.notes || null,
        created_at: patient.created_at || new Date().toISOString(),
        updated_at: patient.updated_at || new Date().toISOString()
    };
}

function mapExam(exam) {
    return {
        id: exam.id,
        center_id: exam.center_id,
        patient_id: exam.patient_id,
        doctor_id: exam.doctor_id,
        image_path: exam.image_path || null,
        heatmap_path: exam.heatmap_path || null,
        overlay_path: exam.overlay_path || null,
        grade: exam.grade != null ? exam.grade : -1,
        confidence: exam.confidence != null ? exam.confidence : 0,
        eye: exam.eye || 'unknown',
        notes: exam.notes || null,
        created_at: exam.created_at || new Date().toISOString(),
        updated_at: exam.updated_at || new Date().toISOString()
    };
}

function mapAlert(alert) {
    return {
        id: alert.id,
        exam_id: alert.exam_id,
        doctor_id: alert.doctor_id,
        type: alert.type || 'urgent',
        message: alert.message || null,
        is_read: alert.is_read != null ? Boolean(alert.is_read) : false,
        is_resolved: alert.is_resolved != null ? Boolean(alert.is_resolved) : false,
        resolved_comment: alert.resolved_comment || null,
        created_at: alert.created_at || new Date().toISOString(),
        read_at: alert.read_at || null,
        resolved_at: alert.resolved_at || null
    };
}

async function shouldSyncToSupabase(centerId) {
    // When Postgres (Supabase) is the primary database, rows are already stored
    // there directly — the legacy REST mirror is redundant and can cause schema
    // mismatches (e.g. the centers 'mamode' mapping), so skip it entirely.
    if (process.env.DATABASE_URL) return false;
    if (!centerId) return false;
    const center = await db.queryOne('SELECT mode FROM centers WHERE id = ?', [centerId]);
    return center && center.mode === 'full_platform';
}

async function syncCenterToSupabase(center) {
    const payload = mapCenter(center);
    const { error } = await supabase.from('centers').upsert([payload], { onConflict: 'id' });
    if (error) {
        throw new Error(`Supabase center sync failed: ${error.message}`);
    }
    return payload;
}

async function syncPatientToSupabase(patient) {
    const payload = mapPatient(patient);
    const { error } = await supabase.from('patients').upsert([payload], { onConflict: 'id' });
    if (error) {
        throw new Error(`Supabase patient sync failed: ${error.message}`);
    }
    return payload;
}

async function syncExamToSupabase(exam) {
    const payload = mapExam(exam);
    // Validate required fields to avoid DB check/NOT NULL violations on Supabase
    const gradeNum = Number(payload.grade);
    if (!Number.isFinite(gradeNum) || gradeNum < 0 || gradeNum > 4) {
        console.warn(`Skipping Supabase exam sync for exam ${payload.id}: invalid grade='${payload.grade}'`);
        return null;
    }
    if (!payload.image_path) {
        console.warn(`Skipping Supabase exam sync for exam ${payload.id}: missing image_path`);
        return null;
    }

    const { error } = await supabase.from('exams').upsert([payload], { onConflict: 'id' });
    if (error) {
        throw new Error(`Supabase exam sync failed: ${error.message}`);
    }
    return payload;
}

async function syncAlertToSupabase(alert) {
    const payload = mapAlert(alert);
    const { error } = await supabase.from('alerts').upsert([payload], { onConflict: 'id' });
    if (error) {
        throw new Error(`Supabase alert sync failed: ${error.message}`);
    }
    return payload;
}

module.exports = {
    shouldSyncToSupabase,
    syncCenterToSupabase,
    syncPatientToSupabase,
    syncExamToSupabase,
    syncAlertToSupabase
};
