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
async function initThemeSettings() {
  // 加载保存的主题设置
  await loadThemeSettings();

  // 只有在DOM元素存在时才绑定事件
  if (themeBtn && themeBtn.addEventListener) {
    // 打开主题设置模态框
    themeBtn.addEventListener('click', async () => {
      openModal(themeModal);

      // 使用统一的配置刷新入口来更新UI
      if (typeof refreshCurrentConfiguration === 'function') {
        await refreshCurrentConfiguration();
      } else {
        // 降级：手动更新各个UI组件
        updateThemeOptionsUI();
        updateBackgroundImageUI();
        showCurrentBackgroundPreview();
      }

      // 更新配置切换区域显示
      if (window.themeConfigUIManager) {
        await themeConfigUIManager.updateConfigSwitchDisplay();
      }
    });
  }

  // 主题选项点击事件
  if (themeOptions && themeOptions.forEach) {
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        applyTheme(theme);
        updateThemeOptionsUI();
      });
    });
  }

  // 背景图片上传
  if (bgImageUpload && bgImageUpload.addEventListener) {
    bgImageUpload.addEventListener('change', handleBgImageUpload);
  }

  // 背景透明度滑块
  if (bgOpacitySlider && bgOpacitySlider.addEventListener) {
    bgOpacitySlider.addEventListener('input', handleOpacityChange);
  }

  // 应用背景图片按钮
  if (applyBgBtn && applyBgBtn.addEventListener) {
    applyBgBtn.addEventListener('click', applyBackgroundImage);
  }

  // 移除背景图片按钮
  if (removeBgBtn && removeBgBtn.addEventListener) {
    removeBgBtn.addEventListener('click', removeBackgroundImage);
  }

  // 配置Supabase按钮
  if (setupSupabaseBtn && setupSupabaseBtn.addEventListener) {
    setupSupabaseBtn.addEventListener('click', openSupabaseSetup);
  }
}

/**
 * 加载保存的主题设置
 */
async function loadThemeSettings() {
  try {
    console.log('开始加载主题设置...');

    // 首先清空当前设置
    currentTheme = 'default';
    currentBgImageData = null;
    currentBgImageUrl = null;
    currentBgImagePath = null;
    currentBgOpacity = 30;

    // 重置所有变量为默认值

    // 从syncManager加载数据
    let loadedData = null;
    if (window.syncManager) {
      // 根据云端同步状态决定加载策略
      const preferCloud = syncManager.isSupabaseEnabled;
      loadedData = await syncManager.loadData(preferCloud, false);
    }

    // 处理加载到的数据
    if (loadedData && loadedData.themeSettings) {
      const themeSettings = loadedData.themeSettings;

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

      // 加载背景图片 - 根据云端同步状态决定是否显示
      const shouldShowBackground = window.syncManager && syncManager.isSupabaseEnabled;

      if (shouldShowBackground && themeSettings.backgroundImageUrl) {
        // 云端模式：显示URL背景图片
        currentBgImageUrl = themeSettings.backgroundImageUrl;
        currentBgImagePath = themeSettings.backgroundImagePath;
        currentBgImageData = null;
        applyBackgroundImageToDOM(currentBgImageUrl);
      } else if (shouldShowBackground && themeSettings.backgroundImage) {
        // 兼容旧的base64格式
        currentBgImageData = themeSettings.backgroundImage;
        currentBgImageUrl = null;
        currentBgImagePath = null;
        applyBackgroundImageToDOM(currentBgImageData);
      } else {
        // 本地模式或无背景图片：不显示背景图片
        currentBgImageData = null;
        currentBgImageUrl = null;
        currentBgImagePath = null;
        applyBackgroundImageToDOM(null);
      }

      return;
    }

    // 如果没有任何数据，应用默认设置
    applyTheme(currentTheme, false);
    applyBackgroundImageToDOM(null);
    if (bgOpacitySlider) {
      bgOpacitySlider.value = currentBgOpacity;
      bgOpacityValue.textContent = `${currentBgOpacity}%`;
      backgroundOverlay.style.opacity = 1 - (currentBgOpacity / 100);
    }
  } catch (error) {
    console.error('加载主题设置出错:', error);
    // 出错时应用默认设置
    applyTheme('default', false);
    applyBackgroundImageToDOM(null);
  }
}

