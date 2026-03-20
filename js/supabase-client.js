/**
 * Supabase客户端管理器
 * 处理与Supabase的连接和数据同步
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = null;
    this.tableName = 'card_tab_data';
    this.userId = null;
    this.currentConfigHash = null; // 用于检测配置变化
  }

  /**
   * 生成配置哈希值，用于检测配置是否变化
   */
  generateConfigHash(config) {
    return `${config.url}|${config.anonKey}`;
  }

  /**
   * 检查是否需要重新初始化
   */
  needsReinitialization(config) {
    const newHash = this.generateConfigHash(config);
    return !this.client || this.currentConfigHash !== newHash;
  }

  /**
   * 初始化Supabase连接
   * @param {Object} config - Supabase配置
   * @param {string} config.url - Supabase项目URL
   * @param {string} config.anonKey - Supabase匿名密钥
   * @param {string} config.userId - 用户唯一标识
   * @param {boolean} shouldTest - 是否测试连接（默认false，用于性能优化）
   */
  async initialize(config, shouldTest = false) {
    try {
      // 检查是否需要重新初始化
      if (!this.needsReinitialization(config)) {
        console.log('Supabase客户端配置未变化，跳过重新初始化');
        if (shouldTest && this.isConnected) {
          // 如果需要测试连接且当前已连接，直接返回成功
          console.log('Supabase客户端已连接，跳过连接测试');
          return true;
        } else if (shouldTest) {
          // 需要测试但未连接，执行连接测试
          await this.testConnection();
          console.log('Supabase连接测试成功');
          return true;
        }
        return true;
      }

      // 如果配置发生变化，先断开现有连接
      if (this.client) {
        console.log('Supabase配置已变化，断开现有连接');
        this.disconnect();
      }

      this.config = config;
      this.currentConfigHash = this.generateConfigHash(config);

      // 检查Supabase SDK是否已加载
      if (!globalThis.supabase) {
        throw new Error('Supabase SDK未加载，请确保supabase.min.js已正确加载');
      }

      // 创建Supabase客户端
      this.client = globalThis.supabase.createClient(config.url, config.anonKey);

      if (shouldTest) {
        // 需要验证连接（配置切换、用户手动测试等场景）
        await this.testConnection();
        console.log('Supabase客户端已初始化并验证连接成功');
      } else {
        // 快速初始化，延迟验证（页面加载等场景）
        this.isConnected = true; // 乐观假设连接成功
        console.log('Supabase客户端已初始化（延迟连接验证）');
      }

      return true;
    } catch (error) {
      console.error('Supabase客户端初始化失败:', error);
      this.isConnected = false;
      this.currentConfigHash = null;
      throw error;
    }
  }



  /**
   * 判断是否是连接相关错误
   * @param {Object} error - 错误对象
   * @returns {boolean} 是否是连接错误
   */
  isConnectionError(error) {
    if (!error) return false;

    // 常见的连接错误标识
    const connectionErrorCodes = ['PGRST116', '42P01', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    const connectionErrorMessages = [
      'relation', 'does not exist', 'network', 'connection', 'timeout',
      'unreachable', 'refused', 'invalid', 'unauthorized'
    ];

    // 检查错误代码
    if (error.code && connectionErrorCodes.includes(error.code)) {
      return true;
    }

    // 检查错误消息
    if (error.message) {
      const message = error.message.toLowerCase();
      return connectionErrorMessages.some(keyword => message.includes(keyword));
    }

    return false;
  }

  /**
   * 测试Supabase连接（手动调用）
   * 注意：此方法不在初始化时自动调用，只用于用户手动测试
   */
  async testConnection() {
    if (!this.client) {
      throw new Error('Supabase客户端未初始化');
    }

    try {
      // 尝试查询数据表
      // 测试用固定的查询条件
      const { data, error } = await this.client
        .from(this.tableName)
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          // 表不存在
          throw new Error('数据表不存在，请先在Supabase中创建表结构');
        } else if (error.code === '42P01') {
          // PostgreSQL: relation does not exist
          throw new Error('数据表不存在，请先在Supabase中创建表结构');
        } else {
          // 其他错误
          throw new Error(`数据库连接测试失败: ${error.message}`);
        }
      }

      // 连接成功
      this.isConnected = true;
      console.log('Supabase连接测试成功');
    } catch (error) {
      this.isConnected = false;
      console.error('Supabase连接测试失败:', error);
      throw error;
    }
  }

  /**
   * 列出所有主题元数据
   * @param {string} userId - 用户 ID（默认 '1'）
   * @returns {Array} 主题列表
   */
  async listThemes(userId = '1') {
    if (!this.isConnected) {
      throw new Error('Supabase 未连接');
    }

    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('theme_id, theme_name, theme_type, bg_image_url, bg_image_path, bg_opacity, is_active, updated_at')
        .eq('user_id', userId);

      if (error) throw error;
      
      // Map keys to camelCase
      return (data || []).map(row => ({
        theme_id: row.theme_id,
        theme_name: row.theme_name,
        theme_type: row.theme_type,
        bg_image_url: row.bg_image_url,
        bg_image_path: row.bg_image_path,
        bg_opacity: row.bg_opacity,
        is_active: row.is_active,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Supabase 获取主题列表失败:', error);
      throw error;
    }
  }

  /**
   * 保存特定主题的数据
   */
  async saveData(themeId, data, themeMeta = {}, userId = '1') {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      const record = {
        user_id: userId,
        theme_id: themeId,
        theme_name: themeMeta.themeName || '',
        theme_type: themeMeta.themeType || 'default',
        bg_image_url: themeMeta.bgImageUrl || null,
        bg_image_path: themeMeta.bgImagePath || null,
        bg_opacity: themeMeta.bgOpacity ?? 30,
        is_active: themeMeta.isActive ?? 0,
        data: data,
        updated_at: new Date().toISOString()
      };

      // 使用 upsert，基于 user_id 和 theme_id
      const { error } = await this.client
        .from(this.tableName)
        .upsert(record, {
          onConflict: 'user_id,theme_id'
        });

      if (error) {
        if (this.isConnectionError(error)) {
          this.isConnected = false;
          throw new Error(`Supabase连接失败: ${error.message}`);
        }
        throw error;
      }

      console.log('数据已保存到Supabase, themeId:', themeId);
    } catch (error) {
      console.error('Supabase保存失败:', error);
      throw error;
    }
  }

  /**
   * 从Supabase加载指定主题数据
   */
  async loadData(themeId, userId = '1') {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('theme_id', themeId)
        .maybeSingle();

      if (error) {
        if (this.isConnectionError(error)) {
          this.isConnected = false;
          throw new Error(`Supabase连接失败: ${error.message}`);
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // 组装返回结构（符合 UnifiedDataManager 期望的格式）
      const result = {
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

      return result;
    } catch (error) {
      console.error('Supabase加载失败:', error);
      throw error;
    }
  }

  /**
   * 删除主题数据
   */
  async deleteThemeData(themeId, userId = '1') {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('user_id', userId)
      .eq('theme_id', themeId);

    if (error) throw error;

    console.log(`主题 ${themeId} 已从Supabase删除`);
    return { success: true };
  }

  /**
   * 查询所有数据（用于调试和管理）
   */
  async getAllData() {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * 分页查询数据（用于配置管理）
   * @param {number} page - 页码（从1开始）
   * @param {number} pageSize - 每页数量
   * @param {string} orderBy - 排序字段，默认为 'updated_at'
   * @param {boolean} ascending - 是否升序，默认为false（降序）
   */
  async getDataWithPagination(page = 1, pageSize = 10, orderBy = 'updated_at', ascending = false) {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      // 计算偏移量
      const offset = (page - 1) * pageSize;

      // 查询数据
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .order(orderBy, { ascending })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('SupabaseClient: 分页查询失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据总数（用于分页计算）
   */
  async getDataCount() {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      const { count, error } = await this.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('SupabaseClient: 获取数据总数失败:', error);
      throw error;
    }
  }

  /**
   * 查询特定用户的数据（用于调试）
   */
  async getUserData(userId) {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }



  /**
   * 检查客户端状态
   */
  getClientStatus() {
    return {
      isConnected: this.isConnected,
      hasClient: !!this.client,
      currentConfig: this.config ? {
        url: this.config.url,
        userId: this.config.userId,
        hasAnonKey: !!this.config.anonKey
      } : null,
      configHash: this.currentConfigHash
    };
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.client) {
      try {
        // 尝试清理 GoTrueClient 实例
        if (this.client.auth && typeof this.client.auth.stopAutoRefresh === 'function') {
          this.client.auth.stopAutoRefresh();
        }

        // 清理实时订阅
        if (this.client.removeAllChannels && typeof this.client.removeAllChannels === 'function') {
          this.client.removeAllChannels();
        }
      } catch (error) {
        console.warn('Supabase客户端清理时出现警告:', error);
      }
    }

    this.client = null;
    this.isConnected = false;
    this.config = null;
    this.userId = null;
    this.currentConfigHash = null;
    console.log('Supabase连接已断开并清理');
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      config: this.config,
      userId: this.userId
    };
  }

  /**
   * 清理文件名，移除特殊字符和中文字符
   * @param {string} fileName - 原始文件名
   * @returns {string} 清理后的文件名
   */
  sanitizeFileName(fileName) {
    // 获取文件扩展名
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

    // 清理文件名：
    // 1. 移除或替换特殊字符
    // 2. 中文字符转换为拼音或移除
    // 3. 空格替换为下划线
    // 4. 括号等特殊符号移除
    let cleanName = name
      .replace(/[\u4e00-\u9fff]/g, '') // 移除中文字符
      .replace(/[^\w\-_.]/g, '_')      // 特殊字符替换为下划线
      .replace(/_{2,}/g, '_')          // 多个下划线合并为一个
      .replace(/^_+|_+$/g, '')         // 移除开头和结尾的下划线
      .toLowerCase();                  // 转换为小写

    // 如果清理后的名称为空，使用默认名称
    if (!cleanName) {
      cleanName = 'image';
    }

    // 限制文件名长度
    if (cleanName.length > 50) {
      cleanName = cleanName.substring(0, 50);
    }

    return cleanName + extension;
  }

  /**
   * 上传文件到Supabase Storage
   * @param {File} file - 要上传的文件
   * @param {string} bucket - 存储桶名称
   * @param {string} themeId - 主题标识，用于隔离存储路径
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(file, bucket = 'backgrounds', themeId = 'default') {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      // 生成文件路径，使用清理后的文件名
      const cleanFileName = this.sanitizeFileName(file.name);
      const fileName = `${themeId}/${Date.now()}_${cleanFileName}`;

      // 上传文件
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        throw error;
      }

      // 获取公共URL
      const { data: urlData } = this.client.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return {
        success: true,
        path: fileName,
        url: urlData.publicUrl
      };
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 删除Supabase Storage中的文件
   * @param {string} bucket - 存储桶名称
   * @param {string} path - 文件路径
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(bucket = 'backgrounds', path) {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('文件删除失败:', error);
      throw error;
    }
  }

  /**
   * 生成数据表创建SQL
   */
  getTableCreationSQL() {
    return `
-- =====================================================
-- Quick Tab Chrome扩展 - Supabase简化初始化脚本
-- =====================================================
-- 请在Supabase项目的SQL编辑器中执行以下脚本

-- 1. 创建数据表（禁用RLS以避免权限问题）
-- =====================================================
CREATE TABLE IF NOT EXISTS ${this.tableName} (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '1',
  theme_id TEXT NOT NULL,
  theme_name TEXT DEFAULT '',
  theme_type TEXT DEFAULT 'default',
  bg_image_url TEXT,
  bg_image_path TEXT,
  bg_opacity INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 0,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, theme_id)
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user_id ON ${this.tableName}(user_id);
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_theme_id ON ${this.tableName}(theme_id);

-- 禁用行级安全策略（简化配置，适合个人使用）
ALTER TABLE ${this.tableName} DISABLE ROW LEVEL SECURITY;

-- 2. 创建Storage存储桶
-- =====================================================
-- 创建backgrounds桶（用于存储背景图片）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  52428800,  -- 50MB限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage桶已创建，使用默认权限设置

-- 3. 验证配置
-- =====================================================
-- 检查数据表是否创建成功
SELECT 'Data table created successfully' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${this.tableName}');

-- 检查存储桶是否创建成功
SELECT 'Storage bucket created successfully' as status
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'backgrounds');

-- =====================================================
-- 配置完成！
-- =====================================================
-- 现在您可以：
-- 1. 返回Chrome扩展
-- 2. 配置Supabase连接信息
-- 3. 测试连接和同步功能
-- 4. 使用背景图片和多配置功能
--
-- 注意事项：
-- - 此配置适合个人使用，已禁用RLS简化设置
-- - 数据通过user_id字段进行区分
-- - 背景图片存储在backgrounds桶中
-- - 如需更高安全性，请参考文档配置RLS策略
    `.trim();
  }
}

// 创建全局实例
const supabaseClient = new SupabaseClient();
globalThis.supabaseClient = supabaseClient;
