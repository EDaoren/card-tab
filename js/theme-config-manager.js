/**
 * 主题配置管理器
 * 处理多套用户配置的管理和切换
 */

class ThemeConfigManager {
  constructor() {
    this.configs = [];
    this.activeConfigId = null;
    this.isInitialized = false;
    this.DEFAULT_CONFIG_ID = 'default';
  }

  /**
   * 初始化配置管理器
   */
  async init() {
    if (this.isInitialized) return;

    await this.loadConfigs();
    await this.forceEnsureDefaultConfig();

    this.isInitialized = true;
    console.log('ThemeConfigManager: 初始化完成');
  }

  /**
   * 确保默认配置存在
   * 修改：初始化时不自动保存，避免不必要的Supabase操作
   */
  async ensureDefaultConfig() {
    const defaultConfig = this.configs.find(c => c.id === this.DEFAULT_CONFIG_ID);

    if (!defaultConfig) {
      console.log('ThemeConfigManager: Creating default config in memory (not saving automatically)');

      // 创建默认配置（只在内存中，不自动保存）
      const newDefaultConfig = {
        id: this.DEFAULT_CONFIG_ID,
        displayName: '默认配置',
        userId: 'default',
        supabaseUrl: '',
        supabaseKey: '',
        isActive: true,
        isDefault: true,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        lastSync: null,
        shortcutCount: 0
      };

      this.configs.unshift(newDefaultConfig);
      this.activeConfigId = this.DEFAULT_CONFIG_ID;
      // 不自动保存，用户操作时才保存
    } else if (!this.activeConfigId) {
      // 如果没有活跃配置，激活默认配置（只在内存中）
      this.activeConfigId = this.DEFAULT_CONFIG_ID;
      defaultConfig.isActive = true;
      // 不自动保存，用户操作时才保存
      console.log('ThemeConfigManager: Default config activated in memory');
    }
  }

  /**
   * 强制确保默认配置存在（用于修复丢失的默认配置）
   * 修改：初始化时不自动保存，避免不必要的Supabase操作
   */
  async forceEnsureDefaultConfig() {
    let defaultConfig = this.configs.find(c => c.id === this.DEFAULT_CONFIG_ID);

    if (!defaultConfig) {
      console.log('ThemeConfigManager: Creating default config in memory (not saving automatically)');

      // 创建默认配置（只在内存中，不自动保存）
      defaultConfig = {
        id: this.DEFAULT_CONFIG_ID,
        displayName: '默认配置',
        userId: 'default',
        supabaseUrl: '',
        supabaseKey: '',
        isActive: true,
        isDefault: true,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        lastSync: null,
        shortcutCount: 0
      };

      this.configs.unshift(defaultConfig);

      if (!this.activeConfigId) {
        this.activeConfigId = this.DEFAULT_CONFIG_ID;
      }

      // 不自动保存，用户真正操作时才会触发保存
      console.log('ThemeConfigManager: Default config created in memory, will save when user makes changes');
    } else if (!defaultConfig.isDefault) {
      // 确保默认配置有正确的属性（只在内存中修改）
      defaultConfig.isDefault = true;
      console.log('ThemeConfigManager: Default config properties updated in memory');
    }
  }

  /**
   * 加载所有保存的配置
   */
  async loadConfigs() {
    try {
      const data = await this.getStorageData(['themeConfigs', 'activeThemeConfigId']);
      const rawConfigs = data.themeConfigs || [];

      // 过滤掉无效配置
      this.configs = rawConfigs.filter(config =>
        config &&
        typeof config === 'object' &&
        config.id &&
        config.displayName
      );

      this.activeConfigId = data.activeThemeConfigId || null;

      // 如果没有活跃配置但有配置列表，设置第一个为活跃
      if (!this.activeConfigId && this.configs.length > 0) {
        this.activeConfigId = this.configs[0].id;
        await this.saveActiveConfigId(this.activeConfigId);
      }
    } catch (error) {
      console.error('ThemeConfigManager: 加载配置失败', error);
      this.configs = [];
      this.activeConfigId = null;
    }
  }

  /**
   * 保存配置到存储 - 旁路缓存模式
   */
  async saveConfigs() {
    // 直接调用旁路缓存模式保存
    await this.saveConfigsWithCacheAside();
  }

