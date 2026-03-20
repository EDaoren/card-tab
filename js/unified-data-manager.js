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
        SUPABASE_CONFIG: 'supabase_config',     // Supabase 连接配置
        CF_CONFIG: 'cf_config'                  // Cloudflare 连接配置
    };

    DEFAULT_THEME_ID = 'default';

    constructor() {
        this.appData = null;
        this.currentConfigData = null;
        this.supabaseClient = null;
        this.cloudflareClient = null;
    }

    /**
     * 获取默认全局应用数据
     */
    getDefaultAppData() {
        return {
            version: '2.0.0', // 升级版本号表示数据结构变更
            currentThemeId: this.DEFAULT_THEME_ID,
            themes: {
                [this.DEFAULT_THEME_ID]: {
                    themeId: this.DEFAULT_THEME_ID,
                    themeName: '默认主题',
                    themeType: 'default',
                    bgImageUrl: null,
                    bgImagePath: null,
                    bgOpacity: 30,
                    isActive: true,
                    type: 'chrome', // 'chrome', 'supabase', 'cloudflare'
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }
        };
    }

    /**
     * 获取指定主题的数据骨架
     */
    getDefaultConfigData() {
        return {
            categories: [
                {
                    id: `cat-${Date.now()}`,
                    name: '默认分类',
                    color: '#4285f4',
                    collapsed: false,
                    order: 0,
                    shortcuts: []
                }
            ],
            settings: {
                viewMode: 'grid'
            }
        };
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
                this.appData.themes[key] = {
                    themeId: key,
                    themeName: oldConfig.displayName || key,
                    themeType: 'default',
                    bgImageUrl: null,
                    bgImagePath: null,
                    bgOpacity: 30,
                    isActive: key === this.appData.currentThemeId,
                    type: oldConfig.type || 'chrome',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
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
                // 确保有必要的字段
                if (!this.appData.themes) {
                    this.appData.themes = {
                        [this.DEFAULT_THEME_ID]: {
                            themeId: this.DEFAULT_THEME_ID,
                            themeName: '默认主题',
                            themeType: 'default',
                            isActive: true,
                            type: 'chrome'
                        }
                    };
                }
                if (!this.appData.currentThemeId) {
                    this.appData.currentThemeId = this.DEFAULT_THEME_ID;
                }
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
        // 1. 获取配置
        const result = await this.getFromChromeStorageSync([
            this.STORAGE_KEYS.SUPABASE_CONFIG,
            this.STORAGE_KEYS.CF_CONFIG
        ]);
        
        const supabaseConfig = result[this.STORAGE_KEYS.SUPABASE_CONFIG];
        const cfConfig = result[this.STORAGE_KEYS.CF_CONFIG];

        // 2. 初始化 Supabase
        if (supabaseConfig && supabaseConfig.enabled && typeof SupabaseClient !== 'undefined') {
            try {
                if (!this.supabaseClient) {
                    this.supabaseClient = new SupabaseClient();
                }
                await this.supabaseClient.initialize(supabaseConfig);
                console.log('UnifiedDataManager: Supabase 客户端初始化成功');
            } catch (error) {
                console.error('UnifiedDataManager: Supabase客户端初始化失败:', error);
            }
        }

        // 3. 初始化 Cloudflare
        if (cfConfig && cfConfig.enabled && typeof CloudflareClient !== 'undefined') {
            try {
                if (!this.cloudflareClient) {
                    this.cloudflareClient = new CloudflareClient();
                }
                await this.cloudflareClient.initialize(cfConfig);
                console.log('UnifiedDataManager: Cloudflare 客户端初始化成功');
            } catch (error) {
                console.error('UnifiedDataManager: Cloudflare 客户端初始化失败:', error);
            }
        }
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
                    this.currentConfigData = cachedData;
                    console.log('UnifiedDataManager: 从缓存加载数据成功');
                    
                    // 异步触发后台更新
                    if (currentTheme.type !== 'chrome') {
                        this.backgroundSyncFromCloud(currentTheme).catch(e => console.error('后台同步失败', e));
                    }
                    return this.currentConfigData;
                }
            }

            // 缓存未命中或强制刷新，从数据源读取
            let data = null;
            if (currentTheme.type === 'supabase') {
                data = await this.loadFromSupabase(currentTheme);
            } else if (currentTheme.type === 'cloudflare') {
                data = await this.loadFromCloudflare(currentTheme);
            } else {
                data = await this.loadFromChromeSync(currentThemeId);
            }

            if (data) {
                this.currentConfigData = data;
                // 更新缓存
                await this.saveToCache(currentThemeId, data);
            } else {
                this.currentConfigData = this.getDefaultConfigData();
                await this.saveCurrentConfigData(this.currentConfigData);
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
        try {
            let cloudData = null;
            if (theme.type === 'supabase') {
                cloudData = await this.loadFromSupabase(theme);
            } else if (theme.type === 'cloudflare') {
                cloudData = await this.loadFromCloudflare(theme);
            }

            if (cloudData) {
                await this.saveToCache(theme.themeId, cloudData);
                // 触发一个事件通知UI可能有更新
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    try {
                        chrome.runtime.sendMessage({ action: "dataUpdated", source: "backgroundSync" });
                    } catch (e) {
                        // 忽略发送消息错误（可能不在扩展上下文中）
                    }
                }
            }
        } catch (e) {
            console.error('UnifiedDataManager: 后台同步失败', e);
        }
    }

    /**
     * 保存当前主题的数据
     * 策略：旁路刷新 - 先写主存储，再清缓存，再更新缓存并返回
     */
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

            const dataToSave = data || this.currentConfigData;

            // 1. 写主存储
            if (currentTheme.type === 'supabase') {
                await this.saveToSupabase(currentTheme, dataToSave);
            } else if (currentTheme.type === 'cloudflare') {
                await this.saveToCloudflare(currentTheme, dataToSave);
            } else {
                await this.saveToChromeSync(currentThemeId, dataToSave);
            }

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
        const key = `chrome_sync_${themeId}`;
        const result = await this.getFromChromeStorageSync([key]);
        return result[key] || null;
    }

    async saveToChromeSync(themeId, data) {
        const key = `chrome_sync_${themeId}`;
        await this.setToChromeStorageSync({ [key]: data });
    }

    async loadFromSupabase(theme) {
        if (!this.supabaseClient) throw new Error('SupabaseClient 未初始化');
        
        const result = await this.supabaseClient.loadData(theme.themeId);
        if (result && result.data) {
            // 同步远端的元数据到本地 appData
            this.updateThemeMetadataFromCloudResponse(theme.themeId, result);
            return result.data;
        }
        return null;
    }

    async saveToSupabase(theme, data) {
        if (!this.supabaseClient) throw new Error('SupabaseClient 未初始化');
        await this.supabaseClient.saveData(theme.themeId, data, theme);
    }

    async loadFromCloudflare(theme) {
        if (!this.cloudflareClient) throw new Error('CloudflareClient 未初始化');
        
        const result = await this.cloudflareClient.loadData(theme.themeId);
        if (result && result.data) {
            this.updateThemeMetadataFromCloudResponse(theme.themeId, result);
            return result.data;
        }
        return null;
    }

    async saveToCloudflare(theme, data) {
        if (!this.cloudflareClient) throw new Error('CloudflareClient 未初始化');
        await this.cloudflareClient.saveData(theme.themeId, data, theme);
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

    generateThemeId(prefix = 'theme') {
        return `${prefix}-${Date.now()}`;
    }

    async createLocalTheme(themeName, themeType = 'default', bgOpacity = 30) {
        const themeId = this.generateThemeId('theme');
        const now = new Date().toISOString();
        const theme = {
            themeId,
            themeName,
            themeType,
            bgImageUrl: null,
            bgImagePath: null,
            bgOpacity,
            isActive: false,
            type: 'chrome',
            createdAt: now,
            updatedAt: now
        };

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

        if (theme.type !== 'chrome') {
            await this.initCloudClients();

            if (themeId === this.appData.currentThemeId) {
                await this.saveCurrentConfigData({ ...this.currentConfigData });
            } else {
                let dataToPersist = await this.loadFromCache(themeId);

                if (!dataToPersist) {
                    if (theme.type === 'supabase' && this.supabaseClient) {
                        const cloudResponse = await this.supabaseClient.loadData(theme.themeId);
                        dataToPersist = cloudResponse?.data || null;
                    } else if (theme.type === 'cloudflare' && this.cloudflareClient) {
                        const cloudResponse = await this.cloudflareClient.loadData(theme.themeId);
                        dataToPersist = cloudResponse?.data || null;
                    }
                }

                if (!dataToPersist) {
                    dataToPersist = this.getDefaultConfigData();
                }

                if (theme.type === 'supabase') {
                    await this.saveToSupabase(theme, dataToPersist);
                } else if (theme.type === 'cloudflare') {
                    await this.saveToCloudflare(theme, dataToPersist);
                }

                await this.saveToCache(themeId, dataToPersist);
            }
        }

        return theme;
    }

    async switchTheme(themeId) {
        try {
            console.log(`UnifiedDataManager: 切换到主题 ${themeId}`);

            if (!this.appData.themes[themeId]) {
                throw new Error(`主题 ${themeId} 不存在`);
            }

            // 清除其他缓存
            await this.clearAllCacheExceptCurrent();

            // 更新活跃状态
            this.appData.currentThemeId = themeId;
            Object.values(this.appData.themes).forEach(t => {
                t.isActive = (t.themeId === themeId);
            });

            await this.saveAppData();

            // 加载新主题数据
            await this.loadCurrentConfigData(true);
            
            console.log(`UnifiedDataManager: 切换到主题 ${themeId} 成功`);
            return this.currentConfigData;
        } catch (error) {
            console.error(`UnifiedDataManager: 切换主题失败:`, error);
            throw error;
        }
    }

    async promoteCurrentThemeToCloud(provider = 'cloudflare', cfConfig = null, supabaseConfig = null, themeName = '') {
        try {
            const currentTheme = this.getCurrentTheme();
            if (!currentTheme) {
                throw new Error('当前主题不存在');
            }

            const dataToMigrate = this.currentConfigData || await this.loadCurrentConfigData();
            const now = new Date().toISOString();

            if (provider === 'cloudflare') {
                const newCfConfig = { ...cfConfig, enabled: true };

                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.SUPABASE_CONFIG]: { enabled: false } });
                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.CF_CONFIG]: newCfConfig });

                if (!this.cloudflareClient) {
                    this.cloudflareClient = new CloudflareClient();
                }
                await this.cloudflareClient.initialize(newCfConfig);

                if (this.supabaseClient) {
                    this.supabaseClient.disconnect();
                    this.supabaseClient = null;
                }
            } else if (provider === 'supabase') {
                const newSupabaseConfig = { ...supabaseConfig, enabled: true };

                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.CF_CONFIG]: { enabled: false } });
                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.SUPABASE_CONFIG]: newSupabaseConfig });

                if (!this.supabaseClient) {
                    this.supabaseClient = new SupabaseClient();
                }
                await this.supabaseClient.initialize(newSupabaseConfig);

                if (this.cloudflareClient) {
                    this.cloudflareClient.disconnect();
                    this.cloudflareClient = null;
                }
            } else {
                throw new Error(`不支持的云端提供商：${provider}`);
            }

            currentTheme.type = provider;
            if (themeName) {
                currentTheme.themeName = themeName;
            }
            currentTheme.updatedAt = now;
            await this.saveAppData();

            await this.saveCurrentConfigData(dataToMigrate || this.getDefaultConfigData());

            console.log(`UnifiedDataManager: 当前主题已切换为 ${provider} 云端工作区`, {
                themeId: currentTheme.themeId
            });

            return currentTheme;
        } catch (error) {
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
            this.appData.themes[themeId] = {
                themeId: themeId,
                themeName: themeName,
                themeType: 'default',
                bgImageUrl: null,
                bgImagePath: null,
                bgOpacity: 30,
                isActive: false,
                type: provider,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (provider === 'cloudflare') {
                const newCfConfig = { ...cfConfig, enabled: true };
                
                // 互斥禁用 supabase
                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.SUPABASE_CONFIG]: { enabled: false } });
                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.CF_CONFIG]: newCfConfig });

                if (!this.cloudflareClient) this.cloudflareClient = new CloudflareClient();
                await this.cloudflareClient.initialize(newCfConfig);

                // 首次拉取云端数据，如果没有则写入默认骨架
                const themeObj = this.appData.themes[themeId];
                const cloudData = await this.loadFromCloudflare(themeObj);
                
                if (!cloudData) {
                    await this.saveToCloudflare(themeObj, this.getDefaultConfigData());
                    await this.saveToCache(themeId, this.getDefaultConfigData());
                } else {
                    await this.saveToCache(themeId, cloudData);
                }

                if (this.supabaseClient) {
                    this.supabaseClient.disconnect();
                    this.supabaseClient = null;
                }
            } else if (provider === 'supabase') {
                // ... 与 cloudflare 类似
                const newSupabaseConfig = { ...supabaseConfig, enabled: true };
                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.CF_CONFIG]: { enabled: false } });
                await this.setToChromeStorageSync({ [this.STORAGE_KEYS.SUPABASE_CONFIG]: newSupabaseConfig });

                if (!this.supabaseClient) this.supabaseClient = new SupabaseClient();
                await this.supabaseClient.initialize(newSupabaseConfig);

                const themeObj = this.appData.themes[themeId];
                const cloudData = await this.loadFromSupabase(themeObj);
                
                if (!cloudData) {
                    await this.saveToSupabase(themeObj, this.getDefaultConfigData());
                    await this.saveToCache(themeId, this.getDefaultConfigData());
                } else {
                    await this.saveToCache(themeId, cloudData);
                }

                if (this.cloudflareClient) {
                    this.cloudflareClient.disconnect();
                    this.cloudflareClient = null;
                }
            }

            await this.saveAppData();
            return this.appData.themes[themeId];
        } catch (error) {
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

            // 尝试删除云端数据
            if (theme.type === 'supabase' && this.supabaseClient) {
                try {
                    await this.supabaseClient.deleteThemeData(themeId);
                } catch (e) { console.warn('云端删除失败', e); }
            } else if (theme.type === 'cloudflare' && this.cloudflareClient) {
                try {
                    await this.cloudflareClient.deleteData(themeId);
                } catch (e) { console.warn('云端删除失败', e); }
            }

            // 清理缓存
            await this.clearCache(themeId);

            // 移除元数据
            delete this.appData.themes[themeId];
            await this.saveAppData();

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
        try {
            console.log('UnifiedDataManager: 禁用云端同步');

            const currentTheme = this.getCurrentTheme();
            if (currentTheme && currentTheme.type !== 'chrome') {
                const dataToKeep = this.currentConfigData || await this.loadCurrentConfigData();

                currentTheme.type = 'chrome';
                currentTheme.updatedAt = new Date().toISOString();
                await this.saveAppData();

                await this.saveCurrentConfigData(dataToKeep || this.getDefaultConfigData());
            }

            // 禁用云端配置
            await this.setToChromeStorageSync({ [this.STORAGE_KEYS.SUPABASE_CONFIG]: { enabled: false } });
            await this.setToChromeStorageSync({ [this.STORAGE_KEYS.CF_CONFIG]: { enabled: false } });

            if (this.supabaseClient) { this.supabaseClient.disconnect(); this.supabaseClient = null; }
            if (this.cloudflareClient) { this.cloudflareClient.disconnect(); this.cloudflareClient = null; }

            console.log('UnifiedDataManager: 云端同步已禁用');
        } catch (error) {
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

    getCurrentConfigData() {
        return this.currentConfigData;
    }
}

// 导出全局实例
globalThis.unifiedDataManager = new UnifiedDataManager();
