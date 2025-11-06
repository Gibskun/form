# Form Sections Feature

## Overview
The sections feature allows you to organize form questions into logical groups or categories. This makes long forms more manageable and user-friendly by breaking them into themed sections.

## How to Use Sections

### 1. Creating Sections (Form Builder)
- When creating or editing a form, you can add sections using the "Section Management" panel
- Click "Add Section" to create a new section
- Give each section a descriptive name (e.g., "Employee Information", "Performance Review", "Goals & Objectives")
- You can reorder sections by dragging them up/down
- Sections can be edited or deleted as needed

### 2. Assigning Questions to Sections
- When adding or editing questions, you'll see a "Section" dropdown
- Select which section the question belongs to
- You can choose "No Section (Unassigned)" if the question doesn't fit into any section
- Questions can be reassigned to different sections at any time

### 3. Form Display (Form Filler)
- When users fill out the form, questions are automatically grouped by sections
- Each section displays with a header showing the section name
- Unassigned questions appear in a separate "Unassigned Questions" section
- The visual organization makes forms easier to navigate and complete

## Technical Implementation

### Database Changes
- Added `form_sections` table to store section information
- Added `section_id` column to `form_questions` table for question-section relationships
- Sections are linked to forms and questions maintain references to their sections

### Backend API Updates
- Form creation/editing endpoints now handle sections data
- Sections are included when retrieving form data
- Question-section relationships are properly maintained

### Frontend Enhancements
- **FormBuilder**: Section management UI with CRUD operations
- **FormFiller**: Questions grouped and displayed by sections with visual headers
- Clean, intuitive interface for both creating and filling forms

## Benefits
1. **Better Organization**: Large forms are broken into logical sections
2. **Improved UX**: Users can focus on one section at a time
3. **Flexible Structure**: Questions can be easily moved between sections
4. **Visual Clarity**: Clear section headers help users understand form structure
5. **Maintainable**: Easy to add, edit, or remove sections as needs change

## Example Use Cases
- **Employee Evaluation**: Personal Info, Performance Metrics, Goals, Feedback
- **Survey Forms**: Demographics, Preferences, Opinions, Contact Info  
- **Application Forms**: Basic Info, Qualifications, Experience, References
- **Assessment Forms**: Knowledge Areas, Skills, Competencies, Development

The sections feature makes your forms more professional, organized, and user-friendly while maintaining full flexibility in how you structure your content.