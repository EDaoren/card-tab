/**
 * 主题配置UI管理器
 * 处理背景设置模态框中的配置切换界面
 */

class ThemeConfigUIManager {
  constructor() {
    this.newConfigModal = null;
    this.isInitialized = false;
  }

  /**
   * 初始化UI管理器
   */
  async init() {
    if (this.isInitialized) return;

    this.newConfigModal = document.getElementById('new-config-modal');
    
    if (!this.newConfigModal) {
      console.error('ThemeConfigUIManager: 新建配置模态框元素未找到');
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
   */
  async applyActiveConfigToSyncManager() {
    try {
      const activeConfig = themeConfigManager.getActiveConfig();

      if (activeConfig) {
        console.log('ThemeConfigUIManager: 应用活跃配置到同步管理器:', activeConfig.displayName);

        // 更新同步管理器配置
        await syncManager.saveSupabaseConfig({
          url: activeConfig.supabaseUrl,
          anonKey: activeConfig.supabaseKey,
          userId: activeConfig.userId,
          enabled: true
        });

        // 重新初始化同步管理器
        await syncManager.init();

        console.log('ThemeConfigUIManager: 活跃配置已应用到同步管理器');
      } else {
        console.log('ThemeConfigUIManager: 没有活跃配置，使用默认同步管理器配置');
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
      manageConfigsBtn.addEventListener('click', () => this.openSyncModal());
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
    try {
      console.log('开始切换配置:', configId);
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

      // 强制从云端重新加载数据（验证数据是否正确）
      console.log('强制从云端重新加载数据...');
      const freshData = await syncManager.loadData(true, true); // preferCloud=true, forceRefresh=true
      console.log('重新加载的数据:', freshData);

      // 强制重新加载主题设置
      if (typeof loadThemeSettings === 'function') {
        console.log('开始重新加载主题设置...');
        await loadThemeSettings();
        console.log('主题设置重新加载完成');
      }

      // 更新UI显示
      await this.updateConfigSelector();

      // 更新主题选择UI
      if (typeof updateThemeOptionsUI === 'function') {
        updateThemeOptionsUI();
      }

      // 更新背景图片UI
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
      }

      // 更新背景图片预览
      if (typeof showCurrentBackgroundPreview === 'function') {
        showCurrentBackgroundPreview();
      }

      // 关闭下拉菜单
      const dropdown = document.querySelector('.config-dropdown');
      if (dropdown) dropdown.classList.remove('open');

      // 显示详细的切换信息
      const message = `已切换到配置: ${config.displayName} (${config.userId})`;
      this.showMessage(message, 'success');

      // 在控制台输出详细信息用于调试
      console.log('配置切换完成:', {
        configName: config.displayName,
        userId: config.userId,
        supabaseUrl: config.supabaseUrl
      });
    } catch (error) {
      console.error('切换配置失败:', error);
      this.showMessage(`切换配置失败: ${error.message}`, 'error');
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
   * 创建新配置
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

      // 检查配置是否已存在
      if (themeConfigManager.configExists(formData.userId)) {
        throw new Error('该用户标识已存在');
      }

      // 创建新配置
      const newConfig = await themeConfigManager.addConfig(formData);
      
      // 切换到新配置
      await this.switchToConfig(newConfig.id);
      
      this.closeNewConfigModal();
      this.showMessage('配置创建成功！', 'success');
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
   * 调试配置切换（开发用）
   */
  async debugConfigSwitch() {
    try {
      console.log('=== 配置切换调试开始 ===');

      // 1. 检查当前状态
      const currentConnection = supabaseClient.getConnectionStatus();
      console.log('当前连接状态:', currentConnection);

      const configs = themeConfigManager.getAllConfigs();
      console.log('所有配置:', configs);

      const activeConfig = themeConfigManager.getActiveConfig();
      console.log('当前活跃配置:', activeConfig);

      // 2. 加载当前数据
      const currentData = await syncManager.loadData();
      console.log('当前数据:', currentData);

      // 3. 如果有多个配置，测试切换
      if (configs.length >= 2) {
        const targetConfig = configs.find(c => !c.isActive);
        if (targetConfig) {
          console.log('准备切换到配置:', targetConfig);
          await this.switchToConfig(targetConfig.id);

          // 验证切换结果
          const newConnection = supabaseClient.getConnectionStatus();
          console.log('切换后连接状态:', newConnection);

          const newData = await syncManager.loadData();
          console.log('切换后数据:', newData);
        }
      }

      console.log('=== 配置切换调试结束 ===');
    } catch (error) {
      console.error('配置切换调试失败:', error);
    }
  }
}

// 创建全局实例
const themeConfigUIManager = new ThemeConfigUIManager();
window.themeConfigUIManager = themeConfigUIManager;

// 添加全局调试函数
window.debugConfigSwitch = () => {
  if (themeConfigUIManager.isInitialized) {
    themeConfigUIManager.debugConfigSwitch();
  } else {
    console.log('主题配置UI管理器尚未初始化，请稍后再试');
  }
};
