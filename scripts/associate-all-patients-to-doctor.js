// Script Node.js pour associer tous les patients d'un centre à un médecin unique
// Usage : node associate-all-patients-to-doctor.js <center_id> <doctor_id>

const mysql = require('mysql2/promise');

async function associateAllPatients(centerId, doctorId) {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', // à adapter
    password: '', // à adapter
    database: 'dr_screening'
  });

  // Récupérer tous les patients du centre
  const [patients] = await connection.execute(
    'SELECT id FROM patients WHERE center_id = ?',
    [centerId]
  );

  let total = 0;
  for (const patient of patients) {
    const [result] = await connection.execute(
      'UPDATE exams SET doctor_id = ? WHERE patient_id = ?',
      [doctorId, patient.id]
    );
    total += result.affectedRows;
  }
  console.log(`Modifiés : ${total} examens pour tous les patients du centre ${centerId} (nouveau doctor_id=${doctorId})`);
  await connection.end();
}

const [,, centerId, doctorId] = process.argv;
if (!centerId || !doctorId) {
  console.error('Usage: node associate-all-patients-to-doctor.js <center_id> <doctor_id>');
  process.exit(1);
}
associateAllPatients(centerId, doctorId).catch(e => { console.error(e); process.exit(1); });
