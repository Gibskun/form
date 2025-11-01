import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formAPI } from '../utils/api';

const FormFiller = () => {
  const { uniqueLink } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState({
    respondent_name: '',
    respondent_email: ''
  });
  const [responses, setResponses] = useState({});
  const [showQuestions, setShowQuestions] = useState(false);
  const [conditionalQuestions, setConditionalQuestions] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);


  useEffect(() => {
    fetchForm();
  }, [uniqueLink]);

  const fetchForm = async () => {
    try {
      const response = await formAPI.getForm(uniqueLink);
      setForm(response.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Form not found');
    } finally {
      setLoading(false);
    }
  };

  const handleUserInfoSubmit = async (e) => {
    e.preventDefault();
    if (!userInfo.respondent_name.trim() || !userInfo.respondent_email.trim()) {
      setError('Please fill in both name and email');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userInfo.respondent_email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setShowQuestions(true);
  };

  const handleYearChange = async (year) => {
    setSelectedYear(year);
    setResponses({ ...responses, year_selection: year });

    // Fetch conditional questions based on selected year
    if (form.conditional_questions && form.conditional_questions.length > 0) {
      try {
        const response = await formAPI.getConditionalQuestions(uniqueLink, year);
        setConditionalQuestions(response.data);
      } catch (error) {
        console.error('Failed to fetch conditional questions:', error);
        setConditionalQuestions([]);
      }
    }
  };

  const handleResponseChange = (questionId, value, questionType) => {
    setResponses({
      ...responses,
      [questionId]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Validate required questions
      const allQuestions = [...form.questions, ...conditionalQuestions];
      const requiredQuestions = allQuestions.filter(q => q.is_required);
      
      for (const question of requiredQuestions) {
        if (!responses[question.id]) {
          throw new Error(`Please answer: ${question.question_text}`);
        }
      }

      const payload = {
        ...userInfo,
        responses: responses
      };

      await formAPI.submitForm(uniqueLink, payload);
      setSubmitted(true);
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    const value = responses[question.id] || '';

    switch (question.question_type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <input
            type={question.question_type}
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="form-input"
            required={question.is_required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="form-textarea"
            rows="4"
            required={question.is_required}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => {
              const newValue = e.target.value;
              handleResponseChange(question.id, newValue);
              
              // Special handling for year selection
              if (question.question_text.toLowerCase().includes('year') && 
                  question.question_text.toLowerCase().includes('join')) {
                handleYearChange(newValue);
              }
            }}
            className="form-select"
            required={question.is_required}
          >
            <option value="">Select an option</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div>
            {question.options?.map((option, index) => (
              <label key={index} style={{ display: 'block', margin: '8px 0' }}>
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                {option.text}
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div>
            {question.options?.map((option, index) => (
              <label key={index} style={{ display: 'block', margin: '8px 0' }}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={Array.isArray(value) ? value.includes(option.value) : false}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value);
                    handleResponseChange(question.id, newValues);
                  }}
                  style={{ marginRight: '8px' }}
                />
                {option.text}
              </label>
            ))}
          </div>
        );

      case 'assessment':
        return (
          <div>
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              {/* Main horizontal layout container */}
              <div className="assessment-container">
                {/* Left Statement */}
                <div className="assessment-statement assessment-statement-left">
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#495057',
                    marginBottom: '8px'
                  }}>
                    Left Statement (1-2):
                  </div>
                  <div style={{ 
                    fontSize: '15px',
                    lineHeight: '1.4',
                    color: '#343a40',
                    marginBottom: '5px'
                  }}>
                    {question.left_statement}
                  </div>
                  {question.left_statement_id && (
                    <div style={{ 
                      fontSize: '15px',
                      lineHeight: '1.4',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      {question.left_statement_id}
                    </div>
                  )}
                </div>

                {/* Rating Scale */}
                <div className="assessment-rating-container">
                  {[1, 2, 3, 4].map(rating => (
                    <div key={rating} className="assessment-rating-item">
                      <input
                        type="radio"
                        id={`${question.id}_${rating}`}
                        name={`assessment_${question.id}`}
                        value={rating}
                        checked={parseInt(value) === rating}
                        onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
                        className="assessment-rating-input"
                      />
                      <label 
                        htmlFor={`${question.id}_${rating}`}
                        className="assessment-rating-label"
                      >
                        {rating}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Right Statement */}
                <div className="assessment-statement assessment-statement-right">
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#495057',
                    marginBottom: '8px'
                  }}>
                    Right Statement (3-4):
                  </div>
                  <div style={{ 
                    fontSize: '15px',
                    lineHeight: '1.4',
                    color: '#343a40',
                    marginBottom: '5px'
                  }}>
                    {question.right_statement}
                  </div>
                  {question.right_statement_id && (
                    <div style={{ 
                      fontSize: '15px',
                      lineHeight: '1.4',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      {question.right_statement_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Helper text */}
              <div style={{ 
                marginTop: '15px', 
                textAlign: 'center',
                fontSize: '13px',
                color: '#6c757d',
                fontStyle: 'italic'
              }}>
                Select 1-2 if you lean towards the left statement, or 3-4 if you lean towards the right statement
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unsupported question type</div>;
    }
  };

  const getQuestionsToShow = () => {
    if (!form) return [];
    
    // If no year selected or no conditional questions, show all questions
    if (!selectedYear || form.conditional_questions.length === 0) {
      return form.questions;
    }

    // Show base questions + conditional questions
    return [...form.questions, ...conditionalQuestions];
  };

  if (loading) return <div className="loading">Loading form...</div>;
  if (error && !form) return <div className="container"><div className="error">{error}</div></div>;

  if (submitted) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', maxWidth: '600px', margin: '100px auto' }}>
          <h2 style={{ color: '#28a745' }}>✅ Form Submitted Successfully!</h2>
          <p>Thank you for your response. Your submission has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '800px', margin: '20px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          {form.form_type === 'assessment' && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: '500' }}>
                {form.title}
              </p>
              <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: '500', color: '#666' }}>
                {form.description || 'Assessment Form'}
              </p>
            </div>
          )}
          
          {form.form_type !== 'assessment' && (
            <>
              <h1>{form.title}</h1>
              {form.description && (
                <p style={{ color: '#666', marginTop: '10px' }}>{form.description}</p>
              )}
            </>
          )}
        </div>

        {!showQuestions ? (
          <form onSubmit={handleUserInfoSubmit}>
            <h3>Before you start, please provide your information:</h3>
            {error && <div className="error">{error}</div>}
            
            <div className="form-group">
              <label className="form-label">Full Name:</label>
              <input
                type="text"
                value={userInfo.respondent_name}
                onChange={(e) => setUserInfo({ ...userInfo, respondent_name: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email:</label>
              <input
                type="email"
                value={userInfo.respondent_email}
                onChange={(e) => setUserInfo({ ...userInfo, respondent_email: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Continue to Form
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error">{error}</div>}
            
            {getQuestionsToShow().map((question, index) => (
              <div key={question.id} className="form-section">
                <div className="form-group">
                  <label className="form-label">
                    <span style={{ marginRight: '5px' }}>{index + 1}.</span>
                    {form.form_type === 'assessment' ? (
                      <div>
                        <div style={{ marginBottom: '3px' }}>
                          {question.question_text}
                        </div>
                        {question.question_text_id && (
                          <div style={{ fontSize: '14px', color: '#6c757d', fontStyle: 'italic' }}>
                            {question.question_text_id}
                          </div>
                        )}
                      </div>
                    ) : (
                      question.question_text
                    )}
                    {question.is_required && (
                      <span style={{ color: '#dc3545', marginLeft: '5px' }}>*</span>
                    )}
                  </label>
                  
                  {renderQuestion(question)}
                </div>
              </div>
            ))}

            {/* Show conditional questions notice if year-based logic exists */}
            {form.conditional_questions.length > 0 && !selectedYear && (
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffeaa7', 
                borderRadius: '5px',
                marginBottom: '20px'
              }}>
                <strong>Note:</strong> Additional questions may appear based on your year selection.
              </div>
            )}

            <button
              type="submit"
              className="btn btn-success"
              disabled={submitting}
              style={{ marginTop: '20px' }}
            >
              {submitting ? 'Submitting...' : 'Submit Form'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FormFiller;