/**
 * One-off repair: rebuild the Supabase Postgres schema correctly and seed
 * the demo accounts. The tables had been created with an outdated schema
 * (missing columns + restrictive ENUM types) that broke login.
 *
 * Usage: DBURL="postgres://..." node scripts/pg-repair.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { SCHEMA_SQL } = require('../src/config/pgSchema');

const pool = new Pool({
    connectionString: process.env.DBURL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log('Dropping old tables...');
    for (const t of ['alerts', 'exams', 'patients', 'refresh_tokens', 'support_messages', 'users', 'centers']) {
        await pool.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }

    console.log('Dropping old enum types...');
    for (const ty of ['centers_mode', 'users_role', 'account_status', 'gender_enum', 'diabetes_type', 'eye_enum', 'alert_type']) {
        await pool.query(`DROP TYPE IF EXISTS ${ty} CASCADE`);
    }

    console.log('Creating correct schema...');
    const statements = SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean);
    for (const s of statements) await pool.query(s);

    console.log('Seeding demo accounts...');
    const center = await pool.query(
        `INSERT INTO centers (name, mode, address, phone, email, status)
         VALUES ($1,$2,$3,$4,$5,'active') RETURNING id`,
        ['Centre Ophtalmo Démo', 'full_platform', 'Adresse du centre démo', '+33 1 23 45 67 89', 'contact@centre-ophtalmo.fr']
    );
    const centerId = center.rows[0].id;

    const mkUser = async (role, name, email, pwd) => {
        const hash = await bcrypt.hash(pwd, 10);
        await pool.query(
            `INSERT INTO users (center_id, role, name, email, password_hash, account_status, is_active)
             VALUES ($1,$2,$3,$4,$5,'active',1)`,
            [centerId, role, name, email, hash]
        );
        console.log(`  + ${role}: ${email} / ${pwd}`);
    };
    await mkUser('super_admin', 'Super Admin', 'superadmin@drscreening.com', 'super123');
    await mkUser('center_admin', 'Admin Centre', 'admin@centre-ophtalmo.fr', 'admin123');
    await mkUser('doctor', 'Martin Dupont', 'dr.martin@centre-ophtalmo.fr', 'doctor123');

    const counts = await pool.query(
        `SELECT (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM centers) AS centers,
                (SELECT COUNT(*) FROM patients) AS patients,
                (SELECT COUNT(*) FROM exams) AS exams`
    );
    console.log('Done. Counts:', counts.rows[0]);
}

main()
    .then(() => pool.end())
    .catch((e) => { console.error('REPAIR FAILED:', e.message); pool.end(); process.exit(1); });
