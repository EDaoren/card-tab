/**
 * 统一数据管理器 (Unified Data Manager)
 * 负责管理所有配置和数据的存储、读取和同步。
 * 改为基于 themeId（主题）的配置管理模式。每套主题是一套完整的工作空间。
 */

class UnifiedDataManager {
    // 定义存储键
    STORAGE_KEYS = {
        APP_DATA: 'card_tab_app_data',          // 存储统地元数据（当前活跃主题、所有主题列表等）
        CONFIG_DATA: (themeId) => `cardTabData_${themeId}`, // 本地缓存特定主题的数据
        CHROME_SYNC_DATA: (themeId) => `chrome_sync_${themeId}`,
        SUPABASE_CONFIG: 'supabase_config',     // Supabase 连接配置
        CF_CONFIG: 'cf_config'                  // Cloudflare 连接配置
    };

    DEFAULT_THEME_ID = 'default';

    constructor() {
        this.appData = null;
        this.currentConfigData = null;
        this.providerClients = {
            supabase: null,
            cloudflare: null
        };
        Object.defineProperties(this, {
            supabaseClient: {
                configurable: true,
                enumerable: false,
                get: () => this.providerClients.supabase,
                set: (client) => {
                    this.providerClients.supabase = client;
                }
            },
            cloudflareClient: {
                configurable: true,
                enumerable: false,
                get: () => this.providerClients.cloudflare,
                set: (client) => {
                    this.providerClients.cloudflare = client;
                }
            }
        });
        this.providerConfigs = {
            supabase: undefined,
            cloudflare: undefined
        };
        this.providerFactory = typeof SyncProviderFactory !== 'undefined'
            ? new SyncProviderFactory(this)
            : null;
        this.backgroundSyncPromises = new Map();
    }

    createThemeRecord(options = {}) {
        const now = new Date().toISOString();
        const createdAt = options.createdAt || now;
        const resolvedType = options.type || 'chrome';
        const resolvedSyncStatus = options.syncStatus ?? (resolvedType === 'chrome' ? 'local' : 'ok');

        return {
            themeId: options.themeId,
            themeName: options.themeName || options.themeId || '未命名主题',
            themeType: options.themeType || 'default',
            bgImageUrl: options.bgImageUrl ?? null,
            bgImagePath: options.bgImagePath ?? null,
            bgOpacity: options.bgOpacity ?? 30,
            isActive: !!options.isActive,
            type: resolvedType,
            syncStatus: resolvedSyncStatus,
            createdAt,
            updatedAt: options.updatedAt || createdAt
        };
    }

    createDefaultThemeRecord(overrides = {}) {
        return this.createThemeRecord({
            themeId: this.DEFAULT_THEME_ID,
            themeName: '默认主题',
            isActive: true,
            type: 'chrome',
            ...overrides
        });
    }

    normalizeThemeRecord(theme, overrides = {}) {
        return this.createThemeRecord({
            ...theme,
            ...overrides,
            themeId: overrides.themeId ?? theme?.themeId,
            themeName: overrides.themeName ?? theme?.themeName ?? theme?.displayName
        });
    }

    getThemeProvider(theme) {
        if (this.getThemeSyncStatus(theme) === 'missing_remote') {
            return this.getDirectThemeProvider({
                ...theme,
                type: 'chrome',
                syncStatus: 'local'
            });
        }

        return this.getDirectThemeProvider(theme);
    }

    /**
     * 获取默认全局应用数据
     */
    getDefaultAppData() {
        return {
            version: '2.0.0', // 升级版本号表示数据结构变更
            currentThemeId: this.DEFAULT_THEME_ID,
            themes: {
                [this.DEFAULT_THEME_ID]: this.createDefaultThemeRecord()
            }
        };
    }

    getDefaultSettings() {
        return {
            viewMode: 'grid',
            shortcutOpenMode: 'new-tab'
        };
    }

    createShortcutRecord(options = {}) {
        return {
            ...options,
            id: options.id || `shortcut-${Date.now()}`,
            name: options.name || '',
            url: options.url || '',
            iconType: options.iconType || 'letter',
            iconColor: options.iconColor || '#4285f4',
            iconUrl: options.iconUrl || '',
            order: options.order ?? 0
        };
    }

    createCategoryRecord(options = {}) {
        const shortcuts = Array.isArray(options.shortcuts)
            ? options.shortcuts.map((shortcut, index) => this.createShortcutRecord({
                ...shortcut,
                order: shortcut?.order ?? index
            }))
            : [];

        return {
            ...options,
            id: options.id || `cat-${Date.now()}`,
            name: options.name || '默认分类',
            color: options.color || '#4285f4',
            collapsed: options.collapsed ?? false,
            order: options.order ?? 0,
            shortcuts
        };
    }

    normalizeSettings(settings = null) {
        const normalizedSettings = {
            ...this.getDefaultSettings(),
            ...(settings || {})
        };

        if (!['grid', 'list'].includes(normalizedSettings.viewMode)) {
            normalizedSettings.viewMode = 'grid';
        }

        if (!['current-tab', 'new-tab'].includes(normalizedSettings.shortcutOpenMode)) {
            normalizedSettings.shortcutOpenMode = 'new-tab';
        }

        return normalizedSettings;
    }

    createConfigDataRecord(options = {}) {
        const categories = Array.isArray(options.categories)
            ? options.categories.map((category, index) => this.createCategoryRecord({
                ...category,
                order: category?.order ?? index
            }))
            : [];

        return {
            ...options,
            categories,
            settings: this.normalizeSettings(options.settings)
        };
    }

    normalizeConfigData(data = null, options = {}) {
        const normalizedData = this.createConfigDataRecord(data || {});

        if (options.ensureDefaultCategory && normalizedData.categories.length === 0) {
            normalizedData.categories.push(this.createCategoryRecord({ order: 0 }));
        }

        return normalizedData;
    }

    createComparableValue(value) {
        if (Array.isArray(value)) {
            return value.map((item) => this.createComparableValue(item));
        }

        if (value && typeof value === 'object') {
            return Object.keys(value)
                .sort()
                .reduce((result, key) => {
                    const normalizedValue = this.createComparableValue(value[key]);

                    if (normalizedValue !== undefined) {
                        result[key] = normalizedValue;
                    }

                    return result;
                }, {});
        }

        return value;
    }

    getConfigDataSignature(data) {
        return JSON.stringify(this.createComparableValue(this.normalizeConfigData(data)));
    }

    hasConfigDataChanged(previousData, nextData) {
        return this.getConfigDataSignature(previousData) !== this.getConfigDataSignature(nextData);
    }

    /**
     * 获取指定主题的数据骨架
     */
    getDefaultConfigData() {
        return this.normalizeConfigData(null, { ensureDefaultCategory: true });
    }

