require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '31.97.111.215',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'form',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123'
});

async function checkForms() {
  try {
    console.log('🔍 Checking forms in database...\n');
    
    const result = await pool.query(`
      SELECT f.id, f.title, f.form_type, f.is_active, f.created_at,
             COUNT(fq.id) as question_count
      FROM forms f
      LEFT JOIN form_questions fq ON f.id = fq.form_id
      GROUP BY f.id, f.title, f.form_type, f.is_active, f.created_at
      ORDER BY f.created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} forms:`);
    
    result.rows.forEach((form, index) => {
      console.log(`${index + 1}. ID: ${form.id}`);
      console.log(`   Title: "${form.title}"`);
      console.log(`   Type: ${form.form_type}`);
      console.log(`   Active: ${form.is_active}`);
      console.log(`   Questions: ${form.question_count}`);
      console.log(`   Created: ${form.created_at.toLocaleDateString()}`);
      console.log(`   Edit URL: /admin/edit-form/${form.id}`);
      console.log('');
    });
    
    if (result.rows.length === 0) {
      console.log('❌ No forms found! This could be why the edit functionality appears unresponsive.');
    } else {
      console.log('✅ Forms are available for editing.');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    pool.end();
  }
}

checkForms();