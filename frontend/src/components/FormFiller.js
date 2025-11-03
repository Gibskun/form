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
  const [currentStep, setCurrentStep] = useState(1); // 1: year question, 2: conditional questions
  const [loadingQuestions, setLoadingQuestions] = useState(false);


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
    if (form.conditional_questions && form.conditional_questions.length > 0 && year) {
      try {
        setLoadingQuestions(true);
        setError(''); // Clear any previous errors
        const response = await formAPI.getConditionalQuestions(uniqueLink, year);
        setConditionalQuestions(response.data || []);
        
        // Show success message if conditional questions were found
        if (response.data && response.data.length > 0) {
          console.log(`✓ Loaded ${response.data.length} conditional questions for year ${year}`);
        }
      } catch (error) {
        console.error('Failed to fetch conditional questions:', error);
        setConditionalQuestions([]);
        // Don't show error to user unless it's critical, as this is optional functionality
      } finally {
        setLoadingQuestions(false);
      }
    } else if (!year) {
      // Clear conditional questions if no year selected
      setConditionalQuestions([]);
      setLoadingQuestions(false);
    }
  };

  const handleYearNext = () => {
    if (!selectedYear) {
      setError('Please select your year of entry first');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleBackToYear = () => {
    setCurrentStep(1);
    setError('');
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
      // Validate year selection (always required now)
      if (!selectedYear) {
        throw new Error('Please select your year of entry before submitting the form');
      }

      // Validate required questions — only validate visible questions (those shown to the user)
      const visibleQuestions = getQuestionsToShow();
      const requiredQuestions = visibleQuestions.filter(q => q.is_required);

      for (const question of requiredQuestions) {
        const val = responses[question.id];

        // Handle checkbox (array) specially
        if (question.question_type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            throw new Error(`Please answer: ${question.question_text}`);
          }
          continue;
        }

        // For other types, treat null/undefined/empty-string as unanswered
        if (val === null || val === undefined || val === '') {
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
              
              // Enhanced year detection for conditional questions
              const questionText = question.question_text.toLowerCase();
              const yearKeywords = [
                'year',
                'joined',
                'entry',
                'started',
                'admission',
                'enrolled',
                'began'
              ];
              
              const hasYearKeyword = yearKeywords.some(keyword => 
                questionText.includes(keyword)
              );
              
              if (hasYearKeyword && /^\d{4}$/.test(newValue)) {
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
                  onChange={(e) => {
                    const newValue = e.target.value;
                    handleResponseChange(question.id, newValue);
                    
                    // Enhanced year detection for radio buttons
                    const questionText = question.question_text.toLowerCase();
                    const yearKeywords = [
                      'year',
                      'joined',
                      'entry',
                      'started',
                      'admission',
                      'enrolled',
                      'began'
                    ];
                    
                    const hasYearKeyword = yearKeywords.some(keyword => 
                      questionText.includes(keyword)
                    );
                    
                    if (hasYearKeyword && /^\d{4}$/.test(newValue)) {
                      handleYearChange(newValue);
                    }
                  }}
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
    
    // If no year selected, don't show any questions
    if (!selectedYear) {
      return [];
    }
    
    // If no conditional questions configured, show all base questions
    if (!form.conditional_questions || form.conditional_questions.length === 0) {
      return form.questions;
    }

    // If conditional questions exist, show only the conditional questions for the selected year
    // The backend already filtered the questions based on year conditions
    return conditionalQuestions;
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
          <>
            {error && <div className="error">{error}</div>}
            
            {/* Step Navigation Progress Bar */}
            <div style={{ 
              marginBottom: '25px', 
              padding: '20px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '10px',
              border: '1px solid #e9ecef',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: '0', color: '#495057' }}>Form Progress</h4>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#6c757d' }}>
                  Step {currentStep} of 2
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: currentStep === 1 ? '#007bff' : '#28a745',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      backgroundColor: currentStep === 1 ? '#007bff' : '#28a745',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '10px',
                      fontSize: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s ease'
                    }}>
                      {currentStep === 1 ? '1' : '✓'}
                    </div>
                    <span>Year Selection</span>
                  </div>
                  
                  <div style={{ 
                    width: '60px', 
                    height: '3px', 
                    backgroundColor: currentStep === 2 ? '#28a745' : '#dee2e6',
                    margin: '0 20px',
                    borderRadius: '2px',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {currentStep === 2 && (
                      <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        height: '100%',
                        width: '100%',
                        backgroundColor: '#28a745',
                        borderRadius: '2px'
                      }}></div>
                    )}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: currentStep === 2 ? '#007bff' : '#6c757d',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '35px',
                      height: '35px',
                      borderRadius: '50%',
                      backgroundColor: currentStep === 2 ? '#007bff' : '#dee2e6',
                      color: currentStep === 2 ? 'white' : '#6c757d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '10px',
                      fontSize: '16px',
                      boxShadow: currentStep === 2 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      2
                    </div>
                    <span>Form Questions</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 1: Year Selection */}
            {currentStep === 1 && (
              <div>
                <div className="form-section">
                  <div className="form-group">
                    <label className="form-label">
                      <span style={{ marginRight: '5px' }}>1.</span>
                      What year did you enter/join?
                      <span style={{ color: '#dc3545', marginLeft: '5px' }}>*</span>
                    </label>
                    
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">-- Select Year --</option>
                      {(() => {
                        const currentYear = new Date().getFullYear();
                        const years = [];
                        for (let year = currentYear; year >= currentYear - 50; year--) {
                          years.push(year);
                        }
                        return years.map(year => (
                          <option key={year} value={year.toString()}>
                            {year}
                          </option>
                        ));
                      })()}
                    </select>
                    
                    {selectedYear && (
                      <div style={{ 
                        marginTop: '15px', 
                        padding: '15px', 
                        backgroundColor: loadingQuestions ? '#fff3cd' : '#d4edda', 
                        borderRadius: '8px',
                        fontSize: '15px',
                        color: loadingQuestions ? '#856404' : '#155724',
                        border: `1px solid ${loadingQuestions ? '#ffeaa7' : '#c3e6cb'}`
                      }}>
                        {loadingQuestions ? (
                          <>
                            <strong>🔄 Loading questions for year {selectedYear}...</strong><br/>
                            <span style={{ fontSize: '14px' }}>
                              Please wait while we prepare your personalized questions.
                            </span>
                          </>
                        ) : (
                          <>
                            <strong>✓ Year {selectedYear} selected!</strong><br/>
                            <span style={{ fontSize: '14px' }}>
                              {conditionalQuestions.length > 0 
                                ? `${conditionalQuestions.length} questions will be shown based on your entry year.`
                                : 'Standard form questions will be displayed.'
                              }
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ marginTop: '25px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleYearNext}
                    disabled={!selectedYear || loadingQuestions}
                    className="btn btn-primary"
                    style={{
                      padding: '12px 30px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      opacity: (!selectedYear || loadingQuestions) ? 0.6 : 1,
                      cursor: (!selectedYear || loadingQuestions) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {!selectedYear ? 'Please Select Year First' : 
                     loadingQuestions ? '🔄 Loading Questions...' :
                     `Next: Continue to Questions →`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Form Questions */}
            {currentStep === 2 && (
              <form onSubmit={handleSubmit}>
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#e3f2fd', 
                  borderRadius: '8px',
                  border: '1px solid #bbdefb'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>
                    📋 Form Questions for Year {selectedYear}
                  </h4>
                  <p style={{ margin: '0', fontSize: '14px', color: '#424242' }}>
                    Answer the questions below. You can go back to change your year selection if needed.
                  </p>
                </div>

                {/* Back Button */}
                <div style={{ marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={handleBackToYear}
                    className="btn btn-outline-secondary"
                    style={{ fontSize: '14px' }}
                  >
                    ← Back to Year Selection
                  </button>
                </div>

                {/* Questions based on selected year */}
                {getQuestionsToShow().length > 0 ? (
                  getQuestionsToShow().map((question, index) => (
                    <div key={question.id} className="form-section">
                      <div className="form-group">
                        <label className="form-label">
                          <span style={{ marginRight: '5px' }}>{index + 2}.</span>
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
                  ))
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '8px',
                    border: '1px solid #ffeaa7',
                    color: '#856404'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                    <h4 style={{ color: '#856404', marginBottom: '15px' }}>
                      No additional questions for year {selectedYear}
                    </h4>
                    <p style={{ marginBottom: '10px' }}>
                      Based on your entry year ({selectedYear}), there are no specific conditional questions to display.
                    </p>
                    <p style={{ marginBottom: '20px', fontSize: '14px' }}>
                      This means you have completed all required information. You can submit the form now 
                      or go back to change your year selection if needed.
                    </p>
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#fff',
                      borderRadius: '5px',
                      border: '1px solid #ffeaa7',
                      fontSize: '14px'
                    }}>
                      💡 <strong>Note:</strong> The administrator has configured this form to show different questions 
                      based on entry years, but no questions match your selected year.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={submitting}
                    style={{ 
                      padding: '12px 30px',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Form'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FormFiller;