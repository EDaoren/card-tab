/**
 * Search handler for the Card Tab extension
 */

class SearchManager {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.searchButton = document.querySelector('.search-button');
    this.searchEngineSelector = document.querySelector('.search-engine-selector');
    this.searchEngineIcon = document.querySelector('.search-engine-icon');
    this.searchEngineDropdownMenu = document.querySelector('.search-engine-dropdown-menu');
    this.searchContainer = document.querySelector('.search-container');
    this.searchBox = document.querySelector('.search-box');
    this.categoriesContainer = document.getElementById('categories-container');

    // 防抖相关
    this.searchDebounceTimer = null;
    this.searchDebounceDelay = 200; // 200ms防抖延迟

    // 创建搜索结果下拉框
    this.createSearchDropdown();

    // 搜索引擎配置 - 符合Chrome Web Store政策
    this.searchEngines = [
      {
        id: 'default',
        name: '默认搜索',
        icon: 'language', // Material Icons
        iconType: 'material',
        useDefault: true
      },
      {
        id: 'google',
        name: 'Google',
        icon: 'G',
        iconType: 'badge',
        badgeClass: 'search-engine-badge-google',
        url: 'https://www.google.com/search?q='
      },
      {
        id: 'bing',
        name: 'Bing',
        icon: 'B',
        iconType: 'badge',
        badgeClass: 'search-engine-badge-bing',
        url: 'https://www.bing.com/search?q='
      },
      {
        id: 'baidu',
        name: '百度',
        icon: '百',
        iconType: 'badge',
        badgeClass: 'search-engine-badge-baidu',
        url: 'https://www.baidu.com/s?wd='
      },
      {
        id: 'ddg',
        name: 'DuckDuckGo',
        icon: 'D',
        iconType: 'badge',
        badgeClass: 'search-engine-badge-ddg',
        url: 'https://duckduckgo.com/?q='
      }
    ];

    this.currentSearchEngine = 0; // 默认使用第一个（Default）
    this.isSearching = false;
    this.renderSearchEngineOptions();
    this.bindEvents();
    this.updateSearchEngineIcon();
    this.loadPreferredSearchEngine();

