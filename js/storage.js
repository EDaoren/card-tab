/**
 * Storage handler for the Quick Nav Tab extension
 * Uses Chrome's storage.sync API to store and retrieve data
 */

// Default categories with some example shortcuts
const DEFAULT_DATA = {
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
    viewMode: 'grid' // 'grid' or 'list'
  }
};

// Generate unique IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

class StorageManager {
  constructor() {
    this.data = null;
  }

  /**
   * Initialize the storage
   * @returns {Promise} Promise that resolves when data is loaded
   */
  async init() {
    try {
      // Initialize sync manager first
      await syncManager.init();

      // Load data using sync manager (handles Chrome Storage + Supabase)
      const result = await syncManager.loadData();

      // If no data exists, use default data
      if (!result || Object.keys(result).length === 0 || !result.categories) {
        this.data = DEFAULT_DATA;

        // 保存默认数据时，智能保留现有的其他字段（如themeSettings）
        const dataToSave = {
          ...result,  // 保留现有数据（可能包含themeSettings等）
          categories: this.data.categories,  // 设置默认categories
          settings: this.data.settings,      // 设置默认settings
          _metadata: {
            ...result?._metadata,
            lastModified: new Date().toISOString(),
            source: 'storageManager_init'
          }
        };

        // 保存完整数据的引用
        this.fullData = dataToSave;

        try {
          await syncManager.saveData(dataToSave);
        } catch (saveError) {
          console.warn('StorageManager: 保存默认数据失败:', saveError);
        }
      } else {
        // Remove metadata if present, but keep other fields like themeSettings
        const { _metadata, ...cleanData } = result;

        // StorageManager只管理categories和settings，但要保留完整数据的引用
        this.data = {
          categories: cleanData.categories || [],
          settings: cleanData.settings || { viewMode: 'grid' }
        };

        // 保存完整数据的引用，用于saveToStorage时合并
        this.fullData = cleanData;
      }

      return this.data;
    } catch (error) {
      console.error('StorageManager: Error during initialization:', error);

      // Fallback to default data if there's an error
      this.data = DEFAULT_DATA;
      return this.data;
    }
  }

