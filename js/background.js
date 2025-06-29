/**
 * Background script for Card Tab extension
 * Handles context menus, keyboard shortcuts, and quick add functionality
 */

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log('Card Tab: Background script installed');
  createContextMenus();
});

// 确保在启动时也创建菜单（备用方案）
chrome.runtime.onStartup.addListener(() => {
  console.log('Card Tab: Background script startup');
  createContextMenus();
});

// 提取菜单创建逻辑为独立函数
function createContextMenus() {
  console.log('Card Tab: Creating context menus...');

  // 先清除所有现有菜单
  chrome.contextMenus.removeAll(() => {
    // 创建主菜单项
    chrome.contextMenus.create({
      id: "add-to-card-tab",
      title: "Card Tab 卡片式导航",
      contexts: ["page", "link"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating main menu:', chrome.runtime.lastError);
      } else {
        console.log('Main context menu created');
      }
    });

    // 创建子菜单 - 添加当前页面
    chrome.contextMenus.create({
      id: "add-current-page",
      parentId: "add-to-card-tab",
      title: "添加当前页面",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating page menu:', chrome.runtime.lastError);
      } else {
        console.log('Page context menu created');
      }
    });

    // 创建子菜单 - 添加链接
    chrome.contextMenus.create({
      id: "add-link",
      parentId: "add-to-card-tab",
      title: "添加此链接",
      contexts: ["link"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating link menu:', chrome.runtime.lastError);
      } else {
        console.log('Link context menu created');
      }
    });
  });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, tab);

  if (info.menuItemId === "add-current-page") {
    console.log('Adding current page:', tab.url);
    handleAddCurrentPage(tab);
  } else if (info.menuItemId === "add-link") {
    console.log('Adding link:', info.linkUrl);
    handleAddLink(info, tab);
  }
});

// 快捷键功能已移除，避免冲突

// 处理添加当前页面
async function handleAddCurrentPage(tab) {
  try {
    const pageInfo = {
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl
    };

    console.log('Background: Handling add current page for:', pageInfo.title);

    // 获取分类数据
    const categoriesData = await loadCategoriesForContentScript();
    console.log('Background: Categories to send to content script:', categoriesData);

    // 发送消息到内容脚本显示快速添加界面
    await chrome.tabs.sendMessage(tab.id, {
      action: "showQuickAdd",
      pageInfo: pageInfo,
      categories: categoriesData
    });

    console.log('Background: Message sent to content script successfully');
  } catch (error) {
    console.error("Error handling add current page:", error);
    console.log('Background: Content script not available on this page');
  }
}

// 处理添加链接
async function handleAddLink(info, tab) {
  try {
    const linkInfo = {
      url: info.linkUrl,
      title: info.selectionText || extractDomainFromUrl(info.linkUrl),
      favIconUrl: null
    };

    console.log('Background: Handling add link for:', linkInfo.url);

    // 获取分类数据
    const categoriesData = await loadCategoriesForContentScript();

    // 发送消息到内容脚本显示快速添加界面
    await chrome.tabs.sendMessage(tab.id, {
      action: "showQuickAdd",
      pageInfo: linkInfo,
      categories: categoriesData
    });

    console.log('Background: Link add message sent successfully');
  } catch (error) {
    console.error("Error handling add link:", error);
    console.log('Background: Content script not available on this page');
  }
}

// 这个函数已被移除，现在总是在当前页面显示快速添加对话框

// 从URL提取域名作为标题
function extractDomainFromUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '').split('.')[0];
  } catch (error) {
    return url;
  }
}

