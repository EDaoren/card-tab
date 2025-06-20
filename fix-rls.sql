-- =====================================================
-- Quick Tab Chrome扩展 - RLS权限修复脚本
-- =====================================================
-- 如果遇到权限问题，请在Supabase SQL编辑器中执行此脚本

-- 1. 禁用数据表的行级安全策略
-- =====================================================
ALTER TABLE quick_nav_data DISABLE ROW LEVEL SECURITY;

-- 2. 删除可能存在的策略（避免冲突）
-- =====================================================
DROP POLICY IF EXISTS "Enable all access based on user_id" ON quick_nav_data;
DROP POLICY IF EXISTS "Users can access own data" ON quick_nav_data;
DROP POLICY IF EXISTS "Allow all operations" ON quick_nav_data;

-- 3. 禁用Storage相关的RLS
-- =====================================================
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- 删除可能存在的Storage策略
DROP POLICY IF EXISTS "Allow bucket listing" ON storage.buckets;
DROP POLICY IF EXISTS "Allow all operations on backgrounds bucket" ON storage.objects;

-- 4. 验证表是否存在，如果不存在则创建
-- =====================================================
CREATE TABLE IF NOT EXISTS quick_nav_data (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_user_id ON quick_nav_data(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_updated_at ON quick_nav_data(updated_at);

-- 5. 创建Storage桶（如果不存在）
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 6. 验证修复结果
-- =====================================================
SELECT 
  'quick_nav_data table exists' as status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quick_nav_data') 
    THEN 'YES' 
    ELSE 'NO' 
  END as result;

SELECT 
  'backgrounds bucket exists' as status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'backgrounds') 
    THEN 'YES' 
    ELSE 'NO' 
  END as result;

-- 7. 测试数据操作权限
-- =====================================================
-- 尝试插入测试数据
INSERT INTO quick_nav_data (user_id, data) 
VALUES ('test_user', '{"test": true}') 
ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data;

-- 查询测试数据
SELECT user_id, data FROM quick_nav_data WHERE user_id = 'test_user';

-- 删除测试数据
DELETE FROM quick_nav_data WHERE user_id = 'test_user';

-- =====================================================
-- 修复完成！
-- =====================================================
-- 如果以上脚本执行成功且没有错误，说明权限问题已解决
-- 现在可以返回Chrome扩展测试配置切换功能
