# 卡片标签页

<div align="center">
  <img src="icons/icon128.png" alt="Card Tab Logo" width="80">
  <br>
  <img src="https://img.shields.io/badge/Chrome-Extension-green" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Version-1.0.3-blue" alt="Version 1.0.3">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License MIT">
</div>

一个现代化的、可自定义的Chrome浏览器新标签页，支持云端同步。

**卡片标签页**通过简洁、有组织的界面改变您的新标签页体验，帮助您管理书签和快捷方式。功能包括可自定义主题、通过Supabase的云端同步，以及美观的卡片式设计。

## 功能特点

- **📁 分类管理** - 创建分类，将快捷方式分组整理
- **🎯 拖拽排序** - 拖拽分类和快捷方式调整顺序
- **🔍 快速搜索** - 按 `/` 键搜索快捷方式
- **🎨 主题切换** - 6种主题可选，包括深色模式
- **🖼️ 自定义背景** - 上传图片作为背景
- **📱 视图切换** - 网格视图和列表视图
- **☁️ 云端同步** - 可选择使用Supabase同步数据
- **🖱️ 右键添加** - 在任意网页右键快速添加快捷方式
- **⚙️ 多配置管理** - 支持多个云端配置切换

## 安装方法

### 从Chrome Web Store安装

1. 访问 [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/jaofegmijnalgabmjficlpfmmebepmbd?label=Chrome%20Web%20Store)](https://chrome.google.com/webstore/detail/jaofegmijnalgabmjficlpfmmebepmbd)
2. 点击"添加到Chrome"按钮

### 手动安装

1. 从[发布页面](../../releases)下载最新版本
2. 打开Chrome浏览器并访问 `chrome://extensions/`
3. 在右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"并选择扩展文件夹
5. 打开新标签页即可看到卡片标签页

## 快速开始

### 基本使用

1. **添加分类**：点击悬浮菜单中的"+"按钮
2. **添加快捷方式**：点击分类标题中的"+"按钮，或在网页上右键选择"Card Tab 卡片式导航"
3. **自定义**：右键点击快捷方式进行编辑或删除
4. **搜索**：按"/"聚焦搜索框，输入后按回车
5. **主题**：点击调色板图标更改主题和背景
6. **配置管理**：在同步设置中管理多个云端配置

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
3. 复制并执行以下脚本：[supabase-init.sql](supabase-init.sql)

#### 步骤4：配置扩展

1. 在新浏览器标签页中打开Card Tab
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
- **Material Symbols**: 本地化的Google Material图标字体
- **响应式设计**: 针对不同屏幕尺寸优化
- **离线优先**: 完全离线可用的设计架构

### Chrome扩展接口
- **chrome.storage**: 本地和同步存储
- **chrome.tabs**: 新标签页覆盖功能
- **chrome.contextMenus**: 右键菜单快速添加
- **chrome.runtime**: 后台脚本通信

### 云端集成
- **Supabase**: PostgreSQL数据库
- **Supabase Storage**: 背景图片文件存储


## 开发

### 构建

```bash
# 打包扩展
node build.js
```

构建脚本会创建可用于Chrome Web Store提交的`card-tab.zip`文件。

> **注意**: 本项目是纯 JavaScript Chrome 扩展，无需 npm 依赖，直接使用 Node.js 运行构建脚本即可。


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