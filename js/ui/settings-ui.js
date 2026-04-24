/**
 * Settings UI Controller
 * 负责管理设置页面的交互：侧边栏导航、外观主题管理、云端同步配置、数据导入导出
 */

class SettingsUIManager {
  constructor() {
    this.currentPanel = 'panel-appearance';
    this.currentWorkspaceTab = 'basic';
    this.editingThemeId = null;
    this.supabaseFlowModeOverride = null;
    this.workspaceVisibleCount = 12;
    this.workspaceLoadStep = 12;
    this.workspaceLoadObserver = null;
    this.workspaceLoadPending = false;
    this.remoteWorkspaceActiveProvider = 'cloudflare';
    this.remoteWorkspaceDiscoveries = {
      cloudflare: { items: [], missingItems: [], loading: false, loaded: false, error: '' },
      supabase: { items: [], missingItems: [], loading: false, loaded: false, error: '' }
    };

    // 背景图片缓存
    this.tempBgImageFile = null;
  }

  async init() {
    this.bindSidebarNav();
    this.bindAppearanceEvents();
    this.bindRemoteWorkspacePickerEvents();
    this.bindWorkspaceDetailEvents();
    this.bindSyncEvents();
    this.bindDataEvents();
    
    // 返回主页按钮
    document.getElementById('back-to-home-btn')?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    
    // 初始化面板数据
    this.refreshThemesList();
    await this.refreshCloudflareSetupUI();
    await this.refreshSupabaseSetupUI();
    this.refreshSyncUI();
    // 应用当前主题的 CSS 以保持视觉统一 (已在 settings.html 中触发 initThemeSettings)
  }

