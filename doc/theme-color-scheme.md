# Card Tab 配色方案审计文档

> 基于 `styles/main.css` 和 `styles/settings.css` 的完整配色分析。
> 生成日期：2026-03-20

---

## 1. CSS 变量定义总表（6 种主题对比）

### 1.1 `:root` 默认值

| 变量 | 值 |
|---|---|
| `--primary-color` | `#4285f4` |
| `--primary-light` | `#e8f0fe` |
| `--primary-color-rgb` | `66, 133, 244` |
| `--secondary-color` | `#0f9d58` |
| `--danger-color` | `#ea4335` |
| `--text-color` | `#333` |
| `--text-secondary` | `#666` |
| `--bg-color` | `#fff` |
| `--card-bg-color` | `#fff` |
| `--input-bg` | `#fff` |
| `--hover-color` | `#f5f5f5` |
| `--border-color` | `#ddd` |
| `--shadow-color` | `rgba(0, 0, 0, 0.1)` |
| `--overlay-color` | `rgba(255, 255, 255, 0.7)` |
| `--background-color` | `#ffffff` |
| `--card-background` | `rgba(255, 255, 255, 0.9)` |
| `--modal-background` | `rgba(255, 255, 255, 0.98)` |
| `--border-radius` | `12px` |
| `--transition-speed` | `0.3s` |

### 1.2 各主题变量对比

| 变量 | default | blue | green | purple | pink | dark |
|---|---|---|---|---|---|---|
| `--primary-color` | `#4285f4` | `#4285f4` | `#0f9d58` | `#673ab7` | `#e91e63` | `#8ab4f8` |
| `--primary-light` | `#e8f0fe` | `#e8f0fe` | `#e6f4ea` | `#f3e8fd` | `#fce4ec` | `#303134` |
| `--primary-color-rgb` | `66,133,244` | `66,133,244` | `15,157,88` | `103,58,183` | `233,30,99` | `138,180,248` |
| `--bg-color` | `#fff` | `#e8f0fe` | `#e6f4ea` | `#f3e8fd` | `#fce4ec` | `#292a2d` |
| `--card-bg-color` | `#fff` | `#fff` | `#fff` | `#fff` | `#fff` | `#35363a` |
| `--text-color` | `#333` | `#333` | `#333` | `#333` | `#333` | `#e8eaed` |
| `--text-secondary` | `#666` | `#4285f4` | `#0f9d58` | `#673ab7` | `#e91e63` | `#9aa0a6` |
| `--border-color` | `#ddd` | `#c6dafc` | `#ceead6` | `#e5d4fa` | `#f8bbd0` | `#5f6368` |
| `--hover-color` | `#f5f5f5` | `#d2e3fc` | `#d8eee1` | `#ead6fd` | `#f8d0e0` | `#3c4043` |
| `--overlay-color` | `rgba(255,255,255,0.7)` | `rgba(232,240,254,0.7)` | `rgba(230,244,234,0.7)` | `rgba(243,232,253,0.7)` | `rgba(252,228,236,0.7)` | `rgba(41,42,45,0.7)` |

**dark 主题额外覆盖的变量**（其他主题无此项）：

| 变量 | dark 值 |
|---|---|
| `--shadow-color` | `rgba(0, 0, 0, 0.3)` |
| `--input-bg` | `#202124` |
| `--card-background` | `rgba(53, 54, 58, 0.9)` |
| `--modal-background` | `rgba(53, 54, 58, 0.98)` |

---

## 2. 各 UI 元素取色情况

### 2.1 主页（main.css）

#### 2.1.1 已跟随主题变量的元素

| 元素 | 属性 | 取值 |
|---|---|---|
| `body` | `background-color` | `var(--bg-color)` |
| `body` | `color` | `var(--text-color)` |
| `.background-container` | `background-color` | `var(--bg-color)` |
| `.background-overlay` | `background-color` | `var(--overlay-color)` |
| `.search-box` | `background-color` | `var(--card-bg-color)` |
| `.search-input-container input` | `color` | `var(--text-color)` |
| `.search-button:hover` | `color` | `var(--primary-color)` |
| `.search-engine-option.active` | `background-color` | `rgba(var(--primary-color-rgb), 0.1)` |
| `.search-engine-option.active` | `color` | `var(--primary-color)` |
| `.search-engine-dropdown-menu` | `background` | `var(--card-bg-color)` |
| `.search-dropdown` | `background` | `var(--card-bg-color)` |
| `.search-result-item.no-results` | `color` | `var(--text-secondary)` |

