/**
 * 存储适配器
 * 为现有的管理器提供兼容接口，使其能够使用新的统一数据管理器
 */

class StorageAdapter {
  constructor() {
    this.data = null;
    this.fullData = null;
  }

  /**
   * 初始化适配器
   */
  async init() {
    console.log('StorageAdapter: 开始初始化...');

    // 确保统一数据管理器已初始化
    if (!window.unifiedDataManager.currentConfigData) {
      console.log('StorageAdapter: 统一数据管理器未初始化，正在初始化...');
      await window.unifiedDataManager.init();
    }

    // 获取当前数据
    this.updateDataFromUnified();

    console.log('StorageAdapter: 初始化完成，当前数据:', {
      categoriesCount: this.data?.categories?.length || 0,
      currentConfig: window.unifiedDataManager.getCurrentConfig()
    });

    return this.data;
  }

  /**
   * 从统一数据管理器更新数据
   */
  updateDataFromUnified() {
    const currentData = window.unifiedDataManager.getCurrentConfigData();
    if (currentData) {
      this.data = {
        categories: currentData.categories || [],
        settings: currentData.settings || { viewMode: 'grid' }
      };
      this.fullData = currentData;
    }
  }

  /**
   * 保存数据到存储
   */
  async saveToStorage() {
    try {
      // 合并数据
      const dataToSave = {
        ...this.fullData,
        categories: this.data.categories,
        settings: this.data.settings
      };
      
      await window.unifiedDataManager.saveCurrentConfigData(dataToSave);
      this.updateDataFromUnified();
    } catch (error) {
      console.error('StorageAdapter: 保存失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有分类
   */
  getCategories() {
    return this.data?.categories || [];
  }

  /**
   * 获取排序后的分类
   */
  getSortedCategories() {
    const categories = this.getCategories();
    return categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * 获取指定分类
   */
  getCategory(categoryId) {
    return this.data?.categories?.find(cat => cat.id === categoryId);
  }

  /**
   * 获取排序后的快捷方式
   */
  getSortedShortcuts(categoryId) {
    const category = this.getCategory(categoryId);
    if (!category || !category.shortcuts) {
      return [];
    }
    return category.shortcuts.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * 获取指定快捷方式
   */
  getShortcut(categoryId, shortcutId) {
    const category = this.getCategory(categoryId);
    if (!category || !category.shortcuts) {
      return null;
    }
    return category.shortcuts.find(shortcut => shortcut.id === shortcutId);
  }

  /**
   * 切换分类折叠状态
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
   * 添加分类
   */
  async addCategory(categoryData) {
    const maxOrder = Math.max(...this.data.categories.map(cat => cat.order || 0), -1);
    
    const newCategory = {
      id: this.generateId('cat'),
      name: categoryData.name,
      color: categoryData.color,
      collapsed: false,
      order: maxOrder + 1,
      shortcuts: []
    };

    this.data.categories.push(newCategory);
    await this.saveToStorage();
    return newCategory;
  }

  /**
   * 更新分类
   */
  async updateCategory(categoryId, updates) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    Object.assign(category, updates);
    await this.saveToStorage();
    return category;
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId) {
    const categoryIndex = this.data.categories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    this.data.categories.splice(categoryIndex, 1);
    await this.saveToStorage();
  }

  /**
   * 添加快捷方式
   */
  async addShortcut(categoryId, shortcutData) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const maxOrder = Math.max(...category.shortcuts.map(shortcut => shortcut.order || 0), -1);

    const newShortcut = {
      id: this.generateId('shortcut'),
      name: shortcutData.name,
      url: shortcutData.url,
      iconType: shortcutData.iconType || 'letter',
      iconColor: shortcutData.iconColor || '#4285f4',
      iconUrl: shortcutData.iconUrl || '',
      order: maxOrder + 1
    };

    category.shortcuts.push(newShortcut);
    await this.saveToStorage();
    return newShortcut;
  }

  /**
   * 更新快捷方式
   */
  async updateShortcut(categoryId, shortcutId, updates) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const shortcut = category.shortcuts.find(s => s.id === shortcutId);
    if (!shortcut) {
      throw new Error(`Shortcut with ID ${shortcutId} not found`);
    }

    Object.assign(shortcut, updates);
    await this.saveToStorage();
    return shortcut;
  }

  /**
   * 删除快捷方式
   */
  async deleteShortcut(categoryId, shortcutId) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const shortcutIndex = category.shortcuts.findIndex(s => s.id === shortcutId);
    if (shortcutIndex === -1) {
      throw new Error(`Shortcut with ID ${shortcutId} not found`);
    }

    category.shortcuts.splice(shortcutIndex, 1);
    await this.saveToStorage();
  }

  /**
   * 移动分类
   */
  async moveCategory(categoryId, newOrder) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    category.order = newOrder;
    await this.saveToStorage();
  }

