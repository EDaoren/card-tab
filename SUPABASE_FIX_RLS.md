# 🔧 Supabase RLS 错误修复指南

## 问题描述
如果你遇到以下错误：
- `406 (Not Acceptable)`
- `401 (Unauthorized)`
- `new row violates row-level security policy`

这是因为Supabase表启用了行级安全策略(RLS)，需要进行配置。

## 🚀 快速修复方案

### 方案1: 禁用RLS（推荐，适合个人使用）

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 执行以下SQL命令：

```sql
-- 禁用行级安全策略
ALTER TABLE quick_nav_data DISABLE ROW LEVEL SECURITY;
```

5. 点击 **Run** 执行

### 方案2: 配置RLS策略（更安全）

如果你想保持RLS启用，执行以下SQL：

```sql
-- 启用行级安全策略
ALTER TABLE quick_nav_data ENABLE ROW LEVEL SECURITY;

-- 创建允许所有操作的策略
CREATE POLICY "Enable all access for authenticated users" ON quick_nav_data
  FOR ALL 
  USING (true)
  WITH CHECK (true);
```

## 🔍 验证修复

修复后，重新测试同步功能：

1. 在Chrome扩展中点击同步按钮
2. 点击"启用云端同步"
3. 应该能成功同步数据

## 📋 故障排除

### 如果仍然有问题：

1. **检查API密钥权限**：
   - 确保使用的是 `anon` 密钥，不是 `service_role` 密钥
   - 在 Project Settings > API 中找到正确的密钥

2. **检查表是否存在**：
   ```sql
   SELECT * FROM quick_nav_data LIMIT 1;
   ```

3. **重新创建表**（如果需要）：
   ```sql
   DROP TABLE IF EXISTS quick_nav_data;
   
   CREATE TABLE quick_nav_data (
     id SERIAL PRIMARY KEY,
     user_id TEXT NOT NULL UNIQUE,
     data JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- 禁用RLS
   ALTER TABLE quick_nav_data DISABLE ROW LEVEL SECURITY;
   
   -- 创建索引
   CREATE INDEX idx_quick_nav_data_user_id ON quick_nav_data(user_id);
   ```

## 🛡️ 安全说明

- **方案1（禁用RLS）**: 适合个人使用，任何有API密钥的人都可以访问数据
- **方案2（启用RLS）**: 更安全，但需要正确配置策略

对于Chrome扩展的个人使用场景，方案1通常就足够了。

## 📞 需要帮助？

如果问题仍然存在，请检查：
1. Supabase项目URL是否正确
2. API密钥是否正确
3. 网络连接是否正常
4. 浏览器控制台是否有其他错误信息
