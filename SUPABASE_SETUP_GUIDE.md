# Supabase云端同步设置指南

## 🎯 功能概述

Quick Nav Tab插件现在支持Supabase云端同步，实现真正的多端数据同步：
- **Chrome Storage**: 本地多设备同步（Chrome账户）
- **Supabase**: 全平台多端同步（跨浏览器、跨设备）
- **混合模式**: 本地+云端双重备份

## 📋 前置准备

### 1. 创建Supabase账户
1. 访问 [Supabase官网](https://supabase.com)
2. 点击"Start your project"注册账户
3. 创建新项目（免费版足够使用）

### 2. 获取项目信息
在Supabase项目仪表板中：
1. 进入 **Settings** → **API**
2. 复制以下信息：
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 🔧 数据表设置

### 1. 创建数据表
在Supabase项目中：
1. 进入 **SQL Editor**
2. 执行以下SQL脚本：

```sql
-- 创建Quick Nav Tab数据表
CREATE TABLE IF NOT EXISTS quick_nav_data (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_user_id ON quick_nav_data(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_updated_at ON quick_nav_data(updated_at);

-- 启用行级安全策略（可选，增强安全性）
ALTER TABLE quick_nav_data ENABLE ROW LEVEL SECURITY;

-- 创建策略允许用户访问自己的数据（可选）
CREATE POLICY "Users can access own data" ON quick_nav_data
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));
```

### 2. 验证表结构
执行查询验证表是否创建成功：
```sql
SELECT * FROM quick_nav_data LIMIT 1;
```

## ⚙️ 插件配置

### 1. 打开同步设置
1. 在插件页面点击右侧的 **同步按钮** (⟲图标)
2. 进入"云端同步设置"界面

### 2. 配置连接信息
填写以下信息：
- **Supabase项目URL**: 从项目设置中复制
- **匿名密钥**: 从API设置中复制
- **用户标识**: 设置唯一标识（建议使用邮箱）

### 3. 测试连接
1. 点击"测试连接"按钮
2. 确认连接成功

### 4. 启用同步
1. 点击"启用云端同步"
2. 现有数据将自动迁移到云端

## 🔄 使用方式

### 自动同步
- 每次数据变更都会自动同步到云端
- 启动时自动从云端加载最新数据
- 智能冲突解决（以最新时间戳为准）

### 手动同步
- 点击"手动同步"强制同步
- 适用于网络问题后的数据恢复

### 数据管理
- **导出数据**: 下载JSON格式的备份文件
- **导入数据**: 从备份文件恢复数据

## 🛡️ 安全说明

### 数据隐私
- 数据存储在您自己的Supabase项目中
- 插件不会访问您的其他数据
- 建议启用行级安全策略

### 访问控制
- 使用唯一的用户标识区分不同用户
- 建议使用邮箱作为用户标识
- 不要分享您的Supabase密钥

## 🔧 故障排除

### 连接失败
1. **检查网络连接**
2. **验证URL和密钥**：确保从正确位置复制
3. **检查表结构**：确保数据表已正确创建
4. **查看控制台**：按F12查看详细错误信息

### 数据同步问题
1. **手动同步**：尝试点击"手动同步"
2. **重新启用**：禁用后重新启用同步
3. **数据导出**：导出数据作为备份
4. **清除缓存**：清除浏览器缓存后重试

### 常见错误
- **PGRST116**: 数据表不存在，需要执行SQL脚本
- **401 Unauthorized**: 密钥错误或已过期
- **403 Forbidden**: 权限不足，检查RLS策略

## 📊 数据结构

### 存储格式
```json
{
  "categories": [
    {
      "id": "cat-1",
      "name": "分类名称",
      "color": "#4285f4",
      "collapsed": false,
      "shortcuts": [
        {
          "id": "shortcut-1",
          "name": "网站名称",
          "url": "https://example.com",
          "iconType": "letter",
          "iconColor": "#ff8200",
          "iconUrl": ""
        }
      ]
    }
  ],
  "settings": {
    "viewMode": "grid"
  },
  "_metadata": {
    "lastModified": "2024-01-01T00:00:00.000Z",
    "source": "supabase"
  }
}
```

## 🚀 高级功能

### 多设备同步
1. 在每个设备上配置相同的用户标识
2. 数据将自动在所有设备间同步
3. 支持Chrome、Firefox、Edge等浏览器

### 冲突解决
- **自动解决**: 以最新修改时间为准
- **手动解决**: 未来版本将支持手动选择
- **备份策略**: 本地始终保留备份

### 性能优化
- **增量同步**: 只同步变更的数据
- **压缩存储**: JSON数据自动压缩
- **缓存机制**: 本地缓存减少网络请求

## 💡 最佳实践

1. **定期备份**: 使用导出功能定期备份数据
2. **唯一标识**: 使用邮箱等唯一标识避免冲突
3. **网络稳定**: 在稳定网络环境下进行初始设置
4. **权限管理**: 不要分享Supabase项目访问权限
5. **监控使用**: 定期检查Supabase项目使用情况

## 📞 技术支持

如果遇到问题：
1. 查看浏览器控制台错误信息
2. 检查Supabase项目日志
3. 尝试重新配置连接
4. 使用导出/导入功能备份恢复数据

---

**注意**: Supabase免费版有一定的使用限制，对于个人使用完全足够。如需更高性能，可考虑升级到付费版本。
