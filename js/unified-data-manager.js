/**
 * 统一数据管理器
 * 基于新的数据结构设计，统一管理所有配置和数据
 */

class UnifiedDataManager {
  constructor() {
    this.appData = null;
    this.currentConfigData = null;
    this.supabaseClient = null;
    
    // 存储键名常量
    this.STORAGE_KEYS = {
      APP_DATA: 'app_data',
      SUPABASE_CONFIG: 'supabase_config',
      CONFIG_DATA: (configId) => `cardTabData_${configId}`
    };
    
    // 默认配置ID
    this.DEFAULT_CONFIG_ID = 'default';
  }

  /**
   * 初始化数据管理器
   */
  async init() {
    try {
      console.log('UnifiedDataManager: 开始初始化...');
      
      // 1. 加载应用配置数据
      await this.loadAppData();
      
      // 2. 初始化 Supabase 客户端
      await this.initSupabaseClient();
      
      // 3. 加载当前配置的数据
      await this.loadCurrentConfigData();
      
      console.log('UnifiedDataManager: 初始化完成');
      return this.currentConfigData;
    } catch (error) {
      console.error('UnifiedDataManager: 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载应用配置数据 (app_data)
   */
  async loadAppData() {
    try {
      const result = await this.getFromChromeStorageLocal([this.STORAGE_KEYS.APP_DATA]);
      this.appData = result[this.STORAGE_KEYS.APP_DATA];
      
      if (!this.appData) {
        console.log('UnifiedDataManager: 未找到 app_data，创建默认配置');
        await this.createDefaultAppData();
      } else {
        console.log('UnifiedDataManager: 加载 app_data 成功');
        this.validateAppData();

        // 检查并恢复云端配置
        await this.recoverCloudConfigIfNeeded();
      }
    } catch (error) {
      console.error('UnifiedDataManager: 加载 app_data 失败:', error);
      await this.createDefaultAppData();
    }
  }

  /**
   * 创建默认的应用配置数据
   */
  async createDefaultAppData() {
    this.appData = {
      currentUser: {
        configId: this.DEFAULT_CONFIG_ID,
        displayName: '默认配置',
        userId: this.DEFAULT_CONFIG_ID
      },
      userConfigs: {
        [this.DEFAULT_CONFIG_ID]: {
          displayName: '默认配置',
          isActive: true,
          type: 'chrome',
          storageLocation: {
            key: this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID),
            type: 'sync'
          }
        }
      },
      configPaginationSettings: {
        pageSize: 5
      }
    };
    
    await this.saveAppData();
    console.log('UnifiedDataManager: 创建默认 app_data 完成');
  }

  /**
   * 验证应用配置数据的完整性
   */
  validateAppData() {
    if (!this.appData.currentUser || !this.appData.userConfigs) {
      throw new Error('app_data 结构不完整');
    }

    const currentConfigId = this.appData.currentUser.configId;
    if (!this.appData.userConfigs[currentConfigId]) {
      console.warn(`当前配置 ${currentConfigId} 不存在，切换到默认配置`);
      this.appData.currentUser = {
        configId: this.DEFAULT_CONFIG_ID,
        displayName: '默认配置',
        userId: this.DEFAULT_CONFIG_ID
      };
      this.appData.userConfigs[this.DEFAULT_CONFIG_ID].isActive = true;
    }
  }

  /**
   * 检查并恢复云端配置（如果需要）
   */
  async recoverCloudConfigIfNeeded() {
    try {
      // 检查是否有 Supabase 配置
      const result = await this.getFromChromeStorageSync([this.STORAGE_KEYS.SUPABASE_CONFIG]);
      const supabaseConfig = result[this.STORAGE_KEYS.SUPABASE_CONFIG];

      if (supabaseConfig && supabaseConfig.enabled && supabaseConfig.userId) {
        const userId = supabaseConfig.userId;

        // 检查 app_data 中是否已有此云端配置
        if (!this.appData.userConfigs[userId]) {
          console.log(`UnifiedDataManager: 恢复云端配置 ${userId}`);

          // 添加云端配置到 userConfigs
          this.appData.userConfigs[userId] = {
            displayName: `云端配置 (${userId})`,
            isActive: false,
            type: 'supabase',
            storageLocation: {
              type: 'supabase',
              userId: userId,
              cacheKey: this.STORAGE_KEYS.CONFIG_DATA(userId)
            }
          };

          // 如果当前用户就是这个云端配置，更新当前用户信息
          if (this.appData.currentUser.configId === userId) {
            this.appData.currentUser = {
              configId: userId,
              displayName: `云端配置 (${userId})`,
              userId: userId
            };
            this.appData.userConfigs[userId].isActive = true;
            this.appData.userConfigs[this.DEFAULT_CONFIG_ID].isActive = false;
          }

          // 保存更新后的 app_data
          await this.saveAppData();
          console.log(`UnifiedDataManager: 云端配置 ${userId} 恢复完成`);
        }
      }
    } catch (error) {
      console.warn('UnifiedDataManager: 恢复云端配置失败:', error);
    }
  }

  /**
   * 初始化 Supabase 客户端
   */
  async initSupabaseClient() {
    try {
      const supabaseConfig = await this.ensureSupabaseClientReady({ optional: true, shouldTest: false });
      if (supabaseConfig) {
        console.log('UnifiedDataManager: Supabase 客户端初始化成功');
      }
    } catch (error) {
      console.warn('UnifiedDataManager: Supabase 客户端初始化失败:', error);
      this.supabaseClient = null;
    }
  }

  /**
   * 获取当前激活的 Supabase 配置，确保 userId 与当前配置一致
   */
  async getActiveSupabaseConfig() {
    try {
      const result = await this.getFromChromeStorageSync([this.STORAGE_KEYS.SUPABASE_CONFIG]);
      const supabaseConfig = result[this.STORAGE_KEYS.SUPABASE_CONFIG];

      if (!supabaseConfig || !supabaseConfig.enabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
        return null;
      }

      const activeConfigId = this.appData?.currentUser?.configId || supabaseConfig.userId;

      if (activeConfigId && supabaseConfig.userId !== activeConfigId) {
        const updatedConfig = { ...supabaseConfig, userId: activeConfigId };
        await this.setToChromeStorageSync({
          [this.STORAGE_KEYS.SUPABASE_CONFIG]: updatedConfig
        });
        return updatedConfig;
      }

      return { ...supabaseConfig };
    } catch (error) {
      console.warn('UnifiedDataManager: 获取 Supabase 配置失败:', error);
      return null;
    }
  }

  /**
   * 确保 Supabase 客户端处于可用状态
   */
  async ensureSupabaseClientReady(options = {}) {
    const { shouldTest, optional = false } = options;
    const supabaseConfig = await this.getActiveSupabaseConfig();

    if (!supabaseConfig) {
      if (optional) {
        return null;
      }
      throw new Error('Supabase 配置不可用');
    }

    if (typeof SupabaseClient === 'undefined') {
      throw new Error('SupabaseClient 未定义');
    }

    if (!this.supabaseClient) {
      this.supabaseClient = new SupabaseClient();
    }

    const needsConnectionTest = typeof shouldTest === 'boolean'
      ? shouldTest
      : !this.supabaseClient.isConnected;

    await this.supabaseClient.initialize(supabaseConfig, needsConnectionTest);

    return supabaseConfig;
  }


  /**
   * 加载当前配置的数据
   */
  async loadCurrentConfigData(forceRefresh = false) {
    const currentConfig = this.getCurrentConfig();
    const configId = currentConfig.configId;
    
    try {
      let cachedData = null;

      if (!forceRefresh) {
        cachedData = await this.loadFromCache(configId);
        console.log(`UnifiedDataManager: 缓存数据检查 ${configId}:`, {
          hasCachedData: !!cachedData,
          hasMetadata: !!(cachedData && cachedData._metadata),
          hasCacheMetadata: !!(cachedData && cachedData._metadata && cachedData._metadata.cacheMetadata),
          isValid: cachedData ? this.isCacheValid(cachedData) : false
        });

        if (cachedData && this.isCacheValid(cachedData)) {
          console.log(`UnifiedDataManager: 从缓存加载配置 ${configId}`);
          this.currentConfigData = cachedData;
          return;
        }
      } else {
        console.log(`UnifiedDataManager: 强制刷新配置 ${configId}，跳过缓存`);
      }
      
      // 2. 从主存储加载
      console.log(`UnifiedDataManager: 从主存储加载配置 ${configId}${forceRefresh ? '（强制刷新）' : ''}`);
      const data = await this.loadFromMainStorage(currentConfig);
      
      if (data) {
        this.currentConfigData = data;
        // 缓存数据
        await this.saveToCache(configId, data);
      } else {
        // 使用默认数据
        this.currentConfigData = this.getDefaultConfigData();
        await this.saveToCache(configId, this.currentConfigData);
      }
      
    } catch (error) {
      console.error(`UnifiedDataManager: 加载配置 ${configId} 失败:`, error);
      this.currentConfigData = this.getDefaultConfigData();
    }
  }


  /**
   * 从缓存加载数据
   */
  async loadFromCache(configId) {
    try {
      const cacheKey = this.STORAGE_KEYS.CONFIG_DATA(configId);
      const result = await this.getFromChromeStorageLocal([cacheKey]);
      return result[cacheKey];
    } catch (error) {
      console.warn(`UnifiedDataManager: 缓存加载失败 ${configId}:`, error);
      return null;
    }
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid(data) {
    if (!data || !data._metadata || !data._metadata.cacheMetadata) {
      return false;
    }
    
    const cache = data._metadata.cacheMetadata;
    const now = new Date();
    const expiresAt = new Date(cache.expiresAt);
    
    return cache.isValid && now < expiresAt;
  }

  /**
   * 从主存储加载数据
   */
  async loadFromMainStorage(config) {
    if (config.type === 'chrome') {
      return await this.loadFromChromeSync(config);
    } else if (config.type === 'supabase') {
      return await this.loadFromSupabase(config);
    }
    return null;
  }

  /**
   * 从 Chrome Sync 加载数据
   */
  async loadFromChromeSync(config) {
    try {
      const result = await this.getFromChromeStorageSync([config.storageLocation.key]);
      return result[config.storageLocation.key];
    } catch (error) {
      console.error('UnifiedDataManager: Chrome Sync 加载失败:', error);
      return null;
    }
  }

  /**
   * 从 Supabase 加载数据
   */
  async loadFromSupabase(config) {
    try {
      await this.ensureSupabaseClientReady({ shouldTest: !this.supabaseClient?.isConnected });

      const rawData = await this.supabaseClient.loadData();

      if (rawData && rawData.data) {
        return rawData.data;
      }

      return rawData;
    } catch (error) {
      const shouldRetry = (
        this.supabaseClient &&
        typeof this.supabaseClient.isConnectionError === 'function' &&
        this.supabaseClient.isConnectionError(error)
      );

      if (shouldRetry) {
        console.warn('UnifiedDataManager: 从 Supabase 加载失败，尝试重新连接后重试:', error);
        try {
          await this.ensureSupabaseClientReady({ shouldTest: true });
          const retryData = await this.supabaseClient.loadData();
          if (retryData && retryData.data) {
            return retryData.data;
          }
          return retryData;
        } catch (retryError) {
          console.error('UnifiedDataManager: Supabase 加载重试仍然失败:', retryError);
          return null;
        }
      }

      console.error('UnifiedDataManager: Supabase 加载失败:', error);
      return null;
    }
  }


  /**
   * 获取默认配置数据
   */
  getDefaultConfigData() {
    return {
      categories: [
        {
          id: 'cat-1',
          name: '搜索引擎',
          color: '#4285f4',
          collapsed: false,
          order: 0,
          shortcuts: [
            {
              id: 'shortcut-1',
              name: '百度',
              url: 'https://www.baidu.com',
              iconType: 'letter',
              iconColor: '#2932e1',
              iconUrl: '',
              order: 0
            },
            {
              id: 'shortcut-2',
              name: '谷歌',
              url: 'https://www.google.com',
              iconType: 'letter',
              iconColor: '#4285f4',
              iconUrl: '',
              order: 1
            },
            {
              id: 'shortcut-3',
              name: '必应',
              url: 'https://www.bing.com',
              iconType: 'letter',
              iconColor: '#0078d4',
              iconUrl: '',
              order: 2
            }
          ]
        },
        {
          id: 'cat-2',
          name: '社交媒体',
          color: '#34a853',
          collapsed: false,
          order: 1,
          shortcuts: [
            {
              id: 'shortcut-4',
              name: '微博',
              url: 'https://weibo.com',
              iconType: 'letter',
              iconColor: '#ff8200',
              iconUrl: '',
              order: 0
            },
            {
              id: 'shortcut-5',
              name: '知乎',
              url: 'https://www.zhihu.com',
              iconType: 'letter',
              iconColor: '#0084ff',
              iconUrl: '',
              order: 1
            },
            {
              id: 'shortcut-6',
              name: 'Twitter',
              url: 'https://twitter.com',
              iconType: 'letter',
              iconColor: '#1da1f2',
              iconUrl: '',
              order: 2
            }
          ]
        },
        {
          id: 'cat-3',
          name: '开发工具',
          color: '#ea4335',
          collapsed: false,
          order: 2,
          shortcuts: [
            {
              id: 'shortcut-7',
              name: 'GitHub',
              url: 'https://github.com',
              iconType: 'letter',
              iconColor: '#24292e',
              iconUrl: '',
              order: 0
            },
            {
              id: 'shortcut-8',
              name: 'Stack Overflow',
              url: 'https://stackoverflow.com',
              iconType: 'letter',
              iconColor: '#f48024',
              iconUrl: '',
              order: 1
            },
            {
              id: 'shortcut-9',
              name: 'MDN',
              url: 'https://developer.mozilla.org',
              iconType: 'letter',
              iconColor: '#000000',
              iconUrl: '',
              order: 2
            }
          ]
        }
      ],
      settings: {
        viewMode: 'grid'
      },
      themeSettings: {
        theme: 'default',
        backgroundImageUrl: null,
        backgroundImagePath: null,
        backgroundOpacity: 30
      },
      _metadata: {
        lastModified: new Date().toISOString(),
        source: 'default'
      }
    };
  }

  /**
   * 获取当前配置信息
   */
  getCurrentConfig() {
    return {
      configId: this.appData.currentUser.configId,
      displayName: this.appData.currentUser.displayName,
      userId: this.appData.currentUser.userId,
      ...this.appData.userConfigs[this.appData.currentUser.configId]
    };
  }

  /**
   * 获取所有配置（兼容旧的 themeConfigManager.getAllConfigs）
   */
  getAllConfigs() {
    const configs = [];

    for (const [configId, config] of Object.entries(this.appData.userConfigs)) {
      // 跳过默认配置，因为它不应该出现在云端配置管理中
      if (configId === this.DEFAULT_CONFIG_ID) {
        continue;
      }

      configs.push({
        id: configId,
        displayName: config.displayName,
        userId: configId,
        type: config.type,
        isActive: config.isActive,
        createdAt: new Date().toISOString(), // 临时值，实际应该从数据中获取
        lastModified: new Date().toISOString() // 临时值，实际应该从数据中获取
      });
    }

    return configs;
  }

  /**
   * Chrome Storage Local 操作
   */
  async getFromChromeStorageLocal(keys) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        resolve({});
      }
    });
  }

  async setToChromeStorageLocal(data) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data, resolve);
      } else {
        resolve();
      }
    });
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
   * 保存应用配置数据
   */
  async saveAppData() {
    await this.setToChromeStorageLocal({
      [this.STORAGE_KEYS.APP_DATA]: this.appData
    });
  }

  /**
   * 保存数据到缓存
   */
  async saveToCache(configId, data) {
    const cacheKey = this.STORAGE_KEYS.CONFIG_DATA(configId);
    const cachedData = {
      ...data,
      _metadata: {
        ...data._metadata,
        cacheMetadata: {
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时
          isValid: true,
          source: data._metadata?.source || 'unknown',
          userId: configId
        }
      }
    };
    
    await this.setToChromeStorageLocal({
      [cacheKey]: cachedData
    });
  }

  /**
   * 保存当前配置数据（旁路缓存模式）
   */
  async saveCurrentConfigData(data) {
    const currentConfig = this.getCurrentConfig();
    const configId = currentConfig.configId;

    try {
      // 添加元数据
      const dataToSave = {
        ...data,
        _metadata: {
          lastModified: new Date().toISOString(),
          source: currentConfig.type === 'chrome' ? 'chrome' : 'supabase'
        }
      };

      // 1. 保存到主存储
      await this.saveToMainStorage(currentConfig, dataToSave);

      // 2. 清除缓存
      await this.clearCache(configId);

      // 3. 重新缓存
      await this.saveToCache(configId, dataToSave);

      // 4. 更新内存中的数据
      this.currentConfigData = dataToSave;

      console.log(`UnifiedDataManager: 配置 ${configId} 保存成功`);
    } catch (error) {
      console.error(`UnifiedDataManager: 配置 ${configId} 保存失败:`, error);
      throw error;
    }
  }

  /**
   * 保存到主存储
   */
  async saveToMainStorage(config, data) {
    if (config.type === 'chrome') {
      await this.saveToChromeSync(config, data);
    } else if (config.type === 'supabase') {
      await this.saveToSupabase(config, data);
    }
  }

  /**
   * 保存到 Chrome Sync
   */
  async saveToChromeSync(config, data) {
    await this.setToChromeStorageSync({
      [config.storageLocation.key]: data
    });
  }

  /**
   * 保存到 Supabase
   */
  async saveToSupabase(config, data) {
    try {
      await this.ensureSupabaseClientReady({ shouldTest: !this.supabaseClient?.isConnected });
      await this.supabaseClient.saveData(data);
    } catch (error) {
      const shouldRetry = (
        this.supabaseClient &&
        typeof this.supabaseClient.isConnectionError === 'function' &&
        this.supabaseClient.isConnectionError(error)
      );

      if (shouldRetry) {
        console.warn('UnifiedDataManager: 保存到 Supabase 失败，尝试重新连接后重试:', error);
        await this.ensureSupabaseClientReady({ shouldTest: true });
        await this.supabaseClient.saveData(data);
      } else {
        throw error;
      }
    }
  }


  /**
   * 清除指定配置的缓存
   */
  async clearCache(configId) {
    const cacheKey = this.STORAGE_KEYS.CONFIG_DATA(configId);

    if (chrome.storage && chrome.storage.local) {
      await new Promise((resolve) => {
        chrome.storage.local.remove([cacheKey], resolve);
      });
    }

    console.log(`UnifiedDataManager: 清除缓存 ${configId}`);
  }

  /**
   * 清除所有配置缓存（除了当前配置）
   */
  async clearAllCacheExceptCurrent() {
    const currentConfigId = this.appData.currentUser.configId;
    const allConfigIds = Object.keys(this.appData.userConfigs);

    for (const configId of allConfigIds) {
      if (configId !== currentConfigId) {
        await this.clearCache(configId);
      }
    }

    console.log('UnifiedDataManager: 清除所有非当前配置缓存');
  }

  /**
   * 发现并注册配置
   */
  async discoverAndRegisterConfig(configId) {
    try {
      // 1. 首先检查是否是默认配置
      if (configId === this.DEFAULT_CONFIG_ID) {
        this.appData.userConfigs[this.DEFAULT_CONFIG_ID] = {
          displayName: '默认配置',
          isActive: false,
          type: 'chrome',
          storageLocation: {
            key: this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID),
            type: 'sync'
          }
        };
        await this.saveAppData();
        return true;
      }

      // 2. 检查是否是云端配置（通过检查缓存）
      const cachedData = await this.loadFromCache(configId);
      if (cachedData) {
        this.appData.userConfigs[configId] = {
          displayName: `云端配置 (${configId})`,
          isActive: false,
          type: 'supabase',
          storageLocation: {
            type: 'supabase',
            userId: configId,
            cacheKey: this.STORAGE_KEYS.CONFIG_DATA(configId)
          }
        };
        await this.saveAppData();
        return true;
      }

      // 3. 如果有 Supabase 客户端，尝试从云端查找
      if (this.supabaseClient) {
        try {
          const currentConfig = this.supabaseClient.config;
          if (currentConfig) {
            const tempConfig = { ...currentConfig, userId: configId };
            await this.supabaseClient.initialize(tempConfig);

            const cloudData = await this.supabaseClient.loadData();

            // 恢复原来的配置
            await this.supabaseClient.initialize(currentConfig);

            if (cloudData && cloudData.data) {
              this.appData.userConfigs[configId] = {
                displayName: `云端配置 (${configId})`,
                isActive: false,
                type: 'supabase',
                storageLocation: {
                  type: 'supabase',
                  userId: configId,
                  cacheKey: this.STORAGE_KEYS.CONFIG_DATA(configId)
                }
              };

              await this.saveToCache(configId, cloudData.data);
              await this.saveAppData();
              return true;
            }
          }
        } catch (error) {
          console.warn(`UnifiedDataManager: 云端查找配置 ${configId} 失败:`, error);
        }
      }

      return false;
    } catch (error) {
      console.error(`UnifiedDataManager: 发现配置 ${configId} 失败:`, error);
      return false;
    }
  }

  /**
   * 切换配置
   */
  async switchConfig(configId) {
    try {
      console.log(`UnifiedDataManager: 切换到配置 ${configId}`);

      // 1. 检查配置是否存在，如果不存在则尝试自动发现和注册
      if (!this.appData.userConfigs[configId]) {
        console.log(`UnifiedDataManager: 配置 ${configId} 未注册，尝试自动发现...`);
        const discovered = await this.discoverAndRegisterConfig(configId);
        if (!discovered) {
          throw new Error(`配置 ${configId} 不存在且无法发现`);
        }
      }

      // 2. 清除其他配置缓存
      await this.clearAllCacheExceptCurrent();

      // 3. 更新当前配置
      const newConfig = this.appData.userConfigs[configId];
      this.appData.currentUser = {
        configId: configId,
        displayName: newConfig.displayName,
        userId: configId
      };

      // 4. 更新活跃状态
      Object.keys(this.appData.userConfigs).forEach(id => {
        this.appData.userConfigs[id].isActive = (id === configId);
      });

      // 5. 如果切换到云端配置，更新 Supabase 配置中的 userId
      if (newConfig.type === 'supabase') {
        await this.updateSupabaseConfigUserId(configId);
      }

      // 6. 保存 app_data
      await this.saveAppData();

      // 7. 加载新配置的数据
      await this.loadCurrentConfigData();

      console.log(`UnifiedDataManager: 切换到配置 ${configId} 成功`);
      return this.currentConfigData;
    } catch (error) {
      console.error(`UnifiedDataManager: 切换配置失败:`, error);
      throw error;
    }
  }

  /**
   * 更新 Supabase 配置中的 userId
   */
  async updateSupabaseConfigUserId(newUserId) {
    try {
      console.log(`UnifiedDataManager: 更新 Supabase 配置 userId 为 ${newUserId}`);

      // 获取当前的 Supabase 配置
      const result = await this.getFromChromeStorageSync([this.STORAGE_KEYS.SUPABASE_CONFIG]);
      const currentConfig = result[this.STORAGE_KEYS.SUPABASE_CONFIG];

      if (currentConfig && currentConfig.enabled) {
        // 更新 userId
        const updatedConfig = {
          ...currentConfig,
          userId: newUserId
        };

        // 保存更新后的配置
        await this.setToChromeStorageSync({
          [this.STORAGE_KEYS.SUPABASE_CONFIG]: updatedConfig
        });

        // 更新 Supabase 客户端的 userId（避免重新创建客户端实例）
        if (this.supabaseClient) {
          this.supabaseClient.config = updatedConfig;
          this.supabaseClient.userId = newUserId;
          this.supabaseClient.currentConfigHash = this.supabaseClient.generateConfigHash(updatedConfig);
          console.log(`UnifiedDataManager: Supabase 客户端 userId 已更新为 ${newUserId}`);
        }

        console.log(`UnifiedDataManager: Supabase 配置 userId 更新完成`);
      }
    } catch (error) {
      console.error(`UnifiedDataManager: 更新 Supabase 配置 userId 失败:`, error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 添加新的云端配置
   */
  async addCloudConfig(displayName, userId, supabaseConfig) {
    try {
      console.log(`UnifiedDataManager: 添加云端配置 ${userId}`);

      // 1. 检查配置是否已存在，如果存在则重新连接而不是报错
      if (this.appData.userConfigs[userId]) {
        console.log(`UnifiedDataManager: 配置 ${userId} 已存在，重新连接云端配置`);

        // 更新现有配置为云端配置
        this.appData.userConfigs[userId] = {
          displayName: displayName,
          isActive: false,
          type: 'supabase',
          storageLocation: {
            type: 'supabase',
            userId: userId,
            cacheKey: this.STORAGE_KEYS.CONFIG_DATA(userId)
          }
        };
      } else {
        // 添加新的云端配置
        this.appData.userConfigs[userId] = {
          displayName: displayName,
          isActive: false,
          type: 'supabase',
          storageLocation: {
            type: 'supabase',
            userId: userId,
            cacheKey: this.STORAGE_KEYS.CONFIG_DATA(userId)
          }
        };
      }

      // 2. 保存 Supabase 配置
      const newSupabaseConfig = {
        ...supabaseConfig,
        enabled: true,
        userId: userId
      };

      await this.setToChromeStorageSync({
        [this.STORAGE_KEYS.SUPABASE_CONFIG]: newSupabaseConfig
      });

      // 3. 初始化 Supabase 客户端（重用现有实例或创建新实例）
      if (typeof SupabaseClient !== 'undefined') {
        if (!this.supabaseClient) {
          this.supabaseClient = new SupabaseClient();
        }
        await this.supabaseClient.initialize(newSupabaseConfig);
        console.log('UnifiedDataManager: Supabase 客户端初始化成功');
      } else {
        throw new Error('SupabaseClient 未定义');
      }

      // 4. 配置已在步骤1中处理，无需重复添加

      // 5. 检查云端是否有数据
      const cloudData = await this.loadFromSupabase({ type: 'supabase' });

      if (!cloudData) {
        // 6. 云端无数据，上传默认配置
        console.log('UnifiedDataManager: 云端无数据，上传默认配置');
        const defaultData = await this.loadFromChromeSync({
          storageLocation: { key: this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID) }
        });

        if (defaultData) {
          await this.saveToSupabase({ type: 'supabase' }, defaultData);
          // 缓存上传的数据
          await this.saveToCache(userId, defaultData);
        }
      } else {
        // 7. 云端有数据，缓存到本地
        console.log('UnifiedDataManager: 云端有数据，缓存到本地');
        await this.saveToCache(userId, cloudData);
      }

      // 7. 保存 app_data
      await this.saveAppData();

      console.log(`UnifiedDataManager: 云端配置 ${userId} 添加成功`);
      return {
        userId: userId,
        ...this.appData.userConfigs[userId]
      };
    } catch (error) {
      console.error(`UnifiedDataManager: 添加云端配置失败:`, error);
      throw error;
    }
  }

  /**
   * 禁用云端同步
   */
  async disableCloudSync() {
    try {
      console.log('UnifiedDataManager: 禁用云端同步');

      // 1. 获取当前云端数据
      const currentConfig = this.getCurrentConfig();
      if (currentConfig.type === 'supabase') {
        const cloudData = await this.loadFromSupabase(currentConfig);

        if (cloudData) {
          // 2. 清空背景图片相关字段
          const dataToSync = {
            ...cloudData,
            themeSettings: {
              ...cloudData.themeSettings,
              backgroundImageUrl: null,
              backgroundImagePath: null
            }
          };

          // 3. 同步到默认配置
          await this.saveToChromeSync({
            storageLocation: { key: this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID) }
          }, dataToSync);

          console.log('UnifiedDataManager: 云端数据已同步到默认配置');
        }
      }

      // 4. 禁用 Supabase 配置
      await this.setToChromeStorageSync({
        [this.STORAGE_KEYS.SUPABASE_CONFIG]: {
          enabled: false
        }
      });

      // 5. 切换到默认配置
      await this.switchConfig(this.DEFAULT_CONFIG_ID);

      // 6. 清理 Supabase 客户端
      this.supabaseClient = null;

      console.log('UnifiedDataManager: 云端同步已禁用');
    } catch (error) {
      console.error('UnifiedDataManager: 禁用云端同步失败:', error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(configId) {
    try {
      console.log(`UnifiedDataManager: 删除配置 ${configId}`);
      console.log('当前所有配置:', Object.keys(this.appData.userConfigs));

      // 1. 不能删除默认配置
      if (configId === this.DEFAULT_CONFIG_ID) {
        throw new Error('不能删除默认配置');
      }

      // 2. 不能删除当前配置
      if (this.appData.currentUser.configId === configId) {
        throw new Error('不能删除当前正在使用的配置，请先切换到其他配置');
      }

      // 3. 获取要删除的配置信息（如果存在）
      const configToDelete = this.appData.userConfigs[configId];

      // 4. 删除云端数据（不管本地是否有配置，都尝试删除云端数据）
      if (this.supabaseClient) {
        await this.deleteCloudConfigData(configId);
      }

      // 5. 清除缓存
      await this.clearCache(configId);

      // 6. 删除配置（如果本地存在）
      if (configToDelete) {
        delete this.appData.userConfigs[configId];
        // 保存 app_data
        await this.saveAppData();
        console.log(`UnifiedDataManager: 本地配置 ${configId} 已删除`);
      } else {
        console.log(`UnifiedDataManager: 本地配置 ${configId} 不存在，跳过本地删除`);
      }

      console.log(`UnifiedDataManager: 配置 ${configId} 删除成功`);
    } catch (error) {
      console.error(`UnifiedDataManager: 删除配置失败:`, error);
      throw error;
    }
  }

  /**
   * 删除云端配置数据
   */
  async deleteCloudConfigData(configId) {
    try {
      console.log(`UnifiedDataManager: 删除云端配置数据 ${configId}`);

      // 获取当前 Supabase 配置
      const result = await this.getFromChromeStorageSync([this.STORAGE_KEYS.SUPABASE_CONFIG]);
      const currentConfig = result[this.STORAGE_KEYS.SUPABASE_CONFIG];

      if (!currentConfig || !currentConfig.url || !currentConfig.anonKey) {
        console.warn('UnifiedDataManager: 无法获取 Supabase 配置，跳过云端数据删除');
        return;
      }

      // 临时切换到目标用户进行删除操作
      const originalConfig = this.supabaseClient.config;
      await this.supabaseClient.initialize({
        url: currentConfig.url,
        anonKey: currentConfig.anonKey,
        userId: configId
      });

      // 删除 Supabase 中的用户数据
      await this.supabaseClient.deleteData();
      console.log(`UnifiedDataManager: 云端配置数据 ${configId} 已删除`);

      // 恢复原来的配置
      if (originalConfig) {
        await this.supabaseClient.initialize(originalConfig);
      }
    } catch (error) {
      console.warn(`UnifiedDataManager: 删除云端配置数据失败:`, error);
      // 不抛出错误，因为本地删除仍然可以继续
    }
  }

  /**
   * 获取所有配置列表
   */
  getAllConfigs() {
    return Object.keys(this.appData.userConfigs).map(configId => ({
      configId,
      ...this.appData.userConfigs[configId]
    }));
  }

  /**
   * 获取当前配置数据
   */
  getCurrentConfigData() {
    return this.currentConfigData;
  }

  /**
   * 数据迁移：从旧结构迁移到新结构
   */
  async migrateFromOldStructure() {
    try {
      console.log('UnifiedDataManager: 开始数据迁移...');

      // 1. 检查是否已经是新结构
      const appDataResult = await this.getFromChromeStorageLocal([this.STORAGE_KEYS.APP_DATA]);
      if (appDataResult[this.STORAGE_KEYS.APP_DATA]) {
        console.log('UnifiedDataManager: 已是新结构，跳过迁移');
        return;
      }

      // 2. 迁移旧的数据
      await this.migrateOldData();

      // 3. 迁移旧的主题配置
      await this.migrateOldThemeConfigs();

      console.log('UnifiedDataManager: 数据迁移完成');
    } catch (error) {
      console.error('UnifiedDataManager: 数据迁移失败:', error);
      // 迁移失败时创建默认配置
      await this.createDefaultAppData();
    }
  }

  /**
   * 迁移旧的数据结构
   */
  async migrateOldData() {
    // 检查旧的存储键
    const oldKeys = ['cardTabData', 'cardTabData_default'];
    const oldDataResult = await this.getFromChromeStorageSync(oldKeys);

    // 迁移默认配置数据
    let defaultData = oldDataResult['cardTabData_default'] || oldDataResult['cardTabData'];
    if (defaultData) {
      await this.setToChromeStorageSync({
        [this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID)]: defaultData
      });
      console.log('UnifiedDataManager: 默认配置数据迁移完成');
    } else {
      // 如果没有旧数据，创建默认数据（新安装的情况）
      const newDefaultData = this.getDefaultConfigData();
      await this.setToChromeStorageSync({
        [this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID)]: newDefaultData
      });
      console.log('UnifiedDataManager: 创建默认配置数据完成');
    }
  }

  /**
   * 迁移旧的主题配置
   */
  async migrateOldThemeConfigs() {
    const oldConfigKeys = ['themeConfigs', 'activeThemeConfigId', 'supabaseConfig'];
    const oldConfigResult = await this.getFromChromeStorageSync(oldConfigKeys);

    const oldThemeConfigs = oldConfigResult['themeConfigs'] || [];
    const supabaseConfig = oldConfigResult['supabaseConfig'];

    // 创建新的 app_data 结构
    const newAppData = {
      currentUser: {
        configId: this.DEFAULT_CONFIG_ID,
        displayName: '默认配置',
        userId: this.DEFAULT_CONFIG_ID
      },
      userConfigs: {
        [this.DEFAULT_CONFIG_ID]: {
          displayName: '默认配置',
          isActive: true,
          type: 'chrome',
          storageLocation: {
            key: this.STORAGE_KEYS.CONFIG_DATA(this.DEFAULT_CONFIG_ID),
            type: 'sync'
          }
        }
      },
      configPaginationSettings: {
        pageSize: 5
      }
    };

    // 迁移云端配置
    if (supabaseConfig && supabaseConfig.enabled && supabaseConfig.userId) {
      const userId = supabaseConfig.userId;
      newAppData.userConfigs[userId] = {
        displayName: `云端配置 (${userId})`,
        isActive: false,
        type: 'supabase',
        storageLocation: {
          type: 'supabase',
          userId: userId,
          cacheKey: this.STORAGE_KEYS.CONFIG_DATA(userId)
        }
      };

      // 如果有活跃的云端配置，设为当前配置
      const activeConfigId = oldConfigResult['activeThemeConfigId'];
      const activeConfig = oldThemeConfigs.find(c => c.id === activeConfigId);
      if (activeConfig && activeConfig.userId === userId) {
        newAppData.currentUser = {
          configId: userId,
          displayName: `云端配置 (${userId})`,
          userId: userId
        };
        newAppData.userConfigs[userId].isActive = true;
        newAppData.userConfigs[this.DEFAULT_CONFIG_ID].isActive = false;
      }
    }

    this.appData = newAppData;
    await this.saveAppData();

    console.log('UnifiedDataManager: 主题配置迁移完成');
  }
}

// 导出全局实例
window.unifiedDataManager = new UnifiedDataManager();
