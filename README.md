# Multi-User Form System

A comprehensive form system built with React.js (frontend) and Node.js/Express (backend) integrated with PostgreSQL database. This system allows administrators to create various types of forms and users to fill them through unique links.

## Features

### 🔐 User System (2 Roles)
- **Admin**: Can create and manage forms, view responses, export data
- **Regular User**: Can fill forms through links provided by admin (no login required)

### 📋 Form Types
#### A. Google-like Form (Standard)
- Text inputs, dropdowns, radio buttons, checkboxes
- Multiple question types support

#### B. Assessment/Rating Form (Special)
- 5-point rating scale (Likert scale)
- Bilingual support (English/Indonesian)
- Format: Left Statement | [1-2-3-4-5] | Right Statement

### 🔗 Form Access System
- Users access forms through unique links
- **No registration required** - just name and email
- **Duplicate prevention**: Name + email combination can only fill form once
- Validation and error handling for duplicates

### 📅 Conditional Logic Based on Year
- Admin can set questions to appear based on year selection
- Example: Different question sets for employees who joined in different years
- Supports "equals" and "less than or equal" conditions

### 📊 Admin Dashboard
- View all created forms
- View respondent lists per form
- View detailed responses
- **Export to Excel (.xlsx)** with all data

### 🗄️ Database Management
- **Auto drop & recreate** tables on first run
- Fresh database schema every startup
- Confirmation logs for database operations

## Tech Stack

- **Frontend**: React.js 18, React Router, Axios
- **Backend**: Node.js, Express.js, PostgreSQL (pg)
- **Database**: PostgreSQL
- **Export**: ExcelJS for .xlsx generation
- **Authentication**: JWT tokens for admin
- **Styling**: Custom CSS

## Database Configuration

The system is configured to connect to:
- **Host**: 31.97.111.215
- **Port**: 5432  
- **Database**: form
- **User**: postgres
- **Password**: 123

## Project Structure

```
/project-root
├── package.json                    # Root package with concurrent scripts
├── /backend
│   ├── package.json               # Backend dependencies
│   ├── server.js                  # Main Express server
│   └── database.js               # Database setup & migration
├── /frontend
│   ├── package.json              # React app dependencies
│   ├── public/index.html         # HTML template
│   └── src/
│       ├── App.js               # Main React app
│       ├── App.css              # Global styles
│       ├── index.js             # React entry point
│       ├── /components
│       │   ├── AdminLogin.js    # Admin authentication
│       │   ├── AdminDashboard.js # Form management dashboard
│       │   ├── FormBuilder.js   # Create/edit forms
│       │   ├── FormFiller.js    # Public form filling
│       │   └── FormResponses.js # View form responses
│       └── /utils
│           └── api.js           # API communication
└── README.md                     # This file
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database access
- Git

### Quick Start

1. **Clone/Download the project**
   ```bash
   cd "c:\Folder Project\form"
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Start the application**
   ```bash
   npm start
   ```

   This single command will:
   - Start the backend server on `http://localhost:5000`
   - Start the React frontend on `http://localhost:3000`
   - Automatically drop and recreate database tables
   - Create a default admin user

### Manual Setup (Alternative)

If you prefer to run them separately:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies  
cd ../frontend
npm install

# Start backend (from backend folder)
cd ../backend
npm run dev

# Start frontend (from frontend folder, in new terminal)
cd ../frontend
npm start
```

## Usage Guide

### Admin Login
- URL: `http://localhost:3000/admin`
- Default credentials:
  - **Username**: admin
  - **Password**: admin123

### Creating Forms

1. **Login as Admin**
2. **Click "Create New Form"**
3. **Fill form details:**
   - Title and description
   - Choose form type (Standard or Assessment)
4. **Add questions:**
   - Various question types supported
   - For Assessment forms: Add bilingual left/right statements
5. **Set up conditional logic (optional):**
   - Configure year-based question visibility
   - Multiple conditions supported
6. **Save form** - unique link will be generated

