/**
 * Supabase 资源管理器。
 * 用于缓存项目初始化参数，并在扩展内完成数据库与 Storage 初始化。
 */

class SupabaseManagementApiClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.apiBaseUrl = 'https://api.supabase.com/v1';
  }

  buildErrorMessage(payload, fallbackMessage) {
    if (!payload) {
      return fallbackMessage;
    }

    if (typeof payload === 'string') {
      return payload || fallbackMessage;
    }

    return payload.message
      || payload.error_description
      || payload.error
      || payload.msg
      || fallbackMessage;
  }

  async requestRaw(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    headers.set('Accept', 'application/json');

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers
    });
    const text = await response.text().catch(() => '');
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    return {
      response,
      payload,
      text
    };
  }

  async request(path, init = {}) {
    const { response, payload, text } = await this.requestRaw(path, init);
    if (!response.ok) {
      throw new Error(this.buildErrorMessage(payload, text || `Supabase 管理 API 请求失败 (${response.status})`));
    }

    return payload ?? text ?? null;
  }

  async getProject(projectRef) {
    return this.request(`/projects/${encodeURIComponent(projectRef)}`, {
      method: 'GET'
    });
  }

  async executeSql(projectRef, sql) {
    const encodedProjectRef = encodeURIComponent(projectRef);
    const attempts = [
      {
        path: `/projects/${encodedProjectRef}/database/query`,
        body: { query: sql }
      },
      {
        path: `/projects/${encodedProjectRef}/database/query`,
        body: { sql }
      },
      {
        path: `/projects/${encodedProjectRef}/database/sql`,
        body: { query: sql }
      },
      {
        path: `/projects/${encodedProjectRef}/database/sql`,
        body: { sql }
      },
      {
        path: `/projects/${encodedProjectRef}/sql`,
        body: { query: sql }
      },
      {
        path: `/projects/${encodedProjectRef}/sql`,
        body: { sql }
      }
    ];
    let lastError = null;

    for (const attempt of attempts) {
      const { response, payload, text } = await this.requestRaw(attempt.path, {
        method: 'POST',
        body: JSON.stringify(attempt.body)
      });

      if (response.ok) {
        return payload ?? (text ? { text } : { ok: true });
      }

      lastError = new Error(
        this.buildErrorMessage(payload, text || `Supabase SQL 初始化失败 (${response.status})`)
      );

      if (![400, 404, 405, 422].includes(response.status)) {
        break;
      }
    }

    throw lastError || new Error('Supabase SQL 初始化失败');
  }
}

class SupabaseResourceManager {
  constructor() {
    this.storageKeys = {
      profile: 'card_tab_sb_setup_profile',
      adminSecrets: 'card_tab_sb_setup_admin_secrets',
      preferences: 'card_tab_sb_setup_preferences'
    };
    this.defaultPreferences = {
      saveAdminSecrets: false
    };
  }

