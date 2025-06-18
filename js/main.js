/**
 * Main entry point for the Quick Nav Tab extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing Quick Nav Tab...');
    
    // Initialize storage first (loads data from Chrome storage)
    await storageManager.init();
    
    // Initialize view based on saved settings
    await viewManager.initView();
    
    // Initialize theme settings
    initThemeSettings();
    
    // Render categories and shortcuts
    await categoryManager.renderCategories();
    
    console.log('Quick Nav Tab initialized successfully');
  } catch (error) {
    console.error('Error initializing Quick Nav Tab:', error);
  }
}); 