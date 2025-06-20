/**
 * 同步管理器
 * 统一管理Chrome Storage和Supabase存储
 */

class SyncManager {
  constructor() {
    this.storageMode = 'chrome'; // 'chrome' | 'supabase' | 'hybrid'
    this.isSupabaseEnabled = false;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.conflictResolution = 'latest'; // 'latest' | 'manual' | 'chrome' | 'supabase'
    this.currentSupabaseConfig = null; // 缓存当前配置
  }

  /**
   * 初始化同步管理器
   */
  async init() {
    // 检查是否已配置Supabase
    const supabaseConfig = await this.getSupabaseConfig();
    this.currentSupabaseConfig = supabaseConfig; // 缓存配置

    if (supabaseConfig && supabaseConfig.enabled && supabaseConfig.url && supabaseConfig.anonKey && supabaseConfig.userId) {
      try {
        await supabaseClient.initialize(supabaseConfig);
        this.isSupabaseEnabled = true;
        this.storageMode = 'hybrid';
        console.log('同步管理器初始化完成 - 混合模式，用户ID:', supabaseConfig.userId);
      } catch (error) {
        console.warn('Supabase连接失败，使用Chrome Storage模式:', error);
        this.isSupabaseEnabled = false;
        this.storageMode = 'chrome';
      }
    } else {
      this.storageMode = 'chrome';
      if (supabaseConfig && supabaseConfig.enabled) {
        console.log('Supabase配置不完整，使用Chrome Storage模式');
      } else {
        console.log('同步管理器初始化完成 - Chrome Storage模式');
      }
    }
  }

  /**
   * 保存数据 - 旁路缓存模式
   * @param {Object} data - 要保存的数据
   * @param {Object} options - 保存选项
   */
  async saveData(data, options = {}) {
    try {
      if (!this.isSupabaseEnabled) {
        // 未启用Supabase：只保存到Chrome Storage
        await this.saveToChromeStorage(data);
        console.log('SyncManager: 数据已保存到Chrome Storage');
        return;
      }

      // 启用Supabase：使用旁路缓存模式
      await this.saveDataWithCacheAside(data, options);

    } catch (error) {
      console.error('SyncManager: 保存失败:', error);
      throw error;
    }
  }

  /**
   * 旁路缓存模式数据保存
   */
  async saveDataWithCacheAside(data, options = {}) {
    try {
      // 1. 保存到Supabase（主存储）
      await this.saveToSupabase(data);
      console.log('SyncManager: 数据已保存到Supabase');

      // 2. 清除Chrome Storage缓存，确保下次读取时从Supabase获取最新数据
      await this.clearChromeStorageCache();
      console.log('SyncManager: Chrome Storage缓存已清除');

      // 3. 可选：立即将新数据缓存到Chrome Storage（提高下次读取性能）
      if (options.cacheImmediately !== false) {
        await this.saveToChromeStorage(data);
        console.log('SyncManager: 新数据已缓存到Chrome Storage');
      }

      this.lastSyncTime = new Date().toISOString();

    } catch (error) {
      console.warn('SyncManager: Supabase保存失败，降级到本地保存:', error.message);
      // 降级：保存到Chrome Storage
      await this.saveToChromeStorage(data);
      throw error; // 重新抛出错误，让调用者知道云端保存失败
    }
  }

  /**
   * 清除Chrome Storage缓存
   */
  async clearChromeStorageCache() {
    const storageKey = this.getCurrentStorageKey();

    if (chrome && chrome.storage && chrome.storage.sync) {
      await chrome.storage.sync.remove([storageKey]);
      console.log(`SyncManager: 已清除缓存键 ${storageKey}`);
    } else {
      console.warn('SyncManager: Chrome Storage不可用，无法清除缓存');
    }
  }



  /**
   * 加载数据
   * @param {boolean} preferCloud - 是否优先从云端加载
   * @param {boolean} forceRefresh - 是否强制刷新（跳过缓存）
   */
  async loadData(preferCloud = false, forceRefresh = false) {
    try {
      if (!this.isSupabaseEnabled) {
        // 未启用Supabase：只使用Chrome Storage
        const chromeData = await this.loadFromChromeStorage();
        return this.validateAndCleanData(chromeData, 'chrome');
      }

      // 启用Supabase：使用旁路缓存模式
      return await this.loadDataWithCacheAside(forceRefresh);

    } catch (error) {
      console.error('SyncManager: 数据加载失败:', error);
      throw error;
    }
  }

