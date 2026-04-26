/**
 * Search handler for the Card Tab extension.
 */

class SearchManager {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.searchButton = document.querySelector('.search-button');
    this.searchEngineSelector = document.querySelector('.search-engine-selector');
    this.searchEnginePanelList = document.querySelector('.search-engine-panel-list');
    this.searchContainer = document.querySelector('.search-container');
    this.searchBox = document.querySelector('.search-box');
    this.categoriesContainer = document.getElementById('categories-container');

    this.searchDebounceTimer = null;
    this.searchDebounceDelay = 200;
    this.searchEngines = [];
    this.engineMap = new Map();
    this.currentSearchEngineId = 'browser-default';
    this.searchSettings = window.unifiedDataManager?.getDefaultSearchSettings?.()
      || {
        defaultEngineId: 'browser-default',
        enabledEngineIds: ['browser-default'],
        customEngines: [],
        openInNewTab: true
      };
    this.isSearching = false;
    this.isEnginePanelOpen = false;

    if (!this.searchInput || !this.searchBox) {
      return;
    }

    this.createSearchDropdown();
    this.bindEvents();
    this.refreshSearchEngineConfig();
  }

  createSearchDropdown() {
    this.searchDropdown = document.createElement('div');
    this.searchDropdown.className = 'search-dropdown';
    this.searchDropdown.style.display = 'none';
    this.searchBox.appendChild(this.searchDropdown);
  }

  getSearchSettings() {
    const currentConfigData = window.unifiedDataManager?.getCurrentConfigData?.();
    const rawSearchSettings = currentConfigData?.settings?.search || null;

    if (window.unifiedDataManager?.normalizeSearchSettings) {
      return window.unifiedDataManager.normalizeSearchSettings(rawSearchSettings);
    }

    return {
      defaultEngineId: 'browser-default',
      enabledEngineIds: ['browser-default'],
      customEngines: [],
      openInNewTab: true
    };
  }

  async saveSearchSettings(partialSearchSettings = {}) {
    const currentThemeId = window.unifiedDataManager?.appData?.currentThemeId;
    if (!currentThemeId) {
      return;
    }

    if (window.unifiedDataManager?.updateThemeSearchSettings) {
      await window.unifiedDataManager.updateThemeSearchSettings(currentThemeId, partialSearchSettings);
      window.storageManager?.updateDataFromUnified?.();
      return;
    }

    const currentConfigData = window.unifiedDataManager?.getCurrentConfigData?.() || {};
    const currentSearchSettings = this.getSearchSettings();
    await window.unifiedDataManager?.saveCurrentConfigData?.({
      ...currentConfigData,
      settings: {
        ...(currentConfigData.settings || {}),
        search: {
          ...currentSearchSettings,
          ...(partialSearchSettings || {})
        }
      }
    });
    window.storageManager?.updateDataFromUnified?.();
  }

  refreshSearchEngineConfig() {
    const searchSettings = this.getSearchSettings();
    const resolvedSearchState = window.SearchEngineRegistry?.resolveSearchState
      ? window.SearchEngineRegistry.resolveSearchState(searchSettings)
      : {
        defaultEngineId: searchSettings.defaultEngineId || 'browser-default',
        enabledEngineIds: searchSettings.enabledEngineIds || ['browser-default'],
        openInNewTab: searchSettings.openInNewTab !== false,
        allEngines: [],
        enabledEngines: [],
        customEngines: searchSettings.customEngines || [],
        engineMap: new Map()
      };

    this.searchSettings = {
      defaultEngineId: resolvedSearchState.defaultEngineId,
      enabledEngineIds: resolvedSearchState.enabledEngineIds.slice(),
      customEngines: resolvedSearchState.customEngines.slice(),
      openInNewTab: resolvedSearchState.openInNewTab
    };
    this.searchEngines = resolvedSearchState.enabledEngines.slice();
    this.engineMap = resolvedSearchState.engineMap;
    this.currentSearchEngineId = this.searchSettings.defaultEngineId;

    this.renderSearchEnginePanel();
    this.updateSearchEngineIcon();
  }

  renderSearchEnginePanel() {
    if (!this.searchEnginePanelList) {
      return;
    }

    this.searchEnginePanelList.textContent = '';
    const fragment = document.createDocumentFragment();

    this.searchEngines.forEach((engine) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'search-engine-panel-item';
      option.dataset.engine = engine.id;

      const iconWrap = document.createElement('span');
      iconWrap.className = 'search-engine-panel-icon';
      iconWrap.appendChild(this.createSearchEngineIconNode(engine, true));

      const label = document.createElement('span');
      label.className = 'search-engine-panel-label';
      label.textContent = engine.name;

      option.appendChild(iconWrap);
      option.appendChild(label);
      fragment.appendChild(option);
    });

    fragment.appendChild(this.createSearchEngineManageButton());
    this.searchEnginePanelList.appendChild(fragment);
    this.updateActiveOption();
  }

  createSearchEngineManageButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-engine-panel-item search-engine-panel-item-add';
    button.dataset.action = 'manage';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'search-engine-panel-icon search-engine-panel-icon-add';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-rounded';
    icon.textContent = 'add';
    iconWrap.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'search-engine-panel-label';
    label.textContent = '添加';

    button.appendChild(iconWrap);
    button.appendChild(label);
    return button;
  }

  createSearchEngineIconNode(engine, isOption = false) {
    if (!engine) {
      return document.createElement('span');
    }

    if (engine.iconType === 'material') {
      const icon = document.createElement('span');
      icon.className = `${isOption ? '' : 'search-engine-icon '}material-symbols-rounded`.trim();
      if (!isOption) {
        icon.classList.add('search-engine-icon');
      }
      icon.textContent = engine.iconValue || 'language';
      return icon;
    }

    if (engine.iconType === 'local' || engine.iconType === 'image') {
      const image = document.createElement('img');
      image.className = `${isOption ? '' : 'search-engine-icon '}search-engine-image`.trim();
      image.src = engine.iconPath || engine.iconUrl || '';
      image.alt = engine.name || '';
      image.draggable = false;
      image.addEventListener('error', () => {
        if (image.dataset.fallbackApplied === 'true') {
          return;
        }

        image.dataset.fallbackApplied = 'true';
        image.replaceWith(this.createBadgeNode(engine, isOption));
      });
      return image;
    }

    return this.createBadgeNode(engine, isOption);
  }

  createBadgeNode(engine, isOption = false) {
    const badge = document.createElement('span');
    badge.className = `search-engine-badge ${engine.badgeClass || ''}`.trim();
    if (!isOption) {
      badge.classList.add('search-engine-icon');
    }
    badge.textContent = engine.iconValue || window.SearchEngineRegistry?.createBadgeText?.(engine.name) || '?';
    return badge;
  }

  bindEvents() {
    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.handleSearch();
      }
    });

    this.searchInput.addEventListener('input', (event) => {
      this.closeEnginePanel();
      this.debouncedSearch(event.target.value);
    });

    this.searchInput.addEventListener('focus', () => {
      this.isSearching = true;
      this.closeEnginePanel();
      if (this.searchInput.value.trim()) {
        this.showSearchDropdown();
      }
    });

    this.searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        this.hideSearchDropdown();
        this.isSearching = false;
      }, 150);
    });

    this.searchButton?.addEventListener('click', () => {
      this.handleSearch();
    });

    this.searchEngineSelector?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleEnginePanel();
    });

    this.searchEnginePanelList?.addEventListener('click', (event) => {
      const manageButton = event.target.closest('[data-action="manage"]');
      if (manageButton) {
        window.location.href = 'settings.html?openSearchConfig=1';
        return;
      }

      const option = event.target.closest('.search-engine-panel-item[data-engine]');
      if (!option) {
        return;
      }

      void this.selectSearchEngine(option.dataset.engine || '');
    });

    document.addEventListener('click', (event) => {
      const clickedInsideSearch = this.searchContainer?.contains(event.target);
      if (!clickedInsideSearch) {
        this.closeEnginePanel();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        this.searchInput.focus();
      }

      if (event.key === 'Escape') {
        this.closeEnginePanel();
      }
    });
  }

  debouncedSearch(query) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.handleRealTimeSearch(query);
    }, this.searchDebounceDelay);
  }

  handleRealTimeSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      this.hideSearchDropdown();
      return;
    }

    this.showSearchResults(trimmedQuery);
  }

  showSearchDropdown() {
    this.closeEnginePanel();
    this.searchDropdown.style.display = 'block';
    this.searchBox.classList.add('has-results');
  }

  hideSearchDropdown() {
    this.searchDropdown.style.display = 'none';
    this.searchBox.classList.remove('has-results');
  }

  showSearchResults(query) {
    if (!window.storageManager || !window.storageManager.data || !window.storageManager.data.categories) {
      this.renderSearchResults([]);
      this.showSearchDropdown();
      return;
    }

    const categories = window.storageManager.getCategories();
    let results = [];

    categories.forEach((category) => {
      const categoryMatches = category.name.toLowerCase().includes(query);
      const matchingShortcuts = category.shortcuts.filter((shortcut) =>
        shortcut.name.toLowerCase().includes(query) || shortcut.url.toLowerCase().includes(query)
      );

      if (categoryMatches) {
        results.push({
          type: 'category',
          data: category,
          query
        });
      }

      matchingShortcuts.forEach((shortcut) => {
        results.push({
          type: 'shortcut',
          data: shortcut,
          category,
          query
        });
      });
    });

    results = results.slice(0, 8);
    this.renderSearchResults(results);
    this.showSearchDropdown();
  }

  renderSearchResults(results) {
    this.searchDropdown.textContent = '';

    if (results.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'search-result-item no-results';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-rounded';
      icon.textContent = 'search_off';

      const text = document.createElement('span');
      text.textContent = '未找到匹配结果';

      emptyState.appendChild(icon);
      emptyState.appendChild(text);
      this.searchDropdown.appendChild(emptyState);
      return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach((result) => {
      const item = document.createElement('div');
      item.className = `search-result-item ${result.type}-result`;
      item.dataset.type = result.type;

      const icon = document.createElement('div');
      icon.className = `result-icon ${result.type === 'category' ? 'category-icon' : 'shortcut-icon'}`;
      icon.style.backgroundColor = result.type === 'category'
        ? result.data.color
        : (result.data.iconColor || '#4285f4');

      if (result.type === 'category') {
        item.dataset.id = result.data.id;

        const folderIcon = document.createElement('span');
        folderIcon.className = 'material-symbols-rounded';
        folderIcon.textContent = 'folder';
        icon.appendChild(folderIcon);
      } else {
        item.dataset.url = result.data.url;

        if (result.data.iconType === 'favicon') {
          icon.classList.add('shortcut-icon-image');
          const image = document.createElement('img');
          image.alt = result.data.name;
          const fallbackUrl = result.data.iconUrl || '';
          const faviconCandidates = window.FaviconHelper?.getFaviconCandidates
            ? window.FaviconHelper.getFaviconCandidates(result.data.url, fallbackUrl, 32)
            : [fallbackUrl];

          if (window.FaviconHelper?.applyImageFallback) {
            window.FaviconHelper.applyImageFallback(image, faviconCandidates, {
              onExhausted: () => {
                icon.textContent = result.data.name.charAt(0).toUpperCase();
              }
            });
          } else {
            let hasTriedFallbackUrl = false;
            image.addEventListener('error', () => {
              if (!hasTriedFallbackUrl && fallbackUrl && image.src !== fallbackUrl) {
                hasTriedFallbackUrl = true;
                image.src = fallbackUrl;
                return;
              }

              icon.textContent = result.data.name.charAt(0).toUpperCase();
            });
            image.src = faviconCandidates[0] || '';
          }
          icon.appendChild(image);
        } else {
          icon.textContent = result.data.name.charAt(0).toUpperCase();
        }
      }

      const content = document.createElement('div');
      content.className = 'result-content';

      const title = document.createElement('div');
      title.className = 'result-title';
      title.appendChild(this.createHighlightedFragment(result.data.name, result.query));

      const subtitle = document.createElement('div');
      subtitle.className = 'result-subtitle';
      subtitle.textContent = result.type === 'category'
        ? `分类 · ${result.data.shortcuts.length} 个快捷方式`
        : `${result.category.name} · ${result.data.url}`;

      content.appendChild(title);
      content.appendChild(subtitle);
      item.appendChild(icon);
      item.appendChild(content);
      fragment.appendChild(item);
    });

    this.searchDropdown.appendChild(fragment);
    this.bindSearchResultEvents();
  }

  bindSearchResultEvents() {
    if (!this.searchDropdown.hasEventListener) {
      this.searchDropdown.addEventListener('click', async (event) => {
        const item = event.target.closest('.search-result-item');
        if (item) {
          await this.handleSearchResultClick({ currentTarget: item });
        }
      });
      this.searchDropdown.hasEventListener = true;
    }
  }

  async handleSearchResultClick(event) {
    const item = event.currentTarget;
    const type = item.dataset.type;

    if (type === 'category') {
      const categoryId = item.dataset.id;
      await this.selectCategory(categoryId);
    } else if (type === 'shortcut') {
      this.selectShortcut(item.dataset.url);
    }
  }

  createHighlightedFragment(text, query) {
    const fragment = document.createDocumentFragment();
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    const normalizedText = text.toLowerCase();
    let searchStart = 0;
    let matchIndex = normalizedText.indexOf(normalizedQuery, searchStart);

    while (matchIndex !== -1) {
      if (matchIndex > searchStart) {
        fragment.appendChild(document.createTextNode(text.slice(searchStart, matchIndex)));
      }

      const mark = document.createElement('mark');
      mark.textContent = text.slice(matchIndex, matchIndex + normalizedQuery.length);
      fragment.appendChild(mark);

      searchStart = matchIndex + normalizedQuery.length;
      matchIndex = normalizedText.indexOf(normalizedQuery, searchStart);
    }

    if (searchStart < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(searchStart)));
    }

    return fragment;
  }

  async selectCategory(categoryId) {
    this.hideSearchDropdown();
    this.searchInput.value = '';

    const category = window.storageManager?.getCategory?.(categoryId);
    if (category?.collapsed && window.categoryManager?.toggleCategoryCollapse) {
      await window.categoryManager.toggleCategoryCollapse(categoryId);
    }

    const categoryElement = document.querySelector(`.category-card[data-id="${categoryId}"]`);
    if (categoryElement) {
      categoryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      categoryElement.style.animation = 'highlight-pulse 2s ease-in-out';
    }
  }

  selectShortcut(url) {
    this.hideSearchDropdown();
    this.searchInput.value = '';

    try {
      let targetUrl = url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const shortcutOpenMode = window.storageManager?.getSettings?.().shortcutOpenMode || 'new-tab';
      if (shortcutOpenMode === 'current-tab') {
        window.location.href = targetUrl;
      } else {
        window.open(targetUrl, '_blank');
      }
    } catch (error) {
      console.error('SearchManager: failed to open shortcut URL:', error);
      window.location.href = url;
    }
  }

  handleSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      return;
    }

    if (this.isUrl(query)) {
      this.navigateToUrl(query);
      return;
    }

    this.performSearch(query);
  }

  isUrl(query) {
    return query.includes('.') && !query.includes(' ');
  }

  navigateToUrl(url) {
    let targetUrl = url;
    if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = 'https://' + targetUrl;
    }

    window.location.href = targetUrl;
  }

  performSearch(query) {
    const currentEngine = this.engineMap.get(this.currentSearchEngineId)
      || this.engineMap.get(this.searchSettings.defaultEngineId)
      || null;

    if (!currentEngine) {
      this.notify('搜索引擎配置不可用，请检查当前工作空间设置', 'warning');
      return;
    }

    if (currentEngine.type === 'chrome-default') {
      if (chrome?.search && typeof chrome.search.query === 'function') {
        try {
          // Keep browser-default searches fully delegated to Chrome's search API.
          chrome.search.query({
            text: query
          });
        } catch (error) {
          console.error('SearchManager: chrome.search.query failed:', error);
          this.notify('浏览器默认搜索暂时不可用，请尝试其他搜索引擎', 'warning');
        }
        return;
      }

      this.notify('浏览器默认搜索不可用，请重新加载扩展后重试', 'warning');
      return;
    }

    const searchUrl = window.SearchEngineRegistry?.buildSearchUrl
      ? window.SearchEngineRegistry.buildSearchUrl(currentEngine, query)
      : currentEngine.urlTemplate.replace('%s', encodeURIComponent(query));

    if (!searchUrl) {
      this.notify('搜索引擎配置不可用，请检查设置', 'warning');
      return;
    }

    if (this.searchSettings.openInNewTab) {
      window.open(searchUrl, '_blank');
      return;
    }

    window.location.href = searchUrl;
  }

  async selectSearchEngine(engineId) {
    if (!this.engineMap.has(engineId) || !engineId) {
      return;
    }

    const previousEngineId = this.currentSearchEngineId;
    this.currentSearchEngineId = engineId;
    this.updateSearchEngineIcon();
    this.updateActiveOption();
    this.closeEnginePanel();

    try {
      await this.saveSearchSettings({
        defaultEngineId: engineId
      });
      this.refreshSearchEngineConfig();
    } catch (error) {
      console.error('SearchManager: failed to persist search engine selection:', error);
      this.currentSearchEngineId = previousEngineId;
      this.refreshSearchEngineConfig();
      this.notify(`保存默认搜索引擎失败: ${error.message}`, 'error');
    }
  }

  toggleEnginePanel() {
    if (this.isEnginePanelOpen) {
      this.closeEnginePanel();
      return;
    }

    this.openEnginePanel();
  }

  openEnginePanel() {
    this.hideSearchDropdown();
    this.isEnginePanelOpen = true;
    this.searchContainer?.classList.add('engine-panel-open');
    this.searchBox?.classList.add('has-engine-panel');
    this.updateActiveOption();
  }

  closeEnginePanel() {
    this.isEnginePanelOpen = false;
    this.searchContainer?.classList.remove('engine-panel-open');
    this.searchBox?.classList.remove('has-engine-panel');
  }

  updateActiveOption() {
    const options = this.searchEnginePanelList?.querySelectorAll('.search-engine-panel-item[data-engine]') || [];
    options.forEach((option) => {
      option.classList.toggle('active', option.dataset.engine === this.currentSearchEngineId);
    });
  }

  updateSearchEngineIcon() {
    const iconElement = document.querySelector('.search-engine-selector .search-engine-icon');
    const currentEngine = this.engineMap.get(this.currentSearchEngineId)
      || this.engineMap.get(this.searchSettings.defaultEngineId)
      || this.searchEngines[0]
      || null;

    if (iconElement && currentEngine) {
      iconElement.replaceWith(this.createCurrentEngineIcon(currentEngine));
    }

    if (this.searchEngineSelector && currentEngine) {
      this.searchEngineSelector.title = `当前搜索引擎: ${currentEngine.name}`;
    }

    this.updateActiveOption();
  }

  createCurrentEngineIcon(engine) {
    const iconNode = this.createSearchEngineIconNode(engine);
    iconNode.title = `当前搜索引擎: ${engine.name}`;
    return iconNode;
  }

  notify(message, type = 'info') {
    if (window.notification?.[type]) {
      window.notification[type](message);
      return;
    }

    if (window.notification?.show) {
      window.notification.show(message, type, { duration: 3000 });
      return;
    }

    console[type === 'error' ? 'error' : 'warn'](message);
  }
}

let searchManager;
