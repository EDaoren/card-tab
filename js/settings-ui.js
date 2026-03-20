/**
 * Settings UI Controller
 * 负责管理设置页面的交互：侧边栏导航、外观主题管理、云端同步配置、数据导入导出
 */

class SettingsUIManager {
  constructor() {
    this.currentPanel = 'panel-appearance';
    this.editingThemeId = null;
    
    // 背景图片缓存
    this.tempBgImageFile = null;
  }

  async init() {
    this.bindSidebarNav();
    this.bindAppearanceEvents();
    this.bindSyncEvents();
    this.bindDataEvents();
    
    // 返回主页按钮
    document.getElementById('back-to-home-btn')?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    
    // 初始化面板数据
    this.refreshThemesList();
    this.refreshSyncUI();
    await this.refreshCloudflareSetupUI();
    // 应用当前主题的 CSS 以保持视觉统一 (已在 settings.html 中触发 initThemeSettings)
  }

  /* ---------------------- 侧边导航栏 ---------------------- */
  bindSidebarNav() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const panels = document.querySelectorAll('.settings-panel');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        
        // Update active classes
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        panels.forEach(p => p.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        
        this.currentPanel = targetId;
      });
    });
  }

  /* ---------------------- 外观主题管理 ---------------------- */
  bindAppearanceEvents() {
    // 新建主题按钮
    document.getElementById('create-theme-btn').addEventListener('click', () => {
      this.openThemeForm();
    });
    
    // 颜色选择器
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
        e.target.classList.add('selected');
        
        // 预览主题颜色
        const type = e.target.getAttribute('data-type');
        window.applyThemeClass(type);
      });
    });
    
    // 背景图片上传体验
    const bgInput = document.getElementById('bg-image-upload');
    const bgPreviewArea = document.getElementById('bg-preview-area');
    const uploadBtn = document.getElementById('upload-bg-btn');
    const removeBgBtn = document.getElementById('remove-bg-btn');
    const opacitySlider = document.getElementById('bg-opacity-slider');
    const opacityValue = document.getElementById('bg-opacity-value');
    
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => bgInput.click());
    }

    if (bgPreviewArea && bgInput) {
      bgPreviewArea.addEventListener('click', () => bgInput.click());
      bgPreviewArea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          bgInput.click();
        }
      });
    }
    
    if (bgInput) {
      bgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 50 * 1024 * 1024) {
          alert('图片过大，不能超过 50MB');
          e.target.value = ''; return;
        }
        
        this.tempBgImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => this.showPreviewBg(e.target.result);
        reader.readAsDataURL(file);
      });
    }
    
    if (removeBgBtn) {
      removeBgBtn.addEventListener('click', () => {
        this.tempBgImageFile = null;
        this.showPreviewBg(null);
        if (bgInput) bgInput.value = '';
      });
    }
    
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        opacityValue.textContent = `${val}%`;
        // if interacting with preview, apply style dynamically
        const img = document.getElementById('bg-preview-img');
        if (img.src && img.src !== window.location.href) {
          window.applyBackgroundImageToDOM(img.src, val);
        }
      });
    }
    
    // 表单保存与取消
    document.getElementById('save-theme-btn').addEventListener('click', () => this.saveThemeForm());
    document.getElementById('cancel-theme-btn').addEventListener('click', () => {
      this.closeThemeForm();
      // 恢复本来主题外观
      window.loadThemeSettings();
    });
  }
  
  refreshThemesList() {
    const container = document.getElementById('themes-list');
    if (!container) return;
    
    const themes = window.unifiedDataManager.getAllThemes();
    const currentThemeId = window.unifiedDataManager.appData.currentThemeId;
    
    container.innerHTML = '';
    
    // 排序：当前激活的在最前，之后按更新时间倒序
    themes.sort((a, b) => {
      if (a.themeId === currentThemeId) return -1;
      if (b.themeId === currentThemeId) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    
    themes.forEach(theme => {
      const isCurrent = theme.themeId === currentThemeId;
      const typeLabel = theme.type === 'chrome' ? '本地' : 
                        theme.type === 'cloudflare' ? 'CF 云端' : 'Supabase';

      const previewColorMap = {
        default: '#f5f5f5',
        dark: '#35363a',
        blue: '#e8f0fe',
        green: '#e6f4ea',
        purple: '#f3e8fd',
        pink: '#fce4ec'
      };
      const previewBackgroundColor = previewColorMap[theme.themeType] || previewColorMap.default;
      const bgStyle = theme.bgImageUrl
        ? `background-image: url(${theme.bgImageUrl}); background-color: ${previewBackgroundColor};`
        : `background-color: ${previewBackgroundColor};`;
      
      const card = document.createElement('div');
      card.className = `theme-card ${isCurrent ? 'active-theme' : ''}`;
      card.innerHTML = `
        <div class="theme-card-header">
          <div>
            <h4 class="theme-name">${theme.themeName || '未命名'}</h4>
            <div class="theme-meta">
              <span>${typeLabel}</span> • <span>${theme.themeType === 'default' ? '浅色' : theme.themeType}</span>
            </div>
          </div>
          ${isCurrent ? '<span class="material-symbols-rounded" style="color:var(--primary-color)">check_circle</span>' : ''}
        </div>
        <div class="theme-preview-block" style="${bgStyle}"></div>
        <div class="theme-actions">
           ${!isCurrent ? `<button class="primary-btn use-theme-btn" data-id="${theme.themeId}">使用</button>` : ''}
           <button class="secondary-btn edit-theme-btn" data-id="${theme.themeId}">编辑</button>
           ${(!isCurrent && theme.themeId !== 'default') ? `<button class="secondary-btn text-danger delete-theme-btn" data-id="${theme.themeId}">删除</button>` : ''}
        </div>
      `;
      container.appendChild(card);
    });
    
    // 绑定卡片内按钮事件
    container.querySelectorAll('.use-theme-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        this.showMessage('正在切换工作空间...', 'info');
        try {
          await window.unifiedDataManager.switchTheme(id);
          await window.syncManager.init();
          this.refreshThemesList();
          this.refreshSyncUI();
          window.loadThemeSettings(); // 更新外层页面的背景/CSS
          this.showMessage('已切换工作空间', 'success');
        } catch (err) {
          this.showMessage('切换失败: ' + err.message, 'error');
        }
      });
    });
    
    container.querySelectorAll('.edit-theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.openThemeForm(e.target.getAttribute('data-id'));
      });
    });
    
    container.querySelectorAll('.delete-theme-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('确定要删除此工作空间吗？此操作不可恢复。')) {
          try {
            await window.unifiedDataManager.deleteTheme(id);
            this.refreshThemesList();
            this.showMessage('主题已删除', 'success');
          } catch(err) {
            this.showMessage('删除失败: ' + err.message, 'error');
          }
        }
      });
    });
  }
  
  openThemeForm(themeId = null) {
    this.editingThemeId = themeId;
    const form = document.getElementById('theme-edit-form');
    document.getElementById('themes-list').style.display = 'none';
    form.style.display = 'block';
    
    // Reset form
    document.getElementById('theme-name-input').value = '';
    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
    document.querySelector('.color-option[data-type="default"]').classList.add('selected');
    this.tempBgImageFile = null;
    this.showPreviewBg(null);
    document.getElementById('bg-opacity-slider').value = 30;
    document.getElementById('bg-opacity-value').textContent = '30%';
    
    // Populate if editing
    if (themeId) {
      const theme = window.unifiedDataManager.appData.themes[themeId];
      if (theme) {
        document.getElementById('theme-name-input').value = theme.themeName;
        document.querySelector(`.color-option[data-type="${theme.themeType || 'default'}"]`)?.classList.add('selected');
        
        if (theme.bgImageUrl) {
          this.showPreviewBg(theme.bgImageUrl);
        }
        if (theme.bgOpacity !== undefined) {
          document.getElementById('bg-opacity-slider').value = theme.bgOpacity;
          document.getElementById('bg-opacity-value').textContent = `${theme.bgOpacity}%`;
        }
        
        // 云端功能判定
        document.getElementById('bg-setting-group').style.display = 
          (theme.type === 'supabase' || theme.type === 'cloudflare') ? 'block' : 'none';
      }
    } else {
      // Create new: we hide BG upload initially if they haven't picked a provider.
      // But let's assume newly created themes are "chrome" (local) first, unless they are inside sync UI.
      // Actually, since this is a global create button, we default to local chrome theme.
      document.getElementById('bg-setting-group').style.display = 'none';
    }
  }
  
  closeThemeForm() {
    document.getElementById('theme-edit-form').style.display = 'none';
    document.getElementById('themes-list').style.display = 'grid';
    this.editingThemeId = null;
  }
  
  showPreviewBg(urlOrData) {
    const img = document.getElementById('bg-preview-img');
    const ph = document.getElementById('bg-placeholder');
    if (urlOrData) {
      img.src = urlOrData;
      img.style.display = 'block';
      ph.style.display = 'none';
      // sync preview with DOM
      window.applyBackgroundImageToDOM(urlOrData, document.getElementById('bg-opacity-slider').value);
    } else {
      img.src = '';
      img.style.display = 'none';
      ph.style.display = 'block';
      window.applyBackgroundImageToDOM(null, 30);
    }
  }
  
  async saveThemeForm() {
    const name = document.getElementById('theme-name-input').value.trim() || '未命名主题';
    const typeOpt = document.querySelector('.color-option.selected');
    const themeType = typeOpt ? typeOpt.getAttribute('data-type') : 'default';
    const opacity = parseInt(document.getElementById('bg-opacity-slider').value) || 30;
    const previewImage = document.getElementById('bg-preview-img');
    const hasPreviewImage = !!previewImage.getAttribute('src');
    
    try {
      if (this.editingThemeId) {
        const theme = window.unifiedDataManager.appData.themes[this.editingThemeId];
        const themeUpdates = {
          themeName: name,
          themeType: themeType,
          bgOpacity: opacity
        };

        if (theme.type !== 'chrome') {
          await window.unifiedDataManager.initCloudClients();
        }
        
        if (this.tempBgImageFile && theme.type === 'cloudflare') {
          if (!window.unifiedDataManager.cloudflareClient) {
            throw new Error('Cloudflare 同步当前未启用，无法上传背景图片');
          }
          const res = await window.unifiedDataManager.cloudflareClient.uploadFile(this.tempBgImageFile, this.editingThemeId);
          themeUpdates.bgImageUrl = res.url;
          themeUpdates.bgImagePath = res.path;
        } else if (this.tempBgImageFile && theme.type === 'supabase') {
          if (!window.unifiedDataManager.supabaseClient) {
            throw new Error('Supabase 同步当前未启用，无法上传背景图片');
          }
          const res = await window.unifiedDataManager.supabaseClient.uploadFile(this.tempBgImageFile, 'backgrounds', this.editingThemeId);
          themeUpdates.bgImageUrl = res.url;
          themeUpdates.bgImagePath = res.path;
        } else if (!this.tempBgImageFile && !hasPreviewImage) {
          if (theme.bgImagePath) {
            if (theme.type === 'cloudflare' && window.unifiedDataManager.cloudflareClient) window.unifiedDataManager.cloudflareClient.deleteFile('backgrounds', theme.bgImagePath, this.editingThemeId).catch(console.warn);
            if (theme.type === 'supabase' && window.unifiedDataManager.supabaseClient) window.unifiedDataManager.supabaseClient.deleteFile('backgrounds', theme.bgImagePath).catch(console.warn);
          }
          themeUpdates.bgImageUrl = null;
          themeUpdates.bgImagePath = null;
        }

        await window.unifiedDataManager.updateThemeMetadata(this.editingThemeId, themeUpdates);
      } else {
        await window.unifiedDataManager.createLocalTheme(name, themeType, opacity);
      }
      
      this.showMessage('主题已保存', 'success');
      this.closeThemeForm();
      this.refreshThemesList();
      
      // Update UI if we edited current theme
      if (this.editingThemeId === window.unifiedDataManager.appData.currentThemeId) {
         window.loadThemeSettings();
      }
      
    } catch (err) {
      console.error(err);
      this.showMessage('保存失败: ' + err.message, 'error');
    }
  }

  getDefaultSyncThemeName(provider, suggestedName = '') {
    if (suggestedName) {
      return suggestedName;
    }

    const currentTheme = window.unifiedDataManager?.getCurrentTheme?.();
    if (currentTheme?.themeName) {
      return currentTheme.themeName;
    }

    return provider === 'cloudflare' ? 'Cloudflare 工作区' : 'Supabase 工作区';
  }

  async copyBundledFileText(path, successMessage) {
    const resourceUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : path;
    const response = await fetch(resourceUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`读取文件失败：${path}`);
    }

    const text = await response.text();
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    this.showMessage(successMessage, 'success');
  }

  async completeCloudflareSyncSetup(config, suggestedThemeName = '') {
    const themeName = this.getDefaultSyncThemeName('cloudflare', suggestedThemeName);

    if (window.cloudflareSetupManager?.saveExistingResourceProfile) {
      await window.cloudflareSetupManager.saveExistingResourceProfile({
        source: config.source || 'sync',
        accountId: config.accountId || '',
        baseName: config.baseName || '',
        workerName: config.workerName || document.getElementById('cf-worker-name')?.value.trim() || '',
        workerUrl: config.workerUrl,
        accessToken: config.accessToken || '',
        databaseId: config.databaseId || document.getElementById('cf-database-id')?.value.trim() || '',
        databaseName: config.databaseName || document.getElementById('cf-database-name')?.value.trim() || '',
        bucketName: config.bucketName || document.getElementById('cf-bucket-name')?.value.trim() || '',
        initialized: typeof config.initialized === 'boolean' ? config.initialized : undefined
      });
    }

    await window.syncManager.enableCloudflareSync({
      workerUrl: config.workerUrl,
      accessToken: config.accessToken || ''
    }, config.themeId, themeName);

    document.getElementById('cf-worker-url').value = config.workerUrl || '';
    document.getElementById('cf-access-token').value = config.accessToken || '';

    this.refreshSyncUI();
    await this.refreshCloudflareSetupUI();
    this.refreshThemesList();
    window.loadThemeSettings();
  }

  async completeSupabaseSyncSetup(config, suggestedThemeName = '') {
    const themeName = this.getDefaultSyncThemeName('supabase', suggestedThemeName);

    await window.syncManager.enableSupabaseSync({
      url: config.url,
      anonKey: config.anonKey
    }, config.themeId, themeName);

    document.getElementById('sb-url').value = config.url || '';
    document.getElementById('sb-key').value = config.anonKey || '';

    this.refreshSyncUI();
    this.refreshThemesList();
    window.loadThemeSettings();
  }

  getCloudflareResourceFormData() {
    return {
      accountId: document.getElementById('cf-account-id')?.value.trim() || '',
      apiToken: document.getElementById('cf-api-token')?.value.trim() || '',
      createWorkerName: document.getElementById('cf-create-worker-name')?.value.trim() || '',
      createDatabaseName: document.getElementById('cf-create-database-name')?.value.trim() || '',
      createBucketName: document.getElementById('cf-create-bucket-name')?.value.trim() || '',
      workerAccessToken: document.getElementById('cf-worker-access-token')?.value.trim() || '',
      saveApiToken: !!document.getElementById('cf-save-api-token')?.checked,
      workerUrl: document.getElementById('cf-worker-url')?.value.trim() || '',
      accessToken: document.getElementById('cf-access-token')?.value.trim() || '',
      workerName: document.getElementById('cf-worker-name')?.value.trim() || '',
      databaseId: document.getElementById('cf-database-id')?.value.trim() || '',
      databaseName: document.getElementById('cf-database-name')?.value.trim() || '',
      bucketName: document.getElementById('cf-bucket-name')?.value.trim() || ''
    };
  }

  getDefaultCloudflareResourceNames() {
    return window.cloudflareSetupManager?.getDefaultResourceNames?.() || {
      workerName: 'card-tab-sync',
      databaseName: 'card-tab-db',
      bucketName: 'card-tab-files'
    };
  }

  getCloudflareResourceMode() {
    return document.querySelector('input[name="cf-resource-mode"]:checked')?.value || 'create';
  }

  updateCloudflareSetupStatus(state, text) {
    const badge = document.getElementById('cf-setup-badge');
    const statusText = document.getElementById('cf-setup-status-text');
    if (!badge || !statusText) {
      return;
    }

    badge.classList.remove('is-ready', 'is-error', 'is-idle', 'is-pending');

    if (state === 'ready') {
      badge.textContent = '已初始化';
      badge.classList.add('is-ready');
    } else if (state === 'pending') {
      badge.textContent = '待初始化';
      badge.classList.add('is-pending');
    } else if (state === 'error') {
      badge.textContent = '异常';
      badge.classList.add('is-error');
    } else {
      badge.textContent = '未创建';
      badge.classList.add('is-idle');
    }

    statusText.textContent = text;
  }

  async toggleCloudflareAutoSetup(enabled) {
    const createModeRadio = document.getElementById('cf-resource-mode-create');
    const existingModeRadio = document.getElementById('cf-resource-mode-existing');
    const section = document.getElementById('cf-auto-setup-section');

    if (createModeRadio && existingModeRadio) {
      createModeRadio.checked = enabled;
      existingModeRadio.checked = !enabled;
    }

    if (section) {
      section.style.display = enabled ? 'block' : 'none';
    }

    if (window.cloudflareSetupManager) {
      await window.cloudflareSetupManager.savePreferences({ autoSetupEnabled: enabled });
    }
  }

  async saveExistingCloudflareResourceProfile(showMessage = false, overrides = {}) {
    if (!window.cloudflareSetupManager) {
      throw new Error('Cloudflare 初始化管理器未加载');
    }

    const formData = this.getCloudflareResourceFormData();
    const mode = this.getCloudflareResourceMode();
    const profile = await window.cloudflareSetupManager.saveExistingResourceProfile({
      ...formData,
      ...(overrides.source ? {} : (mode === 'existing' ? { source: 'manual' } : {})),
      ...overrides
    });

    if (showMessage) {
      this.showMessage('Cloudflare 连接参数已保存到本地缓存', 'success');
    }

    await this.refreshCloudflareSetupUI();
    return profile;
  }

  async refreshCloudflareSetupUI() {
    if (!window.cloudflareSetupManager) {
      return;
    }

    const syncStatus = window.syncManager?.getSyncStatus ? window.syncManager.getSyncStatus() : null;
    const { profile, preferences, savedApiToken } = await window.cloudflareSetupManager.getSetupState();
    const defaultNames = this.getDefaultCloudflareResourceNames();
    const autoSetupEnabled = preferences.autoSetupEnabled !== false;

    const createModeRadio = document.getElementById('cf-resource-mode-create');
    const existingModeRadio = document.getElementById('cf-resource-mode-existing');
    if (createModeRadio && existingModeRadio) {
      createModeRadio.checked = autoSetupEnabled;
      existingModeRadio.checked = !autoSetupEnabled;
    }

    const section = document.getElementById('cf-auto-setup-section');
    if (section) {
      section.style.display = autoSetupEnabled ? 'block' : 'none';
    }

    const accountIdInput = document.getElementById('cf-account-id');
    const apiTokenInput = document.getElementById('cf-api-token');
    const createWorkerNameInput = document.getElementById('cf-create-worker-name');
    const createDatabaseNameInput = document.getElementById('cf-create-database-name');
    const createBucketNameInput = document.getElementById('cf-create-bucket-name');
    const workerAccessTokenInput = document.getElementById('cf-worker-access-token');
    const saveApiTokenCheckbox = document.getElementById('cf-save-api-token');

    if (accountIdInput) {
      accountIdInput.value = profile?.accountId || '';
    }
    if (apiTokenInput) {
      apiTokenInput.value = savedApiToken || '';
    }
    if (createWorkerNameInput) {
      createWorkerNameInput.value = profile?.workerName || defaultNames.workerName;
    }
    if (createDatabaseNameInput) {
      createDatabaseNameInput.value = profile?.databaseName || defaultNames.databaseName;
    }
    if (createBucketNameInput) {
      createBucketNameInput.value = profile?.bucketName || defaultNames.bucketName;
    }
    if (workerAccessTokenInput) {
      workerAccessTokenInput.value = profile?.accessToken || '';
    }
    if (saveApiTokenCheckbox) {
      saveApiTokenCheckbox.checked = !!preferences.saveApiToken;
    }

    document.getElementById('cf-worker-url').value = profile?.workerUrl || syncStatus?.cloudflareConfig?.workerUrl || '';
    document.getElementById('cf-access-token').value = profile?.accessToken || syncStatus?.cloudflareConfig?.accessToken || '';
    document.getElementById('cf-worker-name').value = profile?.workerName || '';
    document.getElementById('cf-database-id').value = profile?.databaseId || '';
    document.getElementById('cf-database-name').value = profile?.databaseName || '';
    document.getElementById('cf-bucket-name').value = profile?.bucketName || '';

    if (!profile?.workerUrl) {
      this.updateCloudflareSetupStatus(
        'idle',
        autoSetupEnabled
          ? '还没有创建 Cloudflare 资源。确认名称后点击“创建资源”，结果会自动回填到下方连接参数。'
          : '已切换为“已有资源”模式，请直接在下方填写 Worker API URL、D1 与 R2 参数。'
      );
      return;
    }

    if (profile.initialized) {
      const initializedAt = profile.lastInitializedAt ? `，最近初始化：${new Date(profile.lastInitializedAt).toLocaleString('zh-CN')}` : '';
      this.updateCloudflareSetupStatus('ready', `资源已准备就绪，可直接连接或同步${initializedAt}`);
      return;
    }

    this.updateCloudflareSetupStatus(
      'pending',
      profile.source === 'auto'
        ? '资源已创建，但还未初始化数据。请点击“初始化数据”完成建表。'
        : '连接参数已保存，可先测试连接，按需初始化数据后再启用同步。'
    );
  }

  /* ---------------------- 云端同步面板 ---------------------- */
  bindSyncEvents() {
    // 选项卡切换
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tab.getAttribute('data-tab')}-panel`).classList.add('active');
      });
    });

    document.querySelectorAll('input[name="cf-resource-mode"]').forEach((radio) => {
      radio.addEventListener('change', async (event) => {
        if (event.target.checked) {
          await this.toggleCloudflareAutoSetup(event.target.value === 'create');
        }
      });
    });

    document.getElementById('cf-create-resources-btn')?.addEventListener('click', async () => {
      const button = document.getElementById('cf-create-resources-btn');
      const defaultText = button.textContent;
      button.disabled = true;
      button.textContent = '创建中...';

      try {
        const formData = this.getCloudflareResourceFormData();
        const profile = await window.cloudflareSetupManager.createResources(formData);
        await this.refreshCloudflareSetupUI();
        this.showMessage(`Cloudflare 资源创建成功：${profile.workerName}`, 'success');
      } catch (error) {
        this.updateCloudflareSetupStatus('error', `创建失败：${error.message}`);
        this.showMessage('创建失败: ' + error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = defaultText;
      }
    });

    document.getElementById('cf-initialize-setup-btn')?.addEventListener('click', async () => {
      const button = document.getElementById('cf-initialize-setup-btn');
      const defaultText = button.textContent;
      button.disabled = true;
      button.textContent = '初始化中...';

      try {
        const profile = await this.saveExistingCloudflareResourceProfile(false);
        const result = await window.cloudflareSetupManager.initializeDatabase(profile);
        await this.refreshCloudflareSetupUI();
        this.showMessage('初始化成功: ' + (result.result?.results?.join('；') || '数据表已就绪'), 'success');
      } catch (error) {
        this.updateCloudflareSetupStatus('error', `初始化失败：${error.message}`);
        this.showMessage('初始化失败: ' + error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = defaultText;
      }
    });

    document.getElementById('cf-restore-setup-btn')?.addEventListener('click', async () => {
      await this.refreshCloudflareSetupUI();
      this.showMessage('已从本地缓存恢复 Cloudflare 资源信息', 'success');
    });

    document.getElementById('cf-clear-setup-cache-btn')?.addEventListener('click', async () => {
      if (!confirm('确定要清空本地缓存的 Cloudflare 资源信息吗？这不会删除你在 Cloudflare 上已经创建的资源。')) {
        return;
      }

      try {
        await window.cloudflareSetupManager.clearSetupCache({ clearApiToken: true });
        await this.refreshCloudflareSetupUI();
        this.showMessage('Cloudflare 本地缓存已清空', 'success');
      } catch (error) {
        this.showMessage('清空失败: ' + error.message, 'error');
      }
    });

    document.getElementById('cf-save-existing-btn')?.addEventListener('click', async () => {
      try {
        await this.saveExistingCloudflareResourceProfile(true);
      } catch (error) {
        this.showMessage('保存失败: ' + error.message, 'error');
      }
    });

    document.getElementById('cf-copy-worker-btn').addEventListener('click', async () => {
      try {
        await this.copyBundledFileText('cf-worker.js', 'Worker 模板已复制到剪贴板');
      } catch (error) {
        this.showMessage('复制失败: ' + error.message, 'error');
      }
    });

    document.getElementById('cf-copy-init-sql-btn').addEventListener('click', async () => {
      try {
        await this.copyBundledFileText('cf-d1-init.sql', 'D1 初始化 SQL 已复制到剪贴板');
      } catch (error) {
        this.showMessage('复制失败: ' + error.message, 'error');
      }
    });

    document.getElementById('sb-copy-init-sql-btn').addEventListener('click', async () => {
      try {
        await this.copyBundledFileText('supabase-init.sql', 'Supabase 初始化 SQL 已复制到剪贴板');
      } catch (error) {
        this.showMessage('复制失败: ' + error.message, 'error');
      }
    });

    // Cloudflare Actions
    document.getElementById('cf-test-btn').addEventListener('click', async () => {
      const url = document.getElementById('cf-worker-url').value.trim();
      const token = document.getElementById('cf-access-token').value.trim();
      if (!url) { return this.showMessage('请填写 URL', 'error'); }
      
      try {
        await window.cloudflareSetupManager.testWorkerConnection({ workerUrl: url, accessToken: token });
        this.showMessage('测试连接成功！', 'success');
      } catch (err) {
        this.showMessage('连接失败: ' + err.message, 'error');
      }
    });
    
    document.getElementById('cf-init-db-btn').addEventListener('click', async () => {
      const url = document.getElementById('cf-worker-url').value.trim();
      if (!url) { return this.showMessage('请填写 URL', 'error'); }
      
      try {
        const profile = await this.saveExistingCloudflareResourceProfile(false);
        const result = await window.cloudflareSetupManager.initializeDatabase(profile);
        await this.refreshCloudflareSetupUI();
        this.showMessage('数据库初始化成功！\n' + ((result.result?.results || []).join('\n') || '数据表已就绪'), 'success');
      } catch (err) {
        this.updateCloudflareSetupStatus('error', `初始化失败：${err.message}`);
        this.showMessage('初始化失败: ' + err.message, 'error');
      }
    });

    document.getElementById('cf-enable-btn').addEventListener('click', async () => {
      const url = document.getElementById('cf-worker-url').value.trim();
      const token = document.getElementById('cf-access-token').value.trim();
      if (!url) { return this.showMessage('请填写 URL', 'error'); }

      try {
        const profile = await this.saveExistingCloudflareResourceProfile(false);
        if (profile.source === 'auto' && !profile.initialized) {
          throw new Error('资源已创建，但还未初始化数据，请先点击“初始化数据”');
        }
        await this.completeCloudflareSyncSetup({
          workerUrl: url,
          accessToken: token,
          workerName: profile.workerName,
          databaseId: profile.databaseId,
          databaseName: profile.databaseName,
          bucketName: profile.bucketName,
          initialized: profile.initialized,
          source: profile.source,
          accountId: profile.accountId,
          baseName: profile.baseName
        });
        this.showMessage('Cloudflare 同步已启用！', 'success');
      } catch (err) {
        this.showMessage('启用失败: ' + err.message, 'error');
      }
    });
    
    document.getElementById('cf-disable-btn').addEventListener('click', this.disableSyncHandler.bind(this));

    // Supabase actions
    document.getElementById('sb-test-btn').addEventListener('click', async () => {
      const url = document.getElementById('sb-url').value;
      const key = document.getElementById('sb-key').value;
      if (!url || !key) { return this.showMessage('请填写完整信息', 'error'); }
      try {
         const tempClient = new SupabaseClient();
         await tempClient.initialize({ url, anonKey: key, userId: '1' });
         await tempClient.testConnection();
         this.showMessage('测试连接成功！', 'success');
      } catch (err) {
         this.showMessage('测试失败: ' + err.message, 'error');
      }
    });

    document.getElementById('sb-enable-btn').addEventListener('click', async () => {
      const url = document.getElementById('sb-url').value;
      const key = document.getElementById('sb-key').value;
      if (!url || !key) { return this.showMessage('请填写完整信息', 'error'); }

      try {
        await this.completeSupabaseSyncSetup({ url, anonKey: key });
        this.showMessage('Supabase 同步已启用！', 'success');
      } catch (err) {
        this.showMessage('启用失败: ' + err.message, 'error');
      }
    });
    
    document.getElementById('sb-disable-btn').addEventListener('click', this.disableSyncHandler.bind(this));
    
    document.getElementById('manual-sync-btn').addEventListener('click', async () => {
      const btn = document.getElementById('manual-sync-btn');
      btn.textContent = '同步中...';
      try {
        await window.syncManager.manualSync();
        this.showMessage('同步成功', 'success');
      } catch (e) {
        this.showMessage('同步失败: ' + e.message, 'error');
      } finally {
        btn.textContent = '手动同步';
      }
    });
  }
  
  async disableSyncHandler() {
    if (confirm('确定要禁用云端同步吗？这会将当前云端主题切回本地主题，但云端数据仍会保留。')) {
      try {
        await window.syncManager.disableCloudSync();
        this.showMessage('同步已禁用', 'success');
        this.refreshSyncUI();
        await this.refreshCloudflareSetupUI();
        this.refreshThemesList();
        window.loadThemeSettings();
      } catch (err) {
        this.showMessage('操作失败: ' + err.message, 'error');
      }
    }
  }

  setElementsDisabledByIds(elementIds = [], disabled = false) {
    elementIds.forEach((elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.disabled = disabled;
      }
    });
  }

  updateSyncProviderMutualExclusionUI(status) {
    const providerNote = document.getElementById('sync-provider-exclusive-note');
    const cfHint = document.getElementById('cf-provider-lock-hint');
    const sbHint = document.getElementById('sb-provider-lock-hint');
    const cfTab = document.querySelector('.tab-btn[data-tab="cf-sync"]');
    const sbTab = document.querySelector('.tab-btn[data-tab="supabase-sync"]');
    const cfPanel = document.getElementById('cf-sync-panel');
    const sbPanel = document.getElementById('supabase-sync-panel');

    const cfLocked = status.activeProvider === 'supabase';
    const sbLocked = status.activeProvider === 'cloudflare';

    if (providerNote) {
      providerNote.textContent = status.isCloudEnabled
        ? `当前已启用 ${status.activeProvider === 'cloudflare' ? 'Cloudflare' : 'Supabase'} 同步；Cloudflare 与 Supabase 互斥。如需切换，请先禁用当前同步。`
        : '云端同步方式互斥：Cloudflare 与 Supabase 同一时间只能启用一种。';
    }

    if (cfHint) {
      cfHint.style.display = cfLocked ? 'block' : 'none';
      cfHint.textContent = '当前已启用 Supabase 同步。若要改用 Cloudflare，请先点击“禁用同步”，再返回这里配置。';
    }

    if (sbHint) {
      sbHint.style.display = sbLocked ? 'block' : 'none';
      sbHint.textContent = '当前已启用 Cloudflare 同步。若要改用 Supabase，请先点击“禁用同步”，再返回这里配置。';
    }

    cfTab?.classList.toggle('is-active-provider', status.activeProvider === 'cloudflare');
    sbTab?.classList.toggle('is-active-provider', status.activeProvider === 'supabase');
    cfTab?.classList.toggle('is-locked-provider', cfLocked);
    sbTab?.classList.toggle('is-locked-provider', sbLocked);
    cfPanel?.classList.toggle('is-provider-locked', cfLocked);
    sbPanel?.classList.toggle('is-provider-locked', sbLocked);

    this.setElementsDisabledByIds([
      'cf-resource-mode-existing',
      'cf-resource-mode-create',
      'cf-account-id',
      'cf-api-token',
      'cf-create-worker-name',
      'cf-create-database-name',
      'cf-create-bucket-name',
      'cf-worker-access-token',
      'cf-save-api-token',
      'cf-create-resources-btn',
      'cf-initialize-setup-btn',
      'cf-restore-setup-btn',
      'cf-clear-setup-cache-btn',
      'cf-worker-url',
      'cf-access-token',
      'cf-worker-name',
      'cf-database-id',
      'cf-database-name',
      'cf-bucket-name',
      'cf-test-btn',
      'cf-init-db-btn',
      'cf-save-existing-btn',
      'cf-enable-btn'
    ], cfLocked);

    this.setElementsDisabledByIds([
      'sb-url',
      'sb-key',
      'sb-test-btn',
      'sb-enable-btn'
    ], sbLocked);
  }

  refreshSyncUI() {
    const status = window.syncManager.getSyncStatus();
    const indicator = document.querySelector('.status-indicator');
    const title = document.getElementById('sync-status-title');
    const desc = document.getElementById('sync-status-desc');
    const manualBtn = document.getElementById('manual-sync-btn');
    
    // CF buttons
    const cfEnable = document.getElementById('cf-enable-btn');
    const cfDisable = document.getElementById('cf-disable-btn');
    const cfInit = document.getElementById('cf-init-db-btn');
    
    // SB buttons
    const sbEnable = document.getElementById('sb-enable-btn');
    const sbDisable = document.getElementById('sb-disable-btn');
    
    if (status.isCloudEnabled) {
      indicator.classList.add('active');
      title.textContent = `同步已启用 (${status.activeProvider})`;
      desc.textContent = `当前活跃的云端工作空间：${status.currentThemeName || status.currentThemeId}`;
      manualBtn.style.display = 'inline-block';
      
      if (status.activeProvider === 'cloudflare') {
        cfEnable.style.display = 'none';
        cfInit.style.display = 'inline-block';
        cfDisable.style.display = 'inline-block';
        
        sbEnable.style.display = 'inline-block';
        sbDisable.style.display = 'none';
        
        if (status.cloudflareConfig) {
          document.getElementById('cf-worker-url').value = status.cloudflareConfig.workerUrl || '';
          document.getElementById('cf-access-token').value = status.cloudflareConfig.accessToken || '';
        }
      } else {
        sbEnable.style.display = 'none';
        sbDisable.style.display = 'inline-block';
        
        cfEnable.style.display = 'inline-block';
        cfInit.style.display = 'inline-block';
        cfDisable.style.display = 'none';
        
        if (status.supabaseConfig) {
          document.getElementById('sb-url').value = status.supabaseConfig.url || '';
          document.getElementById('sb-key').value = status.supabaseConfig.anonKey || '';
        }
      }
    } else {
      indicator.classList.remove('active');
      title.textContent = '未启用同步';
      desc.textContent = '目前使用的是本地工作空间，数据不会跨端同步。';
      manualBtn.style.display = 'none';
      
      cfEnable.style.display = 'inline-block';
      cfDisable.style.display = 'none';
      cfInit.style.display = 'inline-block';
      
      sbEnable.style.display = 'inline-block';
      sbDisable.style.display = 'none';
    }

    this.updateSyncProviderMutualExclusionUI(status);
  }

  /* ---------------------- 数据管理 ---------------------- */
  bindDataEvents() {
    document.getElementById('export-data-btn').addEventListener('click', () => {
      const data = window.storageManager.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card-tab-${window.unifiedDataManager.appData.currentThemeId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    
    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-data-btn').addEventListener('click', () => importInput.click());
    
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(String(event.target.result || ''));
          await window.storageManager.importData(data);
          this.showMessage('数据导入成功', 'success');
        } catch (err) {
          this.showMessage('导入失败: ' + err.message, 'error');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    
    document.getElementById('clear-data-btn').addEventListener('click', async () => {
      if (confirm('确定要清空当前工作空间的所有分类和快捷方式吗？此操作极度危险！')) {
        try {
          // 只需清空 categories，保留 settings
          await window.storageManager.importData({ categories: [], settings: window.storageManager.getSettings() });
          this.showMessage('分类数据已清空', 'success');
        } catch(err) {
          this.showMessage('清空失败: ' + err.message, 'error');
        }
      }
    });
  }

  /* ---------------------- 实用工具 ---------------------- */
  showMessage(msg, type = 'info') {
    // 简单实现一个 tooltip/toast，借用原有 CSS 或者注入临时元素
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.3s';
    toast.style.backgroundColor = type === 'error' ? '#ea4335' : (type === 'success' ? '#34a853' : '#333');
    
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
}

window.settingsUIManager = new SettingsUIManager();
