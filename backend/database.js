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

// Check and create database schema if needed (preserve existing data)
const initializeDatabase = async () => {
  try {
    console.log('🔄 Checking database schema...');
    
    // Check if main tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'forms', 'form_questions', 'form_responses')
    `);
    
    const existingTables = tablesCheck.rows.map(row => row.table_name);
    const hasCoreTables = existingTables.length >= 4;
    
    if (hasCoreTables) {
      console.log('✅ Database schema already exists, using existing tables');
      console.log(`📋 Found ${existingTables.length} core tables: ${existingTables.join(', ')}`);
      
      // Check if we need to add any missing columns or tables for enhanced schema
      await ensureSchemaUpdates();
      
      // Ensure default admin exists
      await ensureDefaultAdmin();
      
      return;
    }
    
    console.log('📋 Creating new database schema...');

    // CORE USER MANAGEMENT
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'super_admin')),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        ip_address INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // FORM CATEGORIES
    await pool.query(`
      CREATE TABLE form_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(7),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ENHANCED FORMS
    await pool.query(`
      CREATE TABLE forms (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        form_type VARCHAR(20) NOT NULL CHECK (form_type IN ('standard', 'assessment', 'survey', 'quiz', 'evaluation')),
        category_id INTEGER REFERENCES form_categories(id),
        created_by INTEGER REFERENCES users(id),
        unique_link VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_public BOOLEAN DEFAULT true,
        requires_login BOOLEAN DEFAULT false,
        max_submissions INTEGER DEFAULT NULL,
        submission_deadline TIMESTAMP DEFAULT NULL,
        thank_you_message TEXT,
        redirect_url TEXT,
        allow_multiple_submissions BOOLEAN DEFAULT false,
        collect_email BOOLEAN DEFAULT true,
        collect_ip BOOLEAN DEFAULT false,
        notification_emails TEXT[],
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP DEFAULT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE form_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        form_data JSONB NOT NULL,
        category_id INTEGER REFERENCES form_categories(id),
        created_by INTEGER REFERENCES users(id),
        is_public BOOLEAN DEFAULT false,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // QUESTION MANAGEMENT
    await pool.query(`
      CREATE TABLE question_types (
        id SERIAL PRIMARY KEY,
        type_name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        has_options BOOLEAN DEFAULT false,
        supports_validation BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true
      )
    `);

    await pool.query(`
      CREATE TABLE form_questions (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_text_id TEXT,
        help_text TEXT,
        help_text_id TEXT,
        question_type VARCHAR(50) REFERENCES question_types(type_name),
        options JSONB,
        validation_rules JSONB,
        left_statement TEXT,
        right_statement TEXT,
        left_statement_id TEXT,
        right_statement_id TEXT,
        is_required BOOLEAN DEFAULT false,
        order_number INTEGER NOT NULL,
        page_number INTEGER DEFAULT 1,
        depends_on_question INTEGER REFERENCES form_questions(id),
        depends_on_value JSONB,
        randomize_options BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE question_logic (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        source_question_id INTEGER REFERENCES form_questions(id) ON DELETE CASCADE,
        target_question_id INTEGER REFERENCES form_questions(id) ON DELETE CASCADE,
        condition_type VARCHAR(50) NOT NULL,
        condition_value JSONB NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE conditional_questions (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        condition_name VARCHAR(100),
        condition_type VARCHAR(50) NOT NULL,
        condition_value JSONB NOT NULL,
        question_ids INTEGER[] NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // RESPONSE MANAGEMENT
    await pool.query(`
      CREATE TABLE form_responses (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        respondent_name VARCHAR(255),
        respondent_email VARCHAR(255),
        user_id INTEGER REFERENCES users(id) DEFAULT NULL,
        responses JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        submission_source VARCHAR(50) DEFAULT 'web',
        completion_time INTEGER,
        is_complete BOOLEAN DEFAULT true,
        is_test BOOLEAN DEFAULT false,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(form_id, respondent_name, respondent_email)
      )
    `);

    await pool.query(`
      CREATE TABLE question_responses (
        id SERIAL PRIMARY KEY,
        form_response_id INTEGER REFERENCES form_responses(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES form_questions(id) ON DELETE CASCADE,
        response_value JSONB NOT NULL,
        response_text TEXT,
        response_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ANALYTICS & MONITORING
    await pool.query(`
      CREATE TABLE form_analytics (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL(15,4),
        metric_data JSONB,
        recorded_date DATE DEFAULT CURRENT_DATE,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(form_id, metric_name, recorded_date)
      )
    `);

    await pool.query(`
      CREATE TABLE activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INTEGER,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value JSONB NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // FILE MANAGEMENT
    await pool.query(`
      CREATE TABLE file_uploads (
        id SERIAL PRIMARY KEY,
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100),
        uploaded_by INTEGER REFERENCES users(id),
        form_id INTEGER REFERENCES forms(id) DEFAULT NULL,
        response_id INTEGER REFERENCES form_responses(id) DEFAULT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NOTIFICATIONS
    await pool.query(`
      CREATE TABLE email_templates (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(100) UNIQUE NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT,
        variables JSONB,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT,
        body_text TEXT,
        template_id INTEGER REFERENCES email_templates(id),
        template_data JSONB,
        priority INTEGER DEFAULT 5,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // API & INTEGRATIONS
    await pool.query(`
      CREATE TABLE api_keys (
        id SERIAL PRIMARY KEY,
        key_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        secret_hash VARCHAR(255),
        user_id INTEGER REFERENCES users(id),
        permissions JSONB DEFAULT '[]',
        rate_limit INTEGER DEFAULT 1000,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP DEFAULT NULL,
        last_used_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE webhooks (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        events TEXT[] NOT NULL,
        secret VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        retry_count INTEGER DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE webhook_deliveries (
        id SERIAL PRIMARY KEY,
        webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        attempts INTEGER DEFAULT 0,
        delivered_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Enhanced database schema created successfully');

    // Create performance indexes
    console.log('📊 Creating database indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_forms_unique_link ON forms(unique_link)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_questions_form_id ON form_questions(form_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_responses_form_id ON form_responses(form_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_responses_email ON form_responses(respondent_email)');

    console.log('✅ Database indexes created successfully');

    // Insert sample data
    console.log('📋 Inserting default data...');

    // Default question types
    await pool.query(`
      INSERT INTO question_types (type_name, display_name, description, has_options, supports_validation) VALUES
      ('text', 'Short Text', 'Single line text input', false, true),
      ('textarea', 'Long Text', 'Multi-line text area', false, true),
      ('email', 'Email', 'Email address input with validation', false, true),
      ('number', 'Number', 'Numeric input', false, true),
      ('select', 'Dropdown', 'Single selection dropdown', true, true),
      ('radio', 'Multiple Choice', 'Single selection from options', true, true),
      ('checkbox', 'Checkboxes', 'Multiple selection from options', true, true),
      ('assessment', 'Assessment Scale', '5-point Likert scale for assessments', true, true),
      ('file', 'File Upload', 'File attachment upload', false, false),
      ('date', 'Date', 'Date picker input', false, true),
      ('time', 'Time', 'Time picker input', false, true),
      ('url', 'Website URL', 'URL input with validation', false, true),
      ('rating', 'Star Rating', 'Star-based rating system', true, true)
      ON CONFLICT (type_name) DO NOTHING
    `);

    // Default form categories
    await pool.query(`
      INSERT INTO form_categories (name, description, icon, color) VALUES
      ('Survey', 'General surveys and questionnaires', 'survey', '#007bff'),
      ('Assessment', 'Skill and performance assessments', 'assessment', '#28a745'),
      ('Feedback', 'Customer and employee feedback forms', 'feedback', '#ffc107'),
      ('Registration', 'Event and service registration forms', 'registration', '#dc3545'),
      ('Contact', 'Contact and inquiry forms', 'contact', '#6f42c1'),
      ('Quiz', 'Knowledge and skill quizzes', 'quiz', '#fd7e14'),
      ('Evaluation', 'Performance and program evaluations', 'evaluation', '#20c997')
      ON CONFLICT (name) DO NOTHING
    `);

    // System configuration
    await pool.query(`
      INSERT INTO system_config (config_key, config_value, description, is_public) VALUES
      ('app_name', '"Multi-User Form System"', 'Application name', true),
      ('app_version', '"1.0.0"', 'Application version', true),
      ('max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)', false),
      ('allowed_file_types', '["pdf", "doc", "docx", "jpg", "jpeg", "png", "gif"]', 'Allowed file extensions', true),
      ('rate_limit_per_hour', '100', 'API rate limit per hour', false),
      ('session_timeout_minutes', '1440', 'User session timeout in minutes (24 hours)', false)
      ON CONFLICT (config_key) DO NOTHING
    `);

    console.log('✅ Default data inserted successfully');

    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES ('admin', 'admin@example.com', $1, 'admin', 'System', 'Administrator')
      ON CONFLICT (username) DO NOTHING
    `, [adminPassword]);

    // Create superadmin user
    const superAdminPassword = await bcrypt.hash('superadmin123', 10);
    await pool.query(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES ('superadmin', 'superadmin@example.com', $1, 'super_admin', 'Super', 'Administrator')
      ON CONFLICT (username) DO NOTHING
    `, [superAdminPassword]);

    console.log('✅ Default admin user created (username: admin, password: admin123)');
    console.log('✅ Default superadmin user created (username: superadmin, password: superadmin123)');

    // Add scale_order column to form_questions if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE form_questions 
        ADD COLUMN IF NOT EXISTS scale_order JSONB DEFAULT '[1,2,3,4,5]'
      `);
      console.log('✅ Added scale_order column to form_questions table');
    } catch (err) {
      console.log('ℹ️  scale_order column already exists or error:', err.message);
    }

  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    throw err;
  }
};

// Helper function to ensure schema updates for existing databases
const ensureSchemaUpdates = async () => {
  try {
    console.log('🔄 Checking for schema updates...');
    
    // Check if enhanced tables exist, if not create them
    const enhancedTables = [
      'form_categories', 'question_types', 'form_templates', 
      'question_logic', 'question_responses', 'form_analytics',
      'activity_logs', 'system_config', 'file_uploads',
      'email_templates', 'notifications', 'api_keys',
      'webhooks', 'webhook_deliveries', 'user_sessions'
    ];
    
    for (const tableName of enhancedTables) {
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      if (!tableExists.rows[0].exists) {
        console.log(`📋 Creating missing table: ${tableName}`);
        await createEnhancedTable(tableName);
      }
    }
    
    // Ensure default data exists
    await ensureDefaultData();
    
    // Add scale_order column to form_questions if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE form_questions 
        ADD COLUMN IF NOT EXISTS scale_order JSONB DEFAULT '[1,2,3,4,5]'
      `);
      console.log('✅ Added scale_order column to form_questions table');
    } catch (err) {
      console.log('ℹ️  scale_order column already exists or error:', err.message);
    }

    // Add sections table for organizing questions into sections
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS form_sections (
          id SERIAL PRIMARY KEY,
          form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
          section_name VARCHAR(255) NOT NULL,
          section_description TEXT,
          order_number INTEGER NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created form_sections table');
    } catch (err) {
      console.log('ℹ️  form_sections table already exists or error:', err.message);
    }

    // Add section_id column to form_questions if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE form_questions 
        ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES form_sections(id) ON DELETE SET NULL
      `);
      console.log('✅ Added section_id column to form_questions table');
    } catch (err) {
      console.log('ℹ️  section_id column already exists or error:', err.message);
    }

    // Add conditional_sections table for section-based conditional logic
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS conditional_sections (
          id SERIAL PRIMARY KEY,
          form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
          condition_name VARCHAR(100),
          condition_type VARCHAR(50) NOT NULL,
          condition_value JSONB NOT NULL,
          section_ids INTEGER[] NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created conditional_sections table');
    } catch (err) {
      console.log('ℹ️  conditional_sections table already exists or error:', err.message);
    }

    // Add role_based_conditional_sections table for role-based conditional logic
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS role_based_conditional_sections (
          id SERIAL PRIMARY KEY,
          form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
          condition_name VARCHAR(100),
          condition_type VARCHAR(50) NOT NULL,
          condition_value VARCHAR(100) NOT NULL,
          section_ids INTEGER[] NOT NULL,
          management_names TEXT, -- For storing list of names when condition_value is 'management'
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created role_based_conditional_sections table');
    } catch (err) {
      console.log('ℹ️  role_based_conditional_sections table already exists or error:', err.message);
    }
    
    // Add management_names column if it doesn't exist (for existing tables)
    try {
      await pool.query(`
        ALTER TABLE role_based_conditional_sections 
        ADD COLUMN IF NOT EXISTS management_names TEXT
      `);
      console.log('✅ Added management_names column to role_based_conditional_sections');
    } catch (err) {
      console.log('ℹ️  management_names column already exists or error:', err.message);
    }
    
    console.log('✅ Schema updates completed');
    
  } catch (err) {
    console.log('⚠️  Schema update warning:', err.message);
    // Don't throw error, just log warning
  }
};

// Helper function to create specific enhanced tables
const createEnhancedTable = async (tableName) => {
  const tableDefinitions = {
    'form_categories': `
      CREATE TABLE form_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(7),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    'question_types': `
      CREATE TABLE question_types (
        id SERIAL PRIMARY KEY,
        type_name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        has_options BOOLEAN DEFAULT false,
        supports_validation BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true
      )
    `,
    'system_config': `
      CREATE TABLE system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value JSONB NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    // Add more table definitions as needed
  };
  
  if (tableDefinitions[tableName]) {
    await pool.query(tableDefinitions[tableName]);
  }
};

// Helper function to ensure default admin user exists
const ensureDefaultAdmin = async () => {
  try {
    // Check if admin user exists
    const adminCheck = await pool.query(`
      SELECT id FROM users WHERE username = 'admin' AND role = 'admin'
    `);
    
    if (adminCheck.rows.length === 0) {
      console.log('👤 Creating default admin user...');
      const adminPassword = await bcrypt.hash('admin123', 10);
      await pool.query(`
        INSERT INTO users (username, email, password_hash, role, first_name, last_name)
        VALUES ('admin', 'admin@example.com', $1, 'admin', 'System', 'Administrator')
        ON CONFLICT (username) DO NOTHING
      `, [adminPassword]);
      
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    } else {
      console.log('👤 Admin user already exists');
    }
    
    // Check if superadmin user exists (separate check)
    const superAdminCheck = await pool.query(`
      SELECT id FROM users WHERE username = 'superadmin' AND role = 'super_admin'
    `);
    
    if (superAdminCheck.rows.length === 0) {
      console.log('👤 Creating default superadmin user...');
      const superAdminPassword = await bcrypt.hash('superadmin123', 10);
      await pool.query(`
        INSERT INTO users (username, email, password_hash, role, first_name, last_name)
        VALUES ('superadmin', 'superadmin@example.com', $1, 'super_admin', 'Super', 'Administrator')
        ON CONFLICT (username) DO NOTHING
      `, [superAdminPassword]);
      
      console.log('✅ Default superadmin user created (username: superadmin, password: superadmin123)');
    } else {
      console.log('👤 Superadmin user already exists');
    }
  } catch (err) {
    console.log('⚠️  Admin user check warning:', err.message);
  }
};

// Helper function to ensure default data exists
const ensureDefaultData = async () => {
  try {
    // Insert default question types if they don't exist
    await pool.query(`
      INSERT INTO question_types (type_name, display_name, description, has_options, supports_validation) VALUES
      ('text', 'Short Text', 'Single line text input', false, true),
      ('textarea', 'Long Text', 'Multi-line text area', false, true),
      ('email', 'Email', 'Email address input with validation', false, true),
      ('number', 'Number', 'Numeric input', false, true),
      ('select', 'Dropdown', 'Single selection dropdown', true, true),
      ('radio', 'Multiple Choice', 'Single selection from options', true, true),
      ('checkbox', 'Checkboxes', 'Multiple selection from options', true, true),
      ('assessment', 'Assessment Scale', '5-point Likert scale for assessments', true, true)
      ON CONFLICT (type_name) DO NOTHING
    `);
    
    // Insert default form categories if they don't exist  
    await pool.query(`
      INSERT INTO form_categories (name, description, icon, color) VALUES
      ('Survey', 'General surveys and questionnaires', 'survey', '#007bff'),
      ('Assessment', 'Skill and performance assessments', 'assessment', '#28a745'),
      ('Feedback', 'Customer and employee feedback forms', 'feedback', '#ffc107')
      ON CONFLICT (name) DO NOTHING
    `);
    
  } catch (err) {
    console.log('⚠️  Default data warning:', err.message);
  }
};

module.exports = {
  pool,
  testConnection,
  initializeDatabase
};