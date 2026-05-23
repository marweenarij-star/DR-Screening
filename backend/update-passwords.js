/**
 * Script to update user passwords with proper bcrypt hashes
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function updatePasswords() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'dr_screening'
    });

    try {
        // Generate proper hashes
        const adminHash = await bcrypt.hash('admin123', 10);
        const doctorHash = await bcrypt.hash('doctor123', 10);

        console.log('Admin hash:', adminHash);
        console.log('Doctor hash:', doctorHash);

        // Update admin
        await connection.execute(
            'UPDATE users SET password_hash = ?, email = ? WHERE id = 1',
            [adminHash, 'admin@centre-ophtalmo.fr']
        );
        console.log('Updated admin user');

        // Update doctors
        await connection.execute(
            'UPDATE users SET password_hash = ? WHERE role = ?',
            [doctorHash, 'doctor']
        );

        // Update emails
        await connection.execute(
            'UPDATE users SET email = ? WHERE id = 2',
            ['dr.martin@centre-ophtalmo.fr']
        );
        await connection.execute(
            'UPDATE users SET email = ? WHERE id = 3',
            ['dr.leroy@centre-ophtalmo.fr']
        );
        await connection.execute(
            'UPDATE users SET email = ? WHERE id = 4',
            ['dr.moreau@centre-ophtalmo.fr']
        );
        console.log('Updated doctor users');

        // Verify
        const [users] = await connection.execute(
            'SELECT id, email, role, SUBSTRING(password_hash, 1, 10) as hash_prefix FROM users'
        );
        console.log('\nUpdated users:');
        users.forEach(u => console.log(`  ${u.id}: ${u.email} (${u.role}) - ${u.hash_prefix}...`));

        console.log('\nPasswords updated successfully!');
        console.log('\nTest credentials:');
        console.log('  Admin: admin@centre-ophtalmo.fr / admin123');
        console.log('  Doctor: dr.martin@centre-ophtalmo.fr / doctor123');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

updatePasswords();
