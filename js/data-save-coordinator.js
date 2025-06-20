/**
 * 第三阶段：数据保存协调器
 * 统一所有保存操作的入口，确保数据一致性
 */

class DataSaveCoordinator {
  constructor() {
    this.saveInProgress = false;
    this.pendingSaves = [];
    this.lastSaveTime = null;
    this.saveQueue = [];
  }

  /**
   * 统一的数据保存入口
   * @param {Object} data - 要保存的数据
   * @param {Object} options - 保存选项
   */
  async saveData(data, options = {}) {
    const saveRequest = {
      id: Date.now() + Math.random(),
      data: data,
      options: {
        source: options.source || 'unknown',
        priority: options.priority || 'normal', // 'high' | 'normal' | 'low'
        validateBefore: options.validateBefore !== false,
        mergeStrategy: options.mergeStrategy || 'smart', // 'smart' | 'overwrite' | 'merge'
        ...options
      },
      timestamp: new Date().toISOString()
    };

    console.log(`💾 DataSaveCoordinator: 收到保存请求 (${saveRequest.options.source})`);
    console.log(`  - 请求ID: ${saveRequest.id}`);
    console.log(`  - 优先级: ${saveRequest.options.priority}`);
    console.log(`  - 合并策略: ${saveRequest.options.mergeStrategy}`);

    // 如果有高优先级请求，立即处理
    if (saveRequest.options.priority === 'high') {
      return await this.processSaveRequest(saveRequest);
    }

    // 否则加入队列
    this.saveQueue.push(saveRequest);
    return await this.processSaveQueue();
  }

