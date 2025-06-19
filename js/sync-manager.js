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
  }

  /**
   * 初始化同步管理器
   */
  async init() {
    // 检查是否已配置Supabase
    const supabaseConfig = await this.getSupabaseConfig();
    if (supabaseConfig && supabaseConfig.enabled) {
      try {
        await supabaseClient.initialize(supabaseConfig);
        this.isSupabaseEnabled = true;
        this.storageMode = 'hybrid';
        console.log('同步管理器初始化完成 - 混合模式');
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
    try {
      // 总是保存到Chrome Storage（本地备份）
      await this.saveToChromeStorage(data);

      // 如果启用了Supabase，也保存到云端
      if (this.isSupabaseEnabled && (this.storageMode === 'supabase' || this.storageMode === 'hybrid' || forceSync)) {
        await this.saveToSupabase(data);
      }

      this.lastSyncTime = new Date().toISOString();
      console.log('数据保存成功');
    } catch (error) {
      console.error('数据保存失败:', error);
      throw error;
    }
  }

  /**
   * 加载数据
   * @param {boolean} preferCloud - 是否优先从云端加载
   */
  async loadData(preferCloud = false) {
    try {
      let chromeData = null;
      let supabaseData = null;

      // 加载Chrome Storage数据
      chromeData = await this.loadFromChromeStorage();

      // 如果启用了Supabase，也加载云端数据
      if (this.isSupabaseEnabled) {
        try {
          supabaseData = await this.loadFromSupabase();
        } catch (error) {
          console.warn('从Supabase加载数据失败:', error);
        }
      }

      // 数据合并策略
      return await this.mergeData(chromeData, supabaseData, preferCloud);
    } catch (error) {
      console.error('数据加载失败:', error);
      throw error;
    }
  }

  /**
   * 保存到Chrome Storage
   */
  async saveToChromeStorage(data) {
    const dataWithTimestamp = {
      ...data,
      _metadata: {
        lastModified: new Date().toISOString(),
        source: 'chrome'
      }
    };

    if (chrome && chrome.storage && chrome.storage.sync) {
      await chrome.storage.sync.set(dataWithTimestamp);
    } else {
      // 备选方案：使用localStorage
      localStorage.setItem('quickNavData', JSON.stringify(dataWithTimestamp));
    }
  }

  /**
   * 从Chrome Storage加载
   */
  async loadFromChromeStorage() {
    if (chrome && chrome.storage && chrome.storage.sync) {
      return new Promise((resolve) => {
        chrome.storage.sync.get(null, (data) => {
          resolve(data);
        });
      });
    } else {
      // 备选方案：使用localStorage
      const data = localStorage.getItem('quickNavData');
      return data ? JSON.parse(data) : {};
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
    // 如果只有一个数据源
    if (!chromeData && !supabaseData) return null;
    if (!chromeData) return supabaseData;
    if (!supabaseData) return chromeData;

    // 获取时间戳
    const chromeTime = chromeData._metadata?.lastModified;
    const supabaseTime = supabaseData._metadata?.lastModified;

    // 根据策略合并
    switch (this.conflictResolution) {
      case 'latest':
        if (!chromeTime && !supabaseTime) return chromeData;
        if (!chromeTime) return supabaseData;
        if (!supabaseTime) return chromeData;
        return new Date(supabaseTime) > new Date(chromeTime) ? supabaseData : chromeData;

      case 'chrome':
        return chromeData;

      case 'supabase':
        return supabaseData;

      case 'manual':
        // 触发冲突解决界面
        return await this.showConflictResolution(chromeData, supabaseData);

      default:
        return preferCloud ? (supabaseData || chromeData) : (chromeData || supabaseData);
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
