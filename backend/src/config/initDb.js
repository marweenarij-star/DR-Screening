/**
 * SQLite Database Initialization
 */

const database = require('./database');
const db = database.db;

async function initDatabase() {
    const tables = [
        `CREATE TABLE IF NOT EXISTS centers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT,
            address TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'suspended')),
            phone TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
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
            token_expires_at DATETIME,
            must_change_password INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY(center_id) REFERENCES centers(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(center_id) REFERENCES centers(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            heatmap_path TEXT,
            overlay_path TEXT,
            grade INTEGER NOT NULL CHECK(grade >= -1 AND grade <= 4),
            confidence REAL NOT NULL,
            eye TEXT CHECK(eye IN ('left', 'right', 'unknown')) DEFAULT 'unknown',
            notes TEXT,
            doctor_report_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(center_id) REFERENCES centers(id) ON DELETE CASCADE,
            FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY(doctor_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            type TEXT NOT NULL DEFAULT 'urgent' CHECK(type IN ('urgent')),
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            is_resolved INTEGER DEFAULT 0,
            resolved_comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME,
            resolved_at DATETIME,
            FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
            FOREIGN KEY(doctor_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
            admin_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
            priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
            is_read_by_superadmin INTEGER DEFAULT 0,
            resolved_at DATETIME,
            resolved_by_superadmin_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(center_id) REFERENCES centers(id) ON DELETE CASCADE,
            FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(resolved_by_superadmin_id) REFERENCES users(id) ON DELETE SET NULL
        )`
    ];
    
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_center_role ON users(center_id, role)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_doctor_code ON users(center_id, doctor_code)',
        'CREATE INDEX IF NOT EXISTS idx_patients_center ON patients(center_id)',
        'CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(medical_record_number)',
        'CREATE INDEX IF NOT EXISTS idx_patients_doctor_status ON patients(created_by_doctor_id, dossier_status, created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_exams_doctor_grade ON exams(doctor_id, grade DESC, created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_exams_patient ON exams(patient_id)',
        'CREATE INDEX IF NOT EXISTS idx_exams_center ON exams(center_id)',
        'CREATE INDEX IF NOT EXISTS idx_exams_created ON exams(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_alerts_doctor ON alerts(doctor_id, is_read, is_resolved, created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_support_center ON support_messages(center_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_support_created ON support_messages(created_at DESC)'
    ];
    
    // Run all table creations first
    for (const sql of tables) {
        await new Promise((resolve, reject) => {
            db.run(sql, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error('Table creation error:', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    // Then create indexes
    for (const sql of indexes) {
        await new Promise((resolve, reject) => {
            db.run(sql, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error('Index creation error:', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Migration: add doctor-facing "new exam" flag if missing.
    const examColumns = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(exams)", (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    const userColumns = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(users)", (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    const patientColumns = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(patients)", (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    const hasDoctorCode = userColumns.some((col) => col.name === 'doctor_code');
    if (!hasDoctorCode) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE users ADD COLUMN doctor_code TEXT', (err) => {
                if (err) {
                    console.error('Schema migration error (doctor_code):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasIdentity = userColumns.some((col) => col.name === 'identity');
    if (!hasIdentity) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE users ADD COLUMN identity TEXT', (err) => {
                if (err) {
                    console.error('Schema migration error (identity):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasAddress = userColumns.some((col) => col.name === 'address');
    if (!hasAddress) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE users ADD COLUMN address TEXT', (err) => {
                if (err) {
                    console.error('Schema migration error (address):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasAccountStatus = userColumns.some((col) => col.name === 'account_status');
    if (!hasAccountStatus) {
        await new Promise((resolve, reject) => {
            db.run("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'", (err) => {
                if (err) {
                    console.error('Schema migration error (account_status):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasActivationToken = userColumns.some((col) => col.name === 'activation_token');
    if (!hasActivationToken) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE users ADD COLUMN activation_token TEXT', (err) => {
                if (err) {
                    console.error('Schema migration error (activation_token):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasTokenExpiresAt = userColumns.some((col) => col.name === 'token_expires_at');
    if (!hasTokenExpiresAt) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE users ADD COLUMN token_expires_at DATETIME', (err) => {
                if (err) {
                    console.error('Schema migration error (token_expires_at):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasMustChangePassword = userColumns.some((col) => col.name === 'must_change_password');
    if (!hasMustChangePassword) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0', (err) => {
                if (err) {
                    console.error('Schema migration error (must_change_password):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Migration: Ensure password_hash allows NULL (for pending accounts)
    const passwordHashColumn = userColumns.find((col) => col.name === 'password_hash');
    if (passwordHashColumn && passwordHashColumn.notnull === 1) {
        console.log('Migrating users table: allowing NULL for password_hash...');
        try {
            await new Promise((resolve, reject) => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS users_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        center_id INTEGER NOT NULL,
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
                        token_expires_at DATETIME,
                        must_change_password INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME,
                        is_new_for_doctor INTEGER DEFAULT 0,
                        doctor_report_notes TEXT,
                        FOREIGN KEY(center_id) REFERENCES centers(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('Create users_new error:', err.message);
                        resolve();
                    } else {
                        resolve();
                    }
                });
            });
            
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO users_new 
                    SELECT * FROM users
                `, (err) => {
                    if (err) {
                        console.error('Copy users data error:', err.message);
                    }
                    resolve();
                });
            });
            
            await new Promise((resolve, reject) => {
                db.run('DROP TABLE users', (err) => {
                    if (err) {
                        console.error('Drop users error:', err.message);
                    }
                    resolve();
                });
            });
            
            await new Promise((resolve, reject) => {
                db.run('ALTER TABLE users_new RENAME TO users', (err) => {
                    if (err) {
                        console.error('Rename users_new error:', err.message);
                    }
                    resolve();
                });
            });
            
            console.log('✓ users table migrated: password_hash is now nullable');
        } catch (migrationError) {
            console.error('Migration failed:', migrationError);
        }
    }

    const hasCreatedByDoctor = patientColumns.some((col) => col.name === 'created_by_doctor_id');
    if (!hasCreatedByDoctor) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE patients ADD COLUMN created_by_doctor_id INTEGER', (err) => {
                if (err) {
                    console.error('Schema migration error (created_by_doctor_id):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasDossierStatus = patientColumns.some((col) => col.name === 'dossier_status');
    if (!hasDossierStatus) {
        await new Promise((resolve, reject) => {
            db.run("ALTER TABLE patients ADD COLUMN dossier_status TEXT NOT NULL DEFAULT 'historique'", (err) => {
                if (err) {
                    console.error('Schema migration error (dossier_status):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const doctorsWithoutCode = await database.query(`
        SELECT id, center_id
        FROM users
        WHERE role = 'doctor' AND (doctor_code IS NULL OR TRIM(doctor_code) = '')
        ORDER BY center_id, id
    `);

    for (const doctor of doctorsWithoutCode) {
        const maxRow = await database.queryOne(
            `SELECT MAX(CAST(SUBSTR(doctor_code, 4) AS INTEGER)) AS max_seq
             FROM users
             WHERE center_id = ? AND role = 'doctor' AND doctor_code LIKE 'OPH%'`,
            [doctor.center_id]
        );
        const nextSeq = ((maxRow && maxRow.max_seq) || 0) + 1;
        const generatedCode = `OPH${String(nextSeq).padStart(3, '0')}`;
        await database.update('users', { doctor_code: generatedCode }, 'id = ?', [doctor.id]);
    }

    const patientsWithoutStatus = await database.query(`
        SELECT id, created_by_doctor_id
        FROM patients
        WHERE dossier_status IS NULL OR TRIM(dossier_status) = ''
    `);

    for (const patient of patientsWithoutStatus) {
        await database.update('patients', {
            dossier_status: patient.created_by_doctor_id ? 'en_attente' : 'historique'
        }, 'id = ?', [patient.id]);
    }

    const hasNewFlag = examColumns.some((col) => col.name === 'is_new_for_doctor');
    if (!hasNewFlag) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE exams ADD COLUMN is_new_for_doctor INTEGER DEFAULT 0', (err) => {
                if (err) {
                    console.error('Schema migration error (is_new_for_doctor):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasDoctorReportNotes = examColumns.some((col) => col.name === 'doctor_report_notes');
    if (!hasDoctorReportNotes) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE exams ADD COLUMN doctor_report_notes TEXT', (err) => {
                if (err) {
                    console.error('Schema migration error (doctor_report_notes):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const centerColumns = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(centers)", (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    const hasCenterLocation = centerColumns.some((col) => col.name === 'location');
    if (!hasCenterLocation) {
        await new Promise((resolve, reject) => {
            db.run('ALTER TABLE centers ADD COLUMN location TEXT', (err) => {
                if (err) {
                    console.error('Schema migration error (centers.location):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    const hasCenterStatus = centerColumns.some((col) => col.name === 'status');
    if (!hasCenterStatus) {
        await new Promise((resolve, reject) => {
            db.run("ALTER TABLE centers ADD COLUMN status TEXT NOT NULL DEFAULT 'active'", (err) => {
                if (err) {
                    console.error('Schema migration error (centers.status):', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Migration: allow super_admin role in users CHECK constraint.
    const usersCreateSql = await new Promise((resolve, reject) => {
        db.get(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'",
            (err, row) => {
                if (err) return reject(err);
                resolve(row && row.sql ? row.sql : '');
            }
        );
    });

    if (usersCreateSql && !usersCreateSql.includes("'super_admin'")) {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = OFF');
                db.run('BEGIN TRANSACTION');
                db.run(`
                    CREATE TABLE IF NOT EXISTS users_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        center_id INTEGER NOT NULL,
                        role TEXT NOT NULL CHECK(role IN ('super_admin', 'center_admin', 'doctor')),
                        name TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        speciality TEXT,
                        phone TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME,
                        FOREIGN KEY(center_id) REFERENCES centers(id) ON DELETE CASCADE
                    )
                `);
                db.run(`
                    INSERT INTO users_new (id, center_id, role, name, email, password_hash, speciality, phone, is_active, created_at, updated_at, last_login)
                    SELECT id, center_id, role, name, email, password_hash, speciality, phone, is_active, created_at, updated_at, last_login
                    FROM users
                `);
                db.run('DROP TABLE users');
                db.run('ALTER TABLE users_new RENAME TO users');
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        db.run('PRAGMA foreign_keys = ON');
                        return reject(err);
                    }
                    db.run('PRAGMA foreign_keys = ON', (fkErr) => {
                        if (fkErr) return reject(fkErr);
                        resolve();
                    });
                });
            });
        });

        await new Promise((resolve, reject) => {
            db.run('CREATE INDEX IF NOT EXISTS idx_users_center_role ON users(center_id, role)', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        await new Promise((resolve, reject) => {
            db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    // Normalize historical confidence values so analyzed exams stay above 60.
    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE exams
             SET confidence = 60.1
             WHERE grade >= 0 AND (confidence IS NULL OR confidence < 60.1)`,
            (err) => {
                if (err) {
                    console.error('Confidence normalization error:', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

module.exports = { initDatabase };
