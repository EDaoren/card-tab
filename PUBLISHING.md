# Chrome Web Store 发布指南

本文档提供了将 Card Tab 扩展发布到 Chrome Web Store 的详细步骤。

## 准备工作

1. **开发者账号注册**
   - 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - 使用您的 Google 账号登录
   - 如果是首次注册，需支付一次性 $5 USD 的开发者注册费

2. **准备发布材料**
   - 确保您已完成 `store-assets` 目录中描述的所有宣传材料
   - 准备好简短而吸引人的扩展描述（最多 132 个字符）
   - 准备详细描述（支持有限的 HTML 标记）

3. **打包扩展**
   - 运行 `npm run build` 命令生成 zip 包
   - 检查 `build` 目录中的 `card-tab.zip` 文件

## 上传步骤

1. **登录开发者控制台**
   - 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - 点击 "New Item" 按钮

2. **上传扩展包**
   - 上传刚才生成的 `card-tab.zip` 文件
   - 等待系统解析包内容

3. **填写商店信息**

   a. **基本信息**
   - 分类: 选择 "Productivity"（生产力）
   - 语言: 可以添加中文和英文
   - 简短描述: 简洁地描述您的扩展功能

   b. **详细描述**
   - 使用 HTML 格式化的详细描述
   - 列出所有主要功能
   - 强调与其他新标签页扩展的区别

   c. **图片**
   - 上传 `store-assets` 中准备好的所有宣传图片
   - 按照要求的尺寸上传图标和截图

   d. **其他选项**
   - 网站链接: 填写您的 GitHub 页面或个人网站
   - 隐私政策: 填写您的隐私政策页面链接（例如 GitHub 上托管的版本）

4. **提交审核**
   - 支付 $5 美元的开发者注册费（如果是首次提交）
   - 勾选所有必要的复选框
   - 点击提交按钮

## 审核流程

1. **等待审核**
   - 审核通常需要 1-3 个工作日
   - 您可以在 Developer Dashboard 中查看审核状态

2. **处理反馈**
   - 如果审核被拒绝，您会收到详细的反馈
   - 根据反馈修复问题并重新提交

3. **发布管理**
   - 审核通过后，扩展将在 Chrome Web Store 上发布
   - 您可以随时更新扩展，但每次更新都需要重新审核

## 更新扩展

1. **更新代码**
   - 修改代码并递增 `manifest.json` 中的版本号
   - 在 `CHANGELOG.md` 中记录变更

2. **重新打包**
   - 运行 `npm run build` 生成新的 zip 包

3. **上传更新**
   - 在 Developer Dashboard 中选择您的扩展
   - 上传新的 zip 包
   - 填写变更说明
   - 提交审核

## 常见问题与解决方案

### 1. 审核被拒绝
- 仔细阅读拒绝原因
- 常见原因包括:
  - 权限使用不当
  - 描述不准确
  - 功能缺失
  - 违反 Chrome Web Store 政策

### 2. 图片不符合要求
- 确保所有图片符合尺寸要求
- 确保图片清晰、专业，没有版权问题

### 3. 扩展性能问题
- 确保扩展不会导致浏览器速度变慢
- 优化图片和代码以减小扩展包大小

## 有用的链接

- [Chrome Web Store 开发者文档](https://developer.chrome.com/docs/webstore/)
- [Chrome 扩展开发者政策](https://developer.chrome.com/docs/webstore/program-policies/)
- [Chrome 扩展最佳实践](https://developer.chrome.com/docs/extensions/mv3/best_practices/)

---

记得定期检查 Chrome Web Store 政策的更新，以确保您的扩展始终符合最新的要求。 