/**
 * 应用主题
 * @param {string} theme - 主题名称
 * @param {boolean} save - 是否保存设置
 */
async function applyTheme(theme, save = true) {
  // 安全地移除所有主题类
  if (document.body && document.body.classList) {
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
  }

  currentTheme = theme;

  // 保存设置（遵循旁路缓存原则）
  if (save) {
    try {
      await saveThemeOnly(theme);
    } catch (error) {
      console.error('保存主题设置失败:', error);
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

  // 检查Supabase是否可用（新上传需要Supabase）
  if (!window.syncManager || !syncManager.isSupabaseEnabled) {
    alert('上传新背景图片需要配置Supabase云端存储，请先配置云端同步。');
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

      // 遵循旁路缓存原则：先更新数据源，再清除缓存
      await saveBackgroundImageSettings(uploadResult.url, uploadResult.path, parseInt(bgOpacitySlider.value));

      // 应用背景图片到UI
      applyBackgroundImageToDOM(uploadResult.url);

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
  // 安全地操作DOM元素
  if (backgroundContainer && backgroundContainer.classList) {
    if (imageData) {
      backgroundContainer.classList.add('has-bg-image');
      backgroundContainer.style.backgroundImage = `url(${imageData})`;
      if (backgroundOverlay) {
        backgroundOverlay.style.opacity = 1 - (currentBgOpacity / 100);
      }
    } else {
      backgroundContainer.classList.remove('has-bg-image');
      backgroundContainer.style.backgroundImage = '';
    }
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

    // 遵循旁路缓存原则：先更新数据源，再清除缓存
    await saveBackgroundImageSettings(null, null, 30);

    // 更新UI
    showBackgroundPreview(null);
    backgroundContainer.classList.remove('has-bg-image');
    backgroundContainer.style.backgroundImage = '';

    // 重置UI控件
    if (bgOpacitySlider) {
      bgOpacitySlider.value = 30;
    }
    if (bgOpacityValue) {
      bgOpacityValue.textContent = '30%';
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
  // 如果当前有背景图片，即使Supabase被禁用也应该允许管理
  if (currentBgImageUrl || currentBgImageData) {
    return true;
  }

  // 新上传背景图片需要Supabase
  return window.syncManager && syncManager.isSupabaseEnabled;
}

/**
 * 更新背景图片UI状态
 */
function updateBackgroundImageUI() {
  const isSupabaseEnabled = window.syncManager && syncManager.isSupabaseEnabled;
  const hasCurrentBg = currentBgImageUrl || currentBgImageData;

  if (isSupabaseEnabled) {
    // 云端模式：显示完整功能
    bgSetupPrompt.style.display = 'none';
    bgImageControls.style.display = 'block';
    hideBackgroundDisabledWarning();
  } else {
    // 本地模式：显示配置提示
    bgSetupPrompt.style.display = 'block';
    bgImageControls.style.display = 'none';

    // 如果有背景图片但云端被禁用，显示警告
    if (hasCurrentBg) {
      showBackgroundDisabledWarning();
    } else {
      hideBackgroundDisabledWarning();
    }
  }
}

/**
 * 显示背景图片功能被禁用的警告
 */
function showBackgroundDisabledWarning() {
  let warningDiv = document.getElementById('bg-disabled-warning');
  if (!warningDiv) {
    warningDiv = document.createElement('div');
    warningDiv.id = 'bg-disabled-warning';
    warningDiv.className = 'bg-warning';
    warningDiv.innerHTML = `
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <div class="warning-text">
          <strong>云端同步已禁用</strong>
          <p>当前背景图片可能无法正常显示，已自动切换到纯色背景</p>
        </div>
        <button onclick="openSupabaseSetup()" class="warning-btn">重新启用</button>
      </div>
    `;

    // 插入到背景图片控制区域的顶部
    bgImageControls.insertBefore(warningDiv, bgImageControls.firstChild);
  }
  warningDiv.style.display = 'block';
}

/**
 * 隐藏背景图片功能被禁用的警告
 */
function hideBackgroundDisabledWarning() {
  const warningDiv = document.getElementById('bg-disabled-warning');
  if (warningDiv) {
    warningDiv.style.display = 'none';
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
 * 遵循旁路缓存原则的背景图片设置保存函数
 * @param {string|null} imageUrl - 背景图片URL
 * @param {string|null} imagePath - 背景图片路径
 * @param {number} opacity - 背景透明度
 */
async function saveBackgroundImageSettings(imageUrl, imagePath, opacity) {
  try {
    console.log('🎨 Theme: 开始保存背景图片设置...', { imageUrl, imagePath, opacity });

    if (!window.syncManager) {
      throw new Error('SyncManager未初始化');
    }

    // 1. 获取当前完整数据（从数据源）
    const currentData = await syncManager.loadData(syncManager.isSupabaseEnabled) || { categories: [], settings: {} };
    console.log('🎨 Theme: 当前数据加载完成');

    // 2. 更新主题设置
    const updatedData = {
      ...currentData,
      themeSettings: {
        ...currentData.themeSettings,
        theme: currentTheme,
        backgroundImageUrl: imageUrl,
        backgroundImagePath: imagePath,
        backgroundOpacity: opacity,
        lastModified: new Date().toISOString()
      }
    };

    console.log('🎨 Theme: 准备保存的数据:', updatedData.themeSettings);

    // 3. 保存到数据源（Supabase优先，然后Chrome Storage）
    await syncManager.saveData(updatedData);
    console.log('🎨 Theme: 数据已保存到数据源');

    // 4. 重新加载数据确保一致性
    await loadThemeSettings();
    console.log('🎨 Theme: 背景图片设置保存完成');

  } catch (error) {
    console.error('🎨 Theme: 保存背景图片设置失败:', error);
    throw error;
  }
}

/**
 * 简化的主题保存函数（用于主题切换）
 * @param {string} theme - 主题名称
 */
async function saveThemeOnly(theme) {
  try {
    console.log('🎨 Theme: 开始保存主题:', theme);

    if (!window.syncManager) {
      throw new Error('SyncManager未初始化');
    }

    // 1. 获取当前完整数据
    const currentData = await syncManager.loadData(syncManager.isSupabaseEnabled) || { categories: [], settings: {} };

    // 2. 更新主题设置
    const updatedData = {
      ...currentData,
      themeSettings: {
        ...currentData.themeSettings,
        theme: theme,
        lastModified: new Date().toISOString()
      }
    };

    // 3. 保存到数据源
    await syncManager.saveData(updatedData);

    // 4. 重新加载数据确保一致性
    await loadThemeSettings();
    console.log('🎨 Theme: 主题保存完成');

  } catch (error) {
    console.error('🎨 Theme: 保存主题失败:', error);
    throw error;
  }
}





// 导出主题设置相关函数
window.initThemeSettings = initThemeSettings;
window.loadThemeSettings = loadThemeSettings;
window.applyTheme = applyTheme;
window.showCurrentBackgroundPreview = showCurrentBackgroundPreview;
window.updateThemeOptionsUI = updateThemeOptionsUI;
window.updateBackgroundImageUI = updateBackgroundImageUI;

/**
 * 配置切换后强制重新加载主题设置
 */
async function reloadThemeAfterConfigSwitch() {
  try {
    console.log('🔄 Theme: 配置切换后重新加载主题设置...');

    // 强制重新加载，跳过缓存
    if (window.syncManager) {
      const preferCloud = syncManager.isSupabaseEnabled;
      await loadThemeSettings();
      console.log('🔄 Theme: 配置切换后主题设置重新加载完成');
    }
  } catch (error) {
    console.error('🔄 Theme: 配置切换后重新加载主题设置失败:', error);
  }
}

/**
 * 数据验证函数
 */
function validateThemeData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // 验证主题设置结构
  if (data.themeSettings) {
    const ts = data.themeSettings;
    if (typeof ts !== 'object') return false;

    // 验证主题名称
    if (ts.theme && typeof ts.theme !== 'string') return false;

    // 验证透明度
    if (ts.backgroundOpacity !== undefined) {
      const opacity = parseInt(ts.backgroundOpacity);
      if (isNaN(opacity) || opacity < 0 || opacity > 100) return false;
    }
  }

  return true;
}

// 导出配置切换相关函数
window.reloadThemeAfterConfigSwitch = reloadThemeAfterConfigSwitch;
window.validateThemeData = validateThemeData;