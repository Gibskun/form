const { pool } = require('./database.js');

async function checkAssessmentQuestions() {
  try {
    const result = await pool.query(`
      SELECT id, form_id, question_text, question_type, scale_order 
      FROM form_questions 
      WHERE question_type = 'assessment' 
      ORDER BY form_id, order_number
    `);
    
    console.log('Assessment questions in database:');
    if(result.rows.length === 0) {
      console.log('No assessment questions found');
    } else {
      result.rows.forEach(row => {
        console.log(`Form ${row.form_id}, Q${row.id}: ${row.question_text} (${row.question_type}) - Scale: ${JSON.stringify(row.scale_order)}`);
      });
    }
    
    // Also check all forms
    const formsResult = await pool.query('SELECT id, title, form_type FROM forms ORDER BY id');
    console.log('\nAll forms:');
    formsResult.rows.forEach(row => {
      console.log(`Form ${row.id}: ${row.title} (${row.form_type})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAssessmentQuestions();