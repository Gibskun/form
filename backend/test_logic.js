const { pool } = require('./database');

async function testCombinedLogic() {
  try {
    // Test the form with ID 12
    const formId = 12;
    const selectedYear = '2025';
    const selectedRole = 'employee';

    console.log(`Testing year: ${selectedYear}, role: ${selectedRole}`);

    // Step 1: Get year-based conditional sections
    let yearBasedSectionIds = [];
    const yearInt = parseInt(selectedYear);
    
    const conditionalSectionsResult = await pool.query(`
      SELECT * FROM conditional_sections 
      WHERE form_id = $1 AND is_active = true
    `, [formId]);

    // Filter based on year conditions
    const matchingYearConditions = conditionalSectionsResult.rows.filter(row => {
      const conditionValue = row.condition_value;
      
      try {
        switch (row.condition_type) {
          case 'year_equals':
            const targetYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt === targetYear;
            
          case 'year_less_equal':
            const maxYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt <= maxYear;
            
          default:
            return false;
        }
      } catch (error) {
        console.error(`Error processing year condition for row ${row.id}:`, error);
        return false;
      }
    });

    // Collect year-based section IDs
    matchingYearConditions.forEach(row => {
      yearBasedSectionIds = [...yearBasedSectionIds, ...row.section_ids];
    });
    yearBasedSectionIds = [...new Set(yearBasedSectionIds)];

    console.log('Year-based sections:', yearBasedSectionIds);

    // Step 2: Get role-based conditional sections
    let roleBasedSectionIds = [];
    
    const roleBasedSectionsResult = await pool.query(`
      SELECT * FROM role_based_conditional_sections 
      WHERE form_id = $1 AND is_active = true AND condition_value = $2
    `, [formId, selectedRole]);

    // Collect role-based section IDs
    roleBasedSectionsResult.rows.forEach(row => {
      roleBasedSectionIds = [...roleBasedSectionIds, ...row.section_ids];
    });
    roleBasedSectionIds = [...new Set(roleBasedSectionIds)];

    console.log('Role-based sections:', roleBasedSectionIds);

    // Step 3: Determine final section IDs (using UNION logic)
    let finalSectionIds = [];
    
    if (yearBasedSectionIds.length > 0 && roleBasedSectionIds.length > 0) {
      finalSectionIds = [...new Set([...yearBasedSectionIds, ...roleBasedSectionIds])];
      console.log('Combined logic: UNION of year and role sections');
    } else if (yearBasedSectionIds.length > 0) {
      finalSectionIds = yearBasedSectionIds;
      console.log('Year-only logic');
    } else if (roleBasedSectionIds.length > 0) {
      finalSectionIds = roleBasedSectionIds;
      console.log('Role-only logic');
    }

    console.log('Final sections to show:', finalSectionIds);

    // Get section names
    if (finalSectionIds.length > 0) {
      const sectionsResult = await pool.query(`
        SELECT id, section_name FROM form_sections 
        WHERE form_id = $1 AND id = ANY($2)
        ORDER BY order_number
      `, [formId, finalSectionIds]);

      console.log('Section details:');
      sectionsResult.rows.forEach(row => {
        console.log(`  - Section ${row.id}: ${row.section_name}`);
      });

      // Get questions
      const questionsResult = await pool.query(`
        SELECT id, question_text, section_id FROM form_questions 
        WHERE form_id = $1 AND section_id = ANY($2)
        ORDER BY order_number
      `, [formId, finalSectionIds]);

      console.log('Questions:');
      questionsResult.rows.forEach(row => {
        console.log(`  - Q${row.id}: ${row.question_text} (Section: ${row.section_id})`);
      });
    } else {
      console.log('No sections match the criteria');
    }

  } catch(e) {
    console.error(e);
  }
  process.exit();
}

testCombinedLogic();