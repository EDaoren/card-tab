/**
 * 主题配置UI管理器
 * 处理背景设置模态框中的配置切换界面
 */

class ThemeConfigUIManager {
  constructor() {
    this.newConfigModal = null;
    this.configManagementModal = null;
    this.editConfigModal = null;
    this.isInitialized = false;
    this.currentConfigs = [];
    this.filteredConfigs = [];
    this.currentEditingConfigId = null;
    this.configListClickHandler = null; // 存储事件处理器引用
  }

  /**
   * 初始化UI管理器
   */
  async init() {
    if (this.isInitialized) return;

    // 获取模态框元素
    this.newConfigModal = document.getElementById('new-config-modal');
    this.configManagementModal = document.getElementById('config-management-modal');
    this.editConfigModal = document.getElementById('edit-config-modal');

    if (!this.newConfigModal) {
      console.error('ThemeConfigUIManager: 新建配置模态框元素未找到');
      return;
    }

    if (!this.configManagementModal) {
      console.error('ThemeConfigUIManager: 配置管理模态框元素未找到');
      return;
    }

    // 初始化主题配置管理器
    await themeConfigManager.init();

    // 确保当前活跃配置被应用到同步管理器
    await this.applyActiveConfigToSyncManager();

    this.bindEvents();
    this.isInitialized = true;
    console.log('ThemeConfigUIManager: 初始化完成');
  }

  /**
   * 将当前活跃配置应用到同步管理器
   * 修改：检查配置是否有变化，避免重复保存相同配置
   */
  async applyActiveConfigToSyncManager() {
    try {
      const activeConfig = themeConfigManager.getActiveConfig();

      if (activeConfig && activeConfig.supabaseUrl && activeConfig.supabaseKey) {
        console.log('ThemeConfigUIManager: 检查活跃配置:', activeConfig.displayName);

        // 检查当前同步管理器配置是否已经是这个配置
        const currentConfig = await syncManager.getSupabaseConfig();
        const newConfig = {
          url: activeConfig.supabaseUrl,
          anonKey: activeConfig.supabaseKey,
          userId: activeConfig.userId,
          enabled: true
        };

        // 比较配置是否相同，避免重复保存
        const isSameConfig = currentConfig &&
          currentConfig.url === newConfig.url &&
          currentConfig.anonKey === newConfig.anonKey &&
          currentConfig.userId === newConfig.userId &&
          currentConfig.enabled === newConfig.enabled;

        if (!isSameConfig) {
          console.log('ThemeConfigUIManager: 配置有变化，更新同步管理器配置');

          // 更新同步管理器配置
          await syncManager.saveSupabaseConfig(newConfig);

          // 重新初始化同步管理器
          await syncManager.init();

          console.log('ThemeConfigUIManager: 活跃配置已应用到同步管理器');
        } else {
          console.log('ThemeConfigUIManager: 配置无变化，跳过保存操作');
        }
      } else {
        console.log('ThemeConfigUIManager: 没有有效的活跃配置，使用默认同步管理器配置');
      }
    } catch (error) {
      console.error('ThemeConfigUIManager: 应用活跃配置失败:', error);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 立即配置云端同步按钮
    const setupSyncBtn = document.getElementById('setup-sync-btn');
    if (setupSyncBtn) {
      setupSyncBtn.addEventListener('click', () => this.openSyncModal());
    }

    // 配置下拉菜单按钮
    const configDropdownBtn = document.getElementById('config-dropdown-btn');
    if (configDropdownBtn) {
      configDropdownBtn.addEventListener('click', () => this.toggleConfigDropdown());
    }

    // 新建配置按钮
    const newConfigBtn = document.getElementById('new-config-btn');
    if (newConfigBtn) {
      newConfigBtn.addEventListener('click', () => this.openNewConfigModal());
    }

    // 管理配置按钮
    const manageConfigsBtn = document.getElementById('manage-configs-btn');
    if (manageConfigsBtn) {
      manageConfigsBtn.addEventListener('click', () => this.openConfigManagementModal());
    }

    // 新建配置模态框事件
    if (this.newConfigModal) {
      const closeButtons = this.newConfigModal.querySelectorAll('.close-modal');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => this.closeNewConfigModal());
      });

      const cancelBtn = document.getElementById('cancel-new-config-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.closeNewConfigModal());
      }

