/**
 * Content script for Card Tab quick add.
 */

let quickAddModal = null;
let categories = [];
let quickAddToast = null;
let quickAddKeydownHandler = null;

async function safeSendMessage(message, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      const messageText = String(error?.message || '');
      const shouldRetry = messageText.includes('Could not establish connection')
        || messageText.includes('Receiving end does not exist');

      if (!shouldRetry || attempt >= retries) {
        throw new Error('扩展连接失败，请刷新页面后重试');
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error('扩展连接失败，请刷新页面后重试');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'showQuickAdd') {
    return;
  }

  categories = Array.isArray(request.categories) ? request.categories : [];
  createQuickAddModal(request.pageInfo || {});
  sendResponse({ success: true });
});

function createQuickAddModal(pageInfo) {
  if (quickAddModal) {
    quickAddModal.remove();
    quickAddModal = null;
  }

  addQuickAddStyles();

  quickAddModal = document.createElement('div');
  quickAddModal.id = 'card-tab-quick-add-modal';
  quickAddModal.innerHTML = `
    <div class="card-tab-modal-overlay">
      <div class="card-tab-modal-content" role="dialog" aria-modal="true" aria-labelledby="card-tab-quick-add-title">
        <div class="card-tab-modal-header">
          <h3 id="card-tab-quick-add-title">添加到 Card Tab</h3>
          <button class="card-tab-close-btn" type="button" aria-label="关闭">&times;</button>
        </div>
        <div class="card-tab-modal-body">
          <div class="card-tab-form-group">
            <label for="card-tab-name">网站名称</label>
            <input type="text" id="card-tab-name" value="${escapeHtml(pageInfo.title || '')}" required>
          </div>
          <div class="card-tab-form-group">
            <label for="card-tab-url">网址</label>
            <input type="url" id="card-tab-url" value="${escapeHtml(pageInfo.url || '')}" required>
          </div>
          <div class="card-tab-form-group">
            <label for="card-tab-category">选择分类</label>
            <select id="card-tab-category" required>
              <option value="">请选择分类</option>
              ${categories.map((category) => (
                `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`
              )).join('')}
            </select>
            ${categories.length === 0 ? '<div class="card-tab-no-categories"><p>当前没有可用分类，请先在 Card Tab 中创建分类。</p></div>' : ''}
          </div>
        </div>
        <div class="card-tab-modal-footer">
          <button class="card-tab-cancel-btn" type="button">取消</button>
          <button class="card-tab-save-btn" type="button">保存</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(quickAddModal);
  bindQuickAddEvents(pageInfo);

  setTimeout(() => {
    const nameInput = quickAddModal?.querySelector('#card-tab-name');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
    addRealTimeValidation();
  }, 50);
}

function closeQuickAddModal() {
  if (quickAddKeydownHandler) {
    document.removeEventListener('keydown', quickAddKeydownHandler);
    quickAddKeydownHandler = null;
  }

  if (!quickAddModal) {
    return;
  }

  quickAddModal.remove();
  quickAddModal = null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}

function showQuickAddToast(message, type = 'info') {
  if (!quickAddToast) {
    quickAddToast = document.createElement('div');
    quickAddToast.id = 'card-tab-quick-add-toast';
    document.documentElement.appendChild(quickAddToast);
  }

  quickAddToast.textContent = message;
  quickAddToast.className = `is-${type}`;

  window.clearTimeout(showQuickAddToast.timeoutId);
  showQuickAddToast.timeoutId = window.setTimeout(() => {
    if (quickAddToast) {
      quickAddToast.className = '';
    }
  }, 2200);
}

function addQuickAddStyles() {
  if (document.getElementById('card-tab-quick-add-styles')) {
    return;
  }

  const styles = document.createElement('style');
  styles.id = 'card-tab-quick-add-styles';
  styles.textContent = `
    #card-tab-quick-add-modal {
      position: fixed;
      inset: 0;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #card-tab-quick-add-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000000;
      min-width: 220px;
      max-width: 360px;
      padding: 12px 14px;
      border-radius: 10px;
      color: #fff;
      background: rgba(17, 24, 39, 0.92);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    #card-tab-quick-add-toast.is-success,
    #card-tab-quick-add-toast.is-error,
    #card-tab-quick-add-toast.is-info {
      opacity: 1;
      transform: translateY(0);
    }

    #card-tab-quick-add-toast.is-success {
      background: rgba(5, 150, 105, 0.96);
    }

    #card-tab-quick-add-toast.is-error {
      background: rgba(220, 38, 38, 0.96);
    }

    .card-tab-modal-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
    }

    .card-tab-modal-content {
      width: min(480px, calc(100vw - 32px));
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
      overflow: hidden;
    }

    .card-tab-modal-header,
    .card-tab-modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
    }

    .card-tab-modal-header {
      border-bottom: 1px solid #e5e7eb;
    }

    .card-tab-modal-header h3 {
      margin: 0;
      font-size: 18px;
      color: #111827;
    }

    .card-tab-modal-body {
      padding: 20px;
    }

    .card-tab-form-group {
      margin-bottom: 16px;
    }

    .card-tab-form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .card-tab-form-group input,
    .card-tab-form-group select {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
    }

    .card-tab-form-group input:focus,
    .card-tab-form-group select:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }

    .card-tab-close-btn,
    .card-tab-cancel-btn,
    .card-tab-save-btn {
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .card-tab-close-btn {
      width: 34px;
      height: 34px;
      background: transparent;
      color: #6b7280;
      font-size: 24px;
    }

    .card-tab-cancel-btn,
    .card-tab-save-btn {
      padding: 10px 16px;
    }

    .card-tab-cancel-btn {
      background: #f3f4f6;
      color: #374151;
    }

    .card-tab-save-btn {
      background: #2563eb;
      color: #fff;
    }

    .card-tab-save-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .card-tab-no-categories {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fef3c7;
      color: #92400e;
      font-size: 13px;
    }

    .card-tab-field-error {
      border-color: #dc2626 !important;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12) !important;
    }

    .card-tab-error-message {
      margin-top: 4px;
      color: #dc2626;
      font-size: 12px;
    }
  `;

  document.head.appendChild(styles);
}

function bindQuickAddEvents(pageInfo) {
  const closeBtn = quickAddModal.querySelector('.card-tab-close-btn');
  const cancelBtn = quickAddModal.querySelector('.card-tab-cancel-btn');
  const saveBtn = quickAddModal.querySelector('.card-tab-save-btn');
  const overlay = quickAddModal.querySelector('.card-tab-modal-overlay');

  quickAddKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      closeQuickAddModal();
    }
  };

  closeBtn.addEventListener('click', closeQuickAddModal);
  cancelBtn.addEventListener('click', closeQuickAddModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeQuickAddModal();
    }
  });
  document.addEventListener('keydown', quickAddKeydownHandler);

  saveBtn.addEventListener('click', async () => {
    await handleSave(pageInfo);
  });

  quickAddModal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave(pageInfo);
    }
  });
}

async function handleSave(pageInfo) {
  if (!quickAddModal) {
    return;
  }

  const nameInput = quickAddModal.querySelector('#card-tab-name');
  const urlInput = quickAddModal.querySelector('#card-tab-url');
  const categorySelect = quickAddModal.querySelector('#card-tab-category');
  const saveBtn = quickAddModal.querySelector('.card-tab-save-btn');

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  const categoryId = categorySelect.value;

  clearFieldErrors();

  let hasError = false;

  if (!name) {
    showFieldError(nameInput, '请输入网站名称');
    hasError = true;
  }

  if (!url) {
    showFieldError(urlInput, '请输入网址');
    hasError = true;
  } else if (!isValidUrl(url)) {
    showFieldError(urlInput, '请输入有效的网址');
    hasError = true;
  }

  if (!categoryId) {
    showFieldError(categorySelect, '请选择一个分类');
    hasError = true;
  }

  if (hasError) {
    return;
  }

  const finalUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  try {
    const response = await safeSendMessage({
      action: 'saveQuickAdd',
      data: {
        name,
        url: finalUrl,
        categoryId,
        iconType: 'favicon',
        iconColor: '#4285f4',
        iconUrl: pageInfo.favIconUrl || ''
      }
    }, 2);

    if (!response?.success) {
      throw new Error(response?.error || '保存失败');
    }

    closeQuickAddModal();
    showQuickAddToast(`已添加“${name}”到 Card Tab`, 'success');
  } catch (error) {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存';
    showQuickAddToast(`保存失败: ${error.message}`, 'error');
  }
}

function showFieldError(field, message) {
  field.classList.remove('card-tab-field-error');

  const existingError = field.parentNode.querySelector('.card-tab-error-message');
  if (existingError) {
    existingError.remove();
  }

  field.classList.add('card-tab-field-error');

  const errorDiv = document.createElement('div');
  errorDiv.className = 'card-tab-error-message';
  errorDiv.textContent = message;
  field.parentNode.appendChild(errorDiv);
  field.focus();
}

function clearFieldErrors() {
  if (!quickAddModal) {
    return;
  }

  quickAddModal.querySelectorAll('.card-tab-field-error').forEach((field) => {
    field.classList.remove('card-tab-field-error');
  });
  quickAddModal.querySelectorAll('.card-tab-error-message').forEach((message) => {
    message.remove();
  });
}

function isValidUrl(value) {
  try {
    const normalizedValue = value.match(/^https?:\/\//) ? value : `https://${value}`;
    new URL(normalizedValue);
    return true;
  } catch (error) {
    return false;
  }
}

function addRealTimeValidation() {
  if (!quickAddModal) {
    return;
  }

  const nameInput = quickAddModal.querySelector('#card-tab-name');
  const urlInput = quickAddModal.querySelector('#card-tab-url');
  const categorySelect = quickAddModal.querySelector('#card-tab-category');
  const saveBtn = quickAddModal.querySelector('.card-tab-save-btn');

  const validateForm = () => {
    const hasName = !!nameInput.value.trim();
    const hasUrl = !!urlInput.value.trim() && isValidUrl(urlInput.value.trim());
    const hasCategory = !!categorySelect.value;
    saveBtn.disabled = !(hasName && hasUrl && hasCategory);
  };

  nameInput.addEventListener('input', validateForm);
  urlInput.addEventListener('input', validateForm);
  categorySelect.addEventListener('change', validateForm);
  validateForm();
}
