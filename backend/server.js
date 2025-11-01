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
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== AUTH ROUTES ====================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND role = $2',
      [username, 'admin']
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

    // Insert questions
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await pool.query(`
          INSERT INTO form_questions 
          (form_id, question_text, question_text_id, question_type, options, 
           left_statement, right_statement, left_statement_id, right_statement_id, 
           is_required, order_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          formId, q.question_text, q.question_text_id, q.question_type,
          q.options ? JSON.stringify(q.options) : null,
          q.left_statement, q.right_statement, q.left_statement_id, q.right_statement_id,
          q.is_required, i + 1
        ]);
      }
    }

    // Insert conditional questions
    if (conditionalQuestions && conditionalQuestions.length > 0) {
      for (const cq of conditionalQuestions) {
        await pool.query(`
          INSERT INTO conditional_questions (form_id, condition_type, condition_value, question_ids)
          VALUES ($1, $2, $3, $4)
        `, [formId, cq.condition_type, cq.condition_value, cq.question_ids]);
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

    const result = await pool.query(`
      SELECT * FROM form_responses 
      WHERE form_id = $1 
      ORDER BY submitted_at DESC
    `, [formId]);

    const responses = result.rows.map(row => ({
      ...row,
      responses: row.responses
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

    // Add data rows
    responses.forEach(response => {
      const responseData = response.responses;
      const row = [
        response.respondent_name,
        response.respondent_email,
        response.submitted_at.toISOString().split('T')[0],
        ...questions.map(q => {
          const answer = responseData[q.id] || responseData[`question_${q.id}`] || '';
          return Array.isArray(answer) ? answer.join(', ') : answer;
        })
      ];
      worksheet.addRow(row);
    });

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
    const conditionalResult = await pool.query(`
      SELECT * FROM conditional_questions 
      WHERE form_id = $1 AND (
        (condition_type = 'year_equals' AND condition_value = $2) OR
        (condition_type = 'year_less_equal' AND $3 <= CAST(condition_value AS INTEGER))
      )
    `, [formId, selectedYear, parseInt(selectedYear)]);

    // Get all question IDs to show
    let questionIdsToShow = [];
    conditionalResult.rows.forEach(row => {
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

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    console.log('🚀 Starting Form System Backend...');
    
    // Test database connection
    await testConnection();
    
    // Initialize database (drop and recreate tables)
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