import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../utils/api';

const FormResponses = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [responses, setResponses] = useState([]);
  const [filteredResponses, setFilteredResponses] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }

    fetchResponses();
  }, [formId, navigate]);

  // Filter responses when filter criteria change
  useEffect(() => {
    let filtered = responses;
    
    if (selectedRole) {
      filtered = filtered.filter(response => {
        const responseData = response.responses;
        return Object.keys(responseData).some(key => {
          if (key.toLowerCase().includes('role') || key === 'selected_role') {
            return responseData[key] === selectedRole;
          }
          return false;
        });
      });
    }
    
    if (selectedYear) {
      filtered = filtered.filter(response => {
        const responseData = response.responses;
        return Object.keys(responseData).some(key => {
          if (key.toLowerCase().includes('year') || key === 'year_selection' || key === 'selected_year') {
            return responseData[key] && responseData[key].toString() === selectedYear;
          }
          return false;
        });
      });
    }
    
    setFilteredResponses(filtered);
  }, [responses, selectedRole, selectedYear]);

  const clearFilters = () => {
    setSelectedRole('');
    setSelectedYear('');
  };

  const fetchResponses = async () => {
    try {
      // Fetch form details first
      const formsResponse = await adminAPI.getForms();
      const currentForm = formsResponse.data.find(f => f.id.toString() === formId);
      setForm(currentForm);

      // Fetch responses
      const responsesResponse = await adminAPI.getFormResponses(formId);
      const responsesData = responsesResponse.data;
      setResponses(responsesData);
      setFilteredResponses(responsesData);
      
      // Extract available filter options from responses
      const roles = new Set();
      const years = new Set();
      
      responsesData.forEach(response => {
        const responseData = response.responses;
        
        // Extract role information (check for common role keys)
        Object.keys(responseData).forEach(key => {
          if (key.toLowerCase().includes('role') || key === 'selected_role') {
            const roleValue = responseData[key];
            if (roleValue && typeof roleValue === 'string') {
              roles.add(roleValue);
            }
          }
        });
        
        // Extract year information
        Object.keys(responseData).forEach(key => {
          if (key.toLowerCase().includes('year') || key === 'year_selection' || key === 'selected_year') {
            const yearValue = responseData[key];
            if (yearValue && (typeof yearValue === 'string' || typeof yearValue === 'number')) {
              years.add(yearValue.toString());
            }
          }
        });
      });
      
      setAvailableRoles(Array.from(roles).sort());
      setAvailableYears(Array.from(years).sort());
      
    } catch (error) {
      setError('Failed to fetch responses');
      if (error.response?.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (selectedRole) params.append('role', selectedRole);
      if (selectedYear) params.append('year', selectedYear);
      
      const queryString = params.toString();
      const exportUrl = queryString ? 
        `/api/admin/forms/${formId}/export?${queryString}` : 
        `/api/admin/forms/${formId}/export`;
      
      const response = await adminAPI.exportFormResponses(formId, { role: selectedRole, year: selectedYear });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Add filter info to filename
      let filename = `${form.title.replace(/[^a-zA-Z0-9]/g, '_')}_responses`;
      if (selectedRole || selectedYear) {
        const filters = [];
        if (selectedRole) filters.push(`role_${selectedRole}`);
        if (selectedYear) filters.push(`year_${selectedYear}`);
        filename += `_filtered_${filters.join('_')}`;
      }
      filename += '.xlsx';
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export responses');
    }
  };

  const formatResponseValue = (value, questionId, questions) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    // Handle management response structure (nested objects like {"gibral_0": {"142": "answer"}})
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check if this looks like a management response structure
      const entries = Object.entries(value);
      if (entries.length > 0) {
        // Check if the first level keys contain person names and section numbers (person_section format)
        const isManagementStructure = entries.some(([key, val]) => 
          typeof key === 'string' && 
          key.includes('_') && 
          typeof val === 'object' && 
          val !== null
        );
        
        if (isManagementStructure) {
          // Format management responses in a readable way
          return entries.map(([personSection, answers]) => {
            const [personName, sectionNum] = personSection.split('_');
            const sectionNumber = parseInt(sectionNum) + 1; // Convert 0-based to 1-based
            
            if (typeof answers === 'object' && answers !== null) {
              const answerEntries = Object.entries(answers);
              return answerEntries.map(([qId, answer]) => {
                const questionText = getQuestionText(qId, questions);
                return `• ${personName} (Section ${sectionNumber}): ${questionText} → ${answer}`;
              }).join('\n');
            }
            return `• ${personName} (Section ${sectionNumber}): ${JSON.stringify(answers)}`;
          }).join('\n\n');
        }
      }
      
      // Fallback for other object types
      return JSON.stringify(value, null, 2);
    }
    
    // Special formatting for assessment questions
    if (questions) {
      const question = questions.find(q => q.id.toString() === questionId.toString());
      if (question && question.question_type === 'assessment') {
        const rating = parseInt(value);
        if (rating >= 1 && rating <= 5) {
          return `${rating} (${getAssessmentDescription(rating, question)})`;
        }
      }
    }
    
    return value?.toString() || 'No answer';
  };

  const getAssessmentDescription = (rating, question) => {
    // Provide context for assessment ratings
    switch(rating) {
      case 1:
      case 2:
        return question.left_statement || 'Disagree/Low';
      case 3:
        return 'Neutral/Moderate';
      case 4:
      case 5:
        return question.right_statement || 'Agree/High';
      default:
        return '';
    }
  };

  const getQuestionText = (questionId, questions) => {
    if (!questions) return questionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const question = questions.find(q => q.id.toString() === questionId.toString());
    if (!question) {
      // Handle special keys like year_selection
      if (questionId === 'year_selection') {
        return 'Year Selection';
      }
      return questionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return question.question_text || `Question ${question.order_number}`;
  };

  if (loading) return <div className="loading">Loading responses...</div>;

  return (
    <div>
      <header className="header">
        <nav className="nav">
          <h1>Form Responses: {form?.title}</h1>
          <div className="nav-links">
            <Link to="/admin/dashboard" className="nav-link">Back to Dashboard</Link>
          </div>
        </nav>
      </header>

      <div className="container">
        <div className="card">
          {/* Filter Controls */}
          {responses.length > 0 && (
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '5px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ marginBottom: '15px', color: '#495057' }}>🔍 Filter Responses</h4>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Role Filter */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                    Role:
                  </label>
                  <select 
                    value={selectedRole} 
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      fontSize: '14px',
                      minWidth: '120px'
                    }}
                  >
                    <option value="">All Roles</option>
                    {availableRoles.map(role => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year Filter */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                    Year of Entry:
                  </label>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      fontSize: '14px',
                      minWidth: '120px'
                    }}
                  >
                    <option value="">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                {(selectedRole || selectedYear) && (
                  <div style={{ marginTop: '20px' }}>
                    <button 
                      onClick={clearFilters}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                )}

                {/* Active Filter Display */}
                {(selectedRole || selectedYear) && (
                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#e3f2fd', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#1976d2',
                    marginTop: '20px'
                  }}>
                    <strong>Active Filters:</strong>
                    {selectedRole && ` Role: ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1).replace('_', ' ')}`}
                    {selectedRole && selectedYear && ` | `}
                    {selectedYear && ` Year: ${selectedYear}`}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>
              {(selectedRole || selectedYear) ? 'Filtered' : 'All'} Responses 
              ({filteredResponses.length}{responses.length !== filteredResponses.length ? ` of ${responses.length}` : ''})
            </h2>
            {filteredResponses.length > 0 && (
              <button onClick={handleExport} className="btn btn-success">
                Export to Excel {(selectedRole || selectedYear) && '(Filtered)'}
              </button>
            )}
          </div>
          
          {error && <div className="error">{error}</div>}

          {filteredResponses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              {responses.length === 0 ? (
                <>
                  <p>No responses yet.</p>
                  <p style={{ color: '#666' }}>
                    Share your form link to start collecting responses.
                  </p>
                </>
              ) : (
                <>
                  <p>No responses match the selected filters.</p>
                  <p style={{ color: '#666' }}>
                    Try adjusting your filter criteria or clear filters to see all responses.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div>
              {filteredResponses.map((response, index) => (
                <div key={response.id} className="card" style={{ marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #ddd'
                  }}>
                    <h4>Response #{index + 1}</h4>
                    <small style={{ color: '#666' }}>
                      Submitted: {new Date(response.submitted_at).toLocaleString()}
                    </small>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <p><strong>Name:</strong> {response.respondent_name}</p>
                    <p><strong>Email:</strong> {response.respondent_email}</p>
                  </div>

                  <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px' }}>
                    <h5>Answers:</h5>
                    {Object.entries(response.responses).map(([key, value]) => (
                      <div key={key} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                          {getQuestionText(key, response.questions)}:
                        </div>
                        <div style={{ fontWeight: '500' }}>
                          {formatResponseValue(value, key, response.questions)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormResponses;