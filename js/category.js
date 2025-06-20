/**
 * Category handler for managing categories in the Quick Nav Tab extension
 */

class CategoryManager {
  constructor() {
    this.categoriesContainer = document.getElementById('categories-container');
    this.addCategoryBtn = document.getElementById('add-category-btn');
    this.categoryModal = document.getElementById('category-modal');
    this.categoryForm = document.getElementById('category-form');
    this.categoryIdInput = document.getElementById('category-id');
    this.categoryNameInput = document.getElementById('category-name');
    this.categoryColorInput = document.getElementById('category-color');
    this.deleteCategoryBtn = document.getElementById('delete-category-btn');
    
    this.isEditMode = false;
    this.currentViewMode = 'grid';
    
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Add category button click
    this.addCategoryBtn.addEventListener('click', () => this.openAddCategoryModal());
    
    // Category form submit
    this.categoryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCategory();
    });
    
    // Delete category button click
    this.deleteCategoryBtn.addEventListener('click', () => this.deleteCategory());
  }

  /**
   * Set the current view mode
   * @param {string} mode - The view mode ('grid' or 'list')
   */
  setViewMode(mode) {
    this.currentViewMode = mode;
    this.renderCategories();
  }

  /**
   * Render all categories
   */
  async renderCategories() {
    const categories = storageManager.getCategories();
    this.categoriesContainer.innerHTML = '';

    if (categories.length === 0) {
      this.renderEmptyState();
      return;
    }

    categories.forEach(category => {
      this.renderCategory(category);
    });
  }

  /**
   * Render empty state when no categories exist
   */
  renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <h3>还没有分类</h3>
      <p>创建您的第一个分类以开始使用</p>
      <button id="empty-add-category-btn">添加分类</button>
    `;
    
    this.categoriesContainer.appendChild(emptyState);
    
    // Add event listener to the button
    document.getElementById('empty-add-category-btn').addEventListener('click', () => {
      this.openAddCategoryModal();
    });
  }

  /**
   * Render a single category
   * @param {Object} category - The category object to render
   */
  renderCategory(category) {
    const categoryElement = document.createElement('div');
    categoryElement.className = 'category-card';
    categoryElement.dataset.id = category.id;
    
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';
    
    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'category-title';
    
    const colorIndicator = document.createElement('div');
    colorIndicator.className = 'category-dot';
    colorIndicator.style.backgroundColor = category.color;
    
    categoryTitle.appendChild(colorIndicator);
    categoryTitle.appendChild(document.createTextNode(category.name));
    
    const categoryActions = document.createElement('div');
    categoryActions.className = 'category-actions';
    
    const addShortcutBtn = document.createElement('button');
    addShortcutBtn.innerHTML = '<span class="material-symbols-rounded">add</span>';
    addShortcutBtn.title = '添加快捷方式';
    
    const editCategoryBtn = document.createElement('button');
    editCategoryBtn.innerHTML = '<span class="material-symbols-rounded">edit</span>';
    editCategoryBtn.title = '编辑分类';
    
    const toggleCollapseBtn = document.createElement('button');
    toggleCollapseBtn.innerHTML = `<span class="material-symbols-rounded">${category.collapsed ? 'expand_more' : 'expand_less'}</span>`;
    toggleCollapseBtn.title = category.collapsed ? '展开' : '折叠';
    
    categoryActions.appendChild(addShortcutBtn);
    categoryActions.appendChild(editCategoryBtn);
    categoryActions.appendChild(toggleCollapseBtn);
    
    categoryHeader.appendChild(categoryTitle);
    categoryHeader.appendChild(categoryActions);
    
    const categoryContent = document.createElement('div');
    categoryContent.className = `category-content ${category.collapsed ? '' : 'expanded'}`;
    
    // Create shortcuts container based on view mode
    const shortcutsContainer = document.createElement('div');
    shortcutsContainer.className = this.currentViewMode === 'grid' ? 'shortcuts-grid' : 'shortcuts-list';
    
    // Add shortcuts to the container
    const shortcuts = category.shortcuts;
    if (shortcuts.length > 0) {
      shortcuts.forEach(shortcut => {
        const shortcutElement = this.createShortcutElement(shortcut, category.id);
        shortcutsContainer.appendChild(shortcutElement);
      });
    } else {
      // 添加空分类提示
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-shortcuts-message';
      emptyMessage.innerHTML = `
        <span class="material-symbols-rounded">info</span>
        <p>此分类还没有快捷方式</p>
        <button class="add-shortcut-btn">
          <span class="material-symbols-rounded">add</span>
          添加快捷方式
        </button>
      `;
      shortcutsContainer.appendChild(emptyMessage);
      
      // 为空分类提示中的添加按钮添加事件监听
      emptyMessage.querySelector('.add-shortcut-btn').addEventListener('click', () => {
        shortcutManager.openAddShortcutModal(category.id);
      });
    }
    
    categoryContent.appendChild(shortcutsContainer);
    
    categoryElement.appendChild(categoryHeader);
    categoryElement.appendChild(categoryContent);
    
    this.categoriesContainer.appendChild(categoryElement);
    
    // Add event listeners
    addShortcutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shortcutManager.openAddShortcutModal(category.id);
    });
    
    editCategoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEditCategoryModal(category);
    });
    
    toggleCollapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCategoryCollapse(category.id);
    });
    
    categoryHeader.addEventListener('click', () => {
      this.toggleCategoryCollapse(category.id);
    });
  }

  /**
   * Create a shortcut element
   * @param {Object} shortcut - The shortcut object
   * @param {string} categoryId - The category ID
   * @returns {HTMLElement} The shortcut element
   */
  createShortcutElement(shortcut, categoryId) {
    // 确保shortcut对象有必要的属性
    if (!shortcut || !shortcut.name) {
      console.error('Invalid shortcut data:', shortcut);
      return document.createElement('div');
    }

    const shortcutElement = document.createElement('a');
    shortcutElement.className = 'shortcut';
    shortcutElement.href = shortcut.url || '#';
    shortcutElement.dataset.id = shortcut.id;
    shortcutElement.dataset.categoryId = categoryId;
    shortcutElement.setAttribute('target', '_blank');
    
    // Create the shortcut icon based on the icon type
    const shortcutIcon = document.createElement('div');
    shortcutIcon.className = 'shortcut-icon';

    if (shortcut.iconType === 'favicon' && shortcut.iconUrl) {
      // Use favicon
      const iconImg = document.createElement('img');
      iconImg.className = 'shortcut-img';
      iconImg.src = shortcut.iconUrl;
      iconImg.alt = shortcut.name;
      iconImg.onerror = function() {
        // Fallback to letter icon if favicon fails to load
        shortcutIcon.innerHTML = '';
        shortcutIcon.textContent = shortcut.name.charAt(0).toUpperCase();
        shortcutIcon.style.backgroundColor = shortcut.iconColor || '#4285f4';
      };
      shortcutIcon.appendChild(iconImg);
    } else if (shortcut.iconType === 'custom' && shortcut.iconUrl) {
      // Use custom icon
      const iconImg = document.createElement('img');
      iconImg.className = 'shortcut-img';
      iconImg.src = shortcut.iconUrl;
      iconImg.alt = shortcut.name;
      iconImg.onerror = function() {
        // Fallback to letter icon if custom icon fails to load
        shortcutIcon.innerHTML = '';
        shortcutIcon.textContent = shortcut.name.charAt(0).toUpperCase();
        shortcutIcon.style.backgroundColor = shortcut.iconColor || '#4285f4';
      };
      shortcutIcon.appendChild(iconImg);
    } else {
      // Use first letter with background color
      const letter = shortcut.name.charAt(0).toUpperCase();
      const bgColor = shortcut.iconColor || '#4285f4';

      shortcutIcon.textContent = letter;
      shortcutIcon.style.backgroundColor = bgColor;
      shortcutIcon.style.color = 'white';
    }
    
    const shortcutName = document.createElement('div');
    shortcutName.className = 'shortcut-name';
    shortcutName.textContent = shortcut.name;
    
    shortcutElement.appendChild(shortcutIcon);
    shortcutElement.appendChild(shortcutName);
    
    // Add event listener for editing shortcut (right-click)
    shortcutElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      shortcutManager.openEditShortcutModal(categoryId, shortcut.id);
    });
    
    return shortcutElement;
  }

  /**
   * Open add category modal
   */
  openAddCategoryModal() {
    this.isEditMode = false;
    document.getElementById('category-modal-title').textContent = '添加分类';
    this.categoryIdInput.value = '';
    this.categoryNameInput.value = '';
    this.categoryColorInput.value = '#4285f4';
    this.deleteCategoryBtn.style.display = 'none';
    openModal(this.categoryModal);
  }

  /**
   * Open edit category modal
   * @param {Object} category - The category to edit
   */
  openEditCategoryModal(category) {
    this.isEditMode = true;
    document.getElementById('category-modal-title').textContent = '编辑分类';
    this.categoryIdInput.value = category.id;
    this.categoryNameInput.value = category.name;
    this.categoryColorInput.value = category.color;
    this.deleteCategoryBtn.style.display = 'block';
    openModal(this.categoryModal);
  }

  /**
   * Save category (add or update)
   */
  async saveCategory() {
    const categoryId = this.categoryIdInput.value;
    const categoryData = {
      name: this.categoryNameInput.value,
      color: this.categoryColorInput.value
    };
    
    try {
      if (this.isEditMode) {
        await storageManager.updateCategory(categoryId, categoryData);
      } else {
        await storageManager.addCategory(categoryData);
      }
      
      closeModal(this.categoryModal);
      this.renderCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert(`保存分类时出错: ${error.message}`);
    }
  }

  /**
   * Delete category
   */
  async deleteCategory() {
    const categoryId = this.categoryIdInput.value;
    
    if (!confirm('确定要删除此分类及其所有快捷方式吗？')) {
      return;
    }
    
    try {
      await storageManager.deleteCategory(categoryId);
      closeModal(this.categoryModal);
      this.renderCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert(`删除分类时出错: ${error.message}`);
    }
  }

  /**
   * Toggle category collapse state
   * @param {string} categoryId - The category ID
   */
  async toggleCategoryCollapse(categoryId) {
    try {
      // 立即更新UI，不等待存储操作
      const categoryElement = document.querySelector(`.category-card[data-id="${categoryId}"]`);
      const categoryContent = categoryElement.querySelector('.category-content');
      const toggleButton = categoryElement.querySelector('.category-actions button:last-child span');

      // 获取当前状态
      const isCurrentlyExpanded = categoryContent.classList.contains('expanded');

      // 立即切换UI状态
      if (isCurrentlyExpanded) {
        categoryContent.classList.remove('expanded');
        toggleButton.textContent = 'expand_more';
        toggleButton.closest('button').title = '展开';
      } else {
        categoryContent.classList.add('expanded');
        toggleButton.textContent = 'expand_less';
        toggleButton.closest('button').title = '折叠';
      }

      // 异步保存到存储，不阻塞UI
      storageManager.toggleCategoryCollapse(categoryId).catch(error => {
        console.error('Error saving category collapse state:', error);
        // 如果保存失败，回滚UI状态
        if (isCurrentlyExpanded) {
          categoryContent.classList.add('expanded');
          toggleButton.textContent = 'expand_less';
          toggleButton.closest('button').title = '折叠';
        } else {
          categoryContent.classList.remove('expanded');
          toggleButton.textContent = 'expand_more';
          toggleButton.closest('button').title = '展开';
        }
      });
    } catch (error) {
      console.error('Error toggling category collapse:', error);
    }
  }
}

// Create instance - will be initialized in main.js
let categoryManager;