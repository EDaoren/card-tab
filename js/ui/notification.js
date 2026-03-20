/**
 * 全局通知系统
 * 提供统一的右上角通知卡片，支持扩展页面与 content script 复用。
 */

class NotificationManager {
  constructor() {
    this.notifications = new Set();
    this.confirmations = new Set();
    this.maxNotifications = 5;
    this.defaultDuration = 5000;
    this.rootId = 'card-tab-notification-root';
    this.styleId = 'card-tab-notification-styles';
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 ('success', 'error', 'warning', 'info')
   * @param {Object} options - 可选配置
   * @param {number} options.duration - 显示时长（毫秒），0 表示不自动消失
   * @param {boolean} options.closable - 是否显示关闭按钮
   * @param {Function} options.onClick - 点击回调
   */
  show(message, type = 'info', options = {}) {
    if (message === undefined || message === null || message === '') {
      return null;
    }

    const config = {
      duration: this.defaultDuration,
      closable: true,
      onClick: null,
      ...options
    };

    const container = this.ensureContainer();
    if (!container) {
      return null;
    }

    if (this.notifications.size >= this.maxNotifications) {
      const oldestNotification = this.notifications.values().next().value;
      this.remove(oldestNotification);
    }

    const notification = this.createNotification(String(message), this.normalizeType(type), config);

    this.notifications.add(notification);
    container.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add('is-visible');
    });

    if (config.duration > 0) {
      notification.dismissTimer = setTimeout(() => {
        this.remove(notification);
      }, config.duration);
    }