    /**
     * 初始化数据管理器
     */
    async init() {
        try {
            console.log('UnifiedDataManager: 开始初始化...');

            // 1. 加载全局元数据 (appData)
            await this.loadAppData();

            // 1.5 尝试从旧版本结构迁移
            await this.migrateFromOldStructure();

            // 2. 初始化云端客户端
            await this.initCloudClients();

            // 3. 加载当前活跃主题的数据
            await this.loadCurrentConfigData();

            this.reconcileMissingCloudThemes().then((missingThemes) => {
                if (Array.isArray(missingThemes) && missingThemes.length > 0) {
                    console.warn('UnifiedDataManager: 检测到云端缺失的工作空间，等待用户决定是否恢复', missingThemes);
                }
            }).catch((error) => {
                console.warn('UnifiedDataManager: 启动时检查缺失云端工作空间失败', error);
            });

            console.log('UnifiedDataManager: 初始化完成', {
                currentThemeId: this.appData.currentThemeId,
                themesCount: Object.keys(this.appData.themes).length
            });

            return this.currentConfigData;
        } catch (error) {
            console.error('UnifiedDataManager: 初始化失败:', error);
            // 降级使用默认数据
            this.appData = this.getDefaultAppData();
            this.currentConfigData = this.getDefaultConfigData();
            return this.currentConfigData;
        }
    }

    /**
     * 将老版本的 app_data 结构迁移到新结构
     */
    async migrateFromOldStructure() {
        let changed = false;

        // 处理 currentUser -> currentThemeId
        if (this.appData.currentUser && this.appData.currentUser.configId) {
            this.appData.currentThemeId = this.appData.currentUser.configId;
            delete this.appData.currentUser;
            changed = true;
        }

        // 处理 userConfigs -> themes
        if (this.appData.userConfigs) {
            if (!this.appData.themes) this.appData.themes = {};
            
            for (const [key, oldConfig] of Object.entries(this.appData.userConfigs)) {
                this.appData.themes[key] = this.createThemeRecord({
                    themeId: key,
                    themeName: oldConfig.displayName || key,
                    isActive: key === this.appData.currentThemeId,
                    type: oldConfig.type || 'chrome'
                });
            }
            delete this.appData.userConfigs;
            changed = true;
        }

        if (changed) {
            this.appData.version = '2.0.0';
            await this.saveAppData();
            console.log('UnifiedDataManager: 成功从旧数据结构迁移');
        }
    }

    /**
     * 加载全局元数据
     */
    async loadAppData() {
        try {
            const result = await this.getFromChromeStorageSync([this.STORAGE_KEYS.APP_DATA]);
            
            if (result && result[this.STORAGE_KEYS.APP_DATA]) {
                this.appData = result[this.STORAGE_KEYS.APP_DATA];

                if (!this.appData.themes) {
                    this.appData.themes = {};
                }

                if (!this.appData.themes[this.DEFAULT_THEME_ID]) {
                    this.appData.themes[this.DEFAULT_THEME_ID] = this.createDefaultThemeRecord();
                }

                if (!this.appData.currentThemeId || !this.appData.themes[this.appData.currentThemeId]) {
                    this.appData.currentThemeId = this.DEFAULT_THEME_ID;
                }

                const currentThemeId = this.appData.currentThemeId;
                this.appData.themes = Object.fromEntries(
                    Object.entries(this.appData.themes).map(([themeId, theme]) => [
                        themeId,
                        this.normalizeThemeRecord(theme, {
                            themeId,
                            isActive: themeId === currentThemeId
                        })
                    ])
                );
            } else {
                this.appData = this.getDefaultAppData();
                await this.saveAppData();
            }
        } catch (error) {
            console.error('UnifiedDataManager: 加载 APP_DATA 失败:', error);
            this.appData = this.getDefaultAppData();
        }
    }

    /**
     * 保存全局元数据
     */
    async saveAppData() {
        try {
            await this.setToChromeStorageSync({
                [this.STORAGE_KEYS.APP_DATA]: this.appData
            });
        } catch (error) {
            console.error('UnifiedDataManager: 保存 APP_DATA 失败:', error);
        }
    }

    /**
     * 初始化云端客户端
     */
    async initCloudClients() {
        const providerTypes = ['supabase', 'cloudflare'];

        await this.preloadProviderConfigs(providerTypes);

        for (const provider of providerTypes) {
            if (!this.hasThemeType(provider)) {
                this.disconnectProviderClient(provider);
                continue;
            }

            try {
                await this.ensureProviderClient(provider);
                console.log(`UnifiedDataManager: ${provider} 客户端初始化成功`);
            } catch (error) {
                console.error(`UnifiedDataManager: ${provider} 客户端初始化失败:`, error);
            }
        }
    }

    hasThemeType(type) {
        return Object.values(this.appData?.themes || {}).some(theme => theme.type === type);
    }

    syncProviderClientsState() {
        if (!this.hasThemeType('supabase')) {
            this.disconnectProviderClient('supabase');
        }

        if (!this.hasThemeType('cloudflare')) {
            this.disconnectProviderClient('cloudflare');
        }
    }

    getProviderConfigKey(provider) {
        if (provider === 'supabase') {
            return this.STORAGE_KEYS.SUPABASE_CONFIG;
        }

        if (provider === 'cloudflare') {
            return this.STORAGE_KEYS.CF_CONFIG;
        }

        throw new Error(`不支持的云端提供商：${provider}`);
    }

    normalizeProviderConfig(provider, config) {
        if (!config) {
            return null;
        }

        const normalizedConfig = { ...config };
        delete normalizedConfig.enabled;
        return normalizedConfig;
    }

    hasValidProviderConfig(provider, config) {
        const normalizedConfig = this.normalizeProviderConfig(provider, config);
        if (!normalizedConfig) {
            return false;
        }

        if (provider === 'supabase') {
            return !!(normalizedConfig.url && normalizedConfig.anonKey);
        }

        if (provider === 'cloudflare') {
            return !!normalizedConfig.workerUrl;
        }

        return false;
    }

    async preloadProviderConfigs(providerTypes = ['supabase', 'cloudflare']) {
        await Promise.all(providerTypes.map(async (provider) => {
            try {
                await this.getProviderConfig(provider);
            } catch (error) {
                console.warn(`UnifiedDataManager: 预加载 ${provider} 配置失败`, error);
            }
        }));
    }

    getCachedProviderConfig(provider) {
        return this.normalizeProviderConfig(provider, this.providerConfigs[provider]);
    }

    async getProviderConfig(provider) {
        const cachedConfig = this.getCachedProviderConfig(provider);
        if (cachedConfig) {
            return cachedConfig;
        }

        const key = this.getProviderConfigKey(provider);
        const result = await this.getFromChromeStorageSync([key]);
        const normalizedConfig = this.normalizeProviderConfig(provider, result[key]);
        this.providerConfigs[provider] = normalizedConfig;
        return normalizedConfig;
    }