#### 2.1.2 仍然硬编码的颜色

| 元素 | 属性 | 硬编码值 | 建议 |
|---|---|---|---|
| `.search-box` | `border` | `#dfe1e5` | 改用 `var(--border-color)` |
| `.search-box` | `box-shadow` | `rgba(64, 60, 67, 0.16)` | 改用 `var(--shadow-color)` |
| `.search-box:hover` | `box-shadow` | `rgba(64, 60, 67, 0.24)` | 同上 |
| `.search-box.has-results .search-dropdown` | `border` | `#dfe1e5` | 改用 `var(--border-color)` |
| `.search-engine-icon` | `color` | `#9aa0a6` | 改用 `var(--text-secondary)` |
| `.search-engine-dropdown` | `color` | `#5f6368` | 改用 `var(--text-secondary)` |
| `.search-engine-dropdown-menu` | `border` | `#dfe1e5` | 改用 `var(--border-color)` |
| `.search-engine-selector:hover` | `background-color` | `rgba(0, 0, 0, 0.04)` | 暗色下应用 `rgba(255,255,255,0.06)` |
| `.search-engine-option:hover` | `background-color` | `rgba(0, 0, 0, 0.04)` | 同上 |
| `.search-engine-option .material-symbols-rounded` | `color` | `#9aa0a6 !important` | 改用 `var(--text-secondary)` |
| `.search-input-container input::placeholder` | `color` | `#9aa0a6` | 改用 `var(--text-secondary)` |
| `.search-button` | `color` | `#5f6368` | 改用 `var(--text-secondary)` |
| `.search-dropdown` | `border` | `#dfe1e5` | 改用 `var(--border-color)` |
| `.search-result-item:hover` | `background-color` | `rgba(0, 0, 0, 0.04)` | 暗色下应用 `rgba(255,255,255,0.06)` |
| `.search-button:active` | `background-color` | `rgba(0, 0, 0, 0.08)` | 暗色下应用 `rgba(255,255,255,0.1)` |
| scrollbar thumb | `background` | `rgba(0, 0, 0, 0.15)` | 暗色下应用 `rgba(255,255,255,0.2)` |

> **品牌色（可保留硬编码）**：`.search-engine-badge-google` (`#4285f4`)、`.search-engine-badge-bing` (`#008373`)、`.search-engine-badge-baidu` (`#2932e1`)、`.search-engine-badge-ddg` (`#de5833`)。这些对应搜索引擎品牌色，不需要跟随主题。

### 2.2 设置页（settings.css）

#### 2.2.1 已跟随主题变量的元素

