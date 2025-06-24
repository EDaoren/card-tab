/**
 * 离线管理器
 * 处理离线状态检测和优化
 */

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.offlineIndicator = null;
    this.searchEngineIcons = new Map();
    this.faviconCache = new Map();
    this.retryQueue = [];
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5秒
  }

  /**
   * 初始化离线管理器
   */
  init() {
    this.createOfflineIndicator();
    this.setupNetworkListeners();
    this.setupSearchEngineIcons();
    this.checkInitialNetworkStatus();
    this.setupImageErrorHandling();
    
    console.log('OfflineManager: 离线管理器已初始化');
  }

  /**
   * 创建离线状态指示器
   */
  createOfflineIndicator() {
    this.offlineIndicator = document.createElement('div');
    this.offlineIndicator.className = 'offline-indicator';
    this.offlineIndicator.innerHTML = '离线模式 - 部分功能受限';
    document.body.appendChild(this.offlineIndicator);
  }

  /**
   * 设置网络状态监听器
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.handleNetworkChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleNetworkChange(false);
    });
  }

  /**
   * 处理网络状态变化
   */
  handleNetworkChange(isOnline) {
    this.isOnline = isOnline;
    
    if (isOnline) {
      this.handleOnlineMode();
    } else {
      this.handleOfflineMode();
    }
  }

  /**
   * 处理在线模式
   */
  handleOnlineMode() {
    console.log('OfflineManager: 网络已连接');
    
    // 隐藏离线指示器
    this.offlineIndicator.classList.remove('show');
    
    // 移除离线模式样式
    document.body.classList.remove('offline-mode');
    
    // 恢复搜索引擎图标
    this.restoreSearchEngineIcons();
    
    // 处理重试队列
    this.processRetryQueue();
    
    // 显示网络恢复动画
    document.body.classList.add('network-restored');
    setTimeout(() => {
      document.body.classList.remove('network-restored');
    }, 500);
  }

  /**
   * 处理离线模式
   */
  handleOfflineMode() {
    console.log('OfflineManager: 网络已断开');
    
    // 显示离线指示器
    this.offlineIndicator.classList.add('show');
    
    // 添加离线模式样式
    document.body.classList.add('offline-mode');
    
    // 替换搜索引擎图标
    this.replaceSearchEngineIcons();
    
    // 禁用需要网络的功能
    this.disableNetworkFeatures();
  }

  /**
   * 检查初始网络状态
   */
  checkInitialNetworkStatus() {
    if (!this.isOnline) {
      this.handleOfflineMode();
    }
  }

  /**
   * 设置搜索引擎图标
   */
  setupSearchEngineIcons() {
    const searchEngineOptions = document.querySelectorAll('.search-engine-option');
    
    searchEngineOptions.forEach(option => {
      const img = option.querySelector('img');
      if (img) {
        const src = img.src;
        const engineName = this.getEngineNameFromSrc(src);
        
        // 创建离线备选图标
        const offlineIcon = document.createElement('div');
        offlineIcon.className = `search-engine-icon offline-${engineName}`;
        offlineIcon.style.display = 'none';
        
        // 插入到图片后面
        img.parentNode.insertBefore(offlineIcon, img.nextSibling);
        
        this.searchEngineIcons.set(img, offlineIcon);
      }
    });
  }

  /**
   * 从URL获取搜索引擎名称
   */
  getEngineNameFromSrc(src) {
    if (src.includes('google.com')) return 'google';
    if (src.includes('bing.com')) return 'bing';
    if (src.includes('baidu.com')) return 'baidu';
    if (src.includes('duckduckgo.com')) return 'duckduckgo';
    return 'unknown';
  }

  /**
   * 替换搜索引擎图标为离线版本
   */
  replaceSearchEngineIcons() {
    this.searchEngineIcons.forEach((offlineIcon, originalImg) => {
      originalImg.style.display = 'none';
      offlineIcon.style.display = 'inline-block';
    });
  }

  /**
   * 恢复搜索引擎图标
   */
  restoreSearchEngineIcons() {
    this.searchEngineIcons.forEach((offlineIcon, originalImg) => {
      originalImg.style.display = 'inline-block';
      offlineIcon.style.display = 'none';
    });
  }

  /**
   * 设置图片错误处理
   */
  setupImageErrorHandling() {
    // 监听所有图片加载错误
    document.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG') {
        this.handleImageError(event.target);
      }
    }, true);
  }

  /**
   * 处理图片加载错误
   */
  handleImageError(img) {
    const src = img.src;
    
    // 如果是favicon，创建备选图标
    if (src.includes('favicon') || src.includes('icon')) {
      this.createFaviconFallback(img);
    }
    
    // 添加到重试队列
    if (this.retryQueue.length < 50) { // 限制队列大小
      this.retryQueue.push({
        element: img,
        originalSrc: src,
        retries: 0,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 创建favicon备选图标
   */
  createFaviconFallback(img) {
    const fallback = document.createElement('div');
    fallback.className = 'favicon-fallback';
    
    // 尝试从URL提取网站名称
    const siteName = this.extractSiteNameFromUrl(img.src);
    const siteClass = this.getSiteClassFromName(siteName);
    
    if (siteClass) {
      fallback.classList.add(siteClass);
    } else {
      // 使用首字母
      fallback.textContent = siteName.charAt(0).toUpperCase();
    }
    
    // 替换原图片
    img.style.display = 'none';
    img.parentNode.insertBefore(fallback, img.nextSibling);
  }

  /**
   * 从URL提取网站名称
   */
  extractSiteNameFromUrl(url) {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      return parts[parts.length - 2] || hostname;
    } catch {
      return 'site';
    }
  }

  /**
   * 获取网站对应的CSS类名
   */
  getSiteClassFromName(siteName) {
    const siteMap = {
      'github': 'github',
      'youtube': 'youtube',
      'twitter': 'twitter',
      'facebook': 'facebook',
      'instagram': 'instagram',
      'linkedin': 'linkedin',
      'reddit': 'reddit',
      'stackoverflow': 'stackoverflow',
      'gmail': 'gmail',
      'drive': 'drive',
      'docs': 'docs',
      'sheets': 'sheets',
      'slides': 'slides'
    };
    
    return siteMap[siteName.toLowerCase()];
  }

  /**
   * 禁用需要网络的功能
   */
  disableNetworkFeatures() {
    // 禁用Supabase相关功能
    const supabaseElements = document.querySelectorAll('[id*="supabase"], [class*="sync"]');
    supabaseElements.forEach(el => {
      if (!el.classList.contains('feature-disabled')) {
        el.classList.add('feature-disabled');
      }
    });

    // 禁用获取网站信息按钮
    const fetchButtons = document.querySelectorAll('#fetch-url-info');
    fetchButtons.forEach(btn => {
      btn.classList.add('feature-disabled');
    });
  }

  /**
   * 启用网络功能
   */
  enableNetworkFeatures() {
    const disabledElements = document.querySelectorAll('.feature-disabled');
    disabledElements.forEach(el => {
      el.classList.remove('feature-disabled');
    });
  }

  /**
   * 处理重试队列
   */
  processRetryQueue() {
    if (!this.isOnline || this.retryQueue.length === 0) {
      return;
    }

    const now = Date.now();
    const itemsToRetry = this.retryQueue.filter(item => 
      item.retries < this.maxRetries && 
      (now - item.timestamp) > this.retryDelay
    );

    itemsToRetry.forEach(item => {
      this.retryImageLoad(item);
    });

    // 清理过期或超过重试次数的项目
    this.retryQueue = this.retryQueue.filter(item => 
      item.retries < this.maxRetries && 
      (now - item.timestamp) < 300000 // 5分钟内
    );
  }

  /**
   * 重试图片加载
   */
  retryImageLoad(item) {
    item.retries++;
    item.timestamp = Date.now();
    
    // 重新设置src触发重新加载
    item.element.src = '';
    setTimeout(() => {
      item.element.src = item.originalSrc;
    }, 100);
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      retryQueueLength: this.retryQueue.length,
      cachedFavicons: this.faviconCache.size
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.offlineIndicator) {
      this.offlineIndicator.remove();
    }
    this.retryQueue = [];
    this.faviconCache.clear();
    this.searchEngineIcons.clear();
  }
}

// 创建全局实例
const offlineManager = new OfflineManager();
window.offlineManager = offlineManager;
