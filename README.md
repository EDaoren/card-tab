# Quick Nav Tab | 快捷导航标签页

<div align="center">
  <img src="icons/icon128.png" alt="Quick Nav Tab Logo" width="80">
  <br>
  <img src="https://img.shields.io/badge/Chrome-Extension-green" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version 1.0.0">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License MIT">
</div>

A modern, customizable new tab page for Chrome browser.

一个现代化的、可自定义的Chrome浏览器新标签页。

**Quick Nav Tab** transforms your new tab experience with a clean, organized interface for managing your frequently visited websites. With customizable categories, themes, and backgrounds, it provides both functionality and aesthetics to enhance your browsing workflow.

**快捷导航标签页**通过简洁、有组织的界面改变您的新标签页体验，帮助您管理常用网站。凭借可自定义的分类、主题和背景，它兼具功能性和美观性，提升您的浏览工作流程。

## Features | 功能特点

### English

- **Categorized Shortcuts**: Create and manage shortcuts in different categories
- **Category Management**: Add, edit, and delete categories with custom names and colors
- **Shortcut Management**: Add, edit, and delete shortcuts and assign them to specific categories
- **Collapsible Categories**: Expand or collapse category cards for better organization
- **View Modes**: Switch between grid view and list view
- **Search Functionality**: Direct URL input or Google search
- **Keyboard Shortcuts**: Press "/" to focus on the search box
- **Multi-device Sync**: Data synced across devices via Chrome's storage.sync API
- **Theme Options**: Choose from 6 different color themes including a dark mode
- **Custom Background**: Upload and set your own background image
- **Modern UI**: Clean, card-based design with smooth animations and transitions

### 中文

- **分类式快捷方式**：在不同类别中创建和管理快捷方式
- **分类管理**：添加、编辑和删除分类，可自定义名称和颜色
- **快捷方式管理**：添加、编辑和删除快捷方式，并将其分配到特定分类
- **可折叠分类**：展开或折叠分类卡片，更好地组织内容
- **视图模式**：在网格视图和列表视图之间切换
- **搜索功能**：直接输入URL或使用Google搜索
- **键盘快捷键**：按"/"键聚焦到搜索框
- **多设备同步**：通过Chrome的storage.sync API在设备间同步数据
- **主题选项**：提供6种不同的颜色主题，包括暗色模式
- **自定义背景**：上传并设置您自己的背景图片
- **现代UI**：简洁的卡片式设计，平滑的动画和过渡效果

## Screenshots | 截图

<div align="center">
  <p><i>Screenshots will be updated when publishing to GitHub.</i></p>
  <p><i>截图将在发布到GitHub时更新。</i></p>
</div>

Here's what you can expect to see:
- Grid view with multiple categorized cards
- List view for compact browsing
- Theme customization options
- Background image settings
- Search functionality in action

以下是您可以期待看到的内容：
- 具有多个分类卡片的网格视图
- 用于紧凑浏览的列表视图
- 主题定制选项
- 背景图片设置
- 搜索功能的实际应用

## Installation | 安装方法

### From Chrome Web Store | 从Chrome Web Store安装

1. Visit the [Chrome Web Store link](#) (coming soon)
2. Click "Add to Chrome" button

1. 访问[Chrome Web Store链接](#)（即将上线）
2. 点击"添加到Chrome"按钮

### Manual Installation (Development) | 手动安装（开发版）

#### English
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" at the top right
4. Click "Load unpacked" and select the extension folder
5. The extension is now installed and will replace your new tab page

#### 中文
1. 下载或克隆此仓库
2. 打开Chrome浏览器并访问 `chrome://extensions/`
3. 在右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"并选择扩展文件夹
5. 扩展现已安装，将替换您的新标签页

## Usage | 使用方法

### English

- **Adding a Category**: Click the "+" button in the floating menu on the right
- **Adding a Shortcut**: Click the "+" button in any category header
- **Editing**: Right-click on any shortcut to edit or delete it
- **Changing View**: Use the grid/list toggle buttons in the floating menu
- **Changing Theme**: Click the palette icon in the floating menu
- **Setting Background**: Upload an image in the theme settings
- **Searching**: Type in the search box and press Enter (use "/" to focus)

### 中文

- **添加分类**：点击右侧悬浮菜单中的"+"按钮
- **添加快捷方式**：点击任何分类标题中的"+"按钮
- **编辑**：右键点击任何快捷方式进行编辑或删除
- **更改视图**：使用悬浮菜单中的网格/列表切换按钮
- **更改主题**：点击悬浮菜单中的调色板图标
- **设置背景**：在主题设置中上传图片
- **搜索**：在搜索框中输入并按回车键（使用"/"快速聚焦）

## Development Guide | 开发指南

### Environment Setup | 环境设置

```bash
# Clone the repository | 克隆仓库
git clone https://github.com/yourusername/quick-nav-tab.git

# Navigate to project directory | 进入项目目录
cd quick-nav-tab/index-tab

# Install dependencies | 安装依赖
npm install
```

### Building the Project | 构建项目

```bash
# Package the extension | 打包扩展
npm run build
```

After building, you can find the `quick-nav-tab.zip` file in the `build` directory, which can be used for uploading to the Chrome Web Store.

构建完成后，您可以在`build`目录找到`quick-nav-tab.zip`文件，该文件可用于上传到Chrome Web Store。

## Technologies | 技术栈

### Frontend | 前端技术
- HTML5
- CSS3 (Custom Properties, Flexbox, Grid)
- JavaScript (ES6+)
- Google Material Symbols Icons

### Chrome APIs | Chrome接口
- chrome.storage.sync - For multi-device data synchronization
- chrome.tabs - For new tab page integration

### Design Patterns | 设计模式
- Module Pattern
- Event Delegation
- Responsive Design

## Documentation | 文档

- [Publishing Guide | 发布指南](./PUBLISHING.md): How to publish the extension to Chrome Web Store
- [Store Assets | 商店资源](./store-assets/README.md): Guide for preparing Chrome Web Store promotional materials

## Future Plans | 未来计划

### English
- Import/export of user data
- Additional theme options
- Customizable search engines
- Weather widget integration
- Notes and todo features
- Customizable layout options

### 中文
- 用户数据导入/导出
- 更多主题选项
- 可自定义搜索引擎
- 天气小部件集成
- 笔记和待办事项功能
- 自定义布局选项

## Contributing | 贡献

Contributions are welcome! Feel free to submit a pull request or open an issue.

欢迎贡献！请随时提交拉取请求或开启议题。

## License | 许可证

[MIT License](LICENSE)

## Author | 作者

*Your name or organization here*

*您的名字或组织名称* 