  /**
   * Get data from Chrome storage
   * @returns {Promise} Promise that resolves with the data
   */
  async getFromStorage() {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get('quickNavData', (result) => {
          resolve(result.quickNavData || {});
        });
      } else {
        // Development environment fallback - return empty data
        console.warn('Chrome storage not available, returning empty data');
        resolve({});
      }
    });
  }

  /**
   * Save data to storage (Chrome Storage + Supabase)
   * @returns {Promise} Promise that resolves when data is saved
   */
  async saveToStorage() {
    try {
      // 使用统一的数据保存协调器
      if (window.dataSaveCoordinator) {
        const saveData = {
          categories: this.data.categories,
          settings: this.data.settings
        };

        const result = await dataSaveCoordinator.saveData(saveData, {
          source: 'storageManager',
          priority: 'normal',
          mergeStrategy: 'smart',
          validateBefore: true
        });

        if (result.success) {
          this.fullData = null; // 清空缓存，下次会重新加载
        } else {
          throw new Error(result.error || '协调器保存失败');
        }
      } else {
        // 备选方案：使用原有逻辑
        await this.saveToStorageLegacy();
      }
    } catch (error) {
      console.error('StorageManager: 保存失败:', error);
      await this.saveToStorageFallback();
    }
  }

  /**
   * 原有保存逻辑（备选方案）
   */
  async saveToStorageLegacy() {
    // 获取当前完整数据，确保不丢失其他字段
    let currentFullData = this.fullData;
    if (!currentFullData) {
      currentFullData = await syncManager.loadData(false) || {};
    }

    // 智能合并数据：只更新categories和settings，保留其他所有字段
    const mergedData = {
      ...currentFullData,
      categories: this.data.categories,
      settings: this.data.settings,
      _metadata: {
        ...currentFullData._metadata,
        lastModified: new Date().toISOString(),
        source: 'storageManager_legacy'
      }
    };

    this.fullData = mergedData;
    await syncManager.saveData(mergedData);
  }

  /**
   * 第三阶段：最终备选方案
   */
  async saveToStorageFallback() {
    const fallbackData = {
      categories: this.data.categories,
      settings: this.data.settings,
      _metadata: {
        lastModified: new Date().toISOString(),
        source: 'storageManager_fallback'
      }
    };

    if (chrome.storage && chrome.storage.sync) {
      await chrome.storage.sync.set({ quickNavData: fallbackData });
    } else {
      console.warn('Chrome Storage不可用，跳过备选方案保存');
    }
  }

  /**
   * Get all categories
   * @returns {Array} Array of categories
   */
  getCategories() {
    return this.data.categories;
  }

  /**
   * Get a specific category by ID
   * @param {string} categoryId - The category ID
   * @returns {Object|null} The category object or null if not found
   */
  getCategory(categoryId) {
    return this.data.categories.find(category => category.id === categoryId) || null;
  }

  /**
   * Add a new category
   * @param {Object} categoryData - The category data
   * @returns {Promise} Promise that resolves with the new category
   */
  async addCategory(categoryData) {
    const newCategory = {
      id: generateId('cat'),
      name: categoryData.name,
      color: categoryData.color,
      collapsed: false,
      shortcuts: []
    };

    this.data.categories.push(newCategory);
    await this.saveToStorage();
    return newCategory;
  }

  /**
   * Update an existing category
   * @param {string} categoryId - The category ID
   * @param {Object} categoryData - The updated category data
   * @returns {Promise} Promise that resolves with the updated category
   */
  async updateCategory(categoryId, categoryData) {
    const categoryIndex = this.data.categories.findIndex(category => category.id === categoryId);
    if (categoryIndex === -1) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const updatedCategory = {
      ...this.data.categories[categoryIndex],
      ...categoryData
    };

    this.data.categories[categoryIndex] = updatedCategory;
    await this.saveToStorage();
    return updatedCategory;
  }

  /**
   * Delete a category
   * @param {string} categoryId - The category ID
   * @returns {Promise} Promise that resolves when the category is deleted
   */
  async deleteCategory(categoryId) {
    const categoryIndex = this.data.categories.findIndex(category => category.id === categoryId);
    if (categoryIndex === -1) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    this.data.categories.splice(categoryIndex, 1);
    await this.saveToStorage();
    return true;
  }

  /**
   * Toggle category collapse state
   * @param {string} categoryId - The category ID
   * @returns {Promise} Promise that resolves with the updated category
   */
  async toggleCategoryCollapse(categoryId) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    category.collapsed = !category.collapsed;
    await this.saveToStorage();
    return category;
  }

  /**
   * Get all shortcuts for a specific category
   * @param {string} categoryId - The category ID
   * @returns {Array} Array of shortcuts
   */
  getShortcuts(categoryId) {
    const category = this.getCategory(categoryId);
    return category ? category.shortcuts : [];
  }

  /**
   * Get a specific shortcut
   * @param {string} categoryId - The category ID
   * @param {string} shortcutId - The shortcut ID
   * @returns {Object|null} The shortcut object or null if not found
   */
  getShortcut(categoryId, shortcutId) {
    const category = this.getCategory(categoryId);
    if (!category) return null;
    
    return category.shortcuts.find(shortcut => shortcut.id === shortcutId) || null;
  }

  /**
   * Add a new shortcut to a category
   * @param {string} categoryId - The category ID
   * @param {Object} shortcutData - The shortcut data
   * @returns {Promise} Promise that resolves with the new shortcut
   */
  async addShortcut(categoryId, shortcutData) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const newShortcut = {
      id: generateId('shortcut'),
      name: shortcutData.name,
      url: shortcutData.url,
      iconType: shortcutData.iconType || 'letter',
      iconColor: shortcutData.iconColor || '#4285f4',
      iconUrl: shortcutData.iconUrl || ''
    };

    category.shortcuts.push(newShortcut);
    await this.saveToStorage();
    return newShortcut;
  }

  /**
   * Update an existing shortcut
   * @param {string} categoryId - The category ID
   * @param {string} shortcutId - The shortcut ID
   * @param {Object} shortcutData - The updated shortcut data
   * @returns {Promise} Promise that resolves with the updated shortcut
   */
  async updateShortcut(categoryId, shortcutId, shortcutData) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const shortcutIndex = category.shortcuts.findIndex(shortcut => shortcut.id === shortcutId);
    if (shortcutIndex === -1) {
      throw new Error(`Shortcut with ID ${shortcutId} not found in category ${categoryId}`);
    }

    const updatedShortcut = {
      ...category.shortcuts[shortcutIndex],
      ...shortcutData
    };

    category.shortcuts[shortcutIndex] = updatedShortcut;
    await this.saveToStorage();
    return updatedShortcut;
  }

  /**
   * Delete a shortcut
   * @param {string} categoryId - The category ID
   * @param {string} shortcutId - The shortcut ID
   * @returns {Promise} Promise that resolves when the shortcut is deleted
   */
  async deleteShortcut(categoryId, shortcutId) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const shortcutIndex = category.shortcuts.findIndex(shortcut => shortcut.id === shortcutId);
    if (shortcutIndex === -1) {
      throw new Error(`Shortcut with ID ${shortcutId} not found in category ${categoryId}`);
    }

    category.shortcuts.splice(shortcutIndex, 1);
    await this.saveToStorage();
    return true;
  }

  /**
   * Update settings
   * @param {Object} settings - The settings object
   * @returns {Promise} Promise that resolves when settings are updated
   */
  async updateSettings(settings) {
    this.data.settings = {
      ...this.data.settings,
      ...settings
    };
    await this.saveToStorage();
    return this.data.settings;
  }

  /**
   * Get current settings
   * @returns {Object} The settings object
   */
  getSettings() {
    return this.data.settings;
  }

  /**
   * 直接存储指定键的数据（用于主题、背景图片等单独数据）
   * @param {Object} data - 要存储的键值对对象
   * @returns {Promise} 存储完成的Promise
   */
  async set(data) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(data, resolve);
      } else {
        // 开发环境或Chrome存储不可用时的备选方案
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, JSON.stringify(data[key]));
        });
        resolve();
      }
    });
  }

  /**
   * 获取指定键的数据（用于主题、背景图片等单独数据）
   * @param {Array|string} keys - 要获取的键或键数组
   * @returns {Promise} 包含数据的Promise
   */
  async get(keys) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        // Development environment fallback - return empty result
        console.warn('Chrome storage not available, returning empty result');
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            result[key] = undefined;
          });
          resolve(result);
        } else {
          resolve({ [keys]: undefined });
        }
      }
    });
  }
}

// Create and export a singleton instance
const storageManager = new StorageManager();

// 为了在theme.js中使用，创建简化的storage对象
const storage = {
  set: (data) => storageManager.set(data),
  get: (keys) => storageManager.get(keys)
};

// 导出storage对象
window.storage = storage; 