  async getLocalStorage(keys) {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        resolve({});
      }
    });
  }

  async setLocalStorage(data) {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.set(data, resolve);
      } else {
        resolve();
      }
    });
  }

  async removeLocalStorage(keys) {
    return new Promise((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.remove(keys, resolve);
      } else {
        resolve();
      }
    });
  }

  async getPreferences() {
    const result = await this.getLocalStorage([this.storageKeys.preferences]);
    return {
      ...this.defaultPreferences,
      ...(result[this.storageKeys.preferences] || {})
    };
  }

  async savePreferences(partialPreferences) {
    const currentPreferences = await this.getPreferences();
    const nextPreferences = {
      ...currentPreferences,
      ...partialPreferences
    };
    await this.setLocalStorage({ [this.storageKeys.preferences]: nextPreferences });
    return nextPreferences;
  }

  async getProfile() {
    const result = await this.getLocalStorage([this.storageKeys.profile]);
    return result[this.storageKeys.profile] || null;
  }

  async saveProfile(profile) {
    await this.setLocalStorage({ [this.storageKeys.profile]: profile });
    return profile;
  }

  async getSavedAdminSecrets() {
    const result = await this.getLocalStorage([this.storageKeys.adminSecrets]);
    return result[this.storageKeys.adminSecrets] || {
      serviceRoleKey: '',
      managementToken: ''
    };
  }

  async setSavedAdminSecrets(secrets, shouldSave) {
    if (shouldSave && (secrets.serviceRoleKey || secrets.managementToken)) {
      const nextSecrets = {
        serviceRoleKey: String(secrets.serviceRoleKey || '').trim(),
        managementToken: String(secrets.managementToken || '').trim()
      };
      await this.setLocalStorage({ [this.storageKeys.adminSecrets]: nextSecrets });
      return nextSecrets;
    }

    await this.removeLocalStorage([this.storageKeys.adminSecrets]);
    return {
      serviceRoleKey: '',
      managementToken: ''
    };
  }

  async getSetupState() {
    const [profile, preferences, savedAdminSecrets] = await Promise.all([
      this.getProfile(),
      this.getPreferences(),
      this.getSavedAdminSecrets()
    ]);

    return {
      profile,
      preferences,
      savedAdminSecrets
    };
  }

  async clearSetupCache(options = {}) {
    const shouldClearAdminSecrets = options.clearAdminSecrets !== false;
    const keys = [this.storageKeys.profile];

    if (shouldClearAdminSecrets) {
      keys.push(this.storageKeys.adminSecrets);
    }

    await this.removeLocalStorage(keys);
    return true;
  }

  normalizeProjectUrl(url) {
    const normalized = String(url || '').trim().replace(/\/+$/, '');
    if (!normalized) {
      return '';
    }

    try {
      const parsed = new URL(normalized);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
      throw new Error('Project URL 格式不正确');
    }
  }

  deriveProjectRef(projectUrl) {
    try {
      const { hostname } = new URL(projectUrl);
      return hostname.split('.')[0] || '';
    } catch (error) {
      return '';
    }
  }

  normalizeBucketName(value, fallback = 'backgrounds') {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63);

    return normalized || fallback;
  }

  getDefaultResourceNames() {
    return {
      bucketName: 'backgrounds'
    };
  }

  createServiceClient(projectUrl, serviceRoleKey) {
    if (!globalThis.supabase) {
      throw new Error('Supabase SDK 未加载');
    }

    return globalThis.supabase.createClient(projectUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  async testProjectConnection(config) {
    const projectUrl = this.normalizeProjectUrl(config.url);
    const anonKey = String(config.anonKey || '').trim();
    if (!projectUrl || !anonKey) {
      throw new Error('请填写 Project URL 和 anon/public Key');
    }

    const attempts = [
      `${projectUrl}/auth/v1/settings`,
      `${projectUrl}/rest/v1/`
    ];
    let lastError = null;

    for (const endpoint of attempts) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            apikey: anonKey
          }
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error('Supabase API Key 无效或无权限');
        }

        if (!response.ok && response.status !== 404) {
          const errorText = await response.text().catch(() => '');
          throw new Error(errorText || `连接失败 (${response.status})`);
        }

        const now = new Date().toISOString();
        const profile = await this.saveExistingProjectProfile({
          url: projectUrl,
          projectRef: config.projectRef || this.deriveProjectRef(projectUrl),
          bucketName: config.bucketName || this.getDefaultResourceNames().bucketName,
          lastConnectedAt: now
        });

        return {
          ok: true,
          provider: 'supabase',
          profile
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Supabase 项目连接失败');
  }

  async detectSchemaReady(config) {
    if (typeof SupabaseClient === 'undefined') {
      return false;
    }

    try {
      const client = new SupabaseClient();
      await client.initialize({
        url: config.url,
        anonKey: config.anonKey
      }, false);
      await client.testSchemaAccess();
      return true;
    } catch (error) {
      return false;
    }
  }

  async ensureStorageBucket(options) {
    const projectUrl = this.normalizeProjectUrl(options.url);
    const serviceRoleKey = String(options.serviceRoleKey || '').trim();
    const bucketName = this.normalizeBucketName(options.bucketName, this.getDefaultResourceNames().bucketName);

    if (!serviceRoleKey) {
      throw new Error('请填写 Service Role Key');
    }

    const client = this.createServiceClient(projectUrl, serviceRoleKey);
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    if (listError) {
      throw new Error(`读取 Storage Buckets 失败: ${listError.message}`);
    }

    const existingBucket = (buckets || []).find((bucket) => bucket.id === bucketName || bucket.name === bucketName);
    if (existingBucket) {
      return {
        created: false,
        bucket: existingBucket,
        bucketName
      };
    }

    const { data, error } = await client.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    });

    if (error) {
      const errorMessage = String(error.message || '创建 Storage Bucket 失败');
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        return {
          created: false,
          bucket: null,
          bucketName
        };
      }

      throw new Error(`创建 Storage Bucket 失败: ${errorMessage}`);
    }

    return {
      created: true,
      bucket: data || null,
      bucketName
    };
  }

  async saveExistingProjectProfile(input) {
    const existingProfile = await this.getProfile();
    const projectUrl = this.normalizeProjectUrl(input.url ?? existingProfile?.url ?? '');
    if (!projectUrl) {
      throw new Error('请填写 Project URL');
    }

    const now = new Date().toISOString();
    const nextProfile = {
      url: projectUrl,
      projectRef: String(
        input.projectRef
        ?? existingProfile?.projectRef
        ?? this.deriveProjectRef(projectUrl)
      ).trim(),
      bucketName: this.normalizeBucketName(
        input.bucketName
        ?? existingProfile?.bucketName
        ?? this.getDefaultResourceNames().bucketName,
        this.getDefaultResourceNames().bucketName
      ),
      initialized: typeof input.initialized === 'boolean'
        ? input.initialized
        : !!existingProfile?.initialized,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now,
      lastInitializedAt: input.lastInitializedAt ?? existingProfile?.lastInitializedAt ?? null,
      lastConnectedAt: input.lastConnectedAt ?? existingProfile?.lastConnectedAt ?? null
    };

    await this.saveProfile(nextProfile);
    return nextProfile;
  }

  async initializeProjectResources(input) {
    const projectUrl = this.normalizeProjectUrl(input.url);
    const projectRef = String(input.projectRef || this.deriveProjectRef(projectUrl)).trim();
    const managementToken = String(input.managementToken || '').trim();
    const serviceRoleKey = String(input.serviceRoleKey || '').trim();
    const bucketName = this.normalizeBucketName(input.bucketName, this.getDefaultResourceNames().bucketName);
    const saveAdminSecrets = !!input.saveAdminSecrets;

    if (!projectUrl) {
      throw new Error('请填写 Project URL');
    }

    if (!projectRef) {
      throw new Error('无法识别 Project Ref，请手动填写');
    }

    if (!managementToken) {
      throw new Error('请填写 Personal Access Token');
    }

    if (!serviceRoleKey) {
      throw new Error('请填写 Service Role Key');
    }

    const sql = String(
      input.sql
      || (typeof SupabaseClient !== 'undefined' ? new SupabaseClient().getTableCreationSQL() : '')
    ).trim();
    if (!sql) {
      throw new Error('初始化 SQL 为空');
    }

    const apiClient = new SupabaseManagementApiClient(managementToken);
    await apiClient.getProject(projectRef);
    const sqlResult = await apiClient.executeSql(projectRef, sql);
    const bucketResult = await this.ensureStorageBucket({
      url: projectUrl,
      serviceRoleKey,
      bucketName
    });

    const initializedAt = new Date().toISOString();
    const profile = await this.saveExistingProjectProfile({
      url: projectUrl,
      projectRef,
      bucketName,
      initialized: true,
      lastInitializedAt: initializedAt,
      lastConnectedAt: initializedAt
    });

    await this.savePreferences({ saveAdminSecrets });
    await this.setSavedAdminSecrets({ serviceRoleKey, managementToken }, saveAdminSecrets);

    return {
      profile,
      sqlResult,
      bucketResult
    };
  }
}

window.supabaseResourceManager = new SupabaseResourceManager();
