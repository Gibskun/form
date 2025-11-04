const { pool } = require('./database.js');

async function checkUsers() {
  try {
    const result = await pool.query('SELECT username, role FROM users ORDER BY username');
    console.log('Users in database:');
    result.rows.forEach(row => {
      console.log(`- ${row.username} (${row.role})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkUsers();