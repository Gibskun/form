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
  const [conditionalQuestions, setConditionalQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState(isEditMode);
  const [error, setError] = useState('');
  const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());
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
      
      setQuestions(response.data.questions || []);
      setConditionalQuestions(response.data.conditional_questions || []);
      console.log('📋 Set questions:', response.data.questions?.length || 0);
      console.log('🔀 Set conditional questions:', response.data.conditional_questions?.length || 0);
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

  // Add new question
  const addQuestion = () => {
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
      is_required: false
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
      const questionsData = questions.map((q, index) => ({
        ...q,
        order_number: index + 1,
        options: q.options && q.options.length > 0 ? q.options : null
      }));

      const payload = {
        ...formData,
        questions: questionsData,
        conditionalQuestions: conditionalQuestions
      };

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
      // Reload assessment questions to reflect changes
      loadAssessmentQuestions();
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
                  
                  {assessmentQuestions.length > 0 ? (
                    assessmentQuestions.map(question => (
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
                    onClick={() => setCollapsedQuestions(new Set(questions.map(q => q.id)))}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    📖 Collapse All
                  </button>
                </div>
              )}
            </div>
            {questions.map((question, qIndex) => (
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
                      {question.options.map((option, oIndex) => (
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

            {conditionalQuestions.map((cond, cIndex) => (
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
                            const allIds = questions.map((q, index) => q.id || (index + 1));
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
                      
                      {questions.map((q, qIndex) => {
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
      <div style={{ marginBottom: '10px' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#374151' }}>
          Question {question.questionOrder}: {question.questionTextEn}
        </h4>
        {question.questionTextAr && (
          <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
            Arabic: {question.questionTextAr}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <strong style={{ color: '#374151' }}>Current Scale Order:</strong>
        <div style={{ display: 'flex', gap: '5px' }}>
          {scaleOrder.map((rating, index) => (
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
        <div style={{ display: 'flex', gap: '10px' }}>
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
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#6b7280' }}>
              Drag to reorder or use buttons:
            </p>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {scaleOrder.map((rating, index) => (
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