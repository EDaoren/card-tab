# Card Tab Edge 上线清单

本文档从产品、审核、技术和运营四个角度，梳理 Card Tab 上线 Microsoft Edge Add-ons 前需要补齐的事项。

## 目标

- 保持一套代码，同时支持 Chrome 和 Edge。
- 不把 Edge 做成单独分支，优先通过能力检测和降级策略兼容。
- 明确区分“本地保存”“浏览器账号同步”“跨浏览器云同步”，避免用户误解。
- 让商店审核、安装引导、隐私说明和产品文案都不再是 Chrome-only。

## 当前判断

### 已具备的基础

- 扩展已是标准 Chromium Manifest V3 结构，`manifest.json` 本身没有明显阻碍 Edge 安装的专属配置。
- `runtime`、`storage`、`tabs`、`contextMenus` 等核心 API 用法较常规，具备双端兼容基础。
- 构建产物是通用 zip 包，理论上可以同时用于 Chrome 和 Edge 商店发布。

### 当前主要风险

- 产品文案、安装说明、隐私说明、发布文档大量写死为 Chrome，容易让 Edge 用户和审核方误判为“不支持 Edge”。
- 产品内部把本地/浏览器同步模式命名为 `chrome`，这会在 Edge 里造成认知偏差。
- 默认搜索能力直接依赖 `chrome.search.query`，后续需要做能力检测和降级方案。
- 全站内容脚本、远程主机权限、自托管云同步等功能需要更清楚的审核说明。

## 发布策略

### 推荐策略

- 采用“一套代码，两端发布”。
- 保持同功能优先，浏览器差异处做降级，而不是为 Edge 单独开发分叉。
- 文案上从“Chrome 扩展”升级为“支持 Chrome / Edge 的新标签页扩展”。
- 对用户明确说明：浏览器内同步和跨浏览器同步不是一回事。

### 不推荐策略

- 不建议引入 `edge.*` 与 `chrome.*` 双实现心智。
- 不建议为 Edge 新建独立功能分支，除非后续出现明确的审核要求或体验差异。

## 必做项

### 1. 产品定位与文案统一

目标：所有对外说明从 Chrome-only 改为 Chrome / Edge 双支持。

需要调整的内容：

- `README.md`
- `README_EN.md`
- `privacy-policy.html`
- `PUBLISHING.md`
- `PUBLISHING_CHECKLIST.md`
- `store-assets/README.md`
- `build.js` 中与“Chrome Extension”相关的说明文本

需要补充的信息：

- Edge 手动安装路径：`edge://extensions/`
- Edge 商店版本说明
- “Add to Chrome” 类文案改为中性表述，例如“安装扩展”“添加到浏览器”
- 标题和描述中避免只出现 Chrome 品牌

验收标准：

- 用户只看 README、隐私政策和商店介绍，也能明确知道该扩展支持 Edge。
- 文案不再暗示同步只发生在 Chrome 设备之间。

### 2. 重新定义同步能力

目标：把产品里的“同步”拆成三层，减少误解。

需要统一的产品定义：

- 本地保存：数据仅保存在当前浏览器本机。
- 浏览器账号同步：通过浏览器提供的同步能力在同一浏览器生态内同步。
- 云同步：通过用户自己的 Supabase / Cloudflare 资源，实现跨设备和跨浏览器同步。

需要强调的产品事实：

- `chrome.storage.local` 在 Chrome 和 Edge 中都可用，但只保存在当前浏览器本机。
- `chrome.storage.sync` 在 Chrome 和 Edge 中都可用，但两边不会互通。
- 如果用户希望 Chrome 与 Edge 之间同步，必须使用 Supabase 或 Cloudflare。

建议调整的实现与文案：

- 将用户可见的“chrome 模式”改名为“本地模式”或“浏览器同步模式”。
- 保留内部兼容键值时，可以继续使用 `chrome` 作为存量数据标识，但 UI 不应直接暴露该词。
- 在设置页增加简短说明：浏览器同步仅在同一浏览器账号体系内生效。

重点文件：

- `js/ui/settings-ui.js`
- `js/core/sync-provider.js`
- `js/core/sync-adapter.js`
- `js/core/unified-data-manager.js`
- `js/core/storage-adapter.js`
- `privacy-policy.html`
- `README.md`
- `README_EN.md`

验收标准：

- Edge 用户能理解“本地模式”“浏览器同步”“云同步”的区别。
- 不会因为看到 `chrome.storage.sync` 或 `chrome` 模式而误以为 Edge 不受支持。

### 3. 审核友好的权限与数据流说明

目标：把“为什么需要这些权限”讲清楚，便于 Edge 商店审核。

当前需要说明的权限和能力：

- `storage`：保存卡片、主题、设置和缓存数据。
- `activeTab`：右键添加当前页面时读取当前标签页元信息。
- `contextMenus`：提供“添加到 Card Tab”的右键入口。
- `search`：使用浏览器默认搜索能力。
- `content_scripts`：展示右键添加后的临时弹窗，并收集最小必要的页面元信息。
- `host_permissions`：连接用户自有的 Supabase 或 Cloudflare 资源。

审核材料里应强调：

- 不读取完整页面正文。
- 不采集浏览历史。
- 不做后台跟踪或广告分析。
- 只有在用户主动触发添加操作时，才读取标题、URL、favicon 等必要信息。
- 云同步连接的是用户自有后端，而不是开发者的集中式服务器。

建议产出：

- 一版 Edge 商店可直接使用的权限说明文案。
- 一版简短的数据流说明，用于商店提审备注或 FAQ。

重点文件：

- `manifest.json`
- `privacy-policy.html`
- `PUBLISHING.md`
- `PUBLISHING_CHECKLIST.md`

