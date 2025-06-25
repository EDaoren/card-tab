/**
 * Main entry point for the Card Tab extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  const totalSteps = 8;
  let currentStep = 0;

  try {
    console.log('🚀 Initializing Card Tab...');

    // 更新进度：初始化管理器
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize all managers first (they need DOM elements to exist)
    viewManager = new ViewManager();
    categoryManager = new CategoryManager();
    shortcutManager = new ShortcutManager();
    searchManager = new SearchManager();

    // 更新进度：存储初始化
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize storage (loads data from Chrome storage + Supabase)
    await storageManager.init();

    // 更新进度：视图初始化
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize view based on saved settings
    await viewManager.initView();

    // 更新进度：同步UI初始化
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize sync UI first
    await syncUIManager.init();

    // 更新进度：主题配置初始化
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize theme config UI
    if (typeof themeConfigUIManager !== 'undefined') {
      await themeConfigUIManager.init();
    }

    // Initialize theme settings after sync is ready
    initThemeSettings();

    // 更新进度：渲染内容
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Render categories and shortcuts
    await categoryManager.renderCategories();

    // 更新进度：图标系统初始化
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize icon system after everything is rendered
    iconManager.init();

    // 更新进度：离线管理器初始化
    window.simpleLoadingManager?.updateProgress(++currentStep, totalSteps);

    // Initialize offline manager for network status handling
    if (typeof offlineManager !== 'undefined') {
      offlineManager.init();
    }

    // 完成加载
    await window.simpleLoadingManager?.completeLoading();

    console.log('✅ Card Tab initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Card Tab:', error);

    // 通知加载管理器发生错误
    window.simpleLoadingManager?.handleLoadingError(error, 'main initialization');

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

      // 即使失败也要完成加载
      await window.simpleLoadingManager?.completeLoading();

      console.log('✅ Fallback initialization completed');
    } catch (fallbackError) {
      console.error('❌ Fallback initialization also failed:', fallbackError);

      // 最后的保险措施：强制完成加载
      window.simpleLoadingManager?.handleLoadingError(fallbackError, 'fallback initialization');
    }
  }
});