    return notification;
  }

  /**
   * 显示确认卡片
   * @param {string} message - 确认消息
   * @param {Object} options - 可选配置
   * @returns {Promise<boolean>}
   */
  confirm(message, options = {}) {
    if (message === undefined || message === null || message === '') {
      return Promise.resolve(false);
    }

    const config = {
      title: '请确认',
      confirmText: '确认',
      cancelText: '取消',
      type: 'warning',
      closable: false,
      onConfirm: null,
      onCancel: null,
      ...options
    };

    const container = this.ensureContainer();
    if (!container) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const confirmation = this.createConfirmation(String(message), config, resolve);
      this.confirmations.add(confirmation);
      container.appendChild(confirmation);

      requestAnimationFrame(() => {
        confirmation.classList.add('is-visible');
        confirmation.querySelector('[data-role="confirm"]')?.focus();
      });
    });
  }

  /**
   * 创建通知元素
   */
  createNotification(message, type, config) {
    const notification = document.createElement('div');
    notification.className = `card-tab-notification card-tab-notification-${type}`;
    notification.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'card-tab-notification__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = this.getIcon(type);

    const messageElement = document.createElement('span');
    messageElement.className = 'card-tab-notification__message';
    messageElement.textContent = message;

    notification.appendChild(icon);
    notification.appendChild(messageElement);

    if (config.closable) {
      const closeButton = this.createCloseButton(() => {
        this.remove(notification);
      });
      notification.appendChild(closeButton);
    }

    if (typeof config.onClick === 'function') {
      notification.classList.add('is-clickable');
      notification.addEventListener('click', () => config.onClick(notification));
    }

    return notification;
  }

  /**
   * 创建确认元素
   */
  createConfirmation(message, config, resolve) {
    const type = this.normalizeType(config.type);
    const confirmation = document.createElement('div');
    confirmation.className = `card-tab-notification card-tab-notification-${type} card-tab-notification-confirm`;
    confirmation.setAttribute('role', 'alertdialog');
    confirmation.setAttribute('aria-modal', 'false');

    const icon = document.createElement('span');
    icon.className = 'card-tab-notification__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = this.getIcon(type);

    const body = document.createElement('div');
    body.className = 'card-tab-notification__body';

    const title = document.createElement('div');
    title.className = 'card-tab-notification__title';
    title.textContent = config.title;

    const messageElement = document.createElement('div');
    messageElement.className = 'card-tab-notification__message';
    messageElement.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'card-tab-notification__actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'card-tab-notification__action card-tab-notification__action-secondary';
    cancelButton.textContent = config.cancelText;
    cancelButton.addEventListener('click', () => {
      this.resolveConfirmation(confirmation, false, config, resolve);
    });

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = `card-tab-notification__action card-tab-notification__action-primary card-tab-notification__action-${type}`;
    confirmButton.textContent = config.confirmText;
    confirmButton.dataset.role = 'confirm';
    confirmButton.addEventListener('click', () => {
      this.resolveConfirmation(confirmation, true, config, resolve);
    });

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);

    body.appendChild(title);
    body.appendChild(messageElement);
    body.appendChild(actions);

    confirmation.appendChild(icon);
    confirmation.appendChild(body);

    if (config.closable) {
      const closeButton = this.createCloseButton(() => {
        this.resolveConfirmation(confirmation, false, config, resolve);
      });
      confirmation.appendChild(closeButton);
    }

    confirmation.escapeHandler = (event) => {
      if (event.key === 'Escape') {
        this.resolveConfirmation(confirmation, false, config, resolve);
      }
    };
    document.addEventListener('keydown', confirmation.escapeHandler);

    return confirmation;
  }

  createCloseButton(onClose) {
    const closeButton = document.createElement('button');
    closeButton.className = 'card-tab-notification__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭通知');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onClose();
    });
    return closeButton;
  }

  resolveConfirmation(confirmation, confirmed, config, resolve) {
    if (!confirmation || confirmation.dataset.resolved === 'true') {
      return;
    }

    confirmation.dataset.resolved = 'true';

    if (confirmed) {
      config.onConfirm?.(confirmation);
    } else {
      config.onCancel?.(confirmation);
    }

    resolve(confirmed);
    this.remove(confirmation);
  }

  /**
   * 移除通知或确认卡片
   */
  remove(notification) {
    if (!notification || notification.dataset.removing === 'true') {
      return;
    }

    notification.dataset.removing = 'true';

    if (notification.dismissTimer) {
      clearTimeout(notification.dismissTimer);
    }

    if (notification.escapeHandler) {
      document.removeEventListener('keydown', notification.escapeHandler);
    }

    notification.classList.remove('is-visible');
    notification.classList.add('is-hiding');
    this.notifications.delete(notification);
    this.confirmations.delete(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 220);
  }

  /**
   * 清除所有通知和确认卡片
   */
  clear() {
    Array.from(this.notifications).forEach((notification) => {
      this.remove(notification);
    });

    Array.from(this.confirmations).forEach((confirmation) => {
      this.remove(confirmation);
    });
  }

  /**
   * 快捷方法
   */
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', options);
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  normalizeType(type) {
    const validTypes = new Set(['success', 'error', 'warning', 'info']);
    return validTypes.has(type) ? type : 'info';
  }

  getIcon(type) {
    const icons = {
      success: '✓',
      error: '!',
      warning: '!',
      info: 'i'
    };

    return icons[type] || icons.info;
  }

  ensureContainer() {
    this.ensureStyles();

    let container = document.getElementById(this.rootId);
    if (container) {
      return container;
    }

    container = document.createElement('div');
    container.id = this.rootId;
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');

    const parent = document.body || document.documentElement;
    if (!parent) {
      return null;
    }

    parent.appendChild(container);
    return container;
  }

  ensureStyles() {
    if (document.getElementById(this.styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      #${this.rootId} {
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: min(440px, calc(100vw - 24px));
        z-index: 2147483647;
        pointer-events: none;
      }

      #${this.rootId},
      #${this.rootId} * {
        box-sizing: border-box;
      }

      .card-tab-notification {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        width: 100%;
        padding: 14px 16px;
        border: 1px solid var(--border-color, rgba(148, 163, 184, 0.35));
        border-radius: 14px;
        background: var(--card-bg-color, #ffffff);
        color: var(--text-color, #1f2937);
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
        opacity: 0;
        transform: translate3d(24px, 0, 0) scale(0.98);
        transition: opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      .card-tab-notification.is-visible {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }

      .card-tab-notification.is-hiding {
        opacity: 0;
        transform: translate3d(24px, 0, 0) scale(0.98);
      }

      .card-tab-notification.is-clickable {
        cursor: pointer;
      }

      .card-tab-notification-confirm {
        align-items: flex-start;
      }

      .card-tab-notification__icon {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        margin-top: 1px;
      }

      .card-tab-notification-success .card-tab-notification__icon {
        background: rgba(16, 185, 129, 0.14);
        color: #10b981;
      }

      .card-tab-notification-error .card-tab-notification__icon {
        background: rgba(239, 68, 68, 0.14);
        color: #ef4444;
      }

      .card-tab-notification-warning .card-tab-notification__icon {
        background: rgba(245, 158, 11, 0.14);
        color: #f59e0b;
      }

      .card-tab-notification-info .card-tab-notification__icon {
        background: rgba(59, 130, 246, 0.14);
        color: #3b82f6;
      }

      .card-tab-notification__body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .card-tab-notification__title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-color, #0f172a);
      }

      .card-tab-notification__message {
        flex: 1;
        min-width: 0;
        white-space: pre-line;
        word-break: break-word;
      }

      .card-tab-notification__actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .card-tab-notification__action {
        border: none;
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.18s ease, filter 0.18s ease, background-color 0.18s ease;
      }

      .card-tab-notification__action:hover {
        transform: translateY(-1px);
        filter: brightness(0.98);
      }

      .card-tab-notification__action-secondary {
        background: var(--hover-color, #f1f5f9);
        color: var(--text-color, #334155);
      }

      .card-tab-notification__action-primary {
        background: var(--primary-color, #4285f4);
        color: #ffffff;
      }

      .card-tab-notification__action-error {
        background: var(--danger-color, #ea4335);
      }

      .card-tab-notification__action-warning {
        background: #f59e0b;
      }

      .card-tab-notification__close {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary, #64748b);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: background-color 0.2s ease, color 0.2s ease;
      }

      .card-tab-notification__close:hover {
        background: var(--hover-overlay, rgba(15, 23, 42, 0.06));
        color: var(--text-color, #0f172a);
      }

      @media (max-width: 768px) {
        #${this.rootId} {
          top: 10px;
          right: 10px;
          left: 10px;
          width: auto;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }
}

const notificationManager = new NotificationManager();

if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
  window.showNotification = (message, type, options) => notificationManager.show(message, type, options);
  window.showConfirmNotification = (message, options) => notificationManager.confirm(message, options);
  window.notification = {
    show: (message, type, options) => notificationManager.show(message, type, options),
    success: (message, options) => notificationManager.success(message, options),
    error: (message, options) => notificationManager.error(message, options),
    warning: (message, options) => notificationManager.warning(message, options),
    info: (message, options) => notificationManager.info(message, options),
    confirm: (message, options) => notificationManager.confirm(message, options),
    clear: () => notificationManager.clear()
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}
