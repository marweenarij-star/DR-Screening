// Script global : associe tous les patients de tous les centres au premier médecin de chaque centre
// Usage : node associate-all-centers-to-first-doctor.js

const mysql = require('mysql2/promise');

async function associateAllCenters() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', // à adapter
    password: '', // à adapter
    database: 'dr_screening'
  });

  // Récupérer tous les centres
  const [centers] = await connection.execute('SELECT id FROM centers');
  let total = 0;
  for (const center of centers) {
    // Récupérer le premier médecin du centre
    const [doctors] = await connection.execute(
      "SELECT id FROM users WHERE center_id = ? AND role = 'doctor' ORDER BY id ASC LIMIT 1",
      [center.id]
    );
    if (doctors.length === 0) {
      console.log(`Aucun médecin trouvé pour le centre ${center.id}`);
      continue;
    }
    const doctorId = doctors[0].id;
    // Récupérer tous les patients du centre
    const [patients] = await connection.execute(
      'SELECT id FROM patients WHERE center_id = ?',
      [center.id]
    );
    for (const patient of patients) {
      const [result] = await connection.execute(
        'UPDATE exams SET doctor_id = ? WHERE patient_id = ?',
        [doctorId, patient.id]
      );
      total += result.affectedRows;
    }
    console.log(`Centre ${center.id} : tous les dossiers associés au médecin ${doctorId}`);
  }
  console.log(`Total examens modifiés : ${total}`);
  await connection.end();
}

associateAllCenters().catch(e => { console.error(e); process.exit(1); });
