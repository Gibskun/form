import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/api/admin/login', credentials),
};

// Admin API
export const adminAPI = {
  getForms: () => api.get('/api/admin/forms'),
  getForm: (formId) => api.get(`/api/admin/forms/${formId}`),
  createForm: (formData) => api.post('/api/admin/forms', formData),
  updateForm: (formId, formData) => api.put(`/api/admin/forms/${formId}`, formData),
  deleteForm: (formId) => api.delete(`/api/admin/forms/${formId}`),
  getFormResponses: (formId) => api.get(`/api/admin/forms/${formId}/responses`),
  exportFormResponses: (formId) => {
    return api.get(`/api/admin/forms/${formId}/export`, {
      responseType: 'blob',
    });
  },
};

// Superadmin API
export const superadminAPI = {
  getAssessmentQuestions: (formId) => api.get(`/api/superadmin/forms/${formId}/assessment-questions`),
  getScaleOrder: (formId, questionId) => api.get(`/api/superadmin/forms/${formId}/questions/${questionId}/scale-order`),
  updateScaleOrder: (formId, questionId, scaleOrder) => 
    api.put(`/api/superadmin/forms/${formId}/questions/${questionId}/scale-order`, { scaleOrder }),
  changePassword: (currentPassword, newPassword) => 
    api.post('/api/superadmin/change-password', { currentPassword, newPassword }),
};

// Public Form API
export const formAPI = {
  getForm: (uniqueLink) => api.get(`/api/form/${uniqueLink}`),
  submitForm: (uniqueLink, data) => api.post(`/api/form/${uniqueLink}/submit`, data),
  getConditionalQuestions: (uniqueLink, selectedYear) => 
    api.post(`/api/form/${uniqueLink}/conditional-questions`, { selectedYear }),
};

export default api;