      const form = document.getElementById('new-config-form');
      if (form) {
        form.addEventListener('submit', (e) => this.createNewConfig(e));
      }
    }

    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
      const dropdown = document.querySelector('.config-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  /**
   * 更新配置切换区域显示
   */
  async updateConfigSwitchDisplay() {
    const configPrompt = document.getElementById('config-prompt');
    const configSelector = document.getElementById('config-selector');

    if (!configPrompt || !configSelector) return;

    const isSupabaseConfigured = await themeConfigManager.isSupabaseConfigured();

    if (!isSupabaseConfigured) {
      // 显示配置提示
      configPrompt.style.display = 'flex';
      configSelector.style.display = 'none';
    } else {
      // 显示配置选择器
      configPrompt.style.display = 'none';
      configSelector.style.display = 'block';
      await this.updateConfigSelector();
    }
  }

  /**
   * 更新配置选择器
   */
  async updateConfigSelector() {
    const configs = themeConfigManager.getAllConfigs();
    const activeConfig = themeConfigManager.getActiveConfig();

    // 更新当前配置显示
    const currentConfigName = document.getElementById('current-config-name');
    const currentConfigUser = document.getElementById('current-config-user');

    if (activeConfig) {
      if (currentConfigName) currentConfigName.textContent = activeConfig.displayName;
      if (currentConfigUser) currentConfigUser.textContent = `(${activeConfig.userId})`;
    } else {
      // 如果没有配置，显示当前Supabase配置的用户ID
      const supabaseConfig = await themeConfigManager.getCurrentSupabaseConfig();
      if (currentConfigName) currentConfigName.textContent = '默认配置';
      if (currentConfigUser) currentConfigUser.textContent = supabaseConfig.userId ? `(${supabaseConfig.userId})` : '';
    }

    // 更新下拉菜单中的配置列表
    this.updateConfigDropdownList(configs, activeConfig);
  }

  /**
   * 更新配置下拉列表
   */
  updateConfigDropdownList(configs, activeConfig) {
    const configList = document.getElementById('theme-config-list');
    if (!configList) return;

    if (configs.length === 0) {
      configList.innerHTML = '<div class="config-item">暂无其他配置</div>';
      return;
    }

    configList.innerHTML = configs.map(config => `
      <div class="config-item ${config.isActive ? 'active' : ''}" data-config-id="${config.id}">
        <div class="config-info">
          <div class="config-name">${config.displayName}</div>
          <div class="config-user">${config.userId}</div>
        </div>
      </div>
    `).join('');

    // 绑定配置项点击事件
    configList.querySelectorAll('.config-item').forEach(item => {
      item.addEventListener('click', () => {
        const configId = item.dataset.configId;
        if (configId) {
          this.switchToConfig(configId);
        }
      });
    });
  }

  /**
   * 切换下拉菜单
   */
  toggleConfigDropdown() {
    const dropdown = document.querySelector('.config-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('open');
    }
  }

  /**
   * 切换到指定配置
   */
  async switchToConfig(configId) {
    let switchedConfig = null;

    try {
      console.log('开始切换配置:', configId);

      // 检查是否是动态配置（从Supabase查询的用户配置）
      const dynamicConfig = this.currentConfigs.find(c => c.id === configId);

      if (dynamicConfig) {
        console.log('切换到动态配置:', dynamicConfig);
        await this.switchToDynamicConfig(dynamicConfig);
        switchedConfig = dynamicConfig;
      } else {
        // 使用传统的themeConfigManager切换配置
        const config = await themeConfigManager.switchConfig(configId);
        console.log('配置切换到:', config);

        // 更新当前配置到同步管理器
        await syncManager.saveSupabaseConfig({
          url: config.supabaseUrl,
          anonKey: config.supabaseKey,
          userId: config.userId,
          enabled: true
        });

        console.log('同步管理器配置已更新');

        // 重新初始化同步管理器
        await syncManager.init();

        console.log('同步管理器已重新初始化');

        // 验证连接状态
        const connectionStatus = supabaseClient.getConnectionStatus();
        console.log('切换后的连接状态:', connectionStatus);

        // 清除Chrome Storage缓存，确保重新加载正确的用户数据
        console.log('清除Chrome Storage缓存...');
        await syncManager.clearChromeStorageCache();
        console.log('缓存已清除');

        // 强制从云端重新加载数据（验证数据是否正确）
        console.log('强制从云端重新加载数据...');
        const freshData = await syncManager.loadData(true, true); // preferCloud=true, forceRefresh=true
        console.log('重新加载的数据:', freshData);

        switchedConfig = config;
      }

      // 使用统一的配置刷新入口
      console.log('🔄 开始调用统一配置刷新...');
      await this.refreshCurrentConfiguration();
      console.log('🔄 统一配置刷新完成');

      // 显示详细的切换信息
      if (switchedConfig) {
        const message = `已切换到配置: ${switchedConfig.displayName} (${switchedConfig.userId})`;
        this.showMessage(message, 'success');

        // 在控制台输出详细信息用于调试
        console.log('配置切换完成:', {
          configName: switchedConfig.displayName,
          userId: switchedConfig.userId,
          supabaseUrl: switchedConfig.supabaseUrl || '动态配置'
        });
      }
    } catch (error) {
      console.error('切换配置失败:', error);
      this.showMessage(`切换配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 切换到动态配置（从Supabase查询的用户配置）- 旁路缓存模式
   */
  async switchToDynamicConfig(config) {
    try {
      console.log('切换到动态配置（旁路缓存模式）:', config.userId);

      // 1. 更新Supabase配置（主存储）
      await syncManager.saveSupabaseConfig({
        url: supabaseClient.config?.url,
        anonKey: supabaseClient.config?.anonKey,
        userId: config.userId,
        enabled: true
      });
      console.log('Supabase配置已更新到主存储');

      // 2. 清除Chrome Storage缓存
      await syncManager.clearChromeStorageCache();
      console.log('Chrome Storage缓存已清除');

      // 3. 重新初始化连接到新用户（验证连接）
      await supabaseClient.initialize({
        url: supabaseClient.config?.url,
        anonKey: supabaseClient.config?.anonKey,
        userId: config.userId
      }, true); // shouldTest = true，验证新配置是否有效

      // 4. 更新syncManager状态
      if (typeof syncManager !== 'undefined') {
        syncManager.isSupabaseEnabled = true;
        syncManager.currentSupabaseConfig = {
          url: supabaseClient.config?.url,
          anonKey: supabaseClient.config?.anonKey,
          userId: config.userId,
          enabled: true
        };
      }

      // 5. 同步更新传统配置系统（确保两套系统一致）
      console.log('同步更新传统配置系统...');
      await this.syncDynamicConfigToTraditional(config);
      console.log('传统配置系统已同步更新');

      console.log('动态配置切换完成（旁路缓存模式），新用户ID:', config.userId);
    } catch (error) {
      console.error('切换动态配置失败:', error);
      throw error;
    }
  }

  /**
   * 同步动态配置到传统配置系统
   * 确保动态配置切换时，传统配置系统也能正确更新
   */
  async syncDynamicConfigToTraditional(dynamicConfig) {
    try {
      console.log('开始同步动态配置到传统配置系统:', dynamicConfig.userId);

      // 1. 查找或创建对应的传统配置
      let traditionalConfig = themeConfigManager.configs.find(c => c.userId === dynamicConfig.userId);

      if (!traditionalConfig) {
        // 如果不存在，创建新的传统配置
        console.log('创建新的传统配置:', dynamicConfig.userId);
        traditionalConfig = {
          id: `theme_config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          displayName: dynamicConfig.displayName || `配置_${dynamicConfig.userId}`,
          userId: dynamicConfig.userId,
          supabaseUrl: supabaseClient.config?.url || '',
          supabaseKey: supabaseClient.config?.anonKey || '',
          isActive: false,
          isDefault: false,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          lastSync: new Date().toISOString(),
          shortcutCount: dynamicConfig.shortcutCount || 0
        };

        themeConfigManager.configs.push(traditionalConfig);
      }

      // 2. 切换到这个传统配置
      console.log('切换传统配置系统到:', traditionalConfig.id);
      await themeConfigManager.switchConfig(traditionalConfig.id);

      console.log('动态配置已同步到传统配置系统');
    } catch (error) {
      console.error('同步动态配置到传统配置系统失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 统一的配置刷新入口 - 全局配置数据刷新管理器
   */
  async refreshCurrentConfiguration() {
    try {
      console.log('🔄 开始刷新当前配置数据...');

      // 1. 重新加载主题设置
      if (typeof loadThemeSettings === 'function') {
        console.log('🔄 重新加载主题设置...');
        await loadThemeSettings();
        console.log('✅ 主题设置加载完成');
      } else {
        console.warn('⚠️ loadThemeSettings 函数不存在');
      }

      // 2. 更新配置选择器UI
      if (this.updateConfigSelector) {
        console.log('🔄 更新配置选择器UI...');
        await this.updateConfigSelector();
        console.log('✅ 配置选择器UI更新完成');
      } else {
        console.warn('⚠️ updateConfigSelector 方法不存在');
      }

      // 3. 更新主题选择UI
      if (typeof updateThemeOptionsUI === 'function') {
        console.log('🔄 更新主题选择UI...');
        updateThemeOptionsUI();
        console.log('✅ 主题选择UI更新完成');
      } else {
        console.warn('⚠️ updateThemeOptionsUI 函数不存在');
      }

      // 4. 更新背景图片UI
      if (typeof updateBackgroundImageUI === 'function') {
        console.log('🔄 更新背景图片UI...');
        updateBackgroundImageUI();
        console.log('✅ 背景图片UI更新完成');
      } else {
        console.warn('⚠️ updateBackgroundImageUI 函数不存在');
      }

      // 5. 更新背景图片预览
      if (typeof showCurrentBackgroundPreview === 'function') {
        console.log('🔄 更新背景图片预览...');
        showCurrentBackgroundPreview();
        console.log('✅ 背景图片预览更新完成');
      } else {
        console.warn('⚠️ showCurrentBackgroundPreview 函数不存在');
      }

      // 6. 刷新快捷方式数据
      if (typeof storageManager !== 'undefined' && storageManager.init) {
        console.log('🔄 重新加载快捷方式数据...');
        await storageManager.init();
        console.log('✅ 快捷方式数据加载完成');
      } else if (typeof loadData === 'function') {
        console.log('🔄 重新加载快捷方式数据（备选方案）...');
        await loadData();
        console.log('✅ 快捷方式数据加载完成');
      } else {
        console.warn('⚠️ storageManager 和 loadData 函数都不存在');
      }

      // 7. 重新渲染快捷方式
      if (typeof categoryManager !== 'undefined' && categoryManager.renderCategories) {
        console.log('🔄 通过categoryManager重新渲染快捷方式...');
        await categoryManager.renderCategories();
        console.log('✅ 快捷方式渲染完成（通过categoryManager）');
      } else if (typeof renderCategories === 'function') {
        console.log('🔄 重新渲染快捷方式（备选方案）...');
        renderCategories();
        console.log('✅ 快捷方式渲染完成');
      } else {
        console.warn('⚠️ categoryManager 和 renderCategories 函数都不存在');
      }



      // 8. 关闭可能打开的下拉菜单
      const dropdown = document.querySelector('.config-dropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
        console.log('✅ 下拉菜单已关闭');
      }

      console.log('✅ 配置数据刷新完成');
    } catch (error) {
      console.error('❌ 配置数据刷新失败:', error);
      throw error;
    }
  }

  /**
   * 打开同步模态框
   */
  openSyncModal() {
    if (typeof syncUIManager !== 'undefined') {
      syncUIManager.openSyncModal();
    }
  }

  /**
   * 打开新建配置模态框
   */
  openNewConfigModal() {
    if (!this.newConfigModal) return;

    // 重置表单
    const form = document.getElementById('new-config-form');
    if (form) form.reset();

    this.newConfigModal.style.display = 'flex';
    this.newConfigModal.offsetHeight;
    this.newConfigModal.classList.add('show');
  }

  /**
   * 关闭新建配置模态框
   */
  closeNewConfigModal() {
    if (!this.newConfigModal) return;

    this.newConfigModal.classList.remove('show');
    setTimeout(() => {
      this.newConfigModal.style.display = 'none';
    }, 300);
  }

  /**
   * 创建新配置 - 旁路缓存模式
   */
  async createNewConfig(event) {
    event.preventDefault();

    const createBtn = document.getElementById('create-config-btn');
    const originalText = createBtn.textContent;

    try {
      createBtn.textContent = '创建中...';
      createBtn.disabled = true;

      const formData = {
        displayName: document.getElementById('new-config-name').value.trim(),
        userId: document.getElementById('new-config-user-id').value.trim()
      };

      console.log('开始创建新配置（旁路缓存模式）:', formData);

      // 检查配置是否已存在
      if (themeConfigManager.configExists(formData.userId)) {
        throw new Error('该用户标识已存在');
      }

      // 1. 创建新配置并保存到主存储（Supabase）
      const newConfig = await themeConfigManager.addConfig(formData);
      console.log('新配置已创建:', newConfig);

      // 2. 清除Chrome Storage缓存，确保下次读取最新数据
      await syncManager.clearChromeStorageCache();
      console.log('Chrome Storage缓存已清除');

      // 3. 直接切换到新配置（使用动态配置切换）
      const dynamicConfig = {
        id: newConfig.userId,
        displayName: newConfig.displayName,
        userId: newConfig.userId,
        supabaseUrl: supabaseClient.config?.url,
        supabaseKey: supabaseClient.config?.anonKey,
        isActive: false,
        isDefault: false,
        createdAt: new Date().toISOString()
      };

      console.log('准备切换到新创建的配置:', dynamicConfig);
      await this.switchToDynamicConfig(dynamicConfig);

      // 4. 刷新当前配置的所有数据和UI
      console.log('🔄 开始刷新新配置的数据...');
      await this.refreshCurrentConfiguration();
      console.log('🔄 新配置数据刷新完成');

      this.closeNewConfigModal();
      this.showMessage('配置创建并切换成功！', 'success');
    } catch (error) {
      console.error('创建配置失败:', error);
      this.showMessage(`创建配置失败: ${error.message}`, 'error');
    } finally {
      createBtn.textContent = originalText;
      createBtn.disabled = false;
    }
  }

  /**
   * 显示消息
   */
  showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `sync-message ${type}`;
    messageEl.textContent = message;

    // 添加到背景设置模态框
    const bgModal = document.getElementById('bg-modal');
    const modalBody = bgModal ? bgModal.querySelector('.modal-body') : null;

    if (modalBody) {
      modalBody.insertBefore(messageEl, modalBody.firstChild);

      // 3秒后自动移除
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 3000);
    }
  }

  /**
   * 打开配置管理模态框
   */
  async openConfigManagementModal() {
    if (!this.configManagementModal) return;

    // 加载配置列表（包含渲染）
    await this.loadConfigList();

    this.configManagementModal.style.display = 'flex';
    this.configManagementModal.offsetHeight;
    this.configManagementModal.classList.add('show');

    // 绑定模态框事件
    this.bindConfigManagementEvents();
  }

  /**
   * 关闭配置管理模态框
   */
  closeConfigManagementModal() {
    if (!this.configManagementModal) return;

    this.configManagementModal.classList.remove('show');
    setTimeout(() => {
      this.configManagementModal.style.display = 'none';
    }, 300);
  }

  /**
   * 绑定配置管理模态框事件
   */
  bindConfigManagementEvents() {
    // 避免重复绑定
    if (this.configManagementModal.dataset.eventsBound) return;
    this.configManagementModal.dataset.eventsBound = 'true';

    // 关闭按钮
    const closeButtons = this.configManagementModal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeConfigManagementModal());
    });

    // 点击外部关闭
    this.configManagementModal.addEventListener('click', (e) => {
      if (e.target === this.configManagementModal) {
        this.closeConfigManagementModal();
      }
    });

    // 搜索功能
    const searchInput = document.getElementById('config-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleConfigSearch(e.target.value));
    }

    // 排序功能
    const sortSelect = document.getElementById('config-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => this.handleConfigSort(e.target.value));
    }

    // 新建配置按钮
    const newConfigBtnMain = document.getElementById('new-config-btn-main');
    if (newConfigBtnMain) {
      newConfigBtnMain.addEventListener('click', () => {
        this.closeConfigManagementModal();
        this.openNewConfigModal();
      });
    }
  }

  /**
   * 加载配置列表 - 直接查询Supabase
   */
  async loadConfigList() {
    try {
      if (typeof syncManager !== 'undefined' && syncManager.isSupabaseEnabled) {
        // 启用Supabase：直接查询Supabase获取最新配置列表
        await this.loadConfigListFromSupabase();
      } else {
        // 未启用Supabase：使用本地数据
        this.currentConfigs = themeConfigManager.getAllConfigs();
      }

      // 设置过滤后的配置列表并渲染
      this.filteredConfigs = [...this.currentConfigs];
      this.renderConfigList();

    } catch (error) {
      console.error('ThemeConfigUI: 加载配置列表失败:', error);
      // 降级：使用本地数据
      this.currentConfigs = themeConfigManager.getAllConfigs();
      this.filteredConfigs = [...this.currentConfigs];
      this.renderConfigList();
    }
  }

  /**
   * 直接从Supabase加载配置列表
   */
  async loadConfigListFromSupabase() {
    try {
      console.log('ThemeConfigUI: 直接从Supabase查询所有用户的配置列表');

      // 查询所有用户的数据来构建配置列表
      const allUserData = await supabaseClient.getAllData();
      console.log('ThemeConfigUI: 所有用户数据:', allUserData);

      this.currentConfigs = [];

      // 遍历所有用户数据，提取配置信息
      if (allUserData && Array.isArray(allUserData)) {
        allUserData.forEach(userData => {
          if (userData && userData.data) {
            // 为每个用户创建一个配置项
            const config = {
              id: userData.user_id,
              displayName: `用户 ${userData.user_id} 的配置`,
              userId: userData.user_id,
              supabaseUrl: '', // 这些信息在数据中没有，需要从当前连接获取
              supabaseKey: '',
              isActive: userData.user_id === supabaseClient.userId, // 当前用户的配置标记为活跃
              isDefault: userData.user_id === 'default',
              createdAt: userData.created_at,
              lastModified: userData.updated_at,
              lastSync: userData.updated_at,
              shortcutCount: userData.data.categories ?
                userData.data.categories.reduce((total, cat) => total + (cat.shortcuts?.length || 0), 0) : 0
            };

            this.currentConfigs.push(config);
          }
        });

        console.log('ThemeConfigUI: 构建的配置列表数量:', this.currentConfigs.length);
        console.log('ThemeConfigUI: 构建的配置列表:', this.currentConfigs);
      } else {
        console.log('ThemeConfigUI: 没有找到任何用户数据');
      }
    } catch (error) {
      console.warn('ThemeConfigUI: 从Supabase查询配置列表失败:', error);
      this.currentConfigs = [];
    }
  }

  /**
   * 强制刷新配置列表（直接从Supabase重新获取）
   */
  async forceRefreshConfigList() {
    try {
      console.log('ThemeConfigUI: 强制刷新配置列表');

      // 清空当前配置缓存
      this.currentConfigs = [];
      this.filteredConfigs = [];

      // 直接重新加载配置列表（会从Supabase获取最新数据）
      await this.loadConfigList();

      console.log('ThemeConfigUI: 配置列表强制刷新完成');
    } catch (error) {
      console.error('ThemeConfigUI: 强制刷新失败:', error);
    }
  }

  /**
   * 处理配置导入后的UI刷新
   */
  async handleConfigurationImported() {
    try {
      // 1. 重新加载配置管理器的配置
      if (typeof themeConfigManager !== 'undefined') {
        await themeConfigManager.loadConfigs();
      }

      // 2. 强制刷新配置列表
      await this.forceRefreshConfigList();

      // 3. 更新配置选择器
      await this.updateConfigSelector();

      // 4. 更新配置切换显示
      await this.updateConfigSwitchDisplay();
    } catch (error) {
      console.error('ThemeConfigUI: 配置导入后UI刷新失败:', error);
    }
  }

  /**
   * 渲染配置列表
   */
  renderConfigList() {
    const configList = document.getElementById('config-list');
    const configEmpty = document.getElementById('config-empty');

    if (!configList || !configEmpty) return;

    if (this.filteredConfigs.length === 0) {
      configList.style.display = 'none';
      configEmpty.style.display = 'block';
      return;
    }

    configList.style.display = 'block';
    configEmpty.style.display = 'none';

    configList.innerHTML = this.filteredConfigs.map(config => this.createConfigCard(config)).join('');

    // 绑定配置卡片事件
    this.bindConfigCardEvents();
  }

  /**
   * 创建配置卡片HTML
   */
  createConfigCard(config) {
    const isActive = config.isActive;
    const isDefault = config.isDefault || config.id === 'default';
    const shortcutCount = config.shortcutCount || 0;

    // 显示最后修改时间而不是同步时间
    const lastModified = config.lastModified ? this.formatTime(config.lastModified) :
                        (config.createdAt ? this.formatTime(config.createdAt) : '未知');

    return `
      <div class="config-card ${isActive ? 'active' : ''}" data-config-id="${config.id}">
        <div class="config-card-header">
          <div class="config-info">
            <div class="config-name">
              ${config.displayName}
              ${isActive ? '<span class="config-badge">当前</span>' : ''}
              ${isDefault ? '<span class="config-badge" style="background: #28a745;">默认</span>' : ''}
              ${config.isTemporary ? '<span class="config-badge" style="background: #ffa500;">临时</span>' : ''}
            </div>
            <div class="config-user">👤 ${config.userId || 'default'}</div>
          </div>
        </div>
        <div class="config-meta">
          <div class="config-meta-item">
            <span>🕒</span>
            <span>更新于 ${lastModified}</span>
          </div>
          <div class="config-meta-item">
            <span>📊</span>
            <span>${shortcutCount} 个快捷方式</span>
          </div>
          <div class="config-meta-item">
            <span>📅</span>
            <span>创建于 ${config.createdAt ? this.formatTime(config.createdAt) : '未知'}</span>
          </div>
        </div>
        <div class="config-actions-row">
          ${!isActive ? `<button class="config-btn primary" data-action="switch" data-config-id="${config.id}">切换</button>` : ''}
          ${!config.isTemporary && !isDefault ? `<button class="config-btn" data-action="edit" data-config-id="${config.id}">编辑</button>` : ''}
          ${!config.isTemporary ? `<button class="config-btn" data-action="export" data-config-id="${config.id}">导出</button>` : ''}
          ${!isActive && !config.isTemporary && !isDefault ? `<button class="config-btn danger" data-action="delete" data-config-id="${config.id}">删除</button>` : ''}
          ${config.isTemporary ? `<button class="config-btn primary" data-action="save-temp" data-config-id="${config.id}">保存配置</button>` : ''}
        </div>
      </div>
    `;
  }



  /**
   * 处理配置搜索
   */
  handleConfigSearch(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredConfigs = [...this.currentConfigs];
    } else {
      this.filteredConfigs = this.currentConfigs.filter(config =>
        config.displayName.toLowerCase().includes(term) ||
        config.userId.toLowerCase().includes(term)
      );
    }

    this.renderConfigList();
  }

  /**
   * 处理配置排序
   */
  handleConfigSort(sortType) {
    switch (sortType) {
      case 'name':
        this.filteredConfigs.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'recent':
        this.filteredConfigs.sort((a, b) => {
          const aTime = a.lastSyncTime || a.createdAt;
          const bTime = b.lastSyncTime || b.createdAt;
          return new Date(bTime) - new Date(aTime);
        });
        break;
      case 'created':
        this.filteredConfigs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    this.renderConfigList();
  }

  /**
   * 绑定配置卡片事件
   */
  bindConfigCardEvents() {
    const configList = document.getElementById('config-list');
    if (!configList) return;

    // 移除之前的事件监听器（如果存在）
    if (this.configListClickHandler) {
      configList.removeEventListener('click', this.configListClickHandler);
    }

    // 创建新的事件处理器
    this.configListClickHandler = (e) => {
      const button = e.target.closest('.config-btn');
      if (!button) return;

      const action = button.dataset.action;
      const configId = button.dataset.configId;

      if (!action || !configId) return;

      // 防止重复点击
      if (button.disabled) return;

      switch (action) {
        case 'switch':
          this.switchToConfigFromManagement(configId);
          break;
        case 'edit':
          this.editConfig(configId);
          break;
        case 'export':
          this.exportConfig(configId);
          break;
        case 'delete':
          this.deleteConfig(configId);
          break;
        case 'save-temp':
          this.saveTemporaryConfig(configId);
          break;
        default:
          console.warn('未知的配置操作:', action);
      }
    };

    // 绑定新的事件监听器
    configList.addEventListener('click', this.configListClickHandler);
  }

  /**
   * 从配置管理界面切换配置
   */
  async switchToConfigFromManagement(configId) {
    try {
      await this.switchToConfig(configId);
      this.closeConfigManagementModal();
      this.showMessage('配置切换成功！', 'success');
    } catch (error) {
      console.error('切换配置失败:', error);
      this.showMessage(`切换配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 编辑配置
   */
  async editConfig(configId) {
    const config = this.currentConfigs.find(c => c.id === configId);
    if (!config) return;

    this.currentEditingConfigId = configId;

    // 填充编辑表单
    const nameInput = document.getElementById('edit-config-name');
    const userIdInput = document.getElementById('edit-config-user-id');

    if (nameInput) nameInput.value = config.displayName;
    if (userIdInput) userIdInput.value = config.userId;

    // 关闭配置管理模态框，打开编辑模态框
    this.closeConfigManagementModal();
    this.openEditConfigModal();
  }

  /**
   * 打开编辑配置模态框
   */
  openEditConfigModal() {
    if (!this.editConfigModal) return;

    this.editConfigModal.style.display = 'flex';
    this.editConfigModal.offsetHeight;
    this.editConfigModal.classList.add('show');

    // 绑定编辑模态框事件
    this.bindEditConfigEvents();
  }

  /**
   * 关闭编辑配置模态框
   */
  closeEditConfigModal() {
    if (!this.editConfigModal) return;

    this.editConfigModal.classList.remove('show');
    setTimeout(() => {
      this.editConfigModal.style.display = 'none';
    }, 300);

    this.currentEditingConfigId = null;
  }

  /**
   * 绑定编辑配置模态框事件
   */
  bindEditConfigEvents() {
    // 避免重复绑定
    if (this.editConfigModal.dataset.eventsBound) return;
    this.editConfigModal.dataset.eventsBound = 'true';

    // 关闭按钮
    const closeButtons = this.editConfigModal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeEditConfigModal());
    });

    // 取消按钮
    const cancelBtn = document.getElementById('cancel-edit-config-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeEditConfigModal());
    }

    // 表单提交
    const form = document.getElementById('edit-config-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleEditConfigSubmit(e));
    }

    // 点击外部关闭
    this.editConfigModal.addEventListener('click', (e) => {
      if (e.target === this.editConfigModal) {
        this.closeEditConfigModal();
      }
    });
  }

  /**
   * 处理编辑配置提交
   */
  async handleEditConfigSubmit(event) {
    event.preventDefault();

    if (!this.currentEditingConfigId) return;

    const saveBtn = document.getElementById('save-edit-config-btn');
    const originalText = saveBtn.textContent;

    try {
      saveBtn.textContent = '保存中...';
      saveBtn.disabled = true;

      const newName = document.getElementById('edit-config-name').value.trim();

      if (!newName) {
        throw new Error('配置名称不能为空');
      }

      // 更新配置
      await themeConfigManager.updateConfig(this.currentEditingConfigId, {
        displayName: newName
      });

      this.closeEditConfigModal();
      this.showMessage('配置更新成功！', 'success');

      // 更新UI显示
      await this.updateConfigSelector();
    } catch (error) {
      console.error('更新配置失败:', error);
      this.showMessage(`更新配置失败: ${error.message}`, 'error');
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  /**
   * 删除配置 - 支持动态配置和传统配置
   */
  async deleteConfig(configId) {
    const config = this.currentConfigs.find(c => c.id === configId);
    if (!config) return;

    if (!confirm(`确定要删除配置 "${config.displayName}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      // 检查是否是动态配置（从Supabase查询的用户配置）
      const isDynamicConfig = !themeConfigManager.configs.find(c => c.id === configId);

      if (isDynamicConfig) {
        console.log('删除动态配置:', config);
        await this.deleteDynamicConfig(config);
      } else {
        console.log('删除传统配置:', config);
        await themeConfigManager.deleteConfig(configId);
      }

      this.showMessage('配置删除成功！', 'success');

      // 重新加载配置列表
      await this.loadConfigList();

      // 更新UI显示
      await this.updateConfigSelector();
    } catch (error) {
      console.error('删除配置失败:', error);
      this.showMessage(`删除配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 删除动态配置（直接删除Supabase中的用户数据）
   */
  async deleteDynamicConfig(config) {
    try {
      console.log('开始删除动态配置的Supabase数据:', config.userId);

      // 获取当前Supabase连接信息
      const currentConnection = supabaseClient.getConnectionStatus();

      // 临时切换到目标用户进行删除操作
      await supabaseClient.initialize({
        url: currentConnection.config.url,
        anonKey: currentConnection.config.anonKey,
        userId: config.userId
      });

      // 删除Supabase中的用户数据
      await supabaseClient.deleteData();
      console.log('动态配置的Supabase数据已删除');

      // 恢复到原来的连接
      if (syncManager.currentSupabaseConfig) {
        await supabaseClient.initialize({
          url: syncManager.currentSupabaseConfig.url,
          anonKey: syncManager.currentSupabaseConfig.anonKey,
          userId: syncManager.currentSupabaseConfig.userId
        });
        console.log('已恢复到原始Supabase连接');
      }

    } catch (error) {
      console.error('删除动态配置失败:', error);
      throw error;
    }
  }

  /**
   * 导出配置
   */
  async exportConfig(configId) {
    try {
      const config = this.currentConfigs.find(c => c.id === configId);
      if (!config) return;

      const exportData = {
        displayName: config.displayName,
        userId: config.userId,
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
        exportTime: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `card-tab-config-${config.displayName}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      this.showMessage('配置导出成功！', 'success');
    } catch (error) {
      console.error('导出配置失败:', error);
      this.showMessage(`导出配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 保存临时配置
   */
  async saveTemporaryConfig(configId) {
    try {
      const tempConfig = this.filteredConfigs.find(c => c.id === configId);
      if (!tempConfig) return;

      const displayName = prompt('请输入配置名称:', '我的配置');
      if (!displayName) return;

      // 创建新配置
      const newConfig = await themeConfigManager.addConfig({
        displayName: displayName.trim(),
        userId: tempConfig.userId,
        supabaseUrl: tempConfig.supabaseUrl,
        supabaseKey: tempConfig.supabaseKey
      });

      this.showMessage('配置保存成功！', 'success');

      // 重新加载配置列表
      await this.loadConfigList();
    } catch (error) {
      console.error('保存配置失败:', error);
      this.showMessage(`保存配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 格式化时间显示
   */
  formatTime(timeString) {
    if (!timeString) return '未知';

    const time = new Date(timeString);
    const now = new Date();
    const diff = now - time;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return time.toLocaleDateString();
  }
}

// 创建全局实例
const themeConfigUIManager = new ThemeConfigUIManager();
window.themeConfigUIManager = themeConfigUIManager;

// 创建全局配置刷新函数
window.refreshCurrentConfiguration = async function() {
  if (window.themeConfigUIManager && window.themeConfigUIManager.refreshCurrentConfiguration) {
    return await window.themeConfigUIManager.refreshCurrentConfiguration();
  } else {
    console.warn('配置刷新管理器未初始化');
  }
};


