import React, { useState } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import { showToast } from '../utils/toast';

const CopyLinkButton = ({ uniqueLink, formTitle }) => {
  const [copied, setCopied] = useState(false);
  const fullLink = `${window.location.origin}/form/${uniqueLink}`;

  const handleCopy = async () => {
    try {
      const success = await copyToClipboard(fullLink, 'Form link copied! Share it with your users.');
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      showToast('Failed to copy link. Please try again.', 'error');
    }
  };

  const handleShare = () => {
    // Show a modal with the full link and sharing options
    showLinkModal(fullLink, formTitle);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        onClick={handleCopy}
        className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
        style={{ fontSize: '12px', padding: '5px 10px' }}
        title="Copy form link to share with users"
      >
        {copied ? '✓ Copied!' : '📋 Copy Link'}
      </button>
      <button
        onClick={handleShare}
        className="btn btn-secondary"
        style={{ fontSize: '12px', padding: '5px 10px' }}
        title="View full link and sharing options"
      >
        👁️ View Link
      </button>
    </div>
  );
};

const showLinkModal = (fullLink, formTitle) => {
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 25px;
    border-radius: 12px;
    max-width: 90%;
    width: 600px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  `;
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; color: #333;">Share Form: ${formTitle}</h3>
      <button 
        onclick="this.closest('[data-modal]').remove();"
        style="
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        "
        title="Close"
      >
        ×
      </button>
    </div>
    
    <p style="margin: 0 0 15px 0; color: #666;">
      Share this link with users to let them fill out your form:
    </p>
    
    <div style="
      display: flex; 
      gap: 10px; 
      margin-bottom: 20px;
      align-items: center;
    ">
      <input 
        type="text" 
        value="${fullLink}" 
        readonly 
        style="
          flex: 1;
          padding: 12px; 
          border: 2px solid #e0e0e0; 
          border-radius: 6px;
          font-size: 14px;
          background: #f8f9fa;
          font-family: monospace;
        "
        id="linkInput"
        onclick="this.select();"
      />
      <button 
        onclick="
          const input = document.getElementById('linkInput');
          input.select();
          input.setSelectionRange(0, 99999);
          
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText('${fullLink}').then(() => {
              this.innerHTML = '✓ Copied!';
              this.style.background = '#28a745';
              setTimeout(() => {
                this.innerHTML = 'Copy';
                this.style.background = '#007bff';
              }, 2000);
            }).catch(() => {
              document.execCommand('copy');
              this.innerHTML = '✓ Copied!';
              this.style.background = '#28a745';
              setTimeout(() => {
                this.innerHTML = 'Copy';
                this.style.background = '#007bff';
              }, 2000);
            });
          } else {
            document.execCommand('copy');
            this.innerHTML = '✓ Copied!';
            this.style.background = '#28a745';
            setTimeout(() => {
              this.innerHTML = 'Copy';
              this.style.background = '#007bff';
            }, 2000);
          }
        "
        style="
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          font-weight: 500;
        "
      >
        Copy
      </button>
    </div>
    
    <div style="
      background: #f8f9fa; 
      padding: 15px; 
      border-radius: 8px; 
      border-left: 4px solid #007bff;
      margin-bottom: 20px;
    ">
      <strong style="color: #007bff;">💡 Tip:</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #666;">
        <li>Users don't need to create accounts - just name and email</li>
        <li>Each person can only submit once (prevents duplicates)</li>
        <li>You can view all responses from your admin dashboard</li>
      </ul>
    </div>
    
    <div style="text-align: right;">
      <button 
        onclick="this.closest('[data-modal]').remove();"
        style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
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
    const input = document.getElementById('linkInput');
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
  
  // Close on Escape key
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
};

export default CopyLinkButton;