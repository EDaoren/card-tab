# Card Tab 本地缓存与存储数据结构梳理

## 1. 总览

当前项目的数据存储不是单一的一套“本地缓存”，而是分成 3 层：

- `chrome.storage.sync`：存放全局元数据、Chrome 主题的持久化数据、云同步配置、搜索偏好。
- `chrome.storage.local`：存放当前主题/最近主题的数据缓存，以及 Cloudflare 初始化向导的本地资料。
- 内存态：运行时保存在 `UnifiedDataManager.currentConfigData`，不直接持久化到浏览器存储。

核心实现位于：

- `js/core/unified-data-manager.js:5`
- `js/core/storage-adapter.js:43`
- `js/core/cf-resource-manager.js:191`
- `js/features/search.js:662`

> 狭义上说，项目里的“本地缓存”主要指 `chrome.storage.local` 里的 `cardTabData_${themeId}`。

---

## 2. 存储键总表

| 存储位置 | Key | 值结构 | 用途 |
| --- | --- | --- | --- |
| `chrome.storage.sync` | `card_tab_app_data` | `AppData` | 全局元数据，包含当前主题 ID、主题列表、主题元信息 |
| `chrome.storage.sync` | `chrome_sync_${themeId}` | `ConfigData` | `type = 'chrome'` 的主题真实持久化数据 |
| `chrome.storage.sync` | `supabase_config` | `SupabaseConfig` | Supabase 连接配置 |
| `chrome.storage.sync` | `cf_config` | `CloudflareConfig` | Cloudflare 连接配置 |
| `chrome.storage.sync` | `preferredSearchEngine` | `number` | 搜索栏当前选中的搜索引擎索引 |
| `chrome.storage.local` | `cardTabData_${themeId}` | `ConfigData` | 某个主题的数据缓存 |
| `chrome.storage.local` | `card_tab_cf_setup_profile` | `CloudflareSetupProfile` | Cloudflare 自动/手动初始化资料 |
| `chrome.storage.local` | `card_tab_cf_setup_preferences` | `CloudflareSetupPreferences` | Cloudflare 初始化偏好 |
| `chrome.storage.local` | `card_tab_cf_setup_api_token` | `string` | 可选保存的 Cloudflare API Token |

补充说明：

- `card_tab_app_data` 只存“主题元数据”，不存分类和快捷方式内容。
- `chrome_sync_${themeId}` 和 `cardTabData_${themeId}` 存的是主题工作区数据，不存 `themeName`、`bgOpacity` 这类主题元数据。
- 当主题类型是 `supabase` 或 `cloudflare` 时，远端才是真正的数据源，`cardTabData_${themeId}` 只是本地缓存。

---

## 3. 核心数据结构

## 3.1 `AppData`

定义来源：`js/core/unified-data-manager.js:23`