// 直接在后台脚本中保存快捷方式
async function saveShortcutDirectly(shortcutData) {
  try {
    console.log('Background: Saving shortcut directly:', shortcutData);

    // 生成唯一ID
    const shortcutId = 'shortcut-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // 创建完整的快捷方式对象
    const newShortcut = {
      id: shortcutId,
      name: shortcutData.name,
      url: shortcutData.url,
      iconType: shortcutData.iconType || 'favicon',
      iconColor: shortcutData.iconColor || '#4285f4',
      iconUrl: shortcutData.iconUrl || '',
      order: Date.now() // 使用时间戳作为排序
    };

    // 使用新的数据获取方式（与 loadCategoriesForContentScript 一致）
    const result = await getCurrentConfigData();

    if (!result.data.categories || !Array.isArray(result.data.categories)) {
      throw new Error('没有找到分类数据');
    }

    // 找到目标分类
    const targetCategory = result.data.categories.find(cat => cat.id === shortcutData.categoryId);
    if (!targetCategory) {
      throw new Error(`找不到指定的分类: ${shortcutData.categoryId}`);
    }

    // 添加快捷方式到分类
    if (!targetCategory.shortcuts) {
      targetCategory.shortcuts = [];
    }
    targetCategory.shortcuts.push(newShortcut);

    // 保存更新后的数据
    await saveCurrentConfigData(result);

    console.log('Background: Shortcut saved successfully:', newShortcut);
    return newShortcut;
  } catch (error) {
    console.error('Background: Error saving shortcut directly:', error);
    throw error;
  }
}

// 获取Card Tab数据的辅助函数
async function getCardTabData() {
  // 获取所有sync存储数据，找到包含categories的键
  const allSyncData = await chrome.storage.sync.get(null);

  // 遍历所有键，找到包含categories的数据
  for (const [key, value] of Object.entries(allSyncData)) {
    if (value && typeof value === 'object' && value.categories && Array.isArray(value.categories)) {
      return { key, data: value };
    }
  }

  // 如果sync中没有找到，尝试local存储
  const allLocalData = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(allLocalData)) {
    if (value && typeof value === 'object' && value.categories && Array.isArray(value.categories)) {
      return { key, data: value };
    }
  }

  throw new Error('未找到Card Tab数据');
}

// 保存Card Tab数据的辅助函数
async function saveCardTabData(result) {
  // 根据数据来源保存到对应的存储
  if (result.key.includes('sync') || !result.key.includes('local')) {
    await chrome.storage.sync.set({ [result.key]: result.data });
  } else {
    await chrome.storage.local.set({ [result.key]: result.data });
  }
}

// 为内容脚本加载分类数据
async function loadCategoriesForContentScript() {
  try {
    console.log('Background: Loading categories for content script...');

    // 1. 获取 app_data 以确定当前配置
    const appDataResult = await chrome.storage.local.get(['app_data']);
    const appData = appDataResult.app_data;

    if (!appData || !appData.currentUser) {
      console.log('Background: No app_data found, using fallback');
      return getFallbackCategories();
    }

    const currentConfigId = appData.currentUser.configId;
    console.log('Background: Current config ID:', currentConfigId);

    // 2. 根据配置类型加载数据
    const currentConfig = appData.userConfigs[currentConfigId];
    if (!currentConfig) {
      console.log('Background: Current config not found, using fallback');
      return getFallbackCategories();
    }

    let categories = null;

    if (currentConfig.type === 'chrome') {
      // 从 Chrome Sync 加载
      const storageKey = currentConfig.storageLocation.key;
      const result = await chrome.storage.sync.get([storageKey]);
      const data = result[storageKey];
      categories = data?.categories;
      console.log(`Background: Loaded ${categories?.length || 0} categories from Chrome Sync`);
    } else if (currentConfig.type === 'supabase') {
      // 从缓存加载（Chrome Storage Local）
      const cacheKey = `cardTabData_${currentConfigId}`;
      const result = await chrome.storage.local.get([cacheKey]);
      const data = result[cacheKey];
      categories = data?.categories;
      console.log(`Background: Loaded ${categories?.length || 0} categories from cache`);
    }

    if (categories && categories.length > 0) {
      // 处理找到的分类数据
      const sortedCategories = categories.sort((a, b) => (a.order || 0) - (b.order || 0));

      // 创建简化的分类对象用于传递
      const validCategories = sortedCategories
        .filter(cat => cat && cat.id && cat.name)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          color: cat.color || '#4285f4'
        }));

      console.log(`Background: Returning ${validCategories.length} valid categories`);
      return validCategories;
    }

    console.log('Background: No categories found, using fallback');
    return getFallbackCategories();
  } catch (error) {
    console.error("Background: Error loading categories:", error);
    return getFallbackCategories();
  }
}

