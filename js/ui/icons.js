/**
 * 本地图标管理器
 * 提供Material Icons的本地化替代方案
 */

// 图标映射表 - 将Material Icons名称映射到Unicode字符或CSS类
const ICON_MAP = {
  'search': '🔍',
  'palette': '🎨', 
  'grid_view': '⊞',
  'view_list': '☰',
  'add': '+',
  'download': '⬇',
  'upload_file': '⬆',
  'expand_more': '▼',
  'expand_less': '▲',
  'edit': '✏',
  'info': 'ℹ',
  'sync': '⟲',
  'close': '×'
};

// SVG图标定义 - 更精确的图标显示
const SVG_ICONS = {
  'search': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
  
  'palette': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9 0 4.97 4.03 9 9 9 .83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  
  'grid_view': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z"/></svg>`,
  
  'view_list': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`,
  
  'add': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
  
  'download': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
  
  'upload_file': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>`,
  
  'expand_more': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>`,
  
  'expand_less': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>`,
  
  'edit': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  
  'info': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M13,17H11V11H13M13,9H11V7H13"/></svg>`,
  
  'sync': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`
};

/**
 * 图标管理器类
 */
class IconManager {
  constructor() {
    this.useSVG = true; // 优先使用SVG图标
    this.fallbackToUnicode = true; // 备选使用Unicode字符
  }

  /**
   * 创建图标元素
   * @param {string} iconName - 图标名称
   * @param {string} className - 额外的CSS类名
   * @returns {HTMLElement} 图标元素
   */
  createIcon(iconName, className = '') {
    const iconElement = document.createElement('span');
    iconElement.className = `icon ${className}`.trim();
    
    if (this.useSVG && SVG_ICONS[iconName]) {
      // 使用SVG图标
      iconElement.innerHTML = SVG_ICONS[iconName];
      iconElement.classList.add('icon-svg');
    } else if (this.fallbackToUnicode && ICON_MAP[iconName]) {
      // 使用Unicode字符
      iconElement.textContent = ICON_MAP[iconName];
      iconElement.classList.add('icon-unicode');
    } else {
      // 最后备选方案
      iconElement.textContent = '●';
      iconElement.classList.add('icon-fallback');
    }
    
    return iconElement;
  }

  /**
   * 替换页面中的Material Icons
   */
  replaceMaterialIcons() {
    const materialIcons = document.querySelectorAll('.material-symbols-rounded');

    materialIcons.forEach(element => {
      const iconName = element.textContent.trim();
      if (iconName && (SVG_ICONS[iconName] || ICON_MAP[iconName])) {
        // 添加过渡效果，避免闪烁
        element.style.transition = 'opacity 0.2s ease';
        element.style.opacity = '0';

        setTimeout(() => {
          if (this.useSVG && SVG_ICONS[iconName]) {
            // 使用SVG图标
            element.innerHTML = SVG_ICONS[iconName];
            element.classList.add('icon-svg');
          } else if (this.fallbackToUnicode && ICON_MAP[iconName]) {
            // 使用Unicode字符
            element.textContent = ICON_MAP[iconName];
            element.classList.add('icon-unicode');
          }

          element.classList.add('material-symbols-fallback');
          element.style.width = '24px';
          element.style.height = '24px';
          element.style.display = 'inline-block';
          element.style.opacity = '1';
        }, 50);
      }
    });
  }

  /**
   * 初始化图标系统
   */
  init() {
    // 等待字体加载，如果失败则使用本地图标
    this.waitForFontLoad();
  }

  /**
   * 等待字体加载完成
   */
  waitForFontLoad() {
    // 使用FontFace API检测字体加载
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        // 字体加载完成后再检查
        setTimeout(() => {
          if (!this.isMaterialIconsLoaded()) {
            console.log('Material Icons failed to load, using local fallback');
            this.replaceMaterialIcons();
          }
        }, 100);
      });

      // 设置超时备选方案
      setTimeout(() => {
        if (!this.isMaterialIconsLoaded()) {
          console.log('Material Icons load timeout, using local fallback');
          this.replaceMaterialIcons();
        }
      }, 3000); // 3秒超时
    } else {
      // 不支持FontFace API的浏览器，直接检查
      setTimeout(() => {
        if (!this.isMaterialIconsLoaded()) {
          console.log('Material Icons not available, using local fallback');
          this.replaceMaterialIcons();
        }
      }, 1000);
    }
  }

  /**
   * 检查Material Icons是否已加载
   * @returns {boolean}
   */
  isMaterialIconsLoaded() {
    // 检查页面中是否有material-symbols-rounded元素正常显示
    const materialIcons = document.querySelectorAll('.material-symbols-rounded');
    if (materialIcons.length === 0) return true; // 没有图标元素，认为正常

    // 检查第一个图标元素是否正常显示
    const firstIcon = materialIcons[0];
    const computedStyle = window.getComputedStyle(firstIcon);
    const fontFamily = computedStyle.fontFamily;

    // 如果字体族包含Material Symbols Rounded，认为已加载
    return fontFamily.includes('Material Symbols Rounded');
  }
}

// 创建全局图标管理器实例
const iconManager = new IconManager();

// 导出到全局作用域
window.iconManager = iconManager;
