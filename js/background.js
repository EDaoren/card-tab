try {
  importScripts(
    'supabase.min.js',
    'supabase-client.js',
    'cf-client.js',
    'unified-data-manager.js'
  );
  console.log('Background: Data libraries loaded');
} catch (error) {
  console.warn('Background: Failed to load data libraries', error);
}

const DEFAULT_CATEGORY_COLOR = '#4285f4';

async function ensureBackgroundDataManager() {
  if (typeof globalThis.unifiedDataManager === 'undefined') {
    throw new Error('UnifiedDataManager is unavailable in background');
  }

  await globalThis.unifiedDataManager.init();
  return globalThis.unifiedDataManager;
}

function createDefaultCategory() {
  if (globalThis.unifiedDataManager?.createCategoryRecord) {
    return globalThis.unifiedDataManager.createCategoryRecord({
      color: DEFAULT_CATEGORY_COLOR,
      order: 0
    });
  }

  return {
    id: `cat-${Date.now()}`,
    name: '默认分类',
    color: DEFAULT_CATEGORY_COLOR,
    collapsed: false,
    order: 0,
    shortcuts: []
  };
}

function normalizeCategories(categories = []) {
  return categories
    .filter(category => category && category.id && category.name)
    .slice()
    .sort((left, right) => (left.order || 0) - (right.order || 0));
}

async function ensureUsableCategories(dataManager) {
  const currentData = dataManager.getCurrentConfigData() || await dataManager.loadCurrentConfigData();

  if (!Array.isArray(currentData.categories)) {
    currentData.categories = [];
  }

  if (currentData.categories.length === 0) {
    currentData.categories.push(createDefaultCategory());
    await dataManager.saveCurrentConfigData(currentData);
  }

  return currentData.categories;
}

async function loadCategoriesForContentScript() {
  try {
    const dataManager = await ensureBackgroundDataManager();
    const categories = await ensureUsableCategories(dataManager);

    return normalizeCategories(categories).map(category => ({
      id: category.id,
      name: category.name,
      color: category.color || DEFAULT_CATEGORY_COLOR
    }));
  } catch (error) {
    console.error('Background: Failed to load categories for content script:', error);
    return [];
  }
}

function extractDomainFromUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '').split('.')[0];
  } catch (error) {
    return url;
  }
}

async function sendQuickAddMessage(tabId, pageInfo) {
  const categories = await loadCategoriesForContentScript();

  await chrome.tabs.sendMessage(tabId, {
    action: 'showQuickAdd',
    pageInfo,
    categories
  });
}

function createContextMenus() {
  console.log('Card Tab: Creating context menus...');

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'add-to-card-tab',
      title: 'Card Tab 卡片式导航',
      contexts: ['page', 'link'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });

    chrome.contextMenus.create({
      id: 'add-current-page',
      parentId: 'add-to-card-tab',
      title: '添加当前页面',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });

    chrome.contextMenus.create({
      id: 'add-link',
      parentId: 'add-to-card-tab',
      title: '添加此链接',
      contexts: ['link'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });

    if (chrome.runtime.lastError) {
      console.error('Background: Failed to create context menus', chrome.runtime.lastError);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Card Tab: Background script installed');
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Card Tab: Background script startup');
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) {
    return;
  }

  if (info.menuItemId === 'add-current-page') {
    handleAddCurrentPage(tab);
    return;
  }

  if (info.menuItemId === 'add-link') {
    handleAddLink(info, tab);
  }
});

async function handleAddCurrentPage(tab) {
  try {
    await sendQuickAddMessage(tab.id, {
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl || ''
    });
  } catch (error) {
    console.error('Background: Failed to open quick add for current page:', error);
  }
}

async function handleAddLink(info, tab) {
  try {
    await sendQuickAddMessage(tab.id, {
      url: info.linkUrl,
      title: info.selectionText || extractDomainFromUrl(info.linkUrl),
      favIconUrl: ''
    });
  } catch (error) {
    console.error('Background: Failed to open quick add for link:', error);
  }
}

async function saveShortcutDirectly(shortcutData) {
  const dataManager = await ensureBackgroundDataManager();
  const currentData = dataManager.getCurrentConfigData() || await dataManager.loadCurrentConfigData();

  if (!Array.isArray(currentData.categories)) {
    currentData.categories = [];
  }

  if (currentData.categories.length === 0) {
    currentData.categories.push(createDefaultCategory());
  }

  let targetCategory = currentData.categories.find(category => category.id === shortcutData.categoryId);
  if (!targetCategory) {
    targetCategory = normalizeCategories(currentData.categories)[0] || createDefaultCategory();
    if (!currentData.categories.find(category => category.id === targetCategory.id)) {
      currentData.categories.push(targetCategory);
    }
  }

  if (!Array.isArray(targetCategory.shortcuts)) {
    targetCategory.shortcuts = [];
  }

  const maxOrder = Math.max(...targetCategory.shortcuts.map(shortcut => shortcut.order || 0), -1);
  const newShortcut = {
    id: `shortcut-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: shortcutData.name,
    url: shortcutData.url,
    iconType: shortcutData.iconType || 'favicon',
    iconColor: shortcutData.iconColor || DEFAULT_CATEGORY_COLOR,
    iconUrl: shortcutData.iconUrl || '',
    order: maxOrder + 1
  };

  targetCategory.shortcuts.push(newShortcut);
  await dataManager.saveCurrentConfigData(currentData);

  try {
    await chrome.runtime.sendMessage({
      action: 'dataUpdated',
      source: 'backgroundQuickAdd'
    });
  } catch (error) {
    console.log('Background: No active extension page to notify');
  }

  return newShortcut;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'test') {
    sendResponse({ success: true, message: 'Background script is working' });
    return true;
  }

  if (request.action === 'saveQuickAdd') {
    saveShortcutDirectly(request.data)
      .then((shortcut) => {
        sendResponse({ success: true, shortcut });
      })
      .catch((error) => {
        console.error('Background: Failed to save shortcut:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  sendResponse({ success: false, error: 'Unknown action' });
  return false;
});
