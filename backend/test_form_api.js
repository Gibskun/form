const { pool } = require('./database.js');

async function testFormAPI() {
  try {
    const uniqueLink = 'f50aa267-d39f-4050-95e3-6ea55318bbff'; // Form 4 - test
    
    console.log('Testing public form API...');
    
    const formResult = await pool.query(`
      SELECT * FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);
    
    if (formResult.rows.length === 0) {
      console.log('Form not found with that unique link. Let me show all forms:');
      const allForms = await pool.query('SELECT id, title, unique_link FROM forms ORDER BY id');
      allForms.rows.forEach(form => {
        console.log(`Form ${form.id}: ${form.title} - Link: ${form.unique_link}`);
      });
      return;
    }

    const form = formResult.rows[0];
    console.log('Form found:', form.title);

    // Get questions exactly like the API does
    const questionsResult = await pool.query(`
      SELECT * FROM form_questions 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [form.id]);

    console.log(`\nFound ${questionsResult.rows.length} questions:`);
    questionsResult.rows.forEach(q => {
      console.log(`Q${q.id}: ${q.question_text} (${q.question_type})`);
      if (q.question_type === 'assessment') {
        console.log(`  Scale Order: ${JSON.stringify(q.scale_order)}`);
        console.log(`  Scale Order Type: ${typeof q.scale_order}`);
      }
    });

    // Test the exact transformation the API does
    const transformedQuestions = questionsResult.rows.map(q => ({
      ...q,
      options: q.options || null
    }));

    console.log('\nTransformed questions (like API sends):');
    transformedQuestions.forEach(q => {
      if (q.question_type === 'assessment') {
        console.log(`Q${q.id}: scale_order = ${JSON.stringify(q.scale_order)}`);
      }
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testFormAPI();