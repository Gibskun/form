/**
 * Simple toast notification system for user feedback
 */

let toastContainer = null;

// Initialize toast container
const initToastContainer = () => {
  if (toastContainer) return;
  
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    pointer-events: none;
  `;
  document.body.appendChild(toastContainer);
};

export const showToast = (message, type = 'success', duration = 3000) => {
  initToastContainer();
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${getToastColor(type)};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    margin-bottom: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    font-size: 14px;
    max-width: 300px;
    word-wrap: break-word;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    pointer-events: auto;
    cursor: pointer;
    position: relative;
  `;
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span>${getToastIcon(type)} ${message}</span>
      <span style="margin-left: 10px; font-size: 18px; line-height: 1; opacity: 0.8;">×</span>
    </div>
  `;
  
  // Add click to close
  toast.addEventListener('click', () => removeToast(toast));
  
  toastContainer.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });
  
  // Auto remove
  setTimeout(() => {
    removeToast(toast);
  }, duration);
};

const removeToast = (toast) => {
  if (!toast || !toast.parentNode) return;
  
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
};

const getToastColor = (type) => {
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  return colors[type] || colors.success;
};

const getToastIcon = (type) => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[type] || icons.success;
};

export default { showToast };