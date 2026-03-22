/**
 * Supabase client for Card Tab.
 * Handles project connectivity, BYOS API-key sync, and Storage uploads.
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = null;
    this.tableName = 'card_tab_data';
    this.userId = null;
    this.currentConfigHash = null;
  }

  static getSharedInstance() {
    if (!(globalThis.supabaseClient instanceof SupabaseClient)) {
      globalThis.supabaseClient = new SupabaseClient();
    }

    return globalThis.supabaseClient;
  }

  static getTableCreationSQL(bucketName = 'backgrounds') {
    return SupabaseClient.getSharedInstance().getTableCreationSQL(bucketName);
  }

  generateConfigHash(config) {
    return `${config.url}|${config.anonKey}|${config.bucketName || 'backgrounds'}`;
  }

  normalizeProjectUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  createClientOptions() {
    return {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    };
  }

  buildRestHeaders(apiKey) {
    return {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`
    };
  }

  needsReinitialization(config) {
    const newHash = this.generateConfigHash(config);
    return !this.client || this.currentConfigHash !== newHash;
  }

  getProjectScopeId() {
    return 'card-tab';
  }

  getBucketName() {
    return String(this.config?.bucketName || 'backgrounds')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-') || 'backgrounds';
  }

  resolveUserId(userId = null) {
    const resolvedUserId = String(userId || this.userId || this.getProjectScopeId()).trim() || this.getProjectScopeId();
    this.userId = resolvedUserId;
    return resolvedUserId;
  }

  async initialize(config, shouldTest = false) {
    try {
      const normalizedConfig = {
        ...config,
        url: this.normalizeProjectUrl(config?.url),
        anonKey: String(config?.anonKey || '').trim(),
        bucketName: String(config?.bucketName || 'backgrounds')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '-') || 'backgrounds'
      };

      if (!normalizedConfig.url || !normalizedConfig.anonKey) {
        throw new Error('Supabase 配置不完整');
      }

      if (!this.needsReinitialization(normalizedConfig)) {
        this.userId = this.getProjectScopeId();

        if (shouldTest) {
          await this.testConnection();
        }

        return true;
      }

      if (!globalThis.supabase?.createClient) {
        throw new Error('Supabase SDK未加载，请确保 supabase.min.js 已正确加载');
      }

      if (this.client) {
        this.disconnect();
      }

      this.config = normalizedConfig;
      this.currentConfigHash = this.generateConfigHash(normalizedConfig);
      this.client = globalThis.supabase.createClient(
        normalizedConfig.url,
        normalizedConfig.anonKey,
        this.createClientOptions(normalizedConfig)
      );
      this.userId = this.getProjectScopeId();
      this.isConnected = true;

      if (shouldTest) {
        await this.testConnection();
      }

      return true;
    } catch (error) {
      console.error('Supabase client initialization failed:', error);
      this.isConnected = false;
      this.currentConfigHash = null;
      throw error;
    }
  }

  isConnectionError(error) {
    if (!error) {
      return false;
    }

    const connectionErrorCodes = ['PGRST116', '42P01', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    const connectionErrorMessages = [
      'relation',
      'does not exist',
      'network',
      'connection',
      'timeout',
      'unreachable',
      'refused',
      'invalid',
      'unauthorized'
    ];

    if (error.code && connectionErrorCodes.includes(error.code)) {
      return true;
    }

    if (error.message) {
      const message = error.message.toLowerCase();
      return connectionErrorMessages.some((keyword) => message.includes(keyword));
    }

    return false;
  }

  async testProjectAccess() {
    try {
      const result = await this.testProjectAccessWithConfig(this.config);
      this.isConnected = true;
      return result;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  async testProjectAccessWithConfig(config = null) {
    const projectUrl = this.normalizeProjectUrl(config?.url || this.config?.url);
    const anonKey = String(config?.anonKey || this.config?.anonKey || '').trim();
    if (!projectUrl || !anonKey) {
      throw new Error('Supabase 配置不完整');
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
          headers: this.buildRestHeaders(anonKey)
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error('Supabase API Key 无效或无权限');
        }

        if (!response.ok && response.status !== 404) {
          const errorText = await response.text().catch(() => '');
          throw new Error(errorText || `Supabase 项目连接失败 (${response.status})`);
        }

        return {
          ok: true,
          projectUrl
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Supabase 项目连接失败');
  }

  async testSchemaAccess() {
    if (!this.config) {
      throw new Error('Supabase 客户端未初始化');
    }

    return this.testSchemaAccessWithConfig(this.config);
  }

  async testSchemaAccessWithConfig(config = null) {
    const projectUrl = this.normalizeProjectUrl(config?.url || this.config?.url);
    const anonKey = String(config?.anonKey || this.config?.anonKey || '').trim();
    if (!projectUrl || !anonKey) {
      throw new Error('Supabase 配置不完整');
    }

    const response = await fetch(
      `${projectUrl}/rest/v1/${this.tableName}?select=id&limit=1`,
      {
        method: 'GET',
        headers: this.buildRestHeaders(anonKey)
      }
    );
    const responseText = await response.text().catch(() => '');
    let payload = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        payload = null;
      }
    }

    if (!response.ok) {
      const errorMessage = payload?.message
        || payload?.error_description
        || payload?.details
        || responseText
        || `数据表访问失败 (${response.status})`;
      const normalizedMessage = `${payload?.code || ''} ${errorMessage}`.toLowerCase();

      if (
        payload?.code === 'PGRST116'
        || payload?.code === '42P01'
        || payload?.code === 'PGRST205'
        || normalizedMessage.includes('relation')
        || normalizedMessage.includes('does not exist')
      ) {
        throw new Error('数据表不存在，请先初始化资源');
      }

      throw new Error(`数据表访问失败: ${errorMessage}`);
    }

    return {
      ok: true,
      tableName: this.tableName
    };
  }

  async testConnectionWithConfig(config) {
    const project = await this.testProjectAccessWithConfig(config);
    await this.testSchemaAccessWithConfig(config);

    return {
      ok: true,
      projectUrl: project.projectUrl,
      scopeId: this.getProjectScopeId(),
      tableName: this.tableName
    };
  }

  async testConnection() {
    if (!this.client) {
      throw new Error('Supabase 客户端未初始化');
    }

    try {
      const project = await this.testProjectAccess();
      await this.testSchemaAccess();

      return {
        ...project,
        scopeId: this.resolveUserId()
      };
    } catch (error) {
      this.isConnected = false;
      console.error('Supabase connection test failed:', error);
      throw error;
    }
  }

  async listThemes(userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    const targetUserId = this.resolveUserId(userId);
    const { data, error } = await this.client
      .from(this.tableName)
      .select('theme_id, theme_name, theme_type, bg_image_url, bg_image_path, bg_opacity, is_active, updated_at')
      .eq('user_id', targetUserId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      theme_id: row.theme_id,
      theme_name: row.theme_name,
      theme_type: row.theme_type,
      bg_image_url: row.bg_image_url,
      bg_image_path: row.bg_image_path,
      bg_opacity: row.bg_opacity,
      is_active: row.is_active,
      updated_at: row.updated_at
    }));
  }

  async saveData(themeId, data, themeMeta = {}, userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    try {
      const targetUserId = this.resolveUserId(userId);
      const record = {
        user_id: targetUserId,
        theme_id: themeId,
        theme_name: themeMeta.themeName || '',
        theme_type: themeMeta.themeType || 'default',
        bg_image_url: themeMeta.bgImageUrl || null,
        bg_image_path: themeMeta.bgImagePath || null,
        bg_opacity: themeMeta.bgOpacity ?? 30,
        is_active: themeMeta.isActive ? 1 : 0,
        data,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from(this.tableName)
        .upsert(record, {
          onConflict: 'user_id,theme_id'
        });

      if (error) {
        if (this.isConnectionError(error)) {
          this.isConnected = false;
          throw new Error(`Supabase 连接失败: ${error.message}`);
        }
        throw error;
      }
    } catch (error) {
      console.error('Supabase save failed:', error);
      throw error;
    }
  }

  async loadData(themeId, userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    try {
      const targetUserId = this.resolveUserId(userId);
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('user_id', targetUserId)
        .eq('theme_id', themeId)
        .maybeSingle();

      if (error) {
        if (this.isConnectionError(error)) {
          this.isConnected = false;
          throw new Error(`Supabase 连接失败: ${error.message}`);
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        data: data.data,
        themeMeta: {
          themeName: data.theme_name,
          themeType: data.theme_type,
          bgImageUrl: data.bg_image_url,
          bgImagePath: data.bg_image_path,
          bgOpacity: data.bg_opacity,
          isActive: data.is_active,
          updatedAt: data.updated_at
        }
      };
    } catch (error) {
      console.error('Supabase load failed:', error);
      throw error;
    }
  }

  async deleteThemeData(themeId, userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    const targetUserId = this.resolveUserId(userId);
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('user_id', targetUserId)
      .eq('theme_id', themeId);

    if (error) {
      throw error;
    }

    return { success: true };
  }

  async getAllData(userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    const targetUserId = this.resolveUserId(userId);
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', targetUserId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async getDataWithPagination(page = 1, pageSize = 10, orderBy = 'updated_at', ascending = false, userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    const targetUserId = this.resolveUserId(userId);
    const offset = (page - 1) * pageSize;
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', targetUserId)
      .order(orderBy, { ascending })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    return data || [];
  }

  async getDataCount(userId = null) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    const targetUserId = this.resolveUserId(userId);
    const { count, error } = await this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  async getUserData(userId = null) {
    return this.getAllData(userId);
  }

  getClientStatus() {
    return {
      isConnected: this.isConnected,
      hasClient: !!this.client,
      currentConfig: this.config
        ? {
            url: this.config.url,
            hasAnonKey: !!this.config.anonKey,
            bucketName: this.config.bucketName || 'backgrounds'
          }
        : null,
      configHash: this.currentConfigHash
    };
  }

  disconnect() {
    if (this.client) {
      try {
        if (this.client.removeAllChannels && typeof this.client.removeAllChannels === 'function') {
          this.client.removeAllChannels();
        }
      } catch (error) {
        console.warn('Supabase client cleanup warning:', error);
      }
    }

    this.client = null;
    this.isConnected = false;
    this.config = null;
    this.userId = null;
    this.currentConfigHash = null;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      config: this.config,
      userId: this.userId
    };
  }

  sanitizeFileName(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

    let cleanName = name
      .replace(/[\u4e00-\u9fff]/g, '')
      .replace(/[^\w\-_.]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

    if (!cleanName) {
      cleanName = 'image';
    }

    if (cleanName.length > 50) {
      cleanName = cleanName.substring(0, 50);
    }

    return cleanName + extension;
  }

  async uploadFile(file, bucket = 'backgrounds', themeId = 'default') {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    const scopeId = this.resolveUserId();
    const cleanFileName = this.sanitizeFileName(file.name);
    const fileName = `${scopeId}/${themeId}/${Date.now()}_${cleanFileName}`;

    const { error } = await this.client.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = this.client.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      success: true,
      path: fileName,
      url: urlData?.publicUrl || ''
    };
  }

  async deleteFile(bucket = 'backgrounds', path) {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    if (!path) {
      return { success: true };
    }

    const { error } = await this.client.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw error;
    }

    return { success: true };
  }

  getTableCreationSQL(bucketName = 'backgrounds') {
    const normalizedBucketName = String(bucketName || 'backgrounds')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-') || 'backgrounds';

    return `
-- =====================================================
-- Card Tab - Supabase BYOS setup
-- Uses project-level API key access (no Supabase Auth required)
-- Recommended: dedicate one project to Card Tab
-- =====================================================

CREATE TABLE IF NOT EXISTS ${this.tableName} (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'card-tab',
  theme_id TEXT NOT NULL DEFAULT 'default',
  theme_name TEXT DEFAULT '',
  theme_type TEXT DEFAULT 'default',
  bg_image_url TEXT,
  bg_image_path TEXT,
  bg_opacity INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, theme_id)
);

ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS theme_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS theme_name TEXT DEFAULT '';
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS theme_type TEXT DEFAULT 'default';
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS bg_image_url TEXT;
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS bg_image_path TEXT;
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS bg_opacity INTEGER DEFAULT 30;
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 0;
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE ${this.tableName} ALTER COLUMN user_id SET DEFAULT 'card-tab';
ALTER TABLE ${this.tableName} ALTER COLUMN theme_id SET DEFAULT 'default';
ALTER TABLE ${this.tableName} ALTER COLUMN theme_name SET DEFAULT '';
ALTER TABLE ${this.tableName} ALTER COLUMN theme_type SET DEFAULT 'default';
ALTER TABLE ${this.tableName} ALTER COLUMN bg_opacity SET DEFAULT 30;
ALTER TABLE ${this.tableName} ALTER COLUMN is_active SET DEFAULT 0;
ALTER TABLE ${this.tableName} ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE ${this.tableName} ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE ${this.tableName} ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE ${this.tableName}
SET user_id = COALESCE(NULLIF(user_id, ''), 'card-tab'),
    theme_id = COALESCE(NULLIF(theme_id, ''), 'default');

ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS ${this.tableName}_user_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = '${this.tableName}_user_id_theme_id_key'
  ) THEN
    ALTER TABLE ${this.tableName}
    ADD CONSTRAINT ${this.tableName}_user_id_theme_id_key UNIQUE (user_id, theme_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user_id ON ${this.tableName}(user_id);
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_theme_id ON ${this.tableName}(theme_id);
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_updated_at ON ${this.tableName}(updated_at);

ALTER TABLE ${this.tableName} ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own card tab data" ON ${this.tableName};
DROP POLICY IF EXISTS "Users can insert own card tab data" ON ${this.tableName};
DROP POLICY IF EXISTS "Users can update own card tab data" ON ${this.tableName};
DROP POLICY IF EXISTS "Users can delete own card tab data" ON ${this.tableName};
DROP POLICY IF EXISTS "Card Tab can read data" ON ${this.tableName};
DROP POLICY IF EXISTS "Card Tab can insert data" ON ${this.tableName};
DROP POLICY IF EXISTS "Card Tab can update data" ON ${this.tableName};
DROP POLICY IF EXISTS "Card Tab can delete data" ON ${this.tableName};

CREATE POLICY "Card Tab can read data"
ON ${this.tableName}
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Card Tab can insert data"
ON ${this.tableName}
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Card Tab can update data"
ON ${this.tableName}
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Card Tab can delete data"
ON ${this.tableName}
FOR DELETE
TO anon, authenticated
USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '${normalizedBucketName}',
  '${normalizedBucketName}',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can read background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can upload background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can update background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can delete background objects" ON storage.objects;

CREATE POLICY "Card Tab can read background objects"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = '${normalizedBucketName}'
);

CREATE POLICY "Card Tab can upload background objects"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = '${normalizedBucketName}'
);

CREATE POLICY "Card Tab can update background objects"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (
  bucket_id = '${normalizedBucketName}'
)
WITH CHECK (
  bucket_id = '${normalizedBucketName}'
);

CREATE POLICY "Card Tab can delete background objects"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (
  bucket_id = '${normalizedBucketName}'
);

SELECT 'Card Tab Supabase BYOS setup complete' AS status;
    `.trim();
  }
}

const supabaseClient = SupabaseClient.getSharedInstance();
globalThis.SupabaseClient = SupabaseClient;
globalThis.supabaseClient = supabaseClient;
