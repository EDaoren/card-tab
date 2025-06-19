/**
 * 同步界面管理器
 * 处理Supabase同步相关的UI交互
 */

class SyncUIManager {
  constructor() {
    this.syncModal = null;
    this.sqlModal = null;
    this.isInitialized = false;
  }

  /**
   * 初始化同步界面
   */
  init() {
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

    // 测试连接按钮
    const testBtn = document.getElementById('test-connection');
    if (testBtn) {
      testBtn.disabled = !hasValidConfig;
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
        document.getElementById('user-id').value = config.userId || '';
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
      await syncManager.enableSupabaseSync(config);
      
      this.updateSyncStatus();
      this.showMessage('云端同步已启用！', 'success');
    } catch (error) {
      console.error('启用同步失败:', error);

      // 检查是否是RLS相关错误
      if (error.code === '42501' || error.message.includes('row-level security')) {
        this.showMessage('启用同步失败：数据表的行级安全策略阻止了数据访问。请查看设置指南中的解决方案。', 'error');

        // 显示详细的修复指导
        setTimeout(() => {
          alert(`数据表权限问题修复方案：

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 执行以下命令：

ALTER TABLE quick_nav_data DISABLE ROW LEVEL SECURITY;

这将禁用行级安全策略，允许数据访问。
详细说明请查看项目中的 SUPABASE_FIX_RLS.md 文件。`);
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
      
      this.updateSyncStatus();
      this.showMessage('云端同步已禁用，数据已同步到本地', 'success');
    } catch (error) {
      console.error('禁用同步失败:', error);
      this.showMessage(`禁用同步失败: ${error.message}`, 'error');
    } finally {
      disableBtn.textContent = originalText;
      disableBtn.disabled = false;
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
      
      // 重新渲染界面
      await categoryManager.renderCategories();
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
      a.download = `quick-nav-data-${new Date().toISOString().split('T')[0]}.json`;
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

      await syncManager.saveData(data, true);
      await categoryManager.renderCategories();
      
      this.showMessage('数据导入成功！', 'success');
    } catch (error) {
      console.error('导入数据失败:', error);
      this.showMessage(`导入数据失败: ${error.message}`, 'error');
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
