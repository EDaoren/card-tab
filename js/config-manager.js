/**
 * 配置管理器
 * 处理多套Supabase配置的存储、管理和切换
 */

class ConfigManager {
  constructor() {
    this.configs = [];
    this.activeConfigId = null;
    this.isInitialized = false;
  }

  /**
   * 初始化配置管理器
   */
  async init() {
    if (this.isInitialized) return;
    
    await this.loadConfigs();
    this.isInitialized = true;
    console.log('ConfigManager: 初始化完成', { configs: this.configs.length });
  }

  /**
   * 加载所有保存的配置
   */
  async loadConfigs() {
    try {
      const data = await this.getStorageData(['savedConfigs', 'activeConfigId']);
      this.configs = data.savedConfigs || [];
      this.activeConfigId = data.activeConfigId || null;
      
      // 如果没有活跃配置但有配置列表，设置第一个为活跃
      if (!this.activeConfigId && this.configs.length > 0) {
        this.activeConfigId = this.configs[0].id;
        await this.saveActiveConfigId(this.activeConfigId);
      }
    } catch (error) {
      console.error('ConfigManager: 加载配置失败', error);
      this.configs = [];
      this.activeConfigId = null;
    }
  }

  /**
   * 保存配置到存储
   */
  async saveConfigs() {
    try {
      await this.setStorageData({
        savedConfigs: this.configs,
        activeConfigId: this.activeConfigId
      });
    } catch (error) {
      console.error('ConfigManager: 保存配置失败', error);
      throw error;
    }
  }

  /**
   * 添加新配置
   */
  async addConfig(config) {
    const configId = this.generateConfigId();
    const newConfig = {
      id: configId,
      displayName: config.displayName || `配置 ${this.configs.length + 1}`,
      userId: config.userId,
      supabaseUrl: config.url,
      supabaseKey: config.anonKey,
      createdAt: new Date().toISOString(),
      lastSync: null,
      shortcutCount: 0,
      isActive: false
    };

    this.configs.push(newConfig);
    
    // 如果这是第一个配置，设为活跃
    if (this.configs.length === 1) {
      this.activeConfigId = configId;
      newConfig.isActive = true;
    }

    await this.saveConfigs();
    return newConfig;
  }

  /**
   * 更新配置
   */
  async updateConfig(configId, updates) {
    const configIndex = this.configs.findIndex(c => c.id === configId);
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    this.configs[configIndex] = { ...this.configs[configIndex], ...updates };
    await this.saveConfigs();
    return this.configs[configIndex];
  }

  /**
   * 删除配置
   */
  async deleteConfig(configId) {
    const configIndex = this.configs.findIndex(c => c.id === configId);
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    // 如果删除的是活跃配置，需要切换到其他配置
    if (this.activeConfigId === configId) {
      const remainingConfigs = this.configs.filter(c => c.id !== configId);
      this.activeConfigId = remainingConfigs.length > 0 ? remainingConfigs[0].id : null;
    }

    this.configs.splice(configIndex, 1);
    await this.saveConfigs();
  }

  /**
   * 切换活跃配置
   */
  async switchConfig(configId) {
    const config = this.configs.find(c => c.id === configId);
    if (!config) {
      throw new Error('配置不存在');
    }

    // 更新活跃状态
    this.configs.forEach(c => c.isActive = false);
    config.isActive = true;
    this.activeConfigId = configId;

    await this.saveConfigs();
    return config;
  }

  /**
   * 获取活跃配置
   */
  getActiveConfig() {
    return this.configs.find(c => c.id === this.activeConfigId);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs() {
    return [...this.configs];
  }

  /**
   * 更新配置的同步信息
   */
  async updateSyncInfo(configId, syncInfo) {
    const config = this.configs.find(c => c.id === configId);
    if (config) {
      config.lastSync = syncInfo.lastSync || new Date().toISOString();
      config.shortcutCount = syncInfo.shortcutCount || 0;
      await this.saveConfigs();
    }
  }

  /**
   * 检查配置是否存在
   */
  configExists(userId, supabaseUrl) {
    return this.configs.some(c => 
      c.userId === userId && c.supabaseUrl === supabaseUrl
    );
  }

  /**
   * 生成配置ID
   */
  generateConfigId() {
    return 'config_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 保存活跃配置ID
   */
  async saveActiveConfigId(configId) {
    this.activeConfigId = configId;
    await this.setStorageData({ activeConfigId: configId });
  }

  /**
   * 获取存储数据
   */
  async getStorageData(keys) {
    if (chrome && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    } else {
      const result = {};
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            result[key] = JSON.parse(item);
          } catch (e) {
            result[key] = item;
          }
        }
      });
      return result;
    }
  }

  /**
   * 设置存储数据
   */
  async setStorageData(data) {
    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set(data);
    } else {
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
    }
  }

  /**
   * 导出配置
   */
  exportConfig(configId) {
    const config = this.configs.find(c => c.id === configId);
    if (!config) {
      throw new Error('配置不存在');
    }

    return {
      displayName: config.displayName,
      userId: config.userId,
      supabaseUrl: config.supabaseUrl,
      // 注意：不导出密钥，安全考虑
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * 导入配置
   */
  async importConfig(configData, supabaseKey) {
    if (this.configExists(configData.userId, configData.supabaseUrl)) {
      throw new Error('该配置已存在');
    }

    return await this.addConfig({
      displayName: configData.displayName,
      userId: configData.userId,
      url: configData.supabaseUrl,
      anonKey: supabaseKey
    });
  }
}

// 创建全局实例
const configManager = new ConfigManager();
window.configManager = configManager;
