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

      if (categoryManager) {
        categoryManager.renderCategories();
        console.log('Categories re-rendered');
      }

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
  let isExpanded = false;

  if (!menuBtn || !buttonsGroup) {
    console.warn('Floating button elements not found');
    return;
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

  function toggleFloatingButtons(expand) {
    isExpanded = expand;

    if (expand) {
      buttonsGroup.classList.remove('collapsed');
      buttonsGroup.classList.add('expanded');
      menuBtn.title = '收起菜单';
    } else {
      buttonsGroup.classList.remove('expanded');
      buttonsGroup.classList.add('collapsed');
      menuBtn.title = '展开菜单';
    }
  }

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }

  console.log('Floating buttons initialized');
}
