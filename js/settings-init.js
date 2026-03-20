/**
 * Initialization for the settings page.
 * Extracted to avoid CSP inline script violations.
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
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
    }
  } catch (error) {
    console.error('Failed to initialize settings page:', error);
  } finally {
    document.body.classList.add('loaded');
  }
});
