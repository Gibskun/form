import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminAPI, superadminAPI } from '../utils/api';

const FormBuilder = () => {
  const { formId } = useParams(); // Get formId from URL if editing
  const isEditMode = Boolean(formId);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    form_type: 'standard'
  });
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [conditionalQuestions, setConditionalQuestions] = useState([]);
  const [conditionalSections, setConditionalSections] = useState([]);
  const [roleBasedConditionalSections, setRoleBasedConditionalSections] = useState([]);
  const [managementNames, setManagementNames] = useState({}); // Store names for each Management role condition (legacy)
  const [managementLists, setManagementLists] = useState([]); // Multiple management lists support
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(isEditMode);
  const [error, setError] = useState('');
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scaleOrderMode, setScaleOrderMode] = useState(false);
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const navigate = useNavigate();

  // Check authentication on component mount
  useEffect(() => {
    console.log('🚀 FormBuilder component mounted', { isEditMode, formId });
    const token = localStorage.getItem('adminToken');
    if (!token) {
      console.log('🔐 No token found, redirecting to login');
      navigate('/admin');
      return;
    }
    
    console.log('✅ Token found, proceeding with form builder');
    if (isEditMode && formId) {
      console.log('📝 Edit mode detected, loading form data...');
      loadFormData();
    } else {
      console.log('🆕 Create mode detected');
    }
  }, [formId, isEditMode, navigate]);

  // Check if current user is superadmin
  useEffect(() => {
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      try {
        const user = JSON.parse(adminUser);
        setIsSuperAdmin(user.role === 'super_admin');
      } catch (error) {
        console.error('Error parsing admin user:', error);
      }
    }
  }, []);

  const loadFormData = async () => {
    try {
      console.log('🔄 Loading form data for formId:', formId);
      setLoadingForm(true);
      const response = await adminAPI.getForm(formId);
      console.log('✅ Form data loaded:', response.data);
      
      setFormData({
        title: response.data.title,
        description: response.data.description,
        form_type: response.data.form_type
      });
      
      // Ensure questions have proper structure with null-safe options
      const loadedQuestions = (response.data.questions || []).map(q => ({
        ...q,
        options: q.options || []
      }));
      
      // Map database sections to frontend format
      const loadedSections = (response.data.sections || []).map(section => ({
        ...section,
        name: section.name || section.section_name, // Map section_name to name for frontend
        description: section.description || section.section_description || ''
      }));

      setQuestions(loadedQuestions);
      setSections(loadedSections);
      setConditionalQuestions(response.data.conditional_questions || []);
      setConditionalSections(response.data.conditional_sections || []);
      setRoleBasedConditionalSections(response.data.role_based_conditional_sections || []);
      setManagementLists(response.data.management_lists || []);
      
      // Extract and set management names from role-based conditional sections (legacy support)
      const managementNamesMap = {};
      (response.data.role_based_conditional_sections || []).forEach((rbcs, index) => {
        if (rbcs.condition_value === 'management' && rbcs.management_names) {
          managementNamesMap[index] = rbcs.management_names;
        }
      });
      setManagementNames(managementNamesMap);
      
      console.log('📋 Set questions:', response.data.questions?.length || 0);
      console.log('📂 Set sections:', response.data.sections?.length || 0);
      console.log('🔀 Set conditional questions:', response.data.conditional_questions?.length || 0);
      console.log('🔀 Set conditional sections:', response.data.conditional_sections?.length || 0);
      console.log('👤 Set role-based conditional sections:', response.data.role_based_conditional_sections?.length || 0);
      console.log('👥 Set management names:', managementNamesMap);
      console.log('📝 Set management lists:', response.data.management_lists?.length || 0);
    } catch (error) {
      console.error('❌ Error loading form:', error);
      setError('Failed to load form data: ' + (error.response?.data?.error || error.message));
      // If unauthorized, redirect to login
      if (error.response?.status === 401) {
        console.log('🔐 Unauthorized, redirecting to login');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/admin');
      }
    } finally {
      setLoadingForm(false);
    }
  };

  // Add new section
  const addSection = () => {
    const newSection = {
      id: Date.now(),
      name: `Section ${sections.length + 1}`,
      description: ''
    };
    setSections([...sections, newSection]);
  };

  // Update section
  const updateSection = (index, field, value) => {
    const updatedSections = [...sections];
    updatedSections[index][field] = value;
    setSections(updatedSections);
  };

  // Remove section
  const removeSection = (index) => {
    const sectionToRemove = sections[index];
    
    // Remove section assignment from questions that belong to this section
    const updatedQuestions = questions.map(q => 
      q.section_id === sectionToRemove.id ? { ...q, section_id: null } : q
    );
    setQuestions(updatedQuestions);
    
    // Remove the section
    setSections(sections.filter((_, i) => i !== index));
  };

  // Move section up
  const moveSectionUp = (index) => {
    if (index > 0) {
      const updatedSections = [...sections];
      [updatedSections[index], updatedSections[index - 1]] = [updatedSections[index - 1], updatedSections[index]];
      setSections(updatedSections);
    }
  };

  // Move section down
  const moveSectionDown = (index) => {
    if (index < sections.length - 1) {
      const updatedSections = [...sections];
      [updatedSections[index], updatedSections[index + 1]] = [updatedSections[index + 1], updatedSections[index]];
      setSections(updatedSections);
    }
  };

  // Toggle section collapse
  const toggleSectionCollapse = (sectionId) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  // Add new question
  const addQuestion = (sectionId = null) => {
    const newQuestion = {
      id: Date.now(),
      question_text: '',
      question_text_id: '',
      question_type: 'text',
      options: [],
      left_statement: '',
      right_statement: '',
      left_statement_id: '',
      right_statement_id: '',
      is_required: false,
      section_id: sectionId
    };
    setQuestions([...questions, newQuestion]);
  };

  // Update question
  const updateQuestion = (index, field, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index][field] = value;
    
    // If changing to assessment type, ensure we have rating scale options
    if (field === 'question_type' && value === 'assessment') {
      updatedQuestions[index].options = [
        { text: '1', value: '1' },
        { text: '2', value: '2' },
        { text: '3', value: '3' },
        { text: '4', value: '4' }
      ];
    }
    
    setQuestions(updatedQuestions);
  };

  // Remove question
  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Move question up
  const moveQuestionUp = (index) => {
    if (index > 0) {
      const updatedQuestions = [...questions];
      [updatedQuestions[index], updatedQuestions[index - 1]] = [updatedQuestions[index - 1], updatedQuestions[index]];
      setQuestions(updatedQuestions);
    }
  };

  // Move question down
  const moveQuestionDown = (index) => {
    if (index < questions.length - 1) {
      const updatedQuestions = [...questions];
      [updatedQuestions[index], updatedQuestions[index + 1]] = [updatedQuestions[index + 1], updatedQuestions[index]];
      setQuestions(updatedQuestions);
    }
  };

  // Duplicate question
  const duplicateQuestion = (index) => {
    const questionToDuplicate = { ...questions[index] };
    questionToDuplicate.id = Date.now(); // New unique ID
    questionToDuplicate.question_text = questionToDuplicate.question_text + ' (Copy)';
    const updatedQuestions = [...questions];
    updatedQuestions.splice(index + 1, 0, questionToDuplicate);
    setQuestions(updatedQuestions);
  };

  // Toggle question collapse
  const toggleQuestionCollapse = (questionId) => {
    const newCollapsed = new Set(collapsedQuestions);
    if (newCollapsed.has(questionId)) {
      newCollapsed.delete(questionId);
    } else {
      newCollapsed.add(questionId);
    }
    setCollapsedQuestions(newCollapsed);
  };

  // Add option to question
  const addOption = (questionIndex) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options.push({ text: '', value: '' });
    setQuestions(updatedQuestions);
  };

  // Update option
  const updateOption = (questionIndex, optionIndex, field, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options[optionIndex][field] = value;
    if (field === 'text') {
      updatedQuestions[questionIndex].options[optionIndex].value = value.toLowerCase().replace(/\s+/g, '_');
    }
    setQuestions(updatedQuestions);
  };

  // Remove option
  const removeOption = (questionIndex, optionIndex) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options.filter((_, i) => i !== optionIndex);
    setQuestions(updatedQuestions);
  };

  // Add conditional question set
  const addConditionalQuestion = () => {
    const newConditional = {
      condition_type: 'year_equals',
      condition_value: '2024',
      question_ids: []
    };
    setConditionalQuestions([...conditionalQuestions, newConditional]);
  };

  // Update conditional question
  const updateConditionalQuestion = (index, field, value) => {
    const updated = [...conditionalQuestions];
    updated[index][field] = value;
    
    // Initialize between condition format
    if (field === 'condition_type' && value === 'year_between') {
      updated[index].condition_value = '2020-2024';
    }
    
    setConditionalQuestions(updated);
  };

  // Remove conditional question
  const removeConditionalQuestion = (index) => {
    setConditionalQuestions(conditionalQuestions.filter((_, i) => i !== index));
  };

  // Update conditional question IDs
  const updateConditionalQuestionIds = (condIndex, questionIds) => {
    const updated = [...conditionalQuestions];
    updated[condIndex].question_ids = questionIds;
    setConditionalQuestions(updated);
  };

  // Add conditional section set
  const addConditionalSection = () => {
    const newConditional = {
      condition_name: `Condition ${conditionalSections.length + 1}`,
      condition_type: 'year_equals',
      condition_value: '2024',
      section_ids: []
    };
    setConditionalSections([...conditionalSections, newConditional]);
  };

  // Update conditional section
  const updateConditionalSection = (index, field, value) => {
    const updated = [...conditionalSections];
    updated[index][field] = value;
    
    // Initialize between condition format
    if (field === 'condition_type' && value === 'year_between') {
      updated[index].condition_value = '2020-2024';
    }
    
    setConditionalSections(updated);
  };

  // Remove conditional section
  const removeConditionalSection = (index) => {
    setConditionalSections(conditionalSections.filter((_, i) => i !== index));
  };

  // Update conditional section IDs
  const updateConditionalSectionIds = (condIndex, sectionIds) => {
    const updated = [...conditionalSections];
    updated[condIndex].section_ids = sectionIds;
    setConditionalSections(updated);
  };

  // Role-based conditional section functions
  const addRoleBasedConditionalSection = () => {
    const newRoleCondition = {
      condition_name: `Role Condition ${roleBasedConditionalSections.length + 1}`,
      condition_type: 'role_equals',
      condition_value: 'employee',
      section_ids: []
    };
    setRoleBasedConditionalSections([...roleBasedConditionalSections, newRoleCondition]);
  };

  const updateRoleBasedConditionalSection = (index, field, value) => {
    const updated = [...roleBasedConditionalSections];
    updated[index][field] = value;
    setRoleBasedConditionalSections(updated);
  };

  const removeRoleBasedConditionalSection = (index) => {
    setRoleBasedConditionalSections(roleBasedConditionalSections.filter((_, i) => i !== index));
  };

  const updateRoleBasedConditionalSectionIds = (condIndex, sectionIds) => {
    const updated = [...roleBasedConditionalSections];
    updated[condIndex].section_ids = sectionIds;
    setRoleBasedConditionalSections(updated);
  };

  // Management lists functions
  const addManagementList = () => {
    const newList = {
      id: Date.now(), // Temporary ID for frontend
      list_name: `Management List ${managementLists.length + 1}`,
      list_description: '',
      management_names: '',
      section_ids: []
    };
    setManagementLists([...managementLists, newList]);
  };

  const updateManagementList = (index, field, value) => {
    const updated = [...managementLists];
    updated[index][field] = value;
    setManagementLists(updated);
  };

  const removeManagementList = (index) => {
    setManagementLists(managementLists.filter((_, i) => i !== index));
  };

  const updateManagementListSectionIds = (listIndex, sectionIds) => {
    const updated = [...managementLists];
    updated[listIndex].section_ids = sectionIds;
    setManagementLists(updated);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate
      if (!formData.title.trim()) {
        throw new Error('Form title is required');
      }
      if (questions.length === 0) {
        throw new Error('At least one question is required');
      }

      // Prepare questions data
      const questionsData = (questions || []).map((q, index) => ({
        ...q,
        order_number: index + 1,
        options: q.options && q.options.length > 0 ? q.options : null
      }));

      // Prepare role-based conditional sections with management names
      const roleBasedConditionalSectionsWithNames = roleBasedConditionalSections.map((rbcs, index) => ({
        ...rbcs,
        management_names: rbcs.condition_value === 'management' ? managementNames[index] : null
      }));

      const payload = {
        ...formData,
        questions: questionsData,
        sections: sections,
        conditionalQuestions: conditionalQuestions,
        conditionalSections: conditionalSections,
        roleBasedConditionalSections: roleBasedConditionalSectionsWithNames,
        managementLists: managementLists
      };

      console.log('FormBuilder sending sections:', JSON.stringify(sections, null, 2));
      console.log('FormBuilder sending conditional sections:', JSON.stringify(conditionalSections, null, 2));
      console.log('FormBuilder sending role-based conditional sections:', JSON.stringify(roleBasedConditionalSections, null, 2));
      console.log('FormBuilder sending management lists:', JSON.stringify(managementLists, null, 2));

      if (isEditMode) {
        await adminAPI.updateForm(formId, payload);
      } else {
        await adminAPI.createForm(payload);
      }
      
      navigate('/admin/dashboard');
    } catch (error) {
      setError(error.response?.data?.error || error.message || 
               (isEditMode ? 'Failed to update form' : 'Failed to create form'));
    } finally {
      setLoading(false);
    }
  };

  // Load assessment questions for superadmin scale management
  const loadAssessmentQuestions = async () => {
    if (!isSuperAdmin || !isEditMode || formData.form_type !== 'assessment') {
      return;
    }
    
    try {
      const response = await superadminAPI.getAssessmentQuestions(formId);
      setAssessmentQuestions(response.data.questions);
    } catch (error) {
      console.error('Failed to load assessment questions:', error);
    }
  };

  // Update scale order for a question
  const updateScaleOrder = async (questionId, newScaleOrder) => {
    try {
      await superadminAPI.updateScaleOrder(formId, questionId, newScaleOrder);
      
      // Update both assessment questions AND main questions state
      loadAssessmentQuestions();
      
      // CRITICAL FIX: Also update the main questions state to preserve scale order during form submission
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.id === questionId 
            ? { ...q, scale_order: newScaleOrder }
            : q
        )
      );
      
      alert('Scale order updated successfully!');
    } catch (error) {
      console.error('Failed to update scale order:', error);
      alert('Failed to update scale order: ' + (error.response?.data?.error || error.message));
    }
  };

  // Load assessment questions when entering scale order mode
  useEffect(() => {
    if (scaleOrderMode) {
      loadAssessmentQuestions();
    }
  }, [scaleOrderMode, isSuperAdmin, isEditMode, formData.form_type]);

  if (loadingForm) {
    return (
      <div>
        <header className="header">
          <nav className="nav">
            <h1>Loading Form...</h1>
          </nav>
        </header>
        <div className="container">
          <div className="card">
            <div className="loading">Loading form data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header">
        <nav className="nav">
          <h1>{isEditMode ? 'Edit Form' : 'Create New Form'}</h1>
          <div className="nav-links">
            <Link to="/admin/dashboard" className="nav-link">Back to Dashboard</Link>
          </div>
        </nav>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit}>
          <div className="card">
            <h2>Form Details</h2>
            {error && <div className="error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Form Title:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description:</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Form Type:</label>
              <select
                value={formData.form_type}
                onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
                className="form-select"
              >
                <option value="standard">Standard Form (Google-like)</option>
                <option value="assessment">Assessment/Rating Form (5-point scale)</option>
              </select>
            </div>
          </div>

          {/* Superadmin Scale Management */}
          {isSuperAdmin && isEditMode && formData.form_type === 'assessment' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: '0', color: '#e74c3c' }}>🔧 Superadmin: Assessment Scale Management</h2>
                <button
                  type="button"
                  onClick={() => setScaleOrderMode(!scaleOrderMode)}
                  className={`btn ${scaleOrderMode ? 'btn-danger' : 'btn-warning'}`}
                >
                  {scaleOrderMode ? 'Exit Scale Mode' : 'Manage Scale Order'}
                </button>
              </div>
              
              {scaleOrderMode && (
                <div style={{ backgroundColor: '#fff5f5', padding: '20px', borderRadius: '8px', border: '2px solid #fecaca' }}>
                  <p style={{ margin: '0 0 15px 0', color: '#dc2626', fontWeight: 'bold' }}>
                    ⚠️ Customize the order of rating numbers (1-5) for each assessment question.
                    <br />Default order: 1, 2, 3, 4, 5 (Strongly Disagree → Strongly Agree)
                  </p>
                  
                  {(assessmentQuestions || []).length > 0 ? (
                    (assessmentQuestions || []).map(question => (
                      <ScaleOrderEditor
                        key={question.id}
                        question={question}
                        onUpdateScaleOrder={updateScaleOrder}
                      />
                    ))
                  ) : (
                    <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
                      No assessment questions found. Save the form first to manage scale orders.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: '0' }}>Questions ({questions.length})</h2>
              {questions.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#6c757d' }}>
                    <input
                      type="checkbox"
                      checked={previewMode}
                      onChange={(e) => setPreviewMode(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    👁️ Preview Mode
                  </label>
                  <button
                    type="button"
                    onClick={() => setCollapsedQuestions(new Set())}
                    className="btn btn-sm btn-outline-primary"
                  >
                    📖 Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollapsedQuestions(new Set((questions || []).map(q => q.id)))}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    📖 Collapse All
                  </button>
                </div>
              )}
            </div>
            {(questions || []).map((question, qIndex) => (
              <div key={question.id} className="question-builder" style={{
                border: '2px solid #e9ecef',
                borderRadius: '10px',
                marginBottom: '20px',
                backgroundColor: collapsedQuestions.has(question.id) ? '#f8f9fa' : '#ffffff'
              }}>
                <div className="question-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '15px 20px',
                  borderBottom: collapsedQuestions.has(question.id) ? 'none' : '1px solid #e9ecef',
                  backgroundColor: isEditMode ? '#e3f2fd' : '#f8f9fa',
                  borderRadius: '8px 8px 0 0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                       onClick={() => toggleQuestionCollapse(question.id)}>
                    <div className="question-number" style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '15px'
                    }}>{qIndex + 1}</div>
                    <div>
                      <h4 style={{ margin: '0', color: '#007bff' }}>
                        {question.question_text || `Question ${qIndex + 1}`}
                        {isEditMode && <span style={{ color: '#6c757d', fontSize: '14px' }}> (Edit Mode)</span>}
                      </h4>
                      <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
                        Type: {question.question_type} {question.is_required && '• Required'}
                      </p>
                    </div>
                    <span style={{ marginLeft: '15px', fontSize: '18px', color: '#6c757d' }}>
                      {collapsedQuestions.has(question.id) ? '▼' : '▲'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Reorder buttons */}
                    <button
                      type="button"
                      onClick={() => moveQuestionUp(qIndex)}
                      disabled={qIndex === 0}
                      className="btn btn-sm"
                      style={{
                        padding: '5px 8px',
                        backgroundColor: qIndex === 0 ? '#e9ecef' : '#007bff',
                        color: qIndex === 0 ? '#6c757d' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: qIndex === 0 ? 'not-allowed' : 'pointer'
                      }}
                      title="Move Up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestionDown(qIndex)}
                      disabled={qIndex === questions.length - 1}
                      className="btn btn-sm"
                      style={{
                        padding: '5px 8px',
                        backgroundColor: qIndex === questions.length - 1 ? '#e9ecef' : '#007bff',
                        color: qIndex === questions.length - 1 ? '#6c757d' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: qIndex === questions.length - 1 ? 'not-allowed' : 'pointer'
                      }}
                      title="Move Down"
                    >
                      ↓
                    </button>
                    {/* Duplicate button */}
                    <button
                      type="button"
                      onClick={() => duplicateQuestion(qIndex)}
                      className="btn btn-sm"
                      style={{
                        padding: '5px 8px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                      title="Duplicate Question"
                    >
                      📋
                    </button>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="btn btn-sm"
                      style={{
                        padding: '5px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                      title="Remove Question"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Collapsible Question Content */}
                {!collapsedQuestions.has(question.id) && (
                  <div style={{ padding: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Question Text:</label>
                  <input
                    type="text"
                    value={question.question_text}
                    onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                    className="form-input"
                    placeholder="Enter your question"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Question Type:</label>
                  <select
                    value={question.question_type}
                    onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                    className="form-select"
                  >
                    <option value="text">Text Input</option>
                    <option value="textarea">Long Text</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="select">Dropdown</option>
                    <option value="radio">Multiple Choice (Radio)</option>
                    <option value="checkbox">Checkboxes</option>
                    {formData.form_type === 'assessment' && (
                      <option value="assessment">Assessment Scale (1-5)</option>
                    )}
                  </select>
                </div>

                {/* Section Assignment */}
                {sections.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Assign to Section:</label>
                    <select
                      value={question.section_id || ''}
                      onChange={(e) => updateQuestion(qIndex, 'section_id', e.target.value || null)}
                      className="form-select"
                    >
                      <option value="">No Section (Unassigned)</option>
                      {sections.map(section => (
                        <option key={section.id} value={section.id}>
                          📂 {section.name}
                        </option>
                      ))}
                    </select>
                    <small className="form-text text-muted">
                      Select a section to organize this question, or leave unassigned.
                    </small>
                  </div>
                )}

                {/* Assessment type specific fields */}
                {question.question_type === 'assessment' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Left Statement (English):</label>
                      <input
                        type="text"
                        value={question.left_statement}
                        onChange={(e) => updateQuestion(qIndex, 'left_statement', e.target.value)}
                        className="form-input"
                        placeholder="Statement for scale 1-2"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Left Statement (Indonesian):</label>
                      <input
                        type="text"
                        value={question.left_statement_id}
                        onChange={(e) => updateQuestion(qIndex, 'left_statement_id', e.target.value)}
                        className="form-input"
                        placeholder="Pernyataan untuk skala 1-2"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Right Statement (English):</label>
                      <input
                        type="text"
                        value={question.right_statement}
                        onChange={(e) => updateQuestion(qIndex, 'right_statement', e.target.value)}
                        className="form-input"
                        placeholder="Statement for scale 3-4"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Right Statement (Indonesian):</label>
                      <input
                        type="text"
                        value={question.right_statement_id}
                        onChange={(e) => updateQuestion(qIndex, 'right_statement_id', e.target.value)}
                        className="form-input"
                        placeholder="Pernyataan untuk skala 3-4"
                      />
                    </div>
                  </>
                )}

                {/* Options for select, radio, checkbox */}
                {['select', 'radio', 'checkbox'].includes(question.question_type) && (
                  <div className="form-group">
                    <label className="form-label">Options:</label>
                    <div className="options-list">
                      {(question.options || []).map((option, oIndex) => (
                        <div key={oIndex} className="option-item">
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => updateOption(qIndex, oIndex, 'text', e.target.value)}
                            className="form-input"
                            placeholder={`Option ${oIndex + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(qIndex, oIndex)}
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '12px' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="btn btn-secondary"
                        style={{ marginTop: '10px' }}
                      >
                        Add Option
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={question.is_required}
                      onChange={(e) => updateQuestion(qIndex, 'is_required', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Required
                  </label>
                </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: '20px',
              padding: '20px',
              backgroundColor: isEditMode ? '#fff3cd' : '#d1ecf1',
              border: `2px dashed ${isEditMode ? '#856404' : '#007bff'}`,
              borderRadius: '10px'
            }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0', color: isEditMode ? '#856404' : '#007bff' }}>
                  {isEditMode ? '📝 Edit Mode: Manage Questions' : '➕ Add Questions'}
                </h4>
                <p style={{ margin: '0', color: '#6c757d', fontSize: '14px' }}>
                  {isEditMode 
                    ? 'You can edit existing questions, add new ones, reorder, or duplicate them.'
                    : 'Add questions to your form. You can reorder them later.'
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={addQuestion}
                className="btn btn-success"
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  borderRadius: '8px'
                }}
              >
                ➕ Add New Question
              </button>
            </div>

            {/* Sections Management */}
            <div style={{
              border: '2px solid #e9ecef',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '20px',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#6f42c1' }}>
                    📂 Form Sections
                  </h4>
                  <p style={{ margin: '0', color: '#6c757d', fontSize: '14px' }}>
                    Organize your questions into sections. Questions can be assigned to sections for better organization.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSection}
                  className="btn btn-outline-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: '6px'
                  }}
                >
                  ➕ Add Section
                </button>
              </div>

              {sections.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '30px',
                  color: '#6c757d',
                  fontStyle: 'italic'
                }}>
                  No sections created yet. Add a section to organize your questions.
                </div>
              ) : (
                <div>
                  {(sections || []).map((section, sIndex) => (
                    <div key={section.id} style={{
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{
                        padding: '15px',
                        borderBottom: collapsedSections.has(section.id) ? 'none' : '1px solid #dee2e6',
                        backgroundColor: '#f8f9fa',
                        borderRadius: collapsedSections.has(section.id) ? '8px' : '8px 8px 0 0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: '0 0 5px 0', color: '#495057' }}>
                              📂 Section {sIndex + 1}
                            </h5>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={section.name}
                                onChange={(e) => updateSection(sIndex, 'name', e.target.value)}
                                placeholder="Section name"
                                className="form-input"
                                style={{ minWidth: '200px' }}
                              />
                              <input
                                type="text"
                                value={section.description}
                                onChange={(e) => updateSection(sIndex, 'description', e.target.value)}
                                placeholder="Section description (optional)"
                                className="form-input"
                                style={{ minWidth: '300px' }}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '5px', marginLeft: '15px' }}>
                            <button
                              type="button"
                              onClick={() => toggleSectionCollapse(section.id)}
                              className="btn btn-sm btn-outline-secondary"
                              title={collapsedSections.has(section.id) ? 'Expand' : 'Collapse'}
                            >
                              {collapsedSections.has(section.id) ? '📖' : '📕'}
                            </button>
                            <button
                              type="button"
                              onClick={() => addQuestion(section.id)}
                              className="btn btn-sm btn-success"
                              title="Add question to this section"
                            >
                              ➕
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSectionUp(sIndex)}
                              disabled={sIndex === 0}
                              className="btn btn-sm btn-outline-primary"
                              title="Move up"
                            >
                              ⬆️
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSectionDown(sIndex)}
                              disabled={sIndex === sections.length - 1}
                              className="btn btn-sm btn-outline-primary"
                              title="Move down"
                            >
                              ⬇️
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSection(sIndex)}
                              className="btn btn-sm btn-outline-danger"
                              title="Delete section"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {!collapsedSections.has(section.id) && (
                        <div style={{ padding: '15px' }}>
                          <p style={{ margin: '0', fontSize: '13px', color: '#6c757d' }}>
                            Questions in this section: {questions.filter(q => q.section_id === section.id).length}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {questions.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#6c757d',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                marginTop: '20px'
              }}>
                <h4>No questions yet</h4>
                <p>Click "Add New Question" to start building your form.</p>
              </div>
            )}
          </div>

          {/* Conditional Questions */}
          <div className="card">
            <h2>📅 Year-Based Conditional Logic</h2>
            <div style={{ 
              backgroundColor: '#fff3cd', 
              padding: '15px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #ffeaa7'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>How it works:</h4>
              <p style={{ margin: '0', color: '#856404', fontSize: '14px' }}>
                Users will first be asked "What year did you enter/join?" and based on their answer, 
                only the questions matching your conditions below will be shown. 
                <strong> Example:</strong> If you set "Year ≤ 2024" and user enters "2023", they'll see those questions.
              </p>
            </div>

            {(conditionalQuestions || []).map((cond, cIndex) => (
              <div key={cIndex} style={{
                border: '2px solid #e9ecef',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '20px',
                backgroundColor: '#f8f9fa'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0', color: '#495057' }}>
                    📋 Condition Rule {cIndex + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeConditionalQuestion(cIndex)}
                    style={{ 
                      padding: '8px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                    title="Remove this condition"
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Show questions when user's year is:
                  </label>
                  <select
                    value={cond.condition_type}
                    onChange={(e) => updateConditionalQuestion(cIndex, 'condition_type', e.target.value)}
                    className="form-select"
                    style={{ fontSize: '16px', padding: '10px' }}
                  >
                    <option value="year_equals">Exactly equal to</option>
                    <option value="year_less_equal">Less than or equal to (≤)</option>
                    <option value="year_greater_equal">Greater than or equal to (≥)</option>
                    <option value="year_between">Between (inclusive)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Year Value:
                  </label>
                  {cond.condition_type === 'year_between' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min="1950"
                        max="2050"
                        value={cond.condition_value.split('-')[0] || ''}
                        onChange={(e) => {
                          const parts = cond.condition_value.split('-');
                          const newValue = e.target.value + '-' + (parts[1] || '');
                          updateConditionalQuestion(cIndex, 'condition_value', newValue);
                        }}
                        className="form-input"
                        placeholder="From year"
                        style={{ fontSize: '16px', padding: '10px', maxWidth: '120px' }}
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min="1950"
                        max="2050"
                        value={cond.condition_value.split('-')[1] || ''}
                        onChange={(e) => {
                          const parts = cond.condition_value.split('-');
                          const newValue = (parts[0] || '') + '-' + e.target.value;
                          updateConditionalQuestion(cIndex, 'condition_value', newValue);
                        }}
                        className="form-input"
                        placeholder="To year"
                        style={{ fontSize: '16px', padding: '10px', maxWidth: '120px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min="1950"
                        max="2050"
                        value={cond.condition_value}
                        onChange={(e) => updateConditionalQuestion(cIndex, 'condition_value', e.target.value)}
                        className="form-input"
                        placeholder="e.g., 2024"
                        style={{ fontSize: '16px', padding: '10px', maxWidth: '120px' }}
                      />
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#6c757d' }}>
                    {cond.condition_type === 'year_equals' && `Only users who entered in ${cond.condition_value || 'YYYY'}`}
                    {cond.condition_type === 'year_less_equal' && `Users who entered in ${cond.condition_value || 'YYYY'} or earlier`}
                    {cond.condition_type === 'year_greater_equal' && `Users who entered in ${cond.condition_value || 'YYYY'} or later`}
                    {cond.condition_type === 'year_between' && `Users who entered between ${cond.condition_value.split('-')[0] || 'YYYY'} and ${cond.condition_value.split('-')[1] || 'YYYY'}`}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    📝 Select Questions to Show for This Condition:
                  </label>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#6c757d', 
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '5px'
                  }}>
                    Choose which questions from your form should appear when users meet this year condition.
                    Selected: <strong>{cond.question_ids.length}</strong> question(s)
                  </div>
                  
                  {questions.length === 0 ? (
                    <div style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      color: '#6c757d',
                      backgroundColor: '#f8f9fa',
                      border: '1px dashed #dee2e6',
                      borderRadius: '5px'
                    }}>
                      No questions available yet. Add some questions above first.
                    </div>
                  ) : (
                    <div style={{ 
                      maxHeight: '200px', 
                      overflowY: 'auto', 
                      border: '2px solid #e9ecef', 
                      borderRadius: '8px',
                      padding: '15px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ marginBottom: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            // Use actual question IDs if available, otherwise use index + 1
                            const allIds = (questions || []).map((q, index) => q.id || (index + 1));
                            updateConditionalQuestionIds(cIndex, allIds);
                          }}
                          style={{
                            padding: '5px 10px',
                            marginRight: '10px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConditionalQuestionIds(cIndex, [])}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Clear All
                        </button>
                      </div>
                      
                      {(questions || []).map((q, qIndex) => {
                        // Use actual question ID if available (when editing), otherwise use index + 1 (when creating)
                        const questionId = q.id || (qIndex + 1);
                        
                        return (
                          <label 
                            key={qIndex} 
                            style={{ 
                              display: 'block', 
                              margin: '8px 0',
                              padding: '8px',
                              backgroundColor: cond.question_ids.includes(questionId) ? '#e8f5e8' : '#f8f9fa',
                              border: `1px solid ${cond.question_ids.includes(questionId) ? '#28a745' : '#e9ecef'}`,
                              borderRadius: '5px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={cond.question_ids.includes(questionId)}
                              onChange={(e) => {
                                const currentIds = cond.question_ids;
                                const newIds = e.target.checked
                                  ? [...currentIds, questionId]
                                  : currentIds.filter(id => id !== questionId);
                                updateConditionalQuestionIds(cIndex, newIds);
                              }}
                              style={{ marginRight: '10px' }}
                            />
                            <span style={{ 
                              fontWeight: cond.question_ids.includes(questionId) ? 'bold' : 'normal',
                              color: cond.question_ids.includes(questionId) ? '#28a745' : '#495057'
                            }}>
                              <strong>Q{qIndex + 1}:</strong> {q.question_text || 'Untitled Question'}
                              <small style={{ display: 'block', color: '#6c757d', fontSize: '12px' }}>
                                Type: {q.question_type} {q.is_required && '• Required'}
                                {q.id && ` • ID: ${q.id}`}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={addConditionalQuestion}
                style={{
                  padding: '15px 30px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                ➕ Add New Year Condition Rule
              </button>
              {conditionalQuestions.length === 0 && (
                <p style={{ marginTop: '15px', color: '#6c757d', fontSize: '14px' }}>
                  💡 <strong>Tip:</strong> Create conditions to show different questions based on when users entered/joined.<br/>
                  Example: Show certain questions only to users who joined before 2023.
                </p>
              )}
            </div>
          </div>

          {/* Section-Based Conditional Logic */}
          <div className="card">
            <h2>📂 Section-Based Conditional Logic</h2>
            <div style={{ 
              backgroundColor: '#e8f5e8', 
              padding: '15px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #c3e6cb'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#155724' }}>✨ New Feature: Section-Based Logic!</h4>
              <p style={{ margin: '0', color: '#155724', fontSize: '14px' }}>
                Instead of selecting individual questions, you can now select entire <strong>sections</strong> to show based on year conditions. 
                This makes it much easier to manage large forms with many questions organized into sections.
                <br/><strong>Example:</strong> Show "Employee Information" and "Performance Review" sections only to users who joined before 2023.
              </p>
            </div>

            {(conditionalSections || []).map((cond, cIndex) => (
              <div key={cIndex} style={{
                border: '2px solid #28a745',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '20px',
                backgroundColor: '#f8fff8'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0', color: '#155724' }}>
                    📂 Section Condition {cIndex + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeConditionalSection(cIndex)}
                    style={{ 
                      padding: '8px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                    title="Remove this section condition"
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Condition Name:
                  </label>
                  <input
                    type="text"
                    value={cond.condition_name || ''}
                    onChange={(e) => updateConditionalSection(cIndex, 'condition_name', e.target.value)}
                    className="form-input"
                    placeholder="e.g., Senior Employees, New Hires, etc."
                    style={{ fontSize: '16px', padding: '10px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Show sections when user's year is:
                  </label>
                  <select
                    value={cond.condition_type}
                    onChange={(e) => updateConditionalSection(cIndex, 'condition_type', e.target.value)}
                    className="form-select"
                    style={{ fontSize: '16px', padding: '10px' }}
                  >
                    <option value="year_equals">Exactly equal to</option>
                    <option value="year_less_equal">Less than or equal to (≤)</option>
                    <option value="year_greater_equal">Greater than or equal to (≥)</option>
                    <option value="year_between">Between (inclusive)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Year Value:
                  </label>
                  {cond.condition_type === 'year_between' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min="1950"
                        max="2050"
                        value={cond.condition_value.split('-')[0] || ''}
                        onChange={(e) => {
                          const parts = cond.condition_value.split('-');
                          const newValue = e.target.value + '-' + (parts[1] || '');
                          updateConditionalSection(cIndex, 'condition_value', newValue);
                        }}
                        className="form-input"
                        placeholder="From year"
                        style={{ fontSize: '16px', padding: '10px', maxWidth: '120px' }}
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min="1950"
                        max="2050"
                        value={cond.condition_value.split('-')[1] || ''}
                        onChange={(e) => {
                          const parts = cond.condition_value.split('-');
                          const newValue = (parts[0] || '') + '-' + e.target.value;
                          updateConditionalSection(cIndex, 'condition_value', newValue);
                        }}
                        className="form-input"
                        placeholder="To year"
                        style={{ fontSize: '16px', padding: '10px', maxWidth: '120px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min="1950"
                        max="2050"
                        value={cond.condition_value}
                        onChange={(e) => updateConditionalSection(cIndex, 'condition_value', e.target.value)}
                        className="form-input"
                        placeholder="e.g., 2024"
                        style={{ fontSize: '16px', padding: '10px', maxWidth: '120px' }}
                      />
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#6c757d' }}>
                    {cond.condition_type === 'year_equals' && `Only users who entered in ${cond.condition_value || 'YYYY'}`}
                    {cond.condition_type === 'year_less_equal' && `Users who entered in ${cond.condition_value || 'YYYY'} or earlier`}
                    {cond.condition_type === 'year_greater_equal' && `Users who entered in ${cond.condition_value || 'YYYY'} or later`}
                    {cond.condition_type === 'year_between' && `Users who entered between ${cond.condition_value.split('-')[0] || 'YYYY'} and ${cond.condition_value.split('-')[1] || 'YYYY'}`}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    📂 Select Sections to Show for This Condition:
                  </label>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#155724', 
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#d4edda',
                    borderRadius: '5px'
                  }}>
                    Choose which <strong>sections</strong> (groups of questions) should appear when users meet this year condition.
                    Each section contains multiple questions, making it easier to manage.
                    Selected: <strong>{cond.section_ids.length}</strong> section(s)
                  </div>
                  
                  {sections.length === 0 ? (
                    <div style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      color: '#6c757d',
                      backgroundColor: '#f8f9fa',
                      border: '1px dashed #dee2e6',
                      borderRadius: '5px'
                    }}>
                      No sections available yet. Add some sections above first.
                    </div>
                  ) : (
                    <div style={{ 
                      maxHeight: '200px', 
                      overflowY: 'auto', 
                      border: '2px solid #28a745', 
                      borderRadius: '8px',
                      padding: '15px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ marginBottom: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = (sections || []).map((s, index) => s.id || (index + 1));
                            updateConditionalSectionIds(cIndex, allIds);
                          }}
                          style={{
                            padding: '5px 10px',
                            marginRight: '10px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Select All Sections
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConditionalSectionIds(cIndex, [])}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Clear All
                        </button>
                      </div>
                      
                      {(sections || []).map((section, sIndex) => {
                        const sectionId = section.id || (sIndex + 1);
                        const questionsInSection = questions.filter(q => q.section_id === sectionId).length;
                        
                        return (
                          <label 
                            key={sIndex} 
                            style={{ 
                              display: 'block', 
                              margin: '8px 0',
                              padding: '12px',
                              backgroundColor: cond.section_ids.includes(sectionId) ? '#d4edda' : '#f8f9fa',
                              border: `2px solid ${cond.section_ids.includes(sectionId) ? '#28a745' : '#e9ecef'}`,
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={cond.section_ids.includes(sectionId)}
                              onChange={(e) => {
                                const currentIds = cond.section_ids;
                                const newIds = e.target.checked
                                  ? [...currentIds, sectionId]
                                  : currentIds.filter(id => id !== sectionId);
                                updateConditionalSectionIds(cIndex, newIds);
                              }}
                              style={{ marginRight: '12px' }}
                            />
                            <span style={{ 
                              fontWeight: cond.section_ids.includes(sectionId) ? 'bold' : 'normal',
                              color: cond.section_ids.includes(sectionId) ? '#155724' : '#495057'
                            }}>
                              <strong>📂 {section.name || section.section_name || `Section ${sIndex + 1}`}</strong>
                              <small style={{ display: 'block', color: '#6c757d', fontSize: '12px', marginTop: '4px' }}>
                                {questionsInSection} question{questionsInSection !== 1 ? 's' : ''} in this section
                                {section.id && ` • ID: ${section.id}`}
                              </small>
                              {section.description && (
                                <small style={{ display: 'block', color: '#6c757d', fontSize: '11px', fontStyle: 'italic' }}>
                                  {section.description}
                                </small>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={addConditionalSection}
                style={{
                  padding: '15px 30px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                ➕ Add New Section Condition Rule
              </button>
              {conditionalSections.length === 0 && (
                <p style={{ marginTop: '15px', color: '#6c757d', fontSize: '14px' }}>
                  💡 <strong>Tip:</strong> Create conditions to show different <strong>sections</strong> based on when users entered/joined.<br/>
                  This is easier than selecting individual questions - just select entire sections!
                </p>
              )}
            </div>
          </div>

          {/* Role-Based Conditional Logic */}
          <div className="card">
            <h2>👤 Role-Based Conditional Logic</h2>
            <div style={{ 
              backgroundColor: '#e8f5e8', 
              padding: '15px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #c3e6cb'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#155724' }}>🆕 Role-Based Section Logic!</h4>
              <p style={{ margin: '0', color: '#155724', fontSize: '14px' }}>
                Show different sections based on the user's role selection (Employee, Team Lead, or Management). 
                Users will first select their role, then only see sections relevant to their position.
                <br/><strong>Example:</strong> Show "Performance Review" section only to Team Leads, "Task Management" section only to Employees, and "Strategic Planning" section only to Management.
              </p>
            </div>

            {(roleBasedConditionalSections || []).map((cond, cIndex) => (
              <div key={cIndex} style={{
                border: '2px solid #007bff',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '20px',
                backgroundColor: '#f0f8ff'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  <h4 style={{ margin: '0', color: '#007bff' }}>👤 Role Condition {cIndex + 1}</h4>
                  <button
                    type="button"
                    onClick={() => removeRoleBasedConditionalSection(cIndex)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label>Condition Name:</label>
                    <input
                      type="text"
                      value={cond.condition_name || ''}
                      onChange={(e) => updateRoleBasedConditionalSection(cIndex, 'condition_name', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                      placeholder="e.g., Team Lead Sections"
                    />
                  </div>
                  <div>
                    <label>Show sections when role is:</label>
                    <select
                      value={cond.condition_value || 'employee'}
                      onChange={(e) => updateRoleBasedConditionalSection(cIndex, 'condition_value', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="employee">👤 Employee</option>
                      <option value="team_lead">👑 Team Lead</option>
                      <option value="management">👥 Management</option>
                    </select>
                  </div>
                </div>

                {/* Management Names Input - Show only when Management role is selected */}
                {cond.condition_value === 'management' && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                      📋 List of People to Evaluate (Management Role):
                    </label>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6'
                    }}>
                      <textarea
                        value={managementNames[cIndex] || ''}
                        onChange={(e) => setManagementNames({ 
                          ...managementNames, 
                          [cIndex]: e.target.value 
                        })}
                        placeholder={`Enter the list of people to be evaluated, one per line:\n\n1. Gibral\n2. John Smith\n3. Jane Doe\n4. ...\n\nOr simply:\nGibral\nJohn Smith\nJane Doe`}
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '12px',
                          border: '1px solid #ced4da',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          resize: 'vertical'
                        }}
                        rows={6}
                      />
                      <div style={{ 
                        marginTop: '10px', 
                        fontSize: '13px', 
                        color: '#6c757d',
                        backgroundColor: '#e9ecef',
                        padding: '8px',
                        borderRadius: '4px'
                      }}>
                        💡 <strong>Instructions:</strong> Enter the names of people who will be evaluated in this round-robin assessment. 
                        Each person will be evaluated for all questions in each section before moving to the next section.
                        <br/><strong>Format:</strong> One name per line (numbering is optional).
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                    Select sections to show for {
                      cond.condition_value === 'team_lead' ? 'Team Leads' : 
                      cond.condition_value === 'management' ? 'Management' : 
                      'Employees'
                    }:
                  </label>
                  <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: '#fff',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {sections.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        {sections.map((section) => (
                          <label key={section.id} style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>
                            <input
                              type="checkbox"
                              checked={(cond.section_ids || []).includes(section.id)}
                              onChange={(e) => {
                                const currentIds = cond.section_ids || [];
                                const newIds = e.target.checked
                                  ? [...currentIds, section.id]
                                  : currentIds.filter(id => id !== section.id);
                                updateRoleBasedConditionalSectionIds(cIndex, newIds);
                              }}
                              style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontSize: '14px' }}>
                              📂 {section.name || section.section_name || `Section ${section.id}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#6c757d', margin: '0', textAlign: 'center' }}>
                        📝 Add sections first to set up role-based conditions
                      </p>
                    )}
                  </div>
                  {(cond.section_ids || []).length > 0 && (
                    <p style={{ fontSize: '12px', color: '#28a745', marginTop: '8px' }}>
                      ✅ {(cond.section_ids || []).length} section(s) selected for {
                        cond.condition_value === 'team_lead' ? 'Team Leads' : 
                        cond.condition_value === 'management' ? 'Management' : 
                        'Employees'
                      }
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={addRoleBasedConditionalSection}
                style={{
                  padding: '15px 30px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                👤 Add New Role Condition Rule
              </button>
              {roleBasedConditionalSections.length === 0 && (
                <p style={{ marginTop: '15px', color: '#6c757d', fontSize: '14px' }}>
                  💡 <strong>Tip:</strong> Create role-based conditions to show different <strong>sections</strong> to Employees, Team Leads, or Management.<br/>
                  Users will select their role before seeing form questions!
                </p>
              )}
            </div>
          </div>

          {/* Management Lists Section */}
          <div className="card">
            <h3 style={{ marginBottom: '20px', color: '#495057' }}>
              👥 Management Lists (Multiple Round-Robin Evaluations)
            </h3>
            <p style={{ marginBottom: '20px', color: '#6c757d' }}>
              Create multiple lists of people to be evaluated, each with their own dedicated sections. 
              This allows you to have different evaluation groups (e.g., "Senior Management", "Team Leads", "Department Heads") 
              with different sets of questions.
            </p>

            {managementLists.map((list, listIndex) => (
              <div key={list.id || listIndex} style={{
                border: '2px solid #007bff',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                backgroundColor: '#f8f9ff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0', color: '#007bff' }}>
                    👥 Management List {listIndex + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeManagementList(listIndex)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                      List Name:
                    </label>
                    <input
                      type="text"
                      value={list.list_name || ''}
                      onChange={(e) => updateManagementList(listIndex, 'list_name', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                      placeholder="e.g., Senior Management, Team Leads"
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                      Description (Optional):
                    </label>
                    <input
                      type="text"
                      value={list.list_description || ''}
                      onChange={(e) => updateManagementList(listIndex, 'list_description', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                      placeholder="e.g., Evaluation of senior leadership team"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                    📋 List of People to Evaluate:
                  </label>
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6'
                  }}>
                    <textarea
                      value={list.management_names || ''}
                      onChange={(e) => updateManagementList(listIndex, 'management_names', e.target.value)}
                      placeholder={`Enter the list of people to be evaluated, one per line:\n\n1. John Smith\n2. Jane Doe\n3. Mike Johnson\n\nOr simply:\nJohn Smith\nJane Doe\nMike Johnson`}
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '12px',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                      rows={6}
                    />
                    <div style={{ 
                      marginTop: '10px', 
                      fontSize: '13px', 
                      color: '#6c757d',
                      backgroundColor: '#e9ecef',
                      padding: '8px',
                      borderRadius: '4px'
                    }}>
                      💡 <strong>Instructions:</strong> Enter the names of people who will be evaluated in this round-robin assessment. 
                      Each person will be evaluated for all questions in the selected sections.
                      <br/><strong>Format:</strong> One name per line (numbering is optional).
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                    Select sections for "{list.list_name || `Management List ${listIndex + 1}`}":
                  </label>
                  <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: '#fff',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {sections.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        {sections.map((section) => (
                          <label key={section.id} style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>
                            <input
                              type="checkbox"
                              checked={(list.section_ids || []).includes(section.id)}
                              onChange={(e) => {
                                const currentIds = list.section_ids || [];
                                const newIds = e.target.checked
                                  ? [...currentIds, section.id]
                                  : currentIds.filter(id => id !== section.id);
                                updateManagementListSectionIds(listIndex, newIds);
                              }}
                              style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontSize: '14px' }}>
                              📂 {section.name || section.section_name || `Section ${section.id}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#6c757d', margin: '0', textAlign: 'center' }}>
                        📝 Add sections first to set up management lists
                      </p>
                    )}
                  </div>
                  {(list.section_ids || []).length > 0 && (
                    <p style={{ fontSize: '12px', color: '#28a745', marginTop: '8px' }}>
                      ✅ {(list.section_ids || []).length} section(s) selected for this management list
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={addManagementList}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                👥 Add New Management List
              </button>
              {managementLists.length === 0 && (
                <p style={{ marginTop: '15px', color: '#6c757d', fontSize: '14px' }}>
                  💡 <strong>Tip:</strong> Create management lists to set up round-robin evaluations for different groups of people.<br/>
                  Each list can have its own set of questions and sections!
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginRight: '10px' }}
            >
              {loading 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? 'Update Form' : 'Create Form')
              }
            </button>
            <Link to="/admin/dashboard" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

// ScaleOrderEditor Component for Superadmin
const ScaleOrderEditor = ({ question, onUpdateScaleOrder }) => {
  const [scaleOrder, setScaleOrder] = useState(question.scaleOrder);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdateScaleOrder(question.id, scaleOrder);
    setIsEditing(false);
  };

  const handleReset = () => {
    setScaleOrder([1, 2, 3, 4, 5]);
  };

  // Quick sort functions
  const handleSequentialSort = () => {
    setScaleOrder([1, 2, 3, 4, 5]);
  };

  const handleReverseSort = () => {
    setScaleOrder([5, 4, 3, 2, 1]);
  };

  const moveItem = (fromIndex, toIndex) => {
    const newOrder = [...scaleOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    setScaleOrder(newOrder);
  };

  return (
    <div style={{ 
      backgroundColor: '#ffffff', 
      border: '1px solid #e5e7eb', 
      borderRadius: '6px', 
      padding: '15px', 
      marginBottom: '15px' 
    }}>
      {/* Enhanced Question Display */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#374151' }}>
          Question {question.questionOrder}: {question.questionTextEn}
        </h4>
        {question.questionTextAr && (
          <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontSize: '14px' }}>
            Arabic: {question.questionTextAr}
          </p>
        )}
        
        {/* Left and Right Statements Display */}
        {(question.leftStatement || question.rightStatement) && (
          <div style={{ 
            backgroundColor: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: '4px', 
            padding: '10px',
            marginTop: '8px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
              Assessment Scale Endpoints:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
              {question.leftStatement && (
                <div style={{ flex: '1' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Left (1): 
                  </span>
                  <span style={{ fontSize: '14px', color: '#334155' }}>
                    {question.leftStatement}
                  </span>
                  {question.leftStatementAr && (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                      Arabic: {question.leftStatementAr}
                    </div>
                  )}
                </div>
              )}
              {question.rightStatement && (
                <div style={{ flex: '1', textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Right (5): 
                  </span>
                  <span style={{ fontSize: '14px', color: '#334155' }}>
                    {question.rightStatement}
                  </span>
                  {question.rightStatementAr && (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                      Arabic: {question.rightStatementAr}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Current Scale Order Display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <strong style={{ color: '#374151' }}>Current Scale Order:</strong>
        <div style={{ display: 'flex', gap: '5px' }}>
          {(scaleOrder || []).map((rating, index) => (
            <span
              key={index}
              style={{
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '4px 8px',
                fontWeight: 'bold',
                color: '#374151'
              }}
            >
              {rating}
            </span>
          ))}
        </div>
      </div>

      {!isEditing ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="btn btn-sm btn-outline-primary"
          >
            Edit Order
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-sm btn-outline-secondary"
          >
            Reset to Default (1,2,3,4,5)
          </button>
        </div>
      ) : (
        <div>
          {/* Quick Sort Buttons */}
          <div style={{ 
            marginBottom: '15px', 
            padding: '12px', 
            backgroundColor: '#fef3c7', 
            borderRadius: '6px',
            border: '1px solid #f59e0b'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#92400e', fontWeight: '600' }}>
              ⚡ Quick Sort Options:
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSequentialSort}
                className="btn btn-sm btn-outline-success"
                style={{ fontWeight: '600' }}
              >
                📈 Sequential (1→2→3→4→5)
              </button>
              <button
                type="button"
                onClick={handleReverseSort}
                className="btn btn-sm btn-outline-warning"
                style={{ fontWeight: '600' }}
              >
                📉 Reverse (5→4→3→2→1)
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#92400e' }}>
              Use these buttons for quick reordering, then fine-tune with drag or arrow buttons below.
            </p>
          </div>

          {/* Manual Drag/Arrow Controls */}
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#6b7280' }}>
              Drag to reorder or use buttons:
            </p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {(scaleOrder || []).map((rating, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px'
                  }}
                >
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{rating}</span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => index > 0 && moveItem(index, index - 1)}
                      disabled={index === 0}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.5 : 1,
                        fontSize: '12px'
                      }}
                      title="Move Left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => index < scaleOrder.length - 1 && moveItem(index, index + 1)}
                      disabled={index === scaleOrder.length - 1}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: index === scaleOrder.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === scaleOrder.length - 1 ? 0.5 : 1,
                        fontSize: '12px'
                      }}
                      title="Move Right"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-sm btn-success"
            >
              Save Order
            </button>
            <button
              type="button"
              onClick={() => {
                setScaleOrder(question.scaleOrder);
                setIsEditing(false);
              }}
              className="btn btn-sm btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormBuilder;