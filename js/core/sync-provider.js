/**
 * 同步 Provider 抽象层。
 * 统一 Cloudflare、Supabase 与 Chrome Storage 的数据接口。
 */

class BaseSyncProvider {
  constructor(dataManager, type) {
    this.dataManager = dataManager;
    this.type = type;
  }

  getCapabilities() {
    return {
      cloudSync: false,
      fileStorage: false,
      schemaMode: 'none'
    };
  }

  async loadThemeData() {
    throw new Error(`${this.type} provider 未实现 loadThemeData`);
  }

  async saveThemeData() {
    throw new Error(`${this.type} provider 未实现 saveThemeData`);
  }

  async deleteThemeData() {
    throw new Error(`${this.type} provider 未实现 deleteThemeData`);
  }

  async uploadThemeFile() {
    throw new Error(`${this.type} provider 不支持文件上传`);
  }

  async deleteThemeFile() {
    throw new Error(`${this.type} provider 不支持文件删除`);
  }

  async testConnection() {
    throw new Error(`${this.type} provider 不支持连接测试`);
  }

  async initializeSchema() {
    throw new Error(`${this.type} provider 不支持自动初始化`);
  }
}

class ChromeStorageSyncProvider extends BaseSyncProvider {
  constructor(dataManager) {
    super(dataManager, 'chrome');
  }

  async testConnection() {
    return { ok: true, provider: 'chrome' };
  }

  async loadThemeData(theme) {
    return this.dataManager.loadFromChromeSync(theme.themeId);
  }

  async saveThemeData(theme, data) {
    await this.dataManager.saveToChromeSync(theme.themeId, data);
  }

  async deleteThemeData(theme) {
    await this.dataManager.clearChromeSync(theme.themeId);
  }
}

class SupabaseSyncProvider extends BaseSyncProvider {
  constructor(dataManager) {
    super(dataManager, 'supabase');
  }

  getCapabilities() {
    return {
      cloudSync: true,
      fileStorage: true,
      schemaMode: 'remote'
    };
  }

  async loadThemeData(theme) {
    const client = await this.dataManager.ensureProviderClient('supabase');
    const result = await client.loadData(theme.themeId);

    if (result && result.data) {
      this.dataManager.updateThemeMetadataFromCloudResponse(theme.themeId, result);
      return result.data;
    }

    return null;
  }

  async saveThemeData(theme, data) {
    const client = await this.dataManager.ensureProviderClient('supabase');
    await client.saveData(theme.themeId, data, theme);
  }

  async deleteThemeData(theme) {
    const client = await this.dataManager.ensureProviderClient('supabase');
    await client.deleteThemeData(theme.themeId);
  }

  async uploadThemeFile(theme, file) {
    const client = await this.dataManager.ensureProviderClient('supabase');
    return client.uploadFile(file, client.getBucketName(), theme.themeId);
  }

  async deleteThemeFile(theme, filePath) {
    const client = await this.dataManager.ensureProviderClient('supabase');
    return client.deleteFile(client.getBucketName(), filePath);
  }

  async testConnection(config = null) {
    if (config) {
      if (typeof SupabaseClient === 'undefined') {
        throw new Error('SupabaseClient 未加载');
      }

      return SupabaseClient.getSharedInstance().testConnectionWithConfig(config);
    }

    const client = await this.dataManager.ensureProviderClient('supabase');
    return client.testConnection();
  }

  async initializeSchema(config = null) {
    const sql = typeof SupabaseClient !== 'undefined'
      ? SupabaseClient.getTableCreationSQL(config?.bucketName || 'backgrounds')
      : '';

    if (typeof globalThis.supabaseResourceManager !== 'undefined') {
      return globalThis.supabaseResourceManager.initializeProjectResources({
        ...(config || {}),
        sql
      });
    }

    return {
      mode: 'manual',
      sql
    };
  }
}

class CloudflareSyncProvider extends BaseSyncProvider {
  constructor(dataManager) {
    super(dataManager, 'cloudflare');
  }

  getCapabilities() {
    return {
      cloudSync: true,
      fileStorage: true,
      schemaMode: 'remote'
    };
  }

  async loadThemeData(theme) {
    const client = await this.dataManager.ensureProviderClient('cloudflare');
    const result = await client.loadData(theme.themeId);

    if (result && result.data) {
      this.dataManager.updateThemeMetadataFromCloudResponse(theme.themeId, result);
      return result.data;
    }

    return null;
  }

  async saveThemeData(theme, data) {
    const client = await this.dataManager.ensureProviderClient('cloudflare');
    await client.saveData(theme.themeId, data, theme);
  }

  async deleteThemeData(theme) {
    const client = await this.dataManager.ensureProviderClient('cloudflare');
    await client.deleteData(theme.themeId);
  }

  async uploadThemeFile(theme, file) {
    const client = await this.dataManager.ensureProviderClient('cloudflare');
    return client.uploadFile(file, theme.themeId);
  }

  async deleteThemeFile(theme, filePath) {
    const client = await this.dataManager.ensureProviderClient('cloudflare');
    return client.deleteFile('backgrounds', filePath, theme.themeId);
  }

  async testConnection(config = null) {
    if (config) {
      const tempClient = new CloudflareClient();
      await tempClient.initialize(config, false);
      return tempClient.testConnection();
    }

    const client = await this.dataManager.ensureProviderClient('cloudflare');
    return client.testConnection();
  }

  async initializeSchema(config = null) {
    if (config) {
      const tempClient = new CloudflareClient();
      await tempClient.initialize(config);
      return tempClient.initializeDatabase();
    }

    const client = await this.dataManager.ensureProviderClient('cloudflare');
    return client.initializeDatabase();
  }
}

class SyncProviderFactory {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.providers = new Map();
  }

  createProvider(type) {
    if (type === 'chrome') {
      return new ChromeStorageSyncProvider(this.dataManager);
    }

    if (type === 'supabase') {
      return new SupabaseSyncProvider(this.dataManager);
    }

    if (type === 'cloudflare') {
      return new CloudflareSyncProvider(this.dataManager);
    }

    throw new Error(`不支持的同步提供商：${type}`);
  }

  getProvider(type) {
    if (!this.providers.has(type)) {
      this.providers.set(type, this.createProvider(type));
    }

    return this.providers.get(type);
  }

  getBoundProvider(theme) {
    const provider = this.getProvider(theme.type);

    return {
      type: provider.type,
      getCapabilities: () => provider.getCapabilities(),
      testConnection: (config = null) => provider.testConnection(config),
      load: () => provider.loadThemeData(theme),
      save: (data) => provider.saveThemeData(theme, data),
      delete: () => provider.deleteThemeData(theme),
      uploadFile: (file) => provider.uploadThemeFile(theme, file),
      deleteFile: (filePath) => provider.deleteThemeFile(theme, filePath),
      initializeSchema: (config = null) => provider.initializeSchema(config)
    };
  }
}

globalThis.BaseSyncProvider = BaseSyncProvider;
globalThis.SyncProviderFactory = SyncProviderFactory;