    // 检查Chrome Search API可用性
    //this.checkSearchAPIAvailability();
  }

  /**
   * Create search dropdown element
   */
  createSearchDropdown() {
    this.searchDropdown = document.createElement('div');
    this.searchDropdown.className = 'search-dropdown';
    this.searchDropdown.style.display = 'none';

    // 插入到搜索框中，作为搜索框的一部分
    this.searchBox.appendChild(this.searchDropdown);
  }

  renderSearchEngineOptions() {
    if (!this.searchEngineDropdownMenu) {
      return;
    }

    this.searchEngineDropdownMenu.textContent = '';

    this.searchEngines.forEach((engine) => {
      const option = document.createElement('div');
      option.className = 'search-engine-option';
      option.dataset.engine = engine.id;

      option.appendChild(this.createSearchEngineIconNode(engine, true));

      const label = document.createElement('span');
      label.textContent = engine.name;
      option.appendChild(label);

      this.searchEngineDropdownMenu.appendChild(option);
    });
  }

  createSearchEngineIconNode(engine, isOption = false) {
    if (engine.iconType === 'material') {
      const icon = document.createElement('span');
      icon.className = `${isOption ? '' : 'search-engine-icon '}material-symbols-rounded`.trim();
      if (!isOption) {
        icon.classList.add('search-engine-icon');
      }
      icon.textContent = engine.icon;
      return icon;
    }

    const badge = document.createElement('span');
    badge.className = `search-engine-badge ${engine.badgeClass || ''}`.trim();
    if (!isOption) {
      badge.classList.add('search-engine-icon');
    }
    badge.textContent = engine.icon;
    return badge;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Search input keydown
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });

    // Real-time search filtering with debounce
    this.searchInput.addEventListener('input', (e) => {
      this.debouncedSearch(e.target.value);
    });

    // Search input focus
    this.searchInput.addEventListener('focus', () => {
      this.isSearching = true;
      if (this.searchInput.value.trim()) {
        this.showSearchDropdown();
      }
    });

    // Search input blur (with delay to allow clicking on results)
    this.searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        this.hideSearchDropdown();
        this.isSearching = false;
      }, 150);
    });

    // Search button click
    if (this.searchButton) {
      this.searchButton.addEventListener('click', () => {
        this.handleSearch();
      });
    }

    // Search engine selector click
    if (this.searchEngineSelector) {
      this.searchEngineSelector.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    if (this.searchEngineDropdownMenu) {
      this.searchEngineDropdownMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.search-engine-option');
        if (!option) {
          return;
        }

        e.stopPropagation();
        const engineId = option.dataset.engine;
        const engineIndex = this.searchEngines.findIndex(engine => engine.id === engineId);
        this.selectSearchEngine(engineIndex);
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.closeDropdown();
    });

    // Global keyboard shortcut for focusing search (/)
    document.addEventListener('keydown', (e) => {
      // Check if not already focusing on an input
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.searchInput.focus();
      }
    });
  }

  /**
   * Debounced search to improve performance
   * @param {string} query - The search query
   */
  debouncedSearch(query) {
    // 清除之前的定时器
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // 设置新的定时器
    this.searchDebounceTimer = setTimeout(() => {
      this.handleRealTimeSearch(query);
    }, this.searchDebounceDelay);
  }

  /**
   * Handle real-time search filtering
   * @param {string} query - The search query
   */
  handleRealTimeSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      // Hide dropdown when search is empty
      this.hideSearchDropdown();
      return;
    }

    // Show search results in dropdown
    this.showSearchResults(trimmedQuery);
  }

  /**
   * Show search dropdown
   */
  showSearchDropdown() {
    this.searchDropdown.style.display = 'block';
    this.searchBox.classList.add('has-results');
  }

  /**
   * Hide search dropdown
   */
  hideSearchDropdown() {
    this.searchDropdown.style.display = 'none';
    this.searchBox.classList.remove('has-results');
  }

  /**
   * Show search results in dropdown
   * @param {string} query - The search query (lowercase)
   */
  showSearchResults(query) {
    // Check if storageManager is initialized and has data
    if (!storageManager || !storageManager.data || !storageManager.data.categories) {
      this.renderSearchResults([]);
      this.showSearchDropdown();
      return;
    }

    const categories = storageManager.getCategories();
    let results = [];

    // Collect matching shortcuts
    categories.forEach(category => {
      const categoryMatches = category.name.toLowerCase().includes(query);
      const matchingShortcuts = category.shortcuts.filter(shortcut =>
        shortcut.name.toLowerCase().includes(query) ||
        shortcut.url.toLowerCase().includes(query)
      );

      if (categoryMatches) {
        results.push({
          type: 'category',
          data: category,
          query: query
        });
      }

      matchingShortcuts.forEach(shortcut => {
        results.push({
          type: 'shortcut',
          data: shortcut,
          category: category,
          query: query
        });
      });
    });

    // Limit results to 8 items
    results = results.slice(0, 8);

    this.renderSearchResults(results);
    this.showSearchDropdown();
  }

  /**
   * Render search results in dropdown
   */
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

        if (result.data.iconType === 'favicon' && result.data.iconUrl) {
          const image = document.createElement('img');
          image.src = result.data.iconUrl;
          image.alt = result.data.name;
          image.addEventListener('error', () => {
            icon.textContent = result.data.name.charAt(0).toUpperCase();
          });
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
        ? `分类 • ${result.data.shortcuts.length} 个快捷方式`
        : `${result.category.name} • ${result.data.url}`;

      content.appendChild(title);
      content.appendChild(subtitle);
      item.appendChild(icon);
      item.appendChild(content);
      fragment.appendChild(item);
    });

    this.searchDropdown.appendChild(fragment);

    // 绑定点击事件
    this.bindSearchResultEvents();
  }

  /**
   * Bind click events to search results (使用事件委托提高性能)
   */
  bindSearchResultEvents() {
    // 使用事件委托，只在dropdown上绑定一次事件
    if (!this.searchDropdown.hasEventListener) {
      this.searchDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item) {
          this.handleSearchResultClick({ currentTarget: item });
        }
      });
      this.searchDropdown.hasEventListener = true;
    }
  }

  /**
   * Handle search result click
   */
  handleSearchResultClick(e) {
    const item = e.currentTarget;
    const type = item.dataset.type;

    if (type === 'category') {
      const categoryId = item.dataset.id;
      this.selectCategory(categoryId);
    } else if (type === 'shortcut') {
      const url = item.dataset.url;
      this.selectShortcut(url);
    }
  }

  /**
   * Highlight matching text
   */
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

  /**
   * Select category from search results
   */
  selectCategory(categoryId) {
    this.hideSearchDropdown();
    this.searchInput.value = '';
    // Scroll to category or highlight it
    const categoryElement = document.querySelector(`.category-card[data-id="${categoryId}"]`);
    if (categoryElement) {
      categoryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      categoryElement.style.animation = 'highlight-pulse 2s ease-in-out';
    }
  }

  /**
   * Select shortcut from search results
   */
  selectShortcut(url) {
    console.log('SearchManager: 点击快捷方式，URL:', url);
    this.hideSearchDropdown();
    this.searchInput.value = '';

    try {
      // 确保URL格式正确
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      console.log('SearchManager: 打开URL:', url);
      window.open(url, '_blank');
    } catch (error) {
      console.error('SearchManager: 打开URL失败:', error);
      // 降级：直接设置window.location
      window.location.href = url;
    }
  }

  /**
   * Handle search action (Enter key or search button)
   */
  handleSearch() {
    const query = this.searchInput.value.trim();

    if (!query) {
      return;
    }

    // Check if it's a URL (has dots and no spaces)
    if (this.isUrl(query)) {
      this.navigateToUrl(query);
    } else {
      // Otherwise, perform Google search
      this.performSearch(query);
    }
  }

  /**
   * Check if the query is a URL
   * @param {string} query - The search query
   * @returns {boolean} True if the query is a URL
   */
  isUrl(query) {
    // Simple URL validation (has dots, no spaces)
    return query.includes('.') && !query.includes(' ');
  }

  /**
   * Navigate to URL
   * @param {string} url - The URL to navigate to
   */
  navigateToUrl(url) {
    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    window.location.href = url;
  }

  /**
   * Perform search using current search engine
   * Compliant with Chrome Web Store policies:
   * - Default option uses chrome.search API (respects user's browser settings)
   * - Other options open in new tab (doesn't modify default settings)
   * @param {string} query - The search query
   */
  performSearch(query) {
    const currentEngine = this.searchEngines[this.currentSearchEngine];

    if (currentEngine.useDefault) {
      // Use Chrome Search API to respect user's default search engine
      console.log('Checking Chrome Search API availability...');
      console.log('chrome:', typeof chrome);
      console.log('chrome.search:', typeof chrome?.search);
      console.log('chrome.search.query:', typeof chrome?.search?.query);

      if (chrome && chrome.search && typeof chrome.search.query === 'function') {
        try {
          console.log('Calling Chrome Search API with query:', query);
          // 使用Chrome Search API，让浏览器决定行为
          chrome.search.query({
            text: query,
            disposition: 'CURRENT_TAB'
          });
          console.log('Chrome Search API called successfully');
        } catch (error) {
          console.error('Chrome Search API call failed:', error);
          window.showNotification('默认搜索功能暂时不可用，请尝试其他搜索引擎', 'warning');
          return;
        }
      } else {
        // Chrome Search API不可用时的处理
        const debugInfo = {
          chrome: typeof chrome,
          search: typeof chrome?.search,
          query: typeof chrome?.search?.query,
          permissions: chrome?.runtime?.getManifest?.()?.permissions
        };
        console.error('Chrome Search API not available:', debugInfo);
        window.showNotification('默认搜索功能不可用，请使用其他搜索引擎或重新加载扩展', 'warning');
        return;
      }
    } else {
      // For specific search engines, open in new tab
      const searchUrl = currentEngine.url + encodeURIComponent(query);
      window.open(searchUrl, '_blank');
    }
  }



  /**
   * Toggle dropdown menu
   */
  toggleDropdown() {
    const isOpen = this.searchEngineSelector.classList.contains('open');
    if (isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown menu
   */
  openDropdown() {
    this.searchEngineSelector.classList.add('open');
    this.updateActiveOption();
  }

  /**
   * Close dropdown menu
   */
  closeDropdown() {
    this.searchEngineSelector.classList.remove('open');
  }

  /**
   * Select search engine
   * @param {number} engineIndex - Index of the search engine
   */
  selectSearchEngine(engineIndex) {
    if (engineIndex < 0 || engineIndex >= this.searchEngines.length) {
      return;
    }

    this.currentSearchEngine = engineIndex;
    this.updateSearchEngineIcon();
    this.updateActiveOption();
    this.closeDropdown();

    this.savePreferredSearchEngine();
  }

  /**
   * Update active option in dropdown
   */
  updateActiveOption() {
    const options = this.searchEngineDropdownMenu?.querySelectorAll('.search-engine-option') || [];
    const currentEngineId = this.searchEngines[this.currentSearchEngine].id;
    options.forEach((option) => {
      option.classList.toggle('active', option.dataset.engine === currentEngineId);
    });
  }

  /**
   * Update search engine icon
   */
  updateSearchEngineIcon() {
    const iconElement = document.querySelector('.search-engine-selector .search-engine-icon');
    if (iconElement) {
      const currentEngine = this.searchEngines[this.currentSearchEngine];

      iconElement.replaceWith(this.createCurrentEngineIcon(currentEngine));
    }
    this.updateActiveOption();
  }

  createCurrentEngineIcon(engine) {
    const iconNode = this.createSearchEngineIconNode(engine);
    iconNode.title = `当前搜索引擎: ${engine.name}`;
    return iconNode;
  }

  savePreferredSearchEngine() {
    if (chrome?.storage?.sync) {
      chrome.storage.sync.set({ preferredSearchEngine: this.currentSearchEngine });
      return;
    }

    globalThis.__cardTabSearchPreferences = {
      preferredSearchEngine: this.currentSearchEngine
    };
  }

  /**
   * Load user's preferred search engine
   */
  loadPreferredSearchEngine() {
    if (chrome?.storage?.sync) {
      chrome.storage.sync.get(['preferredSearchEngine'], (result) => {
        this.applySavedSearchEngine(result.preferredSearchEngine);
      });
      return;
    }

    this.applySavedSearchEngine(globalThis.__cardTabSearchPreferences?.preferredSearchEngine);
  }

  applySavedSearchEngine(savedIndex) {
    if (savedIndex === undefined || savedIndex === null) {
      this.updateSearchEngineIcon();
      return;
    }

    const parsedIndex = parseInt(savedIndex, 10);
    if (parsedIndex >= 0 && parsedIndex < this.searchEngines.length) {
      this.currentSearchEngine = parsedIndex;
    } else {
      this.currentSearchEngine = 0;
      this.savePreferredSearchEngine();
    }

    this.updateSearchEngineIcon();
  }

  /**
   * 检查Chrome Search API可用性
   */
  checkSearchAPIAvailability() {
    console.log('=== Chrome Search API 可用性检查 ===');

    // 检查基本环境
    console.log('1. 基本环境检查:');
    console.log('   - chrome对象:', typeof chrome);
    console.log('   - chrome.search:', typeof chrome?.search);
    console.log('   - chrome.search.query:', typeof chrome?.search?.query);

    // 检查权限
    if (chrome && chrome.runtime && chrome.runtime.getManifest) {
      const manifest = chrome.runtime.getManifest();
      console.log('2. 权限检查:');
      console.log('   - manifest权限:', manifest.permissions);
      console.log('   - 包含search权限:', manifest.permissions?.includes('search'));
    }

    // 检查扩展环境
    console.log('3. 扩展环境:');
    console.log('   - 扩展ID:', chrome?.runtime?.id);
    console.log('   - 当前URL:', window.location.href);

    // 尝试权限检查API
    if (chrome && chrome.permissions && chrome.permissions.contains) {
      chrome.permissions.contains({permissions: ['search']}, (result) => {
        console.log('4. 动态权限检查 - search:', result);
        if (!result) {
          console.warn('⚠️ Search权限未授予，可能需要重新加载扩展');
        }
      });
    }

    // 如果chrome.search.query不可用，给出具体建议
    if (chrome?.search && typeof chrome.search.query !== 'function') {
      console.warn('⚠️ chrome.search.query不可用，建议:');
      console.warn('   1. 重新加载扩展 (chrome://extensions/)');
      console.warn('   2. 检查Chrome版本是否支持');
      console.warn('   3. 确认扩展权限已正确授予');
    }

    console.log('=== 检查完成 ===');
  }
}

// Create instance - will be initialized in main.js
let searchManager;