    async saveProviderConfig(provider, config) {
        const key = this.getProviderConfigKey(provider);
        const normalizedConfig = this.normalizeProviderConfig(provider, config);

        if (!this.hasValidProviderConfig(provider, normalizedConfig)) {
            throw new Error(`${provider} 配置缺失或无效`);
        }

        await this.setToChromeStorageSync({ [key]: normalizedConfig });
        this.providerConfigs[provider] = normalizedConfig;
        return normalizedConfig;
    }

    async clearProviderConfig(provider) {
        const key = this.getProviderConfigKey(provider);
        await this.removeFromChromeStorageSync([key]);
        this.providerConfigs[provider] = null;
    }

    getProviderCapabilities(provider) {
        if (provider === 'chrome' || !this.providerFactory) {
            return {
                cloudSync: false,
                fileStorage: false,
                schemaMode: 'none'
            };
        }

        return this.providerFactory.getProvider(provider).getCapabilities();
    }

    getSyncStatusSnapshot() {
        const currentTheme = this.getCurrentTheme() || {
            themeId: this.DEFAULT_THEME_ID,
            themeName: '默认主题',
            type: 'chrome'
        };
        const canUseRemote = this.canUseRemoteProvider(currentTheme);
        const activeProvider = canUseRemote
            ? (currentTheme.type === 'cloudflare'
                ? 'cloudflare'
                : (currentTheme.type === 'supabase' ? 'supabase' : 'none'))
            : 'none';

        return {
            isSupabaseEnabled: canUseRemote && currentTheme.type === 'supabase',
            isCloudflareEnabled: canUseRemote && currentTheme.type === 'cloudflare',
            isCloudEnabled: canUseRemote,
            activeProvider,
            currentThemeId: currentTheme.themeId,
            currentThemeName: currentTheme.themeName || '',
            currentThemeType: currentTheme.type,
            supabaseConfig: this.getCachedProviderConfig('supabase'),
            cloudflareConfig: this.getCachedProviderConfig('cloudflare'),
            providerCapabilities: activeProvider === 'none'
                ? this.getProviderCapabilities('chrome')
                : this.getProviderCapabilities(activeProvider)
        };
    }

    supportsProviderClient(provider) {
        return Object.prototype.hasOwnProperty.call(this.providerClients, provider);
    }

    getProviderClientClass(provider) {
        const clientClasses = {
            supabase: typeof SupabaseClient !== 'undefined' ? SupabaseClient : null,
            cloudflare: typeof CloudflareClient !== 'undefined' ? CloudflareClient : null
        };

        return clientClasses[provider] || null;
    }

    getProviderClient(provider) {
        return this.supportsProviderClient(provider)
            ? this.providerClients[provider]
            : null;
    }

    setProviderClient(provider, client) {
        if (!this.supportsProviderClient(provider)) {
            throw new Error(`不支持的云端提供商：${provider}`);
        }

        this.providerClients[provider] = client;
    }

    ensureProviderClientInstance(provider) {
        if (!this.supportsProviderClient(provider)) {
            throw new Error(`不支持的云端提供商：${provider}`);
        }

        const ClientClass = this.getProviderClientClass(provider);
        const clientNameMap = {
            supabase: 'SupabaseClient',
            cloudflare: 'CloudflareClient'
        };

        if (!ClientClass) {
            throw new Error(`${clientNameMap[provider] || provider} 未加载`);
        }

        let client = this.getProviderClient(provider);
        if (!client) {
            client = provider === 'supabase' && typeof ClientClass.getSharedInstance === 'function'
                ? ClientClass.getSharedInstance()
                : new ClientClass();
            this.setProviderClient(provider, client);
        }

        return client;
    }

    disconnectProviderClient(provider) {
        const client = this.getProviderClient(provider);
        if (!client) {
            return;
        }

        client.disconnect();
        this.setProviderClient(provider, null);
    }

    async ensureProviderClient(provider, config = null, options = {}) {
        if (provider === 'chrome') {
            return null;
        }

        const shouldTest = !!options.shouldTest;
        const cacheConfig = options.cacheConfig !== false;
        const normalizedConfig = this.normalizeProviderConfig(provider, config || await this.getProviderConfig(provider));
        if (!this.hasValidProviderConfig(provider, normalizedConfig)) {
            throw new Error(`${provider} 配置缺失或无效`);
        }

        if (cacheConfig) {
            this.providerConfigs[provider] = normalizedConfig;
        }

        const client = this.ensureProviderClientInstance(provider);
        await client.initialize(normalizedConfig, shouldTest);
        return client;
    }

    async testProviderConnection(provider, config = null) {
        if (!this.providerFactory) {
            throw new Error('SyncProviderFactory 未加载');
        }

        return this.providerFactory.getProvider(provider).testConnection(config);
    }

    async initializeProviderSchema(provider, config = null) {
        if (!this.providerFactory) {
            throw new Error('SyncProviderFactory 未加载');
        }

        return this.providerFactory.getProvider(provider).initializeSchema(config);
    }

    getProviderConfigInput(provider, cfConfig = null, supabaseConfig = null) {
        if (provider === 'cloudflare') {
            return cfConfig;
        }

        if (provider === 'supabase') {
            return supabaseConfig;
        }

        throw new Error(`不支持的云端提供商：${provider}`);
    }

    async connectProvider(provider, cfConfig = null, supabaseConfig = null) {
        const providerConfig = this.getProviderConfigInput(provider, cfConfig, supabaseConfig);
        const previousConfig = await this.getProviderConfig(provider).catch(() => null);
        const savedConfig = await this.saveProviderConfig(provider, providerConfig);

        try {
            await this.ensureProviderClient(provider, savedConfig);
            return savedConfig;
        } catch (error) {
            try {
                if (previousConfig) {
                    await this.saveProviderConfig(provider, previousConfig);
                } else {
                    await this.clearProviderConfig(provider);
                }
            } catch (rollbackError) {
                console.error(`UnifiedDataManager: failed to rollback ${provider} config`, rollbackError);
            }

            this.disconnectProviderClient(provider);
            throw error;
        }
    }

    async resolveThemeData(theme, { preferCache = true, useDefaultFallback = true } = {}) {
        let data = null;

        if (preferCache) {
            data = await this.loadFromCache(theme.themeId);
        }

        if (!data) {
            const provider = this.getThemeProvider(theme);
            data = await provider.load();
        }

        if (!data && useDefaultFallback) {
            data = this.getDefaultConfigData();
        }

        return data ? this.normalizeConfigData(data) : null;
    }

    isCloudTheme(theme) {
        return !!theme && theme.type !== 'chrome';
    }

    getThemeSyncStatus(theme) {
        if (!theme) {
            return 'local';
        }

        if (theme.syncStatus) {
            return theme.syncStatus;
        }

        return theme.type === 'chrome' ? 'local' : 'ok';
    }

