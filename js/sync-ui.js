/**
 * 同步界面管理器
 * 处理Supabase同步相关的UI交互
 */

class SyncUIManager {
  constructor() {
    this.syncModal = null;
    this.sqlModal = null;
    this.configEditModal = null;
    this.isInitialized = false;
    this.editingConfigId = null;
  }

  /**
   * 初始化同步界面
   */
  async init() {
    if (this.isInitialized) return;

    this.syncModal = document.getElementById('sync-modal');
    this.sqlModal = document.getElementById('sql-modal');

    console.log('SyncUIManager: 模态框元素', {
      syncModal: !!this.syncModal,
      sqlModal: !!this.sqlModal
    });

    if (!this.syncModal || !this.sqlModal) {
      console.error('SyncUIManager: 模态框元素未找到');
      return;
    }

    this.bindEvents();
    this.updateSyncStatus();
    this.isInitialized = true;
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    console.log('SyncUIManager: 开始绑定事件');

    // 同步按钮
    const syncBtn = document.getElementById('sync-btn');
    console.log('SyncUIManager: 同步按钮', !!syncBtn);
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        console.log('SyncUIManager: 同步按钮被点击');
        e.preventDefault();
        this.openSyncModal();
      });
    } else {
      console.error('SyncUIManager: 同步按钮未找到');
    }

    // 模态框关闭按钮
    if (this.syncModal) {
      const closeButtons = this.syncModal.querySelectorAll('.close-modal');
      console.log('SyncUIManager: 关闭按钮数量', closeButtons.length);
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => this.closeSyncModal());
      });
    }

    // SQL模态框关闭按钮
    if (this.sqlModal) {
      const sqlCloseButtons = this.sqlModal.querySelectorAll('.close-modal');
      sqlCloseButtons.forEach(btn => {
        btn.addEventListener('click', () => this.closeSqlModal());
      });
    }

    // 配置表单事件
    this.bindConfigEvents();
    this.bindDataManagementEvents();
    this.bindSetupGuideEvents();

    console.log('SyncUIManager: 事件绑定完成');
  }

  /**
   * 绑定配置相关事件
   */
  bindConfigEvents() {
    // 测试连接
    const testBtn = document.getElementById('test-connection');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testConnection());
    }

    // 启用同步
    const enableBtn = document.getElementById('enable-sync');
    if (enableBtn) {
      enableBtn.addEventListener('click', () => this.enableSync());
    }

    // 禁用同步
    const disableBtn = document.getElementById('disable-sync');
    if (disableBtn) {
      disableBtn.addEventListener('click', () => this.disableSync());
    }

    // 配置输入框变化时更新按钮状态
    const configInputs = ['supabase-url', 'supabase-anon-key', 'user-id'];
    configInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.updateButtonStates());
      }
    });
  }

  /**
   * 绑定数据管理事件
   */
  bindDataManagementEvents() {
    // 手动同步
    const manualSyncBtn = document.getElementById('manual-sync');
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener('click', () => this.manualSync());
    }

    // 导出数据
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // 导入数据
    const importBtn = document.getElementById('import-data');
    const importFile = document.getElementById('import-file');

    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => this.importData(e));
    }
  }

  /**
   * 绑定设置指南事件
   */
  bindSetupGuideEvents() {
    // 显示SQL脚本
    const showSqlBtn = document.getElementById('show-sql');
    if (showSqlBtn) {
      showSqlBtn.addEventListener('click', () => this.showSqlScript());
    }

    // 复制SQL脚本
    const copySqlBtn = document.getElementById('copy-sql');
    if (copySqlBtn) {
      copySqlBtn.addEventListener('click', () => this.copySqlScript());
    }
  }

  /**
   * 打开同步模态框
   */
  openSyncModal() {
    console.log('SyncUIManager: 打开同步模态框');
    if (!this.syncModal) {
      console.error('SyncUIManager: 同步模态框元素不存在');
      return;
    }

    this.updateSyncStatus();
    this.loadSavedConfig();

    // 显示模态框并添加动画类
    this.syncModal.style.display = 'flex';
    // 强制重绘，然后添加show类
    this.syncModal.offsetHeight;
    this.syncModal.classList.add('show');
  }

  /**
   * 关闭同步模态框
   */
  closeSyncModal() {
    console.log('SyncUIManager: 关闭同步模态框');
    this.syncModal.classList.remove('show');
    setTimeout(() => {
      this.syncModal.style.display = 'none';
    }, 300); // 等待动画完成
  }

  /**
   * 关闭SQL模态框
   */
  closeSqlModal() {
    this.sqlModal.classList.remove('show');
    setTimeout(() => {
      this.sqlModal.style.display = 'none';
    }, 300);
  }

  /**
   * 更新同步状态显示
   */
  updateSyncStatus() {
    const status = syncManager.getSyncStatus();
    
    // 更新模式显示
    const modeElement = document.getElementById('current-mode');
    const modeText = {
      'chrome': 'Chrome Storage',
      'supabase': 'Supabase云端',
      'hybrid': '混合模式'
    };
    modeElement.textContent = modeText[status.storageMode] || 'Chrome Storage';

    // 更新Supabase状态
    const supabaseStatusElement = document.getElementById('supabase-status');
    supabaseStatusElement.textContent = status.isSupabaseEnabled ? '已连接' : '未连接';
    supabaseStatusElement.className = `status-value ${status.isSupabaseEnabled ? 'connected' : 'disconnected'}`;

    // 更新最后同步时间
    const lastSyncElement = document.getElementById('last-sync');
    if (status.lastSyncTime) {
      const syncTime = new Date(status.lastSyncTime);
      lastSyncElement.textContent = syncTime.toLocaleString();
    } else {
      lastSyncElement.textContent = '从未同步';
    }

    // 更新按钮状态
    this.updateButtonStates();
  }

  /**
   * 更新按钮状态
   */
  updateButtonStates() {
    const status = syncManager.getSyncStatus();

    const urlInput = document.getElementById('supabase-url');
    const keyInput = document.getElementById('supabase-anon-key');
    const userIdInput = document.getElementById('user-id');

    const url = urlInput ? urlInput.value : '';
    const key = keyInput ? keyInput.value : '';
    const userId = userIdInput ? userIdInput.value : '';

    const hasValidConfig = url && key && userId;

    // 根据同步状态设置输入框的只读状态
    if (urlInput) {
      urlInput.readOnly = status.isSupabaseEnabled;
      urlInput.style.backgroundColor = status.isSupabaseEnabled ? '#f8f9fa' : '';
      urlInput.style.cursor = status.isSupabaseEnabled ? 'not-allowed' : '';
    }
    if (keyInput) {
      keyInput.readOnly = status.isSupabaseEnabled;
      keyInput.style.backgroundColor = status.isSupabaseEnabled ? '#f8f9fa' : '';
      keyInput.style.cursor = status.isSupabaseEnabled ? 'not-allowed' : '';
    }
    if (userIdInput) {
      userIdInput.readOnly = status.isSupabaseEnabled;
      userIdInput.style.backgroundColor = status.isSupabaseEnabled ? '#f8f9fa' : '';
      userIdInput.style.cursor = status.isSupabaseEnabled ? 'not-allowed' : '';
    }

    // 测试连接按钮
    const testBtn = document.getElementById('test-connection');
    if (testBtn) {
      testBtn.disabled = !hasValidConfig || status.isSupabaseEnabled;
    }

    // 启用/禁用同步按钮
    const enableBtn = document.getElementById('enable-sync');
    const disableBtn = document.getElementById('disable-sync');

    if (enableBtn && disableBtn) {
      if (status.isSupabaseEnabled) {
        enableBtn.style.display = 'none';
        disableBtn.style.display = 'inline-block';
      } else {
        enableBtn.style.display = 'inline-block';
        enableBtn.disabled = !hasValidConfig;
        disableBtn.style.display = 'none';
      }
    }

    // 手动同步按钮
    const manualSyncBtn = document.getElementById('manual-sync');
    if (manualSyncBtn) {
      manualSyncBtn.disabled = !status.isSupabaseEnabled || status.syncInProgress;
    }
  }

  /**
   * 加载已保存的配置
   */
  async loadSavedConfig() {
    try {
      const config = await syncManager.getSupabaseConfig();
      if (config) {
        document.getElementById('supabase-url').value = config.url || '';
        document.getElementById('supabase-anon-key').value = config.anonKey || '';

        // 不要填充默认的用户标识，强制用户输入
        const userId = config.userId || '';
        if (userId && userId !== 'default') {
          document.getElementById('user-id').value = userId;
        } else {
          document.getElementById('user-id').value = '';
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }



  /**
   * 测试连接
   */
  async testConnection() {
    const testBtn = document.getElementById('test-connection');
    const originalText = testBtn.textContent;
    
    try {
      testBtn.textContent = '测试中...';
      testBtn.disabled = true;

      const config = this.getConfigFromForm();
      await supabaseClient.initialize(config);
      
      this.showMessage('连接测试成功！', 'success');
    } catch (error) {
      console.error('连接测试失败:', error);

      if (error.message.includes('数据表不存在')) {
        this.showMessage('连接成功，但数据表不存在。请点击"显示SQL脚本"创建数据表。', 'error');
      } else {
        this.showMessage(`连接测试失败: ${error.message}`, 'error');
      }
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  }

  /**
   * 启用同步
   */
  async enableSync() {
    const enableBtn = document.getElementById('enable-sync');
    const originalText = enableBtn.textContent;

    try {
      enableBtn.textContent = '启用中...';
      enableBtn.disabled = true;

      const config = this.getConfigFromForm();

      // 检查用户标识是否为默认值
      if (config.userId === 'default') {
        this.showMessage('请修改用户标识！不能使用默认值 "default"，建议使用您的邮箱或唯一标识符。', 'error');
        return;
      }

      // 检查用户标识是否为空
      if (!config.userId || config.userId.trim() === '') {
        this.showMessage('请输入用户标识！建议使用您的邮箱或唯一标识符。', 'error');
        return;
      }

      await syncManager.enableSupabaseSync(config);

      // 立即重新加载和渲染页面数据
      await this.refreshPageAfterEnableSync();

      this.updateSyncStatus();
      this.showMessage('云端同步已启用！', 'success');
    } catch (error) {
      console.error('启用同步失败:', error);

      // 检查是否是RLS相关错误
      if (error.code === '42501' || error.message.includes('row-level security')) {
        this.showMessage('启用同步失败：数据表的行级安全策略阻止了数据访问。请查看设置指南中的解决方案。', 'error');

        // 显示详细的修复指导
        setTimeout(() => {
          if (window.showNotification) {
            window.showNotification(`数据表权限问题修复方案：

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 执行以下命令：

ALTER TABLE card_tab_data DISABLE ROW LEVEL SECURITY;

这将禁用行级安全策略，允许数据访问。
详细说明请查看项目中的 SUPABASE_FIX_RLS.md 文件。`, 'warning', { duration: 10000 });
          }
        }, 100);
      } else {
        this.showMessage(`启用同步失败: ${error.message}`, 'error');
      }
    } finally {
      enableBtn.textContent = originalText;
      enableBtn.disabled = false;
    }
  }

  /**
   * 禁用同步
   */
  async disableSync() {
    if (!confirm('确定要禁用云端同步吗？云端数据将同步到本地。')) {
      return;
    }

    const disableBtn = document.getElementById('disable-sync');
    const originalText = disableBtn.textContent;

    try {
      disableBtn.textContent = '禁用中...';
      disableBtn.disabled = true;

      await syncManager.disableSupabaseSync();

      // 立即重新加载和渲染页面数据
      await this.refreshPageAfterDisableSync();

      this.updateSyncStatus();
      this.showMessage('云端同步已禁用，已切换到本地默认配置', 'success');
    } catch (error) {
      console.error('禁用同步失败:', error);
      this.showMessage(`禁用同步失败: ${error.message}`, 'error');
    } finally {
      disableBtn.textContent = originalText;
      disableBtn.disabled = false;
    }
  }

  /**
   * 禁用同步后刷新页面数据
   */
  async refreshPageAfterDisableSync() {
    try {
      console.log('SyncUI: 禁用同步后刷新页面数据');

      // 1. 重新初始化存储管理器（重新加载数据）
      if (typeof storageManager !== 'undefined') {
        await storageManager.init();
        console.log('SyncUI: 存储管理器已重新初始化');
      }

      // 2. 重新渲染分类数据
      if (typeof categoryManager !== 'undefined') {
        await categoryManager.renderCategories();
        console.log('SyncUI: 分类数据已重新渲染');
      }

      // 3. 重新应用主题设置
      if (typeof loadThemeSettings === 'function') {
        await loadThemeSettings();
        console.log('SyncUI: 主题设置已重新加载和应用');
      }

      // 4. 更新背景图片
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
        console.log('SyncUI: 背景图片UI已更新');
      }

      // 5. 更新配置切换显示
      if (typeof themeConfigUIManager !== 'undefined') {
        await themeConfigUIManager.updateConfigSwitchDisplay();
        console.log('SyncUI: 配置切换显示已更新');
      }

      console.log('SyncUI: 页面数据刷新完成');
    } catch (error) {
      console.error('SyncUI: 刷新页面数据失败:', error);
    }
  }

  /**
   * 启用同步后刷新页面数据
   */
  async refreshPageAfterEnableSync() {
    try {
      console.log('SyncUI: 启用同步后刷新页面数据');

      // 1. 重新初始化存储管理器（重新加载数据）
      if (typeof storageManager !== 'undefined') {
        await storageManager.init();
        console.log('SyncUI: 存储管理器已重新初始化');
      }

      // 2. 重新渲染分类数据
      if (typeof categoryManager !== 'undefined') {
        await categoryManager.renderCategories();
        console.log('SyncUI: 分类数据已重新渲染');
      }

      // 3. 重新应用主题设置
      if (typeof loadThemeSettings === 'function') {
        await loadThemeSettings();
        console.log('SyncUI: 主题设置已重新加载和应用');
      }

      // 4. 更新背景图片
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
        console.log('SyncUI: 背景图片UI已更新');
      }

      // 5. 更新配置切换显示
      if (typeof themeConfigUIManager !== 'undefined') {
        await themeConfigUIManager.updateConfigSwitchDisplay();
        console.log('SyncUI: 配置切换显示已更新');
      }

      console.log('SyncUI: 页面数据刷新完成');
    } catch (error) {
      console.error('SyncUI: 刷新页面数据失败:', error);
    }
  }

  /**
   * 手动同步
   */
  async manualSync() {
    const syncBtn = document.getElementById('manual-sync');
    const originalText = syncBtn.textContent;

    try {
      syncBtn.textContent = '同步中...';
      syncBtn.disabled = true;

      await syncManager.manualSync();
      
      this.updateSyncStatus();
      this.showMessage('手动同步完成！', 'success');

      // 使用统一的配置刷新入口
      if (typeof refreshCurrentConfiguration === 'function') {
        await refreshCurrentConfiguration();
      } else {
        // 降级：重新渲染界面
        await categoryManager.renderCategories();
      }
    } catch (error) {
      console.error('手动同步失败:', error);
      this.showMessage(`手动同步失败: ${error.message}`, 'error');
    } finally {
      syncBtn.textContent = originalText;
      syncBtn.disabled = false;
    }
  }

  /**
   * 从表单获取配置
   */
  getConfigFromForm() {
    return {
      url: document.getElementById('supabase-url').value.trim(),
      anonKey: document.getElementById('supabase-anon-key').value.trim(),
      userId: document.getElementById('user-id').value.trim()
    };
  }

  /**
   * 显示消息
   */
  showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `sync-message ${type}`;
    messageEl.textContent = message;

    // 添加到模态框
    const modalBody = this.syncModal.querySelector('.modal-body');
    modalBody.insertBefore(messageEl, modalBody.firstChild);

    // 3秒后自动移除
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }

  /**
   * 导出数据
   */
  async exportData() {
    try {
      const data = await syncManager.loadData();
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `card-tab-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showMessage('数据导出成功！', 'success');
    } catch (error) {
      console.error('导出数据失败:', error);
      this.showMessage(`导出数据失败: ${error.message}`, 'error');
    }
  }

  /**
   * 导入数据
   */
  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!confirm('确定要导入数据吗？这将覆盖当前所有数据。')) {
        return;
      }

      // 保存数据
      await syncManager.saveData(data, true);

      // 刷新所有相关UI
      await this.refreshAllUIAfterDataImport();

      this.showMessage('数据导入成功！', 'success');

    } catch (error) {
      console.error('导入数据失败:', error);
      this.showMessage(`导入数据失败: ${error.message}`, 'error');
    } finally {
      // 清空文件输入，允许重复选择同一文件
      event.target.value = '';
    }
  }



  /**
   * 刷新配置相关UI
   */
  async refreshConfigurationUI() {
    try {
      // 1. 刷新配置数据
      await window.unifiedDataManager.loadCurrentConfigData();

      // 2. 使用专门的配置导入处理方法
      if (typeof themeConfigUIManager !== 'undefined' && themeConfigUIManager.handleConfigurationImported) {
        await themeConfigUIManager.handleConfigurationImported();
      } else if (typeof themeConfigUIManager !== 'undefined') {
        // 降级方案：使用原有方法
        await themeConfigUIManager.updateConfigSwitchDisplay();
        await themeConfigUIManager.updateConfigSelector();

        if (themeConfigUIManager.loadConfigList) {
          await themeConfigUIManager.loadConfigList();
        }
      }

      // 3. 更新同步状态显示
      this.updateSyncStatus();
    } catch (error) {
      console.error('SyncUI: 刷新配置UI失败:', error);
    }
  }

  /**
   * 数据导入后刷新所有UI
   */
  async refreshAllUIAfterDataImport() {
    try {
      // 1. 重新初始化存储管理器（重新加载数据）
      if (typeof storageManager !== 'undefined') {
        await storageManager.init();
      }

      // 2. 重新渲染分类数据
      if (typeof categoryManager !== 'undefined') {
        await categoryManager.renderCategories();
      }

      // 3. 重新应用主题设置
      if (typeof loadThemeSettings === 'function') {
        await loadThemeSettings();
      }

      // 4. 刷新配置相关UI（重要：导入的数据可能包含新的配置信息）
      await this.refreshConfigurationUIAfterDataImport();

      // 5. 更新背景图片
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
      }
    } catch (error) {
      console.error('SyncUI: 数据导入后刷新UI失败:', error);
    }
  }

  /**
   * 数据导入后刷新配置相关UI
   */
  async refreshConfigurationUIAfterDataImport() {
    try {
      // 1. 重新加载配置数据
      await window.unifiedDataManager.loadCurrentConfigData();

      // 2. 刷新配置UI管理器
      if (typeof themeConfigUIManager !== 'undefined') {
        // 更新配置切换显示
        await themeConfigUIManager.updateConfigSwitchDisplay();

        // 更新配置选择器
        await themeConfigUIManager.updateConfigSelector();

        // 如果配置管理界面是打开的，强制刷新配置列表
        if (themeConfigUIManager.forceRefreshConfigList) {
          await themeConfigUIManager.forceRefreshConfigList();
        }
      }

      // 3. 更新同步状态显示
      this.updateSyncStatus();
    } catch (error) {
      console.error('SyncUI: 数据导入后刷新配置UI失败:', error);
    }
  }

  /**
   * 刷新所有UI（通用方法）
   */
  async refreshAllUI() {
    try {
      // 1. 重新初始化存储管理器
      if (typeof storageManager !== 'undefined') {
        await storageManager.init();
      }

      // 2. 重新渲染分类数据
      if (typeof categoryManager !== 'undefined') {
        await categoryManager.renderCategories();
      }

      // 3. 重新应用主题设置
      if (typeof loadThemeSettings === 'function') {
        await loadThemeSettings();
      }

      // 4. 刷新配置相关UI
      await this.refreshConfigurationUI();

      // 5. 更新背景图片
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
      }
    } catch (error) {
      console.error('SyncUI: 刷新所有UI失败:', error);
    }
  }

  /**
   * 显示SQL脚本
   */
  showSqlScript() {
    if (!this.sqlModal) {
      console.error('SyncUIManager: SQL模态框元素不存在');
      return;
    }

    const sqlContent = document.getElementById('sql-content');
    if (sqlContent) {
      sqlContent.textContent = supabaseClient.getTableCreationSQL();
    }

    this.sqlModal.style.display = 'flex';
    this.sqlModal.offsetHeight;
    this.sqlModal.classList.add('show');
  }

  /**
   * 复制SQL脚本
   */
  async copySqlScript() {
    const sqlContent = document.getElementById('sql-content');
    try {
      await navigator.clipboard.writeText(sqlContent.textContent);
      this.showMessage('SQL脚本已复制到剪贴板！', 'success');
    } catch (error) {
      console.error('复制失败:', error);
      this.showMessage('复制失败，请手动复制', 'error');
    }
  }


}

// 创建全局实例
const syncUIManager = new SyncUIManager();
window.syncUIManager = syncUIManager;
