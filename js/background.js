/**
 * Background script for Card Tab extension
 * Handles context menus, keyboard shortcuts, and quick add functionality
 */

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log('Card Tab: Background script installed');

  // 创建主菜单项
  chrome.contextMenus.create({
    id: "add-to-card-tab",
    title: "添加到 Card Tab",
    contexts: ["page", "link"]
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
    contexts: ["page"]
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
    contexts: ["link"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error creating link menu:', chrome.runtime.lastError);
    } else {
      console.log('Link context menu created');
    }
  });
});

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

    // 获取现有数据
    const result = await getCardTabData();

    if (!result.data.categories || !Array.isArray(result.data.categories)) {
      throw new Error('没有找到分类数据');
    }

    // 找到目标分类
    const targetCategory = result.data.categories.find(cat => cat.id === shortcutData.categoryId);
    if (!targetCategory) {
      throw new Error('找不到指定的分类');
    }

    // 添加快捷方式到分类
    if (!targetCategory.shortcuts) {
      targetCategory.shortcuts = [];
    }
    targetCategory.shortcuts.push(newShortcut);

    // 保存更新后的数据
    await saveCardTabData(result);

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

    // 获取所有sync存储数据，找到包含categories的键
    const allSyncData = await chrome.storage.sync.get(null);
    console.log('Background: All sync storage keys:', Object.keys(allSyncData));
    console.log('Background: Full sync storage:', JSON.stringify(allSyncData, null, 2));

    let categories = null;
    let foundKey = null;

    // 遍历所有键，找到包含categories的数据
    for (const [key, value] of Object.entries(allSyncData)) {
      if (value && typeof value === 'object' && value.categories && Array.isArray(value.categories)) {
        categories = value.categories;
        foundKey = key;
        console.log(`Background: Found categories in sync storage with key "${key}"`);
        console.log(`Background: Found ${categories.length} categories`);
        console.log('Background: Category names:', categories.map(c => c.name));
        break;
      }
    }

    if (!foundKey) {
      console.log('Background: No categories found in any sync storage key');
    }

    // 如果 sync 中没有找到，尝试 local 存储
    if (!categories) {
      console.log('Background: No categories in sync, checking local storage...');
      const allLocalData = await chrome.storage.local.get(null);
      console.log('Background: All local storage keys:', Object.keys(allLocalData));
      console.log('Background: Full local storage:', JSON.stringify(allLocalData, null, 2));

      // 遍历所有local键，找到包含categories的数据
      for (const [key, value] of Object.entries(allLocalData)) {
        if (value && typeof value === 'object' && value.categories && Array.isArray(value.categories)) {
          categories = value.categories;
          console.log(`Background: Found categories in local storage with key "${key}"`);
          console.log(`Background: Found ${categories.length} categories in local`);
          break;
        }
      }

      if (!categories) {
        console.log('Background: No valid categories found in local storage either');
      }
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

      console.log('Background: Processed categories for transmission:', validCategories);
      return validCategories;
    }

    console.log('Background: No categories found in any storage, using fallback categories');

    // 回退方案：提供一些默认分类
    const fallbackCategories = [
      { id: 'cat-default-1', name: '默认分类', color: '#4285f4' },
      { id: 'cat-default-2', name: '工作', color: '#34a853' },
      { id: 'cat-default-3', name: '娱乐', color: '#ea4335' }
    ];

    console.log('Background: Using fallback categories:', fallbackCategories);
    return fallbackCategories;
  } catch (error) {
    console.error("Background: Error loading categories:", error);

    // 错误时也返回回退分类
    return [
      { id: 'cat-error-1', name: '默认分类', color: '#4285f4' }
    ];
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
