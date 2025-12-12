import axios from 'axios';

// API_BASE_URL: 
// - Local: http://localhost:5000/api (from .env.local)
// - Server: /api (from .env.production)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 413) {
      console.error('❌ Request payload too large. Try reducing form complexity or contact support.');
      error.message = 'Form data is too large. Please try reducing the number of questions or complexity and try again.';
    }
    return Promise.reject(error);
  }
);

// Auth API - NO /api prefix (baseURL already includes it)
export const authAPI = {
  login: (credentials) => api.post('/admin/login', credentials),
};

// Admin API
export const adminAPI = {
  getForms: () => api.get('/admin/forms'),
  getForm: (formId) => api.get(`/admin/forms/${formId}`),
  createForm: (formData) => api.post('/admin/forms', formData),
  updateForm: (formId, formData) => api.put(`/admin/forms/${formId}`, formData),
  deleteForm: (formId) => api.delete(`/admin/forms/${formId}`),
  getFormResponses: (formId) => api.get(`/admin/forms/${formId}/responses`),
  exportFormResponses: (formId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.year) params.append('year', filters.year);
    
    const queryString = params.toString();
    const url = queryString ? 
      `/admin/forms/${formId}/export?${queryString}` : 
      `/admin/forms/${formId}/export`;
    
    return api.get(url, {
      responseType: 'blob',
    });
  },
};

// Superadmin API
export const superadminAPI = {
  getAssessmentQuestions: (formId) => api.get(`/superadmin/forms/${formId}/assessment-questions`),
  getScaleOrder: (formId, questionId) => api.get(`/superadmin/forms/${formId}/questions/${questionId}/scale-order`),
  updateScaleOrder: (formId, questionId, scaleOrder) => 
    api.put(`/superadmin/forms/${formId}/questions/${questionId}/scale-order`, { scaleOrder }),
  changePassword: (currentPassword, newPassword) => 
    api.post('/superadmin/change-password', { currentPassword, newPassword }),
};

// Public Form API
export const formAPI = {
  getForm: (uniqueLink) => api.get(`/form/${uniqueLink}`),
  submitForm: (uniqueLink, data) => api.post(`/form/${uniqueLink}/submit`, data),
  getConditionalQuestions: (uniqueLink, selectedYear) => 
    api.post(`/form/${uniqueLink}/conditional-questions`, { selectedYear }),
  getConditionalSections: (uniqueLink, selectedYear) => 
    api.post(`/form/${uniqueLink}/conditional-sections`, { selectedYear }),
  getRoleBasedSections: (uniqueLink, selectedRole) => 
    api.post(`/form/${uniqueLink}/role-based-sections`, { selectedRole }),
  getCombinedConditionalSections: (uniqueLink, selectedYear, selectedRole) => 
    api.post(`/form/${uniqueLink}/combined-conditional-sections`, { selectedYear, selectedRole }),
};

export default api;