  /**
   * 处理保存队列
   */
  async processSaveQueue() {
    if (this.saveInProgress) {
      console.log('💾 DataSaveCoordinator: 保存正在进行中，等待队列处理');
      return new Promise((resolve, reject) => {
        this.pendingSaves.push({ resolve, reject });
      });
    }

    if (this.saveQueue.length === 0) {
      return;
    }

    this.saveInProgress = true;

    try {
      // 按优先级排序
      this.saveQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.options.priority] - priorityOrder[a.options.priority];
      });

      // 处理队列中的请求
      const results = [];
      while (this.saveQueue.length > 0) {
        const request = this.saveQueue.shift();
        try {
          const result = await this.processSaveRequest(request);
          results.push(result);
        } catch (error) {
          console.error(`💾 DataSaveCoordinator: 保存请求失败 (${request.id}):`, error);
          results.push({ success: false, error: error.message });
        }
      }

      // 通知等待的请求
      this.pendingSaves.forEach(({ resolve }) => resolve(results));
      this.pendingSaves = [];

      return results;
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * 处理单个保存请求
   */
  async processSaveRequest(request) {
    console.log(`💾 DataSaveCoordinator: 处理保存请求 ${request.id}`);

    try {
      // 1. 数据验证
      if (request.options.validateBefore) {
        const validationResult = await this.validateData(request.data, request.options.source);
        if (!validationResult.valid) {
          throw new Error(`数据验证失败: ${validationResult.errors.join(', ')}`);
        }
        console.log(`  ✅ 数据验证通过`);
      }

      // 2. 数据一致性检查
      const consistencyResult = await this.checkDataConsistency(request.data, request.options);
      if (!consistencyResult.consistent) {
        console.warn(`  ⚠️ 数据一致性警告: ${consistencyResult.warnings.join(', ')}`);
      }

      // 3. 数据合并
      const mergedData = await this.mergeData(request.data, request.options);
      console.log(`  🔄 数据合并完成，策略: ${request.options.mergeStrategy}`);

      // 4. 执行保存
      const saveResult = await this.executeSave(mergedData, request.options);
      console.log(`  💾 保存执行完成: ${saveResult.success ? '成功' : '失败'}`);

      this.lastSaveTime = new Date().toISOString();
      return saveResult;

    } catch (error) {
      console.error(`💾 DataSaveCoordinator: 保存请求处理失败:`, error);
      throw error;
    }
  }

  /**
   * 数据验证
   */
  async validateData(data, source) {
    const errors = [];
    const warnings = [];

    console.log(`  🔍 验证数据来源: ${source}`);

    // 基础结构验证
    if (!data || typeof data !== 'object') {
      errors.push('数据必须是对象');
      return { valid: false, errors, warnings };
    }

    // 根据来源进行特定验证
    switch (source) {
      case 'storageManager':
        if (!Array.isArray(data.categories)) {
          errors.push('categories必须是数组');
        }
        if (!data.settings || typeof data.settings !== 'object') {
          errors.push('settings必须是对象');
        }
        break;

      case 'themeSettings':
        if (data.themeSettings) {
          const ts = data.themeSettings;
          if (ts.theme && typeof ts.theme !== 'string') {
            errors.push('主题名称必须是字符串');
          }
          if (ts.backgroundOpacity !== undefined) {
            const opacity = parseInt(ts.backgroundOpacity);
            if (isNaN(opacity) || opacity < 0 || opacity > 100) {
              errors.push('背景透明度必须是0-100的数字');
            }
          }
        }
        break;

      case 'configManager':
        if (data.themeConfigs && !Array.isArray(data.themeConfigs)) {
          errors.push('themeConfigs必须是数组');
        }
        break;
    }

    // 数据大小检查
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 1024 * 1024) { // 1MB
      warnings.push(`数据大小较大: ${Math.round(dataSize / 1024)}KB`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 数据一致性检查
   */
  async checkDataConsistency(data, options) {
    const warnings = [];
    let consistent = true;

    console.log(`  🔍 检查数据一致性...`);

    try {
      // 检查是否会覆盖重要数据
      if (window.syncManager) {
        const currentData = await syncManager.loadData(false);
        
        if (currentData) {
          // 检查是否会丢失themeSettings
          if (currentData.themeSettings && !data.themeSettings && options.source !== 'themeSettings') {
            warnings.push('可能会丢失主题设置数据');
            consistent = false;
          }

          // 检查是否会丢失categories
          if (currentData.categories && currentData.categories.length > 0 && 
              (!data.categories || data.categories.length === 0) && 
              options.source !== 'storageManager') {
            warnings.push('可能会丢失分类数据');
            consistent = false;
          }

          // 检查时间戳
          const currentTime = currentData._metadata?.lastModified;
          const newTime = data._metadata?.lastModified;
          if (currentTime && newTime && new Date(newTime) < new Date(currentTime)) {
            warnings.push('保存的数据时间戳较旧');
          }
        }
      }
    } catch (error) {
      warnings.push(`一致性检查失败: ${error.message}`);
      consistent = false;
    }

    return { consistent, warnings };
  }

  /**
   * 数据合并
   */
  async mergeData(data, options) {
    console.log(`  🔄 执行数据合并，策略: ${options.mergeStrategy}`);

    if (options.mergeStrategy === 'overwrite') {
      console.log(`    - 覆盖策略：直接使用新数据`);
      return data;
    }

    try {
      // 获取当前数据
      let currentData = {};
      if (window.syncManager) {
        currentData = await syncManager.loadData(false) || {};
      }

      if (options.mergeStrategy === 'merge') {
        // 简单合并
        console.log(`    - 合并策略：简单合并`);
        return { ...currentData, ...data };
      }

      // 智能合并（默认）
      console.log(`    - 智能合并策略`);
      const mergedData = { ...currentData };

      // 根据来源智能合并
      switch (options.source) {
        case 'storageManager':
          // StorageManager只更新categories和settings
          mergedData.categories = data.categories;
          mergedData.settings = data.settings;
          console.log(`    - 更新categories和settings，保留其他字段`);
          break;

        case 'themeSettings':
          // 主题设置只更新themeSettings
          mergedData.themeSettings = data.themeSettings;
          console.log(`    - 更新themeSettings，保留其他字段`);
          break;

        case 'configManager':
          // 配置管理器的数据通常存储在不同位置
          return data;

        default:
          // 默认：完全合并
          Object.assign(mergedData, data);
          console.log(`    - 完全合并数据`);
      }

      // 更新元数据
      mergedData._metadata = {
        ...currentData._metadata,
        ...data._metadata,
        lastModified: new Date().toISOString(),
        mergedBy: 'dataSaveCoordinator'
      };

      return mergedData;

    } catch (error) {
      console.warn(`    - 合并失败，使用原始数据:`, error.message);
      return data;
    }
  }

  /**
   * 执行保存
   */
  async executeSave(data, options) {
    console.log(`  💾 执行保存操作...`);

    try {
      if (window.syncManager) {
        await syncManager.saveData(data);
        console.log(`    - SyncManager保存成功`);
        return { success: true, method: 'syncManager' };
      } else {
        // 备选方案
        if (chrome && chrome.storage && chrome.storage.sync) {
          await new Promise((resolve, reject) => {
            chrome.storage.sync.set({ quickNavData: data }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
          console.log(`    - Chrome Storage保存成功`);
          return { success: true, method: 'chromeStorage' };
        } else {
          // Development environment - skip saving
          console.warn('    - Chrome Storage不可用，跳过保存');
          return { success: false, method: 'none', error: 'Chrome Storage不可用' };
        }
      }
    } catch (error) {
      console.error(`    - 保存失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取保存状态
   */
  getSaveStatus() {
    return {
      saveInProgress: this.saveInProgress,
      queueLength: this.saveQueue.length,
      pendingCount: this.pendingSaves.length,
      lastSaveTime: this.lastSaveTime
    };
  }
}

// 创建全局实例
const dataSaveCoordinator = new DataSaveCoordinator();
window.dataSaveCoordinator = dataSaveCoordinator;