  /**
   * 旁路缓存模式数据加载
   */
  async loadDataWithCacheAside(forceRefresh = false) {
    const storageKey = this.getCurrentStorageKey();

    // 1. 如果强制刷新，直接从Supabase获取
    if (forceRefresh) {
      console.log('SyncManager: 强制刷新，从Supabase获取数据');
      return await this.loadFromSupabaseAndCache();
    }

    // 2. 尝试从Chrome Storage获取缓存
    const cachedData = await this.loadFromChromeStorage();

    if (cachedData && Object.keys(cachedData).length > 0 && cachedData.categories) {
      console.log('SyncManager: 从Chrome Storage缓存获取数据');
      return this.validateAndCleanData(cachedData, 'chrome');
    }

    // 3. 缓存未命中，从Supabase获取并缓存
    console.log('SyncManager: 缓存未命中，从Supabase获取数据');
    return await this.loadFromSupabaseAndCache();
  }

  /**
   * 从Supabase加载数据并缓存到Chrome Storage
   */
  async loadFromSupabaseAndCache() {
    try {
      const supabaseData = await this.loadFromSupabase();

      if (supabaseData && Object.keys(supabaseData).length > 0) {
        // 验证和清理数据
        const cleanData = this.validateAndCleanData(supabaseData, 'supabase');

        // 缓存到Chrome Storage
        await this.saveToChromeStorage(cleanData);
        console.log('SyncManager: 数据已从Supabase加载并缓存到Chrome Storage');

        return cleanData;
      } else {
        console.log('SyncManager: Supabase无数据，返回空数据');
        return null;
      }
    } catch (error) {
      console.warn('SyncManager: 从Supabase加载失败:', error.message);
      // 降级：尝试从Chrome Storage获取任何可用数据
      const fallbackData = await this.loadFromChromeStorage();
      return this.validateAndCleanData(fallbackData, 'chrome') || null;
    }
  }



  /**
   * 第二阶段：数据验证和清理
   */
  validateAndCleanData(data, source) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // 基础结构验证
    const validatedData = {
      categories: Array.isArray(data.categories) ? data.categories : [],
      settings: data.settings && typeof data.settings === 'object' ? data.settings : { viewMode: 'grid' },
      _metadata: {
        source: source,
        validatedAt: new Date().toISOString(),
        ...data._metadata
      }
    };

    // 保留其他字段（如themeSettings）
    Object.keys(data).forEach(key => {
      if (!['categories', 'settings', '_metadata'].includes(key)) {
        validatedData[key] = data[key];
      }
    });

    // 主题设置验证
    if (data.themeSettings) {
      const themeSettings = data.themeSettings;
      if (typeof themeSettings === 'object') {
        validatedData.themeSettings = {
          theme: themeSettings.theme || 'default',
          backgroundOpacity: parseInt(themeSettings.backgroundOpacity) || 30,
          backgroundImageUrl: themeSettings.backgroundImageUrl || null,
          backgroundImagePath: themeSettings.backgroundImagePath || null,
          lastModified: themeSettings.lastModified || new Date().toISOString()
        };
      }
    }