  /**
   * 移动快捷方式
   */
  async moveShortcut(categoryId, shortcutId, newOrder) {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const shortcut = category.shortcuts.find(s => s.id === shortcutId);
    if (!shortcut) {
      throw new Error(`Shortcut with ID ${shortcutId} not found`);
    }

    shortcut.order = newOrder;
    await this.saveToStorage();
  }

  /**
   * 重新排序分类
   */
  async reorderCategories(categoryIds) {
    try {
      console.log('StorageAdapter: 重新排序分类', categoryIds);

      // 根据新的ID顺序重新设置order值
      categoryIds.forEach((categoryId, index) => {
        const category = this.getCategory(categoryId);
        if (category) {
          category.order = index;
        }
      });

      await this.saveToStorage();
      console.log('StorageAdapter: 分类排序完成');
    } catch (error) {
      console.error('StorageAdapter: 分类排序失败:', error);
      throw error;
    }
  }

  /**
   * 重新排序快捷方式
   */
  async reorderShortcuts(categoryId, shortcutIds) {
    try {
      console.log('StorageAdapter: 重新排序快捷方式', categoryId, shortcutIds);

      const category = this.getCategory(categoryId);
      if (!category) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }

      // 根据新的ID顺序重新设置order值
      shortcutIds.forEach((shortcutId, index) => {
        const shortcut = category.shortcuts.find(s => s.id === shortcutId);
        if (shortcut) {
          shortcut.order = index;
        }
      });

      await this.saveToStorage();
      console.log('StorageAdapter: 快捷方式排序完成');
    } catch (error) {
      console.error('StorageAdapter: 快捷方式排序失败:', error);
      throw error;
    }
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    await this.saveToStorage();
  }

  /**
   * 获取设置
   */
  getSettings() {
    return this.data?.settings || { viewMode: 'grid' };
  }

  /**
   * 导出数据
   */
  exportData() {
    return {
      categories: this.data.categories,
      settings: this.data.settings,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * 导入数据
   */
  async importData(importedData) {
    if (!importedData.categories) {
      throw new Error('Invalid data format: missing categories');
    }

    this.data.categories = importedData.categories;
    this.data.settings = importedData.settings || { viewMode: 'grid' };
    
    await this.saveToStorage();
  }

  /**
   * 生成唯一ID
   */
  generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * 直接存储指定键的数据
   */
  async set(data) {
    // 这个方法用于主题设置等独立数据
    // 暂时保持原有逻辑，后续可以集成到统一数据管理器
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(data, resolve);
      } else {
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, JSON.stringify(data[key]));
        });
        resolve();
      }
    });
  }

  /**
   * 获取指定键的数据
   */
  async get(keys) {
    return new Promise((resolve) => {
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            const value = localStorage.getItem(key);
            result[key] = value ? JSON.parse(value) : undefined;
          });
          resolve(result);
        } else {
          const value = localStorage.getItem(keys);
          resolve({ [keys]: value ? JSON.parse(value) : undefined });
        }
      }
    });
  }
}

// 创建全局实例，替换原有的 storageManager
window.storageManager = new StorageAdapter();