```json
{
  "version": "2.0.0",
  "currentThemeId": "default",
  "themes": {
    "default": {
      "themeId": "default",
      "themeName": "默认主题",
      "themeType": "default",
      "bgImageUrl": null,
      "bgImagePath": null,
      "bgOpacity": 30,
      "isActive": true,
      "type": "chrome",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

字段说明：

- `version`：数据结构版本，目前是 `2.0.0`。
- `currentThemeId`：当前激活主题 ID。
- `themes`：以 `themeId` 为 key 的主题元数据字典。

单个主题对象结构来自：

- `js/core/unified-data-manager.js:23`
- `js/core/unified-data-manager.js:475`
- `js/core/unified-data-manager.js:501`

### `ThemeMeta`

```json
{
  "themeId": "theme-1730000000000",
  "themeName": "工作主题",
  "themeType": "default",
  "bgImageUrl": null,
  "bgImagePath": null,
  "bgOpacity": 30,
  "isActive": false,
  "type": "chrome",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

其中：

- `type`：数据来源类型，当前代码里可能是 `chrome`、`supabase`、`cloudflare`。
- `themeType`：主题视觉类型，与数据来源不是同一个概念。
- `updateThemeMetadata()` 允许更新的字段只有：
  - `themeName`
  - `themeType`
  - `bgImageUrl`
  - `bgImagePath`
  - `bgOpacity`

---

## 3.2 `ConfigData`

定义来源：`js/core/unified-data-manager.js:45`

```json
{
  "categories": [
    {
      "id": "cat-1730000000000",
      "name": "默认分类",
      "color": "#4285f4",
      "collapsed": false,
      "order": 0,
      "shortcuts": []
    }
  ],
  "settings": {
    "viewMode": "grid"
  }
}
```

这是每个主题对应的一整份工作区数据，也是以下两类 key 的值结构：

- `chrome.storage.sync` 中的 `chrome_sync_${themeId}`
- `chrome.storage.local` 中的 `cardTabData_${themeId}`

### `Category`

结构参考：`js/core/storage-adapter.js:130`

```json
{
  "id": "cat-1730000000000",
  "name": "常用网站",
  "color": "#4285f4",
  "collapsed": false,
  "order": 0,
  "shortcuts": []
}
```

字段说明：

- `id`：分类唯一 ID。
- `name`：分类名。
- `color`：分类颜色。
- `collapsed`：分类是否折叠。
- `order`：分类排序值。
- `shortcuts`：当前分类下的快捷方式列表。

### `Shortcut`

结构参考：`js/core/storage-adapter.js:177`

```json
{
  "id": "shortcut-1730000000000",
  "name": "OpenAI",
  "url": "https://openai.com",
  "iconType": "letter",
  "iconColor": "#4285f4",
  "iconUrl": "",
  "order": 0
}
```

字段说明：

- `id`：快捷方式唯一 ID。
- `name`：显示名称。
- `url`：跳转地址。
- `iconType`：图标类型，当前代码默认值为 `letter`，也兼容 `favicon`、`custom`。
- `iconColor`：字母图标或默认图标颜色。
- `iconUrl`：自定义图标地址。
- `order`：分类内排序值。

### `settings`

目前在代码里明确可见的字段只有：

```json
{
  "viewMode": "grid"
}
```

兼容值参考：`js/core/storage-adapter.js:382`

- `viewMode: 'grid'`
- `viewMode: 'list'`

---

## 3.3 `SupabaseConfig`

相关读取/写入位于：

- `js/core/unified-data-manager.js:199`
- `js/core/sync-adapter.js:26`

常见结构：

```json
{
  "url": "https://xxxx.supabase.co",
  "anonKey": "xxxx"
}
```

补充：

- 某些内部调用会额外带 `userId`，但当前配置对象的核心字段主要是 `url`、`anonKey`。
- 当前是否使用 Supabase，不再由配置对象里的 `enabled` 决定，而是由当前主题的 `theme.type` 决定。

---

## 3.4 `CloudflareConfig`

相关读取/写入位于：

- `js/core/unified-data-manager.js:200`
- `js/core/sync-adapter.js:31`

常见结构：

```json
{
  "workerUrl": "https://card-tab-sync.xxx.workers.dev",
  "accessToken": "xxxx"
}
```

当前是否使用 Cloudflare，不再由配置对象里的 `enabled` 决定，而是由当前主题的 `theme.type` 决定。

---

## 3.5 `preferredSearchEngine`

相关代码：

- `js/features/search.js:664`
- `js/features/search.js:678`
- `js/features/search.js:686`

结构非常简单：

```json
0
```

说明：

- 这是一个数字索引，指向搜索栏当前选中的搜索引擎。
- 读取时会经过 `parseInt()`，所以实际存成字符串或数字都能兼容，但当前代码写入的是 `this.currentSearchEngine`，通常是数字。

---

## 3.6 Cloudflare 初始化缓存结构

实现位于：`js/core/cf-resource-manager.js:191`

### `card_tab_cf_setup_preferences`

默认结构：

```json
{
  "autoSetupEnabled": true,
  "saveApiToken": false
}
```

来源：`js/core/cf-resource-manager.js:198`

### `card_tab_cf_setup_profile`

自动创建资源后的结构参考：`js/core/cf-resource-manager.js:480`

```json
{
  "source": "auto",
  "accountId": "xxxx",
  "baseName": "",
  "workerName": "card-tab-sync",
  "workerUrl": "https://card-tab-sync.xxx.workers.dev",
  "accessToken": "xxxx",
  "databaseId": "xxxx",
  "databaseName": "card-tab-db",
  "bucketName": "card-tab-files",
  "workersSubdomain": "xxx",
  "initialized": false,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

手动保存/同步后的结构参考：`js/core/cf-resource-manager.js:521`

```json
{
  "source": "manual",
  "accountId": "xxxx",
  "baseName": "card-tab",
  "workerName": "card-tab-sync",
  "workerUrl": "https://card-tab-sync.xxx.workers.dev",
  "accessToken": "xxxx",
  "databaseId": "xxxx",
  "databaseName": "card-tab-db",
  "bucketName": "card-tab-files",
  "workersSubdomain": "xxx",
  "initialized": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-02T00:00:00.000Z",
  "lastInitializedAt": "2025-01-02T00:00:00.000Z",
  "lastConnectedAt": "2025-01-02T00:00:00.000Z"
}
```

说明：

- `source`：来源，可能是 `auto`、`manual`、`sync`。
- `initialized`：数据库/资源是否已初始化完成。
- `lastInitializedAt`、`lastConnectedAt`：后续流程补充字段，旧 profile 里可能没有。

### `card_tab_cf_setup_api_token`

结构就是一个纯字符串：

```json
"xxxx-api-token"
```

是否保存由 `saveApiToken` 控制。

---

## 4. 数据读写关系

## 4.1 加载当前主题数据

逻辑位于：`js/core/unified-data-manager.js:236`

读取顺序如下：

1. 如果不是强制刷新，先读 `chrome.storage.local` 的 `cardTabData_${themeId}`。
2. 如果本地缓存命中：
   - 直接作为 `currentConfigData` 使用。
   - 若当前主题是云主题（`supabase` / `cloudflare`），会异步后台刷新缓存。
3. 如果缓存未命中或强制刷新：
   - `type = 'supabase'`：从 Supabase 读取。
   - `type = 'cloudflare'`：从 Cloudflare 读取。
   - `type = 'chrome'`：从 `chrome.storage.sync` 的 `chrome_sync_${themeId}` 读取。
4. 读到数据后，再回写到 `cardTabData_${themeId}` 缓存。
5. 如果什么都没有，就创建默认 `ConfigData` 并立即保存。

## 4.2 保存当前主题数据

逻辑位于：`js/core/unified-data-manager.js:306`

保存顺序如下：

1. 先保存到主数据源：
   - `supabase` → 远端 Supabase
   - `cloudflare` → 远端 Cloudflare
   - `chrome` → `chrome.storage.sync` 的 `chrome_sync_${themeId}`
2. 清掉本地缓存 `cardTabData_${themeId}`。
3. 用最新数据重新写入 `cardTabData_${themeId}`。
4. 更新内存中的 `currentConfigData`。

补充：

- 如果 `saveCurrentConfigData(data)` 里带了 `data._themeMeta`，这部分会先合并到主题元数据里，然后从 `data` 中删除，不会写进 `ConfigData` 本体。
- 也就是说，`_themeMeta` 是一次性的过渡字段，不属于持久化结构。

## 4.3 缓存清理

相关逻辑：

- `js/core/unified-data-manager.js:364`
- `js/core/unified-data-manager.js:375`
- `js/core/unified-data-manager.js:380`
- `js/core/unified-data-manager.js:559`

当前提供的缓存操作：

- `loadFromCache(themeId)`：读取 `cardTabData_${themeId}`。
- `saveToCache(themeId, data)`：写入 `cardTabData_${themeId}`。
- `clearCache(themeId)`：删除某个主题缓存。
- `clearAllCacheExceptCurrent()`：批量删除 `cardTabData_` 前缀的其他缓存。
- `switchTheme(themeId)`：切换主题时会触发缓存清理和重新加载。

---

## 5. 示例快照

下面是一份更接近真实运行时的示例。

### `chrome.storage.sync`

```json
{
  "card_tab_app_data": {
    "version": "2.0.0",
    "currentThemeId": "default",
    "themes": {
      "default": {
        "themeId": "default",
        "themeName": "默认主题",
        "themeType": "default",
        "bgImageUrl": null,
        "bgImagePath": null,
        "bgOpacity": 30,
        "isActive": true,
        "type": "chrome",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      },
      "theme-1730000000000": {
        "themeId": "theme-1730000000000",
        "themeName": "工作主题",
        "themeType": "default",
        "bgImageUrl": null,
        "bgImagePath": null,
        "bgOpacity": 30,
        "isActive": false,
        "type": "supabase",
        "createdAt": "2025-01-02T00:00:00.000Z",
        "updatedAt": "2025-01-02T00:00:00.000Z"
      }
    }
  },
  "chrome_sync_default": {
    "categories": [
      {
        "id": "cat-1",
        "name": "默认分类",
        "color": "#4285f4",
        "collapsed": false,
        "order": 0,
        "shortcuts": [
          {
            "id": "shortcut-1",
            "name": "OpenAI",
            "url": "https://openai.com",
            "iconType": "letter",
            "iconColor": "#4285f4",
            "iconUrl": "",
            "order": 0
          }
        ]
      }
    ],
    "settings": {
      "viewMode": "grid"
    }
  },
  "supabase_config": {
    "url": "https://xxxx.supabase.co",
    "anonKey": "xxxx"
  },
  "cf_config": {
    "workerUrl": "https://card-tab-sync.xxx.workers.dev",
    "accessToken": "xxxx"
  },
  "preferredSearchEngine": 0
}
```

### `chrome.storage.local`

```json
{
  "cardTabData_default": {
    "categories": [
      {
        "id": "cat-1",
        "name": "默认分类",
        "color": "#4285f4",
        "collapsed": false,
        "order": 0,
        "shortcuts": [
          {
            "id": "shortcut-1",
            "name": "OpenAI",
            "url": "https://openai.com",
            "iconType": "letter",
            "iconColor": "#4285f4",
            "iconUrl": "",
            "order": 0
          }
        ]
      }
    ],
    "settings": {
      "viewMode": "grid"
    }
  },
  "card_tab_cf_setup_preferences": {
    "autoSetupEnabled": true,
    "saveApiToken": false
  },
  "card_tab_cf_setup_profile": {
    "source": "manual",
    "accountId": "xxxx",
    "baseName": "card-tab",
    "workerName": "card-tab-sync",
    "workerUrl": "https://card-tab-sync.xxx.workers.dev",
    "accessToken": "xxxx",
    "databaseId": "xxxx",
    "databaseName": "card-tab-db",
    "bucketName": "card-tab-files",
    "workersSubdomain": "xxx",
    "initialized": true,
    "createdAt": "2025-01-02T00:00:00.000Z",
    "updatedAt": "2025-01-02T00:00:00.000Z",
    "lastInitializedAt": "2025-01-02T00:00:00.000Z",
    "lastConnectedAt": "2025-01-02T00:00:00.000Z"
  },
  "card_tab_cf_setup_api_token": "xxxx-api-token"
}
```

---

## 6. 需要特别注意的点

- `card_tab_app_data` 和 `ConfigData` 是分开的两套结构：
  - 前者管理主题“元信息”。
  - 后者管理分类、快捷方式、视图设置。
- `cardTabData_${themeId}` 是缓存，不一定是最终真源。
- 对云主题来说，最终真源在远端；本地只保留缓存副本。
- `currentConfigData` 是运行时内存态，页面刷新后需要重新从存储恢复。
- `preferredSearchEngine` 属于额外的用户偏好，不属于主题工作区数据。
- `js/vendor/supabase.min.js` 内部可能会使用浏览器 `localStorage`，但那属于第三方库内部行为，不是项目自定义的数据结构，这里不纳入本文档。
- 在非扩展环境下，部分逻辑会退回到：
  - `globalThis.__cardTabFallbackStorage`
  - `globalThis.__cardTabSearchPreferences`
  这些属于运行时兜底，不是 Chrome 扩展正式存储结构。

---

## 7. 一句话总结

如果只看“业务数据”本身，可以把当前项目理解成：

- `card_tab_app_data` 管主题目录。
- `chrome_sync_${themeId}` / 远端云端数据 管主题真实内容。
- `cardTabData_${themeId}` 管主题本地缓存。
- Cloudflare setup 的 3 个 `card_tab_cf_setup_*` key 管初始化向导状态。
- `preferredSearchEngine` 是独立的搜索偏好键。
