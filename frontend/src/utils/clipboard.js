/**
 * Robust clipboard utility that handles various browser limitations
 * and provides fallbacks for copy functionality
 */
import { showToast } from './toast';

export const copyToClipboard = async (text, successMessage = 'Copied to clipboard!') => {
  try {
    // Method 1: Modern Clipboard API (requires HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showSuccess(successMessage);
      return true;
    }
    
    // Method 2: Fallback using execCommand (deprecated but widely supported)
    const success = fallbackCopy(text);
    if (success) {
      showSuccess(successMessage);
      return true;
    }
    
    // Method 3: Manual copy prompt as last resort
    showManualCopyPrompt(text);
    return false;
    
  } catch (error) {
    console.error('Clipboard operation failed:', error);
    
    // Try fallback method
    const fallbackSuccess = fallbackCopy(text);
    if (fallbackSuccess) {
      showSuccess(successMessage);
      return true;
    }
    
    // Final resort: manual copy
    showManualCopyPrompt(text);
    return false;
  }
};

const fallbackCopy = (text) => {
  try {
    // Create temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // Make it invisible but accessible
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    
    document.body.appendChild(textarea);
    
    // Select and copy
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    return successful;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
};

const showSuccess = (message) => {
  // Use toast notification for better UX
  if (typeof showToast === 'function') {
    showToast(message, 'success');
  } else {
    // Fallback to alert if toast is not available
    alert(message);
  }
};

const showManualCopyPrompt = (text) => {
  const userAction = prompt(
    'Automatic copy failed. Please copy this link manually:\n\n' +
    'Press Ctrl+C (Cmd+C on Mac) to copy, then press Enter.',
    text
  );
  
  if (userAction !== null) {
    alert('Link is ready to paste! Use Ctrl+V (Cmd+V on Mac) to paste it.');
  }
};

// Alternative method that creates a modal instead of using prompt
export const showCopyModal = (text, title = 'Copy Link') => {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 90%;
    width: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  
  modalContent.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #333;">${title}</h3>
    <p style="margin: 0 0 15px 0; color: #666;">Copy the link below:</p>
    <input 
      type="text" 
      value="${text}" 
      readonly 
      style="
        width: 100%; 
        padding: 10px; 
        border: 1px solid #ddd; 
        border-radius: 4px;
        font-size: 14px;
        margin-bottom: 15px;
        box-sizing: border-box;
      "
      id="copyInput"
    />
    <div style="text-align: right;">
      <button 
        onclick="
          document.getElementById('copyInput').select();
          document.execCommand('copy');
          alert('Copied!');
          this.closest('[data-modal]').remove();
        "
        style="
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          margin-right: 10px;
          cursor: pointer;
        "
      >
        Copy
      </button>
      <button 
        onclick="this.closest('[data-modal]').remove();"
        style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        "
      >
        Close
      </button>
    </div>
  `;
  
  modal.setAttribute('data-modal', 'true');
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Auto-select the text
  setTimeout(() => {
    const input = document.getElementById('copyInput');
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

export default { copyToClipboard, showCopyModal };