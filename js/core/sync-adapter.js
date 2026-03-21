/**
 * 同步适配器
 * 为现有的同步 UI 提供兼容接口，使其能够使用新的统一数据管理器。
 */

class SyncAdapter {
    constructor() {
        this.lastSyncTime = null;
    }

    /**
     * 初始化同步适配器
     */
    async init() {
        try {
            await window.unifiedDataManager.preloadProviderConfigs();
            const status = this.getSyncStatus();

            console.log('SyncAdapter: 初始化完成', {
                activeProvider: status.activeProvider,
                themeType: status.currentThemeType
            });
        } catch (error) {
            console.error('SyncAdapter: 初始化失败:', error);
        }
    }

    /**
     * 获取同步状态
     */
    getSyncStatus() {
        const status = window.unifiedDataManager.getSyncStatusSnapshot
            ? window.unifiedDataManager.getSyncStatusSnapshot()
            : {
                isSupabaseEnabled: false,
                isCloudflareEnabled: false,
                isCloudEnabled: false,
                activeProvider: 'none',
                currentThemeId: 'default',
                currentThemeName: '',
                currentThemeType: 'chrome',
                supabaseConfig: null,
                cloudflareConfig: null,
                providerCapabilities: {
                    cloudSync: false,
                    fileStorage: false,
                    schemaMode: 'none'
                }
            };

        return {
            ...status,
            lastSyncTime: this.lastSyncTime
        };
    }

    /**
     * 禁用云端同步
     */
    async disableCloudSync() {
        try {
            console.log('SyncAdapter: 禁用云端同步');

            await window.unifiedDataManager.disableCloudSync();
            this.lastSyncTime = null;

            console.log('SyncAdapter: 云端同步已禁用');
            return true;
        } catch (error) {
            console.error('SyncAdapter: 禁用云端同步失败:', error);
            throw error;
        }
    }

    /**
     * 手动同步数据
     */
    async syncData() {
        try {
            const status = this.getSyncStatus();
            if (!status.isCloudEnabled) {
                throw new Error('云端同步未启用');
            }

            console.log('SyncAdapter: 开始手动同步');
            await window.unifiedDataManager.loadCurrentConfigData(true);

            this.lastSyncTime = new Date().toISOString();
            console.log('SyncAdapter: 手动同步完成');

            return true;
        } catch (error) {
            console.error('SyncAdapter: 手动同步失败:', error);
            throw error;
        }
    }

    /**
     * Chrome Storage Sync 操作
     */
    async getFromChromeStorageSync(keys) {
        return window.unifiedDataManager.getFromChromeStorageSync(keys);
    }

    async setToChromeStorageSync(data) {
        return window.unifiedDataManager.setToChromeStorageSync(data);
    }

    /**
     * 兼容性方法：保存数据
     */
    async saveData(data) {
        return window.unifiedDataManager.saveCurrentConfigData(data);
    }

    /**
     * 兼容性方法：加载数据
     */
    async loadData(preferCloud = false, forceRefresh = false) {
        if (forceRefresh) {
            await window.unifiedDataManager.loadCurrentConfigData(true);
        }
        return window.unifiedDataManager.getCurrentConfigData();
    }

    async getSupabaseConfig() {
        return window.unifiedDataManager.getProviderConfig('supabase');
    }

    async getCloudflareConfig() {
        return window.unifiedDataManager.getProviderConfig('cloudflare');
    }

    getProviderCapabilities(provider) {
        return window.unifiedDataManager.getProviderCapabilities(provider);
    }

    async testProviderConnection(provider, config = null) {
        return window.unifiedDataManager.testProviderConnection(provider, config);
    }

    async initializeProviderSchema(provider, config = null) {
        return window.unifiedDataManager.initializeProviderSchema(provider, config);
    }

    /**
     * 启用 Supabase 同步
     */
    async enableSupabaseSync(config, themeId = 'default-supabase', themeName = '云端主题') {
        try {
            const currentTheme = window.unifiedDataManager.getCurrentTheme();
            if (currentTheme?.type === 'cloudflare') {
                throw new Error('当前已启用 Cloudflare 同步，请先禁用后再切换到 Supabase');
            }

            await window.unifiedDataManager.promoteCurrentThemeToCloud(
                'supabase',
                null,
                config,
                themeName
            );

            this.lastSyncTime = new Date().toISOString();
            return true;
        } catch (error) {
            console.error('SyncAdapter: 启用 Supabase 失败', error);
            throw error;
        }
    }

    /**
     * 启用 Cloudflare 同步
     */
    async enableCloudflareSync(config, themeId = 'default-cf', themeName = '云端主题') {
        try {
            console.log('SyncAdapter: 启用 Cloudflare 同步', { themeId });

            const currentTheme = window.unifiedDataManager.getCurrentTheme();
            if (currentTheme?.type === 'supabase') {
                throw new Error('当前已启用 Supabase 同步，请先禁用后再切换到 Cloudflare');
            }

            await window.unifiedDataManager.promoteCurrentThemeToCloud(
                'cloudflare',
                {
                    workerUrl: config.workerUrl,
                    accessToken: config.accessToken || ''
                },
                null,
                themeName
            );

            this.lastSyncTime = new Date().toISOString();
            console.log('SyncAdapter: Cloudflare 同步已启用');
            return true;
        } catch (error) {
            console.error('SyncAdapter: 启用 Cloudflare 同步失败:', error);
            throw error;
        }
    }

    async disableSupabaseSync() {
        return this.disableCloudSync();
    }

    async disableCloudflareSync() {
        return this.disableCloudSync();
    }

    async manualSync() {
        return this.syncData();
    }
}

window.syncManager = new SyncAdapter();