    canUseRemoteProvider(theme) {
        return this.isCloudTheme(theme) && this.getThemeSyncStatus(theme) !== 'missing_remote';
    }

    async getLocalRecoveryThemeData(theme, fallbackData = null) {
        if (!theme?.themeId) {
            return null;
        }

        if (theme.themeId === this.appData?.currentThemeId && this.currentConfigData) {
            return this.normalizeConfigData(this.currentConfigData);
        }

        if (fallbackData) {
            return this.normalizeConfigData(fallbackData);
        }

        const cachedData = await this.loadFromCache(theme.themeId).catch(() => null);
        return cachedData ? this.normalizeConfigData(cachedData) : null;
    }

    async restoreMissingCloudTheme(theme, fallbackData = null) {
        if (!this.isCloudTheme(theme)) {
            return null;
        }

        const recoveryData = await this.getLocalRecoveryThemeData(theme, fallbackData);
        if (!recoveryData) {
            return null;
        }

        await this.syncThemeDataWithProvider(theme, recoveryData, { forceRemote: true });
        console.log(`UnifiedDataManager: 已自动恢复缺失的云端工作空间 ${theme.themeId}`);
        return recoveryData;
    }

    async reconcileMissingCloudThemes(provider = null) {
        const providerTypes = provider
            ? [provider]
            : ['supabase', 'cloudflare'];
        const missingThemes = [];
        let themeStatusChanged = false;

        for (const targetProvider of providerTypes) {
            const localThemes = this.getAllThemes().filter((theme) => theme.type === targetProvider);
            if (!localThemes.length) {
                continue;
            }

            let client = null;
            try {
                client = await this.ensureProviderClient(targetProvider);
            } catch (error) {
                console.warn(`UnifiedDataManager: 无法初始化 ${targetProvider} 客户端，跳过缺失巡检`, error);
                continue;
            }

            if (!client || typeof client.listThemes !== 'function') {
                continue;
            }

            let remoteThemes = [];
            try {
                remoteThemes = await client.listThemes();
            } catch (error) {
                console.warn(`UnifiedDataManager: 读取 ${targetProvider} 远端工作空间列表失败`, error);
                continue;
            }

            const remoteThemeIds = new Set(
                (Array.isArray(remoteThemes) ? remoteThemes : [])
                    .map((theme) => String(theme.themeId || theme.theme_id || '').trim())
                    .filter(Boolean)
            );

            for (const theme of localThemes) {
                if (!theme?.themeId) {
                    continue;
                }

                const nextSyncStatus = remoteThemeIds.has(theme.themeId) ? 'ok' : 'missing_remote';
                if (theme.syncStatus !== nextSyncStatus) {
                    theme.syncStatus = nextSyncStatus;
                    themeStatusChanged = true;
                }

                if (nextSyncStatus !== 'missing_remote') {
                    continue;
                }

                missingThemes.push({
                    themeId: theme.themeId,
                    provider: targetProvider,
                    themeName: theme.themeName || '',
                    localTheme: this.normalizeThemeRecord(theme)
                });
            }
        }

        if (themeStatusChanged) {
            await this.saveAppData();
            this.syncProviderClientsState();
        }

        return missingThemes;
    }

    async syncThemeDataWithProvider(theme, data, options = {}) {
        const normalizedData = this.normalizeConfigData(data);
        const provider = options.forceRemote
            ? this.getDirectThemeProvider(theme)
            : this.getThemeProvider(theme);
        await provider.save(normalizedData);
        await this.saveToCache(theme.themeId, normalizedData);
        return normalizedData;
    }

    async updateThemeSettings(themeId, newSettings = {}) {
        const theme = this.appData?.themes?.[themeId];
        if (!theme) {
            throw new Error(`主题 ${themeId} 不存在`);
        }

        const baseData = themeId === this.appData.currentThemeId
            ? (this.currentConfigData || await this.loadCurrentConfigData())
            : await this.resolveThemeData(theme, {
                preferCache: true,
                useDefaultFallback: true
            });

        const updatedData = this.normalizeConfigData({
            ...(baseData || {}),
            settings: {
                ...(baseData?.settings || {}),
                ...(newSettings || {})
            }
        });

        if (themeId === this.appData.currentThemeId) {
            await this.saveCurrentConfigData(updatedData);
            return this.currentConfigData;
        }

        return this.syncThemeDataWithProvider(theme, updatedData);
    }

    async initializeCloudThemeData(theme) {
        let data = await this.resolveThemeData(theme, {
            preferCache: false,
            useDefaultFallback: false
        });

        if (!data) {
            data = this.getDefaultConfigData();
            await this.syncThemeDataWithProvider(theme, data);
            return data;
        }

        await this.saveToCache(theme.themeId, data);
        return data;
    }

    getDirectThemeProvider(theme) {
        if (!theme) {
            throw new Error('主题不存在');
        }

        if (this.providerFactory) {
            return this.providerFactory.getBoundProvider(theme);
        }

        if (theme.type === 'chrome') {
            return {
                load: () => this.loadFromChromeSync(theme.themeId),
                save: (data) => this.saveToChromeSync(theme.themeId, data),
                delete: () => this.clearChromeSync(theme.themeId)
            };
        }

        if (theme.type === 'supabase') {
            return {
                load: () => this.loadFromSupabase(theme),
                save: (data) => this.saveToSupabase(theme, data),
                delete: async () => {
                    const client = await this.ensureProviderClient('supabase');
                    await client.deleteThemeData(theme.themeId);
                }
            };
        }

        if (theme.type === 'cloudflare') {
            return {
                load: () => this.loadFromCloudflare(theme),
                save: (data) => this.saveToCloudflare(theme, data),
                delete: async () => {
                    const client = await this.ensureProviderClient('cloudflare');
                    await client.deleteData(theme.themeId);
                }
            };
        }

        throw new Error(`不支持的主题类型：${theme.type}`);
    }