  /* ---------------------- 侧边导航栏 ---------------------- */
  bindSidebarNav() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        this.showPanel(targetId);
      });
    });
  }

  showPanel(targetId) {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const panels = document.querySelectorAll('.settings-panel');

    navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-target') === targetId);
    });

    panels.forEach(panel => {
      panel.classList.toggle('active', panel.id === targetId);
    });

    this.currentPanel = targetId;

    if (targetId === 'panel-appearance') {
      this.refreshWorkspaceDetailUI().catch(console.error);
    }
  }

  activateGlobalProviderTab(tabName) {
    const targetTab = document.querySelector(`#panel-sync .tab-btn[data-tab="${tabName}"]`);
    if (targetTab) {
      targetTab.click();
    }
  }

  getRemoteWorkspaceDiscoveryState(provider = this.remoteWorkspaceActiveProvider) {
    const resolvedProvider = provider === 'supabase' ? 'supabase' : 'cloudflare';
    return this.remoteWorkspaceDiscoveries[resolvedProvider];
  }

  getRemoteWorkspaceProviderLabel(provider = this.remoteWorkspaceActiveProvider) {
    return provider === 'supabase' ? 'Supabase' : 'Cloudflare';
  }

  invalidateRemoteWorkspaceDiscovery(provider = null) {
    const providers = provider ? [provider] : ['cloudflare', 'supabase'];

    providers.forEach((targetProvider) => {
      const state = this.getRemoteWorkspaceDiscoveryState(targetProvider);
      state.items = [];
      state.missingItems = [];
      state.loading = false;
      state.loaded = false;
      state.error = '';
    });
  }

  getRemoteWorkspaceImportMeta(importState = 'available') {
    if (importState === 'imported') {
      return {
        label: '已添加到本机',
        className: 'is-imported',
        buttonLabel: '已添加',
        disabled: true
      };
    }

    if (importState === 'conflict') {
      return {
        label: '本机存在同 ID 工作空间',
        className: 'is-conflict',
        buttonLabel: '覆盖导入',
        disabled: false
      };
    }

    return {
      label: '可添加到本机',
      className: '',
      buttonLabel: '添加到本机',
      disabled: false
    };
  }

  formatWorkspaceTimestamp(timestamp) {
    if (!timestamp) {
      return '未知';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '未知';
    }

    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  bindRemoteWorkspacePickerEvents() {
    document.getElementById('workspace-import-cloud-btn')?.addEventListener('click', () => {
      this.openRemoteWorkspacePicker().catch(console.error);
    });

    document.getElementById('remote-workspace-picker-close-btn')?.addEventListener('click', () => {
      this.closeRemoteWorkspacePicker();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeRemoteWorkspacePicker();
      }
    });

    document.querySelectorAll('.remote-provider-tab').forEach((button) => {
      button.addEventListener('click', () => {
        this.switchRemoteWorkspaceProvider(button.dataset.remoteProvider || 'cloudflare').catch(console.error);
      });
    });

    document.getElementById('remote-workspace-refresh-btn')?.addEventListener('click', async () => {
      const provider = this.remoteWorkspaceActiveProvider;
      this.invalidateRemoteWorkspaceDiscovery(provider);
      this.loadRemoteWorkspaceDiscovery(provider, { forceRefresh: true }).catch(console.error);
    });

    document.getElementById('remote-workspace-open-sync-btn')?.addEventListener('click', () => {
      const provider = this.remoteWorkspaceActiveProvider;
      this.closeRemoteWorkspacePicker();
      this.showPanel('panel-sync');
      this.activateGlobalProviderTab(provider === 'supabase' ? 'supabase-sync' : 'cf-sync');
    });

    document.getElementById('remote-workspace-list')?.addEventListener('click', async (event) => {
      const actionButton = event.target.closest('[data-remote-theme-id][data-remote-action]');
      if (!actionButton) {
        return;
      }

      const provider = actionButton.dataset.remoteProvider || this.remoteWorkspaceActiveProvider;
      const themeId = actionButton.dataset.remoteThemeId || '';
      const action = actionButton.dataset.remoteAction || 'import';
      if (!themeId) {
        return;
      }

      if (action === 'delete') {
        await this.deleteRemoteWorkspace(provider, themeId, actionButton);
        return;
      }

      if (action === 'restore' || action === 'detach' || action === 'remove-local') {
        await this.handleMissingRemoteWorkspaceAction(provider, themeId, action, actionButton);
        return;
      }

      await this.importRemoteWorkspace(provider, themeId, actionButton);
    });
  }

  async openRemoteWorkspacePicker(provider = null) {
    const picker = document.getElementById('remote-workspace-picker');
    if (!picker) {
      return;
    }

    document.getElementById('theme-edit-form').style.display = 'none';
    this.editingThemeId = null;
    this.hideWorkspaceOverviewList();
    picker.style.display = 'flex';
    await this.switchRemoteWorkspaceProvider(provider || this.remoteWorkspaceActiveProvider, { forceRefresh: true });
  }

  closeRemoteWorkspacePicker() {
    const picker = document.getElementById('remote-workspace-picker');
    if (!picker || picker.style.display === 'none') {
      return;
    }

    picker.style.display = 'none';
    this.showWorkspaceOverviewList();
  }

  async switchRemoteWorkspaceProvider(provider, { forceRefresh = false } = {}) {
    this.remoteWorkspaceActiveProvider = provider === 'supabase' ? 'supabase' : 'cloudflare';
    this.renderRemoteWorkspacePicker();

    const state = this.getRemoteWorkspaceDiscoveryState(this.remoteWorkspaceActiveProvider);
    if (!state.loaded || forceRefresh) {
      await this.loadRemoteWorkspaceDiscovery(this.remoteWorkspaceActiveProvider, { forceRefresh });
    }
  }

  async loadRemoteWorkspaceDiscovery(provider, { forceRefresh = false } = {}) {
    const resolvedProvider = provider === 'supabase' ? 'supabase' : 'cloudflare';
    const state = this.getRemoteWorkspaceDiscoveryState(resolvedProvider);

    if (state.loading) {
      return;
    }

    if (forceRefresh) {
      state.items = [];
      state.missingItems = [];
      state.loaded = false;
      state.error = '';
    }

    if (state.loaded && !forceRefresh) {
      this.renderRemoteWorkspacePicker();
      return;
    }

    state.loading = true;
    state.error = '';
    this.renderRemoteWorkspacePicker();

    try {
      const [remoteItems, missingItems] = await Promise.all([
        window.unifiedDataManager.discoverRemoteThemes(resolvedProvider),
        window.unifiedDataManager.reconcileMissingCloudThemes(resolvedProvider)
      ]);
      state.items = remoteItems;
      state.missingItems = Array.isArray(missingItems) ? missingItems : [];
      state.loaded = true;
    } catch (error) {
      state.items = [];
      state.missingItems = [];
      state.loaded = false;
      state.error = error.message || '加载远端工作空间失败';
    } finally {
      state.loading = false;
      this.renderRemoteWorkspacePicker();
    }
  }

  createRemoteWorkspaceItem(entry) {
    const importMeta = this.getRemoteWorkspaceImportMeta(entry.importState);
    const previewColorMap = {
      default: '#f5f5f5',
      dark: '#35363a',
      blue: '#e8f0fe',
      green: '#e6f4ea',
      purple: '#f3e8fd',
      pink: '#fce4ec'
    };
    const previewBackgroundColor = previewColorMap[entry.themeType] || previewColorMap.default;

    const item = document.createElement('div');
    item.className = 'remote-workspace-item';

    const preview = document.createElement('div');
    preview.className = 'remote-workspace-preview';
    preview.style.backgroundColor = previewBackgroundColor;
    if (entry.bgImageUrl) {
      preview.style.backgroundImage = `url(${entry.bgImageUrl})`;
    }

    const main = document.createElement('div');
    main.className = 'remote-workspace-item-main';

    const header = document.createElement('div');
    header.className = 'remote-workspace-item-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h5');
    title.textContent = entry.themeName || '未命名工作空间';
    titleWrap.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'remote-workspace-item-badges';

    const providerChip = document.createElement('span');
    providerChip.className = 'remote-workspace-chip is-provider';
    providerChip.textContent = this.getRemoteWorkspaceProviderLabel(entry.provider);
    badges.appendChild(providerChip);

    const stateChip = document.createElement('span');
    stateChip.className = `remote-workspace-chip ${importMeta.className}`.trim();
    stateChip.textContent = importMeta.label;
    badges.appendChild(stateChip);

    header.appendChild(titleWrap);
    header.appendChild(badges);

    const meta = document.createElement('div');
    meta.className = 'remote-workspace-meta';

    const themeIdMeta = document.createElement('span');
    themeIdMeta.textContent = `themeId：${entry.themeId}`;
    const themeTypeMeta = document.createElement('span');
    themeTypeMeta.textContent = `风格：${entry.themeType || 'default'}`;
    const updatedAtMeta = document.createElement('span');
    updatedAtMeta.textContent = `更新于：${this.formatWorkspaceTimestamp(entry.updatedAt)}`;

    meta.appendChild(themeIdMeta);
    meta.appendChild(themeTypeMeta);
    meta.appendChild(updatedAtMeta);

    const note = document.createElement('p');
    note.className = 'remote-workspace-note';
    if (entry.importState === 'conflict') {
      note.textContent = `本机已有同 ID 工作空间：${entry.localTheme?.themeName || '未命名工作空间'}。继续导入会改为使用云端版本；当前设备保留本机工作空间时不能删除云端。`;
    } else if (entry.importState === 'imported') {
      note.textContent = '这个工作空间已经在当前设备可用。若要删除云端，请先在当前设备删除本机工作空间。';
    } else {
      note.textContent = '添加到本机后，这个工作空间会出现在当前设备的工作空间列表中。';
    }

    const actions = document.createElement('div');
    actions.className = 'remote-workspace-actions';

    if (entry.importState === 'conflict') {
      const actionHint = document.createElement('span');
      actionHint.className = 'sync-hint';
      actionHint.textContent = '适合把本机同 ID 工作空间接到云端版本。';
      actions.appendChild(actionHint);
    }

    const actionButtons = document.createElement('div');
    actionButtons.className = 'remote-workspace-action-buttons';

    const actionButton = document.createElement('button');
    actionButton.className = entry.importState === 'conflict' ? 'secondary-btn' : 'primary-btn';
    actionButton.textContent = importMeta.buttonLabel;
    actionButton.disabled = importMeta.disabled;
    actionButton.dataset.remoteThemeId = entry.themeId;
    actionButton.dataset.remoteProvider = entry.provider;
    actionButton.dataset.remoteAction = 'import';
    actionButtons.appendChild(actionButton);

    if (entry.importState === 'available') {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'secondary-btn text-danger';
      deleteButton.textContent = '删除云端';
      deleteButton.dataset.remoteThemeId = entry.themeId;
      deleteButton.dataset.remoteProvider = entry.provider;
      deleteButton.dataset.remoteAction = 'delete';
      actionButtons.appendChild(deleteButton);
    }

    actions.appendChild(actionButtons);

    main.appendChild(header);
    main.appendChild(meta);
    main.appendChild(note);
    main.appendChild(actions);

    item.appendChild(preview);
    item.appendChild(main);

    return item;
  }

  createMissingRemoteWorkspaceItem(entry) {
    const previewColorMap = {
      default: '#f5f5f5',
      dark: '#35363a',
      blue: '#e8f0fe',
      green: '#e6f4ea',
      purple: '#f3e8fd',
      pink: '#fce4ec'
    };
    const localTheme = entry.localTheme || {};
    const previewBackgroundColor = previewColorMap[localTheme.themeType] || previewColorMap.default;

    const item = document.createElement('div');
    item.className = 'remote-workspace-item';

    const preview = document.createElement('div');
    preview.className = 'remote-workspace-preview';
    preview.style.backgroundColor = previewBackgroundColor;

    const main = document.createElement('div');
    main.className = 'remote-workspace-item-main';

    const header = document.createElement('div');
    header.className = 'remote-workspace-item-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h5');
    title.textContent = entry.themeName || localTheme.themeName || '未命名工作空间';
    titleWrap.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'remote-workspace-item-badges';

    const providerChip = document.createElement('span');
    providerChip.className = 'remote-workspace-chip is-provider';
    providerChip.textContent = this.getRemoteWorkspaceProviderLabel(entry.provider);
    badges.appendChild(providerChip);

    const stateChip = document.createElement('span');
    stateChip.className = 'remote-workspace-chip is-conflict';
    stateChip.textContent = '云端副本缺失';
    badges.appendChild(stateChip);

    header.appendChild(titleWrap);
    header.appendChild(badges);

    const meta = document.createElement('div');
    meta.className = 'remote-workspace-meta';

    const themeIdMeta = document.createElement('span');
    themeIdMeta.textContent = `themeId：${entry.themeId}`;
    const themeTypeMeta = document.createElement('span');
    themeTypeMeta.textContent = `风格：${localTheme.themeType || 'default'}`;
    const updatedAtMeta = document.createElement('span');
    updatedAtMeta.textContent = `本机更新于：${this.formatWorkspaceTimestamp(localTheme.updatedAt)}`;

    meta.appendChild(themeIdMeta);
    meta.appendChild(themeTypeMeta);
    meta.appendChild(updatedAtMeta);

    const note = document.createElement('p');
    note.className = 'remote-workspace-note';
    note.textContent = '当前设备仍保留这个工作空间，但云端记录已经不存在。请选择恢复到云端、转成本地空间，或直接从本机移除。';

    const actions = document.createElement('div');
    actions.className = 'remote-workspace-actions';

    const actionHint = document.createElement('span');
    actionHint.className = 'sync-hint';
    actionHint.textContent = '缺失态不会自动恢复，也不会在普通编辑时偷偷重建云端。';
    actions.appendChild(actionHint);

    const actionButtons = document.createElement('div');
    actionButtons.className = 'remote-workspace-action-buttons';

    const restoreButton = document.createElement('button');
    restoreButton.className = 'primary-btn';
    restoreButton.textContent = '恢复到云端';
    restoreButton.dataset.remoteThemeId = entry.themeId;
    restoreButton.dataset.remoteProvider = entry.provider;
    restoreButton.dataset.remoteAction = 'restore';
    actionButtons.appendChild(restoreButton);

    const detachButton = document.createElement('button');
    detachButton.className = 'secondary-btn';
    detachButton.textContent = '转成本地空间';
    detachButton.dataset.remoteThemeId = entry.themeId;
    detachButton.dataset.remoteProvider = entry.provider;
    detachButton.dataset.remoteAction = 'detach';
    actionButtons.appendChild(detachButton);

    const removeButton = document.createElement('button');
    removeButton.className = 'secondary-btn text-danger';
    removeButton.textContent = '从本机移除';
    removeButton.dataset.remoteThemeId = entry.themeId;
    removeButton.dataset.remoteProvider = entry.provider;
    removeButton.dataset.remoteAction = 'remove-local';
    actionButtons.appendChild(removeButton);

    actions.appendChild(actionButtons);

    main.appendChild(header);
    main.appendChild(meta);
    main.appendChild(note);
    main.appendChild(actions);

    item.appendChild(preview);
    item.appendChild(main);

    return item;
  }

  renderRemoteWorkspacePicker() {
    const picker = document.getElementById('remote-workspace-picker');
    const list = document.getElementById('remote-workspace-list');
    const statusText = document.getElementById('remote-workspace-status-text');
    const providerBadge = document.getElementById('remote-workspace-provider-badge');
    const openSyncBtn = document.getElementById('remote-workspace-open-sync-btn');
    const refreshBtn = document.getElementById('remote-workspace-refresh-btn');
    const provider = this.remoteWorkspaceActiveProvider;
    const providerLabel = this.getRemoteWorkspaceProviderLabel(provider);
    const state = this.getRemoteWorkspaceDiscoveryState(provider);

    if (!picker || !list || !statusText || !providerBadge || !openSyncBtn || !refreshBtn) {
      return;
    }

    document.querySelectorAll('.remote-provider-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.remoteProvider === provider);
    });

    providerBadge.textContent = providerLabel;
    providerBadge.classList.remove('is-ready', 'is-error', 'is-pending');
    providerBadge.classList.add('is-idle');
    openSyncBtn.textContent = `前往 ${providerLabel} 连接`;
    refreshBtn.disabled = state.loading;

    if (state.loading) {
      statusText.textContent = `正在读取 ${providerLabel} 上的工作空间列表...`;
      list.innerHTML = '<div class="remote-workspace-empty">正在从云端读取工作空间列表，请稍候...</div>';
      return;
    }

    if (state.error) {
      statusText.textContent = `${providerLabel} 连接还没准备好，先去完成全局连接。`;
      list.innerHTML = `<div class="remote-workspace-empty">${providerLabel} 远端工作空间列表加载失败：${state.error}</div>`;
      return;
    }

    const importedCount = state.items.filter((item) => item.importState === 'imported').length;
    const missingCount = state.missingItems.length;
    statusText.textContent = state.items.length > 0 || missingCount > 0
      ? `${providerLabel} 远端共 ${state.items.length} 个工作空间，其中 ${importedCount} 个已经在本机可用；另有 ${missingCount} 个工作空间处于云端缺失待处理状态。`
      : `${providerLabel} 目前还没有可添加的远端工作空间。`;

    list.innerHTML = '';

    if (!state.items.length && !missingCount) {
      list.innerHTML = '<div class="remote-workspace-empty">当前没有发现远端工作空间。你可以先在另一台设备启用同步，或前往“云端连接”检查当前连接资料。</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    state.missingItems.forEach((entry) => {
      fragment.appendChild(this.createMissingRemoteWorkspaceItem(entry));
    });
    state.items.forEach((entry) => {
      fragment.appendChild(this.createRemoteWorkspaceItem(entry));
    });
    list.appendChild(fragment);
  }

  async importRemoteWorkspace(provider, themeId, actionButton = null) {
    const discoveryState = this.getRemoteWorkspaceDiscoveryState(provider);
    const targetEntry = discoveryState.items.find((item) => item.themeId === themeId);
    if (!targetEntry || targetEntry.importState === 'imported') {
      return;
    }

    if (targetEntry.importState === 'conflict') {
      const confirmed = await window.notification.confirm(
        `本机已经有一个 themeId 为“${themeId}”的工作空间（${targetEntry.localTheme?.themeName || '未命名工作空间'}）。继续后会改为使用云端版本。确定继续吗？`,
        {
          title: '确认覆盖导入',
          confirmText: '继续导入',
          cancelText: '取消',
          type: 'warning'
        }
      );

      if (!confirmed) {
        return;
      }
    }

    const defaultText = actionButton?.textContent || '';
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = targetEntry.importState === 'conflict' ? '覆盖中...' : '添加中...';
    }

    try {
      const importedTheme = await window.unifiedDataManager.importRemoteTheme(provider, targetEntry);
      await window.syncManager.init().catch(() => {});
      this.refreshThemesList();
      this.refreshSyncUI();
      await this.refreshWorkspaceDetailUI();

      if (importedTheme.themeId === window.unifiedDataManager.appData.currentThemeId) {
        window.loadThemeSettings();
      }

      await this.loadRemoteWorkspaceDiscovery(provider, { forceRefresh: true });
      this.showMessage(
        targetEntry.importState === 'conflict' ? '云端工作空间已覆盖导入到本机' : '云端工作空间已添加到本机',
        'success'
      );
    } catch (error) {
      if (actionButton) {
        actionButton.disabled = false;
        actionButton.textContent = defaultText;
      }
      this.showMessage('添加失败: ' + error.message, 'error');
    }
  }

  async handleMissingRemoteWorkspaceAction(provider, themeId, action, actionButton = null) {
    const discoveryState = this.getRemoteWorkspaceDiscoveryState(provider);
    const targetEntry = discoveryState.missingItems.find((item) => item.themeId === themeId);
    if (!targetEntry) {
      return;
    }

    const relatedButtons = Array.from(
      actionButton?.closest('.remote-workspace-actions')?.querySelectorAll('button') || []
    );
    const previousStates = relatedButtons.map((button) => ({
      button,
      text: button.textContent,
      disabled: button.disabled
    }));

    const actionMetaMap = {
      restore: {
        confirm: `确定要恢复“${targetEntry.themeName || themeId}”到 ${this.getRemoteWorkspaceProviderLabel(provider)} 吗？这会使用当前设备上的本机数据重新创建云端副本。`,
        title: '确认恢复到云端',
        confirmText: '恢复到云端',
        busyText: '恢复中...',
        success: '云端工作空间已恢复'
      },
      detach: {
        confirm: `确定要把“${targetEntry.themeName || themeId}”转成本地工作空间吗？这会移除云端身份，并清除背景图配置。`,
        title: '确认转成本地空间',
        confirmText: '转成本地',
        busyText: '转换中...',
        success: '已转为本地工作空间，背景图已移除'
      },
      'remove-local': {
        confirm: `确定要从当前设备移除“${targetEntry.themeName || themeId}”吗？云端副本已经不存在，这会直接删除本机这份工作空间。`,
        title: '确认从本机移除',
        confirmText: '从本机移除',
        busyText: '移除中...',
        success: '工作空间已从当前设备移除'
      }
    };
    const actionMeta = actionMetaMap[action];
    if (!actionMeta) {
      return;
    }

    const confirmed = await window.notification.confirm(actionMeta.confirm, {
      title: actionMeta.title,
      confirmText: actionMeta.confirmText,
      cancelText: '取消',
      type: action === 'remove-local' ? 'error' : 'warning'
    });
    if (!confirmed) {
      return;
    }

    relatedButtons.forEach((button) => {
      button.disabled = true;
    });
    if (actionButton) {
      actionButton.textContent = actionMeta.busyText;
    }

    try {
      if (action === 'restore') {
        await window.unifiedDataManager.restoreMissingRemoteTheme(themeId);
      } else if (action === 'detach') {
        await window.unifiedDataManager.convertThemeToLocal(themeId);
      } else {
        await window.unifiedDataManager.deleteTheme(themeId);
      }

      await this.loadRemoteWorkspaceDiscovery(provider, { forceRefresh: true });
      this.refreshThemesList();
      this.refreshSyncUI();
      await this.refreshWorkspaceDetailUI();
      this.showMessage(actionMeta.success, 'success');
    } catch (error) {
      previousStates.forEach(({ button, text, disabled }) => {
        button.textContent = text;
        button.disabled = disabled;
      });
      this.showMessage('操作失败: ' + error.message, 'error');
    }
  }

  async deleteRemoteWorkspace(provider, themeId, actionButton = null) {
    const discoveryState = this.getRemoteWorkspaceDiscoveryState(provider);
    const targetEntry = discoveryState.items.find((item) => item.themeId === themeId);
    if (!targetEntry) {
      return;
    }

    if (targetEntry.importState !== 'available') {
      this.showMessage('当前设备仍保留该工作空间，请先删除本机工作空间后再删除云端数据', 'warning');
      return;
    }

    const providerLabel = this.getRemoteWorkspaceProviderLabel(provider);
    const workspaceName = targetEntry.themeName || themeId;
    const confirmed = await window.notification.confirm(
      `确定要从 ${providerLabel} 删除“${workspaceName}”吗？这只会删除云端数据，不会删除本机工作空间。`,
      {
        title: '确认删除云端工作空间',
        confirmText: '删除云端数据',
        cancelText: '取消',
        type: 'warning'
      }
    );

    if (!confirmed) {
      return;
    }

    const relatedButtons = Array.from(
      actionButton?.closest('.remote-workspace-actions')?.querySelectorAll('button') || []
    );
    const previousStates = relatedButtons.map((button) => ({
      button,
      text: button.textContent,
      disabled: button.disabled
    }));

    relatedButtons.forEach((button) => {
      button.disabled = true;
    });
    if (actionButton) {
      actionButton.textContent = '删除中...';
    }

    try {
      await window.unifiedDataManager.deleteRemoteTheme(provider, targetEntry);
      await this.loadRemoteWorkspaceDiscovery(provider, { forceRefresh: true });
      this.showMessage('云端工作空间已删除', 'success');
    } catch (error) {
      previousStates.forEach(({ button, text, disabled }) => {
        button.textContent = text;
        button.disabled = disabled;
      });
      this.showMessage('删除失败: ' + error.message, 'error');
    }
  }

  /* ---------------------- 外观主题管理 ---------------------- */
  bindAppearanceEvents() {
    // 新建主题按钮
    document.getElementById('workspace-overview-manage-btn')?.addEventListener('click', () => {
      this.openThemeForm();
    });

    this.bindWorkspaceListEvents();

    // 颜色选择器
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
        opt.classList.add('selected');
        
        // 预览主题颜色
        const type = opt.getAttribute('data-type');
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
          window.notification.error('图片过大，不能超过 50MB');
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
  bindWorkspaceListEvents() {
    const container = document.getElementById('themes-list');

    this.setupWorkspaceInfiniteScroll();

    container?.addEventListener('click', async (event) => {
      const actionButton = event.target.closest('.use-theme-btn, .edit-theme-btn, .delete-theme-btn');
      if (actionButton) {
        const themeId = actionButton.getAttribute('data-id');
        if (!themeId) {
          return;
        }

        if (actionButton.classList.contains('use-theme-btn')) {
          await this.switchWorkspaceFromList(themeId);
          return;
        }

        if (actionButton.classList.contains('edit-theme-btn')) {
          const theme = window.unifiedDataManager?.appData?.themes?.[themeId] || null;
          if (!this.canActivateWorkspace(theme)) {
            this.showMessage('这个工作空间处于云端缺失待处理状态，不能直接进入详情或切换使用', 'warning');
            return;
          }
          this.openThemeForm(themeId);
          return;
        }

        if (actionButton.classList.contains('delete-theme-btn')) {
          await this.deleteWorkspaceFromList(themeId);
        }
        return;
      }

      const card = event.target.closest('.theme-card');
      if (card?.dataset.id) {
        const theme = window.unifiedDataManager?.appData?.themes?.[card.dataset.id] || null;
        if (!this.canActivateWorkspace(theme)) {
          this.showMessage('这个工作空间处于云端缺失待处理状态，不能直接进入详情或切换使用', 'warning');
          return;
        }
        this.openThemeForm(card.dataset.id);
      }
    });

    container?.addEventListener('keydown', (event) => {
      if (event.target.closest('button')) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const card = event.target.closest('.theme-card');
      if (!card?.dataset.id) {
        return;
      }

      const theme = window.unifiedDataManager?.appData?.themes?.[card.dataset.id] || null;
      if (!this.canActivateWorkspace(theme)) {
        this.showMessage('这个工作空间处于云端缺失待处理状态，不能直接进入详情或切换使用', 'warning');
        return;
      }

      event.preventDefault();
      this.openThemeForm(card.dataset.id);
    });
  }

  setupWorkspaceInfiniteScroll() {
    const sentinel = document.getElementById('workspace-load-sentinel');
    const scrollRoot = document.querySelector('.settings-content');

    if (!sentinel || !scrollRoot || typeof IntersectionObserver === 'undefined') {
      return;
    }

    if (this.workspaceLoadObserver) {
      this.workspaceLoadObserver.disconnect();
    }

    this.workspaceLoadObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) {
        return;
      }

      this.loadMoreWorkspaces();
    }, {
      root: scrollRoot,
      rootMargin: '0px 0px 240px 0px',
      threshold: 0
    });

    this.workspaceLoadObserver.observe(sentinel);
  }

  loadMoreWorkspaces() {
    if (this.workspaceLoadPending || this.editingThemeId) {
      return;
    }

    const totalItems = window.unifiedDataManager?.getAllThemes?.().length || 0;
    if (this.workspaceVisibleCount >= totalItems) {
      return;
    }

    this.workspaceLoadPending = true;
    this.workspaceVisibleCount = Math.min(this.workspaceVisibleCount + this.workspaceLoadStep, totalItems);
    this.refreshThemesList();
    this.workspaceLoadPending = false;
  }

  async switchWorkspaceFromList(themeId) {
    const theme = window.unifiedDataManager?.appData?.themes?.[themeId] || null;
    if (!this.canActivateWorkspace(theme)) {
      this.showMessage('这个工作空间的云端副本已缺失，请先恢复到云端、转成本地空间，或从本机移除', 'warning');
      return;
    }

    this.showMessage('正在切换工作空间...', 'info');

    try {
      await window.unifiedDataManager.switchTheme(themeId);
      await window.syncManager.init();
      this.refreshThemesList();
      this.refreshSyncUI();
      window.loadThemeSettings();
      this.showMessage('已切换工作空间', 'success');
    } catch (error) {
      this.showMessage('切换失败: ' + error.message, 'error');
    }
  }

  async deleteWorkspaceFromList(themeId) {
    const theme = window.unifiedDataManager?.appData?.themes?.[themeId] || null;
    const isCloudTheme = theme?.type && theme.type !== 'chrome';
    const isMissingRemote = theme?.syncStatus === 'missing_remote';
    const message = isCloudTheme
      ? (isMissingRemote
        ? '确定要从当前设备移除此工作空间吗？当前云端副本已经不存在，这会直接删除本机这份工作空间。'
        : '确定要从当前设备移除此工作空间吗？这不会删除云端数据，其他设备仍可继续使用。')
      : '确定要删除此本地工作空间吗？此操作不可恢复。';

    const confirmed = await window.notification.confirm(message, {
      title: '确认移除工作空间',
      confirmText: isCloudTheme ? '仅删本机' : '删除',
      cancelText: '取消',
      type: 'error'
    });

    if (!confirmed) {
      return;
    }

    try {
      await window.unifiedDataManager.deleteTheme(themeId);
      this.refreshThemesList();
      this.showMessage(isCloudTheme ? '工作空间已从当前设备移除' : '工作空间已删除', 'success');
    } catch (error) {
      this.showMessage('删除失败: ' + error.message, 'error');
    }
  }

  getSortedThemes(themes, currentThemeId) {
    return [...themes].sort((a, b) => {
      if (a.themeId === currentThemeId) return -1;
      if (b.themeId === currentThemeId) return 1;

      const updatedAtA = new Date(a.updatedAt || 0).getTime();
      const updatedAtB = new Date(b.updatedAt || 0).getTime();
      return updatedAtB - updatedAtA;
    });
  }

  getVisibleWorkspaceCount(totalItems) {
    if (totalItems <= 0) {
      return 0;
    }

    const minimumVisibleCount = Math.max(this.workspaceVisibleCount, this.workspaceLoadStep);
    const visibleCount = Math.min(minimumVisibleCount, totalItems);
    this.workspaceVisibleCount = visibleCount;
    return visibleCount;
  }

  updateWorkspaceLoadSentinel(totalItems, renderedCount) {
    const sentinel = document.getElementById('workspace-load-sentinel');
    if (!sentinel) {
      return;
    }

    sentinel.hidden = !!this.editingThemeId || renderedCount >= totalItems;
  }

  isMissingRemoteWorkspace(theme) {
    return !!theme && theme.syncStatus === 'missing_remote';
  }

  canActivateWorkspace(theme) {
    if (!theme) {
      return false;
    }

    if (theme.themeId === window.unifiedDataManager?.appData?.currentThemeId) {
      return true;
    }

    return !this.isMissingRemoteWorkspace(theme);
  }

  createThemeCard(theme, currentThemeId) {
    const isCurrent = theme.themeId === currentThemeId;
    const syncStatus = theme.syncStatus || (theme.type === 'chrome' ? 'local' : 'ok');
    const canActivate = this.canActivateWorkspace(theme);
    const typeLabel = theme.type === 'chrome'
      ? '本地'
      : (theme.type === 'cloudflare' ? 'CF 云端' : 'Supabase');
    const statusLabel = syncStatus === 'missing_remote'
      ? '云端缺失'
      : (syncStatus === 'detached' ? '已转本地' : null);
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
    const themeName = theme.themeName || '未命名';
    const themeColorLabel = theme.themeType === 'default' ? '浅色' : (theme.themeType || '默认');

    const card = document.createElement('div');
    card.className = `theme-card ${isCurrent ? 'active-theme' : ''}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', canActivate ? '0' : '-1');
    card.setAttribute('aria-label', canActivate ? `打开工作空间 ${themeName} 的详情设置` : `工作空间 ${themeName} 处于云端缺失待处理状态`);
    card.dataset.id = theme.themeId;
    card.innerHTML = `
      <div class="theme-card-header">
        <div>
          <h4 class="theme-name">${themeName}</h4>
          <div class="theme-meta">
            <span>${typeLabel}</span> \u00b7 <span>${themeColorLabel}</span>${statusLabel ? ` \u00b7 <span>${statusLabel}</span>` : ''}
          </div>
        </div>
        ${isCurrent ? '<span class="theme-card-state is-current">当前使用中</span>' : ''}
      </div>
      <div class="theme-preview-block" style="${bgStyle}"></div>
      <div class="theme-card-hint">
        <span class="material-symbols-rounded">arrow_forward</span>
        <span>${canActivate ? '点击卡片可进入详情设置' : '请先处理云端缺失状态'}</span>
      </div>
      <div class="theme-actions">
        ${!isCurrent ? `<button class="primary-btn use-theme-btn" data-id="${theme.themeId}" ${canActivate ? '' : 'disabled'}>\u4f7f\u7528</button>` : ''}
        <button class="secondary-btn edit-theme-btn" data-id="${theme.themeId}">设置</button>
        ${(!isCurrent && theme.themeId !== 'default') ? `<button class="secondary-btn text-danger delete-theme-btn" data-id="${theme.themeId}">\u5220\u9664</button>` : ''}
      </div>
    `;

    return card;
  }

  bindWorkspaceDetailEvents() {
    document.querySelectorAll('.workspace-tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.switchWorkspaceDetailTab(button.dataset.workspaceTab || 'basic');
      });
    });

    document.getElementById('switch-workspace-btn')?.addEventListener('click', async () => {
      if (!this.editingThemeId) {
        return;
      }

      const theme = window.unifiedDataManager?.appData?.themes?.[this.editingThemeId] || null;
      if (!this.canActivateWorkspace(theme)) {
        this.showMessage('这个工作空间处于云端缺失待处理状态，不能直接切换使用，请先处理', 'warning');
        return;
      }

      const preservedTab = this.currentWorkspaceTab;

      try {
        await window.unifiedDataManager.switchTheme(this.editingThemeId);
        await window.syncManager.init();
        this.refreshThemesList();
        this.refreshSyncUI();
        await this.refreshCloudflareSetupUI();
        await this.refreshSupabaseSetupUI();
        window.loadThemeSettings();
        this.openThemeForm(this.editingThemeId);
        this.switchWorkspaceDetailTab(preservedTab);
        this.showMessage('已切换到该工作空间', 'success');
      } catch (error) {
        this.showMessage('切换失败: ' + error.message, 'error');
      }
    });

    document.getElementById('workspace-open-global-cf-btn')?.addEventListener('click', () => {
      this.showPanel('panel-sync');
      this.activateGlobalProviderTab('cf-sync');
    });

    document.getElementById('workspace-open-global-sb-btn')?.addEventListener('click', () => {
      this.showPanel('panel-sync');
      this.activateGlobalProviderTab('supabase-sync');
    });

    document.getElementById('workspace-disable-sync-btn')?.addEventListener('click', this.disableSyncHandler.bind(this));
  }

  switchWorkspaceDetailTab(tabName = 'basic') {
    this.currentWorkspaceTab = tabName;

    document.querySelectorAll('.workspace-tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.workspaceTab === tabName);
    });

    document.querySelectorAll('.workspace-tab-pane').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `workspace-tab-${tabName}`);
    });
  }

  refreshWorkspaceOverview(themes, currentThemeId) {
    const title = document.getElementById('workspace-overview-title');
    const desc = document.getElementById('workspace-overview-desc');
    const count = document.getElementById('workspace-count-value');
    const manageBtn = document.getElementById('workspace-overview-manage-btn');

    if (!title || !desc || !count || !manageBtn) {
      return;
    }

    count.textContent = String(themes.length);

    const currentTheme = themes.find((theme) => theme.themeId === currentThemeId);
    const syncModeMap = {
      chrome: '本地模式',
      cloudflare: 'Cloudflare 同步',
      supabase: 'Supabase 同步'
    };
    const colorModeMap = {
      default: '浅色风格',
      dark: '深色风格',
      blue: '蓝色风格',
      green: '绿色风格',
      purple: '紫色风格',
      pink: '粉色风格'
    };

    if (!currentTheme) {
      title.textContent = '还没有可用工作空间';
      title.hidden = false;
      desc.textContent = '先新建工作空间，再配置外观和同步。';
      desc.hidden = false;
      manageBtn.textContent = '新建工作空间';
      return;
    }

    title.textContent = '';
    title.hidden = true;
    const currentSyncStatus = currentTheme.syncStatus || (currentTheme.type === 'chrome' ? 'local' : 'ok');
    const currentSyncStatusLabel = currentSyncStatus === 'missing_remote'
      ? '云端缺失待处理'
      : (currentSyncStatus === 'detached' ? '已转本地' : '');
    desc.textContent = `${currentTheme.themeName || '未命名工作空间'} · ${syncModeMap[currentTheme.type] || '本地模式'} · ${colorModeMap[currentTheme.themeType] || '默认风格'}${currentSyncStatusLabel ? ` · ${currentSyncStatusLabel}` : ''}`;
    desc.hidden = false;
    manageBtn.textContent = '新建工作空间';
  }
  refreshThemesList() {
    const container = document.getElementById('themes-list');
    if (!container) return;

    const themes = window.unifiedDataManager.getAllThemes();
    const currentThemeId = window.unifiedDataManager.appData.currentThemeId;
    const sortedThemes = this.getSortedThemes(themes, currentThemeId);
    const visibleCount = this.getVisibleWorkspaceCount(sortedThemes.length);
    const visibleThemes = sortedThemes.slice(0, visibleCount);

    container.innerHTML = '';

    this.refreshWorkspaceOverview(sortedThemes, currentThemeId);

    const fragment = document.createDocumentFragment();
    visibleThemes.forEach((theme) => {
      fragment.appendChild(this.createThemeCard(theme, currentThemeId));
    });
    container.appendChild(fragment);

    this.updateWorkspaceLoadSentinel(sortedThemes.length, visibleThemes.length);
  }

  hideWorkspaceOverviewList() {
    document.getElementById('workspace-overview-card').style.display = 'none';
    document.getElementById('themes-list').style.display = 'none';
    const loadSentinel = document.getElementById('workspace-load-sentinel');
    if (loadSentinel) {
      loadSentinel.hidden = true;
    }
  }

  showWorkspaceOverviewList() {
    document.getElementById('workspace-overview-card').style.display = 'flex';
    document.getElementById('themes-list').style.display = 'grid';
    const loadSentinel = document.getElementById('workspace-load-sentinel');
    if (loadSentinel) {
      const totalThemes = window.unifiedDataManager?.getAllThemes?.().length || 0;
      loadSentinel.hidden = totalThemes <= this.workspaceVisibleCount;
    }
  }

  openThemeForm(themeId = null) {
    this.editingThemeId = themeId;
    const form = document.getElementById('theme-edit-form');
    const remoteWorkspacePage = document.getElementById('remote-workspace-picker');
    if (remoteWorkspacePage) {
      remoteWorkspacePage.style.display = 'none';
    }
    this.hideWorkspaceOverviewList();
    form.style.display = 'flex';
    this.currentWorkspaceTab = 'basic';
    this.switchWorkspaceDetailTab('basic');

    // Reset form
    document.getElementById('theme-name-input').value = '';
    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
    document.querySelector('.color-option[data-type="default"]')?.classList.add('selected');
    this.tempBgImageFile = null;
    this.showPreviewBg(null);
    this.setShortcutOpenMode('new-tab');
    this.setWorkspaceViewMode('grid');
    this.setWorkspaceDisplayMode('standard');
    document.getElementById('bg-opacity-slider').value = 30;
    document.getElementById('bg-opacity-value').textContent = '30%';

    // Populate if editing
    if (themeId) {
      const theme = window.unifiedDataManager.appData.themes[themeId];
      if (theme) {
        document.getElementById('theme-name-input').value = theme.themeName;
        document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.color-option[data-type="${theme.themeType || 'default'}"]`)?.classList.add('selected');

        if (theme.bgImageUrl) {
          this.showPreviewBg(theme.bgImageUrl);
        }
        if (theme.bgOpacity !== undefined) {
          document.getElementById('bg-opacity-slider').value = theme.bgOpacity;
          document.getElementById('bg-opacity-value').textContent = `${theme.bgOpacity}%`;
        }

        document.getElementById('bg-setting-group').style.display =
          ((theme.type === 'supabase' || theme.type === 'cloudflare') && theme.syncStatus !== 'missing_remote') ? 'block' : 'none';
      }
    } else {
      document.getElementById('bg-setting-group').style.display = 'none';
    }

    this.loadWorkspaceBasicSettings(themeId).catch(console.error);
    this.refreshWorkspaceDetailUI().catch(console.error);
  }

  closeThemeForm() {
    document.getElementById('theme-edit-form').style.display = 'none';
    this.showWorkspaceOverviewList();
    this.currentWorkspaceTab = 'basic';
    this.switchWorkspaceDetailTab('basic');
    this.editingThemeId = null;
  }

  async refreshWorkspaceDetailUI() {
    const form = document.getElementById('theme-edit-form');
    if (!form || form.style.display === 'none') {
      return;
    }

    const currentThemeId = window.unifiedDataManager.appData.currentThemeId;
    const workspace = this.editingThemeId
      ? window.unifiedDataManager.appData.themes[this.editingThemeId]
      : null;
    const isExistingWorkspace = !!workspace;
    const isCurrentWorkspace = !!workspace && workspace.themeId === currentThemeId;
    const cfConfig = this.getCloudflareSyncConfig();
    const sbConfig = this.getSupabaseSyncConfig();
    const [cfSetupState, sbSetupState] = await Promise.all([
      window.cloudflareResourceManager?.getSetupState
        ? window.cloudflareResourceManager.getSetupState().catch(() => null)
        : Promise.resolve(null),
      window.supabaseResourceManager?.getSetupState
        ? window.supabaseResourceManager.getSetupState().catch(() => null)
        : Promise.resolve(null)
    ]);
    const cfProfile = cfSetupState?.profile || null;
    const sbProfile = sbSetupState?.profile || null;
    const cfFlowMode = this.getCloudflareResourceMode(cfSetupState?.preferences || null);
    const sbFlowMode = this.getSupabaseFlowMode(sbProfile);
    const cfSetup = this.resolveCloudflareSetupState({ profile: cfProfile, config: cfConfig, flowMode: cfFlowMode });
    const sbSetup = this.resolveSupabaseSetupState({ profile: sbProfile, config: sbConfig, flowMode: sbFlowMode });

    const title = document.getElementById('workspace-detail-title');
    const desc = document.getElementById('workspace-detail-desc');
    const eyebrow = document.getElementById('workspace-detail-eyebrow');
    const badge = document.getElementById('workspace-detail-badge');
    const indicator = document.getElementById('workspace-detail-indicator');
    const switchBtn = document.getElementById('switch-workspace-btn');
    const inactiveNote = document.getElementById('workspace-sync-inactive-note');
    const syncTitle = document.getElementById('workspace-sync-title');
    const syncDesc = document.getElementById('workspace-sync-desc');
    const dataNote = document.getElementById('workspace-data-note');
    const manualBtn = document.getElementById('manual-sync-btn');
    const disableBtn = document.getElementById('workspace-disable-sync-btn');
    const cfEnableBtn = document.getElementById('cf-enable-btn');
    const sbEnableBtn = document.getElementById('sb-enable-btn');
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const clearDataBtn = document.getElementById('clear-data-btn');
    const bgSettingGroup = document.getElementById('bg-setting-group');
    const saveBtn = document.getElementById('save-theme-btn');

    const applyBadge = (element, state, text) => {
      if (!element) {
        return;
      }

      element.classList.remove('is-ready', 'is-error', 'is-idle', 'is-pending');
      element.textContent = text;
      element.classList.add(state);
    };

    const cfStatusMeta = this.getUnifiedSetupStatusMeta(cfSetup.status);
    const sbStatusMeta = this.getUnifiedSetupStatusMeta(sbSetup.status);
    const syncModeMap = {
      chrome: '本地存储',
      cloudflare: 'Cloudflare 同步',
      supabase: 'Supabase 同步'
    };
    const syncStatus = workspace.syncStatus || (workspace.type === 'chrome' ? 'local' : 'ok');
    const syncStatusLabel = syncStatus === 'missing_remote'
      ? '云端缺失待处理'
      : (syncStatus === 'detached' ? '已转本地' : '');
    const colorModeMap = {
      default: '浅色风格',
      dark: '深色风格',
      blue: '蓝色风格',
      green: '绿色风格',
      purple: '紫色风格',
      pink: '粉色风格'
    };

    if (eyebrow) {
      eyebrow.textContent = isExistingWorkspace ? '编辑工作空间' : '新建工作空间';
    }

    if (!isExistingWorkspace) {
      title.textContent = '';
      title.hidden = true;
      desc.textContent = '先保存工作空间，再配置同步和数据。';
      desc.hidden = false;
      if (indicator) {
        indicator.classList.remove('active');
      }
      applyBadge(badge, 'is-idle', '未保存');
      switchBtn.style.display = 'none';
      inactiveNote.style.display = 'none';
      syncTitle.textContent = '请先保存工作空间';
      syncDesc.textContent = '保存后即可选择 Cloudflare 或 Supabase 连接。';
      dataNote.textContent = '保存后才能导入、导出或清空数据。';
      bgSettingGroup.style.display = 'none';

      [manualBtn, disableBtn, cfEnableBtn, sbEnableBtn, exportBtn, importBtn, clearDataBtn].forEach((button) => {
        if (button) {
          button.disabled = true;
        }
      });
      if (saveBtn) {
        saveBtn.disabled = false;
      }
      if (manualBtn) {
        manualBtn.style.display = 'none';
      }
      if (disableBtn) {
        disableBtn.style.display = 'none';
      }

      applyBadge(document.getElementById('workspace-local-status'), 'is-idle', '保存后可用');
      applyBadge(document.getElementById('workspace-cf-status'), cfStatusMeta.badgeClass, cfStatusMeta.label);
      applyBadge(document.getElementById('workspace-sb-status'), sbStatusMeta.badgeClass, sbStatusMeta.label);
      return;
    }

    title.textContent = '';
    title.hidden = true;
    if (indicator) {
      indicator.classList.toggle('active', isCurrentWorkspace);
    }
    desc.textContent = isCurrentWorkspace
      ? `${workspace.themeName || '未命名工作空间'} · ${syncModeMap[workspace.type] || '本地存储'} · ${colorModeMap[workspace.themeType] || '默认风格'}${syncStatusLabel ? ` · ${syncStatusLabel}` : ''}`
      : `${workspace.themeName || '未命名工作空间'} · ${syncModeMap[workspace.type] || '本地存储'} · ${colorModeMap[workspace.themeType] || '默认风格'}${syncStatusLabel ? ` · ${syncStatusLabel}` : ''} · 需先切换后再管理同步和数据`;
    desc.hidden = false;

    applyBadge(badge, isCurrentWorkspace ? 'is-ready' : 'is-pending', isCurrentWorkspace ? '当前使用中' : '需先切换');

    if (switchBtn) {
      switchBtn.style.display = isCurrentWorkspace ? 'none' : 'inline-flex';
      switchBtn.textContent = '切换到该工作空间';
    }

    if (inactiveNote) {
      inactiveNote.style.display = isCurrentWorkspace ? 'none' : 'block';
      inactiveNote.textContent = syncStatus === 'missing_remote'
        ? '这个工作空间处于云端缺失待处理状态，当前不能切换到它。请先到“从云端导入”里选择恢复到云端、转成本地空间，或从本机移除。'
        : '当前不是这个工作空间。你仍然可以修改基础设置，但云同步和数据管理需要先切换过去。';
    }

    if (bgSettingGroup) {
      bgSettingGroup.style.display = (workspace.type === 'supabase' || workspace.type === 'cloudflare') && syncStatus !== 'missing_remote' ? 'block' : 'none';
    }

    if (syncStatus === 'missing_remote') {
      syncTitle.textContent = '云端副本已缺失';
      syncDesc.textContent = isCurrentWorkspace
        ? '当前仍在使用本机副本，但云端副本已缺失。请到“从云端导入”处理。'
        : '该工作空间待处理，暂时不能切换。请到“从云端导入”处理。';
    } else if (workspace.type === 'cloudflare') {
      syncTitle.textContent = '已启用 Cloudflare 同步';
      syncDesc.textContent = 'Cloudflare 与 Supabase 仅支持二选一。';
    } else if (workspace.type === 'supabase') {
      syncTitle.textContent = '已启用 Supabase 同步';
      syncDesc.textContent = 'Cloudflare 与 Supabase 仅支持二选一。';
    } else {
      syncTitle.textContent = '当前使用本地存储';
      syncDesc.textContent = '可在下方选择云端连接。';
    }

    dataNote.textContent = syncStatus === 'missing_remote'
      ? '当前为云端缺失状态；数据操作仅影响本机。'
      : (isCurrentWorkspace
        ? '管理当前工作空间的导入、导出和清空。'
        : '要管理这个工作空间的数据，请先切换到它。');

    applyBadge(
      document.getElementById('workspace-local-status'),
      workspace.type === 'chrome' || syncStatus === 'missing_remote' ? 'is-ready' : 'is-idle',
      syncStatus === 'missing_remote' ? '缺失态回退' : (workspace.type === 'chrome' ? '当前模式' : '可切换')
    );
    applyBadge(document.getElementById('workspace-cf-status'), cfStatusMeta.badgeClass, cfStatusMeta.label);
    applyBadge(document.getElementById('workspace-sb-status'), sbStatusMeta.badgeClass, sbStatusMeta.label);

    const cfDesc = document.getElementById('workspace-cf-desc');
    const sbDesc = document.getElementById('workspace-sb-desc');
    if (cfDesc) {
      if (cfSetup.status === 'configured') {
        cfDesc.textContent = '已配置全局 Cloudflare 连接。';
      } else if (cfSetup.status === 'pending' || cfSetup.status === 'error') {
        cfDesc.textContent = cfSetup.text;
      } else {
        cfDesc.textContent = '先准备 Cloudflare Worker。';
      }
    }
    if (sbDesc) {
      if (sbSetup.status === 'configured') {
        sbDesc.textContent = '已配置全局 Supabase 连接。';
      } else if (sbSetup.status === 'pending' || sbSetup.status === 'error') {
        sbDesc.textContent = sbSetup.text;
      } else {
        sbDesc.textContent = '先准备 Project URL 和 API Key。';
      }
    }

    const canOperateWorkspace = isCurrentWorkspace;
    if (manualBtn) {
      manualBtn.style.display = canOperateWorkspace && workspace.type !== 'chrome' && syncStatus !== 'missing_remote' ? 'inline-flex' : 'none';
      manualBtn.disabled = !canOperateWorkspace || workspace.type === 'chrome' || syncStatus === 'missing_remote';
    }
    if (disableBtn) {
      disableBtn.style.display = canOperateWorkspace && workspace.type !== 'chrome' && syncStatus !== 'missing_remote' ? 'inline-flex' : 'none';
      disableBtn.disabled = !canOperateWorkspace || workspace.type === 'chrome' || syncStatus === 'missing_remote';
    }
    if (cfEnableBtn) {
      cfEnableBtn.disabled = !canOperateWorkspace || !cfSetup.canEnable || workspace.type === 'supabase' || syncStatus === 'missing_remote';
      cfEnableBtn.textContent = workspace.type === 'cloudflare' ? '当前已启用' : '启用同步';
    }
    if (sbEnableBtn) {
      sbEnableBtn.disabled = !canOperateWorkspace || !sbSetup.canEnable || workspace.type === 'cloudflare' || syncStatus === 'missing_remote';
      sbEnableBtn.textContent = workspace.type === 'supabase' ? '当前已启用' : '启用同步';
    }
    if (exportBtn) {
      exportBtn.disabled = !canOperateWorkspace;
    }
    if (importBtn) {
      importBtn.disabled = !canOperateWorkspace;
    }
    if (clearDataBtn) {
      clearDataBtn.disabled = !canOperateWorkspace;
    }
    if (saveBtn) {
      saveBtn.disabled = syncStatus === 'missing_remote';
    }
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

  getShortcutOpenMode() {
    return document.querySelector('input[name="shortcut-open-mode"]:checked')?.value || 'new-tab';
  }

  setShortcutOpenMode(mode = 'new-tab') {
    const normalizedMode = ['current-tab', 'new-tab'].includes(mode) ? mode : 'new-tab';
    const targetInput = document.querySelector(`input[name="shortcut-open-mode"][value="${normalizedMode}"]`);

    if (targetInput) {
      targetInput.checked = true;
    }
  }

  getFaviconSource() {
    return document.querySelector('input[name="favicon-source"]:checked')?.value || 'browser-first';
  }

  setFaviconSource(source = 'browser-first') {
    const normalizedSource = ['browser-first', 'online-first'].includes(source) ? source : 'browser-first';
    const targetInput = document.querySelector(`input[name="favicon-source"][value="${normalizedSource}"]`);

    if (targetInput) {
      targetInput.checked = true;
    }
  }

  getWorkspaceViewMode() {
    return document.querySelector('input[name="workspace-view-mode"]:checked')?.value || 'grid';
  }

  setWorkspaceViewMode(mode = 'grid') {
    const normalizedMode = ['grid', 'list'].includes(mode) ? mode : 'grid';
    const targetInput = document.querySelector(`input[name="workspace-view-mode"][value="${normalizedMode}"]`);

    if (targetInput) {
      targetInput.checked = true;
    }
  }

  getWorkspaceDisplayMode() {
    return document.querySelector('input[name="workspace-display-mode"]:checked')?.value || 'standard';
  }

  setWorkspaceDisplayMode(mode = 'standard') {
    const normalizedMode = ['standard', 'focus', 'wallpaper'].includes(mode) ? mode : 'standard';
    const targetInput = document.querySelector(`input[name="workspace-display-mode"][value="${normalizedMode}"]`);

    if (targetInput) {
      targetInput.checked = true;
    }
  }

  async loadWorkspaceBasicSettings(themeId = null) {
    const requestedThemeId = themeId || null;
    this.setShortcutOpenMode('new-tab');
    this.setFaviconSource('browser-first');
    this.setWorkspaceViewMode('grid');
    this.setWorkspaceDisplayMode('standard');

    if (!requestedThemeId) {
      return;
    }

    const theme = window.unifiedDataManager?.appData?.themes?.[requestedThemeId];
    if (!theme) {
      return;
    }

    try {
      const themeData = requestedThemeId === window.unifiedDataManager.appData.currentThemeId
        ? (window.unifiedDataManager.getCurrentConfigData() || await window.unifiedDataManager.loadCurrentConfigData())
        : await window.unifiedDataManager.resolveThemeData(theme, {
          preferCache: true,
          useDefaultFallback: true
        });

      if (this.editingThemeId !== requestedThemeId) {
        return;
      }

      const settings = window.unifiedDataManager.normalizeSettings(themeData?.settings);
      this.setShortcutOpenMode(settings.shortcutOpenMode);
      this.setFaviconSource(settings.faviconSource);
      this.setWorkspaceViewMode(settings.viewMode);
      this.setWorkspaceDisplayMode(settings.displayMode);
    } catch (error) {
      console.warn('加载工作空间基础设置失败:', error);

      if (this.editingThemeId === requestedThemeId) {
        this.setShortcutOpenMode('new-tab');
        this.setFaviconSource('browser-first');
        this.setWorkspaceViewMode('grid');
        this.setWorkspaceDisplayMode('standard');
      }
    }
  }
  
  async saveThemeForm() {
    const name = document.getElementById('theme-name-input').value.trim() || '未命名主题';
    const typeOpt = document.querySelector('.color-option.selected');
    const themeType = typeOpt ? typeOpt.getAttribute('data-type') : 'default';
    const opacity = parseInt(document.getElementById('bg-opacity-slider').value) || 30;
    const shortcutOpenMode = this.getShortcutOpenMode();
    const faviconSource = this.getFaviconSource();
    const viewMode = this.getWorkspaceViewMode();
    const displayMode = this.getWorkspaceDisplayMode();
    const previewImage = document.getElementById('bg-preview-img');
    const hasPreviewImage = !!previewImage.getAttribute('src');
    let savedThemeId = this.editingThemeId;
    
    try {
      if (this.editingThemeId) {
        const theme = window.unifiedDataManager.appData.themes[this.editingThemeId];
        if (this.isMissingRemoteWorkspace(theme)) {
          throw new Error('这个工作空间处于云端缺失待处理状态，不能继续编辑保存，请先恢复到云端、转成本地空间，或从本机移除');
        }
        const themeUpdates = {
          themeName: name,
          themeType: themeType,
          bgOpacity: opacity
        };

        if (theme.type !== 'chrome') {
          await window.unifiedDataManager.initCloudClients();
        }
        
        if (this.tempBgImageFile && theme.type !== 'chrome') {
          const provider = window.unifiedDataManager.getThemeProvider(theme);
          const capabilities = provider.getCapabilities ? provider.getCapabilities() : {};

          if (!capabilities.fileStorage) {
            throw new Error(`${theme.type} 当前不支持背景图片存储`);
          }

          const res = await provider.uploadFile(this.tempBgImageFile);
          themeUpdates.bgImageUrl = res.url;
          themeUpdates.bgImagePath = res.path;
        } else if (!this.tempBgImageFile && !hasPreviewImage) {
          if (theme.bgImagePath) {
            if (theme.type !== 'chrome') {
              const provider = window.unifiedDataManager.getThemeProvider(theme);
              provider.deleteFile(theme.bgImagePath).catch(console.warn);
            }
          }
          themeUpdates.bgImageUrl = null;
          themeUpdates.bgImagePath = null;
        }

        await window.unifiedDataManager.updateThemeMetadata(this.editingThemeId, themeUpdates);
        await window.unifiedDataManager.updateThemeSettings(this.editingThemeId, {
          shortcutOpenMode,
          faviconSource,
          viewMode,
          displayMode
        });
      } else {
        const newTheme = await window.unifiedDataManager.createLocalTheme(name, themeType, opacity);
        savedThemeId = newTheme.themeId;
        await window.unifiedDataManager.updateThemeSettings(savedThemeId, {
          shortcutOpenMode,
          faviconSource,
          viewMode,
          displayMode
        });
      }

      window.storageManager?.updateDataFromUnified?.();
      
      this.showMessage('工作空间已保存', 'success');
      this.closeThemeForm();
      this.refreshThemesList();
      
      // Update UI if we edited current theme
      if (savedThemeId === window.unifiedDataManager.appData.currentThemeId) {
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

  async copyTextToClipboard(text, successMessage) {
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

  async copyBundledFileText(path, successMessage) {
    const resourceUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : path;
    const response = await fetch(resourceUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`读取文件失败：${path}`);
    }

    const text = await response.text();
    await this.copyTextToClipboard(text, successMessage);
  }

  async completeCloudflareSyncSetup(config, suggestedThemeName = '') {
    const themeName = suggestedThemeName.trim();

    if (window.cloudflareResourceManager?.saveExistingResourceProfile) {
      await window.cloudflareResourceManager.saveExistingResourceProfile({
        source: config.source || 'sync',
        accountId: config.accountId || '',
        baseName: config.baseName || '',
        workerName: config.workerName || document.getElementById('cf-worker-name')?.value.trim() || '',
        workerUrl: config.workerUrl,
        accessToken: config.accessToken || '',
        databaseId: config.databaseId || document.getElementById('cf-database-id')?.value.trim() || '',
        databaseName: config.databaseName || document.getElementById('cf-database-name')?.value.trim() || '',
        bucketName: config.bucketName || document.getElementById('cf-bucket-name')?.value.trim() || '',
        initialized: typeof config.initialized === 'boolean' ? config.initialized : undefined,
        setupStatus: 'configured',
        setupStatusText: ''
      });
    }

    await window.syncManager.enableCloudflareSync({
      workerUrl: config.workerUrl,
      accessToken: config.accessToken || ''
    }, config.themeId, themeName);

    document.getElementById('cf-worker-url').value = config.workerUrl || '';
    document.getElementById('cf-access-token').value = config.accessToken || '';

    this.invalidateRemoteWorkspaceDiscovery('cloudflare');
    this.refreshSyncUI();
    await this.refreshCloudflareSetupUI();
    this.refreshThemesList();
    window.loadThemeSettings();
  }

  async completeSupabaseSyncSetup(config, suggestedThemeName = '') {
    const themeName = suggestedThemeName.trim();

    if (window.supabaseResourceManager?.saveExistingProjectProfile) {
      await this.saveExistingSupabaseProjectProfile(false, {
        url: config.url,
        lastConnectedAt: new Date().toISOString(),
        setupStatus: 'configured',
        setupStatusText: ''
      });

      const schemaReady = await window.supabaseResourceManager.detectSchemaReady({
        url: config.url,
        anonKey: config.anonKey
      });

      if (!schemaReady) {
        throw new Error('Supabase 项目尚未初始化，或当前 API Key 还没有访问 Card Tab 数据表 / Storage 的权限');
      }

      await this.persistSupabaseConnectionState({
        initialized: true,
        lastConnectedAt: new Date().toISOString()
      });
    }

    await window.syncManager.enableSupabaseSync({
      url: config.url,
      anonKey: config.anonKey,
      bucketName: config.bucketName || 'backgrounds'
    }, config.themeId, themeName);

    document.getElementById('sb-url').value = config.url || '';
    document.getElementById('sb-key').value = config.anonKey || '';

    this.invalidateRemoteWorkspaceDiscovery('supabase');
    this.refreshSyncUI();
    await this.refreshSupabaseSetupUI();
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

  getCloudflareSyncConfig() {
    const formData = this.getCloudflareResourceFormData();
    return {
      workerUrl: formData.workerUrl,
      accessToken: formData.accessToken
    };
  }

  getSupabaseResourceFormData() {
    return {
      url: document.getElementById('sb-url')?.value.trim() || '',
      anonKey: document.getElementById('sb-key')?.value.trim() || '',
      projectRef: document.getElementById('sb-project-ref')?.value.trim() || '',
      bucketName: document.getElementById('sb-bucket-name')?.value.trim() || '',
      serviceRoleKey: document.getElementById('sb-service-role-key')?.value.trim() || '',
      managementToken: document.getElementById('sb-management-token')?.value.trim() || '',
      saveAdminSecrets: !!document.getElementById('sb-save-admin-secrets')?.checked
    };
  }

  getSupabaseSyncConfig() {
    const formData = this.getSupabaseResourceFormData();
    return {
      url: formData.url,
      anonKey: formData.anonKey,
      bucketName: formData.bucketName || 'backgrounds'
    };
  }

  getSupabaseInitializationConfig() {
    const formData = this.getSupabaseResourceFormData();
    return {
      url: formData.url,
      anonKey: formData.anonKey,
      projectRef: formData.projectRef,
      bucketName: formData.bucketName,
      serviceRoleKey: formData.serviceRoleKey,
      managementToken: formData.managementToken,
      saveAdminSecrets: formData.saveAdminSecrets
    };
  }

  async syncProviderConfigCache(provider, config) {
    if (!window.unifiedDataManager?.saveProviderConfig || !config) {
      return null;
    }

    const normalizedConfig = provider === 'supabase'
      ? {
          url: String(config.url || '').trim(),
          anonKey: String(config.anonKey || '').trim(),
          bucketName: String(config.bucketName || 'backgrounds').trim() || 'backgrounds'
        }
      : {
          workerUrl: String(config.workerUrl || '').trim(),
          accessToken: String(config.accessToken || '').trim()
        };

    if (!window.unifiedDataManager.hasValidProviderConfig(provider, normalizedConfig)) {
      return null;
    }

    return window.unifiedDataManager.saveProviderConfig(provider, normalizedConfig);
  }

  async syncSupabaseAdminSecretsCache(formData = null) {
    if (!window.supabaseResourceManager) {
      return null;
    }

    const nextFormData = formData || this.getSupabaseResourceFormData();
    await window.supabaseResourceManager.savePreferences({
      saveAdminSecrets: !!nextFormData.saveAdminSecrets
    });
    await window.supabaseResourceManager.setSavedAdminSecrets({
      serviceRoleKey: nextFormData.serviceRoleKey,
      managementToken: nextFormData.managementToken
    }, !!nextFormData.saveAdminSecrets);
    return nextFormData;
  }

  async ensureSupabaseClient(config = null, options = {}) {
    const targetConfig = config || this.getSupabaseSyncConfig();
    if (!targetConfig.url || !targetConfig.anonKey) {
      throw new Error('请先填写 Project URL 和 API Key（publishable / anon）');
    }

    return window.unifiedDataManager.ensureProviderClient('supabase', targetConfig, options);
  }

  async persistCloudflareConnectionState(overrides = {}) {
    return this.saveExistingCloudflareResourceProfile(false, {
      ...overrides,
      updatedAt: new Date().toISOString()
    });
  }

  async persistSupabaseConnectionState(overrides = {}) {
    return this.saveExistingSupabaseProjectProfile(false, {
      ...overrides,
      updatedAt: new Date().toISOString()
    });
  }

  getDefaultSupabaseResourceNames() {
    return window.supabaseResourceManager?.getDefaultResourceNames?.() || {
      bucketName: 'backgrounds'
    };
  }

  getSupabaseFlowMode(profile = null) {
    if (this.supabaseFlowModeOverride === 'setup' || this.supabaseFlowModeOverride === 'existing') {
      return this.supabaseFlowModeOverride;
    }

    return 'existing';
  }

  updateSupabaseStepIndicator(currentStep = 1) {
    document.querySelectorAll('[data-sb-step]').forEach((element) => {
      const step = Number(element.dataset.sbStep || '0');
      element.classList.toggle('is-current', step === currentStep);
      element.classList.toggle('is-completed', step > 0 && step < currentStep);
    });
  }

  applySupabaseFlowMode(mode, { isInitialized = false, currentStep = 1 } = {}) {
    const resolvedMode = mode === 'existing' ? 'existing' : 'setup';
    const setupRadio = document.getElementById('sb-project-state-setup');
    const existingRadio = document.getElementById('sb-project-state-existing');
    const modeText = document.getElementById('sb-flow-mode-text');
    const initSection = document.getElementById('sb-init-section');
    const initModeHint = document.getElementById('sb-init-mode-hint');

    if (setupRadio) {
      setupRadio.checked = resolvedMode === 'setup';
    }
    if (existingRadio) {
      existingRadio.checked = resolvedMode === 'existing';
    }
    if (initSection) {
      initSection.hidden = resolvedMode !== 'setup';
    }
    if (modeText) {
      if (resolvedMode === 'setup') {
        modeText.textContent = '还没建好就选“还没有，帮我初始化”。';
      } else if (isInitialized) {
        modeText.textContent = '已建好，直接测试连接。';
      } else {
        modeText.textContent = '还没建好就选“还没有，帮我初始化”。';
      }
    }
    if (initModeHint) {
      initModeHint.textContent = resolvedMode === 'setup'
        ? '填 PAT 和 Service Role Key，然后点“初始化资源”。'
        : '如果其实还没建好资源，再切回“还没有，帮我初始化”。';
    }

    this.updateSupabaseStepIndicator(currentStep);
  }

  normalizeSetupStatus(status = '') {
    if (status === 'configured' || status === 'ready') {
      return 'configured';
    }

    if (status === 'pending') {
      return 'pending';
    }

    if (status === 'error') {
      return 'error';
    }

    return 'missing';
  }

  getUnifiedSetupStatusMeta(state = 'missing') {
    const normalizedState = this.normalizeSetupStatus(state);

    if (normalizedState === 'configured') {
      return { badgeClass: 'is-ready', label: '已配置' };
    }

    if (normalizedState === 'pending') {
      return { badgeClass: 'is-pending', label: '待初始化' };
    }

    if (normalizedState === 'error') {
      return { badgeClass: 'is-error', label: '异常' };
    }

    return { badgeClass: 'is-idle', label: '未创建' };
  }

  isCloudflareSchemaMissingError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('数据表不存在')
      || message.includes('no such table')
      || message.includes('card_tab_data');
  }

  isSupabaseSchemaMissingError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('数据表不存在')
      || message.includes('请先初始化资源')
      || message.includes('relation')
      || message.includes('42p01')
      || message.includes('pgrst116');
  }

  resolveCloudflareSetupState(options = {}) {
    const { profile = null, config = null, flowMode = 'existing' } = options;
    const workerUrl = String(config?.workerUrl || profile?.workerUrl || '').trim();
    const persistedStatus = this.normalizeSetupStatus(profile?.setupStatus || '');
    const isCreateMode = flowMode === 'create' || profile?.source === 'auto';
    const isInitialized = !!profile?.initialized || persistedStatus === 'configured';

    if (!workerUrl) {
      return {
        status: 'missing',
        text: flowMode === 'create' ? '下一步：先创建 Worker。' : '',
        hasWorkerUrl: false,
        isInitialized: false,
        canEnable: false,
        currentStep: 1
      };
    }

    if (persistedStatus === 'error') {
      return {
        status: 'error',
        text: String(profile?.setupStatusText || '最近一次检测失败，请修复后重试。').trim(),
        hasWorkerUrl: true,
        isInitialized,
        canEnable: false,
        currentStep: isCreateMode && !isInitialized ? 2 : 3
      };
    }

    if (isInitialized) {
      return {
        status: 'configured',
        text: '已检测到数据表，可直接启用同步。',
        hasWorkerUrl: true,
        isInitialized: true,
        canEnable: true,
        currentStep: 3
      };
    }

    return {
      status: 'pending',
      text: isCreateMode
        ? '连接已可用，下一步：初始化数据库。'
        : '连接资料已填写。请先点“检测状态”或直接初始化数据库。',
      hasWorkerUrl: true,
      isInitialized: false,
      canEnable: false,
      currentStep: isCreateMode ? 2 : 2
    };
  }

  resolveSupabaseSetupState(options = {}) {
    const { profile = null, config = null, flowMode = 'existing' } = options;
    const url = String(config?.url || profile?.url || '').trim();
    const anonKey = String(config?.anonKey || profile?.anonKey || '').trim();
    const hasBasicConfig = !!url && !!anonKey;
    const persistedStatus = this.normalizeSetupStatus(profile?.setupStatus || '');
    const isInitialized = !!profile?.initialized || persistedStatus === 'configured';

    if (!hasBasicConfig) {
      return {
        status: 'missing',
        text: '',
        hasBasicConfig: false,
        isInitialized: false,
        canEnable: false,
        currentStep: 1
      };
    }

    if (persistedStatus === 'error') {
      return {
        status: 'error',
        text: String(profile?.setupStatusText || '最近一次检测失败，请修复后重试。').trim(),
        hasBasicConfig: true,
        isInitialized,
        canEnable: false,
        currentStep: flowMode === 'setup' && !isInitialized ? 2 : 3
      };
    }

    if (isInitialized) {
      return {
        status: 'configured',
        text: '已检测到数据表，可直接启用同步。',
        hasBasicConfig: true,
        isInitialized: true,
        canEnable: true,
        currentStep: 3
      };
    }

    return {
      status: 'pending',
      text: flowMode === 'setup'
        ? '连接已可用，下一步：初始化资源。'
        : '连接资料已填写。请先点“检测状态”确认数据表状态。',
      hasBasicConfig: true,
      isInitialized: false,
      canEnable: false,
      currentStep: flowMode === 'setup' ? 2 : 2
    };
  }

  async detectCloudflareSetupStatus(showMessage = true) {
    const config = this.getCloudflareSyncConfig();
    if (!config.workerUrl) {
      throw new Error('请先填写 Worker API URL');
    }

    const profile = await this.saveExistingCloudflareResourceProfile(false);
    const now = new Date().toISOString();

    try {
      await window.cloudflareResourceManager.testWorkerConnection(profile);
    } catch (error) {
      await this.persistCloudflareConnectionState({
        initialized: false,
        setupStatus: 'error',
        setupStatusText: `检测失败：${error.message}`
      });
      await this.refreshCloudflareSetupUI();
      this.refreshSyncUI();
      if (showMessage) {
        this.showMessage('检测失败: ' + error.message, 'error');
      }
      return { status: 'error', error };
    }

    try {
      const tempClient = new CloudflareClient();
      await tempClient.initialize({
        workerUrl: profile.workerUrl,
        accessToken: profile.accessToken || ''
      }, false);
      await tempClient.testSchemaAccess();

      await this.persistCloudflareConnectionState({
        initialized: true,
        setupStatus: 'configured',
        setupStatusText: '',
        lastConnectedAt: now
      });
      await this.refreshCloudflareSetupUI();
      this.refreshSyncUI();
      if (showMessage) {
        this.showMessage('检测完成：当前状态为已配置。下一步到“工作空间”里为目标工作空间启用同步。', 'success');
      }
      return { status: 'configured' };
    } catch (error) {
      const isSchemaMissing = this.isCloudflareSchemaMissingError(error);
      await this.persistCloudflareConnectionState({
        initialized: false,
        setupStatus: isSchemaMissing ? 'pending' : 'error',
        setupStatusText: isSchemaMissing
          ? '连接已可用，但未检测到数据表，请先初始化数据库。'
          : `检测失败：${error.message}`,
        lastConnectedAt: now
      });
      await this.refreshCloudflareSetupUI();
      this.refreshSyncUI();
      if (showMessage) {
        this.showMessage(
          isSchemaMissing ? '检测完成：当前状态为待初始化' : ('检测失败: ' + error.message),
          isSchemaMissing ? 'info' : 'error'
        );
      }
      return { status: isSchemaMissing ? 'pending' : 'error', error };
    }
  }

  async detectSupabaseSetupStatus(showMessage = true) {
    await this.syncSupabaseAdminSecretsCache();

    const config = this.getSupabaseSyncConfig();
    if (!config.url || !config.anonKey) {
      throw new Error('请先填写完整的 Supabase 连接信息');
    }

    await this.saveExistingSupabaseProjectProfile(false);
    const now = new Date().toISOString();
    if (typeof SupabaseClient === 'undefined') {
      throw new Error('SupabaseClient 未加载');
    }

    const tempClient = SupabaseClient.getSharedInstance();

    try {
      await tempClient.testProjectAccessWithConfig(config);
    } catch (error) {
      await this.persistSupabaseConnectionState({
        initialized: false,
        setupStatus: 'error',
        setupStatusText: `检测失败：${error.message}`
      });
      await this.refreshSupabaseSetupUI();
      this.refreshSyncUI();
      if (showMessage) {
        this.showMessage('检测失败: ' + error.message, 'error');
      }
      return { status: 'error', error };
    }

    try {
      await tempClient.testSchemaAccessWithConfig(config);
      await this.persistSupabaseConnectionState({
        initialized: true,
        setupStatus: 'configured',
        setupStatusText: '',
        lastConnectedAt: now
      });
      this.supabaseFlowModeOverride = 'existing';
      await this.refreshSupabaseSetupUI();
      this.refreshSyncUI();
      if (showMessage) {
        this.showMessage('检测完成：当前状态为已配置。下一步到“工作空间”里为目标工作空间启用同步。', 'success');
      }
      return { status: 'configured' };
    } catch (error) {
      const isSchemaMissing = this.isSupabaseSchemaMissingError(error);
      await this.persistSupabaseConnectionState({
        initialized: false,
        setupStatus: isSchemaMissing ? 'pending' : 'error',
        setupStatusText: isSchemaMissing
          ? '连接已可用，但未检测到数据表，请先初始化资源。'
          : `检测失败：${error.message}`,
        lastConnectedAt: now
      });
      await this.refreshSupabaseSetupUI();
      this.refreshSyncUI();
      if (showMessage) {
        this.showMessage(
          isSchemaMissing ? '检测完成：当前状态为待初始化' : ('检测失败: ' + error.message),
          isSchemaMissing ? 'info' : 'error'
        );
      }
      return { status: isSchemaMissing ? 'pending' : 'error', error };
    }
  }

  updateSupabaseSetupStatus(state, text) {
    const badge = document.getElementById('sb-setup-badge');
    const statusText = document.getElementById('sb-setup-status-text');
    if (!badge || !statusText) {
      return;
    }

    const meta = this.getUnifiedSetupStatusMeta(state);
    badge.classList.remove('is-ready', 'is-error', 'is-idle', 'is-pending');
    badge.textContent = meta.label;
    badge.classList.add(meta.badgeClass);

    statusText.textContent = text || '';
    statusText.hidden = !text;
  }

  async saveExistingSupabaseProjectProfile(showMessage = false, overrides = {}) {
    if (!window.supabaseResourceManager) {
      throw new Error('Supabase 初始化管理器未加载');
    }

    const formData = this.getSupabaseResourceFormData();
    const existingProfile = await window.supabaseResourceManager.getProfile();
    const flowMode = this.getSupabaseFlowMode(existingProfile);
    const hasStatusOverride = Object.prototype.hasOwnProperty.call(overrides, 'setupStatus');
    const hasStatusTextOverride = Object.prototype.hasOwnProperty.call(overrides, 'setupStatusText');
    const draftProfile = {
      ...existingProfile,
      ...formData,
      ...overrides
    };
    const resolvedState = this.resolveSupabaseSetupState({
      profile: draftProfile,
      config: {
        url: draftProfile.url,
        anonKey: draftProfile.anonKey,
        bucketName: draftProfile.bucketName
      },
      flowMode
    });
    const connectionChanged = String(existingProfile?.url || '').trim() !== String(draftProfile.url || '').trim()
      || String(existingProfile?.anonKey || '').trim() !== String(draftProfile.anonKey || '').trim();
    const nextSetupStatus = hasStatusOverride
      ? overrides.setupStatus
      : (connectionChanged
        ? ((String(draftProfile.url || '').trim() && String(draftProfile.anonKey || '').trim()) ? 'pending' : 'missing')
        : resolvedState.status);
    const nextSetupStatusText = hasStatusTextOverride
      ? overrides.setupStatusText
      : (connectionChanged ? '' : (nextSetupStatus === 'error' ? resolvedState.text : ''));
    const profile = await window.supabaseResourceManager.saveExistingProjectProfile({
      ...formData,
      ...overrides,
      setupStatus: nextSetupStatus,
      setupStatusText: nextSetupStatusText
    });

    await this.syncProviderConfigCache('supabase', {
      url: profile.url,
      anonKey: profile.anonKey,
      bucketName: profile.bucketName || formData.bucketName || 'backgrounds'
    });

    if (showMessage) {
      this.showMessage('Supabase 项目参数已保存到本地缓存', 'success');
    }

    await this.refreshSupabaseSetupUI();
    this.refreshSyncUI();
    return profile;
  }

  getDefaultCloudflareResourceNames() {
    return window.cloudflareResourceManager?.getDefaultResourceNames?.() || {
      workerName: 'card-tab-sync',
      databaseName: 'card-tab-db',
      bucketName: 'card-tab-files'
    };
  }

  getCloudflareResourceMode(preferences = null) {
    if (typeof preferences?.autoSetupEnabled === 'boolean') {
      return preferences.autoSetupEnabled ? 'create' : 'existing';
    }

    return document.querySelector('input[name="cf-resource-mode"]:checked')?.value || 'existing';
  }

  updateCloudflareStepIndicator(currentStep = 1) {
    document.querySelectorAll('[data-cf-step]').forEach((element) => {
      const step = Number(element.dataset.cfStep || '0');
      element.classList.toggle('is-current', step === currentStep);
      element.classList.toggle('is-completed', step > 0 && step < currentStep);
    });
  }

  applyCloudflareFlowMode(mode, { hasWorkerUrl = false, isInitialized = false, currentStep = 1, isCreateReady = false } = {}) {
    const resolvedMode = mode === 'create' ? 'create' : 'existing';
    const createRadio = document.getElementById('cf-resource-mode-create');
    const existingRadio = document.getElementById('cf-resource-mode-existing');
    const modeText = document.getElementById('cf-flow-mode-text');
    const createSection = document.getElementById('cf-create-section');
    const connectionSection = document.getElementById('cf-connection-section');
    const schemaSection = document.getElementById('cf-schema-section');
    const syncSection = document.getElementById('cf-sync-section');
    const createModeHint = document.getElementById('cf-create-mode-hint');
    const connectionModeHint = document.getElementById('cf-connection-mode-hint');
    const initModeHint = document.getElementById('cf-init-mode-hint');
    const syncModeHint = document.getElementById('cf-sync-mode-hint');
    const shouldShowConnectionSection = resolvedMode === 'existing' || isCreateReady;
    const shouldShowWorkerDetails = resolvedMode === 'create' ? isCreateReady : hasWorkerUrl;
    const shouldShowActionSections = resolvedMode === 'existing' || shouldShowWorkerDetails;

    if (createRadio) {
      createRadio.checked = resolvedMode === 'create';
    }
    if (existingRadio) {
      existingRadio.checked = resolvedMode === 'existing';
    }
    if (createSection) {
      createSection.hidden = resolvedMode !== 'create' || isCreateReady;
    }
    if (connectionSection) {
      connectionSection.hidden = !shouldShowConnectionSection;
    }
    if (schemaSection) {
      schemaSection.hidden = !shouldShowActionSections;
    }
    if (syncSection) {
      syncSection.hidden = !shouldShowActionSections;
    }
    if (modeText) {
      if (resolvedMode === 'create' && isCreateReady) {
        modeText.textContent = 'Worker 已创建，继续初始化数据库。';
      } else {
        modeText.textContent = resolvedMode === 'create'
          ? '还没有就选“还没有，帮我初始化”。'
          : '已有 Worker 就选“已经建好，直接连接”。';
      }
    }
    if (createModeHint) {
      createModeHint.textContent = isCreateReady
        ? 'Worker 已创建，连接信息如下。'
        : '先创建 Worker，随后会自动生成 URL。';
    }
    if (connectionModeHint) {
      if (resolvedMode === 'create') {
        connectionModeHint.textContent = 'Worker 已创建，下面是自动生成的连接信息。';
      } else if (hasWorkerUrl) {
        connectionModeHint.textContent = '连接信息已就绪，可直接检测或测试。';
      } else {
        connectionModeHint.textContent = '已有 Worker 时只需填写这 2 项。';
      }
    }
    if (initModeHint) {
      if (resolvedMode === 'existing' && !hasWorkerUrl) {
        initModeHint.textContent = '数据库未初始化时，填写 Worker URL 后即可初始化。';
      } else {
        initModeHint.textContent = isInitialized
          ? '数据库已初始化，可直接进入下一步。'
          : '拿到 Worker API URL 后，再初始化数据库。';
      }
    }
    if (syncModeHint) {
      if (resolvedMode === 'existing' && !hasWorkerUrl) {
        syncModeHint.textContent = '填好连接信息后即可检测或测试；通过后到工作空间启用。';
      } else {
        syncModeHint.textContent = isInitialized
          ? '现在可以测试连接；通过后到工作空间启用。'
          : '如果数据库已初始化，可直接测试；通过后到工作空间启用。';
      }
    }

    this.updateCloudflareStepIndicator(currentStep);
  }

  updateCloudflareSetupStatus(state, text) {
    const badge = document.getElementById('cf-setup-badge');
    const statusText = document.getElementById('cf-setup-status-text');
    if (!badge || !statusText) {
      return;
    }

    const meta = this.getUnifiedSetupStatusMeta(state);
    badge.classList.remove('is-ready', 'is-error', 'is-idle', 'is-pending');
    badge.textContent = meta.label;
    badge.classList.add(meta.badgeClass);

    statusText.textContent = text || '';
    statusText.hidden = !text;
  }

  async toggleCloudflareAutoSetup(enabled) {
    if (window.cloudflareResourceManager) {
      await window.cloudflareResourceManager.savePreferences({ autoSetupEnabled: enabled });
    }

    await this.refreshCloudflareSetupUI();
  }

  async saveExistingCloudflareResourceProfile(showMessage = false, overrides = {}) {
    if (!window.cloudflareResourceManager) {
      throw new Error('Cloudflare 初始化管理器未加载');
    }

    const formData = this.getCloudflareResourceFormData();
    const existingProfile = await window.cloudflareResourceManager.getProfile();
    const mode = this.getCloudflareResourceMode();
    const hasStatusOverride = Object.prototype.hasOwnProperty.call(overrides, 'setupStatus');
    const hasStatusTextOverride = Object.prototype.hasOwnProperty.call(overrides, 'setupStatusText');
    const nextSource = overrides.source || (mode === 'existing' ? 'manual' : existingProfile?.source || 'manual');
    const draftProfile = {
      ...existingProfile,
      ...formData,
      ...overrides,
      source: nextSource
    };
    const resolvedState = this.resolveCloudflareSetupState({
      profile: draftProfile,
      config: {
        workerUrl: draftProfile.workerUrl,
        accessToken: draftProfile.accessToken
      },
      flowMode: mode
    });
    const connectionChanged = String(existingProfile?.workerUrl || '').trim() !== String(draftProfile.workerUrl || '').trim()
      || String(existingProfile?.accessToken || '').trim() !== String(draftProfile.accessToken || '').trim();
    const nextSetupStatus = hasStatusOverride
      ? overrides.setupStatus
      : (connectionChanged
        ? (String(draftProfile.workerUrl || '').trim() ? 'pending' : 'missing')
        : resolvedState.status);
    const nextSetupStatusText = hasStatusTextOverride
      ? overrides.setupStatusText
      : (connectionChanged ? '' : (nextSetupStatus === 'error' ? resolvedState.text : ''));
    const profile = await window.cloudflareResourceManager.saveExistingResourceProfile({
      ...formData,
      ...(overrides.source ? {} : (mode === 'existing' ? { source: 'manual' } : {})),
      ...overrides,
      setupStatus: nextSetupStatus,
      setupStatusText: nextSetupStatusText
    });

    await this.syncProviderConfigCache('cloudflare', {
      workerUrl: profile.workerUrl,
      accessToken: profile.accessToken || ''
    });

    if (showMessage) {
      this.showMessage('Cloudflare 连接参数已保存到本地缓存', 'success');
    }

    await this.refreshCloudflareSetupUI();
    this.refreshSyncUI();
    return profile;
  }

  async refreshCloudflareSetupUI() {
    if (!window.cloudflareResourceManager) {
      return;
    }

    const syncStatus = window.syncManager?.getSyncStatus ? window.syncManager.getSyncStatus() : null;
    const { profile, preferences, savedApiToken } = await window.cloudflareResourceManager.getSetupState();
    const defaultNames = this.getDefaultCloudflareResourceNames();
    const flowMode = this.getCloudflareResourceMode(preferences);
    const workerUrlInput = document.getElementById('cf-worker-url');
    const accessTokenInput = document.getElementById('cf-access-token');
    const workerNameInput = document.getElementById('cf-worker-name');
    const databaseIdInput = document.getElementById('cf-database-id');
    const databaseNameInput = document.getElementById('cf-database-name');
    const bucketNameInput = document.getElementById('cf-bucket-name');
    const accountIdInput = document.getElementById('cf-account-id');
    const apiTokenInput = document.getElementById('cf-api-token');
    const createWorkerNameInput = document.getElementById('cf-create-worker-name');
    const createDatabaseNameInput = document.getElementById('cf-create-database-name');
    const createBucketNameInput = document.getElementById('cf-create-bucket-name');
    const workerAccessTokenInput = document.getElementById('cf-worker-access-token');
    const saveApiTokenCheckbox = document.getElementById('cf-save-api-token');
    const createBtn = document.getElementById('cf-create-resources-btn');
    const detectBtn = document.getElementById('cf-detect-status-btn');
    const testBtn = document.getElementById('cf-test-btn');
    const initBtn = document.getElementById('cf-init-db-btn');
    const enableBtn = document.getElementById('cf-enable-btn');
    const isEditingWorkerUrl = document.activeElement === workerUrlInput;
    const isEditingAccessToken = document.activeElement === accessTokenInput;
    const resolvedWorkerUrl = isEditingWorkerUrl
      ? (workerUrlInput?.value.trim() || '')
      : (workerUrlInput?.value.trim() || profile?.workerUrl || syncStatus?.cloudflareConfig?.workerUrl || '');
    const resolvedAccessToken = isEditingAccessToken
      ? (accessTokenInput?.value.trim() || '')
      : (accessTokenInput?.value.trim() || profile?.accessToken || syncStatus?.cloudflareConfig?.accessToken || '');
    const cfSetup = this.resolveCloudflareSetupState({
      profile,
      config: {
        workerUrl: resolvedWorkerUrl,
        accessToken: resolvedAccessToken
      },
      flowMode
    });
    const hasWorkerUrl = cfSetup.hasWorkerUrl;
    const isInitialized = cfSetup.isInitialized;
    const cfLocked = false;
    const isCreateReady = flowMode === 'create' && profile?.source === 'auto' && hasWorkerUrl;
    const hasStepOneResult = flowMode === 'create' ? isCreateReady : hasWorkerUrl;
    const currentStep = !hasStepOneResult ? 1 : cfSetup.currentStep;

    if (workerUrlInput) {
      workerUrlInput.value = resolvedWorkerUrl;
    }
    if (accessTokenInput) {
      accessTokenInput.value = resolvedAccessToken;
    }
    if (workerNameInput) {
      workerNameInput.value = profile?.workerName || '';
    }
    if (databaseIdInput) {
      databaseIdInput.value = profile?.databaseId || '';
    }
    if (databaseNameInput) {
      databaseNameInput.value = profile?.databaseName || '';
    }
    if (bucketNameInput) {
      bucketNameInput.value = profile?.bucketName || '';
    }
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

    this.applyCloudflareFlowMode(flowMode, {
      hasWorkerUrl,
      isInitialized,
      currentStep,
      isCreateReady
    });

    if (createBtn) {
      createBtn.disabled = cfLocked;
    }
    if (detectBtn) {
      detectBtn.disabled = cfLocked || (flowMode === 'create' && !hasStepOneResult);
    }
    if (testBtn) {
      testBtn.disabled = cfLocked || (flowMode === 'create' && !hasStepOneResult);
    }
    if (initBtn) {
      initBtn.disabled = cfLocked || (flowMode === 'create' && !hasStepOneResult);
    }
    if (enableBtn) {
      enableBtn.disabled = cfLocked || !cfSetup.canEnable;
    }

    this.updateCloudflareSetupStatus(cfSetup.status, cfSetup.text);

    this.refreshSyncUI();
  }

  async refreshSupabaseSetupUI() {
    if (!window.supabaseResourceManager) {
      return;
    }

    const syncStatus = window.syncManager?.getSyncStatus ? window.syncManager.getSyncStatus() : null;
    const { profile, preferences, savedAdminSecrets } = await window.supabaseResourceManager.getSetupState();
    const defaultNames = this.getDefaultSupabaseResourceNames();
    const activeConfig = syncStatus?.supabaseConfig || {};
    const urlInput = document.getElementById('sb-url');
    const keyInput = document.getElementById('sb-key');
    const projectRefInput = document.getElementById('sb-project-ref');
    const bucketNameInput = document.getElementById('sb-bucket-name');
    const serviceRoleKeyInput = document.getElementById('sb-service-role-key');
    const managementTokenInput = document.getElementById('sb-management-token');
    const saveAdminSecretsCheckbox = document.getElementById('sb-save-admin-secrets');
    const connectionHintText = document.getElementById('sb-auth-status-text');
    const detectBtn = document.getElementById('sb-detect-status-btn');
    const testBtn = document.getElementById('sb-test-btn');
    const initBtn = document.getElementById('sb-init-resources-btn');
    const enableBtn = document.getElementById('sb-enable-btn');
    const isEditingUrl = document.activeElement === urlInput;
    const isEditingKey = document.activeElement === keyInput;
    const resolvedUrl = isEditingUrl
      ? (urlInput?.value.trim() || '')
      : (urlInput?.value.trim() || profile?.url || activeConfig.url || '');
    const derivedProjectRef = resolvedUrl
      ? window.supabaseResourceManager.deriveProjectRef(resolvedUrl)
      : '';

    if (urlInput) {
      urlInput.value = resolvedUrl;
    }
    if (keyInput) {
      keyInput.value = isEditingKey
        ? (keyInput.value.trim() || '')
        : (keyInput.value.trim() || profile?.anonKey || activeConfig.anonKey || '');
    }
    if (projectRefInput) {
      projectRefInput.value = isEditingUrl
        ? derivedProjectRef
        : (projectRefInput.value.trim() || derivedProjectRef || profile?.projectRef || '');
    }
    if (bucketNameInput) {
      bucketNameInput.value = profile?.bucketName || activeConfig.bucketName || defaultNames.bucketName;
    }
    if (serviceRoleKeyInput) {
      serviceRoleKeyInput.value = savedAdminSecrets?.serviceRoleKey || '';
    }
    if (managementTokenInput) {
      managementTokenInput.value = savedAdminSecrets?.managementToken || '';
    }
    if (saveAdminSecretsCheckbox) {
      saveAdminSecretsCheckbox.checked = !!preferences.saveAdminSecrets;
    }

    const resolvedKey = isEditingKey
      ? (keyInput?.value.trim() || '')
      : (keyInput?.value.trim() || profile?.anonKey || activeConfig.anonKey || '');
    const sbLocked = false;
    const flowMode = this.getSupabaseFlowMode(profile);
    const sbSetup = this.resolveSupabaseSetupState({
      profile,
      config: {
        url: resolvedUrl,
        anonKey: resolvedKey,
        bucketName: profile?.bucketName || activeConfig.bucketName || defaultNames.bucketName
      },
      flowMode
    });
    const hasBasicConfig = sbSetup.hasBasicConfig;
    const isInitialized = sbSetup.isInitialized;
    const allowDirectConnect = hasBasicConfig && (isInitialized || flowMode === 'existing');
    const currentStep = sbSetup.currentStep;

    if (keyInput) {
      keyInput.value = resolvedKey;
    }

    this.applySupabaseFlowMode(flowMode, {
      isInitialized,
      currentStep
    });

    if (connectionHintText) {
      connectionHintText.hidden = true;
      connectionHintText.textContent = '';
    }

    if (detectBtn) {
      detectBtn.disabled = sbLocked || !hasBasicConfig;
    }
    if (testBtn) {
      testBtn.disabled = sbLocked || !allowDirectConnect;
    }
    if (initBtn) {
      initBtn.disabled = sbLocked || flowMode !== 'setup';
    }
    if (enableBtn) {
      enableBtn.disabled = sbLocked || !sbSetup.canEnable;
    }

    this.updateSupabaseSetupStatus(sbSetup.status, sbSetup.text);

    this.refreshSyncUI();
  }

  /* ---------------------- 云端同步面板 ---------------------- */
  bindSyncEvents() {
    // 选项卡切换
    const syncPanel = document.getElementById('panel-sync');
    const tabs = syncPanel?.querySelectorAll('.tab-btn[data-tab]') || [];
    const panes = syncPanel?.querySelectorAll('.tab-content .tab-pane') || [];
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tab.getAttribute('data-tab')}-panel`)?.classList.add('active');
      });
    });

    document.querySelectorAll('input[name="cf-resource-mode"]').forEach((radio) => {
      radio.addEventListener('change', async (event) => {
        if (event.target.checked) {
          await this.toggleCloudflareAutoSetup(event.target.value === 'create');
        }
      });
    });

    document.querySelectorAll('input[name="sb-project-state"]').forEach((radio) => {
      radio.addEventListener('change', async (event) => {
        if (event.target.checked) {
          this.supabaseFlowModeOverride = event.target.value;
          await this.refreshSupabaseSetupUI();
        }
      });
    });

    ['cf-worker-url', 'cf-access-token'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => {
        this.refreshCloudflareSetupUI().catch(console.error);
      });
    });

    ['sb-url', 'sb-key'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => {
        this.refreshSupabaseSetupUI().catch(console.error);
      });
    });

    document.getElementById('cf-create-resources-btn')?.addEventListener('click', async () => {
      const button = document.getElementById('cf-create-resources-btn');
      const defaultText = button.textContent;
      button.disabled = true;
      button.textContent = '创建中...';

      try {
        const formData = this.getCloudflareResourceFormData();
        const profile = await window.cloudflareResourceManager.createResources(formData);
        await this.refreshCloudflareSetupUI();
        this.showMessage(`Worker 创建成功：${profile.workerName}，下一步请初始化数据库。`, 'success');
      } catch (error) {
        const existingProfile = await window.cloudflareResourceManager.getProfile().catch(() => null);
        if (existingProfile) {
          await window.cloudflareResourceManager.saveProfile({
            ...existingProfile,
            setupStatus: 'error',
            setupStatusText: `创建失败：${error.message}`,
            updatedAt: new Date().toISOString()
          });
          await this.refreshCloudflareSetupUI();
          this.refreshSyncUI();
        } else {
          this.updateCloudflareSetupStatus('error', `创建失败：${error.message}`);
        }
        this.showMessage('创建失败: ' + error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = defaultText;
      }
    });

    document.getElementById('cf-clear-setup-cache-btn')?.addEventListener('click', async () => {
      const confirmed = await window.notification.confirm('确定要清空本机保存的 Cloudflare 连接与初始化资料吗？这不会删除你在 Cloudflare 上已经创建的资源。', {
        title: '确认清空缓存',
        confirmText: '清空',
        cancelText: '取消',
        type: 'warning'
      });

      if (!confirmed) {
        return;
      }

      try {
        await window.cloudflareResourceManager.clearSetupCache({ clearApiToken: true });
        await window.cloudflareResourceManager.savePreferences({ autoSetupEnabled: false, saveApiToken: false });
        await this.refreshCloudflareSetupUI();
        this.showMessage('Cloudflare 本机连接资料已清空', 'success');
      } catch (error) {
        this.showMessage('清空失败: ' + error.message, 'error');
      }
    });

    document.getElementById('cf-copy-worker-btn').addEventListener('click', async () => {
      try {
        await this.copyBundledFileText('cloudflare/cf-worker.js', 'Worker 模板已复制到剪贴板');
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
        const bucketName = document.getElementById('sb-bucket-name')?.value.trim() || 'backgrounds';
        const sql = SupabaseClient.getTableCreationSQL(bucketName);
        await this.copyTextToClipboard(sql, 'Supabase 初始化 SQL 已复制到剪贴板');
      } catch (error) {
        this.showMessage('复制失败: ' + error.message, 'error');
      }
    });

    // Cloudflare Actions
    document.getElementById('cf-detect-status-btn')?.addEventListener('click', async () => {
      try {
        await this.detectCloudflareSetupStatus(true);
      } catch (error) {
        this.showMessage('检测失败: ' + error.message, 'error');
      }
    });

    document.getElementById('cf-test-btn').addEventListener('click', async () => {
      const config = this.getCloudflareSyncConfig();
      if (!config.workerUrl) { return this.showMessage('请填写 Worker API URL', 'error'); }

      try {
        const result = await this.detectCloudflareSetupStatus(false);
        if (result.status === 'configured') {
          this.showMessage('测试连接成功！下一步到“工作空间”里为目标工作空间启用同步。', 'success');
        } else if (result.status === 'pending') {
          this.showMessage('连接可用，但数据表还没准备好，请先初始化数据库。', 'info');
        } else {
          this.showMessage('连接失败: ' + (result.error?.message || '未知错误'), 'error');
        }
      } catch (err) {
        this.showMessage('连接失败: ' + err.message, 'error');
      }
    });
    
    document.getElementById('cf-init-db-btn').addEventListener('click', async () => {
      const button = document.getElementById('cf-init-db-btn');
      const defaultText = button.textContent;
      button.disabled = true;
      button.textContent = '初始化中...';

      try {
        const config = this.getCloudflareSyncConfig();
        if (!config.workerUrl) {
          throw new Error('请先完成第 1 步，拿到 Worker API URL');
        }

        const profile = await this.saveExistingCloudflareResourceProfile(false);
        const result = await window.syncManager.initializeProviderSchema('cloudflare', {
          workerUrl: profile.workerUrl,
          accessToken: profile.accessToken || ''
        });
        const initializedAt = new Date().toISOString();
        await this.persistCloudflareConnectionState({
          source: profile.source,
          accountId: profile.accountId,
          workerName: profile.workerName,
          workerUrl: profile.workerUrl,
          accessToken: profile.accessToken || '',
          databaseId: profile.databaseId,
          databaseName: profile.databaseName,
          bucketName: profile.bucketName,
          initialized: true,
          setupStatus: 'configured',
          setupStatusText: '',
          lastInitializedAt: initializedAt,
          lastConnectedAt: initializedAt
        });
        await this.refreshCloudflareSetupUI();
        this.showMessage('Cloudflare 初始化成功！\n' + ((result?.results || result?.result?.results || []).join('\n') || '数据表已就绪'), 'success');
      } catch (err) {
        await this.persistCloudflareConnectionState({
          initialized: false,
          setupStatus: 'error',
          setupStatusText: `初始化失败：${err.message}`
        });
        await this.refreshCloudflareSetupUI();
        this.refreshSyncUI();
        this.showMessage('初始化失败: ' + err.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = defaultText;
      }
    });

    document.getElementById('cf-enable-btn').addEventListener('click', async () => {
      const config = this.getCloudflareSyncConfig();
      if (!config.workerUrl) { return this.showMessage('请填写 Worker API URL', 'error'); }

      let profile = null;

      try {
        profile = await this.saveExistingCloudflareResourceProfile(false);
        if (profile.source === 'auto' && !profile.initialized) {
          throw new Error('资源已创建，但还未初始化，请先点击“初始化数据库”');
        }
        await this.completeCloudflareSyncSetup({
          workerUrl: config.workerUrl,
          accessToken: config.accessToken,
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
        await this.persistCloudflareConnectionState({
          setupStatus: profile?.source === 'auto' && !profile?.initialized ? 'pending' : 'error',
          setupStatusText: profile?.source === 'auto' && !profile?.initialized ? '' : `启用失败：${err.message}`
        });
        await this.refreshCloudflareSetupUI();
        this.refreshSyncUI();
        this.showMessage('启用失败: ' + err.message, 'error');
      }
    });


    // Supabase actions
    document.getElementById('sb-save-setup-btn')?.addEventListener('click', async () => {
      try {
        await this.syncSupabaseAdminSecretsCache();
        await this.saveExistingSupabaseProjectProfile(true);
      } catch (error) {
        this.showMessage('保存失败: ' + error.message, 'error');
      }
    });

    document.getElementById('sb-clear-setup-cache-btn')?.addEventListener('click', async () => {
      const confirmed = await window.notification.confirm('确定要清空本机保存的 Supabase 连接与初始化资料吗？这不会删除你在 Supabase 上已有的项目、表和 Storage bucket。', {
        title: '确认清空缓存',
        confirmText: '清空',
        cancelText: '取消',
        type: 'warning'
      });

      if (!confirmed) {
        return;
      }

      try {
        await window.supabaseResourceManager.clearSetupCache({ clearAdminSecrets: true });
        this.supabaseFlowModeOverride = 'setup';
        await this.refreshSupabaseSetupUI();
        this.showMessage('Supabase 本机连接资料已清空', 'success');
      } catch (error) {
        this.showMessage('清空失败: ' + error.message, 'error');
      }
    });

    document.getElementById('sb-detect-status-btn')?.addEventListener('click', async () => {
      try {
        await this.detectSupabaseSetupStatus(true);
      } catch (error) {
        this.showMessage('检测失败: ' + error.message, 'error');
      }
    });

    document.getElementById('sb-init-resources-btn')?.addEventListener('click', async () => {
      const button = document.getElementById('sb-init-resources-btn');
      const defaultText = button.textContent;
      button.disabled = true;
      button.textContent = '初始化中...';

      try {
        const config = await this.syncSupabaseAdminSecretsCache(this.getSupabaseInitializationConfig());
        if (!config.url) {
          throw new Error('请填写 Project URL');
        }

        await this.saveExistingSupabaseProjectProfile(false, {
          url: config.url,
          projectRef: config.projectRef,
          bucketName: config.bucketName
        });

        const result = await window.syncManager.initializeProviderSchema('supabase', config);
        const initializedAt = new Date().toISOString();
        await this.persistSupabaseConnectionState({
          initialized: true,
          setupStatus: 'configured',
          setupStatusText: '',
          projectRef: result?.profile?.projectRef || config.projectRef,
          bucketName: result?.profile?.bucketName || config.bucketName,
          lastInitializedAt: initializedAt,
          lastConnectedAt: initializedAt
        });
        this.supabaseFlowModeOverride = 'existing';
        await this.refreshSupabaseSetupUI();

        const bucketMessage = result?.bucketResult?.created
          ? `Storage bucket ${result.bucketResult.bucketName} 已创建`
          : `Storage bucket ${result?.bucketResult?.bucketName || 'backgrounds'} 已存在`;
        this.showMessage(`Supabase 初始化成功：${bucketMessage}`, 'success');
      } catch (error) {
        await this.persistSupabaseConnectionState({
          initialized: false,
          setupStatus: 'error',
          setupStatusText: `初始化失败：${error.message}`
        });
        await this.refreshSupabaseSetupUI();
        this.refreshSyncUI();
        this.showMessage('初始化失败: ' + error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = defaultText;
      }
    });

    document.getElementById('sb-test-btn').addEventListener('click', async () => {
      const config = this.getSupabaseSyncConfig();
      if (!config.url || !config.anonKey) {
        return this.showMessage('请先填写完整的 Supabase 连接信息', 'error');
      }
      try {
        const result = await this.detectSupabaseSetupStatus(false);
        if (result.status === 'configured') {
          this.supabaseFlowModeOverride = 'existing';
          this.showMessage('测试连接成功', 'success');
        } else if (result.status === 'pending') {
          this.showMessage('连接可用，但数据表还没准备好，请先初始化资源。', 'info');
        } else {
          this.showMessage('测试失败: ' + (result.error?.message || '未知错误'), 'error');
        }
      } catch (err) {
        this.showMessage('测试失败: ' + err.message, 'error');
      }
    });

    document.getElementById('sb-enable-btn').addEventListener('click', async () => {
      const config = this.getSupabaseSyncConfig();
      if (!config.url || !config.anonKey) {
        return this.showMessage('请先填写完整的 Supabase 连接信息', 'error');
      }

      try {
        await this.ensureSupabaseClient(config);
        await this.completeSupabaseSyncSetup({
          url: config.url,
          anonKey: config.anonKey,
          bucketName: config.bucketName
        });
        this.supabaseFlowModeOverride = 'existing';
        await this.refreshSupabaseSetupUI();
        this.showMessage('Supabase 同步已启用！', 'success');
      } catch (error) {
        await this.persistSupabaseConnectionState({
          setupStatus: 'error',
          setupStatusText: `启用失败：${error.message}`
        });
        await this.refreshSupabaseSetupUI();
        this.refreshSyncUI();
        this.showMessage('启用失败: ' + error.message, 'error');
      }
    });

    document.getElementById('manual-sync-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('manual-sync-btn');
      if (!btn) {
        return;
      }

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
    const confirmed = await window.notification.confirm('确定要禁用云端同步吗？这会将当前云端主题切回本地主题，但云端数据仍会保留。', {
      title: '确认禁用同步',
      confirmText: '禁用',
      cancelText: '取消',
      type: 'warning'
    });

    if (!confirmed) {
      return;
    }

    try {
      await window.syncManager.disableCloudSync();
      this.showMessage('同步已禁用', 'success');
      this.refreshSyncUI();
      await this.refreshCloudflareSetupUI();
      await this.refreshSupabaseSetupUI();
      this.refreshThemesList();
      window.loadThemeSettings();
    } catch (err) {
      this.showMessage('操作失败: ' + err.message, 'error');
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

    if (providerNote) {
    providerNote.textContent = '这里只保存连接资料；启用同步请到工作空间中操作。';
    }

    if (cfHint) {
      cfHint.style.display = 'none';
      cfHint.textContent = '';
    }

    if (sbHint) {
      sbHint.style.display = 'none';
      sbHint.textContent = '';
    }

    cfTab?.classList.remove('is-locked-provider');
    sbTab?.classList.remove('is-locked-provider');
    cfPanel?.classList.remove('is-provider-locked');
    sbPanel?.classList.remove('is-provider-locked');
  }

  async refreshSyncUI() {
    try {
      const status = window.syncManager.getSyncStatus();
    const cfCapabilities = window.syncManager.getProviderCapabilities('cloudflare');
    const cfSupportsSchemaInit = cfCapabilities?.schemaMode === 'remote';
    const indicator = document.querySelector('#sync-status-card .status-indicator');
    const title = document.getElementById('sync-status-title');
    const desc = document.getElementById('sync-status-desc');
    const cfInit = document.getElementById('cf-init-db-btn');

    const workerUrlInput = document.getElementById('cf-worker-url');
    const accessTokenInput = document.getElementById('cf-access-token');
    const sbUrlInput = document.getElementById('sb-url');
    const sbKeyInput = document.getElementById('sb-key');

    const resolvedCfWorkerUrl = workerUrlInput?.value.trim() || status.cloudflareConfig?.workerUrl || '';
    const resolvedCfAccessToken = accessTokenInput?.value.trim() || status.cloudflareConfig?.accessToken || '';
    const resolvedSbUrl = sbUrlInput?.value.trim() || status.supabaseConfig?.url || '';
    const resolvedSbKey = sbKeyInput?.value.trim() || status.supabaseConfig?.anonKey || '';

    const [cfSetupState, sbSetupState] = await Promise.all([
      window.cloudflareResourceManager?.getSetupState
        ? window.cloudflareResourceManager.getSetupState().catch(() => null)
        : Promise.resolve(null),
      window.supabaseResourceManager?.getSetupState
        ? window.supabaseResourceManager.getSetupState().catch(() => null)
        : Promise.resolve(null)
    ]);
    const cfProfile = cfSetupState?.profile || null;
    const sbProfile = sbSetupState?.profile || null;
    const cfSetup = this.resolveCloudflareSetupState({
      profile: cfProfile,
      config: {
        workerUrl: resolvedCfWorkerUrl,
        accessToken: resolvedCfAccessToken
      },
      flowMode: this.getCloudflareResourceMode(cfSetupState?.preferences || null)
    });
    const sbSetup = this.resolveSupabaseSetupState({
      profile: sbProfile,
      config: {
        url: resolvedSbUrl,
        anonKey: resolvedSbKey,
        bucketName: status.supabaseConfig?.bucketName || 'backgrounds'
      },
      flowMode: this.getSupabaseFlowMode(sbProfile)
    });
    const cfStatusMeta = this.getUnifiedSetupStatusMeta(cfSetup.status);
    const sbStatusMeta = this.getUnifiedSetupStatusMeta(sbSetup.status);

    if (indicator) {
      indicator.classList.toggle('active', cfSetup.status !== 'missing' || sbSetup.status !== 'missing');
    }

    if (title) {
      title.textContent = '全局连接状态';
    }

    if (desc) {
      desc.textContent = `Cloudflare：${cfStatusMeta.label} · Supabase：${sbStatusMeta.label}`;
    }

    if (cfInit) {
      cfInit.style.display = cfSupportsSchemaInit ? 'inline-block' : 'none';
    }

    if (status.cloudflareConfig) {
      if (workerUrlInput && !workerUrlInput.value.trim()) {
        workerUrlInput.value = status.cloudflareConfig.workerUrl || '';
      }
      if (accessTokenInput && !accessTokenInput.value.trim()) {
        accessTokenInput.value = status.cloudflareConfig.accessToken || '';
      }
    }

    if (status.supabaseConfig) {
      if (sbUrlInput && !sbUrlInput.value.trim()) {
        sbUrlInput.value = status.supabaseConfig.url || '';
      }
      if (sbKeyInput && !sbKeyInput.value.trim()) {
        sbKeyInput.value = status.supabaseConfig.anonKey || '';
      }
    }

      this.updateSyncProviderMutualExclusionUI(status);
      this.refreshWorkspaceDetailUI().catch(console.error);
    } catch (error) {
      console.error('刷新全局连接状态失败:', error);
    }
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
      const confirmed = await window.notification.confirm('确定要清空当前工作空间的所有分类和快捷方式吗？此操作极度危险！', {
        title: '确认清空数据',
        confirmText: '清空',
        cancelText: '取消',
        type: 'error'
      });

      if (!confirmed) {
        return;
      }

      try {
        const currentConfigData = window.unifiedDataManager.getCurrentConfigData() || {};

        // 只需清空 categories，保留其余工作空间结构与 settings
        await window.storageManager.importData({
          ...currentConfigData,
          categories: [],
          settings: window.storageManager.getSettings()
        });
        this.showMessage('分类数据已清空', 'success');
      } catch(err) {
        this.showMessage('清空失败: ' + err.message, 'error');
      }
    });
  }

  /* ---------------------- 实用工具 ---------------------- */
  showMessage(msg, type = 'info') {
    return window.notification.show(msg, type, { duration: 3000 });
  }
}

window.settingsUIManager = new SettingsUIManager();
