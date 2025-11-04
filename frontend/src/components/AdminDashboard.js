import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../utils/api';
import CopyLinkButton from './CopyLinkButton';
import SuperadminPasswordChange from './SuperadminPasswordChange';

const AdminDashboard = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }

    // Check if user is superadmin
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      try {
        const user = JSON.parse(adminUser);
        setIsSuperAdmin(user.role === 'super_admin');
      } catch (error) {
        console.error('Error parsing admin user:', error);
      }
    }

    fetchForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchForms = async () => {
    try {
      const response = await adminAPI.getForms();
      setForms(response.data);
    } catch (error) {
      setError('Failed to fetch forms');
      if (error.response?.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin');
  };

  const handleDeleteForm = async (formId) => {
    if (window.confirm('Are you sure you want to delete this form? All responses will be lost.')) {
      try {
        await adminAPI.deleteForm(formId);
        await fetchForms(); // Refresh the list
      } catch (error) {
        setError('Failed to delete form');
      }
    }
  };

  const handleExportResponses = async (formId, formTitle) => {
    try {
      const response = await adminAPI.exportFormResponses(formId);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${formTitle.replace(/[^a-zA-Z0-9]/g, '_')}_responses.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export responses');
    }
  };



  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <header className="header">
        <nav className="nav">
          <h1>
            Form System - Admin Dashboard
            {isSuperAdmin && (
              <span style={{
                fontSize: '14px',
                backgroundColor: '#e74c3c',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                marginLeft: '10px'
              }}>
                SUPERADMIN
              </span>
            )}
          </h1>
          <div className="nav-links">
            <Link to="/admin/create-form" className="nav-link">Create New Form</Link>
            {isSuperAdmin && (
              <button 
                onClick={() => setShowPasswordChange(true)} 
                className="btn"
                style={{ 
                  backgroundColor: '#e74c3c', 
                  color: 'white',
                  border: '1px solid #e74c3c'
                }}
              >
                🔐 Change Password
              </button>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
          </div>
        </nav>
      </header>

      <div className="container">
        <div className="card">
          <h2>All Forms</h2>
          {error && <div className="error">{error}</div>}
          
          {forms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>No forms created yet.</p>
              <Link to="/admin/create-form" className="btn btn-primary">Create Your First Form</Link>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Responses</th>
                  <th>Created At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form) => (
                  <tr key={form.id}>
                    <td>
                      <strong>{form.title}</strong>
                      {form.description && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {form.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: form.form_type === 'assessment' ? '#e3f2fd' : '#f3e5f5',
                        color: form.form_type === 'assessment' ? '#1976d2' : '#7b1fa2'
                      }}>
                        {form.form_type === 'assessment' ? 'Assessment' : 'Standard'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 'bold' }}>{form.response_count}</span>
                      {form.response_count > 0 && (
                        <div>
                          <Link
                            to={`/admin/forms/${form.id}/responses`}
                            style={{ fontSize: '12px', color: '#007bff' }}
                          >
                            View Details
                          </Link>
                        </div>
                      )}
                    </td>
                    <td>{new Date(form.created_at).toLocaleDateString()}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: form.is_active ? '#d4edda' : '#f8d7da',
                        color: form.is_active ? '#155724' : '#721c24'
                      }}>
                        {form.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link
                          to={`/admin/edit-form/${form.id}`}
                          className="btn btn-primary"
                          style={{ fontSize: '12px', padding: '5px 10px', textDecoration: 'none' }}
                        >
                          Edit
                        </Link>
                        <CopyLinkButton 
                          uniqueLink={form.unique_link}
                          formTitle={form.title}
                        />
                        {form.response_count > 0 && (
                          <button
                            onClick={() => handleExportResponses(form.id, form.title)}
                            className="btn btn-success"
                            style={{ fontSize: '12px', padding: '5px 10px' }}
                          >
                            Export Excel
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteForm(form.id)}
                          className="btn btn-danger"
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Delete
                        </button>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                        Link: /form/{form.unique_link}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Superadmin Password Change Modal */}
      {showPasswordChange && (
        <SuperadminPasswordChange
          onClose={() => setShowPasswordChange(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;