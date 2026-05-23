/**
 * Migrate old exams to the new status system
 */
const db = require('./src/config/database');

async function migrateOldExams() {
    try {
        console.log('Starting migration of old exams...\n');

        // Mark unanalyzed exams (grade = -1) as new
        const newCount = await db.update('exams', 
            { is_new_for_doctor: 1 }, 
            'grade = ?', 
            [-1]
        );
        console.log(`✓ Marked ${newCount} unanalyzed exams as "nouveau"`);

        // Mark analyzed exams (grade >= 0) as read
        const readCount = await db.update('exams', 
            { is_new_for_doctor: 0 }, 
            'grade >= ?', 
            [0]
        );
        console.log(`✓ Marked ${readCount} analyzed exams as "consulted"\n`);

        // Show statistics
        const stats = await db.queryOne(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_new_for_doctor = 1 THEN 1 ELSE 0 END) as new_count,
                SUM(CASE WHEN is_new_for_doctor = 0 THEN 1 ELSE 0 END) as read_count
            FROM exams
        `);

        console.log('Migration complete! Statistics:');
        console.log(`  Total exams: ${stats.total}`);
        console.log(`  New (unanalyzed): ${stats.new_count}`);
        console.log(`  Read (analyzed): ${stats.read_count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrateOldExams();
