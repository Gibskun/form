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
    const { title, description, form_type, questions, conditionalQuestions } = req.body;
    const unique_link = uuidv4();

    // Insert form
    const formResult = await pool.query(`
      INSERT INTO forms (title, description, form_type, created_by, unique_link)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [title, description, form_type, req.user.id, unique_link]);

    const formId = formResult.rows[0].id;

    // Insert questions and create ID mapping
    const questionIdMap = {}; // Maps frontend ID to database ID
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionResult = await pool.query(`
          INSERT INTO form_questions 
          (form_id, question_text, question_text_id, question_type, options, 
           left_statement, right_statement, left_statement_id, right_statement_id, 
           is_required, order_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          formId, q.question_text, q.question_text_id, q.question_type,
          q.options ? JSON.stringify(q.options) : null,
          q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
          q.is_required, i + 1
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

    res.json({
      ...form,
      questions: questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      })),
      conditional_questions: conditionalResult.rows
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
    const { title, description, form_type, questions, conditionalQuestions } = req.body;

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

    // Delete conditional questions (we'll recreate these)
    await pool.query('DELETE FROM conditional_questions WHERE form_id = $1', [formId]);

    // Process updated questions - preserve existing IDs when possible
    const questionIdMap = {}; // Maps frontend ID to database ID
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const orderNumber = i + 1;
        const existingQuestion = existingQuestionsMap[orderNumber];

        let questionResult;
        
        if (existingQuestion) {
          // Update existing question to preserve its ID
          console.log(`📝 Updating existing question ID ${existingQuestion.id} at position ${orderNumber}`);
          
          // Preserve existing scale_order if this is an assessment question
          let scaleOrder = null;
          if (q.question_type === 'assessment') {
            scaleOrder = existingQuestion.scale_order || [1, 2, 3, 4, 5];
          }
          
          questionResult = await pool.query(`
            UPDATE form_questions 
            SET question_text = $1, question_text_id = $2, question_type = $3, options = $4,
                left_statement = $5, right_statement = $6, left_statement_id = $7, right_statement_id = $8,
                is_required = $9, order_number = $10, scale_order = $11, updated_at = CURRENT_TIMESTAMP
            WHERE id = $12 AND form_id = $13
            RETURNING id
          `, [
            q.question_text, q.question_text_id, q.question_type,
            q.options ? JSON.stringify(q.options) : null,
            q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
            q.is_required, orderNumber, scaleOrder ? JSON.stringify(scaleOrder) : null,
            existingQuestion.id, formId
          ]);
          
          // Map frontend ID to existing database ID (preserved)
          if (q.id) {
            questionIdMap[q.id] = existingQuestion.id;
          }
        } else {
          // Create new question (only for truly new questions)
          console.log(`🆕 Creating new question at position ${orderNumber}`);
          
          let scaleOrder = null;
          if (q.question_type === 'assessment') {
            scaleOrder = [1, 2, 3, 4, 5];
          }
          
          questionResult = await pool.query(`
            INSERT INTO form_questions 
            (form_id, question_text, question_text_id, question_type, options, 
             left_statement, right_statement, left_statement_id, right_statement_id, 
             is_required, order_number, scale_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `, [
            formId, q.question_text, q.question_text_id, q.question_type,
            q.options ? JSON.stringify(q.options) : null,
            q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
            q.is_required, orderNumber, scaleOrder ? JSON.stringify(scaleOrder) : null
          ]);
          
          // Map frontend ID to new database ID
          if (q.id) {
            questionIdMap[q.id] = questionResult.rows[0].id;
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

    console.log(`📋 Found ${questionsResult.rows.length} questions and ${conditionalResult.rows.length} conditional rules`);

    res.json({
      ...form,
      questions: questionsResult.rows.map(q => ({
        ...q,
        options: q.options || null
      })),
      conditional_questions: conditionalResult.rows
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
    const { respondent_name, respondent_email, responses } = req.body;

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

    // Insert response
    await pool.query(`
      INSERT INTO form_responses (form_id, respondent_name, respondent_email, responses)
      VALUES ($1, $2, $3, $4)
    `, [formId, respondent_name, respondent_email, JSON.stringify(responses)]);

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

    // Get responses
    const responsesResult = await pool.query(`
      SELECT * FROM form_responses 
      WHERE form_id = $1 
      ORDER BY submitted_at ASC
    `, [formId]);
    const responses = responsesResult.rows;

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Form Responses');

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
          return Array.isArray(answer) ? answer.join(', ') : (answer || '');
        }),
        // Map special fields
        ...Array.from(specialFields).map(field => {
          const answer = responseData[field] || '';
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