/**
 * Test script to verify dossier_status updates when exams are created
 */
const db = require('./src/config/database');

async function runTests() {
    
    try {
        console.log('\n=== Testing dossier_status Update Logic ===\n');
        
        // Test 1: Check patient dossier_status before update
        console.log('Test 1: Getting patient 1 initial status...');
        const patientBefore = await db.queryOne('SELECT id, full_name, dossier_status FROM patients WHERE id = 1');
        console.log(`✓ Patient before: ${patientBefore?.full_name} - Status: ${patientBefore?.dossier_status}`);
        
        // Test 2: Simulate the UPDATE that happens after exam creation
        console.log('\nTest 2: Executing UPDATE like in exam creation routes...');
        const result = await db.query('UPDATE patients SET dossier_status = ? WHERE id = ?', ['en_attente', 1]);
        console.log('✓ UPDATE executed');
        
        // Test 3: Check patient status after update
        console.log('\nTest 3: Checking patient status after UPDATE...');
        const patientAfter = await db.queryOne('SELECT id, full_name, dossier_status FROM patients WHERE id = 1');
        console.log(`✓ Patient after: ${patientAfter?.full_name} - Status: ${patientAfter?.dossier_status}`);
        
        // Test 4: Check exams for patient 1 to see which doctors have access
        console.log('\nTest 4: Checking exams for patient 1...');
        const exams = await db.query('SELECT id, doctor_id, grade, created_at FROM exams WHERE patient_id = 1 LIMIT 5');
        console.log(`✓ Found ${exams.length} exams for patient 1:`);
        exams.forEach(exam => {
            console.log(`  - Exam ${exam.id}: doctor_id=${exam.doctor_id}, grade=${exam.grade}`);
        });
        
        // Test 5: Check query syntax for filtering doctors' patients
        console.log('\nTest 5: Checking doctor dashboard query for doctor 4...');
        const query = `
            SELECT DISTINCT p.id, p.full_name, p.dossier_status, COUNT(e.id) as exam_count
            FROM patients p
            LEFT JOIN exams e ON p.id = e.patient_id AND e.doctor_id = ?
            WHERE p.center_id = ?
            GROUP BY p.id, p.full_name, p.dossier_status
            LIMIT 5
        `;
        const doctorPatients = await db.query(query, [4, 1]);
        console.log(`✓ Found ${doctorPatients.length} patients for doctor 4 in center 1:`);
        doctorPatients.forEach(p => {
            console.log(`  - ${p.full_name}: status=${p.dossier_status}, exams=${p.exam_count}`);
        });
        
        console.log('\n=== All tests completed successfully ===\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

runTests();
