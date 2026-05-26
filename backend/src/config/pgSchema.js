/**
 * PostgreSQL schema — mirrors the SQLite schema built in initDb.js.
 *
 * IMPORTANT: idempotent (CREATE TABLE/INDEX IF NOT EXISTS, no DROP) so the
 * data survives every redeploy/restart. Boolean-ish columns are INTEGER and
 * grade allows -1 so the existing route SQL (`= 1`, `grade = -1`) works as-is.
 */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS centers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'full_platform' CHECK(mode IN ('full_platform', 'integration')),
    location TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'suspended')),
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('super_admin', 'center_admin', 'doctor')),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    identity TEXT,
    doctor_code TEXT,
    speciality TEXT,
    address TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    account_status TEXT NOT NULL DEFAULT 'active',
    activation_token TEXT,
    token_expires_at TIMESTAMPTZ,
    must_change_password INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    medical_record_number TEXT,
    created_by_doctor_id INTEGER,
    dossier_status TEXT NOT NULL DEFAULT 'historique' CHECK(dossier_status IN ('en_attente', 'historique')),
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    age INTEGER,
    gender TEXT CHECK(gender IN ('M', 'F', 'other')),
    diabetic_years INTEGER,
    diabetes_type TEXT CHECK(diabetes_type IN ('type1', 'type2', 'gestational', 'other')),
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    heatmap_path TEXT,
    overlay_path TEXT,
    grade INTEGER NOT NULL CHECK(grade >= -1 AND grade <= 4),
    confidence DOUBLE PRECISION NOT NULL,
    eye TEXT CHECK(eye IN ('left', 'right', 'unknown')) DEFAULT 'unknown',
    notes TEXT,
    doctor_report_notes TEXT,
    is_new_for_doctor INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'urgent' CHECK(type IN ('urgent')),
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    is_resolved INTEGER DEFAULT 0,
    resolved_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY,
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    is_read_by_superadmin INTEGER DEFAULT 0,
    resolved_at TIMESTAMPTZ,
    resolved_by_superadmin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_center_role ON users(center_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_doctor_code ON users(center_id, doctor_code);
CREATE INDEX IF NOT EXISTS idx_patients_center ON patients(center_id);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(medical_record_number);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_status ON patients(created_by_doctor_id, dossier_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_doctor_grade ON exams(doctor_id, grade DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_patient ON exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_exams_center ON exams(center_id);
CREATE INDEX IF NOT EXISTS idx_exams_created ON exams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_doctor ON alerts(doctor_id, is_read, is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_center ON support_messages(center_id, status);
CREATE INDEX IF NOT EXISTS idx_support_created ON support_messages(created_at DESC);
`;

module.exports = { SCHEMA_SQL };
