/**
 * 全局通知系统
 * 提供美观的通知提示功能，支持多种类型和自定义配置
 */

class NotificationManager {
  constructor() {
    this.notifications = new Set();
    this.maxNotifications = 5; // 最大同时显示的通知数量
    this.defaultDuration = 5000; // 默认显示时长（毫秒）
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 ('success', 'error', 'warning', 'info')
   * @param {Object} options - 可选配置
   * @param {number} options.duration - 显示时长（毫秒），0表示不自动消失
   * @param {boolean} options.closable - 是否显示关闭按钮
   * @param {Function} options.onClick - 点击回调
   */
  show(message, type = 'info', options = {}) {
    const config = {
      duration: this.defaultDuration,
      closable: true,
      onClick: null,
      ...options
    };

    // 如果通知数量超过限制，移除最旧的通知
    if (this.notifications.size >= this.maxNotifications) {
      const oldestNotification = this.notifications.values().next().value;
      this.remove(oldestNotification);
    }

    // 创建通知元素
    const notification = this.createNotification(message, type, config);
    
    // 添加到集合
    this.notifications.add(notification);
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    requestAnimationFrame(() => {
      notification.classList.add('notification-show');
    });
    
    // 自动消失
    if (config.duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, config.duration);
    }

    return notification;
  }

  /**
   * 创建通知元素
   */
  createNotification(message, type, config) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // 设置图标
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    
    const closeButton = config.closable ? `
      <button class="notification-close" data-action="close">
        <span class="material-symbols-rounded">close</span>
      </button>
    ` : '';
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="material-symbols-rounded notification-icon">${icons[type]}</span>
        <span class="notification-message">${message}</span>
        ${closeButton}
      </div>
    `;
    
    // 绑定事件
    notification.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) {
        this.remove(notification);
      } else if (config.onClick) {
        config.onClick(notification);
      }
    });

    return notification;
  }

  /**
   * 移除通知
   */
  remove(notification) {
    if (!notification || !notification.parentElement) return;
    
    // 移除动画
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    
    // 从集合中移除
    this.notifications.delete(notification);
    
    // 延迟移除DOM元素
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }

  /**
   * 清除所有通知
   */
  clear() {
    this.notifications.forEach(notification => {
      this.remove(notification);
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
}

// 创建全局实例
const notificationManager = new NotificationManager();

// 挂载到window对象，供全局使用
window.showNotification = (message, type, options) => {
  return notificationManager.show(message, type, options);
};

window.notification = {
  show: (message, type, options) => notificationManager.show(message, type, options),
  success: (message, options) => notificationManager.success(message, options),
  error: (message, options) => notificationManager.error(message, options),
  warning: (message, options) => notificationManager.warning(message, options),
  info: (message, options) => notificationManager.info(message, options),
  clear: () => notificationManager.clear()
};

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}
