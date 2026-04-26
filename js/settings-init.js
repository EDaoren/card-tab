/**
 * Initialization for the settings page.
 * Extracted to avoid CSP inline script violations.
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
        versionElement.textContent = `Version ${chrome.runtime.getManifest().version}`;
      }
    }

    if (window.unifiedDataManager) {
      await window.unifiedDataManager.init();
    }

    if (window.storageManager) {
      await window.storageManager.init();
    }

    if (window.syncManager) {
      await window.syncManager.init();
    }

    if (window.initThemeSettings) {
      await window.initThemeSettings();
    }

    if (window.settingsUIManager) {
      await window.settingsUIManager.init();

      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('openSearchConfig') === '1') {
        const currentThemeId = window.unifiedDataManager?.appData?.currentThemeId || null;
        window.settingsUIManager.showPanel('panel-appearance');
        if (currentThemeId) {
          window.settingsUIManager.openThemeForm(currentThemeId);
          window.settingsUIManager.switchWorkspaceDetailTab('search');
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize settings page:', error);
  } finally {
    document.body.classList.add('loaded');
  }
});
