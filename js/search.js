/**
 * Search handler for the Quick Nav Tab extension
 */

class SearchManager {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Search input keydown
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });
    
    // Global keyboard shortcut for focusing search (/)
    document.addEventListener('keydown', (e) => {
      // Check if not already focusing on an input
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.searchInput.focus();
      }
    });
  }

  /**
   * Handle search action
   */
  handleSearch() {
    const query = this.searchInput.value.trim();
    
    if (!query) {
      return;
    }
    
    // Check if it's a URL (has dots and no spaces)
    if (this.isUrl(query)) {
      this.navigateToUrl(query);
    } else {
      // Otherwise, perform Google search
      this.performSearch(query);
    }
  }

  /**
   * Check if the query is a URL
   * @param {string} query - The search query
   * @returns {boolean} True if the query is a URL
   */
  isUrl(query) {
    // Simple URL validation (has dots, no spaces)
    return query.includes('.') && !query.includes(' ');
  }

  /**
   * Navigate to URL
   * @param {string} url - The URL to navigate to
   */
  navigateToUrl(url) {
    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }
    
    window.location.href = url;
  }

  /**
   * Perform Google search
   * @param {string} query - The search query
   */
  performSearch(query) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.location.href = searchUrl;
  }
}

// Create instance
const searchManager = new SearchManager(); 