  /**
   * 旁路缓存模式保存配置（统一方法）
   */
  async saveConfigsWithCacheAside() {
    try {
      // 过滤掉无效配置和默认配置
      const configsToSave = this.configs.filter(config =>
        config &&
        typeof config === 'object' &&
        config.id &&
        config.displayName &&
        config.id !== this.DEFAULT_CONFIG_ID
      );

      // 1. 保存到本地存储
      await this.setStorageData({
        themeConfigs: configsToSave,
        activeThemeConfigId: this.activeConfigId
      });

      // 2. 如果启用了云端同步，使用旁路缓存模式
      if (typeof syncManager !== 'undefined' && syncManager.isSupabaseEnabled) {
        // 获取当前Supabase数据
        const currentData = await syncManager.loadFromSupabase() || {};

        // 更新配置列表
        const updatedData = {
          ...currentData,
          themeConfigs: configsToSave,
          _metadata: {
            ...currentData._metadata,
            lastModified: new Date().toISOString(),
            source: 'themeConfigManager'
          }
        };

        // 保存到Supabase
        await syncManager.saveToSupabase(updatedData);

        // 清除配置缓存
        await this.clearConfigCache();
      }

    } catch (error) {
      console.error('ThemeConfigManager: 保存配置失败', error);
      throw error;
    }
  }

  /**
   * 清除配置缓存
   */
  async clearConfigCache() {
    try {
      // 清除本地配置缓存（保留默认配置）
      const defaultConfig = this.configs.find(c => c.id === this.DEFAULT_CONFIG_ID);
      this.configs = defaultConfig ? [defaultConfig] : [];

      console.log('ThemeConfigManager: 配置缓存已清除');
    } catch (error) {
      console.warn('ThemeConfigManager: 清除配置缓存失败:', error);
    }
  }

  /**
   * 添加新配置（使用当前Supabase连接）- 旁路缓存模式
   */
  async addConfig(config) {
    const configId = this.generateConfigId();

    // 获取当前的Supabase连接配置
    const currentSupabaseConfig = await this.getCurrentSupabaseConfig();

    const newConfig = {
      id: configId,
      displayName: config.displayName || `配置 ${this.configs.length + 1}`,
      userId: config.userId,
      supabaseUrl: currentSupabaseConfig.url,
      supabaseKey: currentSupabaseConfig.anonKey,
      createdAt: new Date().toISOString(),
      lastSync: null,
      shortcutCount: 0,
      isActive: false,
      isDefault: false
    };

    this.configs.push(newConfig);

    // 如果这是第一个非默认配置，设为活跃
    if (this.configs.filter(c => !c.isDefault).length === 1) {
      this.activeConfigId = configId;
      newConfig.isActive = true;
      // 将默认配置设为非活跃
      const defaultConfig = this.configs.find(c => c.isDefault);
      if (defaultConfig) {
        defaultConfig.isActive = false;
      }
    }

    // 旁路缓存模式：保存并清除缓存
    await this.saveConfigsWithCacheAside();
    console.log('ThemeConfigManager: 新配置已添加并同步', newConfig.displayName);
    return newConfig;
  }

  /**
   * 创建云端配置
   */
  async createCloudConfig(supabaseConfig) {
    const configId = this.generateConfigId();
    const newConfig = {
      id: configId,
      displayName: '我的配置',
      userId: supabaseConfig.userId,
      supabaseUrl: supabaseConfig.url,
      supabaseKey: supabaseConfig.anonKey,
      isActive: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastSync: null,
      shortcutCount: 0
    };

    this.configs.push(newConfig);
    await this.saveConfigs();
    console.log('ThemeConfigManager: 创建云端配置', newConfig.displayName);
    return newConfig;
  }

  /**
   * 查找现有的云端配置
   */
  findExistingCloudConfig(supabaseConfig) {
    return this.configs.find(config => {
      // 优先匹配 userId + supabaseUrl 的组合
      return config.userId === supabaseConfig.userId &&
             config.supabaseUrl === supabaseConfig.url &&
             !config.isDefault;
    });
  }

  /**
   * 获取当前的Supabase连接配置
   */
  async getCurrentSupabaseConfig() {
    try {
      // 从syncManager获取当前配置
      if (typeof syncManager !== 'undefined') {
        return await syncManager.getSupabaseConfig();
      }
      
      // 如果syncManager不可用，从存储中直接获取
      const data = await this.getStorageData(['supabaseConfig']);
      return data.supabaseConfig || { url: '', anonKey: '' };
    } catch (error) {
      console.error('ThemeConfigManager: 获取Supabase配置失败', error);
      return { url: '', anonKey: '' };
    }
  }