    /**
     * 加载当前主题的数据
     * 策略：先本地缓存 -> 如果缓存没命中且是云端 -> 则等待云端请求返回
     * @param {boolean} forceRefresh - 是否强制从云端获取最新数据
     */
    async loadCurrentConfigData(forceRefresh = false) {
        try {
            const currentThemeId = this.appData.currentThemeId;
            const currentTheme = this.getCurrentTheme();

            if (!currentTheme) {
                throw new Error('当前主题不存在');
            }

            console.log(`UnifiedDataManager: 加载主题数据 ${currentThemeId} (${currentTheme.type})`);

            // 如果不是强制刷新，尝试从缓存读取
            if (!forceRefresh) {
                const cachedData = await this.loadFromCache(currentThemeId);
                if (cachedData) {
                    this.currentConfigData = this.normalizeConfigData(cachedData);
                    console.log('UnifiedDataManager: 从缓存加载数据成功');
                    
                    // 异步触发后台更新
                    if (this.canUseRemoteProvider(currentTheme)) {
                        this.backgroundSyncFromCloud(currentTheme).catch(e => console.error('后台同步失败', e));
                    }
                    return this.currentConfigData;
                }
            }

            // 缓存未命中或强制刷新，从数据源读取
            const provider = this.getThemeProvider(currentTheme);
            const data = await provider.load();

            if (data) {
                this.currentConfigData = this.normalizeConfigData(data);
                // 更新缓存
                await this.saveToCache(currentThemeId, this.currentConfigData);
            } else {
                this.currentConfigData = this.getDefaultConfigData();
                if (!this.canUseRemoteProvider(currentTheme)) {
                    await this.saveCurrentConfigData(this.currentConfigData);
                }
            }

            return this.currentConfigData;
        } catch (error) {
            console.error('UnifiedDataManager: 加载当前主题数据失败:', error);
            if (!this.currentConfigData) {
                this.currentConfigData = this.getDefaultConfigData();
            }
            return this.currentConfigData;
        }
    }

    /**
     * 后台同步云端数据，用于保持本地缓存更新
     */
    async backgroundSyncFromCloud(theme) {
        if (!this.canUseRemoteProvider(theme)) {
            return false;
        }

        const existingSync = this.backgroundSyncPromises.get(theme.themeId);
        if (existingSync) {
            return existingSync;
        }

        const syncPromise = (async () => {
            try {
                const provider = this.getThemeProvider(theme);
                const cachedData = await this.loadFromCache(theme.themeId);
                const baselineData = cachedData
                    || (theme.themeId === this.appData?.currentThemeId ? this.currentConfigData : null);
                const cloudData = await provider.load();

                if (!cloudData) {
                    return false;
                }

                const normalizedCloudData = this.normalizeConfigData(cloudData);

                if (baselineData && !this.hasConfigDataChanged(baselineData, normalizedCloudData)) {
                    console.log(`UnifiedDataManager: 后台同步未检测到数据变化 ${theme.themeId}`);
                    return false;
                }

                await this.saveToCache(theme.themeId, normalizedCloudData);

                if (theme.themeId === this.appData?.currentThemeId) {
                    this.currentConfigData = normalizedCloudData;
                }

                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    try {
                        chrome.runtime.sendMessage({
                            action: 'dataUpdated',
                            source: 'backgroundSync',
                            themeId: theme.themeId
                        });
                    } catch (error) {
                        // Ignore runtime messaging failures outside extension contexts.
                    }
                }

                return true;
            } catch (error) {
                console.error('UnifiedDataManager: 后台同步失败', error);
                return false;
            } finally {
                this.backgroundSyncPromises.delete(theme.themeId);
            }
        })();

