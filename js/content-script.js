/**
 * Content script for Card Tab extension
 * Handles quick add modal display and interaction
 */

let quickAddModal = null;
let categories = [];

console.log('Card Tab content script loaded on:', window.location.href);

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === "showQuickAdd") {
    console.log('Showing quick add modal for:', request.pageInfo);

    // 直接使用后台脚本提供的分类数据
    if (request.categories && Array.isArray(request.categories)) {
      console.log('Content script: Using categories from background script:', request.categories.length);
      console.log('Content script: Raw categories received:', request.categories);
      console.log('Content script: Category details:', request.categories.map(c => ({
        id: c ? c.id : 'undefined',
        name: c ? c.name : 'undefined',
        hasId: !!(c && c.id),
        hasName: !!(c && c.name)
      })));
      categories = request.categories;
    } else {
      console.log('Content script: No categories provided by background script, using empty array');
      console.log('Content script: Received categories data:', request.categories);
      categories = [];
    }

    // 直接创建模态框
    createQuickAddModal(request.pageInfo);
    sendResponse({ success: true });
  }
});

// 分类数据现在由后台脚本提供，不需要单独加载

// 创建快速添加模态框
function createQuickAddModal(pageInfo) {
  // 创建模态框容器
  quickAddModal = document.createElement('div');
  quickAddModal.id = 'card-tab-quick-add-modal';
  quickAddModal.innerHTML = `
    <div class="card-tab-modal-overlay">
      <div class="card-tab-modal-content">
        <div class="card-tab-modal-header">
          <h3>Card Tab 卡片式导航</h3>
          <button class="card-tab-close-btn">&times;</button>
        </div>
        <div class="card-tab-modal-body">
          <div class="card-tab-form-group">
            <label>网站名称</label>
            <input type="text" id="card-tab-name" value="${escapeHtml(pageInfo.title || '')}" required>
          </div>
          <div class="card-tab-form-group">
            <label>网址</label>
            <input type="url" id="card-tab-url" value="${escapeHtml(pageInfo.url || '')}" required>
          </div>
          <div class="card-tab-form-group">
            <label>选择分类</label>
            <select id="card-tab-category" required>
              <option value="">请选择分类</option>
              ${categories.map(cat =>
                `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="card-tab-modal-footer">
          <button class="card-tab-cancel-btn">取消</button>
          <button class="card-tab-save-btn">保存</button>
        </div>
      </div>
    </div>
  `;

  // 添加样式
  addQuickAddStyles();

  // 添加到页面
  document.body.appendChild(quickAddModal);

  // 绑定事件
  bindQuickAddEvents(pageInfo);

  // 聚焦到名称输入框并添加实时验证
  setTimeout(() => {
    const nameInput = quickAddModal.querySelector('#card-tab-name');
    const urlInput = quickAddModal.querySelector('#card-tab-url');

    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }

    // 添加实时验证
    addRealTimeValidation();
  }, 100);
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 添加样式
function addQuickAddStyles() {
  if (document.getElementById('card-tab-quick-add-styles')) {
    return;
  }

  const styles = document.createElement('style');
  styles.id = 'card-tab-quick-add-styles';
  styles.textContent = `
    #card-tab-quick-add-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .card-tab-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: card-tab-fade-in 0.2s ease-out;
    }

    .card-tab-modal-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      width: 90%;
      max-width: 480px;
      max-height: 90vh;
      overflow: hidden;
      animation: card-tab-slide-up 0.3s ease-out;
    }

    .card-tab-modal-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-tab-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .card-tab-close-btn {
      background: none;
      border: none;
      font-size: 24px;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .card-tab-close-btn:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .card-tab-modal-body {
      padding: 20px 24px;
    }

    .card-tab-form-group {
      margin-bottom: 16px;
    }

    .card-tab-form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .card-tab-form-group input,
    .card-tab-form-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .card-tab-form-group input:focus,
    .card-tab-form-group select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .card-tab-no-categories {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 12px;
      margin-top: 8px;
    }

    .card-tab-no-categories p {
      margin: 0;
      font-size: 14px;
      color: #92400e;
    }

    .card-tab-modal-footer {
      padding: 16px 24px 20px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .card-tab-cancel-btn,
    .card-tab-save-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }

    .card-tab-cancel-btn {
      background: #f9fafb;
      color: #374151;
      border-color: #d1d5db;
    }

    .card-tab-cancel-btn:hover {
      background: #f3f4f6;
    }

    .card-tab-save-btn {
      background: #3b82f6;
      color: white;
    }

    .card-tab-save-btn:hover {
      background: #2563eb;
    }

    .card-tab-save-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }



    .card-tab-field-error {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }

    .card-tab-error-message {
      margin-top: 4px;
      font-size: 12px;
      color: #ef4444;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-tab-error-message::before {
      content: "⚠️";
      font-size: 12px;
    }

    .card-tab-success-container {
      text-align: center;
      padding: 40px 20px;
      position: relative;
    }

    .card-tab-success-animation {
      position: relative;
      display: inline-block;
      margin-bottom: 24px;
    }

    .card-tab-success-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
      position: relative;
      z-index: 2;
      box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
      animation: card-tab-success-bounce 0.8s ease-out;
    }

    .card-tab-success-ripple {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 80px;
      height: 80px;
      border: 2px solid #10b981;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      animation: card-tab-success-ripple 1.5s ease-out infinite;
      opacity: 0;
    }

    .card-tab-success-title {
      margin: 0 0 12px 0;
      color: #1f2937;
      font-size: 24px;
      font-weight: 600;
      animation: card-tab-fade-in-up 0.6s ease-out 0.2s both;
    }

    .card-tab-success-message {
      margin: 0 0 24px 0;
      color: #6b7280;
      font-size: 16px;
      animation: card-tab-fade-in-up 0.6s ease-out 0.4s both;
    }

    .card-tab-success-timer {
      animation: card-tab-fade-in-up 0.6s ease-out 0.6s both;
    }

    .card-tab-timer-bar {
      width: 200px;
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      margin: 0 auto 12px;
      position: relative;
      overflow: hidden;
    }

    .card-tab-timer-bar::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, #10b981, #059669);
      border-radius: 2px;
      transition: width 1.5s linear;
    }

    .card-tab-timer-active::before {
      width: 100%;
    }

    .card-tab-timer-text {
      font-size: 14px;
      color: #9ca3af;
    }

    .card-tab-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: card-tab-spin 1s linear infinite;
    }

    @keyframes card-tab-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes card-tab-success-bounce {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      50% {
        transform: scale(1.15);
        opacity: 1;
      }
      70% {
        transform: scale(0.95);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes card-tab-success-ripple {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.6;
      }
      100% {
        transform: translate(-50%, -50%) scale(2);
        opacity: 0;
      }
    }

    @keyframes card-tab-fade-in-up {
      0% {
        opacity: 0;
        transform: translateY(20px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes card-tab-timer-progress {
      from {
        width: 0%;
      }
      to {
        width: 100%;
      }
    }

    @keyframes card-tab-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes card-tab-slide-up {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;

  document.head.appendChild(styles);
}

// 绑定事件
function bindQuickAddEvents(pageInfo) {
  const closeBtn = quickAddModal.querySelector('.card-tab-close-btn');
  const cancelBtn = quickAddModal.querySelector('.card-tab-cancel-btn');
  const saveBtn = quickAddModal.querySelector('.card-tab-save-btn');
  const overlay = quickAddModal.querySelector('.card-tab-modal-overlay');

  // 关闭事件
  const closeModal = () => {
    if (quickAddModal) {
      quickAddModal.remove();
      quickAddModal = null;
    }
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // ESC键关闭
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // 保存事件
  saveBtn.addEventListener('click', async () => {
    await handleSave(pageInfo);
  });

  // 回车键保存
  quickAddModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave(pageInfo);
    }
  });
}

// 处理保存
async function handleSave(pageInfo) {
  const nameInput = quickAddModal.querySelector('#card-tab-name');
  const urlInput = quickAddModal.querySelector('#card-tab-url');
  const categorySelect = quickAddModal.querySelector('#card-tab-category');
  const saveBtn = quickAddModal.querySelector('.card-tab-save-btn');

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  const categoryId = categorySelect.value;

  // 清除之前的错误提示
  clearFieldErrors();

  // 验证表单
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

  // 确保URL格式正确
  let finalUrl = url;
  if (!finalUrl.match(/^https?:\/\//)) {
    finalUrl = 'https://' + finalUrl;
  }

  // 禁用保存按钮并显示加载状态
  saveBtn.disabled = true;
  saveBtn.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <span class="card-tab-spinner"></span>
      保存中...
    </span>
  `;

  try {
    // 准备数据
    const shortcutData = {
      name: name,
      url: finalUrl,
      categoryId: categoryId, // 用户必须选择分类
      iconType: 'favicon',
      iconColor: '#4285f4',
      iconUrl: pageInfo.favIconUrl || ''
    };

    console.log('Saving shortcut data:', shortcutData);

    // 发送到后台脚本保存
    const response = await chrome.runtime.sendMessage({
      action: "saveQuickAdd",
      data: shortcutData
    });

    console.log('Save response:', response);

    if (response && response.success) {
      // 在当前表单中显示成功状态
      showInlineSuccessMessage();

      // 延迟关闭模态框
      setTimeout(() => {
        if (quickAddModal) {
          quickAddModal.remove();
          quickAddModal = null;
        }
      }, 1500);
    } else {
      throw new Error(response?.error || '保存失败');
    }
  } catch (error) {
    console.error('Error saving shortcut:', error);
    alert('保存失败: ' + error.message);

    // 恢复保存按钮
    saveBtn.disabled = false;
    saveBtn.innerHTML = '保存';
  }
}

// 在表单中显示内联成功消息
function showInlineSuccessMessage() {
  const modalBody = quickAddModal.querySelector('.card-tab-modal-body');
  const modalFooter = quickAddModal.querySelector('.card-tab-modal-footer');

  // 隐藏表单内容，显示成功状态
  modalBody.innerHTML = `
    <div class="card-tab-success-container">
      <div class="card-tab-success-animation">
        <div class="card-tab-success-icon">✓</div>
        <div class="card-tab-success-ripple"></div>
      </div>
      <h3 class="card-tab-success-title">添加成功！</h3>
      <p class="card-tab-success-message">快捷方式已保存到 Card Tab</p>
      <div class="card-tab-success-timer">
        <div class="card-tab-timer-bar"></div>
        <span class="card-tab-timer-text">1.5秒后自动关闭</span>
      </div>
    </div>
  `;

  // 隐藏底部按钮
  modalFooter.style.display = 'none';

  // 启动倒计时动画
  startTimerAnimation();
}

// 启动倒计时动画
function startTimerAnimation() {
  const timerBar = quickAddModal.querySelector('.card-tab-timer-bar');
  const timerText = quickAddModal.querySelector('.card-tab-timer-text');

  if (!timerBar || !timerText) return;

  let timeLeft = 1.5;

  // 启动进度条动画
  setTimeout(() => {
    timerBar.classList.add('card-tab-timer-active');
  }, 100);

  // 更新倒计时文字
  const countdown = setInterval(() => {
    timeLeft -= 0.5;
    if (timeLeft > 0) {
      timerText.textContent = `${timeLeft}秒后自动关闭`;
    } else {
      timerText.textContent = '正在关闭...';
      clearInterval(countdown);
    }
  }, 500);
}

// 表单验证辅助函数
function showFieldError(field, message) {
  // 移除之前的错误样式
  field.classList.remove('card-tab-field-error');

  // 移除之前的错误消息
  const existingError = field.parentNode.querySelector('.card-tab-error-message');
  if (existingError) {
    existingError.remove();
  }

  // 添加错误样式
  field.classList.add('card-tab-field-error');

  // 添加错误消息
  const errorDiv = document.createElement('div');
  errorDiv.className = 'card-tab-error-message';
  errorDiv.textContent = message;
  field.parentNode.appendChild(errorDiv);

  // 聚焦到错误字段
  field.focus();
}

function clearFieldErrors() {
  const errorFields = quickAddModal.querySelectorAll('.card-tab-field-error');
  const errorMessages = quickAddModal.querySelectorAll('.card-tab-error-message');

  errorFields.forEach(field => field.classList.remove('card-tab-field-error'));
  errorMessages.forEach(msg => msg.remove());
}

function isValidUrl(string) {
  try {
    // 如果没有协议，自动添加 https://
    if (!string.match(/^https?:\/\//)) {
      string = 'https://' + string;
    }
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// 添加实时验证
function addRealTimeValidation() {
  const nameInput = quickAddModal.querySelector('#card-tab-name');
  const urlInput = quickAddModal.querySelector('#card-tab-url');
  const categorySelect = quickAddModal.querySelector('#card-tab-category');
  const saveBtn = quickAddModal.querySelector('.card-tab-save-btn');

  function validateForm() {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const categoryId = categorySelect.value;

    // 清除之前的错误
    nameInput.classList.remove('card-tab-field-error');
    urlInput.classList.remove('card-tab-field-error');
    categorySelect.classList.remove('card-tab-field-error');

    let isValid = true;

    // 验证名称
    if (name.length === 0) {
      isValid = false;
    }

    // 验证URL
    if (url.length === 0 || !isValidUrl(url)) {
      isValid = false;
    }

    // 验证分类选择
    if (!categoryId) {
      isValid = false;
    }

    // 更新保存按钮状态
    saveBtn.disabled = !isValid;

    return isValid;
  }

  // 绑定输入事件
  nameInput.addEventListener('input', validateForm);
  urlInput.addEventListener('input', validateForm);
  categorySelect.addEventListener('change', validateForm);

  // 初始验证
  validateForm();
}
