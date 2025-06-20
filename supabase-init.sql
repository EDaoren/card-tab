-- =====================================================
-- Quick Tab Chrome扩展 - Supabase初始化脚本
-- Quick Tab Chrome Extension - Supabase Setup Script
-- =====================================================
-- 请在Supabase项目的SQL编辑器中执行以下脚本
-- Execute this script in your Supabase project's SQL Editor

-- 1. 创建数据表 / Create Data Table
-- =====================================================
CREATE TABLE IF NOT EXISTS quick_nav_data (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引提升查询性能 / Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_user_id ON quick_nav_data(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_updated_at ON quick_nav_data(updated_at);

-- 禁用行级安全策略（简化配置，适合个人使用）
-- Disable Row Level Security (simplified setup for personal use)
ALTER TABLE quick_nav_data DISABLE ROW LEVEL SECURITY;

-- 2. 创建Storage存储桶 / Create Storage Bucket
-- =====================================================
-- 创建backgrounds桶（用于存储背景图片）
-- Create backgrounds bucket for storing background images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  52428800,  -- 50MB限制 / 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage桶已创建，使用默认权限设置
-- Storage bucket created with default permissions

-- 3. 验证配置 / Verify Setup
-- =====================================================
-- 检查数据表是否创建成功 / Check if data table was created successfully
SELECT 'Data table created successfully' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quick_nav_data');

-- 检查存储桶是否创建成功 / Check if storage bucket was created successfully
SELECT 'Storage bucket created successfully' as status
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'backgrounds');

-- =====================================================
-- 配置完成！/ Setup Complete!
-- =====================================================
-- 现在您可以：/ Now you can:
-- 1. 返回Chrome扩展 / Return to Chrome extension
-- 2. 配置Supabase连接信息 / Configure Supabase connection
-- 3. 测试连接和同步功能 / Test connection and sync features
-- 4. 使用背景图片和多配置功能 / Use background images and multi-config features
--
-- 注意事项：/ Important Notes:
-- - 此配置适合个人使用，已禁用RLS简化设置
--   This setup is for personal use with RLS disabled for simplicity
-- - 数据通过user_id字段进行区分
--   Data is separated by user_id field
-- - 背景图片存储在backgrounds桶中
--   Background images are stored in the backgrounds bucket
-- - 如需更高安全性，请参考文档配置RLS策略
--   For higher security, refer to documentation for RLS setup
