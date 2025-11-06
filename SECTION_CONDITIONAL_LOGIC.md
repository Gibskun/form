# Section-Based Conditional Logic Implementation

## Overview
I have successfully implemented a new section-based conditional logic system that allows administrators to manage year-based conditions at the section level instead of individual questions. This makes it much easier to manage large forms with many questions.

## What Was Changed

### 1. **Database Schema Updates**
- **New Table**: `conditional_sections` 
  - Stores section-based conditional rules
  - Fields: `id`, `form_id`, `condition_name`, `condition_type`, `condition_value`, `section_ids[]`, `is_active`, `created_at`, `updated_at`
  - Supports same year conditions as question-based logic (equals, less/equal, greater/equal, between)

### 2. **Backend API Enhancements**
- **New Endpoint**: `POST /api/form/:uniqueLink/conditional-sections`
  - Returns sections and their questions based on year conditions
  - Mirrors the existing conditional questions endpoint but works with sections
- **Enhanced Form APIs**: Both admin and public form retrieval now include `conditional_sections`
- **Form Creation/Update**: Now handles `conditionalSections` array in request payload

### 3. **Frontend FormBuilder Updates**
- **New State**: `conditionalSections` array to manage section-based rules
- **New UI Section**: "Section-Based Conditional Logic" panel
- **Enhanced Functions**:
  - `addConditionalSection()` - Creates new section condition
  - `updateConditionalSection()` - Updates section condition properties
  - `removeConditionalSection()` - Removes section condition
  - `updateConditionalSectionIds()` - Updates selected sections for condition

### 4. **API Integration**
- **New API Call**: `formAPI.getConditionalSections(uniqueLink, selectedYear)`
- **Form Submission**: Now includes `conditionalSections` in payload

## User Interface Features

### **Section-Based Conditional Logic Panel**
- **Green-themed UI**: Distinguishes from question-based logic (blue theme)
- **Condition Name Field**: Admins can name their conditions (e.g., "Senior Employees", "New Hires")
- **Year Conditions**: Same options as question-based logic
  - Exactly equal to
  - Less than or equal to (≤)
  - Greater than or equal to (≥)
  - Between (inclusive)
- **Section Selection**: Visual checkboxes showing:
  - Section name with folder icon (📂)
  - Number of questions in each section
  - Section ID for reference
  - Section description if available

### **Enhanced User Experience**
- **Select All/Clear All**: Buttons for quick section selection
- **Visual Feedback**: Selected sections highlighted in green
- **Smart Tooltips**: Shows which users will see each condition
- **Question Count**: Displays how many questions are in each section

## Benefits for Administrators

### **Before (Question-Based)**
- Had to select individual questions one by one
- Difficult to manage forms with 50+ questions
- Hard to visualize which questions belong together
- Time-consuming to set up conditions for related questions

### **After (Section-Based)**
- Select entire sections with one click
- Logical grouping of related questions
- Easier to understand and manage
- One section = multiple questions automatically included
- Much faster setup for large forms

## Example Use Cases

### **Employee Evaluation Form**
**Sections**: Personal Info, Performance Metrics, Goals, Manager Feedback

**Conditions**:
- **"New Employees" (≥ 2023)**: Show "Personal Info" + "Goals" sections only
- **"Senior Employees" (≤ 2022)**: Show all sections including "Manager Feedback"
- **"Mid-Level" (2020-2022)**: Show "Personal Info" + "Performance Metrics" + "Goals"

### **University Application**
**Sections**: Basic Info, Academic History, References, Essays, Portfolio

**Conditions**:
- **"First-Time Applicants" (= 2025)**: Show all sections
- **"Transfer Students" (≤ 2024)**: Skip "Basic Info", show others
- **"Graduate Applicants" (≤ 2020)**: Show "Academic History" + "References" + "Portfolio" only

## Technical Implementation

### **Database Structure**
```sql
CREATE TABLE conditional_sections (
  id SERIAL PRIMARY KEY,
  form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
  condition_name VARCHAR(100),
  condition_type VARCHAR(50) NOT NULL,
  condition_value JSONB NOT NULL,
  section_ids INTEGER[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **API Response Structure**
```json
{
  "sections": [
    {
      "id": 1,
      "section_name": "Personal Information",
      "order_number": 1
    }
  ],
  "questions": [
    {
      "id": 1,
      "question_text": "Your name?",
      "section_id": 1,
      "question_type": "text"
    }
  ]
}
```

### **Frontend State Management**
```javascript
const [conditionalSections, setConditionalSections] = useState([]);

// Example conditional section object
{
  condition_name: "Senior Employees",
  condition_type: "year_less_equal", 
  condition_value: "2022",
  section_ids: [1, 3, 5]
}
```

## Backward Compatibility
- **Existing question-based logic still works** - no breaking changes
- **Dual system**: Admins can use both approaches simultaneously
- **Gradual migration**: Can switch from question-based to section-based over time
- **API compatibility**: All existing endpoints remain functional

## Future Enhancements Possible
1. **Mixed Logic**: Combine section-based and question-based in single condition
2. **Section Dependencies**: Show sections based on other section responses
3. **Complex Conditions**: AND/OR logic between multiple year conditions
4. **Visual Builder**: Drag-and-drop interface for condition creation
5. **Preview Mode**: Live preview of what users will see for different years

This implementation significantly improves the administrator experience for managing large, complex forms with year-based conditional logic while maintaining full compatibility with existing functionality.