const { pool } = require('./database.js');

async function testAPIEndpoint() {
  try {
    const formId = 4; // The form from the screenshot
    
    const result = await pool.query(`
      SELECT 
        id,
        question_text,
        question_text_id,
        scale_order,
        order_number
      FROM form_questions 
      WHERE form_id = $1 AND question_type = 'assessment'
      ORDER BY order_number
    `, [formId]);
    
    console.log('Raw database result for Form 4:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    const questions = result.rows.map(row => ({
      id: row.id,
      questionTextEn: row.question_text,
      questionTextAr: row.question_text_id || '',
      scaleOrder: row.scale_order || [1, 2, 3, 4, 5],
      questionOrder: row.order_number
    }));
    
    console.log('\nTransformed questions:');
    console.log(JSON.stringify(questions, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testAPIEndpoint();