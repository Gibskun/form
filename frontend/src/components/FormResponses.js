import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../utils/api';

const FormResponses = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [responses, setResponses] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }

    fetchResponses();
  }, [formId, navigate]);

  const fetchResponses = async () => {
    try {
      // Fetch form details first
      const formsResponse = await adminAPI.getForms();
      const currentForm = formsResponse.data.find(f => f.id.toString() === formId);
      setForm(currentForm);

      // Fetch responses
      const responsesResponse = await adminAPI.getFormResponses(formId);
      setResponses(responsesResponse.data);
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
      const response = await adminAPI.exportFormResponses(formId);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${form.title.replace(/[^a-zA-Z0-9]/g, '_')}_responses.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export responses');
    }
  };

  const formatResponseValue = (value) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value?.toString() || 'No answer';
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>All Responses ({responses.length})</h2>
            {responses.length > 0 && (
              <button onClick={handleExport} className="btn btn-success">
                Export to Excel
              </button>
            )}
          </div>
          
          {error && <div className="error">{error}</div>}

          {responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>No responses yet.</p>
              <p style={{ color: '#666' }}>
                Share your form link to start collecting responses.
              </p>
            </div>
          ) : (
            <div>
              {responses.map((response, index) => (
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
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                        </div>
                        <div style={{ fontWeight: '500' }}>
                          {formatResponseValue(value)}
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