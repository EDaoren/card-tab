# Card Tab 项目结构详解

## 📁 目录结构概览

```
card-tab/
├── 📄 index.html                 # 主页面入口
├── ⚙️ manifest.json             # Chrome扩展配置
├── 📦 package.json              # 项目依赖配置
├── 🔨 build.js                  # 构建打包脚本
├── 📝 README.md                 # 中文文档
├── 📝 README_EN.md              # 英文文档
├── 📄 privacy-policy.html       # 隐私政策
├── 📄 supabase-init.sql         # 数据库初始化脚本
├── 📄 OPTIMIZATION_SUMMARY.md   # 优化总结
├── 📄 PROJECT_STRUCTURE.md      # 项目结构说明
├── 📄 LICENSE                   # 开源许可证
├── 🧪 test-local-font.html      # 字体测试页面
├── 🧪 test-offline.html         # 离线测试页面
├── 📁 fonts/                    # 字体资源
├── 📁 styles/                   # 样式文件
├── 📁 js/                       # JavaScript模块
├── 📁 icons/                    # 扩展图标
└── 📁 store-assets/             # 商店资源
```

## 🎨 样式文件 (styles/)

```
styles/
├── main.css              # 主样式文件 (3200+ 行)
│   ├── CSS变量定义
│   ├── 主题样式
│   ├── 组件样式
│   ├── 响应式布局
│   └── 动画效果
└── offline-icons.css     # 离线图标样式
    ├── 搜索引擎图标
    ├── 网站图标备选
    ├── 离线状态指示
    └── 功能降级样式
```

## 🔤 字体文件 (fonts/)

```
fonts/
├── material-symbols-rounded.css                    # 字体样式定义
│   ├── @font-face 声明
│   ├── Material Symbols 基础样式
│   └── 图标备选方案
└── material-symbols-rounded-v255-latin-regular.woff2  # 字体文件 (321KB)
    └── 完整的 Material Symbols 图标集
```

## 🧩 JavaScript模块 (js/)

### 核心模块

```
js/
├── main.js                    # 主入口 (67行)
│   ├── 应用初始化
│   ├── 模块协调
│   └── 错误处理
├── storage.js                 # 存储管理 (200+ 行)
│   ├── Chrome Storage API
│   ├── 数据验证
│   └── 缓存管理
└── sync-manager.js           # 同步管理 (900+ 行)
    ├── 旁路缓存策略
    ├── 数据合并逻辑
    └── 冲突解决
```

### 功能模块

```
├── category.js               # 分类管理 (300+ 行)
│   ├── 分类CRUD操作
│   ├── 拖拽排序
│   └── 数据验证
├── shortcut.js              # 快捷方式管理 (320+ 行)
│   ├── 快捷方式CRUD
│   ├── 图标获取
│   └── URL验证
├── search.js                # 搜索功能 (200+ 行)
│   ├── 实时搜索
│   ├── 快捷键支持
│   └── 结果高亮
├── view.js                  # 视图管理 (150+ 行)
│   ├── 网格/列表切换
│   ├── 响应式布局
│   └── 动画效果
└── theme.js                 # 主题管理 (100+ 行)
    ├── 主题切换
    ├── 背景设置
    └── 样式应用
```

### 界面模块

```
├── sync-ui.js               # 同步界面 (400+ 行)
│   ├── Supabase配置
│   ├── 连接测试
│   └── 状态显示
├── theme-config-ui.js       # 主题配置界面 (500+ 行)
│   ├── 配置管理
│   ├── 多配置支持
│   └── 界面交互
└── icons.js                 # 图标管理 (180+ 行)
    ├── 字体检测
    ├── 备选方案
    └── DOM监听
```

### 优化模块

```
├── offline-manager.js       # 离线管理 (300+ 行)
│   ├── 网络状态检测
│   ├── 功能降级
│   ├── 图标替换
│   └── 重试机制
├── theme-config-manager.js  # 主题配置管理 (600+ 行)
│   ├── 配置存储
│   ├── 数据清理
│   └── 旁路缓存
└── data-save-coordinator.js # 数据保存协调 (300+ 行)
    ├── 一致性检查
    ├── 数据合并
    └── 冲突处理
```

### 外部依赖

```
├── supabase-client.js       # Supabase客户端 (400+ 行)
│   ├── 数据库操作
│   ├── 文件存储
│   └── 错误处理
└── supabase.min.js         # Supabase SDK (压缩版)
    └── 官方JavaScript SDK
```

## 🖼️ 图标资源 (icons/)

```
icons/
├── icon16.png               # 16x16 扩展图标
├── icon32.png               # 32x32 扩展图标
├── icon48.png               # 48x48 扩展图标
├── icon128.png              # 128x128 扩展图标
└── icon512.png              # 512x512 商店图标
```

## 🏪 商店资源 (store-assets/)

```
store-assets/
├── screenshots/             # 应用截图
│   ├── main-interface0.png  # 默认主题
│   ├── main-interface1.png  # 深色主题
│   ├── main-interface3.png  # 彩色主题
│   ├── category-management.png
│   ├── theme-customization.png
│   ├── search-feature.png
│   └── cloud-sync.png
├── promotional/             # 宣传素材
└── README.md               # 资源说明
```

## 🧪 测试文件

```
├── test-local-font.html     # 字体测试页面
│   ├── 字体加载检测
│   ├── 图标显示测试
│   └── 性能信息
└── test-offline.html        # 离线测试页面
    ├── 网络状态模拟
    ├── 功能降级测试
    └── 图标替换验证
```

## 📊 文件统计

### 代码行数统计
- **总JavaScript代码**: ~4500行
- **CSS样式代码**: ~3500行
- **HTML模板**: ~520行
- **文档**: ~1000行

### 文件大小统计
- **字体文件**: 321KB (woff2)
- **JavaScript**: ~150KB (未压缩)
- **CSS**: ~80KB
- **图标**: ~50KB (所有尺寸)

## 🔄 数据流架构

```
用户操作 → UI组件 → 管理器模块 → 存储层 → 同步层
    ↑                                      ↓
    ← 状态更新 ← 数据验证 ← 缓存管理 ← 云端同步
```

### 核心数据流
1. **用户交互** → category.js / shortcut.js
2. **数据处理** → storage.js
3. **状态管理** → sync-manager.js
4. **界面更新** → view.js / theme.js
5. **云端同步** → supabase-client.js

## 🎯 模块职责

### 数据层
- `storage.js`: 本地存储抽象
- `sync-manager.js`: 数据同步协调
- `supabase-client.js`: 云端数据操作

### 业务层
- `category.js`: 分类业务逻辑
- `shortcut.js`: 快捷方式业务逻辑
- `search.js`: 搜索业务逻辑

### 表现层
- `view.js`: 视图状态管理
- `theme.js`: 主题样式管理
- `*-ui.js`: 界面交互逻辑

### 优化层
- `offline-manager.js`: 离线功能优化
- `icons.js`: 图标加载优化
- `data-save-coordinator.js`: 数据保存优化

## 🚀 构建流程

```
源代码 → build.js → 文件筛选 → 压缩打包 → card-tab.zip
```

### 构建包含文件
- ✅ 核心功能文件
- ✅ 样式和字体
- ✅ 扩展配置
- ✅ 文档文件
- ❌ 测试文件
- ❌ 开发工具
