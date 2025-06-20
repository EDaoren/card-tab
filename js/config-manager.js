/**
 * 配置管理器 - 已废弃
 * 此文件的功能已合并到 theme-config-manager.js 中
 * 保留此文件仅为兼容性考虑，建议使用 themeConfigManager
 */

console.warn('config-manager.js 已废弃，请使用 theme-config-manager.js 中的 themeConfigManager');

// 为了向后兼容，创建一个指向 themeConfigManager 的别名
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'configManager', {
    get() {
      if (window.themeConfigManager) {
        return window.themeConfigManager;
      }
      console.warn('themeConfigManager 尚未初始化');
      return null;
    }
  });
}
