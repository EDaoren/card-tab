/**
 * Card Tab - Cloudflare Worker
 * 提供 D1 数据库和 R2 文件存储的 REST API
 *
 * 部署步骤：
 *   1. 在 Cloudflare Dashboard 创建 Worker
 *   2. 创建 D1 数据库，绑定名称为 DB
 *   3. 创建 R2 存储桶，绑定名称为 BUCKET
 *   4. 在 Worker 设置中添加环境变量 ACCESS_TOKEN（可选，用于鉴权）
 *   5. 部署后在扩展设置页面点击「自动初始化数据库」即可完成建表
 *   6. 将本文件内容粘贴到 Worker 编辑器中并部署
 *
 * wrangler.toml 配置示例：
 *   name = "card-tab-sync"
 *   main = "cf-worker.js"
 *   compatibility_date = "2024-01-01"
 *
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_name = "card-tab-db"
 *   database_id = "<your-database-id>"
 *
 *   [[r2_buckets]]
 *   binding = "BUCKET"
 *   bucket_name = "card-tab-files"
 *
 *   [vars]
 *   ACCESS_TOKEN = "your-secret-token"
 */

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      const isPublicFileRequest = (method === 'GET' || method === 'HEAD') && /^\/files\/.+/.test(path);

      // 鉴权
      if (env.ACCESS_TOKEN && !isPublicFileRequest) {
        const auth = request.headers.get('Authorization');
        if (!auth || auth !== `Bearer ${env.ACCESS_TOKEN}`) {
          return json({ error: '未授权' }, 401);
        }
      }

      // --- 路由 ---

      // GET /api/ping
      if (method === 'GET' && path === '/api/ping') {
        try {
          await env.DB.prepare('SELECT 1').first();
        } catch (e) {
          return json({ ok: false, error: 'D1 数据库未正确绑定或初始化' }, 500);
        }
        return json({ ok: true, timestamp: new Date().toISOString() });
      }

      // POST /api/init — 自动初始化数据库
      if (method === 'POST' && path === '/api/init') {
        const results = [];

        await env.DB.prepare(`
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
          )
        `).run();
        results.push('表 card_tab_data 已创建');

        await env.DB.prepare(`
          CREATE INDEX IF NOT EXISTS idx_card_tab_user_id ON card_tab_data(user_id)
        `).run();
        results.push('索引 idx_card_tab_user_id 已创建');

        await env.DB.prepare(`
          CREATE INDEX IF NOT EXISTS idx_card_tab_theme_id ON card_tab_data(theme_id)
        `).run();
        results.push('索引 idx_card_tab_theme_id 已创建');

        return json({ ok: true, results });
      }

      // GET /api/themes — 列出所有主题（不含完整 data）
      if (method === 'GET' && path === '/api/themes') {
        const userId = url.searchParams.get('user_id') || '1';
        const rows = await env.DB.prepare(`
          SELECT theme_id, theme_name, theme_type, bg_image_url, bg_opacity,
                 is_active, created_at, updated_at
          FROM card_tab_data
          WHERE user_id = ?
          ORDER BY updated_at DESC
        `).bind(userId).all();

        return json({ ok: true, themes: rows.results || [] });
      }

      // GET /api/data/:themeId — 加载指定主题的完整数据
      const dataMatch = path.match(/^\/api\/data\/([^\/]+)$/);
      if (dataMatch) {
        const themeId = decodeURIComponent(dataMatch[1]);
        const userId = url.searchParams.get('user_id') || '1';

        if (method === 'GET') {
          const row = await env.DB.prepare(`
            SELECT theme_id, theme_name, theme_type, bg_image_url, bg_image_path,
                   bg_opacity, is_active, data, created_at, updated_at
            FROM card_tab_data
            WHERE user_id = ? AND theme_id = ?
          `).bind(userId, themeId).first();

          if (!row) {
            return json(null, 204);
          }

          return json({
            theme_id: row.theme_id,
            theme_name: row.theme_name,
            theme_type: row.theme_type,
            bg_image_url: row.bg_image_url,
            bg_image_path: row.bg_image_path,
            bg_opacity: row.bg_opacity,
            is_active: row.is_active,
            data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
            created_at: row.created_at,
            updated_at: row.updated_at
          });
        }

        if (method === 'PUT') {
          const body = await request.json();
          const dataStr = JSON.stringify(body.data);
          const now = body.updated_at || new Date().toISOString();

          await env.DB.prepare(`
            INSERT INTO card_tab_data (user_id, theme_id, theme_name, theme_type,
              bg_image_url, bg_image_path, bg_opacity, is_active, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, theme_id) DO UPDATE SET
              theme_name = excluded.theme_name,
              theme_type = excluded.theme_type,
              bg_image_url = excluded.bg_image_url,
              bg_image_path = excluded.bg_image_path,
              bg_opacity = excluded.bg_opacity,
              is_active = excluded.is_active,
              data = excluded.data,
              updated_at = excluded.updated_at
          `).bind(
            userId,
            themeId,
            body.theme_name || '',
            body.theme_type || 'default',
            body.bg_image_url || null,
            body.bg_image_path || null,
            body.bg_opacity ?? 30,
            body.is_active ?? 0,
            dataStr,
            now
          ).run();

          return json({ ok: true });
        }

        if (method === 'DELETE') {
          await env.DB.prepare(
            'DELETE FROM card_tab_data WHERE user_id = ? AND theme_id = ?'
          ).bind(userId, themeId).run();

          return json({ ok: true });
        }
      }

      // POST /api/files/:themeId — 上传文件到 R2
      const filesUploadMatch = path.match(/^\/api\/files\/([^\/]+)$/);
      if (filesUploadMatch && method === 'POST') {
        const themeId = decodeURIComponent(filesUploadMatch[1]);
        const formData = await request.formData();
        const file = formData.get('file');
        const filePath = formData.get('path') || `${themeId}/${Date.now()}_upload`;

        if (!file) {
          return json({ error: '未提供文件' }, 400);
        }

        await env.BUCKET.put(filePath, file.stream(), {
          httpMetadata: { contentType: file.type }
        });

        const publicUrl = `${url.origin}/files/${filePath}`;

        return json({ ok: true, path: filePath, url: publicUrl });
      }

      // DELETE /api/files/:themeId/*path — 删除 R2 文件
      const filesDeleteMatch = path.match(/^\/api\/files\/([^\/]+)\/(.+)$/);
      if (filesDeleteMatch && method === 'DELETE') {
        const filePath = decodeURIComponent(filesDeleteMatch[2]);
        await env.BUCKET.delete(filePath);
        return json({ ok: true });
      }

      // GET /files/*path — 公共文件访问（R2 代理）
      const fileServeMatch = path.match(/^\/files\/(.+)$/);
      if (fileServeMatch && method === 'GET') {
        const filePath = decodeURIComponent(fileServeMatch[1]);
        const object = await env.BUCKET.get(filePath);

        if (!object) {
          return json({ error: '文件不存在' }, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      return json({ error: '未找到路由' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return json({ error: error.message || '服务器内部错误' }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200) {
  if (data === null && status === 204) {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