### Form Types in Detail

#### Standard Form
- Text input, textarea, number, email
- Dropdown selections
- Radio buttons (single choice)
- Checkboxes (multiple choice)

#### Assessment Form
- 5-point Likert scale (1-2-3-4-5)
- Bilingual statements (English/Indonesian)
- Logic: 1-2 leans toward left statement, 3 is neutral, 4-5 toward right
- Language toggle for users

### Conditional Questions
Set up rules like:
- **If year = 2021** → Show questions 3, 5, 7
- **If year ≤ 2024** → Show questions 2, 4, 6, 8
- **If year = 2025** → Show questions 1, 9, 10

### User Experience

1. **User clicks form link** (e.g., `/form/abc123-def456`)
2. **Enters name and email** (validated for duplicates)
3. **Fills out questions** (conditional questions appear based on selections)
4. **Submits form** (one-time submission per name+email combination)

### Data Export

- **Excel (.xlsx) format** with all response data
- Columns: Name, Email, Timestamp, All Questions
- Download directly from admin dashboard

## API Endpoints

### Authentication
- `POST /api/admin/login` - Admin login

### Form Management (Admin)
- `GET /api/admin/forms` - Get all forms
- `POST /api/admin/forms` - Create new form
- `DELETE /api/admin/forms/:formId` - Delete form
- `GET /api/admin/forms/:formId/responses` - Get form responses
- `GET /api/admin/forms/:formId/export` - Export responses to Excel

### Public Form Access
- `GET /api/form/:uniqueLink` - Get form by link
- `POST /api/form/:uniqueLink/submit` - Submit form response
- `POST /api/form/:uniqueLink/conditional-questions` - Get conditional questions

## Database Schema

### Tables:
1. **users** - Admin accounts
2. **forms** - Form definitions
3. **form_questions** - Questions within forms
4. **conditional_questions** - Year-based conditional logic
5. **form_responses** - User submissions

### Key Features:
- Foreign key relationships
- Unique constraints for duplicate prevention
- JSONB storage for flexible response data
- Cascade deletes for data integrity

## Security Features

- **JWT authentication** for admin routes
- **Input validation** and sanitization
- **SQL injection prevention** with parameterized queries
- **Duplicate submission prevention**
- **CORS protection**

## Development

### File Structure Details

- **server.js**: Main Express application with all routes
- **database.js**: Database connection and schema management
- **App.js**: React router and main component structure
- **api.js**: Centralized API communication with axios
- **Component files**: Modular React components for each feature

### Customization

The system is designed to be easily customizable:
- **Database config**: Edit `database.js` connection settings
- **Styling**: Modify `App.css` or add component-specific styles  
- **Question types**: Extend question rendering in `FormFiller.js`
- **Conditional logic**: Add new condition types in backend and frontend

## Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check PostgreSQL server is running
   - Verify connection details in `database.js`
   - Ensure database 'form' exists

2. **Port conflicts**
   - Backend uses port 5000, frontend uses 3000
   - Change ports in respective package.json files if needed

3. **CORS issues**
   - Frontend proxy is configured for localhost:5000
   - Update proxy in frontend/package.json if backend port changes

4. **Excel export not working**
   - Check ExcelJS dependency installation
   - Verify file permissions for downloads

### Database Reset

The application automatically drops and recreates tables on startup. To manually reset:

```sql
-- Connect to PostgreSQL and run:
DROP TABLE IF EXISTS form_responses CASCADE;
DROP TABLE IF EXISTS conditional_questions CASCADE;  
DROP TABLE IF EXISTS form_questions CASCADE;
DROP TABLE IF EXISTS forms CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

Then restart the application.

## License

MIT License - Feel free to use and modify as needed.

## Support

For issues or questions:
1. Check the console logs for detailed error messages
2. Verify database connection and credentials
3. Ensure all dependencies are installed correctly
4. Check that both frontend and backend are running

---

**Ready to use!** Start with `npm start` and access the admin panel at `http://localhost:3000/admin`