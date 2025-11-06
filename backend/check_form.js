const { pool } = require('./database');

async function check() {
  try {
    // Check available forms
    const forms = await pool.query('SELECT id, title, unique_link FROM forms WHERE is_active = true');
    console.log('Available forms:', forms.rows.length);
    forms.rows.forEach(row => 
      console.log('  -', row.id, row.title, row.unique_link)
    );

    if (forms.rows.length > 0) {
      const formId = forms.rows[0].id;
      console.log('\nChecking form ID:', formId);

      // Check conditional sections
      const condSections = await pool.query(
        'SELECT * FROM conditional_sections WHERE form_id = $1', 
        [formId]
      );
      console.log('\nConditional sections:', condSections.rows.length);
      condSections.rows.forEach(row => 
        console.log('  -', row.condition_type, row.condition_value, row.section_ids)
      );

      // Check role-based conditional sections
      const roleSections = await pool.query(
        'SELECT * FROM role_based_conditional_sections WHERE form_id = $1', 
        [formId]
      );
      console.log('\nRole-based conditional sections:', roleSections.rows.length);
      roleSections.rows.forEach(row => 
        console.log('  -', row.condition_type, row.condition_value, row.section_ids)
      );

      // Check all sections
      const allSections = await pool.query(
        'SELECT id, section_name FROM form_sections WHERE form_id = $1 ORDER BY order_number', 
        [formId]
      );
      console.log('\nAll sections:', allSections.rows.length);
      allSections.rows.forEach(row => 
        console.log('  -', row.id, row.section_name)
      );

      // Check all questions
      const allQuestions = await pool.query(
        'SELECT id, question_text, section_id FROM form_questions WHERE form_id = $1 ORDER BY order_number', 
        [formId]
      );
      console.log('\nAll questions:', allQuestions.rows.length);
      allQuestions.rows.forEach(row => 
        console.log('  -', row.id, row.question_text, 'section:', row.section_id)
      );
    }

  } catch(e) {
    console.error(e);
  }
  process.exit();
}

check();