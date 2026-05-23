// Script Node.js pour mettre à jour le doctor_id des anciens examens d'un patient
// Usage : node update-exams-doctor.js <patient_id> <nouveau_doctor_id>

const mysql = require('mysql2/promise');

async function updateDoctorId(patientId, doctorId) {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', // à adapter
    password: '', // à adapter
    database: 'dr_screening'
  });

  const [result] = await connection.execute(
    'UPDATE exams SET doctor_id = ? WHERE patient_id = ?',
    [doctorId, patientId]
  );

  console.log(`Modifiés : ${result.affectedRows} examens pour le patient ${patientId} (nouveau doctor_id=${doctorId})`);
  await connection.end();
}

const [,, patientId, doctorId] = process.argv;
if (!patientId || !doctorId) {
  console.error('Usage: node update-exams-doctor.js <patient_id> <nouveau_doctor_id>');
  process.exit(1);
}
updateDoctorId(patientId, doctorId).catch(e => { console.error(e); process.exit(1); });
