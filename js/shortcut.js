/**
 * Shortcut handler for managing shortcuts in the Quick Nav Tab extension
 */

class ShortcutManager {
  constructor() {
    this.shortcutModal = document.getElementById('shortcut-modal');
    this.shortcutForm = document.getElementById('shortcut-form');
    this.shortcutIdInput = document.getElementById('shortcut-id');
    this.shortcutCategoryIdInput = document.getElementById('shortcut-category-id');
    this.shortcutNameInput = document.getElementById('shortcut-name');
    this.shortcutUrlInput = document.getElementById('shortcut-url');
    this.shortcutColorInput = document.getElementById('shortcut-color');
    this.shortcutIconUrlInput = document.getElementById('shortcut-icon-url');
    this.iconTypeRadios = document.querySelectorAll('input[name="icon-type"]');
    this.faviconPreview = document.getElementById('favicon-preview');
    this.letterIconForm = document.getElementById('letter-icon-form');
    this.customIconForm = document.getElementById('custom-icon-form');
    this.fetchUrlInfoBtn = document.getElementById('fetch-url-info');
    this.faviconImage = document.getElementById('favicon-image');
    this.deleteShortcutBtn = document.getElementById('delete-shortcut-btn');
    
    this.isEditMode = false;
    this.currentFaviconUrl = '';
    this.currentWebsiteTitle = '';
    
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Shortcut form submit
    this.shortcutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveShortcut();
    });
    
    // Delete shortcut button click
    this.deleteShortcutBtn.addEventListener('click', () => this.deleteShortcut());
    
    // Fetch URL info button click
    this.fetchUrlInfoBtn.addEventListener('click', () => this.fetchUrlInfo());
    
    // Icon type radio change
    this.iconTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.toggleIconTypeFields());
    });
    
    // URL input change - reset preview if URL changes
    this.shortcutUrlInput.addEventListener('input', () => {
      this.currentFaviconUrl = '';
      this.faviconImage.src = '';
      this.faviconPreview.classList.add('hidden');
    });
  }

  /**
   * Toggle icon type related fields based on selection
   */
  toggleIconTypeFields() {
    const selectedType = document.querySelector('input[name="icon-type"]:checked').value;
    
    this.letterIconForm.classList.add('hidden');
    this.customIconForm.classList.add('hidden');
    this.faviconPreview.classList.add('hidden');
    
    if (selectedType === 'letter') {
      this.letterIconForm.classList.remove('hidden');
    } else if (selectedType === 'custom') {
      this.customIconForm.classList.remove('hidden');
    } else if (selectedType === 'favicon') {
      if (this.currentFaviconUrl) {
        this.faviconPreview.classList.remove('hidden');
      }
    }
  }

  /**
   * Fetch website information (title and favicon)
   */
  async fetchUrlInfo() {
    const url = this.shortcutUrlInput.value.trim();
    if (!url) {
      alert('请输入网址');
      return;
    }
    
    // Ensure URL has protocol
    let fullUrl = url;
    if (!fullUrl.match(/^https?:\/\//)) {
      fullUrl = 'https://' + fullUrl;
      this.shortcutUrlInput.value = fullUrl;
    }
    
    try {
      // Show loading state
      this.fetchUrlInfoBtn.disabled = true;
      this.fetchUrlInfoBtn.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span>';
      
      // Extract domain for favicon
      const domain = new URL(fullUrl).hostname;
      
      // Get favicon using multiple fallback services
      const faviconUrl = this.getFaviconUrl(domain);
      
      // Try to get title (Note: This is just an example. In a real extension,
      // you would need to use a background script with chrome.tabs API or a proxy service)
      this.currentFaviconUrl = faviconUrl;
      this.faviconImage.src = faviconUrl;
      
      // If we have a favicon, auto-select the favicon option
      if (faviconUrl) {
        document.getElementById('icon-type-favicon').checked = true;
        this.faviconPreview.classList.remove('hidden');
        this.letterIconForm.classList.add('hidden');
        this.customIconForm.classList.add('hidden');
      }
      
      // Try to get a title from the domain name if we don't have a proper title
      let title = domain.replace(/^www\./, '').split('.')[0];
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      // Update name field if it's empty
      if (!this.shortcutNameInput.value.trim()) {
        this.shortcutNameInput.value = title;
        this.currentWebsiteTitle = title;
      }
    } catch (error) {
      console.error('Error fetching URL info:', error);
      alert('获取网站信息失败');
    } finally {
      // Reset button state
      this.fetchUrlInfoBtn.disabled = false;
      this.fetchUrlInfoBtn.innerHTML = '<span class="material-symbols-rounded">download</span>';
    }
  }

  /**
   * Open add shortcut modal
   * @param {string} categoryId - The category ID to add shortcut to
   */
  openAddShortcutModal(categoryId) {
    this.isEditMode = false;
    document.getElementById('shortcut-modal-title').textContent = '添加快捷方式';
    this.shortcutIdInput.value = '';
    this.shortcutCategoryIdInput.value = categoryId;
    this.shortcutNameInput.value = '';
    this.shortcutUrlInput.value = 'https://';
    this.shortcutColorInput.value = '#4285f4';
    this.shortcutIconUrlInput.value = '';
    this.deleteShortcutBtn.style.display = 'none';
    
    // Reset icon type to letter
    document.getElementById('icon-type-letter').checked = true;
    this.toggleIconTypeFields();
    
    // Reset preview
    this.currentFaviconUrl = '';
    this.faviconImage.src = '';
    this.faviconPreview.classList.add('hidden');
    
    openModal(this.shortcutModal);
  }

  /**
   * Open edit shortcut modal
   * @param {string} categoryId - The category ID
   * @param {string} shortcutId - The shortcut ID to edit
   */
  openEditShortcutModal(categoryId, shortcutId) {
    const shortcut = storageManager.getShortcut(categoryId, shortcutId);
    if (!shortcut) {
      console.error(`Shortcut with ID ${shortcutId} not found in category ${categoryId}`);
      return;
    }
    
    this.isEditMode = true;
    document.getElementById('shortcut-modal-title').textContent = '编辑快捷方式';
    this.shortcutIdInput.value = shortcutId;
    this.shortcutCategoryIdInput.value = categoryId;
    this.shortcutNameInput.value = shortcut.name;
    this.shortcutUrlInput.value = shortcut.url;
    this.shortcutColorInput.value = shortcut.iconColor || '#4285f4';
    this.shortcutIconUrlInput.value = shortcut.iconUrl || '';
    this.deleteShortcutBtn.style.display = 'block';
    
    // Set the correct icon type
    document.getElementById(`icon-type-${shortcut.iconType || 'letter'}`).checked = true;
    
    // Set favicon preview if available
    if (shortcut.iconType === 'favicon' && shortcut.iconUrl) {
      this.currentFaviconUrl = shortcut.iconUrl;
      this.faviconImage.src = shortcut.iconUrl;
      this.faviconPreview.classList.remove('hidden');
    } else {
      this.faviconPreview.classList.add('hidden');
    }
    
    this.toggleIconTypeFields();
    openModal(this.shortcutModal);
  }

  /**
   * Save shortcut (add or update)
   */
  async saveShortcut() {
    const shortcutId = this.shortcutIdInput.value;
    const categoryId = this.shortcutCategoryIdInput.value;
    const selectedIconType = document.querySelector('input[name="icon-type"]:checked').value;
    
    const shortcutData = {
      name: this.shortcutNameInput.value,
      url: this.shortcutUrlInput.value,
      iconType: selectedIconType,
      iconColor: this.shortcutColorInput.value
    };
    
    // Add icon URL based on icon type
    if (selectedIconType === 'favicon' && this.currentFaviconUrl) {
      shortcutData.iconUrl = this.currentFaviconUrl;
    } else if (selectedIconType === 'custom') {
      shortcutData.iconUrl = this.shortcutIconUrlInput.value;
    } else {
      shortcutData.iconUrl = '';
    }
    
    // Ensure URL has protocol
    if (!shortcutData.url.match(/^https?:\/\//)) {
      shortcutData.url = 'https://' + shortcutData.url;
    }
    
    try {
      if (this.isEditMode) {
        await storageManager.updateShortcut(categoryId, shortcutId, shortcutData);
      } else {
        await storageManager.addShortcut(categoryId, shortcutData);
      }
      
      closeModal(this.shortcutModal);
      categoryManager.renderCategories();
    } catch (error) {
      console.error('Error saving shortcut:', error);
      alert(`保存快捷方式时出错: ${error.message}`);
    }
  }

  /**
   * Delete shortcut
   */
  async deleteShortcut() {
    const shortcutId = this.shortcutIdInput.value;
    const categoryId = this.shortcutCategoryIdInput.value;

    if (!confirm('确定要删除此快捷方式吗？')) {
      return;
    }

    try {
      await storageManager.deleteShortcut(categoryId, shortcutId);
      closeModal(this.shortcutModal);
      categoryManager.renderCategories();
    } catch (error) {
      console.error('Error deleting shortcut:', error);
      alert(`删除快捷方式时出错: ${error.message}`);
    }
  }

  /**
   * Get favicon URL with fallback options
   * @param {string} domain - The domain name
   * @returns {string} Favicon URL
   */
  getFaviconUrl(domain) {
    // 优先使用网站自己的favicon
    const directFavicon = `https://${domain}/favicon.ico`;

    // 备选方案列表（按优先级排序）
    const fallbackServices = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://api.faviconkit.com/${domain}/64`,
      directFavicon
    ];

    // 返回第一个可用的服务
    return fallbackServices[0];
  }
}

// Create instance
const shortcutManager = new ShortcutManager(); 