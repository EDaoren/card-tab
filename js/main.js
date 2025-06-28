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

    // Initialize drag manager for drag and drop functionality
    if (typeof dragManager !== 'undefined') {
      try {
        dragManager.init();
        // 延迟启用拖拽功能，确保DOM已完全渲染
        setTimeout(() => {
          dragManager.enableCategoryDrag();
          dragManager.enableShortcutDrag();
        }, 200);
      } catch (error) {
        console.warn('DragManager初始化失败:', error);
      }
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

// 监听来自内容脚本的消息（用于快速添加功能）
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "dataUpdated") {
      // 数据更新通知，重新加载页面数据
      console.log('Data updated notification received:', request);
      handleDataUpdated(request);
      sendResponse({ success: true });
    } else if (request.action === "saveShortcutViaStorageManager") {
      // 使用storageManager保存快捷方式
      console.log('Save shortcut via storageManager:', request.shortcutData);
      handleSaveShortcutViaStorageManager(request.shortcutData)
        .then((result) => {
          sendResponse({ success: true, shortcut: result });
        })
        .catch((error) => {
          console.error('Error saving via storageManager:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开放
    }
  });
}

// 自动填充快速添加功能已移除，现在使用右键菜单的内容脚本方式

// 处理数据更新通知
function handleDataUpdated(updateInfo) {
  console.log('Handling data update:', updateInfo);

  // 重新加载存储数据
  if (storageManager) {
    storageManager.init().then(() => {
      console.log('Storage data reloaded');

      // 重新渲染视图
      if (viewManager) {
        viewManager.renderCategories();
        console.log('Categories re-rendered');
      }

      // 显示成功提示
      if (updateInfo.newShortcut) {
        showQuickAddSuccessToast(updateInfo.newShortcut.name);
      }
    }).catch(error => {
      console.error('Failed to reload data:', error);
    });
  }
}

// 显示快速添加成功提示
function showQuickAddSuccessToast(shortcutName) {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideInRight 0.3s ease-out;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">✅</span>
      <span>已添加"${shortcutName}"到 Card Tab</span>
    </div>
  `;

  // 添加动画样式
  if (!document.getElementById('quick-add-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'quick-add-toast-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // 3秒后自动移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }, 3000);
}

// 使用storageManager保存快捷方式
async function handleSaveShortcutViaStorageManager(shortcutData) {
  try {
    console.log('Using storageManager to save shortcut:', shortcutData);

    // 确保storageManager已初始化
    if (!storageManager) {
      throw new Error('StorageManager not initialized');
    }

    // 获取分类
    let categoryId = shortcutData.categoryId;

    // 如果没有指定分类，使用第一个可用分类
    if (!categoryId) {
      const categories = storageManager.getSortedCategories();
      if (categories.length === 0) {
        // 如果没有分类，创建一个默认分类
        const defaultCategory = await storageManager.addCategory({
          name: '默认分类',
          color: '#4285f4'
        });
        categoryId = defaultCategory.id;
        console.log('Created default category:', defaultCategory);
      } else {
        categoryId = categories[0].id;
        console.log('Using first available category:', categories[0].name);
      }
    }

    // 验证分类存在
    const category = storageManager.getCategory(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    // 准备快捷方式数据
    const finalShortcutData = {
      name: shortcutData.name,
      url: shortcutData.url,
      iconType: shortcutData.iconType || 'favicon',
      iconColor: shortcutData.iconColor || '#4285f4',
      iconUrl: shortcutData.iconUrl || ''
    };

    // 使用storageManager添加快捷方式
    const newShortcut = await storageManager.addShortcut(categoryId, finalShortcutData);
    console.log('Shortcut added successfully:', newShortcut);

    // 重新渲染分类（如果categoryManager可用）
    if (categoryManager) {
      categoryManager.renderCategories();
      console.log('Categories re-rendered');
    }

    // 显示成功提示
    showQuickAddSuccessToast(newShortcut.name);

    return newShortcut;
  } catch (error) {
    console.error('Error in handleSaveShortcutViaStorageManager:', error);
    throw error;
  }
}

// 添加测试快速添加功能的按钮事件
document.addEventListener('DOMContentLoaded', () => {
  const testQuickAddBtn = document.getElementById('test-quick-add-btn');
  if (testQuickAddBtn) {
    testQuickAddBtn.addEventListener('click', () => {
      testQuickAddFunction();
    });
  }
});

// 测试快速添加功能
function testQuickAddFunction() {
  console.log('Testing quick add function...');

  // 检查扩展API是否可用
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    alert('❌ Chrome 扩展 API 不可用\n\n这可能是因为：\n1. 扩展未正确加载\n2. 权限配置错误\n3. 在不支持的页面上运行');
    return;
  }


}