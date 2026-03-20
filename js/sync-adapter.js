/**
 * 同步适配器
 * 为现有的同步UI提供兼容接口，使其能够使用新的统一数据管理器
 */

class SyncAdapter {
    constructor() {
        this.isSupabaseEnabled = false;
        this.isCloudflareEnabled = false;
        this.currentSupabaseConfig = null;
        this.currentCloudflareConfig = null;
        this.lastSyncTime = null;
    }

    /**
     * 初始化同步适配器
     */
    async init() {
        try {
            // 检查当前主题是否为云端主题
            const currentTheme = window.unifiedDataManager.getCurrentTheme();
            this.isSupabaseEnabled = currentTheme.type === 'supabase';
            this.isCloudflareEnabled = currentTheme.type === 'cloudflare';

            if (this.isSupabaseEnabled) {
                const result = await this.getFromChromeStorageSync(['supabase_config']);
                this.currentSupabaseConfig = result.supabase_config;
            }

            if (this.isCloudflareEnabled) {
                const result = await this.getFromChromeStorageSync(['cf_config']);
                this.currentCloudflareConfig = result.cf_config;
            }

            console.log('SyncAdapter: 初始化完成', {
                isSupabaseEnabled: this.isSupabaseEnabled,
                isCloudflareEnabled: this.isCloudflareEnabled,
                themeType: currentTheme.type
            });
        } catch (error) {
            console.error('SyncAdapter: 初始化失败:', error);
        }
    }

    /**
     * 获取同步状态
     */
    getSyncStatus() {
        const currentTheme = window.unifiedDataManager.getCurrentTheme() || {
            themeId: 'default',
            type: 'chrome'
        };
        const isSupabaseEnabled = currentTheme.type === 'supabase';
        const isCloudflareEnabled = currentTheme.type === 'cloudflare';

        this.isSupabaseEnabled = isSupabaseEnabled;
        this.isCloudflareEnabled = isCloudflareEnabled;

        return {
            isSupabaseEnabled,
            isCloudflareEnabled,
            isCloudEnabled: isSupabaseEnabled || isCloudflareEnabled,
            activeProvider: isCloudflareEnabled ? 'cloudflare' : (isSupabaseEnabled ? 'supabase' : 'none'),
            currentThemeId: currentTheme.themeId,
            currentThemeName: currentTheme.themeName || '',
            currentThemeType: currentTheme.type,
            lastSyncTime: this.lastSyncTime,
            supabaseConfig: this.currentSupabaseConfig,
            cloudflareConfig: this.currentCloudflareConfig
        };
    }

    /**
     * 禁用云端同步
     */
    async disableCloudSync() {
        try {
            console.log('SyncAdapter: 禁用云端同步');

            await window.unifiedDataManager.disableCloudSync();

            // 更新状态
            this.isSupabaseEnabled = false;
            this.isCloudflareEnabled = false;
            this.currentSupabaseConfig = null;
            this.currentCloudflareConfig = null;
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
            if (!this.isSupabaseEnabled && !this.isCloudflareEnabled) {
                throw new Error('云端同步未启用');
            }

            console.log('SyncAdapter: 开始手动同步');

            // 重新加载当前配置数据（这会触发同步）
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

    /**
     * 兼容性方法：保存数据
     */
    async saveData(data, options = {}) {
        return await window.unifiedDataManager.saveCurrentConfigData(data);
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

    /**
     * 获取 Supabase 配置
     */
    async getSupabaseConfig() {
        const result = await this.getFromChromeStorageSync(['supabase_config']);
        return result.supabase_config;
    }

    /**
     * 启用 Supabase 同步 (适配独立设置页面的逻辑通常会直接调用 UDM，但保留接口供兼容)
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
            
            this.isSupabaseEnabled = true;
            this.isCloudflareEnabled = false;
            this.currentSupabaseConfig = config;
            this.currentCloudflareConfig = null;
            this.lastSyncTime = new Date().toISOString();
            return true;
        } catch (error) {
            console.error('SyncAdapter: 启用Supabase失败', error);
            throw error;
        }
    }

    /**
     * 启用 Cloudflare 同步
     */
    async enableCloudflareSync(config, themeId = 'default-cf', themeName = '云端主题') {
        try {
            console.log('SyncAdapter: 启用 Cloudflare 同步', { themeId: themeId });

            const currentTheme = window.unifiedDataManager.getCurrentTheme();
            if (currentTheme?.type === 'supabase') {
                throw new Error('当前已启用 Supabase 同步，请先禁用后再切换到 Cloudflare');
            }

            const cfConfig = {
                workerUrl: config.workerUrl,
                accessToken: config.accessToken || ''
            };

            await window.unifiedDataManager.promoteCurrentThemeToCloud(
                'cloudflare',
                cfConfig,
                null,
                themeName
            );

            this.isCloudflareEnabled = true;
            this.isSupabaseEnabled = false;
            this.currentCloudflareConfig = cfConfig;
            this.currentSupabaseConfig = null;
            this.lastSyncTime = new Date().toISOString();

            console.log('SyncAdapter: Cloudflare 同步已启用');
            return true;
        } catch (error) {
            console.error('SyncAdapter: 启用 Cloudflare 同步失败:', error);
            throw error;
        }
    }

    /**
     * 禁用 Supabase 同步
     */
    async disableSupabaseSync() {
        return await this.disableCloudSync();
    }

    /**
     * 禁用 Cloudflare 同步
     */
    async disableCloudflareSync() {
        return await this.disableCloudSync();
    }

    /**
     * 手动同步
     */
    async manualSync() {
        return await this.syncData();
    }

    /**
     * 获取 Cloudflare 配置
     */
    async getCloudflareConfig() {
        const result = await this.getFromChromeStorageSync(['cf_config']);
        return result.cf_config;
    }
}

// 创建全局实例，替换原有的 syncManager
window.syncManager = new SyncAdapter();
