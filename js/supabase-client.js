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

      // 动态加载Supabase客户端
      if (!window.supabase) {
        await this.loadSupabaseSDK();
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
   * 动态加载Supabase SDK
   */
  async loadSupabaseSDK() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Supabase SDK'));
      document.head.appendChild(script);
    });
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
   * 生成数据表创建SQL
   */
  getTableCreationSQL() {
    return `
-- 在Supabase SQL编辑器中执行以下SQL创建数据表
CREATE TABLE IF NOT EXISTS ${this.tableName} (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user_id ON ${this.tableName}(user_id);
CREATE INDEX IF NOT EXISTS idx_${this.tableName}_updated_at ON ${this.tableName}(updated_at);

-- 启用行级安全策略（可选）
ALTER TABLE ${this.tableName} ENABLE ROW LEVEL SECURITY;

-- 创建策略允许用户访问自己的数据（可选）
CREATE POLICY "Users can access own data" ON ${this.tableName}
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));
    `.trim();
  }
}

// 创建全局实例
const supabaseClient = new SupabaseClient();
window.supabaseClient = supabaseClient;