  /**
   * 切换活跃配置
   */
  async switchConfig(configId) {
    console.log('ThemeConfigManager: 尝试切换到配置:', configId);
    console.log('ThemeConfigManager: 当前配置列表:', this.configs.map(c => ({ id: c.id, displayName: c.displayName, isDefault: c.isDefault })));

    // 如果切换到默认配置，强制确保默认配置存在
    if (configId === this.DEFAULT_CONFIG_ID) {
      console.log('ThemeConfigManager: 切换到默认配置，强制确保默认配置存在');

      // 直接检查并创建默认配置
      let defaultConfig = this.configs.find(c => c.id === this.DEFAULT_CONFIG_ID);
      if (!defaultConfig) {
        console.log('ThemeConfigManager: 默认配置不存在，立即创建');
        defaultConfig = {
          id: this.DEFAULT_CONFIG_ID,
          displayName: '默认配置',
          userId: 'default',
          supabaseUrl: '',
          supabaseKey: '',
          isActive: true,
          isDefault: true,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          lastSync: null,
          shortcutCount: 0
        };

        this.configs.unshift(defaultConfig);

        // 立即保存并返回，不继续执行后面的查找逻辑
        this.configs.forEach(c => c.isActive = false);
        defaultConfig.isActive = true;
        this.activeConfigId = this.DEFAULT_CONFIG_ID;

        await this.saveConfigs();
        console.log('ThemeConfigManager: 默认配置创建并激活成功');
        return defaultConfig;
      }
    }

    const config = this.configs.find(c => c.id === configId);
    if (!config) {
      console.error('ThemeConfigManager: 配置仍然不存在:', configId);
      console.error('ThemeConfigManager: 可用配置:', this.configs.map(c => c.id));

      // 最后的保护：如果是默认配置且仍然不存在，重建整个配置系统
      if (configId === this.DEFAULT_CONFIG_ID) {
        console.log('ThemeConfigManager: 最后保护机制，重建配置系统');
        const rebuiltDefault = await this.rebuildConfigSystem();
        console.log('ThemeConfigManager: 配置系统重建成功');
        return rebuiltDefault;
      }

      throw new Error(`配置不存在: ${configId}`);
    }

    // 更新活跃状态
    this.configs.forEach(c => c.isActive = false);
    config.isActive = true;
    this.activeConfigId = configId;

    await this.saveConfigs();
    console.log('ThemeConfigManager: 切换到配置成功', config.displayName);

    // 确保配置切换时的数据隔离
    await this.ensureConfigDataIsolation(config);

    return config;
  }

  /**
   * 确保配置数据隔离
   */
  async ensureConfigDataIsolation(config) {
    try {
      console.log('🔄 ThemeConfigManager: 确保配置数据隔离...');
      console.log(`  - 切换到配置: ${config.displayName} (${config.id})`);

      // 更新syncManager的配置状态
      if (typeof syncManager !== 'undefined') {
        if (config.isDefault) {
          // 切换到默认配置：禁用云端同步
          console.log('  - 切换到默认配置，禁用云端同步');
          syncManager.isSupabaseEnabled = false;
          syncManager.currentSupabaseConfig = null;
        } else {
          // 切换到云端配置：启用云端同步并更新配置
          console.log('  - 切换到云端配置，启用云端同步');
          syncManager.isSupabaseEnabled = true;
          syncManager.currentSupabaseConfig = {
            url: config.supabaseUrl,
            anonKey: config.supabaseKey,
            userId: config.userId,
            enabled: true
          };

          // 重新初始化Supabase连接
          if (typeof supabaseClient !== 'undefined') {
            await supabaseClient.initialize({
              url: config.supabaseUrl,
              anonKey: config.supabaseKey,
              userId: config.userId
            });
            console.log('  - Supabase连接已重新初始化');
          }
        }

        // 使用统一的配置刷新入口
        if (typeof refreshCurrentConfiguration === 'function') {
          await refreshCurrentConfiguration();
          console.log('  - 配置数据已通过统一入口刷新');
        } else if (typeof reloadThemeAfterConfigSwitch === 'function') {
          await reloadThemeAfterConfigSwitch();
          console.log('  - 主题设置已重新加载（备选方案1）');
        } else if (typeof loadThemeSettings === 'function') {
          await loadThemeSettings();
          console.log('  - 主题设置已重新加载（备选方案2）');
        }
      }

      console.log('🔄 ThemeConfigManager: 配置数据隔离确保完成');
    } catch (error) {
      console.error('🔄 ThemeConfigManager: 确保配置数据隔离失败:', error);
    }
  }

