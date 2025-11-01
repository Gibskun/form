const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '31.97.111.215',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'form',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Test database connection
const testConnection = async () => {
  try {
    console.log('🔄 Testing database connection...');
    console.log(`📍 Connecting to: ${process.env.DB_HOST || '31.97.111.215'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'form'}`);
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('🔧 Please check:');
    console.error('   - Database server is running');
    console.error('   - Host/port/credentials are correct');
    console.error('   - Database "form" exists');
    console.error('   - Network connectivity to database server');
    throw err; // Don't exit, let caller handle
  }
};

// Drop all tables if they exist and recreate schema
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');
    
    // Drop tables in order (considering foreign key constraints)
    await pool.query('DROP TABLE IF EXISTS form_responses CASCADE');
    await pool.query('DROP TABLE IF EXISTS conditional_questions CASCADE');
    await pool.query('DROP TABLE IF EXISTS form_questions CASCADE');
    await pool.query('DROP TABLE IF EXISTS forms CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('🗑️  All existing tables dropped');

    // Create users table (admin and regular users)
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create forms table
    await pool.query(`
      CREATE TABLE forms (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        form_type VARCHAR(20) NOT NULL CHECK (form_type IN ('standard', 'assessment')),
        created_by INTEGER REFERENCES users(id),
        unique_link VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create form_questions table
    await pool.query(`
      CREATE TABLE form_questions (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_text_id TEXT, -- For bilingual support
        question_type VARCHAR(50) NOT NULL,
        options JSONB, -- For dropdown, radio, checkbox options
        left_statement TEXT, -- For assessment forms
        right_statement TEXT, -- For assessment forms
        left_statement_id TEXT, -- For bilingual support
        right_statement_id TEXT, -- For bilingual support
        is_required BOOLEAN DEFAULT false,
        order_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conditional_questions table for year-based logic
    await pool.query(`
      CREATE TABLE conditional_questions (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        condition_type VARCHAR(50) NOT NULL, -- 'year_equals', 'year_less_equal', etc.
        condition_value VARCHAR(100) NOT NULL, -- The year value
        question_ids INTEGER[] NOT NULL, -- Array of question IDs to show
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create form_responses table
    await pool.query(`
      CREATE TABLE form_responses (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        respondent_name VARCHAR(255) NOT NULL,
        respondent_email VARCHAR(255) NOT NULL,
        responses JSONB NOT NULL, -- Store all answers as JSON
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(form_id, respondent_name, respondent_email) -- Prevent duplicate submissions
      )
    `);

    console.log('✅ Database schema created successfully');

    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('admin', 'admin@example.com', $1, 'admin')
      ON CONFLICT (username) DO NOTHING
    `, [adminPassword]);

    console.log('✅ Default admin user created (username: admin, password: admin123)');

  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    throw err;
  }
};

module.exports = {
  pool,
  testConnection,
  initializeDatabase
};