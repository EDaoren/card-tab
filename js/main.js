/**
 * Main entry point for the Card Tab extension.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const totalSteps = 9;
  let currentStep = 0;

  try {
    console.log('Initializing Card Tab...');

    if (typeof window.unifiedDataManager === 'undefined') {
      throw new Error('UnifiedDataManager not loaded');
    }

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    await window.unifiedDataManager.init();

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    viewManager = new ViewManager();
    categoryManager = new CategoryManager();
    shortcutManager = new ShortcutManager();
    searchManager = new SearchManager();

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    await storageManager.init();

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    await viewManager.initView();

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    await syncManager.init();

    initThemeSettings();

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    iconManager.init();

    if (typeof offlineManager !== 'undefined') {
      offlineManager.init();
    }

    if (typeof dragManager !== 'undefined') {
      try {
        dragManager.reinitialize();
      } catch (error) {
        console.warn('Failed to initialize drag manager:', error);
      }
    }

    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    initFloatingButtons();
    window.initHomeDisplayMode?.();

    await window.simpleLoadingManager?.completeLoading();

    console.log('Card Tab initialized successfully');
  } catch (error) {
    console.error('Error initializing Card Tab:', error);
    window.simpleLoadingManager?.handleLoadingError(error, 'main initialization');

    try {
      console.log('Attempting fallback initialization...');

      if (!viewManager) {
        viewManager = new ViewManager();
      }
      if (!categoryManager) {
        categoryManager = new CategoryManager();
      }
      if (!shortcutManager) {
        shortcutManager = new ShortcutManager();
      }
      if (!searchManager) {
        searchManager = new SearchManager();
      }

      if (!window.unifiedDataManager.currentConfigData) {
        window.unifiedDataManager.currentConfigData = window.unifiedDataManager.normalizeConfigData({
          categories: [],
          themeSettings: {
            theme: 'default',
            backgroundImageUrl: null,
            backgroundImagePath: null,
            backgroundOpacity: 30
          }
        });
      }

      await window.simpleLoadingManager?.completeLoading();

      console.log('Fallback initialization completed');
    } catch (fallbackError) {
      console.error('Fallback initialization also failed:', fallbackError);
      window.simpleLoadingManager?.handleLoadingError(fallbackError, 'fallback initialization');
    }
  }
});

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'dataUpdated') {
      console.log('Data updated notification received:', request);
      handleDataUpdated(request);
      sendResponse({ success: true });
    }
  });
}

let dataUpdateReloadPromise = null;
let pendingDataUpdateInfo = null;

function handleDataUpdated(updateInfo) {
  console.log('Handling data update:', updateInfo);

  if (!window.unifiedDataManager) {
    return Promise.resolve(false);
  }

  if (dataUpdateReloadPromise) {
    pendingDataUpdateInfo = updateInfo;
    console.log('Data update already in progress, queued latest notification');
    return dataUpdateReloadPromise;
  }

  dataUpdateReloadPromise = window.unifiedDataManager.loadCurrentConfigData()
    .then(() => {
      console.log('Unified data manager data reloaded');
      window.storageManager?.updateDataFromUnified?.();

      if (categoryManager) {
        categoryManager.renderCategories();
        console.log('Categories re-rendered');
      }

      searchManager?.refreshSearchEngineConfig?.();

      window.loadDisplayModeSettings?.();
      window.refreshFloatingToolbarState?.();

      if (updateInfo.newShortcut) {
        window.notification.success(`已添加“${updateInfo.newShortcut.name}”到 Card Tab`);
      }

      return true;
    })
    .catch((error) => {
      console.error('Failed to reload data:', error);
      return false;
    })
    .finally(() => {
      dataUpdateReloadPromise = null;

      if (pendingDataUpdateInfo) {
        const nextUpdateInfo = pendingDataUpdateInfo;
        pendingDataUpdateInfo = null;
        handleDataUpdated(nextUpdateInfo);
      }
    });

  return dataUpdateReloadPromise;
}

function initFloatingButtons() {
  const menuBtn = document.getElementById('menu-toggle-btn');
  const buttonsGroup = document.getElementById('floating-buttons-group');
  const submenuGroup = document.getElementById('floating-submenu-group');
  const settingsBtn = document.getElementById('settings-btn');
  const viewMenuBtn = document.getElementById('view-menu-btn');
  const displayMenuBtn = document.getElementById('display-menu-btn');
  const shortcutOpenMenuBtn = document.getElementById('shortcut-open-menu-btn');
  const submenuPanels = {
    view: document.getElementById('view-submenu'),
    display: document.getElementById('display-submenu'),
    'open-mode': document.getElementById('shortcut-open-submenu')
  };
  let isExpanded = false;
  let activeSubmenu = null;

  if (!menuBtn || !buttonsGroup) {
    console.warn('Floating button elements not found');
    return;
  }

  const viewModes = {
    grid: { icon: 'grid_view', title: '视图：网格' },
    list: { icon: 'view_list', title: '视图：列表' }
  };
  const displayModes = {
    standard: { icon: 'web', title: '模式：标准' },
    focus: { icon: 'filter_center_focus', title: '模式：专注' },
    wallpaper: { icon: 'image', title: '模式：壁纸' }
  };
  const shortcutOpenModes = {
    'current-tab': { icon: 'tab', title: '打开方式：当前页' },
    'new-tab': { icon: 'open_in_new', title: '打开方式：新标签页' }
  };

  function setButtonIcon(button, icon, title) {
    if (!button) {
      return;
    }

    const iconElement = button.querySelector('.material-symbols-rounded');
    if (iconElement) {
      iconElement.textContent = icon;
    }
    if (title) {
      button.title = title;
    }
  }

  function closeSubmenus() {
    activeSubmenu = null;
    submenuGroup?.classList.remove('has-open-submenu');
    if (submenuGroup) {
      submenuGroup.style.top = '';
    }

    Object.entries(submenuPanels).forEach(([name, panel]) => {
      if (!panel) {
        return;
      }

      panel.hidden = true;
      panel.classList.remove('active');
      document.querySelector(`[data-toolbar-toggle="${name}"]`)?.classList.remove('active');
    });
  }

  function positionSubmenu(anchorButton, panel) {
    if (!submenuGroup || !anchorButton || !panel) {
      return;
    }

    const containerRect = submenuGroup.parentElement?.getBoundingClientRect();
    const buttonRect = anchorButton.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    if (!containerRect) {
      return;
    }

    const rawTop = buttonRect.top - containerRect.top + ((buttonRect.height - panelRect.height) / 2);
    const maxTop = Math.max(0, containerRect.height - panelRect.height);
    const boundedTop = Math.min(Math.max(0, rawTop), maxTop);
    submenuGroup.style.top = `${boundedTop}px`;
  }

  function refreshFloatingToolbarState() {
    const settings = storageManager?.getSettings?.() || {};
    const currentViewMode = viewManager?.currentViewMode || settings.viewMode || 'grid';
    const currentDisplayMode = settings.displayMode || 'standard';
    const currentShortcutOpenMode = settings.shortcutOpenMode || 'new-tab';

    const viewMeta = viewModes[currentViewMode] || viewModes.grid;
    const displayMeta = displayModes[currentDisplayMode] || displayModes.standard;
    const shortcutMeta = shortcutOpenModes[currentShortcutOpenMode] || shortcutOpenModes['new-tab'];

    setButtonIcon(viewMenuBtn, viewMeta.icon, viewMeta.title);
    setButtonIcon(displayMenuBtn, displayMeta.icon, displayMeta.title);
    setButtonIcon(shortcutOpenMenuBtn, shortcutMeta.icon, shortcutMeta.title);

    document.querySelectorAll('[data-display-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.displayMode === currentDisplayMode);
    });
    document.querySelectorAll('[data-shortcut-open-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.shortcutOpenMode === currentShortcutOpenMode);
    });
  }

  function applyToolbarSettingsOptimistically(newSettings = {}) {
    const normalizedSettings = {
      ...(storageManager?.getSettings?.() || {}),
      ...(newSettings || {})
    };

    if (storageManager?.data) {
      storageManager.data.settings = normalizedSettings;
    }
    if (storageManager?.fullData) {
      storageManager.fullData.settings = normalizedSettings;
    }
    if (window.unifiedDataManager?.currentConfigData) {
      window.unifiedDataManager.currentConfigData.settings = normalizedSettings;
    }

    refreshFloatingToolbarState();
  }

  function persistToolbarSettings(newSettings = {}) {
    storageManager?.updateSettings?.(newSettings).catch((error) => {
      console.error('Failed to persist toolbar settings:', error);
      storageManager?.updateDataFromUnified?.();
      window.loadDisplayModeSettings?.();
      refreshFloatingToolbarState();
      window.notification?.error?.('设置保存失败，请重试');
    });
  }

  function syncMenuButtonWidth() {
    if (!menuBtn || !buttonsGroup) {
      return;
    }

    const toolbarWidth = Math.ceil(buttonsGroup.getBoundingClientRect().width);
    if (toolbarWidth > 0) {
      menuBtn.style.width = `${toolbarWidth}px`;
    }
  }

  function toggleFloatingButtons(expand) {
    isExpanded = expand;

    if (expand) {
      buttonsGroup.classList.remove('collapsed');
      buttonsGroup.classList.add('expanded');
      menuBtn.title = '收起菜单';
    } else {
      closeSubmenus();
      buttonsGroup.classList.remove('expanded');
      buttonsGroup.classList.add('collapsed');
      menuBtn.title = '展开菜单';
    }

    syncMenuButtonWidth();
  }

  function openSubmenu(name, anchorButton) {
    if (!submenuPanels[name]) {
      return;
    }

    if (!isExpanded) {
      toggleFloatingButtons(true);
    }

    if (activeSubmenu === name) {
      closeSubmenus();
      return;
    }

    closeSubmenus();
    activeSubmenu = name;
    submenuGroup?.classList.add('has-open-submenu');
    submenuPanels[name].hidden = false;
    submenuPanels[name].classList.add('active');
    document.querySelector(`[data-toolbar-toggle="${name}"]`)?.classList.add('active');
    requestAnimationFrame(() => {
      positionSubmenu(anchorButton, submenuPanels[name]);
    });
  }

  menuBtn.addEventListener('click', (event) => {
    toggleFloatingButtons(!isExpanded);
    event.stopPropagation();
  });

  document.addEventListener('click', (event) => {
    if (isExpanded && !event.target.closest('.floating-buttons')) {
      toggleFloatingButtons(false);
    }
  });

  settingsBtn?.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

  viewMenuBtn?.setAttribute('data-toolbar-toggle', 'view');
  displayMenuBtn?.setAttribute('data-toolbar-toggle', 'display');
  shortcutOpenMenuBtn?.setAttribute('data-toolbar-toggle', 'open-mode');

  viewMenuBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    openSubmenu('view', viewMenuBtn);
  });

  displayMenuBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    openSubmenu('display', displayMenuBtn);
  });

  shortcutOpenMenuBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    openSubmenu('open-mode', shortcutOpenMenuBtn);
  });

  submenuPanels.view?.addEventListener('click', async (event) => {
    const button = event.target.closest('#quick-view-grid-btn, #quick-view-list-btn');
    if (!button) {
      return;
    }

    event.stopPropagation();
    await Promise.resolve();
    refreshFloatingToolbarState();
    closeSubmenus();
  });

  submenuPanels.display?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-display-mode]');
    if (!button) {
      return;
    }

    event.stopPropagation();
    applyToolbarSettingsOptimistically({ displayMode: button.dataset.displayMode });
    window.loadDisplayModeSettings?.();
    closeSubmenus();
    persistToolbarSettings({ displayMode: button.dataset.displayMode });
  });

  submenuPanels['open-mode']?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-shortcut-open-mode]');
    if (!button) {
      return;
    }

    event.stopPropagation();
    applyToolbarSettingsOptimistically({ shortcutOpenMode: button.dataset.shortcutOpenMode });
    closeSubmenus();
    persistToolbarSettings({ shortcutOpenMode: button.dataset.shortcutOpenMode });
  });

  window.refreshFloatingToolbarState = refreshFloatingToolbarState;
  refreshFloatingToolbarState();
  syncMenuButtonWidth();
  window.addEventListener('resize', syncMenuButtonWidth);

  console.log('Floating buttons initialized');
}
