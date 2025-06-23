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
  }

  /**
   * 初始化Supabase连接
   * @param {Object} config - Supabase配置
   * @param {string} config.url - Supabase项目URL
   * @param {string} config.anonKey - Supabase匿名密钥
   * @param {string} config.userId - 用户唯一标识
   */
  async initialize(config) {
    try {
      this.config = config;
      this.userId = config.userId;

      // 检查Supabase SDK是否已加载
      if (!window.supabase) {
        throw new Error('Supabase SDK未加载，请确保supabase.min.js已正确加载');
      }

      // 创建Supabase客户端
      this.client = window.supabase.createClient(config.url, config.anonKey);
      
      // 测试连接
      await this.testConnection();
      
      this.isConnected = true;
      console.log('Supabase连接成功');
      return true;
    } catch (error) {
      console.error('Supabase连接失败:', error);
      this.isConnected = false;
      throw error;
    }
  }



  /**
   * 测试Supabase连接
   */
  async testConnection() {
    if (!this.client) {
      throw new Error('Supabase客户端未初始化');
    }

    try {
      // 尝试查询数据表
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
      console.log('Supabase连接测试成功');
    } catch (error) {
      console.error('Supabase连接测试失败:', error);
      throw error;
    }
  }

  /**
   * 保存数据到Supabase
   * @param {Object} data - 要保存的数据
   */
  async saveData(data) {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    const record = {
      user_id: this.userId,
      data: data,
      updated_at: new Date().toISOString()
    };

    // 使用 upsert 操作，更简洁和可靠
    const { error } = await this.client
      .from(this.tableName)
      .upsert(record, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Supabase保存失败:', error);
      throw error;
    }

    console.log('数据已保存到Supabase');
  }

  /**
   * 从Supabase加载数据
   */
  async loadData() {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .select('data, updated_at')
      .eq('user_id', this.userId)
      .maybeSingle(); // 使用 maybeSingle() 而不是 single()

    if (error) {
      throw error;
    }

    // 如果没有数据，返回 null
    if (!data) {
      return null;
    }

    return data;
  }

  /**
   * 删除用户数据
   */
  async deleteData() {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('user_id', this.userId);

    if (error) {
      throw error;
    }

    console.log('用户数据已从Supabase删除');
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
   * 删除当前用户的数据
   */
  async deleteData() {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      console.log('SupabaseClient: 删除用户数据:', this.userId);

      const { error } = await this.client
        .from('card_tab_data')
        .delete()
        .eq('user_id', this.userId);

      if (error) {
        console.error('SupabaseClient: 删除数据失败:', error);
        throw error;
      }

      console.log('SupabaseClient: 用户数据删除成功');
    } catch (error) {
      console.error('SupabaseClient: 删除数据异常:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.client = null;
    this.isConnected = false;
    this.config = null;
    this.userId = null;
    console.log('Supabase连接已断开');
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
   * 上传文件到Supabase Storage
   * @param {File} file - 要上传的文件
   * @param {string} bucket - 存储桶名称
   * @param {string} path - 文件路径
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(file, bucket = 'backgrounds', path = null) {
    if (!this.isConnected) {
      throw new Error('Supabase未连接');
    }

    try {
      // 生成文件路径
      const fileName = path || `${this.userId}/${Date.now()}_${file.name}`;

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
  user_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user_id ON ${this.tableName}(user_id);
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_updated_at ON ${this.tableName}(updated_at);

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
window.supabaseClient = supabaseClient;