验收标准：

- 每项权限都能用一句产品语言解释清楚。
- 审核人员可快速理解内容脚本和远程权限的必要性。

### 4. 浏览器能力检测与降级

目标：Edge 端优先保持可用，其次才是完全一致。

需要重点做能力检测的点：

- `chrome.search.query`
- `chrome.storage.sync`
- 浏览器启动后的新标签页覆盖行为
- 右键菜单与内容脚本通信

实现原则：

- 优先做特性检测，而不是做浏览器品牌判断。
- 某项能力不可用时，给出可理解的退化行为，而不是直接报“Chrome API 不可用”。
- 用户提示语避免出现“请检查 Chrome”之类文案。

当前特别需要改的文案/代码点：

- `js/main.js` 中“Chrome 扩展 API 不可用”的错误提示
- `js/features/search.js` 中对 Chrome Search API 的硬依赖和 Chrome-only 调试文案

验收标准：

- 在 Edge 中遇到能力差异时，用户得到的是可操作的提示，而不是品牌错误。
- 主要核心流程在 Edge 中至少有降级方案。

### 5. Edge 手动验收清单

目标：上线前先验证真实 Edge 用户路径。

必须手动验证：

- 通过 `edge://extensions/` 加载未打包目录。
- 新标签页覆盖是否生效。
- 分类 CRUD 是否正常。
- 快捷方式新增、编辑、删除是否正常。
- 分类与快捷方式拖拽排序是否正常。
- `/` 搜索是否正常。
- 右键菜单添加当前页面/链接是否正常。
- `chrome.storage.local` 的本地持久化是否正常。
- `chrome.storage.sync` 的浏览器内同步是否正常。
- Supabase 同步是否正常。
- Cloudflare D1/R2 同步是否正常。
- 离线模式与回退逻辑是否正常。
- 打包后的 zip 在干净 Edge Profile 中能否成功安装。

建议记录：

- Edge 版本号
- Windows 版本号
- 登录/未登录微软账号两种状态的表现差异
- 是否开启浏览器同步

### 6. Edge 商店素材与运营准备

目标：不是“把 Chrome 包复制过去”，而是准备一套可上架的 Edge 材料。

需要准备：

- Edge 商店标题、副标题、简介和详细描述
- Edge 商店截图
- Edge 商店图标与宣传图
- Edge 版安装说明
- Edge 版常见问题

建议突出的话术：

- 适合工作与日常书签整理
- 本地优先，隐私友好
- 可选自托管云同步
- 支持 Chrome / Edge

建议避免的话术：

- “同步到你的 Chrome 设备”
- “Chrome only”
- 任何容易让 Edge 用户感觉自己是次级支持对象的表述

## 建议做项

### 1. 调整内部命名，减少 Chrome 偏见

建议把对外展示的 `chrome` 类型逐步收敛为更中性的概念，例如：

- `local`
- `browser-sync`
- `device-sync`

注意事项：

- 若已有用户数据依赖 `chrome` 作为配置类型，不建议直接删除旧值。
- 可以通过兼容映射保持旧数据可读，新 UI 使用新名称。

### 2. 增加“同步说明”入口

建议在设置页或 README 增加简单 FAQ：

- 本地模式和云同步有什么区别？
- 为什么 Chrome 和 Edge 之间不会自动同步？
- 什么场景下应该用 Supabase 或 Cloudflare？

### 3. 为 Edge 用户准备单独截图

即使功能相同，也建议准备 Edge 浏览器框架下的截图，以提升商店页面的一致性和信任感。

### 4. 构建脚本输出中性化

当前构建脚本说明仍偏向 Chrome 商店发布。建议把“Chrome Extension”调整为“browser extension”或“Chrome / Edge extension”。

## 可延期项

### 1. Edge 专属上手引导

如果首版要尽快上线，可先不做 Edge 专属 onboarding，只保证文案准确。

### 2. Edge 专属功能差异页

除非后续出现明确的不兼容能力，否则无需单独维护浏览器差异说明页。

### 3. 双产物命名

首版可继续使用统一 zip 包；如果后续需要区分发布渠道，再考虑输出 `card-tab-edge.zip`。

## 仓库改造建议

### 第一阶段：文档和审核材料

- 更新 `README.md`
- 更新 `README_EN.md`
- 更新 `privacy-policy.html`
- 拆分或补充 `PUBLISHING.md`
- 扩展 `PUBLISHING_CHECKLIST.md`
- 更新 `store-assets/README.md`

目标：先让外部认知正确。

### 第二阶段：产品文案与设置页

- 调整设置页中的 `chrome` 对外命名
- 补充同步说明和浏览器兼容说明
- 修正文案中的 Chrome-only 错误提示

目标：让 Edge 用户在使用中不产生割裂感。

### 第三阶段：兼容性兜底

- 为搜索能力增加降级策略
- 审查全部浏览器能力提示语
- 补齐 Edge 手动验收记录

目标：保证首版 Edge 发布稳定。

## 上线前最终判断标准

只有在以下条件同时满足时，才建议提交 Edge 商店审核：

- 文案层面已明确支持 Edge。
- 隐私政策已明确区分本地保存、浏览器同步和云同步。
- 设置页不再把 Edge 用户暴露在 `chrome` 品牌语义下。
- Edge 手动验收已跑通核心路径。
- 权限与数据流说明已准备完毕。
- Edge 商店截图和介绍文案已独立准备。

## 建议的下一步

按优先级，建议先做以下三件事：

1. 先改文档和隐私说明，统一为 Chrome / Edge 双支持。
2. 再改设置页和错误提示，把对外的 `chrome` 语义替换成中性表述。
3. 最后补浏览器能力降级和 Edge 上架材料。
