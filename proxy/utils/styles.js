/**
 * Shared styles for GitHub-like UI
 * Extracted from main worker for performance optimization
 */

export const getSharedStyles = () => `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: #0d1117;
    color: #ffffff;
    line-height: 1.5;
    min-height: 100vh;
  }

  .header {
    background: #010409;
    border-bottom: 1px solid #3d444d;
    padding: 16px 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .app-name {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #248637;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .breadcrumb {
    font-size: 14px;
    color: #9198a1;
  }

  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .page-title {
    font-size: 32px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .page-description {
    font-size: 16px;
    color: #9198a1;
    margin-bottom: 32px;
  }

  .search-container {
    margin-bottom: 24px;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    color: #ffffff;
    font-size: 14px;
  }

  .search-input:focus {
    outline: none;
    border-color: #4493f8;
    box-shadow: 0 0 0 3px rgba(68, 147, 248, 0.1);
  }

  .search-input::placeholder {
    color: #767d86;
  }

  .repo-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .repo-card {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.2s;
    cursor: pointer;
  }

  .repo-card:hover {
    background: #212830;
    border-color: #767d86;
  }

  .repo-card.selected {
    background: #212830;
    border-color: #4493f8;
  }

  .repo-checkbox {
    width: 20px;
    height: 20px;
    accent-color: #4493f8;
    cursor: pointer;
  }

  .repo-info {
    flex: 1;
  }

  .repo-name {
    font-weight: 600;
    color: #4493f8;
    font-size: 14px;
  }

  .repo-description {
    font-size: 14px;
    color: #9198a1;
    margin-top: 4px;
  }

  .repo-badges {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .badge-private {
    background: rgba(248, 81, 73, 0.1);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.3);
  }

  .badge-public {
    background: rgba(36, 134, 55, 0.1);
    color: #248637;
    border: 1px solid rgba(36, 134, 55, 0.3);
  }

  .badge-configured {
    background: rgba(106, 115, 125, 0.1);
    color: #6a737d;
    border: 1px solid rgba(106, 115, 125, 0.3);
  }

  .action-section {
    display: flex;
    gap: 16px;
    align-items: center;
    padding-top: 24px;
    border-top: 1px solid #3d444d;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary {
    background: #248637;
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #29903b;
  }

  .btn-primary:disabled {
    background: #105823;
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #212830;
    color: #ffffff;
    border: 1px solid #3d444d;
  }

  .btn-secondary:hover {
    background: #262c36;
    border-color: #767d86;
  }

  .btn-link {
    background: transparent;
    color: #4493f8;
    padding: 8px;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success {
    background: #248637;
    color: #ffffff;
  }

  .toast-error {
    background: #f85149;
    color: #ffffff;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .stat-card {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 16px;
  }

  .stat-label {
    font-size: 12px;
    color: #9198a1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
  }

  .control-panel {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 24px;
  }

  .control-title {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .control-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #212830;
    border-radius: 6px;
  }

  .control-label {
    font-size: 14px;
    color: #ffffff;
  }

  .switch {
    position: relative;
    width: 48px;
    height: 24px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #3d444d;
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: #ffffff;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background: #248637;
  }

  input:checked + .slider:before {
    transform: translateX(24px);
  }

  .hero {
    text-align: center;
    padding: 80px 24px;
    max-width: 800px;
    margin: 0 auto;
  }

  .hero-title {
    font-size: 48px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .hero-subtitle {
    font-size: 20px;
    color: #9198a1;
    margin-bottom: 48px;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin: 48px 0;
  }

  .feature-card {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 24px;
    text-align: left;
  }

  .feature-icon {
    font-size: 24px;
    margin-bottom: 12px;
  }

  .feature-title {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .feature-description {
    font-size: 14px;
    color: #9198a1;
  }

  .cta-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
  }
`;