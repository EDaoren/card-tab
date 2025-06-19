/**
 * View handler for the Quick Nav Tab extension
 * Manages grid and list view modes
 */

/**
 * 打开模态框
 * @param {HTMLElement} modal - 模态框元素
 */
function openModal(modal) {
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

/**
 * 关闭模态框
 * @param {HTMLElement} modal - 模态框元素
 */
function closeModal(modal) {
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// 为所有模态框添加关闭按钮事件
document.addEventListener('DOMContentLoaded', () => {
  const closeButtons = document.querySelectorAll('.close-modal');
  const modals = document.querySelectorAll('.modal');
  
  // 为每个关闭按钮添加点击事件
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      closeModal(modal);
    });
  });
  
  // 点击模态框背景也可关闭
  modals.forEach(modal => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });
});

class ViewManager {
  constructor() {
    this.gridViewBtn = document.getElementById('grid-view-btn');
    this.listViewBtn = document.getElementById('list-view-btn');
    this.categoriesContainer = document.getElementById('categories-container');
    this.currentViewMode = 'grid'; // Default view mode
    
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Grid view button click
    this.gridViewBtn.addEventListener('click', () => this.setViewMode('grid'));
    
    // List view button click
    this.listViewBtn.addEventListener('click', () => this.setViewMode('list'));
  }

  /**
   * Set the view mode (grid or list)
   * @param {string} mode - The view mode ('grid' or 'list')
   */
  async setViewMode(mode) {
    if (mode !== 'grid' && mode !== 'list') {
      console.error('Invalid view mode:', mode);
      return;
    }
    
    // Update view mode
    this.currentViewMode = mode;
    
    // Update UI
    this.updateViewButtons();
    this.updateContainerClass();
    
    // Notify category manager
    if (categoryManager) {
      categoryManager.setViewMode(mode);
    }
    
    // Save setting
    try {
      await storageManager.updateSettings({ viewMode: mode });
    } catch (error) {
      console.error('Error saving view mode setting:', error);
    }
  }

  /**
   * Update view buttons active state
   */
  updateViewButtons() {
    if (this.currentViewMode === 'grid') {
      this.gridViewBtn.classList.add('active');
      this.listViewBtn.classList.remove('active');
    } else {
      this.gridViewBtn.classList.remove('active');
      this.listViewBtn.classList.add('active');
    }
  }

  /**
   * Update container class based on current view mode
   */
  updateContainerClass() {
    this.categoriesContainer.className = this.currentViewMode === 'grid' ? 'grid-view' : 'list-view';
  }

  /**
   * Initialize view based on saved settings
   */
  async initView() {
    try {
      const settings = storageManager.getSettings();
      if (settings && settings.viewMode) {
        this.setViewMode(settings.viewMode);
      }
    } catch (error) {
      console.error('Error initializing view:', error);
    }
  }
}

// Create instance - will be initialized in main.js
let viewManager;

// 导出模态框函数
window.openModal = openModal;
window.closeModal = closeModal; 