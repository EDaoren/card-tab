class CloudflareManagementApiClient {
  constructor(accountId, apiToken) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.apiBaseUrl = 'https://api.cloudflare.com/client/v4';
    this.compatibilityDate = '2024-10-01';
  }

  buildErrorMessage(payload, fallbackMessage) {
    return payload?.errors?.map(item => item.message).filter(Boolean).join('；')
      || payload?.messages?.map(item => item.message).filter(Boolean).join('；')
      || fallbackMessage;
  }

  async requestRaw(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${this.apiToken}`);
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
    const { response: rawResponse, payload: rawPayload, text: rawText } = await this.requestRaw(path, init);
    if (!rawResponse.ok || !rawPayload?.success) {
      const errorMessage = this.buildErrorMessage(
        rawPayload,
        rawText || `Cloudflare API 请求失败 (${rawResponse.status})`
      );
      throw new Error(errorMessage);
    }

    return rawPayload.result ?? rawPayload;

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${this.apiToken}`);
    headers.set('Accept', 'application/json');

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      const errorMessage = payload?.errors?.map(item => item.message).filter(Boolean).join('；')
        || payload?.messages?.map(item => item.message).filter(Boolean).join('；')
        || `Cloudflare API 请求失败 (${response.status})`;
      throw new Error(errorMessage);
    }

    return payload.result ?? payload;
  }

  async tryRequest(path, init = {}) {
    const { response, payload, text } = await this.requestRaw(path, init);
    const ok = response.ok && (payload === null || payload.success !== false);

    return {
      ok,
      status: response.status,
      result: ok ? (payload?.result ?? payload ?? null) : null,
      errorMessage: ok
        ? ''
        : this.buildErrorMessage(payload, text || `Cloudflare API 请求失败 (${response.status})`)
    };
  }

  async getWorkersSubdomain() {
    const result = await this.request(`/accounts/${this.accountId}/workers/subdomain`, {
      method: 'GET'
    });
    const subdomain = result?.subdomain || result?.name || '';

    if (!subdomain) {
      throw new Error('无法获取 workers.dev 子域名，请先在 Cloudflare 控制台启用 workers.dev');
    }

    return subdomain;
  }

  async createD1Database(name) {
    return this.request(`/accounts/${this.accountId}/d1/database`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async createR2Bucket(name) {
    return this.request(`/accounts/${this.accountId}/r2/buckets`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async deployWorkerScript(scriptName, sourceCode, bindings) {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'worker.js',
      compatibility_date: this.compatibilityDate,
      bindings
    }));
    formData.append(
      'worker.js',
      new Blob([sourceCode], { type: 'application/javascript+module' }),
      'worker.js'
    );

    return this.request(`/accounts/${this.accountId}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      body: formData
    });
  }

  async activateWorkerSubdomain(scriptName) {
    const body = JSON.stringify({
      enabled: true,
      previews_enabled: true
    });
    const attempts = [
      {
        method: 'POST',
        path: `/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`
      },
      {
        method: 'PATCH',
        path: `/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`
      },
      {
        method: 'POST',
        path: `/accounts/${this.accountId}/workers/services/${scriptName}/environments/production/subdomain`
      },
      {
        method: 'PATCH',
        path: `/accounts/${this.accountId}/workers/services/${scriptName}/environments/production/subdomain`
      }
    ];
    let lastErrorMessage = '';

    for (const attempt of attempts) {
      const result = await this.tryRequest(attempt.path, {
        method: attempt.method,
        body
      });

      if (result.ok) {
        return {
          activated: true,
          result: result.result,
          endpoint: `${attempt.method} ${attempt.path}`
        };
      }

      lastErrorMessage = result.errorMessage || `${attempt.method} ${attempt.path} (${result.status})`;
    }

    return {
      activated: false,
      errorMessage: lastErrorMessage || '未知错误'
    };
  }
}

class CloudflareSetupManager {
  constructor() {
    this.storageKeys = {
      profile: 'card_tab_cf_setup_profile',
      apiToken: 'card_tab_cf_setup_api_token',
      preferences: 'card_tab_cf_setup_preferences'
    };
    this.defaultPreferences = {
      autoSetupEnabled: true,
      saveApiToken: false
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

  async getSavedApiToken() {
    const result = await this.getLocalStorage([this.storageKeys.apiToken]);
    return result[this.storageKeys.apiToken] || '';
  }

  async setSavedApiToken(apiToken, shouldSave) {
    if (shouldSave && apiToken) {
      await this.setLocalStorage({ [this.storageKeys.apiToken]: apiToken });
      return apiToken;
    }

    await this.removeLocalStorage([this.storageKeys.apiToken]);
    return '';
  }

  async getSetupState() {
    const [profile, preferences, savedApiToken] = await Promise.all([
      this.getProfile(),
      this.getPreferences(),
      this.getSavedApiToken()
    ]);

    return {
      profile,
      preferences,
      savedApiToken
    };
  }

  async clearSetupCache(options = {}) {
    const shouldClearApiToken = options.clearApiToken !== false;
    const keys = [this.storageKeys.profile];

    if (shouldClearApiToken) {
      keys.push(this.storageKeys.apiToken);
    }

    await this.removeLocalStorage(keys);
    return true;
  }

  sanitizeName(value, fallback = 'card-tab', maxLength = 55) {
    const normalized = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, maxLength);

    return normalized || fallback;
  }

  sanitizeBucketName(value, fallback = 'card-tab-files') {
    return this.sanitizeName(value, fallback, 63);
  }

  getDefaultResourceNames() {
    return {
      workerName: 'card-tab-sync',
      databaseName: 'card-tab-db',
      bucketName: 'card-tab-files'
    };
  }

  buildResourceNames(options = {}) {
    const defaults = this.getDefaultResourceNames();

    return {
      workerName: this.sanitizeName(options.workerName, defaults.workerName, 60),
      databaseName: this.sanitizeName(options.databaseName, defaults.databaseName, 60),
      bucketName: this.sanitizeBucketName(options.bucketName, defaults.bucketName)
    };
  }

  generateWorkerAccessToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);

    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  async loadBundledSyncWorkerSource() {
    const resourceUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL('cf-worker.js') : 'cf-worker.js';
    const response = await fetch(resourceUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('读取同步 Worker 模板失败');
    }

    return response.text();
  }

  async requestWorker(profile, method, path) {
    const workerUrl = String(profile?.workerUrl || '').trim().replace(/\/+$/, '');
    if (!workerUrl) {
      throw new Error('缺少 Worker URL');
    }

    const headers = {};
    if (profile?.accessToken) {
      headers.Authorization = `Bearer ${profile.accessToken}`;
    }

    const response = await fetch(`${workerUrl}${path}`, {
      method,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `请求失败 (${response.status})`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json().catch(() => ({ ok: true }));
  }

  async testWorkerConnection(profile) {
    const result = await this.requestWorker(profile, 'GET', '/api/ping');

    const savedProfile = await this.getProfile();
    if (savedProfile?.workerUrl && savedProfile.workerUrl === profile.workerUrl) {
      savedProfile.lastConnectedAt = new Date().toISOString();
      savedProfile.updatedAt = savedProfile.lastConnectedAt;
      await this.saveProfile(savedProfile);
    }

    return result;
  }

  async waitForWorkerReady(profile, maxAttempts = 8) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.testWorkerConnection(profile);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    throw new Error(`同步 Worker 已创建，但尚未就绪：${lastError?.message || '未知错误'}`);
  }

  extractWorkersSubdomain(workerUrl) {
    try {
      const parts = new URL(workerUrl).hostname.split('.');
      if (parts.length >= 4 && parts.slice(-2).join('.') === 'workers.dev') {
        return parts[parts.length - 3];
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  async createResources(options) {
    const accountId = String(options.accountId || '').trim();
    const apiToken = String(options.apiToken || '').trim();
    const saveApiToken = !!options.saveApiToken;

    if (!accountId) {
      throw new Error('请填写 Cloudflare Account ID');
    }

    if (!apiToken) {
      throw new Error('请填写 Cloudflare API Token');
    }

    const names = this.buildResourceNames({
      workerName: options.createWorkerName || options.workerName,
      databaseName: options.createDatabaseName || options.databaseName,
      bucketName: options.createBucketName || options.bucketName
    });
    const accessToken = String(options.workerAccessToken || '').trim() || this.generateWorkerAccessToken();
    const sourceCode = await this.loadBundledSyncWorkerSource();
    const apiClient = new CloudflareManagementApiClient(accountId, apiToken);
    const workersSubdomain = await apiClient.getWorkersSubdomain();
    const database = await apiClient.createD1Database(names.databaseName);
    const databaseId = database?.uuid || database?.id || database?.database_id || '';

    if (!databaseId) {
      throw new Error('D1 数据库已创建，但未返回数据库 ID');
    }

    await apiClient.createR2Bucket(names.bucketName);
    await apiClient.deployWorkerScript(names.workerName, sourceCode, [
      {
        type: 'd1',
        name: 'DB',
        id: databaseId
      },
      {
        type: 'r2_bucket',
        name: 'BUCKET',
        bucket_name: names.bucketName
      },
      {
        type: 'plain_text',
        name: 'ACCESS_TOKEN',
        text: accessToken
      }
    ]);
    const activationResult = await apiClient.activateWorkerSubdomain(names.workerName);

    const workerUrl = `https://${names.workerName}.${workersSubdomain}.workers.dev`;
    const now = new Date().toISOString();
    const profile = {
      source: 'auto',
      accountId,
      baseName: '',
      workerName: names.workerName,
      workerUrl,
      accessToken,
      databaseId,
      databaseName: names.databaseName,
      bucketName: names.bucketName,
      workersSubdomain,
      initialized: false,
      createdAt: now,
      updatedAt: now
    };

    try {
      await this.waitForWorkerReady(profile);
    } catch (error) {
      if (!activationResult.activated && activationResult.errorMessage) {
        throw new Error(`同步 Worker 已创建，但尚未就绪：${error.message}；自动激活 workers.dev / 预览 URL 也失败：${activationResult.errorMessage}`);
      }

      throw error;
    }

    await this.saveProfile(profile);
    await this.savePreferences({ autoSetupEnabled: true, saveApiToken });
    await this.setSavedApiToken(apiToken, saveApiToken);

    return profile;
  }

  async saveExistingResourceProfile(input) {
    const workerUrl = String(input.workerUrl || '').trim();
    if (!workerUrl) {
      throw new Error('请填写 Worker URL');
    }

    const existingProfile = await this.getProfile();
    const now = new Date().toISOString();
    const nextProfile = {
      source: input.source || existingProfile?.source || 'manual',
      accountId: String(input.accountId ?? existingProfile?.accountId ?? '').trim(),
      baseName: String(input.baseName ?? existingProfile?.baseName ?? '').trim(),
      workerName: String(input.workerName ?? existingProfile?.workerName ?? '').trim(),
      workerUrl,
      accessToken: String(input.accessToken ?? existingProfile?.accessToken ?? '').trim(),
      databaseId: String(input.databaseId ?? existingProfile?.databaseId ?? '').trim(),
      databaseName: String(input.databaseName ?? existingProfile?.databaseName ?? '').trim(),
      bucketName: String(input.bucketName ?? existingProfile?.bucketName ?? '').trim(),
      workersSubdomain: String(
        input.workersSubdomain
        ?? existingProfile?.workersSubdomain
        ?? this.extractWorkersSubdomain(workerUrl)
      ).trim(),
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

  async initializeDatabase(profileInput = null) {
    const profile = profileInput || await this.getProfile();
    if (!profile?.workerUrl) {
      throw new Error('请先创建或填写 Worker 连接参数');
    }

    const result = await this.requestWorker(profile, 'POST', '/api/init');
    const nextProfile = {
      ...profile,
      initialized: true,
      lastInitializedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.saveProfile(nextProfile);

    return {
      profile: nextProfile,
      result
    };
  }
}

window.cloudflareSetupManager = new CloudflareSetupManager();