| 元素 | 属性 | 取值 |
|---|---|---|
| `body` | `background-color` | `var(--bg-color, #f8f9fa)` |
| `body` | `color` | `var(--text-color, #202124)` |
| `.settings-layout` | `background-color` | `var(--bg-color)` |
| `.settings-sidebar` | `background-color` | `var(--card-bg-color)` |
| `.settings-sidebar` | `border-right` | `var(--border-color)` |
| `#back-to-home-btn` | `background` | `var(--hover-color)` |
| `#back-to-home-btn` | `color` | `var(--text-color)` |
| `.sidebar-header h2` | `color` | `var(--text-color)` |
| `.nav-item` | `color` | `var(--text-secondary)` |
| `.nav-item:hover` | `background-color` | `var(--hover-color)` |
| `.nav-item:hover` | `color` | `var(--text-color)` |
| `.nav-item.active` | `background-color` | `var(--primary-light)` |
| `.nav-item.active` | `color` | `var(--primary-color)` |
| `.settings-content` | `background-image` | `radial-gradient(var(--border-color) ...)` |
| `.panel-header h3` | `color` | `var(--text-color)` |
| `.panel-desc` | `color` | `var(--text-secondary)` |
| `.primary-btn` | `background` | `var(--primary-color)` |
| `.primary-btn` | `box-shadow` | `rgba(var(--primary-color-rgb), 0.3)` |
| `.secondary-btn` | `background-color` | `var(--hover-color)` |
| `.secondary-btn` | `color` | `var(--text-color)` |
| `.tab-btn` | `color` | `var(--text-secondary)` |
| `.tab-btn:hover` | `color` | `var(--text-color)` |
| `.tab-btn.active` | `color` / `border-bottom-color` | `var(--primary-color)` |
| `.theme-card` | `background` | `var(--card-bg-color)` |
| `.theme-card` | `border` | `var(--border-color)` |
| `.theme-card.active-theme` | `border` | `var(--primary-color)` |
| `.theme-name` | `color` | `var(--text-color)` |
| `.theme-meta` | `color` | `var(--text-secondary)` |
| `.form-group label` | `color` | `var(--text-color)` |
| `.form-group input` | `border` | `var(--border-color)` |
| `.form-group input` | `background-color` | `var(--input-bg)` |
| `.form-group input` | `color` | `var(--text-color)` |
| `.form-group input:focus` | `border-color` | `var(--primary-color)` |
| `.form-group input:focus` | `box-shadow` | `rgba(var(--primary-color-rgb), 0.1)` |
| `.edit-form-container` | `background` | `var(--card-bg-color)` |
| `.edit-form-container` | `border` | `var(--border-color)` |
| `.sync-service-card` | `background` | `var(--card-bg-color)` |
| `.sync-service-card` | `border` | `var(--border-color)` |
| `.sync-status-card` | `background` | `var(--card-bg-color)` |
| `.sync-status-card` | `border` | `var(--border-color)` |
| `.data-card` | `background` | `var(--card-bg-color)` |
| `.data-card` | `border` | `var(--border-color)` |
| `.data-card p` | `color` | `var(--text-secondary)` |
| `.about-content` | `background` | `var(--card-bg-color)` |
| `.about-content` | `border` | `var(--border-color)` |
| `.bg-preview-area` | `background` | `var(--hover-color)` |
| `.bg-preview-area` | `border` | `var(--border-color)` |
| `.bg-preview-area:hover` | `border-color` | `var(--primary-color)` |
| `.bg-preview-area:hover` | `background` | `var(--primary-light)` |
| `.sync-inline-toggle` | `background` / `color` | `rgba(var(--primary-color-rgb), ...)` / `var(--primary-color)` |
| `.sync-provider-note` | `color` | `var(--primary-color)` |
| `.sync-resource-item` | `background` / `border` | `var(--hover-color)` / `var(--border-color)` |
| `.sync-resource-value` | `background` / `color` / `border` | `var(--card-bg-color)` / `var(--text-color)` / `var(--border-color)` |
| `.color-option.selected` | `outline` | `var(--primary-color)` |

#### 2.2.2 仍然硬编码的颜色（设置页）

| 元素 | 属性 | 硬编码值 | 说明 |
|---|---|---|---|
| `.status-indicator` | `background-color` | `#dadce0` | 语义色（未连接状态），可保留 |
| `.status-indicator.active` | `background-color` | `#34a853` | 语义色（已连接 = 绿色），可保留 |
| `.sync-status-badge.is-ready` | `color` | `#188038` | 语义色（成功 = 绿色），可保留 |
| `.sync-status-badge.is-error` | `color` | `#c5221f` | 语义色（错误 = 红色），可保留 |
| `.sync-status-badge.is-pending` | `color` | `#b06000` | 语义色（等待 = 橙色），可保留 |
| `.sync-provider-lock-hint` | `color` | `#8a5200` | 语义色（警告 = 橙色），可保留 |
| `.text-danger` | `color` | `#ea4335 !important` | 语义色（危险 = 红色），可保留 |
| `.color-option[data-type="..."]` | `background-color` | 各固定值 | 主题预览色块，必须保留硬编码 |

---

## 3. 暗色主题特殊覆盖

暗色主题 (`body.theme-dark`) 除了通过 CSS 变量改变颜色外，还对大量元素做了显式覆盖。

### 3.1 main.css 中的暗色覆盖

