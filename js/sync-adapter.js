/**
 * 同步适配器
 * 为现有的同步UI提供兼容接口，使其能够使用新的统一数据管理器
 */

class SyncAdapter {
  constructor() {
    this.isSupabaseEnabled = false;
    this.currentSupabaseConfig = null;
    this.lastSyncTime = null;
  }

  /**
   * 初始化同步适配器
   */
  async init() {
    try {
      // 检查当前配置是否为云端配置
      const currentConfig = window.unifiedDataManager.getCurrentConfig();
      this.isSupabaseEnabled = currentConfig.type === 'supabase';

      if (this.isSupabaseEnabled) {
        // 获取 Supabase 配置
        const result = await this.getFromChromeStorageSync(['supabase_config']);
        this.currentSupabaseConfig = result.supabase_config;
      }

      console.log('SyncAdapter: 初始化完成', {
        isSupabaseEnabled: this.isSupabaseEnabled,
        configType: currentConfig.type
      });
    } catch (error) {
      console.error('SyncAdapter: 初始化失败:', error);
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    const currentConfig = window.unifiedDataManager.getCurrentConfig();
    return {
      isSupabaseEnabled: this.isSupabaseEnabled,
      currentConfigId: currentConfig.configId,
      currentConfigType: currentConfig.type,
      lastSyncTime: this.lastSyncTime,
      supabaseConfig: this.currentSupabaseConfig
    };
  }

  /**
   * 启用云端同步
   */
  async enableCloudSync(supabaseConfig, userId, displayName) {
    try {
      console.log('SyncAdapter: 启用云端同步', { userId, displayName });
      
      // 添加云端配置
      await window.unifiedDataManager.addCloudConfig(displayName, userId, supabaseConfig);

      // 切换到云端配置
      await window.unifiedDataManager.switchConfig(userId);
      
      // 更新状态
      this.isSupabaseEnabled = true;
      this.currentSupabaseConfig = { ...supabaseConfig, userId };
      this.lastSyncTime = new Date().toISOString();
      
      console.log('SyncAdapter: 云端同步已启用');
      return true;
    } catch (error) {
      console.error('SyncAdapter: 启用云端同步失败:', error);
      throw error;
    }
  }

  /**
   * 禁用云端同步
   */
  async disableCloudSync() {
    try {
      console.log('SyncAdapter: 禁用云端同步');
      
      await window.unifiedDataManager.disableCloudSync();
      
      // 更新状态
      this.isSupabaseEnabled = false;
      this.currentSupabaseConfig = null;
      this.lastSyncTime = null;
      
      console.log('SyncAdapter: 云端同步已禁用');
      return true;
    } catch (error) {
      console.error('SyncAdapter: 禁用云端同步失败:', error);
      throw error;
    }
  }

  /**
   * 手动同步数据
   */
  async syncData() {
    try {
      if (!this.isSupabaseEnabled) {
        throw new Error('云端同步未启用');
      }
      
      console.log('SyncAdapter: 开始手动同步');
      
      // 重新加载当前配置数据（这会触发同步）
      await window.unifiedDataManager.loadCurrentConfigData();
      
      this.lastSyncTime = new Date().toISOString();
      console.log('SyncAdapter: 手动同步完成');
      
      return true;
    } catch (error) {
      console.error('SyncAdapter: 手动同步失败:', error);
      throw error;
    }
  }

  /**
   * 测试 Supabase 连接
   */
  async testSupabaseConnection(config) {
    try {
      console.log('SyncAdapter: 测试 Supabase 连接');
      
      // 创建临时客户端进行测试
      const testClient = new SupabaseClient();
      await testClient.init(config);
      
      // 尝试连接测试
      const isConnected = await testClient.testConnection();
      
      console.log('SyncAdapter: 连接测试结果:', isConnected);
      return isConnected;
    } catch (error) {
      console.error('SyncAdapter: 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 导出数据
   */
  async exportData() {
    try {
      const currentData = window.unifiedDataManager.getCurrentConfigData();
      const currentConfig = window.unifiedDataManager.getCurrentConfig();
      
      return {
        ...currentData,
        exportInfo: {
          configId: currentConfig.configId,
          configType: currentConfig.type,
          exportDate: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error) {
      console.error('SyncAdapter: 导出数据失败:', error);
      throw error;
    }
  }

  /**
   * 导入数据
   */
  async importData(importedData) {
    try {
      console.log('SyncAdapter: 导入数据');
      
      // 清理导入数据
      const cleanData = {
        categories: importedData.categories || [],
        settings: importedData.settings || { viewMode: 'grid' },
        themeSettings: importedData.themeSettings || {
          theme: 'default',
          backgroundImageUrl: null,
          backgroundImagePath: null,
          backgroundOpacity: 30
        }
      };
      
      // 保存数据
      await window.unifiedDataManager.saveCurrentConfigData(cleanData);
      
      console.log('SyncAdapter: 数据导入完成');
      return true;
    } catch (error) {
      console.error('SyncAdapter: 导入数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有配置列表
   */
  getAllConfigs() {
    return window.unifiedDataManager.getAllConfigs();
  }

  /**
   * 切换配置
   */
  async switchConfig(configId) {
    try {
      await window.unifiedDataManager.switchConfig(configId);

      // 更新同步状态
      const newConfig = window.unifiedDataManager.getCurrentConfig();
      this.isSupabaseEnabled = newConfig.type === 'supabase';
      
      if (this.isSupabaseEnabled) {
        const result = await this.getFromChromeStorageSync(['supabase_config']);
        this.currentSupabaseConfig = result.supabase_config;
      } else {
        this.currentSupabaseConfig = null;
      }
      
      console.log('SyncAdapter: 配置切换完成', configId);
      return true;
    } catch (error) {
      console.error('SyncAdapter: 配置切换失败:', error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(configId) {
    try {
      await window.unifiedDataManager.deleteConfig(configId);
      console.log('SyncAdapter: 配置删除完成', configId);
      return true;
    } catch (error) {
      console.error('SyncAdapter: 配置删除失败:', error);
      throw error;
    }
  }

  /**
   * Chrome Storage Sync 操作
   */
  async getFromChromeStorageSync(keys) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        resolve({});
      }
    });
  }

  async setToChromeStorageSync(data) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(data, resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * 兼容性方法：保存数据
   */
  async saveData(data, options = {}) {
    return await window.unifiedDataManager.saveCurrentConfigData(data);
  }

  /**
   * 兼容性方法：加载数据
   */
  async loadData(preferCloud = false, forceRefresh = false) {
    if (forceRefresh) {
      await window.unifiedDataManager.loadCurrentConfigData();
    }
    return window.unifiedDataManager.getCurrentConfigData();
  }

  /**
   * 兼容性方法：获取当前存储键
   */
  getCurrentStorageKey() {
    const currentConfig = window.unifiedDataManager.getCurrentConfig();
    return `cardTabData_${currentConfig.configId}`;
  }

  /**
   * 兼容性方法：清除缓存
   */
  async clearChromeStorageCache() {
    const currentConfig = window.unifiedDataManager.getCurrentConfig();
    await window.unifiedDataManager.clearCache(currentConfig.configId);
  }

  /**
   * 获取 Supabase 配置
   */
  async getSupabaseConfig() {
    const result = await this.getFromChromeStorageSync(['supabase_config']);
    return result.supabase_config;
  }

  /**
   * 启用 Supabase 同步
   */
  async enableSupabaseSync(config) {
    return await this.enableCloudSync(config, config.userId, `云端配置 (${config.userId})`);
  }

  /**
   * 禁用 Supabase 同步
   */
  async disableSupabaseSync() {
    return await this.disableCloudSync();
  }

  /**
   * 手动同步
   */
  async manualSync() {
    return await this.syncData();
  }

  /**
   * 保存 Supabase 配置
   */
  async saveSupabaseConfig(config) {
    await this.setToChromeStorageSync({
      supabase_config: config
    });
  }
}

// 创建全局实例，替换原有的 syncManager
window.syncManager = new SyncAdapter();

/**
 * 主题配置适配器
 * 为 theme-config-ui.js 提供兼容接口
 */
class ThemeConfigAdapter {
  constructor() {
    this.configs = [];
  }

  async init() {
    // 从统一数据管理器获取配置信息
    this.configs = window.unifiedDataManager.getAllConfigs();
  }

  getAllConfigs() {
    return window.unifiedDataManager.getAllConfigs();
  }

  getActiveConfig() {
    const currentConfig = window.unifiedDataManager.getCurrentConfig();
    return {
      id: currentConfig.configId,
      displayName: currentConfig.displayName,
      userId: currentConfig.userId,
      supabaseUrl: currentConfig.supabaseUrl || '',
      supabaseKey: currentConfig.supabaseKey || ''
    };
  }

  async isSupabaseConfigured() {
    const result = await syncManager.getSupabaseConfig();
    return result && result.enabled && result.url && result.anonKey;
  }

  async getCurrentSupabaseConfig() {
    return await syncManager.getSupabaseConfig() || {};
  }

  configExists(userId) {
    const configs = this.getAllConfigs();
    return configs.some(config => config.configId === userId);
  }

  async addConfig(configData) {
    // 获取当前的 Supabase 配置信息
    let supabaseConfig;

    if (configData.supabaseUrl && configData.supabaseKey) {
      // 如果传入了具体的 Supabase 配置，使用传入的配置
      supabaseConfig = {
        url: configData.supabaseUrl,
        anonKey: configData.supabaseKey
      };
    } else {
      // 否则使用当前的 Supabase 配置
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['supabase_config'], resolve);
      });
      const currentConfig = result.supabase_config;

      if (!currentConfig || !currentConfig.url || !currentConfig.anonKey) {
        throw new Error('无法获取 Supabase 配置信息，请先启用云端同步');
      }

      supabaseConfig = {
        url: currentConfig.url,
        anonKey: currentConfig.anonKey
      };
    }

    return await window.unifiedDataManager.addCloudConfig(
      configData.displayName,
      configData.userId,
      supabaseConfig
    );
  }

  async switchConfig(configId) {
    await window.unifiedDataManager.switchConfig(configId);
    return this.getActiveConfig();
  }

  async updateConfig(configId, updates) {
    // 简化实现：目前只支持更新显示名称
    console.log('ThemeConfigAdapter: updateConfig not fully implemented', configId, updates);
  }

  async deleteConfig(configId) {
    return await window.unifiedDataManager.deleteConfig(configId);
  }
}

// 创建全局实例
window.themeConfigManager = new ThemeConfigAdapter();
