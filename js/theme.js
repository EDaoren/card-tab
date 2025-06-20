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

// 背景图片UI控制元素
const bgSetupPrompt = document.getElementById('bg-setup-prompt');
const bgImageControls = document.getElementById('bg-image-controls');
const setupSupabaseBtn = document.getElementById('setup-supabase-btn');

// 存储键名
const THEME_STORAGE_KEY = 'quick_nav_theme';
const BG_IMAGE_STORAGE_KEY = 'quick_nav_bg_image';
const BG_OPACITY_STORAGE_KEY = 'quick_nav_bg_opacity';

// 当前主题设置状态
let currentTheme = 'default';
let currentBgImageData = null;
let currentBgImageUrl = null;
let currentBgImagePath = null;
let currentBgOpacity = 30;
let tempBgImageFile = null;

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
    updateBackgroundImageUI();
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

  // 配置Supabase按钮
  setupSupabaseBtn.addEventListener('click', openSupabaseSetup);
}

/**
 * 加载保存的主题设置
 */
async function loadThemeSettings() {
  try {
    // 首先尝试从Supabase加载
    if (window.syncManager && syncManager.isSupabaseEnabled) {
      const syncData = await syncManager.loadData();
      if (syncData && syncData.themeSettings) {
        const themeSettings = syncData.themeSettings;

        // 加载主题
        if (themeSettings.theme) {
          currentTheme = themeSettings.theme;
          applyTheme(currentTheme, false);
        }

        // 加载背景透明度
        if (themeSettings.backgroundOpacity !== undefined) {
          currentBgOpacity = parseInt(themeSettings.backgroundOpacity);
          if (bgOpacitySlider) {
            bgOpacitySlider.value = currentBgOpacity;
            bgOpacityValue.textContent = `${currentBgOpacity}%`;
            backgroundOverlay.style.opacity = 1 - (currentBgOpacity / 100);
          }
        }

        // 加载背景图片
        if (themeSettings.backgroundImageUrl) {
          currentBgImageUrl = themeSettings.backgroundImageUrl;
          currentBgImagePath = themeSettings.backgroundImagePath;
          applyBackgroundImageToDOM(currentBgImageUrl);
        } else if (themeSettings.backgroundImage) {
          // 兼容旧的base64格式
          currentBgImageData = themeSettings.backgroundImage;
          applyBackgroundImageToDOM(currentBgImageData);
        }

        console.log('主题设置已从云端加载');
        return;
      }
    }

    // 回退到本地存储
    const settings = await storage.get([THEME_STORAGE_KEY, BG_IMAGE_STORAGE_KEY, BG_OPACITY_STORAGE_KEY]);

    if (settings[THEME_STORAGE_KEY]) {
      currentTheme = settings[THEME_STORAGE_KEY];
      applyTheme(currentTheme, false);
    }

    if (settings[BG_OPACITY_STORAGE_KEY] !== undefined) {
      currentBgOpacity = parseInt(settings[BG_OPACITY_STORAGE_KEY]);
      if (bgOpacitySlider) {
        bgOpacitySlider.value = currentBgOpacity;
        bgOpacityValue.textContent = `${currentBgOpacity}%`;
        backgroundOverlay.style.opacity = 1 - (currentBgOpacity / 100);
      }
    }

    if (settings[BG_IMAGE_STORAGE_KEY]) {
      currentBgImageData = settings[BG_IMAGE_STORAGE_KEY];
      applyBackgroundImageToDOM(currentBgImageData);
    }

    console.log('主题设置已从本地存储加载');
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
      // 如果Supabase可用，保存到云端
      if (isBackgroundImageAvailable()) {
        await saveThemeSettingsToSupabase();
      } else {
        // 否则保存到本地
        await storage.set({ [THEME_STORAGE_KEY]: theme });
      }
    } catch (error) {
      console.error('保存主题设置出错:', error);
      // 如果云端保存失败，尝试本地保存
      try {
        await storage.set({ [THEME_STORAGE_KEY]: theme });
      } catch (localError) {
        console.error('本地保存也失败:', localError);
      }
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

  // 检查Supabase是否可用
  if (!isBackgroundImageAvailable()) {
    alert('背景图片功能需要配置Supabase云端存储，请先配置云端同步。');
    event.target.value = ''; // 清空文件选择
    return;
  }

  // 检查文件大小 (50MB限制，Supabase免费版限制)
  const maxFileSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxFileSize) {
    alert('图片文件过大，请选择小于50MB的图片');
    event.target.value = '';
    return;
  }

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    event.target.value = '';
    return;
  }

  // 存储文件对象，而不是base64
  tempBgImageFile = file;

  // 显示预览
  const reader = new FileReader();
  reader.onload = (e) => {
    showBackgroundPreview(e.target.result);
    console.log(`图片大小: ${Math.round(file.size / 1024)}KB`);
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
  const imageToShow = currentBgImageUrl || currentBgImageData;
  showBackgroundPreview(imageToShow);
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
  if (!isBackgroundImageAvailable()) {
    alert('背景图片功能需要配置Supabase云端存储');
    return;
  }

  if (!tempBgImageFile) {
    alert('请先选择背景图片');
    return;
  }

  try {
    // 显示上传进度
    applyBgBtn.disabled = true;
    applyBgBtn.textContent = '上传中...';

    // 上传文件到Supabase Storage
    const uploadResult = await supabaseClient.uploadFile(tempBgImageFile);

    if (uploadResult.success) {
      // 删除旧的背景图片文件（如果存在）
      if (currentBgImagePath) {
        try {
          await supabaseClient.deleteFile('backgrounds', currentBgImagePath);
        } catch (error) {
          console.warn('删除旧背景图片失败:', error);
        }
      }

      // 更新当前背景图片信息
      currentBgImageUrl = uploadResult.url;
      currentBgImagePath = uploadResult.path;
      currentBgOpacity = parseInt(bgOpacitySlider.value);

      // 应用背景图片
      applyBackgroundImageToDOM(currentBgImageUrl);

      // 保存设置到Supabase数据库
      await saveThemeSettingsToSupabase();

      closeModal(themeModal);
      console.log('背景图片已上传并保存到云端');
      alert('背景图片设置成功！');
    }
  } catch (error) {
    console.error('保存背景图片设置出错:', error);
    alert(`保存背景图片失败: ${error.message}`);
  } finally {
    // 恢复按钮状态
    applyBgBtn.disabled = false;
    applyBgBtn.textContent = '应用背景';
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
  try {
    // 删除Supabase Storage中的文件
    if (currentBgImagePath && isBackgroundImageAvailable()) {
      try {
        await supabaseClient.deleteFile('backgrounds', currentBgImagePath);
        console.log('背景图片文件已从云端删除');
      } catch (error) {
        console.warn('删除云端背景图片文件失败:', error);
      }
    }

    // 清空变量
    currentBgImageData = null;
    currentBgImageUrl = null;
    currentBgImagePath = null;
    tempBgImageFile = null;

    // 更新UI
    showBackgroundPreview(null);
    backgroundContainer.classList.remove('has-bg-image');
    backgroundContainer.style.backgroundImage = '';

    // 重置透明度
    currentBgOpacity = 30;
    bgOpacitySlider.value = 30;
    bgOpacityValue.textContent = '30%';

    // 保存设置
    if (isBackgroundImageAvailable()) {
      await saveThemeSettingsToSupabase();
    } else {
      await storage.set({
        [BG_IMAGE_STORAGE_KEY]: null,
        [BG_OPACITY_STORAGE_KEY]: 30
      });
    }

    console.log('背景图片已移除');
  } catch (error) {
    console.error('移除背景图片设置出错:', error);
    alert('移除背景图片失败，请重试');
  }
}

/**
 * 检查背景图片功能是否可用
 * @returns {boolean} 是否可用
 */
function isBackgroundImageAvailable() {
  return window.syncManager && syncManager.isSupabaseEnabled;
}

/**
 * 更新背景图片UI状态
 */
function updateBackgroundImageUI() {
  const isAvailable = isBackgroundImageAvailable();

  if (isAvailable) {
    // 显示正常的背景图片设置界面
    bgSetupPrompt.style.display = 'none';
    bgImageControls.style.display = 'block';
  } else {
    // 显示配置Supabase的提示界面
    bgSetupPrompt.style.display = 'block';
    bgImageControls.style.display = 'none';
  }
}

/**
 * 打开Supabase配置界面
 */
function openSupabaseSetup() {
  // 关闭主题设置模态框
  closeModal(themeModal);

  // 打开同步设置模态框
  if (window.syncUIManager) {
    syncUIManager.openSyncModal();
  } else {
    alert('同步功能尚未初始化，请稍后再试');
  }
}

/**
 * 保存主题设置到Supabase
 */
async function saveThemeSettingsToSupabase() {
  if (!isBackgroundImageAvailable()) {
    throw new Error('Supabase未配置');
  }

  try {
    // 获取当前数据
    const currentData = await syncManager.loadData() || { categories: [], settings: {} };

    // 更新主题设置
    currentData.themeSettings = {
      theme: currentTheme,
      backgroundImageUrl: currentBgImageUrl,
      backgroundImagePath: currentBgImagePath,
      backgroundOpacity: currentBgOpacity,
      lastModified: new Date().toISOString()
    };

    // 保存到同步管理器（会自动同步到Supabase）
    await syncManager.saveData(currentData);

    console.log('主题设置已保存并同步到云端');
  } catch (error) {
    console.error('保存主题设置到Supabase失败:', error);
    throw error;
  }
}

// 导出主题设置初始化函数
window.initThemeSettings = initThemeSettings;