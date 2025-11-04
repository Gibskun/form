import React, { useState } from 'react';
import { superadminAPI } from '../utils/api';

const SuperadminPasswordChange = ({ onClose }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from current password');
      setLoading(false);
      return;
    }

    try {
      await superadminAPI.changePassword(formData.currentPassword, formData.newPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ 
              fontSize: '48px', 
              color: '#28a745', 
              marginBottom: '16px' 
            }}>
              ✅
            </div>
            <h3 style={{ color: '#28a745', marginBottom: '8px' }}>
              Password Changed Successfully!
            </h3>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>
              Your password has been updated. This window will close automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid #e74c3c',
          paddingBottom: '10px'
        }}>
          <h3 style={{ margin: 0, color: '#e74c3c' }}>
            🔐 Superadmin: Change Password
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6c757d'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Current Password:</label>
            <input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              className="form-input"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password:</label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className="form-input"
              required
              minLength="6"
              autoComplete="new-password"
            />
            <small style={{ color: '#6c757d', fontSize: '12px' }}>
              Minimum 6 characters required
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password:</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="form-input"
              required
              minLength="6"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="error" style={{ marginBottom: '15px' }}>
              {error}
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'flex-end',
            marginTop: '20px'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ backgroundColor: '#e74c3c', borderColor: '#e74c3c' }}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>

        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '5px',
          fontSize: '13px'
        }}>
          <strong>⚠️ Security Notice:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Use a strong password with a mix of letters, numbers, and symbols</li>
            <li>Don't reuse passwords from other accounts</li>
            <li>You'll need to login again after changing your password</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SuperadminPasswordChange;