        this.backgroundSyncPromises.set(theme.themeId, syncPromise);
        return syncPromise;
    }

    async saveCurrentConfigData(data) {
        try {
            const currentThemeId = this.appData.currentThemeId;
            const currentTheme = this.getCurrentTheme();

            if (!currentTheme) throw new Error('当前主题不存在');

            // 如果更新了主题元数据，先合并到 currentTheme
            if (data._themeMeta) {
                Object.assign(currentTheme, data._themeMeta);
                currentTheme.updatedAt = new Date().toISOString();
                await this.saveAppData();
                delete data._themeMeta; // 不要把元数据存进 data blob里
            }

            const dataToSave = this.normalizeConfigData(data || this.currentConfigData);
            const provider = this.getThemeProvider(currentTheme);

            // 1. 写主存储
            await provider.save(dataToSave);

            // 2. 清缓存并重新写入（旁路缓存模式）
            await this.clearCache(currentThemeId);
            await this.saveToCache(currentThemeId, dataToSave);
            
            // 3. 更新内存
            this.currentConfigData = dataToSave;
            
            return true;
        } catch (error) {
            console.error('UnifiedDataManager: 保存数据失败:', error);
            throw error;
        }
    }

    /**
     * 保存主题的视觉设置（仅更新元数据，不触碰内部大 JSON）
     */
    async saveThemeSettings(themeSettings) {
        const theme = this.getCurrentTheme();
        if (!theme) return false;

        await this.updateThemeMetadata(theme.themeId, {
            themeType: themeSettings.themeType !== undefined ? themeSettings.themeType : theme.themeType,
            bgImageUrl: themeSettings.bgImageUrl !== undefined ? themeSettings.bgImageUrl : theme.bgImageUrl,
            bgImagePath: themeSettings.bgImagePath !== undefined ? themeSettings.bgImagePath : theme.bgImagePath,
            bgOpacity: themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : theme.bgOpacity
        });

        return true;
    }


    /* --- 底层存储操作 --- */

    async loadFromCache(themeId) {
        const key = this.STORAGE_KEYS.CONFIG_DATA(themeId);
        const result = await this.getFromChromeStorageLocal([key]);
        return result[key] || null;
    }

    async saveToCache(themeId, data) {
        const key = this.STORAGE_KEYS.CONFIG_DATA(themeId);
        await this.setToChromeStorageLocal({ [key]: data });
    }

    async clearCache(themeId) {
        const key = this.STORAGE_KEYS.CONFIG_DATA(themeId);
        return new Promise(resolve => chrome.storage.local.remove(key, resolve));
    }

    async clearAllCacheExceptCurrent() {
        const currentKey = this.STORAGE_KEYS.CONFIG_DATA(this.appData.currentThemeId);
        return new Promise(resolve => {
            chrome.storage.local.get(null, (items) => {
                const keysToRemove = Object.keys(items).filter(k => 
                    k.startsWith('cardTabData_') && k !== currentKey
                );
                if (keysToRemove.length > 0) {
                    chrome.storage.local.remove(keysToRemove, resolve);
                } else {
                    resolve();
                }
            });
        });
    }

    async loadFromChromeSync(themeId) {
        const key = this.STORAGE_KEYS.CHROME_SYNC_DATA(themeId);
        const result = await this.getFromChromeStorageSync([key]);
        return result[key] || null;
    }

    async saveToChromeSync(themeId, data) {
        const key = this.STORAGE_KEYS.CHROME_SYNC_DATA(themeId);
        await this.setToChromeStorageSync({ [key]: data });
    }

    async clearChromeSync(themeId) {
        const key = this.STORAGE_KEYS.CHROME_SYNC_DATA(themeId);
        await this.removeFromChromeStorageSync([key]);
    }

    async loadFromSupabase(theme) {
        const client = await this.ensureProviderClient('supabase');
        const result = await client.loadData(theme.themeId);
        if (result && result.data) {
            // 同步远端的元数据到本地 appData
            this.updateThemeMetadataFromCloudResponse(theme.themeId, result);
            return result.data;
        }
        return null;
    }

    async saveToSupabase(theme, data) {
        const client = await this.ensureProviderClient('supabase');
        await client.saveData(theme.themeId, data, theme);
    }

    async loadFromCloudflare(theme) {
        const client = await this.ensureProviderClient('cloudflare');
        const result = await client.loadData(theme.themeId);
        if (result && result.data) {
            this.updateThemeMetadataFromCloudResponse(theme.themeId, result);
            return result.data;
        }
        return null;
    }

    async saveToCloudflare(theme, data) {
        const client = await this.ensureProviderClient('cloudflare');
        await client.saveData(theme.themeId, data, theme);
    }

    /**
     * 将云端返回的 theme 元数据更新到本地 appData
     */
    updateThemeMetadataFromCloudResponse(themeId, cloudRes) {
        if (!this.appData.themes[themeId]) return;
        const theme = this.appData.themes[themeId];
        
        let changed = false;
        if (cloudRes.theme_name && cloudRes.theme_name !== theme.themeName) { theme.themeName = cloudRes.theme_name; changed = true; }
        if (cloudRes.theme_type && cloudRes.theme_type !== theme.themeType) { theme.themeType = cloudRes.theme_type; changed = true; }
        if (cloudRes.bg_image_url !== undefined && cloudRes.bg_image_url !== theme.bgImageUrl) { theme.bgImageUrl = cloudRes.bg_image_url; changed = true; }
        if (cloudRes.bg_image_path !== undefined && cloudRes.bg_image_path !== theme.bgImagePath) { theme.bgImagePath = cloudRes.bg_image_path; changed = true; }
        if (cloudRes.bg_opacity !== undefined && cloudRes.bg_opacity !== theme.bgOpacity) { theme.bgOpacity = cloudRes.bg_opacity; changed = true; }
        if (theme.syncStatus !== 'ok' && theme.type !== 'chrome') { theme.syncStatus = 'ok'; changed = true; }

        if (changed) {
            this.saveAppData().catch(e => console.error(e));
        }
    }


    /* --- 主题与配置管理 --- */

    getCurrentTheme() {
        return this.appData?.themes?.[this.appData.currentThemeId] || null;
    }

    getAllThemes() {
        if (!this.appData || !this.appData.themes) return [];
        return Object.values(this.appData.themes);
    }

    normalizeRemoteThemeSummary(provider, theme = {}) {
        const themeId = String(theme.themeId || theme.theme_id || '').trim();
        const now = new Date().toISOString();

        return this.createThemeRecord({
            themeId,
            themeName: theme.themeName || theme.theme_name || theme.displayName || themeId || '未命名主题',
            themeType: theme.themeType || theme.theme_type || 'default',
            bgImageUrl: theme.bgImageUrl ?? theme.bg_image_url ?? null,
            bgImagePath: theme.bgImagePath ?? theme.bg_image_path ?? null,
            bgOpacity: theme.bgOpacity ?? theme.bg_opacity ?? 30,
            type: provider,
            isActive: false,
            createdAt: theme.createdAt || theme.created_at || theme.updatedAt || theme.updated_at || now,
            updatedAt: theme.updatedAt || theme.updated_at || theme.createdAt || theme.created_at || now
        });
    }

    getRemoteThemeImportState(themeId, provider) {
        const localTheme = this.appData?.themes?.[themeId] || null;

        if (!localTheme) {
            return {
                state: 'available',
                localTheme: null
            };
        }

        return {
            state: localTheme.type === provider ? 'imported' : 'conflict',
            localTheme: this.normalizeThemeRecord(localTheme)
        };
    }

    async discoverRemoteThemes(provider) {
        const client = await this.ensureProviderClient(provider);
        if (!client || typeof client.listThemes !== 'function') {
            throw new Error(`${provider} 当前不支持列出远端工作空间`);
        }

        const remoteThemes = await client.listThemes();

        return (Array.isArray(remoteThemes) ? remoteThemes : [])
            .map((theme) => this.normalizeRemoteThemeSummary(provider, theme))
            .filter((theme) => !!theme.themeId)
            .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
            .map((theme) => {
                const importState = this.getRemoteThemeImportState(theme.themeId, provider);
                return {
                    ...theme,
                    provider,
                    importState: importState.state,
                    isImported: importState.state === 'imported',
                    localTheme: importState.localTheme
                };
            });
    }

    async importRemoteTheme(provider, remoteTheme) {
        const normalizedRemoteTheme = this.normalizeRemoteThemeSummary(provider, remoteTheme);
        if (!normalizedRemoteTheme.themeId) {
            throw new Error('远端工作空间缺少 themeId，无法导入');
        }

        await this.ensureProviderClient(provider);

        const existingTheme = this.appData?.themes?.[normalizedRemoteTheme.themeId] || null;
        const previousTheme = existingTheme ? this.normalizeThemeRecord(existingTheme) : null;
        const nextTheme = this.createThemeRecord({
            ...existingTheme,
            ...normalizedRemoteTheme,
            type: provider,
            syncStatus: 'ok',
            isActive: normalizedRemoteTheme.themeId === this.appData.currentThemeId,
            createdAt: existingTheme?.createdAt || normalizedRemoteTheme.createdAt
        });

        this.appData.themes[normalizedRemoteTheme.themeId] = nextTheme;
        await this.saveAppData();

        let remoteData = null;
        try {
            remoteData = await this.resolveThemeData(nextTheme, {
                preferCache: false,
                useDefaultFallback: false
            });
        } catch (error) {
            console.warn(`UnifiedDataManager: 预取远端工作空间 ${normalizedRemoteTheme.themeId} 失败`, error);
        }

        if (!remoteData) {
            if (previousTheme) {
                this.appData.themes[normalizedRemoteTheme.themeId] = previousTheme;
            } else {
                delete this.appData.themes[normalizedRemoteTheme.themeId];
            }

            await this.saveAppData();
            await this.clearCache(normalizedRemoteTheme.themeId).catch(() => {});
            throw new Error(`远端工作空间 ${normalizedRemoteTheme.themeId} 不存在或暂时无法读取`);
        }

        await this.clearCache(normalizedRemoteTheme.themeId).catch(() => {});
        await this.saveToCache(normalizedRemoteTheme.themeId, remoteData);

        if (normalizedRemoteTheme.themeId === this.appData.currentThemeId) {
            this.currentConfigData = null;
            await this.loadCurrentConfigData(true).catch(() => {
                this.currentConfigData = this.normalizeConfigData(remoteData);
            });
        }

        this.syncProviderClientsState();
        return nextTheme;
    }

    async deleteRemoteTheme(provider, remoteTheme) {
        const normalizedRemoteTheme = this.normalizeRemoteThemeSummary(provider, remoteTheme);
        if (!normalizedRemoteTheme.themeId) {
            throw new Error('远端工作空间缺少 themeId，无法删除');
        }

        const importState = this.getRemoteThemeImportState(normalizedRemoteTheme.themeId, provider);
        if (importState.state !== 'available') {
            throw new Error('当前设备仍保留该工作空间，请先删除本机工作空间后再删除云端数据');
        }

        const client = await this.ensureProviderClient(provider);
        const bgImagePath = String(normalizedRemoteTheme.bgImagePath || '').trim();

        if (bgImagePath && typeof client.deleteFile === 'function') {
            try {
                if (provider === 'supabase') {
                    await client.deleteFile(client.getBucketName(), bgImagePath);
                } else if (provider === 'cloudflare') {
                    await client.deleteFile('backgrounds', bgImagePath, normalizedRemoteTheme.themeId);
                }
            } catch (error) {
                console.warn(`UnifiedDataManager: 删除远端背景图失败 ${normalizedRemoteTheme.themeId}`, error);
            }
        }

        if (provider === 'supabase') {
            if (typeof client.deleteThemeData !== 'function') {
                throw new Error('Supabase 当前不支持删除远端工作空间');
            }
            await client.deleteThemeData(normalizedRemoteTheme.themeId);
        } else if (provider === 'cloudflare') {
            if (typeof client.deleteData !== 'function') {
                throw new Error('Cloudflare 当前不支持删除远端工作空间');
            }
            await client.deleteData(normalizedRemoteTheme.themeId);
        } else {
            throw new Error(`${provider} 当前不支持删除远端工作空间`);
        }

        return {
            success: true,
            themeId: normalizedRemoteTheme.themeId,
            provider
        };
    }

    async restoreMissingRemoteTheme(themeId) {
        const theme = this.appData?.themes?.[themeId];
        if (!theme) {
            throw new Error(`主题 ${themeId} 不存在`);
        }

        if (!this.isCloudTheme(theme) || this.getThemeSyncStatus(theme) !== 'missing_remote') {
            throw new Error('当前工作空间不处于云端缺失状态');
        }

        const restoredData = await this.restoreMissingCloudTheme(theme);
        if (!restoredData) {
            throw new Error('当前设备缺少可恢复的数据');
        }

        theme.syncStatus = 'ok';
        await this.saveAppData();
        this.syncProviderClientsState();

        if (themeId === this.appData.currentThemeId) {
            this.currentConfigData = this.normalizeConfigData(restoredData);
            await this.saveToCache(themeId, this.currentConfigData);
        }

        return this.normalizeThemeRecord(theme);
    }

    async convertThemeToLocal(themeId) {
        const theme = this.appData?.themes?.[themeId];
        if (!theme) {
            throw new Error(`主题 ${themeId} 不存在`);
        }

        const fallbackData = await this.getLocalRecoveryThemeData(
            theme,
            themeId === this.appData.currentThemeId ? this.currentConfigData : null
        );
        const nextData = this.normalizeConfigData(fallbackData || this.getDefaultConfigData());

        theme.type = 'chrome';
        theme.syncStatus = 'detached';
        theme.bgImageUrl = null;
        theme.bgImagePath = null;
        theme.bgOpacity = 30;
        theme.updatedAt = new Date().toISOString();

        await this.saveAppData();
        await this.saveToChromeSync(themeId, nextData);
        await this.saveToCache(themeId, nextData);
        this.syncProviderClientsState();

        if (themeId === this.appData.currentThemeId) {
            this.currentConfigData = nextData;
        }

        return this.normalizeThemeRecord(theme);
    }

    generateThemeId(prefix = 'theme') {
        return `${prefix}-${Date.now()}`;
    }

    async createLocalTheme(themeName, themeType = 'default', bgOpacity = 30) {
        const themeId = this.generateThemeId('theme');
        const theme = this.createThemeRecord({
            themeId,
            themeName,
            themeType,
            bgOpacity,
            isActive: false,
            type: 'chrome'
        });

        this.appData.themes[themeId] = theme;
        await this.saveAppData();

        const defaultData = this.getDefaultConfigData();
        await this.saveToChromeSync(themeId, defaultData);
        await this.saveToCache(themeId, defaultData);

        return theme;
    }

    async updateThemeMetadata(themeId, updates = {}) {
        const theme = this.appData?.themes?.[themeId];
        if (!theme) {
            throw new Error(`主题 ${themeId} 不存在`);
        }

        const allowedKeys = [
            'themeName',
            'themeType',
            'bgImageUrl',
            'bgImagePath',
            'bgOpacity'
        ];

        allowedKeys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(updates, key)) {
                theme[key] = updates[key];
            }
        });

        theme.updatedAt = new Date().toISOString();
        await this.saveAppData();

        if (this.canUseRemoteProvider(theme)) {
            if (themeId === this.appData.currentThemeId) {
                await this.saveCurrentConfigData({ ...this.currentConfigData });
            } else {
                const dataToPersist = await this.resolveThemeData(theme, {
                    preferCache: true,
                    useDefaultFallback: true
                });
                await this.syncThemeDataWithProvider(theme, dataToPersist);
            }
        }

        return theme;
    }

    async switchTheme(themeId) {
        let previousThemeId = null;
        let previousActiveStates = null;
        let themeStateChanged = false;

        try {
            console.log(`UnifiedDataManager: 切换到主题 ${themeId}`);

            if (!this.appData.themes[themeId]) {
                throw new Error(`主题 ${themeId} 不存在`);
            }
            if (this.getThemeSyncStatus(this.appData.themes[themeId]) === 'missing_remote') {
                throw new Error('该工作空间处于云端缺失待处理状态，请先恢复到云端、转成本地空间，或从本机移除');
            }

            // 清除其他缓存
            await this.clearAllCacheExceptCurrent();

            previousThemeId = this.appData.currentThemeId;
            previousActiveStates = Object.fromEntries(
                Object.values(this.appData.themes).map((theme) => [theme.themeId, !!theme.isActive])
            );

            // 更新活跃状态
            this.appData.currentThemeId = themeId;
            Object.values(this.appData.themes).forEach(t => {
                t.isActive = (t.themeId === themeId);
            });
            themeStateChanged = true;

            await this.saveAppData();

            // 加载新主题数据
            await this.loadCurrentConfigData(true);
            
            console.log(`UnifiedDataManager: 切换到主题 ${themeId} 成功`);
            return this.currentConfigData;
        } catch (error) {
            if (themeStateChanged && previousThemeId && previousActiveStates) {
                this.appData.currentThemeId = previousThemeId;
                Object.values(this.appData.themes).forEach((theme) => {
                    theme.isActive = !!previousActiveStates[theme.themeId];
                });

                try {
                    await this.saveAppData();
                } catch (rollbackError) {
                    console.error('UnifiedDataManager: 切换主题失败后回滚状态失败:', rollbackError);
                }
            }

            console.error(`UnifiedDataManager: 切换主题失败:`, error);
            throw error;
        }
    }

    async promoteCurrentThemeToCloud(provider = 'cloudflare', cfConfig = null, supabaseConfig = null, themeName = '') {
        let previousThemeState = null;
        let themeStateChanged = false;

        try {
            const currentTheme = this.getCurrentTheme();
            if (!currentTheme) {
                throw new Error('当前主题不存在');
            }

            const dataToMigrate = this.currentConfigData || await this.loadCurrentConfigData();
            const now = new Date().toISOString();
            const savedConfig = await this.connectProvider(provider, cfConfig, supabaseConfig);

            await this.testProviderConnection(provider, savedConfig);

            previousThemeState = {
                type: currentTheme.type,
                syncStatus: currentTheme.syncStatus,
                themeName: currentTheme.themeName,
                updatedAt: currentTheme.updatedAt
            };

            currentTheme.type = provider;
            currentTheme.syncStatus = 'ok';
            if (themeName) {
                currentTheme.themeName = themeName;
            }
            currentTheme.updatedAt = now;
            themeStateChanged = true;

            await this.saveAppData();

            await this.saveCurrentConfigData(dataToMigrate || this.getDefaultConfigData());
            this.syncProviderClientsState();

            console.log(`UnifiedDataManager: 当前主题已切换为 ${provider} 云端工作区`, {
                themeId: currentTheme.themeId
            });

            return currentTheme;
        } catch (error) {
            if (themeStateChanged && previousThemeState) {
                const currentTheme = this.getCurrentTheme();
                if (currentTheme) {
                    currentTheme.type = previousThemeState.type;
                    currentTheme.syncStatus = previousThemeState.syncStatus || (previousThemeState.type === 'chrome' ? 'local' : 'ok');
                    currentTheme.themeName = previousThemeState.themeName;
                    currentTheme.updatedAt = previousThemeState.updatedAt;

                    try {
                        await this.saveAppData();
                    } catch (rollbackError) {
                        console.error('UnifiedDataManager: 云端切换失败后回滚主题状态失败:', rollbackError);
                    }
                }
            }

            this.syncProviderClientsState();
            console.error('UnifiedDataManager: 当前主题切换为云端失败:', error);
            throw error;
        }
    }

    /**
     * 添加新的云端主题
     */
    async addCloudTheme(themeName, themeId, provider = 'cloudflare', cfConfig = null, supabaseConfig = null) {
        try {
            console.log(`UnifiedDataManager: 添加云端主题 ${themeId} (provider: ${provider})`);

            // 1. 注册主题
            this.appData.themes[themeId] = this.createThemeRecord({
                themeId,
                themeName,
                isActive: false,
                type: provider,
                syncStatus: 'ok'
            });

            await this.connectProvider(provider, cfConfig, supabaseConfig);
            await this.initializeCloudThemeData(this.appData.themes[themeId]);

            await this.saveAppData();
            this.syncProviderClientsState();
            return this.appData.themes[themeId];
        } catch (error) {
            delete this.appData.themes[themeId];
            await this.clearCache(themeId).catch(() => {});
            await this.clearChromeSync(themeId).catch(() => {});
            console.error(`UnifiedDataManager: 添加云端主题失败:`, error);
            throw error;
        }
    }

    /**
     * 删除主题
     */
    async deleteTheme(themeId) {
        try {
            if (themeId === this.DEFAULT_THEME_ID) {
                throw new Error('不能删除默认主题');
            }
            if (this.appData.currentThemeId === themeId) {
                throw new Error('不能删除当前正在使用的主题，请先切换');
            }

            const theme = this.appData.themes[themeId];
            if (!theme) return;

            // 清理缓存和 Chrome 同步残留
            await this.clearCache(themeId);
            await this.clearChromeSync(themeId);

            // 移除元数据
            delete this.appData.themes[themeId];
            await this.saveAppData();
            this.syncProviderClientsState();

            console.log(`UnifiedDataManager: 主题 ${themeId} 已删除`);
        } catch (error) {
            console.error(`UnifiedDataManager: 删除主题失败:`, error);
            throw error;
        }
    }

    /**
     * 禁用云端同步
     */
    async disableCloudSync() {
        let previousThemeState = null;
        let themeStateChanged = false;

        try {
            console.log('UnifiedDataManager: 禁用云端同步');

            const currentTheme = this.getCurrentTheme();
            if (currentTheme && currentTheme.type !== 'chrome') {
                const dataToKeep = this.currentConfigData || await this.loadCurrentConfigData();
                previousThemeState = {
                    type: currentTheme.type,
                    syncStatus: currentTheme.syncStatus,
                    updatedAt: currentTheme.updatedAt
                };

                currentTheme.type = 'chrome';
                currentTheme.syncStatus = 'local';
                currentTheme.updatedAt = new Date().toISOString();
                themeStateChanged = true;
                await this.saveAppData();

                await this.saveCurrentConfigData(dataToKeep || this.getDefaultConfigData());
            }

            this.syncProviderClientsState();

            console.log('UnifiedDataManager: 云端同步已禁用');
        } catch (error) {
            if (themeStateChanged && previousThemeState) {
                const currentTheme = this.getCurrentTheme();
                if (currentTheme) {
                    currentTheme.type = previousThemeState.type;
                    currentTheme.syncStatus = previousThemeState.syncStatus;
                    currentTheme.updatedAt = previousThemeState.updatedAt;

                    try {
                        await this.saveAppData();
                    } catch (rollbackError) {
                        console.error('UnifiedDataManager: 禁用云端同步失败后回滚主题状态失败:', rollbackError);
                    }
                }
            }

            this.syncProviderClientsState();
            console.error('UnifiedDataManager: 禁用云端同步失败:', error);
            throw error;
        }
    }

    /**
     * 获取当前主题的设置 (兼容老接口)
     */
    getCurrentConfig() {
        return this.getCurrentTheme(); // 这个对象现在包含了 visual attributes
    }

    getAllConfigs() {
        return this.getAllThemes();
    }

    switchConfig(id) {
        return this.switchTheme(id);
    }

    /* --- 辅助功能 --- */

    async getFromChromeStorageLocal(keys) {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(keys, resolve);
            } else {
                resolve({});
            }
        });
    }

    async setToChromeStorageLocal(data) {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set(data, resolve);
            } else {
                resolve();
            }
        });
    }

    async getFromChromeStorageSync(keys) {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(keys, resolve);
            } else {
                resolve({});
            }
        });
    }

    async setToChromeStorageSync(data) {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set(data, resolve);
            } else {
                resolve();
            }
        });
    }

    async removeFromChromeStorageSync(keys) {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.remove(keys, resolve);
            } else {
                resolve();
            }
        });
    }

    getCurrentConfigData() {
        return this.currentConfigData;
    }
}

// 导出全局实例
globalThis.unifiedDataManager = new UnifiedDataManager();
