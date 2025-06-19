/**
 * Main entry point for the Quick Nav Tab extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing Quick Nav Tab...');

    // Initialize storage first (loads data from Chrome storage + Supabase)
    await storageManager.init();

    // Initialize view based on saved settings
    await viewManager.initView();

    // Initialize theme settings
    initThemeSettings();

    // Initialize sync UI
    syncUIManager.init();

    // Render categories and shortcuts
    await categoryManager.renderCategories();

    // Initialize icon system after everything is rendered
    iconManager.init();

    console.log('Quick Nav Tab initialized successfully');
  } catch (error) {
    console.error('Error initializing Quick Nav Tab:', error);
  }
});