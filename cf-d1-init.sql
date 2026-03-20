-- =====================================================
-- Card Tab - Cloudflare D1 数据库初始化脚本
-- =====================================================
-- 自动初始化：扩展设置页面可一键调用 POST /api/init 完成
-- 手动初始化：在 Cloudflare Dashboard → D1 → 你的数据库 → Console 中执行

-- 1. 创建数据表
CREATE TABLE IF NOT EXISTS card_tab_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT '1',
  theme_id TEXT NOT NULL,
  theme_name TEXT DEFAULT '',
  theme_type TEXT DEFAULT 'default',
  bg_image_url TEXT,
  bg_image_path TEXT,
  bg_opacity INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 0,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, theme_id)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_card_tab_user_id ON card_tab_data(user_id);
CREATE INDEX IF NOT EXISTS idx_card_tab_theme_id ON card_tab_data(theme_id);

-- 3. 验证
SELECT 'D1 数据表创建成功!' AS status;
