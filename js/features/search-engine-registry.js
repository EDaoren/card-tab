/**
 * Search engine registry for the Card Tab extension.
 * Stores built-in engines in code and merges them with workspace custom engines.
 */

(function attachSearchEngineRegistry(globalScope) {
  const SEARCH_ENGINE_CATEGORY_META = {
    general: {
      id: 'general',
      label: '通用搜索'
    },
    ai: {
      id: 'ai',
      label: 'AI搜索'
    },
    development: {
      id: 'development',
      label: '开发技术搜索'
    },
    academic: {
      id: 'academic',
      label: '学术搜索'
    },
    social: {
      id: 'social',
      label: '社交媒体搜索'
    },
    custom: {
      id: 'custom',
      label: '自定义搜索'
    }
  };

  const BUILTIN_SEARCH_ENGINES = [
    {
      id: 'browser-default',
      name: '默认搜索',
      type: 'chrome-default',
      category: 'general',
      iconType: 'material',
      iconValue: 'language'
    },
    {
      id: 'google',
      name: 'Google',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://www.google.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/google.png'
    },
    {
      id: 'bing',
      name: 'Bing',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://www.bing.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/bing.png'
    },
    {
      id: 'baidu',
      name: '百度',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://www.baidu.com/s?wd=%s',
      iconType: 'local',
      iconPath: 'icons/baidu.png'
    },
    {
      id: 'ddg',
      name: 'DuckDuckGo',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://duckduckgo.com/?q=%s',
      iconType: 'local',
      iconPath: 'icons/duckduckgo.png'
    },
    {
      id: 'brave',
      name: 'Brave',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://search.brave.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/brave.svg'
    },
    {
      id: 'stackoverflow',
      name: 'Stack Overflow',
      type: 'url',
      category: 'development',
      urlTemplate: 'https://stackoverflow.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/stackoverflow.svg'
    },
    {
      id: 'npm',
      name: 'npm',
      type: 'url',
      category: 'development',
      urlTemplate: 'https://www.npmjs.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/npm.svg'
    },
    {
      id: 'mdn',
      name: 'MDN',
      type: 'url',
      category: 'development',
      urlTemplate: 'https://developer.mozilla.org/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/mdn.svg'
    },
    {
      id: 'pypi',
      name: 'PyPI',
      type: 'url',
      category: 'development',
      urlTemplate: 'https://pypi.org/search/?q=%s',
      iconType: 'local',
      iconPath: 'icons/pypi.svg'
    },
    {
      id: 'kimi',
      name: 'Kimi',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://kimi.moonshot.cn/?q=%s',
      iconType: 'local',
      iconPath: 'icons/kimi.png'
    },
    {
      id: 'doubao',
      name: '豆包',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://www.doubao.com/?q=%s',
      iconType: 'local',
      iconPath: 'icons/doubao.png'
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://chatgpt.com/?q=%s',
      iconType: 'local',
      iconPath: 'icons/chatgpt.png'
    },
    {
      id: 'gemini',
      name: 'Gemini',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://gemini.google.com/app?q=%s',
      iconType: 'local',
      iconPath: 'icons/gemini.png'
    },
    {
      id: 'qwen',
      name: 'Qwen',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://qwen.ai/qwenchat?q=%s',
      iconType: 'local',
      iconPath: 'icons/qwen.ico'
    },
    {
      id: 'felo',
      name: 'Felo',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://felo.ai/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/felo.png'
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://www.perplexity.ai/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/perplexity.png'
    },
    {
      id: 'metaso',
      name: '秘塔',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://metaso.cn/?q=%s',
      iconType: 'local',
      iconPath: 'icons/metaso.png'
    },
    {
      id: 'semanticscholar',
      name: 'Semantic Scholar',
      type: 'url',
      category: 'academic',
      urlTemplate: 'https://www.semanticscholar.org/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/semanticscholar.png'
    },
    {
      id: 'googlescholar',
      name: 'Google Scholar',
      type: 'url',
      category: 'academic',
      urlTemplate: 'https://scholar.google.com/scholar?q=%s',
      iconType: 'local',
      iconPath: 'icons/googlescholar.svg'
    },
    {
      id: 'arxiv',
      name: 'arXiv',
      type: 'url',
      category: 'academic',
      urlTemplate: 'https://arxiv.org/search/?query=%s&searchtype=all',
      iconType: 'local',
      iconPath: 'icons/arxiv.png'
    },
    {
      id: 'pubmed',
      name: 'PubMed',
      type: 'url',
      category: 'academic',
      urlTemplate: 'https://pubmed.ncbi.nlm.nih.gov/?term=%s',
      iconType: 'local',
      iconPath: 'icons/pubmed.png'
    },
    {
      id: 'deepseek',
      name: 'Deepseek',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://chat.deepseek.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/deepseek.png'
    },
    {
      id: 'grok',
      name: 'Grok',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://grok.com/?q=%s',
      iconType: 'local',
      iconPath: 'icons/grok.png'
    },
    {
      id: 'glm',
      name: 'GLM',
      type: 'url',
      category: 'ai',
      urlTemplate: 'https://chatglm.cn/?q=%s',
      iconType: 'local',
      iconPath: 'icons/glm.ico'
    },
    {
      id: 'xiaohongshu',
      name: '小红书',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://www.xiaohongshu.com/search_result?keyword=%s',
      iconType: 'local',
      iconPath: 'icons/xiaohongshu.png'
    },
    {
      id: 'weibo',
      name: '微博',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://s.weibo.com/weibo?q=%s',
      iconType: 'local',
      iconPath: 'icons/weibo.svg'
    },
    {
      id: 'douyin',
      name: '抖音',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://www.douyin.com/search/%s',
      iconType: 'local',
      iconPath: 'icons/douyin.svg'
    },
    {
      id: 'yahoo',
      name: '雅虎',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://search.yahoo.com/search?p=%s',
      iconType: 'local',
      iconPath: 'icons/yahoo.png'
    },
    {
      id: 'yandex',
      name: 'Yandex',
      type: 'url',
      category: 'general',
      urlTemplate: 'https://yandex.com/search/?text=%s',
      iconType: 'local',
      iconPath: 'icons/yandex.png'
    },
    {
      id: 'jike',
      name: '即刻',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://web.okjike.com/search?keyword=%s',
      iconType: 'local',
      iconPath: 'icons/jike.png'
    },
    {
      id: 'zhihu',
      name: '知乎',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://www.zhihu.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/zhihu.png'
    },
    {
      id: 'douban',
      name: '豆瓣',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://www.douban.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/douban.png'
    },
    {
      id: 'bilibili',
      name: '哔哩哔哩',
      type: 'url',
      category: 'social',
      urlTemplate: 'https://search.bilibili.com/all?keyword=%s',
      iconType: 'local',
      iconPath: 'icons/bilibili.png'
    },
    {
      id: 'github',
      name: 'GitHub',
      type: 'url',
      category: 'development',
      urlTemplate: 'https://github.com/search?q=%s',
      iconType: 'local',
      iconPath: 'icons/github.svg'
    }
  ];

  const DEFAULT_ENABLED_ENGINE_IDS = [
    'browser-default',
    'google',
    'bing',
    'baidu',
    'ddg',
    'kimi',
    'doubao',
    'chatgpt',
    'felo',
    'metaso',
    'xiaohongshu'
  ];

  function cloneEngine(engine) {
    return { ...engine };
  }

  function createBadgeText(name = '') {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return '?';
    }

    const firstChar = trimmedName.charAt(0);
    if (/[\u4e00-\u9fff]/.test(firstChar)) {
      return firstChar;
    }

    return trimmedName.slice(0, 2).toUpperCase();
  }

  function normalizeCustomEngine(engine = {}, index = 0) {
    if (!engine || typeof engine !== 'object') {
      return null;
    }

    const name = typeof engine.name === 'string' ? engine.name.trim() : '';
    const urlTemplate = typeof engine.urlTemplate === 'string' ? engine.urlTemplate.trim() : '';
    const iconUrl = typeof engine.iconUrl === 'string' ? engine.iconUrl.trim() : '';
    const id = typeof engine.id === 'string' && engine.id.trim()
      ? engine.id.trim()
      : `custom-${Date.now()}-${index}`;

    if (!name || !urlTemplate || !urlTemplate.includes('%s')) {
      return null;
    }

    return {
      id,
      name,
      type: 'url',
      category: 'custom',
      urlTemplate,
      iconType: iconUrl ? 'image' : 'badge',
      iconUrl,
      iconValue: createBadgeText(name),
      badgeClass: 'search-engine-badge-custom'
    };
  }

  function getBuiltInEngines() {
    return BUILTIN_SEARCH_ENGINES.map(cloneEngine);
  }

  function getAllEngines(searchSettings = null) {
    const builtInEngines = getBuiltInEngines();
    const customEngines = Array.isArray(searchSettings?.customEngines)
      ? searchSettings.customEngines
          .map((engine, index) => normalizeCustomEngine(engine, index))
          .filter(Boolean)
      : [];

    return [...builtInEngines, ...customEngines];
  }

  function resolveSearchState(searchSettings = null) {
    const allEngines = getAllEngines(searchSettings);
    const engineMap = new Map(allEngines.map(engine => [engine.id, engine]));
    const enabledEngineIds = Array.isArray(searchSettings?.enabledEngineIds)
      ? searchSettings.enabledEngineIds.filter(engineId => engineMap.has(engineId))
      : DEFAULT_ENABLED_ENGINE_IDS.slice();

    const uniqueEnabledEngineIds = [];
    enabledEngineIds.forEach((engineId) => {
      if (!uniqueEnabledEngineIds.includes(engineId)) {
        uniqueEnabledEngineIds.push(engineId);
      }
    });

    if (!uniqueEnabledEngineIds.includes('browser-default')) {
      uniqueEnabledEngineIds.unshift('browser-default');
    }

    let defaultEngineId = typeof searchSettings?.defaultEngineId === 'string'
      ? searchSettings.defaultEngineId.trim()
      : 'browser-default';

    if (!engineMap.has(defaultEngineId)) {
      defaultEngineId = 'browser-default';
    }

    if (!uniqueEnabledEngineIds.includes(defaultEngineId)) {
      uniqueEnabledEngineIds.unshift(defaultEngineId);
    }

    return {
      defaultEngineId,
      enabledEngineIds: uniqueEnabledEngineIds,
      customEngines: allEngines.filter(engine => !BUILTIN_SEARCH_ENGINES.some(builtIn => builtIn.id === engine.id)),
      openInNewTab: searchSettings?.openInNewTab !== false,
      allEngines,
      enabledEngines: uniqueEnabledEngineIds.map(engineId => engineMap.get(engineId)).filter(Boolean),
      engineMap
    };
  }

  function getEngineById(engineId, searchSettings = null) {
    return resolveSearchState(searchSettings).engineMap.get(engineId) || null;
  }

  function buildSearchUrl(engine, query) {
    if (!engine || engine.type === 'chrome-default') {
      return '';
    }

    return engine.urlTemplate.replace('%s', encodeURIComponent(query));
  }

  function createCustomEngineDraft({ name = '', urlTemplate = '', iconUrl = '' } = {}) {
    const trimmedName = name.trim();
    return {
      id: `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: trimmedName,
      category: 'custom',
      urlTemplate: urlTemplate.trim(),
      iconUrl: iconUrl.trim()
    };
  }

  function getCategoryMeta(categoryId = 'general') {
    return SEARCH_ENGINE_CATEGORY_META[categoryId] || SEARCH_ENGINE_CATEGORY_META.general;
  }

  function groupEnginesByCategory(engines = []) {
    const groupedEngines = {
      general: [],
      ai: [],
      development: [],
      academic: [],
      social: [],
      custom: []
    };

    engines.forEach((engine) => {
      const categoryId = engine?.category || 'general';
      if (!groupedEngines[categoryId]) {
        groupedEngines[categoryId] = [];
      }
      groupedEngines[categoryId].push(engine);
    });

    return groupedEngines;
  }

  function validateCustomEngineInput({ name = '', urlTemplate = '', iconUrl = '' } = {}) {
    const trimmedName = name.trim();
    const trimmedUrlTemplate = urlTemplate.trim();
    const trimmedIconUrl = iconUrl.trim();

    if (!trimmedName) {
      return { valid: false, message: '请填写搜索引擎名称' };
    }

    if (!trimmedUrlTemplate) {
      return { valid: false, message: '请填写搜索 URL 模板' };
    }

    if (!trimmedUrlTemplate.includes('%s')) {
      return { valid: false, message: '搜索 URL 模板必须包含 %s 占位符' };
    }

    try {
      const normalizedUrl = new URL(trimmedUrlTemplate.replace('%s', 'test'));
      if (!['http:', 'https:'].includes(normalizedUrl.protocol)) {
        return { valid: false, message: '搜索 URL 模板必须使用 http 或 https 协议' };
      }
    } catch (error) {
      return { valid: false, message: '搜索 URL 模板格式不正确' };
    }

    if (trimmedIconUrl) {
      try {
        const normalizedIconUrl = new URL(trimmedIconUrl);
        if (!['http:', 'https:'].includes(normalizedIconUrl.protocol)) {
          return { valid: false, message: '图标 URL 必须使用 http 或 https 协议' };
        }
      } catch (error) {
        return { valid: false, message: '图标 URL 格式不正确' };
      }
    }

    return { valid: true, message: '' };
  }

  globalScope.SearchEngineRegistry = {
    BUILTIN_SEARCH_ENGINES,
    DEFAULT_ENABLED_ENGINE_IDS,
    SEARCH_ENGINE_CATEGORY_META,
    createBadgeText,
    createCustomEngineDraft,
    getAllEngines,
    getBuiltInEngines,
    getCategoryMeta,
    getEngineById,
    groupEnginesByCategory,
    normalizeCustomEngine,
    resolveSearchState,
    buildSearchUrl,
    validateCustomEngineInput
  };
})(window);
