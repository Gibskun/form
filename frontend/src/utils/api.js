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
  exportFormResponses: (formId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.year) params.append('year', filters.year);
    
    const queryString = params.toString();
    const url = queryString ? 
      `/api/admin/forms/${formId}/export?${queryString}` : 
      `/api/admin/forms/${formId}/export`;
    
    return api.get(url, {
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
  getConditionalSections: (uniqueLink, selectedYear) => 
    api.post(`/api/form/${uniqueLink}/conditional-sections`, { selectedYear }),
  getRoleBasedSections: (uniqueLink, selectedRole) => 
    api.post(`/api/form/${uniqueLink}/role-based-sections`, { selectedRole }),
  getCombinedConditionalSections: (uniqueLink, selectedYear, selectedRole) => 
    api.post(`/api/form/${uniqueLink}/combined-conditional-sections`, { selectedYear, selectedRole }),
};

export default api;