const db = require('./src/config/database');

async function testPendingExams() {
  try {
    const exams = await db.query(`
      SELECT e.id, e.created_at, e.eye, e.notes, e.image_path, e.is_new_for_doctor,
             p.id as patient_id, p.full_name, p.medical_record_number, p.date_of_birth, p.notes as medical_history
      FROM exams e
      JOIN patients p ON e.patient_id = p.id
      WHERE e.doctor_id = 2 AND e.grade = -1
      ORDER BY e.created_at DESC
    `);

    console.log('\n=== Pending Exams (grade = -1) for Doctor 2 ===\n');
    console.log(`Found: ${exams.length} exam(s)\n`);

    const result = exams.map((exam) => ({
      id: exam.id,
      patient_name: exam.full_name,
      status: exam.is_new_for_doctor ? 'nouveau' : 'en_attente',
      is_new_for_doctor: exam.is_new_for_doctor
    }));

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testPendingExams();
