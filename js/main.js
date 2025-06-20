/**
 * Main entry point for the Quick Nav Tab extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing Quick Nav Tab...');

    // Initialize all managers first (they need DOM elements to exist)
    console.log('Creating manager instances...');
    viewManager = new ViewManager();
    categoryManager = new CategoryManager();
    shortcutManager = new ShortcutManager();
    searchManager = new SearchManager();
    console.log('Manager instances created successfully');

    // Initialize storage (loads data from Chrome storage + Supabase)
    console.log('Initializing storage...');
    await storageManager.init();
    console.log('Storage initialized successfully');

    // Initialize view based on saved settings
    console.log('Initializing view...');
    await viewManager.initView();

    // Initialize sync UI first
    console.log('Initializing sync UI...');
    await syncUIManager.init();

    // Initialize theme config UI
    console.log('Initializing theme config UI...');
    if (typeof themeConfigUIManager !== 'undefined') {
      await themeConfigUIManager.init();
    } else {
      console.warn('themeConfigUIManager not available, skipping theme config UI initialization');
    }

    // Initialize theme settings after sync is ready
    console.log('Initializing theme settings...');
    initThemeSettings();

    // Render categories and shortcuts
    console.log('Rendering categories...');
    await categoryManager.renderCategories();

    // Initialize icon system after everything is rendered
    console.log('Initializing icon system...');
    iconManager.init();

    console.log('Quick Nav Tab initialized successfully');
  } catch (error) {
    console.error('Error initializing Quick Nav Tab:', error);

    // 即使初始化失败，也要尝试创建基本的管理器实例
    try {
      console.log('Attempting fallback initialization...');
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

      console.log('Fallback initialization completed');
    } catch (fallbackError) {
      console.error('Fallback initialization also failed:', fallbackError);
    }
  }
});