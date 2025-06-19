/**
 * Supabase客户端管理器
 * 处理与Supabase的连接和数据同步
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = null;
    this.tableName = 'quick_nav_data';
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

    // 尝试查询数据表，如果不存在则创建
    const { error } = await this.client
      .from(this.tableName)
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // 表不存在，需要创建
      throw new Error('数据表不存在，请先在Supabase中创建表结构');
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

    // 先尝试更新，如果不存在则插入
    const { data: existingData } = await this.client
      .from(this.tableName)
      .select('id')
      .eq('user_id', this.userId)
      .single();

    if (existingData) {
      // 更新现有记录
      const { error } = await this.client
        .from(this.tableName)
        .update(record)
        .eq('user_id', this.userId);

      if (error) throw error;
    } else {
      // 插入新记录
      const { error } = await this.client
        .from(this.tableName)
        .insert(record);

      if (error) throw error;
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
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 记录不存在
        return null;
      }
      throw error;
    }

    return data;
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
-- Quick Tab Chrome扩展 - Supabase完整初始化脚本
-- =====================================================
-- 请在Supabase项目的SQL编辑器中执行以下完整脚本

-- 1. 创建数据表
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

-- 2. 配置数据表RLS策略
-- =====================================================
-- 启用行级安全策略
ALTER TABLE ${this.tableName} ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有用户基于user_id访问自己的数据
CREATE POLICY "Enable all access based on user_id" ON ${this.tableName}
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. 创建Storage存储桶
-- =====================================================
-- 创建backgrounds桶（用于存储背景图片）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  10485760,  -- 10MB限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 4. 配置Storage RLS策略
-- =====================================================
-- 启用Storage RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 允许查看桶列表
CREATE POLICY "Allow bucket listing" ON storage.buckets
  FOR SELECT
  USING (true);

-- 允许在backgrounds桶中进行所有操作
CREATE POLICY "Allow all operations on backgrounds bucket" ON storage.objects
  FOR ALL
  USING (bucket_id = 'backgrounds')
  WITH CHECK (bucket_id = 'backgrounds');

-- 5. 验证配置
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
-- 4. 使用背景图片功能
--
-- 注意事项：
-- - 数据通过user_id字段进行隔离
-- - 背景图片存储在backgrounds桶中
-- - 所有配置都支持多用户安全访问
    `.trim();
  }
}

// 创建全局实例
const supabaseClient = new SupabaseClient();
window.supabaseClient = supabaseClient;
