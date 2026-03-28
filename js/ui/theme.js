/**
 * Theme and background helpers.
 * Reads the current theme metadata from `UnifiedDataManager`.
 */

const backgroundContainer = document.querySelector('.background-container');
const backgroundOverlay = document.querySelector('.background-overlay');
const homeSearchInput = document.getElementById('search-input');
const floatingButtons = document.getElementById('floating-buttons');
const floatingButtonsGroup = document.getElementById('floating-buttons-group');

let homeDisplayModeInitialized = false;
let wallpaperControlsHideTimer = null;

/**
 * Initializes theme settings when a page loads.
 */
async function initThemeSettings() {
  await loadThemeSettings();
}

/**
 * Applies the currently active theme settings.
 */
async function loadThemeSettings() {
  try {
    console.log('Theme: applying current visual settings...');

    if (!window.unifiedDataManager) {
      console.warn('UnifiedDataManager is unavailable; falling back to default theme.');
      applyThemeClass('default');
      applyBackgroundImageToDOM(null, 30);
      loadDisplayModeSettings();
      return;
    }

    const themeMeta = window.unifiedDataManager.getCurrentTheme();

    if (!themeMeta) {
      applyThemeClass('default');
      applyBackgroundImageToDOM(null, 30);
      loadDisplayModeSettings();
      return;
    }

    applyThemeClass(themeMeta.themeType || 'default');

    const bgUrl = themeMeta.bgImageUrl;
    const opacity = typeof themeMeta.bgOpacity === 'number' ? themeMeta.bgOpacity : 30;

    applyBackgroundImageToDOM(bgUrl, opacity);
    loadDisplayModeSettings();
  } catch (error) {
    console.error('Theme: failed to load settings:', error);
    applyThemeClass('default');
    applyBackgroundImageToDOM(null, 30);
    applyDisplayModeToDOM('standard');
  }
}

/**
 * Applies the theme CSS class to the page.
 * @param {string} themeType
 */
function applyThemeClass(themeType) {
  if (document.body && document.body.classList) {
    document.body.classList.remove(
      'theme-default',
      'theme-blue',
      'theme-green',
      'theme-purple',
      'theme-pink',
      'theme-dark'
    );

    const targetClass = themeType ? `theme-${themeType}` : 'theme-default';
    document.body.classList.add(targetClass);
  }
}

/**
 * Applies the background image and overlay opacity to the DOM.
 * @param {string|null} imageUrl
 * @param {number} opacity
 */
function applyBackgroundImageToDOM(imageUrl, opacity = 30) {
  if (backgroundContainer && backgroundContainer.classList) {
    if (imageUrl) {
      backgroundContainer.classList.add('has-bg-image');
      backgroundContainer.style.backgroundImage = `url(${imageUrl})`;

      if (backgroundOverlay) {
        backgroundOverlay.style.opacity = 1 - (opacity / 100);
      }
    } else {
      backgroundContainer.classList.remove('has-bg-image');
      backgroundContainer.style.backgroundImage = '';

      if (backgroundOverlay) {
        backgroundOverlay.style.opacity = '0';
      }
    }
  }
}

/**
 * Temporarily previews theme changes in the UI.
 * @param {string} themeType
 * @param {string|null} imageUrl
 * @param {number} opacity
 */
function previewTheme(themeType, imageUrl, opacity) {
  applyThemeClass(themeType);
  applyBackgroundImageToDOM(imageUrl, opacity);
}

function normalizeDisplayMode(mode) {
  return ['standard', 'focus', 'wallpaper'].includes(mode) ? mode : 'standard';
}

function getCurrentDisplayModeSetting() {
  const settings = window.storageManager?.getSettings?.() || {};
  return normalizeDisplayMode(settings.displayMode);
}

function applyDisplayModeToDOM(mode) {
  if (!document.body || !document.body.classList) {
    return;
  }

  const normalizedMode = normalizeDisplayMode(mode);
  document.body.classList.remove('display-standard', 'display-focus', 'display-wallpaper');
  document.body.classList.add(`display-${normalizedMode}`);

  if (normalizedMode !== 'wallpaper') {
    document.body.classList.remove('wallpaper-search-active', 'wallpaper-controls-visible');
    clearWallpaperControlsHideTimer();
  }
}

function loadDisplayModeSettings() {
  applyDisplayModeToDOM(getCurrentDisplayModeSetting());
}

function clearWallpaperControlsHideTimer() {
  if (wallpaperControlsHideTimer) {
    clearTimeout(wallpaperControlsHideTimer);
    wallpaperControlsHideTimer = null;
  }
}

function showWallpaperControls() {
  if (!document.body?.classList.contains('display-wallpaper')
    && !document.body?.classList.contains('display-focus')) {
    return;
  }

  clearWallpaperControlsHideTimer();
  document.body.classList.add('wallpaper-controls-visible');
}

