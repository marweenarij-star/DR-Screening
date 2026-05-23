// Inspect SQLite DB structure and sample data (backend-local script)
// Usage: node backend/scripts/inspect-db.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'dr_screening.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

console.log('Using DB:', dbPath);
const db = new sqlite3.Database(dbPath);

const all = (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const get = (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

(async () => {
  try {
    console.log('\n== Table info: patients ==');
    const patientsInfo = await all("PRAGMA table_info('patients')");
    console.table(patientsInfo);

    console.log('\n== Table info: users ==');
    const usersInfo = await all("PRAGMA table_info('users')");
    console.table(usersInfo);

    console.log('\n== Table info: exams ==');
    const examsInfo = await all("PRAGMA table_info('exams')");
    console.table(examsInfo);

    const counts = await all(`SELECT 
      (SELECT COUNT(*) FROM centers) as centers,
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM patients) as patients,
      (SELECT COUNT(*) FROM exams) as exams
    `);
    console.log('\n== Counts ==');
    console.table(counts);

    console.log('\n== Distinct doctor_ids used in exams (sample 50) ==');
    const doctorIds = await all('SELECT DISTINCT doctor_id FROM exams LIMIT 50');
    console.log(doctorIds.map(r => r.doctor_id));

    console.log('\n== Exams with missing/invalid doctor (no matching user) sample ==');
    const invalidExams = await all(`
      SELECT e.id as exam_id, e.patient_id, e.doctor_id, p.center_id as patient_center
      FROM exams e
      LEFT JOIN users u ON u.id = e.doctor_id
      LEFT JOIN patients p ON p.id = e.patient_id
      WHERE u.id IS NULL
      LIMIT 20
    `);
    console.table(invalidExams);

    console.log('\n== Sample patients (first 20) ==');
    const samplePatients = await all('SELECT id, full_name, center_id, created_by_doctor_id FROM patients LIMIT 20');
    console.table(samplePatients);

    console.log('\n== Sample users with role=doctor (first 50) ==');
    const sampleDocs = await all("SELECT id, name, email, center_id, role FROM users WHERE role = 'doctor' LIMIT 50");
    console.table(sampleDocs);

    console.log('\n== Count of exams per doctor_id (top 20) ==');
    const perDoc = await all(`SELECT e.doctor_id, COUNT(*) as cnt FROM exams e GROUP BY e.doctor_id ORDER BY cnt DESC LIMIT 20`);
    console.table(perDoc);

    console.log('\n== Pending exams (grade = -1) sample ==');
    const pending = await all(`SELECT e.id as exam_id, e.patient_id, e.doctor_id, e.created_at, e.grade FROM exams e WHERE e.grade = -1 ORDER BY e.created_at DESC LIMIT 20`);
    console.table(pending);

    console.log('\nInspection complete.');
  } catch (err) {
    console.error('Inspect error:', err);
  } finally {
    db.close();
  }
})();