  /**
   * 获取活跃配置
   */
  getActiveConfig() {
    return this.configs.find(c => c.id === this.activeConfigId);
  }

  /**
   * 获取所有配置（排除默认配置，因为默认配置不应该出现在云端配置管理中）
   */
  getAllConfigs() {
    // 过滤掉默认配置和无效配置
    return this.configs.filter(config =>
      config &&
      config.id !== this.DEFAULT_CONFIG_ID &&
      !config.isDefault &&
      config.id &&
      config.displayName
    );
  }

  /**
   * 清理无效和重复的配置
   */
  async cleanupInvalidConfigs() {
    console.log('ThemeConfigManager: 开始清理无效配置');
    console.log('ThemeConfigManager: 清理前配置数量:', this.configs.length);

    // 1. 过滤掉无效配置
    const validConfigs = this.configs.filter(config => {
      // 保留默认配置
      if (config.id === this.DEFAULT_CONFIG_ID) {
        return true;
      }

      // 过滤掉无效的云端配置
      return config &&
             typeof config === 'object' &&
             config.id &&
             config.displayName &&
             config.userId &&
             config.id !== 'default' &&  // 排除错误的默认配置ID
             !config.id.startsWith('default') &&  // 排除类似 default1 的错误配置
             !config.isDefault;  // 排除标记为默认的配置
    });

    // 2. 清理重复配置
    const configGroups = {};
    validConfigs.forEach(config => {
      if (!config.isDefault) {
        const key = `${config.userId}@${config.supabaseUrl}`;
        if (!configGroups[key]) {
          configGroups[key] = [];
        }
        configGroups[key].push(config);
      }
    });

    // 保留最新的，删除重复的
    const finalConfigs = [];
    Object.values(configGroups).forEach(group => {
      if (group.length > 1) {
        // 按创建时间排序，保留最新的
        group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        finalConfigs.push(group[0]);
        console.log('ThemeConfigManager: 清理重复配置，保留最新的:', group[0].displayName);
      } else {
        finalConfigs.push(group[0]);
      }
    });

    // 添加默认配置
    const defaultConfig = validConfigs.find(c => c.id === this.DEFAULT_CONFIG_ID);
    if (defaultConfig) {
      finalConfigs.unshift(defaultConfig);
    }

    if (finalConfigs.length !== this.configs.length) {
      console.log('ThemeConfigManager: 发现无效/重复配置，清理中...');
      console.log('ThemeConfigManager: 清理后配置数量:', finalConfigs.length);

      this.configs = finalConfigs;
      await this.saveConfigs();

      console.log('ThemeConfigManager: 配置清理完成');
    } else {
      console.log('ThemeConfigManager: 没有发现无效或重复配置');
    }
  }

  /**
   * 更新配置信息 - 旁路缓存模式
   */
  async updateConfig(configId, updates) {
    const config = this.configs.find(c => c.id === configId);
    if (config) {
      Object.assign(config, updates);
      config.lastModified = new Date().toISOString();

      // 旁路缓存模式：保存并清除缓存
      await this.saveConfigsWithCacheAside();
      console.log('ThemeConfigManager: 配置已更新并同步', config.displayName);
    }
  }

  /**
   * 更新配置的同步信息 - 旁路缓存模式
   */
  async updateSyncInfo(configId, syncInfo) {
    const config = this.configs.find(c => c.id === configId);
    if (config) {
      config.lastSync = syncInfo.lastSync || new Date().toISOString();
      config.shortcutCount = syncInfo.shortcutCount || 0;

      // 旁路缓存模式：保存并清除缓存
      await this.saveConfigsWithCacheAside();
    }
  }



  /**
   * 检查配置是否存在
   */
  configExists(userId) {
    return this.configs.some(c => c.userId === userId);
  }

