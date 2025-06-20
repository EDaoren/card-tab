# 快捷导航标签页

<div align="center">
  <img src="icons/icon128.png" alt="Quick Nav Tab Logo" width="80">
  <br>
  <img src="https://img.shields.io/badge/Chrome-Extension-green" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version 1.0.0">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License MIT">
</div>

一个现代化的、可自定义的Chrome浏览器新标签页，支持云端同步。

**快捷导航标签页**通过简洁、有组织的界面改变您的新标签页体验，帮助您管理书签和快捷方式。功能包括可自定义主题、通过Supabase的云端同步，以及美观的卡片式设计。

## 功能特点

- **📁 分类书签管理**：将快捷方式整理到可自定义的分类中
- **🎨 主题定制**：6种精美主题，包括暗色模式
- **🖼️ 自定义背景**：上传您自己的背景图片
- **☁️ 云端同步**：使用Supabase跨设备同步数据（可选）
- **🔍 智能搜索**：使用"/"快捷键快速搜索
- **📱 响应式设计**：网格和列表视图模式
- **⚡ 快速轻量**：优化性能，流畅动画
- **🔒 隐私优先**：数据保存在您自己的Supabase项目中

## 截图

<div align="center">
  <p><i>截图将在发布到Chrome Web Store时更新。</i></p>
</div>

## 安装方法

### 从Chrome Web Store安装

1. 访问[Chrome Web Store链接](#)（即将上线）
2. 点击"添加到Chrome"按钮

### 手动安装

1. 从[发布页面](../../releases)下载最新版本
2. 打开Chrome浏览器并访问 `chrome://extensions/`
3. 在右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"并选择扩展文件夹
5. 打开新标签页即可看到快捷导航标签页

## 快速开始

### 基本使用

1. **添加分类**：点击悬浮菜单中的"+"按钮
2. **添加快捷方式**：点击分类标题中的"+"按钮
3. **自定义**：右键点击快捷方式进行编辑或删除
4. **搜索**：按"/"聚焦搜索框，输入后按回车
5. **主题**：点击调色板图标更改主题和背景

### 云端同步设置

如需多设备同步，可选择配置Supabase云端同步：

#### 步骤1：创建Supabase项目

1. 访问 [Supabase.com](https://supabase.com)
2. 点击"Start your project"并注册
3. 创建新项目（免费版本足够）
4. 等待项目初始化（2-3分钟）

#### 步骤2：获取项目凭据

1. 在Supabase项目仪表板中，进入 **Settings** → **API**
2. 复制以下信息：
   - **项目URL**: `https://your-project.supabase.co`
   - **匿名公钥**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 步骤3：初始化数据库

1. 在Supabase项目中进入 **SQL Editor**
2. 创建新查询
3. 复制并执行以下脚本：

```sql
-- 创建数据表
CREATE TABLE IF NOT EXISTS quick_nav_data (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引提升性能
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_user_id ON quick_nav_data(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_nav_data_updated_at ON quick_nav_data(updated_at);

-- 创建Storage存储桶（用于背景图片）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  52428800,  -- 50MB限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 设置Storage访问策略
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'backgrounds');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'backgrounds');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'backgrounds');
```

#### 步骤4：配置扩展

1. 在新浏览器标签页中打开Quick Nav Tab
2. 点击右侧的**同步按钮**（⟲图标）
3. 填写配置信息：
   - **Supabase URL**: 步骤2中的项目URL
   - **API密钥**: 步骤2中的匿名公钥
   - **用户ID**: 唯一标识符（建议使用您的邮箱）
4. 点击"测试连接"进行验证
5. 点击"启用云端同步"开始同步

### 常见问题

**连接问题：**
1. **检查网络**：确保网络连接稳定
2. **验证凭据**：仔细检查URL和API密钥
3. **检查数据库**：确保SQL脚本执行成功
4. **控制台日志**：按F12查看详细错误信息

**常见错误：**
- **PGRST116**: 数据表不存在 - 执行SQL脚本
- **401 Unauthorized**: API密钥错误或凭据过期
- **403 Forbidden**: 权限被拒绝 - 检查数据库策略

## 技术栈

### 前端技术
- **HTML5 & CSS3**: 现代Web标准，使用自定义属性
- **JavaScript ES6+**: 模块化架构，使用async/await
- **Material Design**: Google Material Symbols图标
- **响应式设计**: 针对不同屏幕尺寸优化

### Chrome扩展接口
- **chrome.storage**: 本地和同步存储
- **chrome.tabs**: 新标签页覆盖功能

### 云端集成
- **Supabase**: PostgreSQL数据库
- **Supabase Storage**: 背景图片文件存储

## 开发

### 构建

```bash
# 打包扩展
npm run build
```

构建脚本会创建可用于Chrome Web Store提交的`quick-nav-tab.zip`文件。

## 隐私与安全

- **本地优先**：默认情况下所有数据都存储在本地
- **可选云端同步**：Supabase集成完全可选
- **您的数据库**：使用云端同步时，数据存储在您自己的Supabase项目中
- **无追踪**：无分析、无数据收集、无第三方追踪
- **开源**：完整源代码可供审查

## 重要说明

- **个人使用**：每个人都应该创建自己的Supabase项目
- **用户ID**：为不同的主题配置使用不同的用户ID
- **免费额度**：Supabase免费版本足够个人使用
- **备份**：建议定期导出数据备份

## 贡献

欢迎贡献！请随时提交问题和拉取请求。

## 许可证

[MIT License](LICENSE)

---

<div align="center">
  <p>为更好的浏览体验而制作 ❤️</p>
</div>