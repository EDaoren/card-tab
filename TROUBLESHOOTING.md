# 🔧 Card Tab 快速添加功能故障排除

## 🚨 问题：看不到任何添加入口

### 📋 检查清单

#### 1. **扩展重新加载**
- 打开 Chrome 扩展管理页面 (`chrome://extensions/`)
- 找到 Card Tab 扩展
- 点击"重新加载"按钮
- **重要**: 修改 manifest.json 后必须重新加载扩展

#### 2. **权限检查**
确保 manifest.json 包含以下权限：
```json
"permissions": ["storage", "activeTab", "contextMenus"]
```

#### 3. **文件检查**
确保以下文件存在且内容正确：
- `js/background.js` - 后台脚本
- `js/content-script.js` - 内容脚本
- `manifest.json` - 扩展配置

#### 4. **快捷键测试**
- 在任何网页上按 `Ctrl+Shift+A` (Windows/Linux) 或 `Command+Shift+A` (Mac)
- 如果不工作，检查快捷键冲突：
  - 打开 `chrome://extensions/shortcuts`
  - 查看 Card Tab 的快捷键设置
  - 重新设置或更改快捷键

#### 5. **右键菜单测试**
- 在任何网页上右键点击
- 查看是否有"添加到 Card Tab"选项
- 如果没有，检查控制台错误

## 🔍 调试步骤

### 1. **打开开发者工具**
- 按 F12 或 Ctrl+Shift+I
- 切换到 Console 标签

### 2. **检查后台脚本**
- 在扩展管理页面点击"检查视图 service worker"
- 查看后台脚本的控制台输出
- 应该看到类似信息：
  ```
  Card Tab: Background script installed
  Main context menu created
  Page context menu created
  Link context menu created
  ```

### 3. **检查内容脚本**
- 在任何网页的控制台中查看
- 应该看到：
  ```
  Card Tab content script loaded on: [页面URL]
  ```

### 4. **测试消息通信**
在网页控制台中运行：
```javascript
chrome.runtime.sendMessage({action: "test"}, (response) => {
  console.log('Response:', response);
  if (chrome.runtime.lastError) {
    console.error('Error:', chrome.runtime.lastError);
  }
});
```

## 🛠️ 常见解决方案

### 问题1: 快捷键不响应
**解决方案:**
1. 检查快捷键冲突 (`chrome://extensions/shortcuts`)
2. 重新设置快捷键
3. 确保页面已完全加载
4. 尝试在不同网站测试

### 问题2: 右键菜单不显示
**解决方案:**
1. 重新加载扩展
2. 检查 `activeTab` 和 `contextMenus` 权限
3. 查看后台脚本控制台错误
4. 确保不在 Chrome 内部页面 (chrome://) 测试

### 问题3: 内容脚本未加载
**解决方案:**
1. 检查 `content_scripts` 配置
2. 确保 `matches: ["<all_urls>"]` 正确
3. 检查 `run_at: "document_end"` 设置
4. 重新加载扩展

### 问题4: 消息通信失败
**解决方案:**
1. 检查后台脚本是否正常运行
2. 确保消息格式正确
3. 检查 `chrome.runtime.lastError`
4. 验证扩展ID没有改变

## 🧪 使用测试页面

1. 打开 `test-quick-add.html` 文件
2. 点击"检查扩展状态"按钮
3. 查看调试信息
4. 按照提示进行测试

## 📝 手动验证步骤

### 验证后台脚本
1. 打开 `chrome://extensions/`
2. 找到 Card Tab，点击"检查视图 service worker"
3. 在控制台运行：
   ```javascript
   chrome.contextMenus.removeAll();
   chrome.contextMenus.create({
     id: "test-menu",
     title: "测试菜单",
     contexts: ["page"]
   });
   ```

### 验证内容脚本
1. 在任何网页打开控制台
2. 运行：
   ```javascript
   console.log('Testing content script...');
   if (typeof chrome !== 'undefined') {
     console.log('Chrome API available');
   } else {
     console.log('Chrome API not available');
   }
   ```

### 验证快捷键
1. 打开 `chrome://extensions/shortcuts`
2. 确认 Card Tab 有快捷键设置
3. 尝试重新设置快捷键

## 🔄 完全重置步骤

如果以上都不工作，尝试完全重置：

1. **移除扩展**
   - 在扩展管理页面移除 Card Tab

2. **清理数据**
   - 清除浏览器缓存
   - 重启浏览器

3. **重新安装**
   - 重新加载扩展文件夹
   - 或重新打包安装

4. **验证安装**
   - 检查所有权限
   - 测试基本功能

## 📞 获取帮助

如果问题仍然存在：

1. **收集信息**
   - Chrome 版本
   - 操作系统
   - 错误消息截图
   - 控制台日志

2. **检查日志**
   - 后台脚本控制台
   - 网页控制台
   - 扩展管理页面错误

3. **提供详细描述**
   - 具体操作步骤
   - 预期行为
   - 实际行为
   - 错误信息