    return validatedData;
  }

  /**
   * 获取当前配置的存储键
   */
  getCurrentStorageKey() {
    // 如果有Supabase配置，使用用户ID作为键的一部分
    if (this.currentSupabaseConfig && this.currentSupabaseConfig.userId) {
      return `quickNavData_${this.currentSupabaseConfig.userId}`;
    }

    // 如果云端同步被禁用，检查是否有默认配置数据
    if (!this.isSupabaseEnabled) {
      return 'quickNavData_default'; // 使用默认配置键
    }

    return 'quickNavData'; // 默认键
  }

  /**
   * 保存到Chrome Storage（按配置隔离）
   */
  async saveToChromeStorage(data) {
    const dataWithTimestamp = {
      ...data,
      _metadata: {
        lastModified: new Date().toISOString(),
        source: 'chrome',
        userId: this.currentSupabaseConfig?.userId || 'default'
      }
    };

    const storageKey = this.getCurrentStorageKey();
    const dataSize = JSON.stringify(dataWithTimestamp).length;

    // Chrome Storage sync 限制每项8KB
    if (dataSize > 8000) {
      console.warn(`数据大小 ${dataSize} bytes 超出Chrome Storage限制，跳过Chrome Storage保存`);
      return;
    }

    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ [storageKey]: dataWithTimestamp });
      } else {
        console.warn('Chrome Storage不可用，跳过保存');
      }
    } catch (error) {
      if (error.message.includes('quota exceeded')) {
        console.warn('Chrome Storage配额超限，跳过Chrome Storage保存:', error);
      } else {
        throw error;
      }
    }
  }

  /**
   * 从Chrome Storage加载（按配置隔离）
   */
  async loadFromChromeStorage() {
    const storageKey = this.getCurrentStorageKey();

    if (chrome && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get([storageKey], (result) => {
          const data = result[storageKey] || {};
          resolve(data);
        });
      });
    } else {
      console.warn('Chrome Storage不可用，返回空数据');
      return {};
    }
  }

  /**
   * 保存到Supabase
   */
  async saveToSupabase(data) {
    const dataWithTimestamp = {
      ...data,
      _metadata: {
        lastModified: new Date().toISOString(),
        source: 'supabase'
      }
    };

    await supabaseClient.saveData(dataWithTimestamp);
  }

  /**
   * 从Supabase加载
   */
  async loadFromSupabase() {
    const result = await supabaseClient.loadData();
    return result ? result.data : null;
  }

  /**
   * 数据合并策略
   */
  async mergeData(chromeData, supabaseData, preferCloud) {
    console.log('数据合并策略 - preferCloud:', preferCloud);
    console.log('Chrome数据:', chromeData ? '有数据' : '无数据');
    console.log('Supabase数据:', supabaseData ? '有数据' : '无数据');

    // 如果只有一个数据源
    if (!chromeData && !supabaseData) return null;
    if (!chromeData) {
      console.log('只有Supabase数据，返回Supabase数据');
      return supabaseData;
    }
    if (!supabaseData) {
      console.log('只有Chrome数据，返回Chrome数据');
      return chromeData;
    }

    // 如果明确要求优先云端数据，直接返回Supabase数据
    if (preferCloud) {
      console.log('优先云端数据，返回Supabase数据');
      return supabaseData;
    }

    // 获取时间戳
    const chromeTime = chromeData._metadata?.lastModified;
    const supabaseTime = supabaseData._metadata?.lastModified;
    console.log('Chrome时间戳:', chromeTime);
    console.log('Supabase时间戳:', supabaseTime);

    // 根据策略合并
    switch (this.conflictResolution) {
      case 'latest':
        if (!chromeTime && !supabaseTime) {
          console.log('无时间戳，返回Chrome数据');
          return chromeData;
        }
        if (!chromeTime) {
          console.log('Chrome无时间戳，返回Supabase数据');
          return supabaseData;
        }
        if (!supabaseTime) {
          console.log('Supabase无时间戳，返回Chrome数据');
          return chromeData;
        }
        const useSupabase = new Date(supabaseTime) > new Date(chromeTime);
        console.log('时间戳比较结果，使用', useSupabase ? 'Supabase' : 'Chrome', '数据');
        return useSupabase ? supabaseData : chromeData;

      case 'chrome':
        console.log('强制使用Chrome数据');
        return chromeData;

      case 'supabase':
        console.log('强制使用Supabase数据');
        return supabaseData;

      case 'manual':
        // 触发冲突解决界面
        return await this.showConflictResolution(chromeData, supabaseData);

      default:
        const result = preferCloud ? (supabaseData || chromeData) : (chromeData || supabaseData);
        console.log('默认策略，返回', result === supabaseData ? 'Supabase' : 'Chrome', '数据');
        return result;
    }
  }



  /**
   * 获取Supabase配置
   */
  async getSupabaseConfig() {
    if (chrome && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['supabaseConfig'], (result) => {
          resolve(result.supabaseConfig);
        });
      });
    } else {
      // Development environment - return null
      console.warn('Chrome Storage不可用，返回空配置');
      return null;
    }
  }

  /**
   * 保存Supabase配置
   */
  async saveSupabaseConfig(config) {
    this.currentSupabaseConfig = config; // 更新缓存

    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ supabaseConfig: config });
    } else {
      // Development environment - skip saving
      console.warn('Chrome Storage不可用，跳过配置保存');
    }
  }

  /**
   * 启用Supabase同步
   */
  async enableSupabaseSync(config) {
    try {
      // 1. 保存Supabase配置
      const configWithEnabled = { ...config, enabled: true };
      await this.saveSupabaseConfig(configWithEnabled);

      // 2. 初始化连接
      await supabaseClient.initialize(config);

      // 3. 查找现有的云端配置
      let cloudConfig = null;
      if (typeof themeConfigManager !== 'undefined') {
        cloudConfig = themeConfigManager.findExistingCloudConfig(config);
      }

      if (cloudConfig) {
        // 4a. 复用现有配置，更新配置信息
        await themeConfigManager.updateConfig(cloudConfig.id, {
          supabaseUrl: config.url,
          supabaseKey: config.anonKey,
          lastModified: new Date().toISOString()
        });
        console.log('SyncManager: 复用现有云端配置', cloudConfig.displayName);
      } else {
        // 4b. 创建新的云端配置（确保不使用default作为ID）
        if (typeof themeConfigManager !== 'undefined') {
          cloudConfig = await themeConfigManager.createCloudConfig(config);

          // 5. 迁移本地默认配置数据到云端
          await this.migrateDefaultDataToCloud(cloudConfig.id);
          console.log('SyncManager: 创建新的云端配置', cloudConfig.displayName);
        }
      }

      // 6. 切换到云端配置
      if (cloudConfig && typeof themeConfigManager !== 'undefined') {
        await themeConfigManager.switchConfig(cloudConfig.id);
      }

      this.isSupabaseEnabled = true;
      this.storageMode = 'hybrid';
      this.currentSupabaseConfig = configWithEnabled;

      console.log('Supabase同步已启用');

      // 更新背景图片UI状态
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
      }

      return true;
    } catch (error) {
      console.error('启用Supabase同步失败:', error);
      throw error;
    }
  }

  /**
   * 禁用Supabase同步
   */
  async disableSupabaseSync() {
    try {
      let cloudData = null;

      // 1. 同步云端数据到本地 (排除背景图片)
      if (this.isSupabaseEnabled) {
        cloudData = await this.loadFromSupabase();
        if (cloudData) {
          // 清除背景图片相关数据（因为云端图片将不可访问）
          if (cloudData.themeSettings) {
            cloudData.themeSettings.backgroundImageUrl = null;
            cloudData.themeSettings.backgroundImagePath = null;
            cloudData.themeSettings.backgroundOpacity = 30;
          }

          await this.saveToChromeStorage(cloudData);
          console.log('云端数据已同步到本地（背景图片已重置）');
        }
      }

      // 2. 记录当前云端配置ID（用于重新启用时快速恢复）
      if (typeof themeConfigManager !== 'undefined') {
        const currentCloudConfig = themeConfigManager.getActiveConfig();
        if (currentCloudConfig && !currentCloudConfig.isDefault) {
          // 使用Chrome Storage保存最后使用的云端配置ID
          if (chrome && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({
              lastCloudConfigId: currentCloudConfig.id
            });
          } else {
            localStorage.setItem('lastCloudConfigId', currentCloudConfig.id);
          }
        }
      }

      // 3. 禁用配置
      const config = await this.getSupabaseConfig();
      if (config) {
        await this.saveSupabaseConfig({ ...config, enabled: false });
      }

      // 4. 创建/更新本地默认配置（使用之前同步的云端数据）
      await this.createOrUpdateDefaultConfig(cloudData);

      // 5. 切换到默认配置（此时默认配置肯定存在）
      if (typeof themeConfigManager !== 'undefined') {
        // 从配置管理中移除默认配置（它不应该出现在云端配置列表中）
        themeConfigManager.configs = themeConfigManager.configs.filter(c => c.id !== 'default');
        themeConfigManager.activeConfigId = 'default';
        await themeConfigManager.saveConfigs();
        console.log('SyncManager: 已切换到本地默认配置');
      }

      // 5. 重置背景图片
      if (typeof applyBackgroundImageToDOM === 'function') {
        applyBackgroundImageToDOM(null);
      }

      // 6. 断开连接（但保留云端配置）
      supabaseClient.disconnect();
      this.isSupabaseEnabled = false;
      this.storageMode = 'chrome';
      this.currentSupabaseConfig = null;

      console.log('Supabase同步已禁用，云端配置已保留');

      // 更新背景图片UI状态
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
      }
    } catch (error) {
      console.error('禁用Supabase同步失败:', error);
      throw error;
    }
  }

  /**
   * 迁移本地默认配置数据到云端
   */
  async migrateDefaultDataToCloud(cloudConfigId) {
    try {
      console.log('SyncManager: 开始迁移本地数据到云端');

      // 1. 获取主要数据
      const localData = await this.loadFromChromeStorage();
      console.log('SyncManager: 本地主数据:', localData);

      // 2. 准备数据迁移
      let finalData;

      if (!localData || !localData.categories || localData.categories.length === 0) {
        // 如果本地没有数据或没有分类，使用默认基础数据
        console.log('SyncManager: 本地无数据，使用默认基础数据');

        // 获取默认数据（从storage.js中的DEFAULT_DATA）
        const defaultData = this.getDefaultData();
        finalData = {
          categories: defaultData.categories,
          settings: defaultData.settings,
          themeSettings: {
            theme: 'default',
            backgroundImageUrl: null,
            backgroundImagePath: null,
            backgroundOpacity: 30,
            lastModified: new Date().toISOString()
          }
        };

        console.log('SyncManager: 为新用户提供基础数据:', {
          categories: finalData.categories.length,
          shortcuts: finalData.categories.reduce((total, cat) => total + cat.shortcuts.length, 0)
        });
      } else {
        // 如果本地有数据，迁移现有数据
        console.log('SyncManager: 迁移现有本地数据');
        finalData = { ...localData };
      }

      // 确保数据结构完整
      if (!finalData.categories) {
        finalData.categories = [];
      }
      if (!finalData.settings) {
        finalData.settings = { viewMode: 'grid' };
      }

      // 确保有默认主题设置
      if (!finalData.themeSettings) {
        finalData.themeSettings = {
          theme: 'default',
          backgroundImageUrl: null,
          backgroundImagePath: null,
          backgroundOpacity: 30,
          lastModified: new Date().toISOString()
        };
        console.log('SyncManager: 创建默认主题设置');
      } else {
        console.log('SyncManager: 使用现有主题设置:', finalData.themeSettings);
      }

      console.log('SyncManager: 准备迁移的完整数据结构:', {
        categories: finalData.categories?.length || 0,
        shortcuts: finalData.categories?.reduce((total, cat) => total + (cat.shortcuts?.length || 0), 0) || 0,
        settings: finalData.settings,
        themeSettings: finalData.themeSettings
      });

      // 始终保存完整的数据结构到云端
      await this.saveToSupabase(finalData);
      console.log('SyncManager: 完整配置数据已迁移到云端');

      // 验证迁移结果
      const cloudData = await this.loadFromSupabase();
      if (cloudData) {
        console.log('SyncManager: 云端数据验证:', {
          categories: cloudData.categories?.length || 0,
          shortcuts: cloudData.categories?.reduce((total, cat) => total + (cat.shortcuts?.length || 0), 0) || 0,
          settings: cloudData.settings,
          themeSettings: cloudData.themeSettings
        });
      }
    } catch (error) {
      console.error('SyncManager: 迁移本地默认配置数据失败', error);
    }
  }

  /**
   * 获取默认基础数据
   */
  getDefaultData() {
    return {
      categories: [
        {
          id: 'cat-1',
          name: '社交媒体',
          color: '#4285f4',
          collapsed: false,
          shortcuts: [
            {
              id: 'shortcut-1',
              name: '微博',
              url: 'https://weibo.com',
              iconType: 'letter',
              iconColor: '#ff8200',
              iconUrl: ''
            },
            {
              id: 'shortcut-2',
              name: '知乎',
              url: 'https://zhihu.com',
              iconType: 'letter',
              iconColor: '#0066ff',
              iconUrl: ''
            },
            {
              id: 'shortcut-3',
              name: '哔哩哔哩',
              url: 'https://bilibili.com',
              iconType: 'letter',
              iconColor: '#fb7299',
              iconUrl: ''
            },
            {
              id: 'shortcut-4',
              name: '微信',
              url: 'https://wx.qq.com',
              iconType: 'letter',
              iconColor: '#07c160',
              iconUrl: ''
            }
          ]
        },
        {
          id: 'cat-2',
          name: '工作',
          color: '#0f9d58',
          collapsed: false,
          shortcuts: [
            {
              id: 'shortcut-5',
              name: '邮箱',
              url: 'https://mail.163.com',
              iconType: 'letter',
              iconColor: '#0f9d58',
              iconUrl: ''
            },
            {
              id: 'shortcut-6',
              name: '百度网盘',
              url: 'https://pan.baidu.com',
              iconType: 'letter',
              iconColor: '#06a7ff',
              iconUrl: ''
            },
            {
              id: 'shortcut-7',
              name: '语雀',
              url: 'https://yuque.com',
              iconType: 'letter',
              iconColor: '#31cc79',
              iconUrl: ''
            }
          ]
        },
        {
          id: 'cat-3',
          name: '购物',
          color: '#ea4335',
          collapsed: false,
          shortcuts: [
            {
              id: 'shortcut-8',
              name: '淘宝',
              url: 'https://taobao.com',
              iconType: 'letter',
              iconColor: '#ff5000',
              iconUrl: ''
            },
            {
              id: 'shortcut-9',
              name: '京东',
              url: 'https://jd.com',
              iconType: 'letter',
              iconColor: '#e1251b',
              iconUrl: ''
            },
            {
              id: 'shortcut-10',
              name: '拼多多',
              url: 'https://pinduoduo.com',
              iconType: 'letter',
              iconColor: '#e22e1f',
              iconUrl: ''
            }
          ]
        }
      ],
      settings: {
        viewMode: 'grid'
      }
    };
  }

  /**
   * 创建或更新本地默认配置
   */
  async createOrUpdateDefaultConfig(cloudData = null) {
    try {
      // 准备默认配置数据
      let defaultConfigData = {
        categories: [],
        settings: { viewMode: 'grid' },
        themeSettings: {
          theme: 'default',
          backgroundImageUrl: null,
          backgroundImagePath: null,
          backgroundOpacity: 30
        }
      };

      // 如果有云端数据，使用云端数据（排除背景图片）
      if (cloudData) {
        defaultConfigData = {
          ...cloudData,
          themeSettings: {
            ...cloudData.themeSettings,
            backgroundImageUrl: null,
            backgroundImagePath: null,
            backgroundOpacity: 30
          }
        };
        console.log('SyncManager: 使用云端数据创建本地默认配置');
      } else {
        console.log('SyncManager: 创建空的本地默认配置');
      }

      // 保存到本地存储（使用默认存储键）
      const defaultStorageKey = 'quickNavData_default';
      if (chrome && chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ [defaultStorageKey]: defaultConfigData });
      } else {
        // Development environment - skip saving
        console.warn('Chrome Storage不可用，跳过默认配置保存');
      }

      console.log('SyncManager: 本地默认配置创建/更新成功');
    } catch (error) {
      console.error('SyncManager: 创建/更新本地默认配置失败', error);
    }
  }

  /**
   * 手动同步
   */
  async manualSync() {
    if (!this.isSupabaseEnabled) {
      throw new Error('Supabase同步未启用');
    }

    if (this.syncInProgress) {
      throw new Error('同步正在进行中');
    }

    try {
      this.syncInProgress = true;

      const chromeData = await this.loadFromChromeStorage();
      const supabaseData = await this.loadFromSupabase();

      const mergedData = await this.mergeData(chromeData, supabaseData, false);

      // 同步到两个存储
      await this.saveToChromeStorage(mergedData);
      await this.saveToSupabase(mergedData);

      this.lastSyncTime = new Date().toISOString();
      console.log('手动同步完成');

      return mergedData;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      storageMode: this.storageMode,
      isSupabaseEnabled: this.isSupabaseEnabled,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      supabaseStatus: supabaseClient.getConnectionStatus()
    };
  }
}

// 创建全局实例
const syncManager = new SyncManager();
window.syncManager = syncManager;
