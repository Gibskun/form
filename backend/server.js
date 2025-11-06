require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const { pool, testConnection, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0' 
  });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Super Admin middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
};

// ==================== AUTH ROUTES ====================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND (role = $2 OR role = $3)',
      [username, 'admin', 'super_admin']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password (superadmin only)
app.post('/api/superadmin/change-password', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current user data
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    console.log(`🔐 Superadmin ${user.username} changed password successfully`);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== FORM MANAGEMENT ROUTES ====================

// Get all forms (admin)
app.get('/api/admin/forms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, u.username as creator_name,
        (SELECT COUNT(*) FROM form_responses WHERE form_id = f.id) as response_count
      FROM forms f
      LEFT JOIN users u ON f.created_by = u.id
      ORDER BY f.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new form (admin)
app.post('/api/admin/forms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, form_type, questions, conditionalQuestions, sections } = req.body;
    const unique_link = uuidv4();

    // Insert form
    const formResult = await pool.query(`
      INSERT INTO forms (title, description, form_type, created_by, unique_link)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [title, description, form_type, req.user.id, unique_link]);

    const formId = formResult.rows[0].id;

    // Insert sections first if they exist
    const sectionIdMap = {}; // Maps frontend section ID to database ID
    if (sections && sections.length > 0) {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionResult = await pool.query(`
          INSERT INTO form_sections (form_id, section_name, section_description, order_number)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [formId, section.name, section.description || null, i + 1]);
        
        if (section.id) {
          sectionIdMap[section.id] = sectionResult.rows[0].id;
        }
      }
    }

    // Insert questions and create ID mapping
    const questionIdMap = {}; // Maps frontend ID to database ID
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const sectionId = q.section_id ? sectionIdMap[q.section_id] : null;
        
        const questionResult = await pool.query(`
          INSERT INTO form_questions 
          (form_id, question_text, question_text_id, question_type, options, 
           left_statement, right_statement, left_statement_id, right_statement_id, 
           is_required, order_number, section_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `, [
          formId, q.question_text, q.question_text_id, q.question_type,
          q.options ? JSON.stringify(q.options) : null,
          q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
          q.is_required, i + 1, sectionId
        ]);
        
        // Map frontend ID to database ID
        if (q.id) {
          questionIdMap[q.id] = questionResult.rows[0].id;
        }
      }
    }

    // Insert conditional questions with mapped IDs
    if (conditionalQuestions && conditionalQuestions.length > 0) {
      for (const cq of conditionalQuestions) {
        // Map frontend question IDs to database IDs
        const mappedQuestionIds = cq.question_ids.map(frontendId => {
          return questionIdMap[frontendId] || frontendId;
        });
        
        await pool.query(`
          INSERT INTO conditional_questions (form_id, condition_type, condition_value, question_ids)
          VALUES ($1, $2, $3, $4)
        `, [formId, cq.condition_type, cq.condition_value, mappedQuestionIds]);
      }
    }

    // Handle conditional sections (section-based conditional logic)
    const { conditionalSections } = req.body;
    
    // Insert new conditional sections with mapped IDs  
    if (conditionalSections && conditionalSections.length > 0) {
      for (const cs of conditionalSections) {
        // Map frontend section IDs to database IDs
        const mappedSectionIds = cs.section_ids.map(frontendId => {
          return sectionIdMap[frontendId] || frontendId;
        });
        
        await pool.query(`
          INSERT INTO conditional_sections (form_id, condition_name, condition_type, condition_value, section_ids)
          VALUES ($1, $2, $3, $4, $5)
        `, [formId, cs.condition_name, cs.condition_type, cs.condition_value, mappedSectionIds]);
      }
    }

    // Handle role-based conditional sections
    const { roleBasedConditionalSections } = req.body;
    if (roleBasedConditionalSections && roleBasedConditionalSections.length > 0) {
      for (const rbcs of roleBasedConditionalSections) {
        // Map frontend section IDs to database IDs
        const mappedSectionIds = rbcs.section_ids.map(frontendId => {
          return sectionIdMap[frontendId] || frontendId;
        });
        
        await pool.query(`
          INSERT INTO role_based_conditional_sections (form_id, condition_name, condition_type, condition_value, section_ids, management_names)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [formId, rbcs.condition_name, rbcs.condition_type || 'role_equals', rbcs.condition_value, mappedSectionIds, rbcs.management_names]);
      }
    }

    res.json({
      ...formResult.rows[0],
      message: 'Form created successfully'
    });
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single form for editing (admin)
app.get('/api/admin/forms/:formId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { formId } = req.params;

    // Get form details
    const formResult = await pool.query(`
      SELECT * FROM forms WHERE id = $1
    `, [formId]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.rows[0];

    // Get sections
    const sectionsResult = await pool.query(`
      SELECT * FROM form_sections 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [form.id]);

    // Get questions
    const questionsResult = await pool.query(`
      SELECT * FROM form_questions 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [form.id]);

    // Get conditional questions
    const conditionalResult = await pool.query(`
      SELECT * FROM conditional_questions WHERE form_id = $1
    `, [form.id]);

    // Get conditional sections
    const conditionalSectionsResult = await pool.query(`
      SELECT * FROM conditional_sections WHERE form_id = $1 AND is_active = true
    `, [form.id]);

    // Get role-based conditional sections
    const roleBasedConditionalSectionsResult = await pool.query(`
      SELECT * FROM role_based_conditional_sections WHERE form_id = $1 AND is_active = true
    `, [form.id]);

    res.json({
      ...form,
      sections: sectionsResult.rows,
      questions: questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      })),
      conditional_questions: conditionalResult.rows,
      conditional_sections: conditionalSectionsResult.rows,
      role_based_conditional_sections: roleBasedConditionalSectionsResult.rows
    });
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update form (admin)
app.put('/api/admin/forms/:formId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { formId } = req.params;
    const { title, description, form_type, questions, conditionalQuestions, sections } = req.body;
    
    console.log('PUT /api/admin/forms/:formId - Received sections:', JSON.stringify(sections, null, 2));
    console.log('PUT /api/admin/forms/:formId - Processing sections with IDs:', sections?.map(s => ({ id: s.id, name: s.name || s.section_name })));

    // Check if form exists and user owns it (or is admin)
    const formCheck = await pool.query(`
      SELECT * FROM forms WHERE id = $1
    `, [formId]);

    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Update form details
    const formResult = await pool.query(`
      UPDATE forms 
      SET title = $1, description = $2, form_type = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [title, description, form_type, formId]);

    // Get existing questions to preserve IDs and scale_order
    const existingQuestions = await pool.query(`
      SELECT id, question_text, question_text_id, question_type, order_number, scale_order,
             left_statement, right_statement, left_statement_id, right_statement_id, options, is_required
      FROM form_questions WHERE form_id = $1 ORDER BY order_number
    `, [formId]);

    // Create maps for existing questions
    const existingQuestionsMap = {};
    existingQuestions.rows.forEach(row => {
      existingQuestionsMap[row.order_number] = row;
    });

    // Handle sections - get existing sections first
    const existingSections = await pool.query(`
      SELECT id, section_name, section_description, order_number
      FROM form_sections WHERE form_id = $1 ORDER BY order_number
    `, [formId]);
    
    const existingSectionsMap = {};
    existingSections.rows.forEach(row => {
      existingSectionsMap[row.order_number] = row;
    });

    // Process sections - update existing, create new, delete unused
    const sectionIdMap = {}; // Maps frontend section ID to database ID
    if (sections && sections.length > 0) {
      // Filter out invalid sections
      const validSections = sections.filter(section => {
        // Check for both 'name' (from frontend) and 'section_name' (from database)
        const sectionName = section.name || section.section_name;
        if (!section || !sectionName || sectionName.trim() === '') {
          console.warn('Filtering out invalid section:', section);
          return false;
        }
        return true;
      });

      console.log(`Processing ${validSections.length} valid sections out of ${sections.length} total`);

      for (let i = 0; i < validSections.length; i++) {
        const section = validSections[i];
        const orderNumber = i + 1;

        try {
          // Get section name from either property
          const sectionName = (section.name || section.section_name).trim();
          const sectionDescription = section.description || section.section_description || null;
          
          let sectionDatabaseId;

          // If section has an existing database ID, update it directly
          if (section.id && Number.isInteger(section.id)) {
            console.log(`📝 Updating existing section with ID ${section.id}: "${sectionName}"`);
            await pool.query(`
              UPDATE form_sections 
              SET section_name = $1, section_description = $2, order_number = $3, updated_at = CURRENT_TIMESTAMP
              WHERE id = $4 AND form_id = $5
            `, [sectionName, sectionDescription, orderNumber, section.id, formId]);
            
            sectionDatabaseId = section.id;
            sectionIdMap[section.id] = section.id;
          } else {
            // Check if there's an existing section at this position
            const existingSection = existingSectionsMap[orderNumber];
            
            if (existingSection) {
              console.log(`📝 Updating existing section at position ${orderNumber} with ID ${existingSection.id}: "${sectionName}"`);
              await pool.query(`
                UPDATE form_sections 
                SET section_name = $1, section_description = $2, order_number = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4 AND form_id = $5
              `, [sectionName, sectionDescription, orderNumber, existingSection.id, formId]);
              
              sectionDatabaseId = existingSection.id;
              if (section.id) {
                sectionIdMap[section.id] = existingSection.id;
              }
            } else {
              // Create new section
              console.log(`➕ Creating new section at position ${orderNumber}: "${sectionName}"`);
              const sectionResult = await pool.query(`
                INSERT INTO form_sections (form_id, section_name, section_description, order_number)
                VALUES ($1, $2, $3, $4)
                RETURNING id
              `, [formId, sectionName, sectionDescription, orderNumber]);
              
              sectionDatabaseId = sectionResult.rows[0].id;
              if (section.id) {
                sectionIdMap[section.id] = sectionDatabaseId;
              }
            }
          }
        } catch (sectionError) {
          console.error('Error processing section:', section, sectionError);
          throw sectionError;
        }
      }
      
      // Delete unused sections (sections beyond the valid count)
      if (validSections.length < existingSections.rows.length) {
        const sectionsToDelete = existingSections.rows.slice(validSections.length);
        console.log(`Deleting ${sectionsToDelete.length} unused sections`);
        for (const sectionToDelete of sectionsToDelete) {
          await pool.query('DELETE FROM form_sections WHERE id = $1', [sectionToDelete.id]);
        }
      }
    } else {
      console.log('No sections provided, deleting all existing sections');
      // If no sections provided, delete all existing sections
      await pool.query('DELETE FROM form_sections WHERE form_id = $1', [formId]);
    }

    // Delete conditional questions (we'll recreate these)
    await pool.query('DELETE FROM conditional_questions WHERE form_id = $1', [formId]);

    // Process updated questions - preserve existing IDs when possible
    const questionIdMap = {}; // Maps frontend ID to database ID
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const orderNumber = i + 1;

        let questionResult;
        let questionDatabaseId;
        
        // Determine section ID - use mapped ID if available, otherwise use direct ID
        const sectionId = q.section_id ? (sectionIdMap[q.section_id] || q.section_id) : null;
        
        // Preserve existing scale_order if this is an assessment question
        let scaleOrder = null;
        if (q.question_type === 'assessment') {
          // Check if question has existing scale_order
          const existingQuestion = existingQuestionsMap[orderNumber];
          scaleOrder = q.scale_order || existingQuestion?.scale_order || [1, 2, 3, 4, 5];
        }

        // If question has an existing database ID, update it directly
        if (q.id && Number.isInteger(q.id)) {
          console.log(`📝 Updating existing question with ID ${q.id} at position ${orderNumber}`);
          
          questionResult = await pool.query(`
            UPDATE form_questions 
            SET question_text = $1, question_text_id = $2, question_type = $3, options = $4,
                left_statement = $5, right_statement = $6, left_statement_id = $7, right_statement_id = $8,
                is_required = $9, order_number = $10, scale_order = $11, section_id = $12, updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 AND form_id = $14
            RETURNING id
          `, [
            q.question_text, q.question_text_id, q.question_type,
            q.options ? JSON.stringify(q.options) : null,
            q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
            q.is_required, orderNumber, scaleOrder ? JSON.stringify(scaleOrder) : null,
            sectionId, q.id, formId
          ]);
          
          questionDatabaseId = q.id;
          questionIdMap[q.id] = q.id;
        } else {
          // Check if there's an existing question at this position
          const existingQuestion = existingQuestionsMap[orderNumber];
          
          if (existingQuestion) {
            console.log(`📝 Updating existing question ID ${existingQuestion.id} at position ${orderNumber}`);
            
            questionResult = await pool.query(`
              UPDATE form_questions 
              SET question_text = $1, question_text_id = $2, question_type = $3, options = $4,
                  left_statement = $5, right_statement = $6, left_statement_id = $7, right_statement_id = $8,
                  is_required = $9, order_number = $10, scale_order = $11, section_id = $12, updated_at = CURRENT_TIMESTAMP
              WHERE id = $13 AND form_id = $14
              RETURNING id
            `, [
              q.question_text, q.question_text_id, q.question_type,
              q.options ? JSON.stringify(q.options) : null,
              q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
              q.is_required, orderNumber, scaleOrder ? JSON.stringify(scaleOrder) : null,
              sectionId, existingQuestion.id, formId
            ]);
            
            questionDatabaseId = existingQuestion.id;
            if (q.id) {
              questionIdMap[q.id] = existingQuestion.id;
            }
          } else {
            // Create new question (only for truly new questions)
            console.log(`🆕 Creating new question at position ${orderNumber}`);
            
            questionResult = await pool.query(`
              INSERT INTO form_questions 
              (form_id, question_text, question_text_id, question_type, options, 
               left_statement, right_statement, left_statement_id, right_statement_id, 
               is_required, order_number, scale_order, section_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              RETURNING id
            `, [
            formId, q.question_text, q.question_text_id, q.question_type,
            q.options ? JSON.stringify(q.options) : null,
            q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
            q.is_required, orderNumber, scaleOrder ? JSON.stringify(scaleOrder) : null,
            sectionId
          ]);
          
            // Map frontend ID to new database ID
            questionDatabaseId = questionResult.rows[0].id;
            if (q.id) {
              questionIdMap[q.id] = questionDatabaseId;
            }
          }
        }
      }
      
      // Delete any remaining questions that are no longer needed (if form got shorter)
      if (questions.length < existingQuestions.rows.length) {
        const questionsToDelete = existingQuestions.rows.slice(questions.length);
        for (const questionToDelete of questionsToDelete) {
          console.log(`🗑️ Deleting unused question ID ${questionToDelete.id} from position ${questionToDelete.order_number}`);
          await pool.query('DELETE FROM form_questions WHERE id = $1', [questionToDelete.id]);
        }
      }
    }

    // Insert updated conditional questions with mapped IDs
    if (conditionalQuestions && conditionalQuestions.length > 0) {
      for (const cq of conditionalQuestions) {
        // Map frontend question IDs to database IDs
        const mappedQuestionIds = cq.question_ids.map(frontendId => {
          return questionIdMap[frontendId] || frontendId;
        });
        
        await pool.query(`
          INSERT INTO conditional_questions (form_id, condition_type, condition_value, question_ids)
          VALUES ($1, $2, $3, $4)
        `, [formId, cq.condition_type, cq.condition_value, mappedQuestionIds]);
      }
    }

    // Handle conditional sections (section-based conditional logic)
    const { conditionalSections } = req.body;
    
    // Delete existing conditional sections
    await pool.query('DELETE FROM conditional_sections WHERE form_id = $1', [formId]);
    
    // Insert new conditional sections with mapped IDs  
    if (conditionalSections && conditionalSections.length > 0) {
      for (const cs of conditionalSections) {
        // Map frontend section IDs to database IDs
        const mappedSectionIds = cs.section_ids.map(frontendId => {
          return sectionIdMap[frontendId] || frontendId;
        });
        
        await pool.query(`
          INSERT INTO conditional_sections (form_id, condition_name, condition_type, condition_value, section_ids)
          VALUES ($1, $2, $3, $4, $5)
        `, [formId, cs.condition_name, cs.condition_type, cs.condition_value, mappedSectionIds]);
      }
    }

    // Handle role-based conditional sections
    const { roleBasedConditionalSections } = req.body;
    
    // Delete existing role-based conditional sections
    await pool.query('DELETE FROM role_based_conditional_sections WHERE form_id = $1', [formId]);
    
    // Insert new role-based conditional sections with mapped IDs  
    if (roleBasedConditionalSections && roleBasedConditionalSections.length > 0) {
      for (const rbcs of roleBasedConditionalSections) {
        // Map frontend section IDs to database IDs
        const mappedSectionIds = rbcs.section_ids.map(frontendId => {
          return sectionIdMap[frontendId] || frontendId;
        });
        
        await pool.query(`
          INSERT INTO role_based_conditional_sections (form_id, condition_name, condition_type, condition_value, section_ids, management_names)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [formId, rbcs.condition_name, rbcs.condition_type || 'role_equals', rbcs.condition_value, mappedSectionIds, rbcs.management_names]);
      }
    }

    res.json({
      ...formResult.rows[0],
      message: 'Form updated successfully'
    });
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get form by unique link (public)
app.get('/api/form/:uniqueLink', async (req, res) => {
  try {
    const { uniqueLink } = req.params;
    console.log('🔍 Fetching form with unique link:', uniqueLink);

    const formResult = await pool.query(`
      SELECT * FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);

    if (formResult.rows.length === 0) {
      console.log('❌ Form not found for link:', uniqueLink);
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.rows[0];
    console.log('✅ Form found:', form.title);

    // Get sections
    const sectionsResult = await pool.query(`
      SELECT * FROM form_sections 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [form.id]);

    // Get questions
    const questionsResult = await pool.query(`
      SELECT * FROM form_questions 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [form.id]);

    // Get conditional questions
    const conditionalResult = await pool.query(`
      SELECT * FROM conditional_questions WHERE form_id = $1
    `, [form.id]);

    // Get conditional sections
    const conditionalSectionsResult = await pool.query(`
      SELECT * FROM conditional_sections WHERE form_id = $1 AND is_active = true
    `, [form.id]);

    // Get role-based conditional sections
    const roleBasedConditionalSectionsResult = await pool.query(`
      SELECT * FROM role_based_conditional_sections WHERE form_id = $1 AND is_active = true
    `, [form.id]);

    console.log(`📋 Found ${sectionsResult.rows.length} sections, ${questionsResult.rows.length} questions, ${conditionalResult.rows.length} conditional rules, ${conditionalSectionsResult.rows.length} conditional sections, and ${roleBasedConditionalSectionsResult.rows.length} role-based conditional sections`);

    res.json({
      ...form,
      sections: sectionsResult.rows,
      questions: questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      })),
      conditional_questions: conditionalResult.rows,
      conditional_sections: conditionalSectionsResult.rows,
      role_based_conditional_sections: roleBasedConditionalSectionsResult.rows
    });
  } catch (error) {
    console.error('❌ Get form error:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Submit form response (public)
app.post('/api/form/:uniqueLink/submit', async (req, res) => {
  try {
    const { uniqueLink } = req.params;
    const { 
      respondent_name, 
      respondent_email, 
      responses, 
      management_evaluation,
      management_responses,
      evaluated_people,
      role_selection 
    } = req.body;

    console.log('📥 Form submission received:', {
      uniqueLink,
      respondent_name,
      respondent_email,
      role_selection,
      management_evaluation,
      responsesType: typeof responses,
      responsesKeys: responses ? Object.keys(responses) : 'null/undefined',
      managementResponsesType: typeof management_responses,
      managementResponsesKeys: management_responses ? Object.keys(management_responses) : 'null/undefined',
      evaluated_people
    });

    // Get form
    const formResult = await pool.query(`
      SELECT id FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const formId = formResult.rows[0].id;

    // Check if user already submitted (name + email combination)
    const existingResponse = await pool.query(`
      SELECT id FROM form_responses 
      WHERE form_id = $1 AND respondent_name = $2 AND respondent_email = $3
    `, [formId, respondent_name, respondent_email]);

    if (existingResponse.rows.length > 0) {
      return res.status(400).json({ 
        error: 'You have already submitted a response for this form. Each person can only submit once.' 
      });
    }

    // Prepare responses for database
    let finalResponses;
    
    if (management_evaluation && management_responses) {
      // For management flow, structure the responses properly
      finalResponses = {
        role_selection: role_selection || 'management',
        management_evaluation: true,
        evaluated_people: evaluated_people || [],
        management_responses: management_responses
      };
    } else {
      // For regular flow, use standard responses
      finalResponses = responses || {};
    }

    // Ensure finalResponses is not null/undefined
    if (!finalResponses || Object.keys(finalResponses).length === 0) {
      finalResponses = { submitted: true }; // Minimum data to avoid null constraint
    }

    console.log('💾 About to insert into database:', {
      formId,
      respondent_name,
      respondent_email,
      finalResponsesType: typeof finalResponses,
      finalResponsesKeys: Object.keys(finalResponses),
      finalResponsesStringified: JSON.stringify(finalResponses)
    });

    // Insert response
    await pool.query(`
      INSERT INTO form_responses (form_id, respondent_name, respondent_email, responses)
      VALUES ($1, $2, $3, $4)
    `, [formId, respondent_name, respondent_email, JSON.stringify(finalResponses)]);

    res.json({ message: 'Response submitted successfully' });
  } catch (error) {
    console.error('Submit response error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get form responses (admin)
app.get('/api/admin/forms/:formId/responses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { formId } = req.params;

    // Get form questions for mapping
    const questionsResult = await pool.query(`
      SELECT * FROM form_questions 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [formId]);
    const questions = questionsResult.rows;

    // Get responses
    const result = await pool.query(`
      SELECT * FROM form_responses 
      WHERE form_id = $1 
      ORDER BY submitted_at DESC
    `, [formId]);

    const responses = result.rows.map(row => ({
      ...row,
      responses: row.responses,
      questions: questions // Include questions for frontend mapping
    }));

    res.json(responses);
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export form responses to Excel (admin)
app.get('/api/admin/forms/:formId/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { formId } = req.params;
    const { role, year } = req.query; // Get filter parameters

    // Get form details
    const formResult = await pool.query('SELECT * FROM forms WHERE id = $1', [formId]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    const form = formResult.rows[0];

    // Get form questions for headers
    const questionsResult = await pool.query(`
      SELECT * FROM form_questions 
      WHERE form_id = $1 
      ORDER BY order_number
    `, [formId]);
    const questions = questionsResult.rows;

    // Get responses with optional filtering
    let responsesQuery = `
      SELECT * FROM form_responses 
      WHERE form_id = $1
    `;
    let queryParams = [formId];
    let paramIndex = 2;

    // Apply filters if provided
    if (role) {
      responsesQuery += ` AND (
        responses->>'selected_role' = $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM jsonb_each_text(responses) 
          WHERE key ILIKE '%role%' AND value = $${paramIndex}
        )
      )`;
      queryParams.push(role);
      paramIndex++;
    }

    if (year) {
      responsesQuery += ` AND (
        responses->>'year_selection' = $${paramIndex} OR
        responses->>'selected_year' = $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM jsonb_each_text(responses) 
          WHERE key ILIKE '%year%' AND value = $${paramIndex}
        )
      )`;
      queryParams.push(year);
      paramIndex++;
    }

    responsesQuery += ` ORDER BY submitted_at ASC`;

    const responsesResult = await pool.query(responsesQuery, queryParams);
    const responses = responsesResult.rows;

    console.log(`📊 Export with filters - Role: ${role || 'All'}, Year: ${year || 'All'}, Found: ${responses.length} responses`);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    let worksheetName = 'Form Responses';
    if (role || year) {
      const filters = [];
      if (role) filters.push(role.charAt(0).toUpperCase() + role.slice(1));
      if (year) filters.push(year);
      worksheetName += ` (${filters.join(', ')})`;
    }
    const worksheet = workbook.addWorksheet(worksheetName);

    // Define headers
    const headers = [
      'Name',
      'Email', 
      'Submitted At',
      ...questions.map(q => q.question_text || `Question ${q.order_number}`)
    ];

    worksheet.addRow(headers);

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Collect all question IDs ever used in responses for comprehensive export
    const allQuestionIds = new Set();
    const specialFields = new Set();
    
    responses.forEach(response => {
      Object.keys(response.responses).forEach(key => {
        if (key === 'year_selection' || key === 'conditional_year' || isNaN(key)) {
          specialFields.add(key);
        } else {
          allQuestionIds.add(key);
        }
      });
    });

    // Create comprehensive question mapping
    const questionMapping = {};
    
    // Add current questions (these have full metadata)
    questions.forEach(q => {
      questionMapping[q.id.toString()] = {
        id: q.id,
        text: q.question_text || `Question ${q.order_number}`,
        order: q.order_number,
        type: 'current'
      };
    });

    // Try to find historical questions that might still exist
    if (allQuestionIds.size > 0) {
      const historicalQuestionIds = Array.from(allQuestionIds).filter(id => !questionMapping[id]);
      if (historicalQuestionIds.length > 0) {
        try {
          const placeholders = historicalQuestionIds.map((_, i) => `$${i + 1}`).join(',');
          const historicalQuery = `
            SELECT id, question_text, order_number, form_id 
            FROM form_questions 
            WHERE id IN (${placeholders})
          `;
          const historicalResult = await pool.query(historicalQuery, historicalQuestionIds.map(id => parseInt(id)));
          
          historicalResult.rows.forEach(q => {
            questionMapping[q.id.toString()] = {
              id: q.id,
              text: q.question_text || `Question ${q.order_number}`,
              order: q.order_number || 999,
              type: q.form_id === parseInt(formId) ? 'historical' : 'other_form'
            };
          });
        } catch (err) {
          console.warn('Could not fetch historical questions:', err.message);
        }
      }
    }

    // Add fallback entries for completely orphaned question IDs
    allQuestionIds.forEach(id => {
      if (!questionMapping[id]) {
        questionMapping[id] = {
          id: parseInt(id),
          text: `Question ID ${id} (Historical)`,
          order: 999,
          type: 'orphaned'
        };
      }
    });

    // Create ordered list of all questions for headers
    const allQuestions = Object.values(questionMapping).sort((a, b) => {
      const typePriority = { current: 1, historical: 2, other_form: 3, orphaned: 4 };
      if (typePriority[a.type] !== typePriority[b.type]) {
        return typePriority[a.type] - typePriority[b.type];
      }
      return a.order - b.order;
    });

    // Update headers to include all questions + special fields
    const allHeaders = [
      'Name',
      'Email', 
      'Submitted At',
      ...allQuestions.map(q => q.text),
      ...Array.from(specialFields).map(field => {
        if (field === 'year_selection') return 'Year Selection';
        if (field === 'conditional_year') return 'Conditional Year';
        return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      })
    ];

    worksheet.getRow(1).values = allHeaders;

    // Add data rows with comprehensive mapping
    responses.forEach(response => {
      const responseData = response.responses;
      const row = [
        response.respondent_name,
        response.respondent_email,
        response.submitted_at.toISOString().split('T')[0],
        // Map all questions in order
        ...allQuestions.map(q => {
          const answer = responseData[q.id.toString()] || '';
          
          // Handle management response structure
          if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
            // Check if this looks like a management response structure
            const entries = Object.entries(answer);
            if (entries.length > 0) {
              const isManagementStructure = entries.some(([key, val]) => 
                typeof key === 'string' && 
                key.includes('_') && 
                typeof val === 'object' && 
                val !== null
              );
              
              if (isManagementStructure) {
                // Format management responses for Excel
                return entries.map(([personSection, answers]) => {
                  const [personName, sectionNum] = personSection.split('_');
                  const sectionNumber = parseInt(sectionNum) + 1;
                  
                  if (typeof answers === 'object' && answers !== null) {
                    const answerEntries = Object.entries(answers);
                    return answerEntries.map(([qId, answerValue]) => {
                      // Find question text for this ID
                      const questionObj = questionMapping[qId];
                      const questionText = questionObj ? questionObj.text : `Question ${qId}`;
                      return `${personName} (Sec ${sectionNumber}): ${questionText} = ${answerValue}`;
                    }).join(' | ');
                  }
                  return `${personName} (Sec ${sectionNumber}): ${JSON.stringify(answers)}`;
                }).join(' || ');
              }
            }
            // Fallback for other objects
            return JSON.stringify(answer);
          }
          
          return Array.isArray(answer) ? answer.join(', ') : (answer || '');
        }),
        // Map special fields
        ...Array.from(specialFields).map(field => {
          const answer = responseData[field] || '';
          
          // Handle management response structure in special fields too
          if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
            const entries = Object.entries(answer);
            if (entries.length > 0) {
              const isManagementStructure = entries.some(([key, val]) => 
                typeof key === 'string' && 
                key.includes('_') && 
                typeof val === 'object' && 
                val !== null
              );
              
              if (isManagementStructure) {
                return entries.map(([personSection, answers]) => {
                  const [personName, sectionNum] = personSection.split('_');
                  const sectionNumber = parseInt(sectionNum) + 1;
                  
                  if (typeof answers === 'object' && answers !== null) {
                    const answerEntries = Object.entries(answers);
                    return answerEntries.map(([qId, answerValue]) => {
                      const questionObj = questionMapping[qId];
                      const questionText = questionObj ? questionObj.text : `Question ${qId}`;
                      return `${personName} (Sec ${sectionNumber}): ${questionText} = ${answerValue}`;
                    }).join(' | ');
                  }
                  return `${personName} (Sec ${sectionNumber}): ${JSON.stringify(answers)}`;
                }).join(' || ');
              }
            }
            return JSON.stringify(answer);
          }
          
          return Array.isArray(answer) ? answer.join(', ') : (answer || '');
        })
      ];
      worksheet.addRow(row);
    });

    console.log(`📊 Excel export: ${responses.length} responses, ${allQuestions.length} total questions (${questions.length} current + ${allQuestions.length - questions.length} historical)`);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 10, 15);
    });

    // Set response headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${form.title.replace(/[^a-zA-Z0-9]/g, '_')}_responses.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete form (admin)
app.delete('/api/admin/forms/:formId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { formId } = req.params;

    await pool.query('DELETE FROM forms WHERE id = $1', [formId]);
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CONDITIONAL LOGIC ROUTE ====================

// Get questions based on conditions
app.post('/api/form/:uniqueLink/conditional-questions', async (req, res) => {
  try {
    const { uniqueLink } = req.params;
    const { selectedYear } = req.body;

    // Get form
    const formResult = await pool.query(`
      SELECT id FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const formId = formResult.rows[0].id;

    // Get conditional questions for this year
    const yearInt = parseInt(selectedYear);
    
    // First get all conditional questions for this form
    const conditionalResult = await pool.query(`
      SELECT * FROM conditional_questions 
      WHERE form_id = $1 AND is_active = true
    `, [formId]);

    // Filter based on conditions in JavaScript to handle JSONB properly
    const matchingConditions = conditionalResult.rows.filter(row => {
      const conditionValue = row.condition_value;
      
      try {
        switch (row.condition_type) {
          case 'year_equals':
            const targetYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt === targetYear;
            
          case 'year_less_equal':
            const maxYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt <= maxYear;
            
          case 'year_greater_equal':
            const minYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt >= minYear;
            
          case 'year_between':
            if (typeof conditionValue === 'string' && conditionValue.includes('-')) {
              const [startYear, endYear] = conditionValue.split('-').map(y => parseInt(y.trim()));
              return yearInt >= startYear && yearInt <= endYear;
            }
            return false;
            
          default:
            return false;
        }
      } catch (error) {
        console.error(`Error processing condition for row ${row.id}:`, error);
        return false;
      }
    });

    // Get all question IDs to show from matching conditions
    let questionIdsToShow = [];
    matchingConditions.forEach(row => {
      questionIdsToShow = [...questionIdsToShow, ...row.question_ids];
    });

    // Remove duplicates
    questionIdsToShow = [...new Set(questionIdsToShow)];

    // Get the actual questions
    if (questionIdsToShow.length > 0) {
      const questionsResult = await pool.query(`
        SELECT * FROM form_questions 
        WHERE form_id = $1 AND id = ANY($2)
        ORDER BY order_number
      `, [formId, questionIdsToShow]);

      const questions = questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      }));

      res.json(questions);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Conditional questions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get conditional sections based on year (public)
app.post('/api/form/:uniqueLink/conditional-sections', async (req, res) => {
  try {
    const { uniqueLink } = req.params;
    const { selectedYear } = req.body;

    // Get form
    const formResult = await pool.query(`
      SELECT id FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const formId = formResult.rows[0].id;

    // Get conditional sections for this year
    const yearInt = parseInt(selectedYear);
    
    // First get all conditional sections for this form
    const conditionalSectionsResult = await pool.query(`
      SELECT * FROM conditional_sections 
      WHERE form_id = $1 AND is_active = true
    `, [formId]);

    // Filter based on conditions in JavaScript to handle JSONB properly
    const matchingConditions = conditionalSectionsResult.rows.filter(row => {
      const conditionValue = row.condition_value;
      
      try {
        switch (row.condition_type) {
          case 'year_equals':
            const targetYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt === targetYear;
            
          case 'year_less_equal':
            const maxYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt <= maxYear;
            
          case 'year_greater_equal':
            const minYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
            return yearInt >= minYear;
            
          case 'year_between':
            if (typeof conditionValue === 'string' && conditionValue.includes('-')) {
              const [startYear, endYear] = conditionValue.split('-').map(y => parseInt(y.trim()));
              return yearInt >= startYear && yearInt <= endYear;
            }
            return false;
            
          default:
            return false;
        }
      } catch (error) {
        console.error(`Error processing section condition for row ${row.id}:`, error);
        return false;
      }
    });

    // Get all section IDs to show from matching conditions
    let sectionIdsToShow = [];
    matchingConditions.forEach(row => {
      sectionIdsToShow = [...sectionIdsToShow, ...row.section_ids];
    });

    // Remove duplicates
    sectionIdsToShow = [...new Set(sectionIdsToShow)];

    // Get the actual sections and their questions
    if (sectionIdsToShow.length > 0) {
      const sectionsResult = await pool.query(`
        SELECT * FROM form_sections 
        WHERE form_id = $1 AND id = ANY($2)
        ORDER BY order_number
      `, [formId, sectionIdsToShow]);

      // Get all questions for these sections
      const questionsResult = await pool.query(`
        SELECT * FROM form_questions 
        WHERE form_id = $1 AND section_id = ANY($2)
        ORDER BY order_number
      `, [formId, sectionIdsToShow]);

      const questions = questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      }));

      res.json({
        sections: sectionsResult.rows,
        questions: questions
      });
    } else {
      res.json({
        sections: [],
        questions: []
      });
    }
  } catch (error) {
    console.error('Conditional sections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get role-based sections (public)
app.post('/api/form/:uniqueLink/role-based-sections', async (req, res) => {
  try {
    const { uniqueLink } = req.params;
    const { selectedRole } = req.body;

    // Get form
    const formResult = await pool.query(`
      SELECT id FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const formId = formResult.rows[0].id;

    // Get role-based conditional sections for this role
    const roleBasedSectionsResult = await pool.query(`
      SELECT * FROM role_based_conditional_sections 
      WHERE form_id = $1 AND is_active = true AND condition_value = $2
    `, [formId, selectedRole]);

    // Get all section IDs to show from matching conditions
    let sectionIdsToShow = [];
    roleBasedSectionsResult.rows.forEach(row => {
      sectionIdsToShow = [...sectionIdsToShow, ...row.section_ids];
    });

    // Remove duplicates
    sectionIdsToShow = [...new Set(sectionIdsToShow)];

    // Get the actual sections and their questions
    if (sectionIdsToShow.length > 0) {
      const sectionsResult = await pool.query(`
        SELECT * FROM form_sections 
        WHERE form_id = $1 AND id = ANY($2)
        ORDER BY order_number
      `, [formId, sectionIdsToShow]);

      // Get all questions for these sections
      const questionsResult = await pool.query(`
        SELECT * FROM form_questions 
        WHERE form_id = $1 AND section_id = ANY($2)
        ORDER BY order_number
      `, [formId, sectionIdsToShow]);

      const questions = questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      }));

      // For management role, include management configuration
      let managementConfig = null;
      if (selectedRole === 'management' && roleBasedSectionsResult.rows.length > 0) {
        managementConfig = roleBasedSectionsResult.rows.find(row => row.condition_value === 'management');
      }

      res.json({
        sections: sectionsResult.rows,
        questions: questions,
        managementConfig: managementConfig
      });
    } else {
      res.json({
        sections: [],
        questions: [],
        managementConfig: null
      });
    }
  } catch (error) {
    console.error('Role-based sections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get combined conditional sections (year + role) (public)
app.post('/api/form/:uniqueLink/combined-conditional-sections', async (req, res) => {
  try {
    const { uniqueLink } = req.params;
    const { selectedYear, selectedRole } = req.body;

    // Get form
    const formResult = await pool.query(`
      SELECT id FROM forms WHERE unique_link = $1 AND is_active = true
    `, [uniqueLink]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const formId = formResult.rows[0].id;

    // Step 1: Get year-based conditional sections
    let yearBasedSectionIds = [];
    
    if (selectedYear) {
      const yearInt = parseInt(selectedYear);
      
      // Get year-based conditional sections
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
              
            case 'year_greater_equal':
              const minYear = typeof conditionValue === 'string' ? parseInt(conditionValue) : conditionValue;
              return yearInt >= minYear;
              
            case 'year_between':
              if (typeof conditionValue === 'string' && conditionValue.includes('-')) {
                const [startYear, endYear] = conditionValue.split('-').map(y => parseInt(y.trim()));
                return yearInt >= startYear && yearInt <= endYear;
              }
              return false;
              
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
    }

    // Step 2: Get role-based conditional sections
    let roleBasedSectionIds = [];
    
    if (selectedRole) {
      const roleBasedSectionsResult = await pool.query(`
        SELECT * FROM role_based_conditional_sections 
        WHERE form_id = $1 AND is_active = true AND condition_value = $2
      `, [formId, selectedRole]);

      // Collect role-based section IDs
      roleBasedSectionsResult.rows.forEach(row => {
        roleBasedSectionIds = [...roleBasedSectionIds, ...row.section_ids];
      });
      roleBasedSectionIds = [...new Set(roleBasedSectionIds)];
    }

    // Step 3: Determine final section IDs to show
    let finalSectionIds = [];
    
    // If both year and role conditions exist, show union (all sections from both conditions)
    if (yearBasedSectionIds.length > 0 && roleBasedSectionIds.length > 0) {
      finalSectionIds = [...new Set([...yearBasedSectionIds, ...roleBasedSectionIds])];
    }
    // If only year conditions exist, show year-based sections
    else if (yearBasedSectionIds.length > 0) {
      finalSectionIds = yearBasedSectionIds;
    }
    // If only role conditions exist, show role-based sections
    else if (roleBasedSectionIds.length > 0) {
      finalSectionIds = roleBasedSectionIds;
    }
    // If neither exist, show all sections (or could be empty based on business logic)
    else {
      // Get all sections for this form
      const allSectionsResult = await pool.query(`
        SELECT id FROM form_sections WHERE form_id = $1 ORDER BY order_number
      `, [formId]);
      finalSectionIds = allSectionsResult.rows.map(row => row.id);
    }

    // Step 4: Get the actual sections and questions
    if (finalSectionIds.length > 0) {
      const sectionsResult = await pool.query(`
        SELECT * FROM form_sections 
        WHERE form_id = $1 AND id = ANY($2)
        ORDER BY order_number
      `, [formId, finalSectionIds]);

      const questionsResult = await pool.query(`
        SELECT * FROM form_questions 
        WHERE form_id = $1 AND section_id = ANY($2)
        ORDER BY order_number
      `, [formId, finalSectionIds]);

      const questions = questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      }));

      res.json({
        sections: sectionsResult.rows,
        questions: questions,
        debug: {
          yearBasedSectionIds,
          roleBasedSectionIds,
          finalSectionIds,
          selectedYear,
          selectedRole
        }
      });
    } else {
      res.json({
        sections: [],
        questions: [],
        debug: {
          yearBasedSectionIds,
          roleBasedSectionIds,
          finalSectionIds,
          selectedYear,
          selectedRole
        }
      });
    }
  } catch (error) {
    console.error('Combined conditional sections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SUPERADMIN ROUTES ====================

// Get scale order for a specific question (superadmin)
app.get('/api/superadmin/forms/:formId/questions/:questionId/scale-order', 
  authenticateToken, 
  requireSuperAdmin, 
  async (req, res) => {
    try {
      const { formId, questionId } = req.params;
      
      const result = await pool.query(
        'SELECT scale_order FROM form_questions WHERE form_id = $1 AND id = $2 AND question_type = $3',
        [formId, questionId, 'assessment']
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Assessment question not found' });
      }
      
      const scaleOrder = result.rows[0].scale_order || [1, 2, 3, 4, 5];
      res.json({ scaleOrder });
      
    } catch (error) {
      console.error('Get scale order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Update scale order for a specific question (superadmin)
app.put('/api/superadmin/forms/:formId/questions/:questionId/scale-order', 
  authenticateToken, 
  requireSuperAdmin, 
  async (req, res) => {
    try {
      const { formId, questionId } = req.params;
      const { scaleOrder } = req.body;
      
      // Validate scale order
      if (!Array.isArray(scaleOrder) || scaleOrder.length !== 5) {
        return res.status(400).json({ error: 'Scale order must be an array of 5 numbers' });
      }
      
      const validNumbers = [1, 2, 3, 4, 5];
      const isValidOrder = scaleOrder.every(num => validNumbers.includes(num)) &&
                          new Set(scaleOrder).size === 5;
                          
      if (!isValidOrder) {
        return res.status(400).json({ error: 'Scale order must contain each number 1-5 exactly once' });
      }
      
      // Check if question exists and is assessment type
      const checkResult = await pool.query(
        'SELECT id FROM form_questions WHERE form_id = $1 AND id = $2 AND question_type = $3',
        [formId, questionId, 'assessment']
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Assessment question not found' });
      }
      
      // Update scale order
      await pool.query(
        'UPDATE form_questions SET scale_order = $1 WHERE form_id = $2 AND id = $3',
        [JSON.stringify(scaleOrder), formId, questionId]
      );
      
      res.json({ message: 'Scale order updated successfully', scaleOrder });
      
    } catch (error) {
      console.error('Update scale order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get all assessment questions for a form with their scale orders (superadmin)
app.get('/api/superadmin/forms/:formId/assessment-questions', 
  authenticateToken, 
  requireSuperAdmin, 
  async (req, res) => {
    try {
      const { formId } = req.params;
      console.log(`🔧 Superadmin requesting assessment questions for form ${formId} by user:`, req.user);
      
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
      
      console.log(`📋 Found ${result.rows.length} assessment questions for form ${formId}`);
      
      const questions = result.rows.map(row => ({
        id: row.id,
        questionTextEn: row.question_text,
        questionTextAr: row.question_text_id || '', // Using text_id as placeholder for Arabic
        scaleOrder: row.scale_order || [1, 2, 3, 4, 5],
        questionOrder: row.order_number
      }));
      
      console.log(`✅ Returning ${questions.length} transformed questions`);
      res.json({ questions });
      
    } catch (error) {
      console.error('Get assessment questions error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    console.log('🚀 Starting Form System Backend...');
    
    // Test database connection
    await testConnection();
    
    // Initialize database (check and create tables if needed)
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log('');
      console.log('🎉 =====================================');
      console.log('🚀 Form System Backend Started!');
      console.log(`� Server running on: http://localhost:${PORT}`);
      console.log(`🌐 Frontend should be on: http://localhost:3000`);
      console.log(`� Admin login: http://localhost:3000/admin`);
      console.log(`   Username: admin`);
      console.log(`   Password: admin123`);
      console.log('🎉 =====================================');
      console.log('');
    });
  } catch (error) {
    console.error('');
    console.error('💥 =====================================');
    console.error('❌ Failed to start server:');
    console.error('💥 =====================================');
    console.error(error.message);
    console.error('');
    console.log('🔧 Troubleshooting tips:');
    console.log('   1. Check if PostgreSQL is running');
    console.log('   2. Verify database connection settings in .env');
    console.log('   3. Ensure database "form" exists');
    console.log('   4. Check network connectivity');
    console.error('');
    process.exit(1);
  }
};

startServer();