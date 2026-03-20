# Card Tab 项目结构

## 目录概览

```text
card-tab/
├── index.html                  # 新标签页入口
├── settings.html               # 设置页入口
├── manifest.json               # Chrome 扩展清单
├── build.js                    # 打包脚本
├── README.md / README_EN.md    # 使用说明
├── privacy-policy.html         # 隐私政策
├── supabase-init.sql           # Supabase 初始化脚本
├── cf-d1-init.sql              # Cloudflare D1 初始化脚本
├── cloudflare/
│   └── cf-worker.js            # Cloudflare 同步 Worker 模板
├── js/
│   ├── core/
│   │   ├── unified-data-manager.js # 统一数据管理
│   │   ├── storage-adapter.js      # 存储兼容层
│   │   ├── sync-adapter.js         # 同步兼容层
│   │   ├── supabase-client.js      # Supabase 客户端
│   │   ├── cf-client.js            # Cloudflare 客户端
│   │   └── cf-setup-manager.js     # Cloudflare 初始化逻辑
│   ├── ui/
│   │   ├── notification.js         # 提示系统
│   │   ├── settings-ui.js          # 设置页逻辑
│   │   ├── theme.js                # 主题逻辑
│   │   ├── view.js                 # 视图逻辑
│   │   ├── icons.js                # 图标逻辑
│   │   └── simple-loading-manager.js # 加载状态管理
│   ├── features/
│   │   ├── category.js             # 分类功能
│   │   ├── shortcut.js             # 快捷方式功能
│   │   ├── search.js               # 搜索功能
│   │   ├── drag-manager.js         # 拖拽排序
│   │   └── offline-manager.js      # 离线能力
│   ├── vendor/
│   │   └── supabase.min.js         # 第三方 SDK
│   ├── main.js                     # 首页入口逻辑
│   ├── background.js               # Service Worker
│   ├── settings-init.js            # 设置页入口
│   └── content-script.js           # 内容脚本入口
├── styles/                     # 样式
├── fonts/                      # 字体
├── icons/                      # 图标
├── store-assets/               # 商店素材
└── doc/                        # 项目文档
```

## 约定

- 根目录只保留入口文件、构建脚本、发布所需资源和高层文档。
- 业务 JavaScript 放在 `js/`。
- 第三方依赖放在 `js/vendor/`。
- 与 Cloudflare 同步模板相关的资源放在 `cloudflare/`。
- `doc/` 用于项目内部说明文档。

## 重点目录说明

### `js/`

- `core/`：数据层与同步层核心模块。
- `ui/`：提示、主题、设置页与页面 UI 逻辑。
- `features/`：分类、快捷方式、搜索、拖拽、离线等功能模块。
- `vendor/`：第三方 SDK，目前仅 `supabase.min.js`。
- `main.js`：新标签页初始化入口。
- `background.js`：扩展后台脚本。
- `settings-init.js` / `content-script.js`：页面级入口脚本。

### `cloudflare/`

- `cloudflare/cf-worker.js`：扩展内置的 Cloudflare Worker 模板，设置页可直接复制。

## 当前整理结果

这次整理实际完成了 4 类调整：

- 将数据与同步相关模块收拢到 `js/core/`。
- 将页面展示与提示相关模块收拢到 `js/ui/`。
- 将分类、搜索、拖拽、离线等业务模块收拢到 `js/features/`。
- 将第三方 SDK 移到 `js/vendor/`，并把 Cloudflare Worker 模板移到 `cloudflare/`。

现在 `js/` 根目录只保留入口脚本：

- `js/main.js`
- `js/background.js`
- `js/settings-init.js`
- `js/content-script.js`

这样可以更清楚地区分：

- 页面入口
- 核心数据层
- UI 层
- 业务功能层
- 第三方依赖
- 云端部署模板
- 文档与发布资源
