const db = require('./src/config/database');

async function applyNewToAll() {
  try {
    console.log('Applying is_new_for_doctor = 1 for all exams with grade = -1...');
    const updated = await db.update('exams', { is_new_for_doctor: 1 }, 'grade = ?', [-1]);
    console.log(`Updated rows: ${updated}`);

    const stats = await db.queryOne(`
      SELECT 
        COUNT(*) as total_pending,
        SUM(CASE WHEN is_new_for_doctor = 1 THEN 1 ELSE 0 END) as new_count
      FROM exams
      WHERE grade = -1
    `);

    console.log('Stats after update:', stats);
    process.exit(0);
  } catch (err) {
    console.error('Error applying update:', err);
    process.exit(1);
  }
}

applyNewToAll();
