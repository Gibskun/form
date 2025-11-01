import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../utils/api';

const FormBuilder = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    form_type: 'standard'
  });
  const [questions, setQuestions] = useState([]);
  const [conditionalQuestions, setConditionalQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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

      await adminAPI.createForm(payload);
      navigate('/admin/dashboard');
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Failed to create form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="header">
        <nav className="nav">
          <h1>Create New Form</h1>
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
                <option value="assessment">Assessment/Rating Form (4-point scale)</option>
              </select>
            </div>
          </div>

          <div className="card">
            <h2>Questions</h2>
            {questions.map((question, qIndex) => (
              <div key={question.id} className="question-builder">
                <div className="question-header">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="question-number">{qIndex + 1}</div>
                    <h4>Question {qIndex + 1}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="remove-question"
                    title="Remove Question"
                  >
                    ×
                  </button>
                </div>

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
                      <option value="assessment">Assessment Scale (1-4)</option>
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
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="btn btn-success"
            >
              Add Question
            </button>
          </div>

          {/* Conditional Questions */}
          <div className="card">
            <h2>Year-Based Conditional Questions (Optional)</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Configure which questions to show based on the year selected by users. This is useful for showing different question sets for different years.
            </p>

            {conditionalQuestions.map((cond, cIndex) => (
              <div key={cIndex} className="conditional-section">
                <div className="conditional-header">
                  Condition {cIndex + 1}
                  <button
                    type="button"
                    onClick={() => removeConditionalQuestion(cIndex)}
                    style={{ float: 'right', background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Condition Type:</label>
                  <select
                    value={cond.condition_type}
                    onChange={(e) => updateConditionalQuestion(cIndex, 'condition_type', e.target.value)}
                    className="form-select"
                  >
                    <option value="year_equals">Year equals</option>
                    <option value="year_less_equal">Year less than or equal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Year Value:</label>
                  <input
                    type="text"
                    value={cond.condition_value}
                    onChange={(e) => updateConditionalQuestion(cIndex, 'condition_value', e.target.value)}
                    className="form-input"
                    placeholder="e.g., 2024"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Questions to Show:</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px' }}>
                    {questions.map((q, qIndex) => (
                      <label key={qIndex} style={{ display: 'block', margin: '5px 0' }}>
                        <input
                          type="checkbox"
                          checked={cond.question_ids.includes(qIndex + 1)}
                          onChange={(e) => {
                            const questionId = qIndex + 1;
                            const currentIds = cond.question_ids;
                            const newIds = e.target.checked
                              ? [...currentIds, questionId]
                              : currentIds.filter(id => id !== questionId);
                            updateConditionalQuestionIds(cIndex, newIds);
                          }}
                          style={{ marginRight: '8px' }}
                        />
                        Question {qIndex + 1}: {q.question_text || 'Untitled Question'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addConditionalQuestion}
              className="btn btn-secondary"
            >
              Add Conditional Rule
            </button>
          </div>

          <div className="card">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginRight: '10px' }}
            >
              {loading ? 'Creating...' : 'Create Form'}
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

export default FormBuilder;