| 选择器 | 属性 | 值 |
|---|---|---|
| `.form-group input[type="text/url/password"]` | `background-color` | `#202124` |
| 同上 | `border-color` | `#5f6368` |
| 同上 | `color` | `#ffffff` |
| 同上 | `font-weight` | `500` |
| 同上 `:focus` | `border-color` | `#8ab4f8` |
| 同上 `:focus` | `box-shadow` | `rgba(138, 180, 248, 0.2)` |
| 同上 `:focus` | `background-color` | `#1a1a1a` |
| 同上 `:hover` | `border-color` | `#80868b` |
| 同上 `:hover` | `background-color` | `#1a1a1a` |
| 同上 `::placeholder` | `color` | `#9aa0a6` |
| 同上 `::placeholder` | `opacity` | `0.8` |

### 3.2 settings.css 中的暗色覆盖

| 选择器 | 属性 | 值 |
|---|---|---|
| `.settings-sidebar` | `background-color` | `#202124` |
| `.settings-sidebar` | `border-right-color` | `#3c4043` |
| `.settings-sidebar` | `box-shadow` | `rgba(0, 0, 0, 0.2)` |
| `#back-to-home-btn` | `background` | `#3c4043` |
| `#back-to-home-btn` | `color` | `#e8eaed` |
| `#back-to-home-btn:hover` | `background` | `#5f6368` |
| `.nav-item:hover` | `background-color` | `#3c4043` |
| `.nav-item.active` | | 使用 `var(--primary-light)` / `var(--primary-color)`（已随变量变化） |
| `.settings-content` | `background-image` | `radial-gradient(#3c4043 ...)` |
| `.form-group input` | `background-color` | `var(--input-bg, #202124)` |
| `.form-group input` | `border-color` | `#5f6368` |
| `.form-group input` | `color` | `#e8eaed` |
| `.form-group input:focus` | `border-color` | `var(--primary-color)` |
| `.form-group input:focus` | `box-shadow` | `rgba(var(--primary-color-rgb), 0.15)` |
| `.secondary-btn` | `background-color` | `#3c4043` |
| `.secondary-btn` | `color` | `#e8eaed` |
| `.secondary-btn` | `border-color` | `#5f6368` |
| `.secondary-btn:hover` | `background-color` | `#5f6368` |
| `.secondary-btn:hover` | `border-color` | `var(--primary-color)` |
| `.theme-card` | `background` | `#35363a` |
| `.theme-card` | `border-color` | `#5f6368` |
| `.theme-card` | `box-shadow` | `rgba(0, 0, 0, 0.2)` |
| `.theme-card:hover` | `box-shadow` | `rgba(0, 0, 0, 0.3)` |
| `.theme-card:hover` | `border-color` | `var(--primary-color)` |
| `.edit-form-container` | `background` / `border-color` | `#35363a` / `#5f6368` |
| `.sync-status-card` | `background` / `border-color` | `#35363a` / `#5f6368` |
| `.sync-service-card` | `background` / `border-color` | `#35363a` / `#5f6368` |
| `.data-card` | `background` / `border-color` | `#35363a` / `#5f6368` |
| `.data-card:hover` | `box-shadow` | `rgba(0, 0, 0, 0.3)` |
| `.about-content` | `background` / `border-color` | `#35363a` / `#5f6368` |
| `.bg-preview-area` | `background` / `border-color` | `#3c4043` / `#5f6368` |
| `.bg-preview-area:hover` | `border-color` / `background` | `var(--primary-color)` / `var(--primary-light)` |
| `.tabs` | `border-bottom-color` | `#5f6368` |
| `.primary-btn:hover` | `background` | `#669df6` |

> **注意**：暗色主题覆盖中很多 `#35363a`、`#5f6368`、`#3c4043` 实际上与 CSS 变量 `--card-bg-color`、`--border-color`、`--hover-color` 重复。这些覆盖之所以存在，是因为 `settings.css` 中的 fallback 值 (如 `var(--card-bg-color, #ffffff)`) 在变量未生效时需要保底。

---

## 4. 彩色主题 primary-btn hover 覆盖

在 `settings.css` 底部，为每个彩色主题的 `.primary-btn:hover` 设定了专属的深色变体：

