/**
 * 主题和背景图片设置管理
 */

// 主题设置相关元素
const themeBtn = document.getElementById('theme-btn');
const themeModal = document.getElementById('theme-modal');
const themeOptions = document.querySelectorAll('.theme-option');
const backgroundContainer = document.querySelector('.background-container');
const backgroundOverlay = document.querySelector('.background-overlay');

// 背景图片相关元素
const bgImageUpload = document.getElementById('bg-image-upload');
const bgPreviewImg = document.getElementById('background-preview-img');
const bgOpacitySlider = document.getElementById('bg-opacity');
const bgOpacityValue = document.getElementById('bg-opacity-value');
const removeBgBtn = document.getElementById('remove-bg-btn');
const applyBgBtn = document.getElementById('apply-bg-btn');

// 存储键名
const THEME_STORAGE_KEY = 'quick_nav_theme';
const BG_IMAGE_STORAGE_KEY = 'quick_nav_bg_image';
const BG_OPACITY_STORAGE_KEY = 'quick_nav_bg_opacity';

// 当前主题设置状态
let currentTheme = 'default';
let currentBgImageData = null;
let currentBgOpacity = 30;
let tempBgImageData = null;

/**
 * 初始化主题设置
 */
function initThemeSettings() {
  // 加载保存的主题设置
  loadThemeSettings();
  
  // 打开主题设置模态框
  themeBtn.addEventListener('click', () => {
    openModal(themeModal);
    updateThemeOptionsUI();
    showCurrentBackgroundPreview();
  });
  
  // 主题选项点击事件
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      applyTheme(theme);
      updateThemeOptionsUI();
    });
  });
  
  // 背景图片上传
  bgImageUpload.addEventListener('change', handleBgImageUpload);
  
  // 背景透明度滑块
  bgOpacitySlider.addEventListener('input', handleOpacityChange);
  
  // 应用背景图片按钮
  applyBgBtn.addEventListener('click', applyBackgroundImage);
  
  // 移除背景图片按钮
  removeBgBtn.addEventListener('click', removeBackgroundImage);
}

/**
 * 加载保存的主题设置
 */
async function loadThemeSettings() {
  try {
    const settings = await storage.get([THEME_STORAGE_KEY, BG_IMAGE_STORAGE_KEY, BG_OPACITY_STORAGE_KEY]);
    
    // 加载主题
    if (settings[THEME_STORAGE_KEY]) {
      currentTheme = settings[THEME_STORAGE_KEY];
      applyTheme(currentTheme, false);
    }
    
    // 加载背景透明度
    if (settings[BG_OPACITY_STORAGE_KEY] !== undefined) {
      currentBgOpacity = parseInt(settings[BG_OPACITY_STORAGE_KEY]);
      bgOpacitySlider.value = currentBgOpacity;
      bgOpacityValue.textContent = `${currentBgOpacity}%`;
      backgroundOverlay.style.opacity = 1 - (currentBgOpacity / 100);
    }
    
    // 加载背景图片
    if (settings[BG_IMAGE_STORAGE_KEY]) {
      currentBgImageData = settings[BG_IMAGE_STORAGE_KEY];
      applyBackgroundImageToDOM(currentBgImageData);
    }
  } catch (error) {
    console.error('加载主题设置出错:', error);
  }
}

/**
 * 应用主题
 * @param {string} theme - 主题名称
 * @param {boolean} save - 是否保存设置
 */
async function applyTheme(theme, save = true) {
  // 移除所有主题类
  document.body.classList.remove(
    'theme-default', 
    'theme-blue', 
    'theme-green', 
    'theme-purple', 
    'theme-pink', 
    'theme-dark'
  );
  
  // 添加新主题类
  document.body.classList.add(`theme-${theme}`);
  currentTheme = theme;
  
  // 保存主题设置
  if (save) {
    try {
      await storage.set({ [THEME_STORAGE_KEY]: theme });
    } catch (error) {
      console.error('保存主题设置出错:', error);
    }
  }
}

/**
 * 更新主题选项UI
 */
function updateThemeOptionsUI() {
  themeOptions.forEach(option => {
    option.classList.remove('active');
    if (option.dataset.theme === currentTheme) {
      option.classList.add('active');
    }
  });
}

/**
 * 处理背景图片上传
 * @param {Event} event - 上传事件对象
 */
function handleBgImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    tempBgImageData = e.target.result;
    showBackgroundPreview(tempBgImageData);
  };
  reader.readAsDataURL(file);
}

/**
 * 显示背景图片预览
 * @param {string} imageData - 图片数据（base64）
 */
function showBackgroundPreview(imageData) {
  if (imageData) {
    bgPreviewImg.src = imageData;
    bgPreviewImg.classList.add('has-image');
    document.querySelector('.no-bg-placeholder').style.display = 'none';
  } else {
    bgPreviewImg.classList.remove('has-image');
    document.querySelector('.no-bg-placeholder').style.display = 'flex';
  }
}

/**
 * 显示当前背景预览
 */
function showCurrentBackgroundPreview() {
  showBackgroundPreview(currentBgImageData);
  tempBgImageData = currentBgImageData;
}

/**
 * 处理透明度变化
 */
function handleOpacityChange() {
  const opacity = bgOpacitySlider.value;
  bgOpacityValue.textContent = `${opacity}%`;
  backgroundOverlay.style.opacity = 1 - (opacity / 100);
}

/**
 * 应用背景图片
 */
async function applyBackgroundImage() {
  if (tempBgImageData) {
    currentBgImageData = tempBgImageData;
    currentBgOpacity = parseInt(bgOpacitySlider.value);
    
    applyBackgroundImageToDOM(currentBgImageData);
    
    // 保存设置
    try {
      await storage.set({
        [BG_IMAGE_STORAGE_KEY]: currentBgImageData,
        [BG_OPACITY_STORAGE_KEY]: currentBgOpacity
      });
      closeModal(themeModal);
    } catch (error) {
      console.error('保存背景图片设置出错:', error);
    }
  }
}

/**
 * 应用背景图片到DOM
 * @param {string} imageData - 图片数据（base64）
 */
function applyBackgroundImageToDOM(imageData) {
  if (imageData) {
    backgroundContainer.classList.add('has-bg-image');
    backgroundContainer.style.backgroundImage = `url(${imageData})`;
    backgroundOverlay.style.opacity = 1 - (currentBgOpacity / 100);
  } else {
    backgroundContainer.classList.remove('has-bg-image');
    backgroundContainer.style.backgroundImage = '';
  }
}

/**
 * 移除背景图片
 */
async function removeBackgroundImage() {
  currentBgImageData = null;
  tempBgImageData = null;
  
  // 更新UI
  showBackgroundPreview(null);
  backgroundContainer.classList.remove('has-bg-image');
  backgroundContainer.style.backgroundImage = '';
  
  // 保存设置
  try {
    await storage.set({ [BG_IMAGE_STORAGE_KEY]: null });
    bgOpacitySlider.value = 30;
    bgOpacityValue.textContent = '30%';
    await storage.set({ [BG_OPACITY_STORAGE_KEY]: 30 });
  } catch (error) {
    console.error('移除背景图片设置出错:', error);
  }
}

// 导出主题设置初始化函数
window.initThemeSettings = initThemeSettings; 