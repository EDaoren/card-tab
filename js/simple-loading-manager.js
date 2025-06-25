/**
 * 简化的加载管理器
 * 专注于核心性能优化，避免复杂的功能
 */

class SimpleLoadingManager {
  constructor() {
    this.loadingStartTime = Date.now();
    this.minLoadingTime = 300; // 最小加载时间，避免闪烁
    this.maxLoadingTime = 10000; // 最大加载时间，防止卡死
    this.isLoaded = false;
    this.loadingSteps = [];
    this.currentStep = 0;
  }

  /**
   * 初始化加载管理器
   */
  init() {
    console.log('🚀 Simple Loading Manager initialized');
    
    // 移除no-js类，表示JavaScript已加载
    document.body.classList.remove('no-js');
    
    // 预加载字体
    this.preloadFont();
    
    // 设置加载超时
    this.setupLoadingTimeout();
    
    // 监听字体加载
    this.monitorFontLoading();
  }

  /**
   * 预加载Material Symbols字体
   */
  preloadFont() {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('400 24px "Material Symbols Rounded"')
        .then(() => {
          console.log('✅ Material Symbols font preloaded successfully');
        })
        .catch(err => {
          console.warn('⚠️ Font preload failed, will use fallback:', err);
        });
    }
  }

  /**
   * 监听字体加载状态
   */
  monitorFontLoading() {
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        console.log('✅ All fonts loaded');
        this.checkFontFallback();
      });
    }
  }

  /**
   * 检查字体是否需要备选方案
   */
  checkFontFallback() {
    // 创建测试元素检查Material Symbols是否正确加载
    const testElement = document.createElement('span');
    testElement.className = 'material-symbols-rounded';
    testElement.textContent = 'search';
    testElement.style.position = 'absolute';
    testElement.style.visibility = 'hidden';
    testElement.style.fontSize = '24px';
    document.body.appendChild(testElement);

    const computedStyle = window.getComputedStyle(testElement);
    const fontFamily = computedStyle.fontFamily;
    
    // 如果字体没有正确加载，使用备选方案
    if (!fontFamily.includes('Material Symbols Rounded')) {
      console.warn('⚠️ Material Symbols font not loaded, using fallback');
      this.applyFontFallback();
    }

    document.body.removeChild(testElement);
  }

  /**
   * 应用字体备选方案
   */
  applyFontFallback() {
    // 为所有Material Symbols图标添加备选类
    const materialIcons = document.querySelectorAll('.material-symbols-rounded');
    materialIcons.forEach(icon => {
      icon.classList.add('material-symbols-fallback');
    });
  }

  /**
   * 设置加载超时保护
   */
  setupLoadingTimeout() {
    setTimeout(() => {
      if (!this.isLoaded) {
        console.warn('⚠️ Loading timeout reached, forcing completion');
        this.completeLoading();
      }
    }, this.maxLoadingTime);
  }

  /**
   * 更新加载进度
   */
  updateProgress(step, total) {
    this.currentStep = step;
    const percentage = Math.round((step / total) * 100);
    
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = `正在加载... ${percentage}%`;
    }
    
    console.log(`📊 Loading progress: ${step}/${total} (${percentage}%)`);
  }

  /**
   * 完成加载
   */
  async completeLoading() {
    if (this.isLoaded) return;
    
    const loadingTime = Date.now() - this.loadingStartTime;
    console.log(`⏱️ Total loading time: ${loadingTime}ms`);
    
    // 确保最小加载时间，避免闪烁
    const remainingTime = Math.max(0, this.minLoadingTime - loadingTime);
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    
    this.isLoaded = true;
    
    // 隐藏加载指示器
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.opacity = '0';
      setTimeout(() => {
        loadingIndicator.style.display = 'none';
      }, 300);
    }
    
    // 显示主内容
    document.body.classList.add('loaded');
    
    console.log('✅ Loading completed successfully');
  }

  /**
   * 处理加载错误
   */
  handleLoadingError(error, context = '') {
    console.error(`❌ Loading error${context ? ` in ${context}` : ''}:`, error);
    
    // 即使出错也要完成加载，确保用户能看到内容
    if (!this.isLoaded) {
      setTimeout(() => {
        this.completeLoading();
      }, 1000);
    }
  }

  /**
   * 获取加载状态
   */
  getLoadingStatus() {
    return {
      isLoaded: this.isLoaded,
      loadingTime: Date.now() - this.loadingStartTime,
      currentStep: this.currentStep
    };
  }
}

// 创建全局实例
window.simpleLoadingManager = new SimpleLoadingManager();

// 立即初始化
document.addEventListener('DOMContentLoaded', () => {
  window.simpleLoadingManager.init();
});
