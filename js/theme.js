/**
 * Theme and background helpers.
 * Reads the current theme metadata from `UnifiedDataManager`.
 */

const backgroundContainer = document.querySelector('.background-container');
const backgroundOverlay = document.querySelector('.background-overlay');

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
      return;
    }

    const themeMeta = window.unifiedDataManager.getCurrentTheme();

    if (!themeMeta) {
      applyThemeClass('default');
      applyBackgroundImageToDOM(null, 30);
      return;
    }

    applyThemeClass(themeMeta.themeType || 'default');

    const bgUrl = themeMeta.bgImageUrl;
    const opacity = typeof themeMeta.bgOpacity === 'number' ? themeMeta.bgOpacity : 30;

    applyBackgroundImageToDOM(bgUrl, opacity);
  } catch (error) {
    console.error('Theme: failed to load settings:', error);
    applyThemeClass('default');
    applyBackgroundImageToDOM(null, 30);
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
        backgroundOverlay.style.opacity = 1 - (opacity / 100);
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

window.initThemeSettings = initThemeSettings;
window.loadThemeSettings = loadThemeSettings;
window.previewTheme = previewTheme;
window.applyThemeClass = applyThemeClass;
window.applyBackgroundImageToDOM = applyBackgroundImageToDOM;
