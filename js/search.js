/**
 * Search handler for the Card Tab extension
 */

class SearchManager {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.searchButton = document.querySelector('.search-button');
    this.searchEngineSelector = document.querySelector('.search-engine-selector');
    this.searchEngineIcon = document.querySelector('.search-engine-icon');
    this.searchContainer = document.querySelector('.search-container');
    this.searchBox = document.querySelector('.search-box');
    this.categoriesContainer = document.getElementById('categories-container');

    // 防抖相关
    this.searchDebounceTimer = null;
    this.searchDebounceDelay = 200; // 200ms防抖延迟

    // 创建搜索结果下拉框
    this.createSearchDropdown();

    // 搜索引擎配置
    this.searchEngines = [
      {
        name: 'Google',
        icon: 'https://www.google.com/favicon.ico',
        url: 'https://www.google.com/search?q='
      },
      {
        name: 'Bing',
        icon: 'https://www.bing.com/favicon.ico',
        url: 'https://www.bing.com/search?q='
      },
      {
        name: 'Baidu',
        icon: 'https://www.baidu.com/favicon.ico',
        url: 'https://www.baidu.com/s?wd='
      },
      {
        name: 'DuckDuckGo',
        icon: 'https://duckduckgo.com/favicon.ico',
        url: 'https://duckduckgo.com/?q='
      }
    ];

    this.currentSearchEngine = 0;
    this.isSearching = false;
    this.loadPreferredSearchEngine();
    this.bindEvents();
    this.updateSearchEngineIcon();
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

    // Search engine options click
    const engineOptions = document.querySelectorAll('.search-engine-option');
    engineOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const engineIndex = parseInt(option.dataset.engine);
        this.selectSearchEngine(engineIndex);
      });
    });

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
    if (results.length === 0) {
      this.searchDropdown.innerHTML = `
        <div class="search-result-item no-results">
          <span class="material-symbols-rounded">search_off</span>
          <span>未找到匹配结果</span>
        </div>
      `;
      return;
    }

    this.searchDropdown.innerHTML = results.map(result => {
      if (result.type === 'category') {
        return `
          <div class="search-result-item category-result" data-type="category" data-id="${result.data.id}">
            <div class="result-icon category-icon" style="background-color: ${result.data.color}">
              <span class="material-symbols-rounded">folder</span>
            </div>
            <div class="result-content">
              <div class="result-title">${this.highlightText(result.data.name, result.query)}</div>
              <div class="result-subtitle">分类 • ${result.data.shortcuts.length} 个快捷方式</div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="search-result-item shortcut-result" data-type="shortcut" data-url="${result.data.url}">
            <div class="result-icon shortcut-icon" style="background-color: ${result.data.iconColor || '#4285f4'}">
              ${result.data.iconType === 'favicon' && result.data.iconUrl ?
                `<img src="${result.data.iconUrl}" alt="${result.data.name}" onerror="this.style.display='none'; this.parentNode.textContent='${result.data.name.charAt(0).toUpperCase()}'">` :
                result.data.name.charAt(0).toUpperCase()
              }
            </div>
            <div class="result-content">
              <div class="result-title">${this.highlightText(result.data.name, result.query)}</div>
              <div class="result-subtitle">${result.category.name} • ${result.data.url}</div>
            </div>
          </div>
        `;
      }
    }).join('');

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
  highlightText(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Select category from search results
   */
  selectCategory(categoryId) {
    this.hideSearchDropdown();
    this.searchInput.value = '';
    // Scroll to category or highlight it
    const categoryElement = document.querySelector(`[data-id="${categoryId}"]`);
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
   * @param {string} query - The search query
   */
  performSearch(query) {
    const currentEngine = this.searchEngines[this.currentSearchEngine];
    const searchUrl = currentEngine.url + encodeURIComponent(query);
    window.location.href = searchUrl;
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
    this.currentSearchEngine = engineIndex;
    this.updateSearchEngineIcon();
    this.updateActiveOption();
    this.closeDropdown();

    // 保存用户选择
    localStorage.setItem('preferredSearchEngine', this.currentSearchEngine);
  }

  /**
   * Update active option in dropdown
   */
  updateActiveOption() {
    const options = document.querySelectorAll('.search-engine-option');
    options.forEach((option, index) => {
      option.classList.toggle('active', index === this.currentSearchEngine);
    });
  }

  /**
   * Update search engine icon
   */
  updateSearchEngineIcon() {
    if (this.searchEngineIcon) {
      const currentEngine = this.searchEngines[this.currentSearchEngine];
      this.searchEngineIcon.src = currentEngine.icon;
      this.searchEngineIcon.alt = currentEngine.name;
      this.searchEngineIcon.title = `当前搜索引擎: ${currentEngine.name}`;
    }
    this.updateActiveOption();
  }

  /**
   * Load user's preferred search engine
   */
  loadPreferredSearchEngine() {
    const saved = localStorage.getItem('preferredSearchEngine');
    if (saved !== null) {
      this.currentSearchEngine = parseInt(saved);
      this.updateSearchEngineIcon();
    }
  }
}

// Create instance - will be initialized in main.js
let searchManager;