| 主题 | 选择器 | hover 背景色 | 对应 primary-color |
|---|---|---|---|
| default / blue | （无覆盖，使用 `filter: brightness(0.85)`） | — | `#4285f4` |
| green | `body.theme-green .primary-btn:hover` | `#0b8043` | `#0f9d58` |
| purple | `body.theme-purple .primary-btn:hover` | `#512da8` | `#673ab7` |
| pink | `body.theme-pink .primary-btn:hover` | `#c2185b` | `#e91e63` |
| dark | `body.theme-dark .primary-btn:hover` | `#669df6` | `#8ab4f8` |

**设计思路**：hover 色为 primary-color 的加深变体（浅色主题加深，暗色主题提亮），提供按钮按压的视觉反馈。default/blue 主题使用 CSS `filter: brightness(0.85)` 作为通用方案。

---

## 5. 问题汇总

### 5.1 已正确跟随主题的部分

- 所有卡片背景 (`--card-bg-color`)
- 所有边框 (`--border-color`)（设置页侧）
- 所有主文本 (`--text-color`) 和辅助文本 (`--text-secondary`)
- 设置页的所有按钮 (`--primary-color`、`--hover-color`)
- 设置页的表单输入框 (`--input-bg`、`--border-color`、`--text-color`)
- 页面背景 (`--bg-color`) 和叠加层 (`--overlay-color`)
- 暗色主题的完整 Settings 覆盖

### 5.2 仍需修复的硬编码问题

| 优先级 | 文件 | 问题 | 影响 |
|---|---|---|---|
| **高** | main.css | 搜索框 `.search-box` 的 `border: #dfe1e5` 硬编码 | 暗色/彩色主题下搜索框边框不协调 |
| **高** | main.css | 搜索下拉框 `.search-dropdown` 及 `.search-engine-dropdown-menu` 的 `border: #dfe1e5` 硬编码 | 暗色主题下下拉菜单边框不协调 |
| **高** | main.css | `.search-engine-icon`、`.search-engine-dropdown`、`.search-button` 硬编码 `#5f6368` / `#9aa0a6` | 暗色主题下图标颜色对比度不足 |
| **高** | main.css | `::placeholder` 颜色 `#9aa0a6` 硬编码 | 暗色/彩色主题下输入框占位符颜色不变 |
| **中** | main.css | 多处 `:hover` 使用 `rgba(0, 0, 0, 0.04)` | 暗色主题下 hover 效果几乎不可见 |
| **中** | main.css | `box-shadow` 使用 `rgba(64, 60, 67, ...)` 硬编码 | 暗色主题下阴影不够深 |
| **低** | main.css | 滚动条 thumb 使用 `rgba(0, 0, 0, 0.15)` | 暗色主题下滚动条几乎不可见 |
| **可保留** | settings.css | 语义状态色（成功绿、错误红、警告橙） | 语义色不需随主题变化 |
| **可保留** | main.css | 搜索引擎品牌色（Google蓝、Bing绿、百度蓝、DDG橙） | 品牌色不应随主题变化 |

### 5.3 建议修复方案

1. **搜索框边框**：将 `#dfe1e5` 替换为 `var(--border-color)`
2. **图标/辅助文字色**：将 `#5f6368`、`#9aa0a6` 替换为 `var(--text-secondary)`
3. **hover 背景**：新增 `--hover-overlay` 变量，浅色主题 `rgba(0,0,0,0.04)`，暗色主题 `rgba(255,255,255,0.06)`
4. **阴影**：统一使用 `var(--shadow-color)` 并调整各主题的透明度
5. **placeholder 颜色**：使用 `var(--text-secondary)` 并降低 `opacity`

---

## 6. 主题色板速查

```
default   ████ #4285f4  bg:#fff      card:#fff      text:#333
blue      ████ #4285f4  bg:#e8f0fe   card:#fff      text:#333
green     ████ #0f9d58  bg:#e6f4ea   card:#fff      text:#333
purple    ████ #673ab7  bg:#f3e8fd   card:#fff      text:#333
pink      ████ #e91e63  bg:#fce4ec   card:#fff      text:#333
dark      ████ #8ab4f8  bg:#292a2d   card:#35363a   text:#e8eaed
```