  /**
   * 删除配置 - 旁路缓存模式
   */
  async deleteConfig(configId) {
    const configIndex = this.configs.findIndex(c => c.id === configId);
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    const configToDelete = this.configs[configIndex];
    console.log('ThemeConfigManager: 准备删除配置', configToDelete.displayName);

    // 如果删除的是活跃配置，需要切换到其他配置
    if (this.activeConfigId === configId) {
      const remainingConfigs = this.configs.filter(c => c.id !== configId);
      if (remainingConfigs.length > 0) {
        // 优先切换到默认配置，如果没有则切换到第一个配置
        const defaultConfig = remainingConfigs.find(c => c.isDefault);
        this.activeConfigId = defaultConfig ? defaultConfig.id : remainingConfigs[0].id;
      } else {
        this.activeConfigId = null;
      }
    }

    // 从本地配置列表中移除
    this.configs.splice(configIndex, 1);

    // 旁路缓存模式：保存并清除缓存
    await this.saveConfigsWithCacheAside();

    // 如果启用了云端同步，还需要从云端删除相关数据
    if (typeof syncManager !== 'undefined' && syncManager.isSupabaseEnabled && !configToDelete.isDefault) {
      await this.deleteConfigFromCloud(configToDelete);
    }

    console.log('ThemeConfigManager: 配置删除完成', configToDelete.displayName);
  }

  /**
   * 从云端删除配置相关数据
   */
  async deleteConfigFromCloud(config) {
    try {
      // 如果这个配置有对应的云端数据，需要删除
      if (config.userId && config.supabaseUrl) {
        console.log('ThemeConfigManager: 删除云端配置数据', config.userId);

        // 这里可以根据需要决定是否删除云端的用户数据
        // 目前只删除配置列表中的引用，不删除实际的用户数据
        console.log('ThemeConfigManager: 云端配置引用已删除');
      }
    } catch (error) {
      console.warn('ThemeConfigManager: 删除云端配置数据失败:', error);
      // 不抛出错误，因为本地删除已经成功
    }
  }

  /**
   * 检查是否已配置Supabase
   */
  async isSupabaseConfigured() {
    try {
      if (typeof syncManager !== 'undefined') {
        const status = syncManager.getSyncStatus();
        return status.isSupabaseEnabled;
      }

      const data = await this.getStorageData(['supabaseConfig']);
      const config = data.supabaseConfig;
      return config && config.url && config.anonKey && config.userId;
    } catch (error) {
      console.error('ThemeConfigManager: 检查Supabase配置失败', error);
      return false;
    }
  }

  /**
   * 生成配置ID
   */
  generateConfigId() {
    return 'theme_config_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 保存活跃配置ID
   */
  async saveActiveConfigId(configId) {
    this.activeConfigId = configId;
    await this.setStorageData({ activeThemeConfigId: configId });
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
      // Development environment - return empty result
      console.warn('Chrome Storage不可用，返回空结果');
      const result = {};
      keys.forEach(key => {
        result[key] = undefined;
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
      // Development environment - skip saving
      console.warn('Chrome Storage不可用，跳过数据保存');
    }
  }

  /**
   * 重建配置系统（紧急修复方法）
   */
  async rebuildConfigSystem() {
    console.log('ThemeConfigManager: 开始重建配置系统');

    // 备份现有配置
    const backupConfigs = [...this.configs];

    // 重置配置数组
    this.configs = [];
    this.activeConfigId = null;

    // 强制创建默认配置
    const defaultConfig = {
      id: this.DEFAULT_CONFIG_ID,
      displayName: '默认配置',
      userId: 'default',
      supabaseUrl: '',
      supabaseKey: '',
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastSync: null,
      shortcutCount: 0
    };

    this.configs.push(defaultConfig);
    this.activeConfigId = this.DEFAULT_CONFIG_ID;

    // 恢复非默认配置
    backupConfigs.forEach(config => {
      if (config.id !== this.DEFAULT_CONFIG_ID && !config.isDefault) {
        config.isActive = false; // 确保只有默认配置是活跃的
        this.configs.push(config);
      }
    });

    // 保存重建的配置
    await this.saveConfigs();

    console.log('ThemeConfigManager: 配置系统重建完成，配置数量:', this.configs.length);
    return defaultConfig;
  }
}

// 创建全局实例
const themeConfigManager = new ThemeConfigManager();
window.themeConfigManager = themeConfigManager;