// 获取回退分类
function getFallbackCategories() {
  const fallbackCategories = [
    { id: 'cat-default-1', name: '默认分类', color: '#4285f4' },
    { id: 'cat-default-2', name: '工作', color: '#34a853' },
    { id: 'cat-default-3', name: '娱乐', color: '#ea4335' }
  ];

  console.log('Background: Using fallback categories:', fallbackCategories);
  return fallbackCategories;
}

// 获取当前配置的数据（与 loadCategoriesForContentScript 逻辑一致）
async function getCurrentConfigData() {
  try {
    // 1. 获取 app_data 以确定当前配置
    const appDataResult = await chrome.storage.local.get(['app_data']);
    const appData = appDataResult.app_data;

    if (!appData || !appData.currentUser) {
      throw new Error('未找到应用配置数据');
    }

    const currentConfigId = appData.currentUser.configId;

    // 2. 根据配置类型加载数据
    const currentConfig = appData.userConfigs[currentConfigId];
    if (!currentConfig) {
      throw new Error(`当前配置 ${currentConfigId} 不存在`);
    }

    let data = null;
    let storageKey = null;

    if (currentConfig.type === 'chrome') {
      // 从 Chrome Sync 加载
      storageKey = currentConfig.storageLocation.key;
      const result = await chrome.storage.sync.get([storageKey]);
      data = result[storageKey];
    } else if (currentConfig.type === 'supabase') {
      // 从缓存加载（Chrome Storage Local）
      storageKey = `cardTabData_${currentConfigId}`;
      const result = await chrome.storage.local.get([storageKey]);
      data = result[storageKey];
    }

    if (!data) {
      throw new Error(`未找到配置 ${currentConfigId} 的数据`);
    }

    return {
      key: storageKey,
      data: data,
      configType: currentConfig.type,
      configId: currentConfigId
    };
  } catch (error) {
    console.error('Background: Error getting current config data:', error);
    throw error;
  }
}

// 保存当前配置的数据
async function saveCurrentConfigData(result) {
  try {
    if (result.configType === 'chrome') {
      // 保存到 Chrome Sync
      await chrome.storage.sync.set({ [result.key]: result.data });
    } else if (result.configType === 'supabase') {
      // 保存到缓存（Chrome Storage Local）
      // 注意：这里只更新缓存，实际的云端同步由主页面的数据管理器处理
      await chrome.storage.local.set({ [result.key]: result.data });
    }
  } catch (error) {
    console.error('Background: Error saving current config data:', error);
    throw error;
  }
}

// 处理来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  if (request.action === "test") {
    // 测试消息
    console.log('Test message received');
    sendResponse({ success: true, message: "Background script is working" });
    return true;
  }

  if (request.action === "saveQuickAdd") {
    console.log('Save quick add request:', request.data);

    // 直接在后台脚本中保存，不创建新标签页
    saveShortcutDirectly(request.data)
      .then((result) => {
        console.log('Save successful:', result);
        sendResponse({ success: true, shortcut: result });
      })
      .catch((error) => {
        console.error("Error saving shortcut:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放
  }



  // 未知消息类型
  console.log('Unknown message action:', request.action);
  sendResponse({ success: false, error: 'Unknown action' });
});

// 旧的保存逻辑已移除，现在使用Card Tab的storageManager
