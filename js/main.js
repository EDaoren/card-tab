/**
 * Main entry point for the Card Tab extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Initializing Card Tab...');

    // Initialize all managers first (they need DOM elements to exist)
    viewManager = new ViewManager();
    categoryManager = new CategoryManager();
    shortcutManager = new ShortcutManager();
    searchManager = new SearchManager();

    // Initialize storage (loads data from Chrome storage + Supabase)
    await storageManager.init();

    // Initialize view based on saved settings
    await viewManager.initView();

    // Initialize sync UI first
    await syncUIManager.init();

    // Initialize theme config UI
    if (typeof themeConfigUIManager !== 'undefined') {
      await themeConfigUIManager.init();
    }

    // Initialize theme settings after sync is ready
    initThemeSettings();

    // Render categories and shortcuts
    await categoryManager.renderCategories();

    // Initialize icon system after everything is rendered
    iconManager.init();

    // Initialize offline manager for network status handling
    if (typeof offlineManager !== 'undefined') {
      offlineManager.init();
    }

    console.log('✅ Card Tab initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Card Tab:', error);

    // 即使初始化失败，也要尝试创建基本的管理器实例
    try {
      console.log('🔄 Attempting fallback initialization...');
      if (!viewManager) viewManager = new ViewManager();
      if (!categoryManager) categoryManager = new CategoryManager();
      if (!shortcutManager) shortcutManager = new ShortcutManager();
      if (!searchManager) searchManager = new SearchManager();

      // 尝试使用默认数据
      if (!storageManager.data) {
        storageManager.data = {
          categories: [],
          settings: { viewMode: 'grid' }
        };
      }

      console.log('✅ Fallback initialization completed');
    } catch (fallbackError) {
      console.error('❌ Fallback initialization also failed:', fallbackError);
    }
  }
});