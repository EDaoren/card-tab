/**
 * Favicon source helper.
 * Controls candidate ordering for shortcuts using website icons.
 */
(function() {
  const DEFAULT_SOURCE = 'browser-first';

  function normalizeUrl(url) {
    if (!url) {
      return '';
    }

    return url.match(/^https?:\/\//) ? url : `https://${url}`;
  }

  function getBrowserFaviconUrl(pageUrl, size = 64) {
    if (!pageUrl || !chrome?.runtime?.id) {
      return '';
    }

    try {
      const normalizedUrl = normalizeUrl(pageUrl);
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(normalizedUrl)}&size=${size}`;
    } catch (error) {
      console.warn('FaviconHelper: Failed to build browser favicon URL', error);
      return '';
    }
  }

  function getFaviconSourcePreference() {
    return window.storageManager?.getSettings?.().faviconSource || DEFAULT_SOURCE;
  }

  function getFaviconCandidates(pageUrl, fallbackUrl = '', size = 64) {
    const browserFaviconUrl = getBrowserFaviconUrl(pageUrl, size);
    const candidates = getFaviconSourcePreference() === 'online-first'
      ? [fallbackUrl, browserFaviconUrl]
      : [browserFaviconUrl, fallbackUrl];

    return candidates.filter(Boolean);
  }

  function applyImageFallback(image, candidates = [], options = {}) {
    const sources = [...new Set((candidates || []).filter(Boolean))];

    if (!image || sources.length === 0) {
      image?.removeAttribute?.('src');
      if (typeof options.onExhausted === 'function') {
        options.onExhausted();
      }
      return;
    }

    let currentIndex = 0;
    image.onerror = () => {
      currentIndex += 1;
      if (currentIndex < sources.length) {
        image.src = sources[currentIndex];
        return;
      }

      image.onerror = null;
      if (typeof options.onExhausted === 'function') {
        options.onExhausted();
      }
    };

    image.src = sources[currentIndex];
  }

  window.FaviconHelper = {
    DEFAULT_SOURCE,
    normalizeUrl,
    getBrowserFaviconUrl,
    getFaviconCandidates,
    applyImageFallback
  };
})();