function scheduleWallpaperControlsHide() {
  if (!document.body?.classList.contains('display-wallpaper')
    && !document.body?.classList.contains('display-focus')) {
    return;
  }

  clearWallpaperControlsHideTimer();
  wallpaperControlsHideTimer = setTimeout(() => {
    const controlsHovered = !!floatingButtons?.matches(':hover');
    const controlsFocused = !!floatingButtons?.contains(document.activeElement);
    const menuExpanded = !!floatingButtonsGroup?.classList.contains('expanded');
    const searchVisible = document.body.classList.contains('wallpaper-search-active');

    if (!controlsHovered && !controlsFocused && !menuExpanded && !searchVisible) {
      document.body.classList.remove('wallpaper-controls-visible');
    }
  }, 1200);
}

function showWallpaperSearch() {
  if (!document.body?.classList.contains('display-wallpaper') || !homeSearchInput) {
    return;
  }

  showWallpaperControls();
  document.body.classList.add('wallpaper-search-active');
  requestAnimationFrame(() => {
    homeSearchInput.focus();
    homeSearchInput.select?.();
  });
}

function hideWallpaperSearch() {
  if (!document.body?.classList.contains('display-wallpaper')) {
    return;
  }

  document.body.classList.remove('wallpaper-search-active');
  if (homeSearchInput && document.activeElement === homeSearchInput) {
    homeSearchInput.blur();
  }
  scheduleWallpaperControlsHide();
}

function handleWallpaperPointerMove(event) {
  if (!document.body?.classList.contains('display-wallpaper')
    && !document.body?.classList.contains('display-focus')) {
    return;
  }

  const nearBottomRight = (window.innerWidth - event.clientX) <= 220
    && (window.innerHeight - event.clientY) <= 220;

  if (nearBottomRight) {
    showWallpaperControls();
    return;
  }

  scheduleWallpaperControlsHide();
}

function initHomeDisplayMode() {
  if (homeDisplayModeInitialized || !document.body?.classList.contains('home-page')) {
    return;
  }

  homeDisplayModeInitialized = true;

  document.addEventListener('keydown', (event) => {
    if (!document.body?.classList.contains('display-wallpaper')) {
      return;
    }

    const activeTagName = document.activeElement?.tagName;
    const isInputLikeElement = activeTagName === 'INPUT'
      || activeTagName === 'TEXTAREA'
      || document.activeElement?.isContentEditable;

    if (event.key === '/' && !isInputLikeElement) {
      event.preventDefault();
      showWallpaperSearch();
      return;
    }

    if (event.key === 'Escape' && document.body.classList.contains('wallpaper-search-active')) {
      event.preventDefault();
      hideWallpaperSearch();
    }
  });

  document.addEventListener('mousemove', handleWallpaperPointerMove);

  document.addEventListener('click', (event) => {
    if (!document.body?.classList.contains('display-wallpaper')
      && !document.body?.classList.contains('display-focus')) {
      return;
    }

    const clickedInsideSearch = !!event.target.closest('.home-header');
    const clickedInsideControls = !!event.target.closest('.floating-buttons');

    if (!clickedInsideSearch && !clickedInsideControls && document.body.classList.contains('wallpaper-search-active')) {
      hideWallpaperSearch();
      return;
    }

    if (clickedInsideControls) {
      showWallpaperControls();
    }
  });

  document.addEventListener('touchstart', (event) => {
    if (!document.body?.classList.contains('display-wallpaper')
      && !document.body?.classList.contains('display-focus')) {
      return;
    }

    const touchedInsideSearch = !!event.target.closest('.home-header');
    const touchedInsideControls = !!event.target.closest('.floating-buttons');

    showWallpaperControls();

    if (!touchedInsideSearch && !touchedInsideControls && document.body.classList.contains('wallpaper-search-active')) {
      hideWallpaperSearch();
    }
  }, { passive: true });

  floatingButtons?.addEventListener('mouseenter', showWallpaperControls);
  floatingButtons?.addEventListener('mouseleave', scheduleWallpaperControlsHide);
  homeSearchInput?.addEventListener('focus', () => {
    if (document.body?.classList.contains('display-wallpaper')) {
      document.body.classList.add('wallpaper-search-active');
      showWallpaperControls();
    }
  });
  homeSearchInput?.addEventListener('blur', () => {
    if (document.body?.classList.contains('display-wallpaper')) {
      scheduleWallpaperControlsHide();
    }
  });

  loadDisplayModeSettings();
}

window.initThemeSettings = initThemeSettings;
window.loadThemeSettings = loadThemeSettings;
window.previewTheme = previewTheme;
window.applyThemeClass = applyThemeClass;
window.applyBackgroundImageToDOM = applyBackgroundImageToDOM;
window.initHomeDisplayMode = initHomeDisplayMode;
window.loadDisplayModeSettings = loadDisplayModeSettings;
window.applyDisplayModeToDOM = applyDisplayModeToDOM;
