# Card Tab

<div align="center">
  <img src="icons/icon128.png" alt="Card Tab Logo" width="80">
</div>

A clean, customizable Chrome / Edge new tab extension for managing frequently used sites and shortcuts in a card-based layout, with multi-workspace support and optional cloud sync.

For the Chinese version, see `README.md`.

## Features

- Category management with drag-and-drop sorting
- Grid view / list view
- Press `/` to search shortcuts quickly
- Custom themes and backgrounds
- Right-click to add the current page quickly
- Multiple workspace management
- Optional Supabase / Cloudflare cloud sync

## Installation

### Chrome Web Store

- [Card Tab - Chrome Web Store](https://chrome.google.com/webstore/detail/jaofegmijnalgabmjficlpfmmebepmbd)

### Microsoft Edge

- Microsoft Edge is supported
- Not yet published on Edge Add-ons
- For now, build and extract `build/card-tab.zip`, then open `edge://extensions/` and load it manually

### Manual Installation (Chrome)

1. Download or clone this repository
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the repository root directory

## Quick Start

1. Create a category
2. Add shortcuts to the category
3. Press `/` to open search
4. Right-click a shortcut to edit or delete it
5. Manage workspaces, views, backgrounds, and sync in the settings page

## Import Preset Data

1. Download [`top_shortcuts_24.json`](top_shortcuts_24.json)
2. Open the settings page
3. Go to `Workspace` → choose a workspace → `Data Management`
4. Click **Import Data** and select the file

<img src="store-assets/screenshots/top_shortcuts.png" width="1000" alt="Project screenshot">

## Cloud Sync

- Cloud sync is optional; local storage is the default
- The **Cloud Connections** page stores global connection profiles only
- Sync is enabled or disabled inside each specific workspace
- Two backends are supported: `Supabase` and `Cloudflare D1/R2`

### Supabase: Getting the Required Values

1. Create a project in Supabase
2. Open `Project Settings` → `API`, then copy:
   - `Project URL`
   - `API Key (publishable / anon)` — required for normal use
   - `Service Role Key` — only needed for first-time initialization
3. Create a `Personal Access Token` in your Supabase account settings — only needed for first-time initialization

### Supabase: Using It in Card Tab

1. Open `设置` → `云端连接` → `Supabase`
2. Fill in `Project URL` and `API Key`
3. If the table and Storage bucket are not ready yet, also fill in `Service Role Key` and `Personal Access Token`
4. Click `检测状态` / `测试连接`; if setup is still needed, click `初始化连接`
5. Go back to `工作空间` → target workspace → `云同步`, then click `启用同步`

- If you already created the table and the `backgrounds` bucket manually, `Project URL` and `API Key` are usually enough.

### Cloudflare: Getting the Required Values

Card Tab supports two Cloudflare flows:

- `已经建好，直接连接`
  - Prepare the `Worker API URL`
  - If your Worker uses auth, also prepare the `Access Token`; it should match the Worker environment variable `ACCESS_TOKEN`
- `还没有，帮我初始化`
  - Get your `Account ID` from the Cloudflare Dashboard
  - Create an `API Token` that can manage `Worker / D1 / R2` resources
  - Use the default Worker / D1 / R2 names or customize them
  - `同步 Worker 访问令牌` can be left empty and will be generated automatically

### Cloudflare: Using It in Card Tab

1. Open `设置` → `云端连接` → `Cloudflare`
2. If you already have a Worker, fill in `Worker API URL` and `Access Token`
3. If not, switch to `还没有，帮我初始化`, fill in `Account ID` and `API Token`, then click `创建 Worker`
4. After the `Worker API URL` is ready, click `初始化数据库`
5. Then run `检测状态` / `测试连接`
6. Go back to `工作空间` → target workspace → `云同步`, then click `启用同步`

## Development

- This project is a static Chrome extension with no npm dependencies
- Build command:

```bash
node build.js
```

- Package output: `build/card-tab.zip`

## Privacy

- Local-first by default
- No tracking, no analytics, no third-party data collection
- When cloud sync is enabled, data is stored in your own Supabase or Cloudflare resources

## License

[MIT License](LICENSE)
