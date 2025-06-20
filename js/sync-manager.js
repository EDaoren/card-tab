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

    if (supabaseConfig && supabaseConfig.enabled) {
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
      console.log('同步管理器初始化完成 - Chrome Storage模式');
    }
  }

  /**
   * 保存数据
   * @param {Object} data - 要保存的数据
   * @param {boolean} forceSync - 是否强制同步到云端
   */
  async saveData(data, forceSync = false) {
    let chromeSuccess = false;
    let supabaseSuccess = false;

    try {
      // 尝试保存到Chrome Storage（本地备份）
      try {
        await this.saveToChromeStorage(data);
        chromeSuccess = true;
      } catch (chromeError) {
        console.warn('Chrome Storage保存失败:', chromeError.message);
      }

      // 如果启用了Supabase，也保存到云端
      if (this.isSupabaseEnabled && (this.storageMode === 'supabase' || this.storageMode === 'hybrid' || forceSync)) {
        try {
          await this.saveToSupabase(data);
          supabaseSuccess = true;
        } catch (supabaseError) {
          console.warn('Supabase保存失败:', supabaseError.message);
        }
      }

      // 至少要有一个存储成功
      if (!chromeSuccess && !supabaseSuccess && this.isSupabaseEnabled) {
        throw new Error('所有存储方式都失败了');
      } else if (!chromeSuccess && !this.isSupabaseEnabled) {
        throw new Error('Chrome Storage保存失败');
      }

      this.lastSyncTime = new Date().toISOString();
      console.log(`数据保存成功 - Chrome: ${chromeSuccess}, Supabase: ${supabaseSuccess}`);
    } catch (error) {
      console.error('数据保存失败:', error);
      throw error;
    }
  }

  /**
   * 加载数据
   * @param {boolean} preferCloud - 是否优先从云端加载
   * @param {boolean} forceRefresh - 是否强制刷新（跳过缓存）
   */
  async loadData(preferCloud = false, forceRefresh = false) {
    try {
      console.log(`加载数据 - preferCloud: ${preferCloud}, forceRefresh: ${forceRefresh}`);

      let chromeData = null;
      let supabaseData = null;

      // 加载Chrome Storage数据
      chromeData = await this.loadFromChromeStorage();

      // 如果启用了Supabase，也加载云端数据
      if (this.isSupabaseEnabled) {
        try {
          console.log('从Supabase加载数据，当前用户ID:', supabaseClient.getConnectionStatus().userId);
          supabaseData = await this.loadFromSupabase();
          console.log('Supabase数据加载结果:', supabaseData ? '有数据' : '无数据');
          if (supabaseData && supabaseData.themeSettings) {
            console.log('Supabase主题设置:', supabaseData.themeSettings);
          }
        } catch (error) {
          console.warn('从Supabase加载数据失败:', error);
        }
      }

      // 数据合并策略
      const result = await this.mergeData(chromeData, supabaseData, preferCloud);
      console.log('数据合并结果:', result ? '有数据' : '无数据');
      return result;
    } catch (error) {
      console.error('数据加载失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前配置的存储键
   */
  getCurrentStorageKey() {
    // 如果有Supabase配置，使用用户ID作为键的一部分
    if (this.currentSupabaseConfig && this.currentSupabaseConfig.userId) {
      return `quickNavData_${this.currentSupabaseConfig.userId}`;
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
    console.log(`保存到Chrome Storage，键: ${storageKey}，数据大小: ${dataSize} bytes`);

    // Chrome Storage sync 限制每项8KB
    if (dataSize > 8000) {
      console.warn(`数据大小 ${dataSize} bytes 超出Chrome Storage限制，跳过Chrome Storage保存`);
      return;
    }

    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ [storageKey]: dataWithTimestamp });
        console.log(`Chrome Storage保存成功，数据大小: ${dataSize} bytes`);
      } else {
        // 备选方案：使用localStorage
        localStorage.setItem(storageKey, JSON.stringify(dataWithTimestamp));
        console.log(`localStorage保存成功，数据大小: ${dataSize} bytes`);
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
    console.log(`从Chrome Storage加载，键: ${storageKey}`);

    if (chrome && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get([storageKey], (result) => {
          const data = result[storageKey] || {};
          console.log(`Chrome Storage数据 (${storageKey}):`, data ? '有数据' : '无数据');
          resolve(data);
        });
      });
    } else {
      // 备选方案：使用localStorage
      const data = localStorage.getItem(storageKey);
      const result = data ? JSON.parse(data) : {};
      console.log(`localStorage数据 (${storageKey}):`, result ? '有数据' : '无数据');
      return result;
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
      const config = localStorage.getItem('supabaseConfig');
      return config ? JSON.parse(config) : null;
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
      localStorage.setItem('supabaseConfig', JSON.stringify(config));
    }
  }

  /**
   * 启用Supabase同步
   */
  async enableSupabaseSync(config) {
    try {
      // 保存配置
      await this.saveSupabaseConfig({ ...config, enabled: true });

      // 初始化连接
      await supabaseClient.initialize(config);

      // 迁移现有数据
      const chromeData = await this.loadFromChromeStorage();
      if (chromeData && Object.keys(chromeData).length > 0) {
        await this.saveToSupabase(chromeData);
        console.log('数据已迁移到Supabase');
      }

      this.isSupabaseEnabled = true;
      this.storageMode = 'hybrid';

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
      // 从云端同步最新数据到本地
      if (this.isSupabaseEnabled) {
        const supabaseData = await this.loadFromSupabase();
        if (supabaseData) {
          await this.saveToChromeStorage(supabaseData);
          console.log('云端数据已同步到本地');
        }
      }

      // 禁用配置
      const config = await this.getSupabaseConfig();
      if (config) {
        await this.saveSupabaseConfig({ ...config, enabled: false });
      }

      // 断开连接
      supabaseClient.disconnect();
      this.isSupabaseEnabled = false;
      this.storageMode = 'chrome';

      console.log('Supabase同步已禁用');
    } catch (error) {
      console.error('禁用Supabase同步失败:', error);
      throw error;
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
