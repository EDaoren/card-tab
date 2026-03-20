const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_COMPATIBILITY_DATE = '2024-10-01';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({
        ok: true,
        provider: 'cloudflare',
        message: 'provisioning service ready'
      });
    }

    if (url.pathname === '/oauth/cloudflare/start' && request.method === 'GET') {
      return html(renderProvisioningPage({
        state: url.searchParams.get('state') || '',
        redirectUri: url.searchParams.get('redirect_uri') || '',
        themeName: url.searchParams.get('theme_name') || 'Cloudflare 工作区',
        defaultWorkerPrefix: env.DEFAULT_WORKER_PREFIX || 'card-tab',
        defaultThemeName: env.DEFAULT_THEME_NAME || 'Cloudflare 工作区'
      }));
    }

    if (url.pathname === '/oauth/cloudflare/complete' && request.method === 'POST') {
      return handleProvisioningSubmit(request, env);
    }

    return json({
      ok: false,
      error: 'Not found'
    }, 404);
  }
};

async function handleProvisioningSubmit(request, env) {
  const formData = await request.formData();
  const submission = {
    state: getFormValue(formData, 'state'),
    redirectUri: getFormValue(formData, 'redirect_uri'),
    themeName: getFormValue(formData, 'theme_name') || env.DEFAULT_THEME_NAME || 'Cloudflare 工作区',
    accountId: getFormValue(formData, 'account_id'),
    apiToken: getFormValue(formData, 'api_token'),
    workerPrefix: getFormValue(formData, 'worker_prefix') || env.DEFAULT_WORKER_PREFIX || 'card-tab',
    workersSubdomain: getFormValue(formData, 'workers_subdomain'),
    workerAccessToken: getFormValue(formData, 'worker_access_token')
  };

  if (!submission.state || !submission.redirectUri) {
    return html(renderProvisioningPage({
      ...submission,
      errorMessage: '缺少 state 或 redirect_uri，无法继续开通流程。'
    }), 400);
  }

  try {
    validateSubmission(submission);

    const suffix = createNameSuffix();
    const workerName = sanitizeName(`${submission.workerPrefix}-${suffix}`, 'card-tab-sync');
    const databaseName = sanitizeName(`${workerName}-db`, 'card-tab-db');
    const bucketName = sanitizeName(`${workerName}-files`, 'card-tab-files');
    const workerAccessToken = submission.workerAccessToken || createOpaqueToken();
    const api = new CloudflareApiClient(submission.accountId, submission.apiToken);

    const workersSubdomain = submission.workersSubdomain || await api.getWorkersSubdomain();
    const database = await api.createD1Database(databaseName);
    const databaseId = database.uuid || database.id || database.database_id;

    if (!databaseId) {
      throw new Error('Cloudflare D1 创建成功但未返回数据库 ID');
    }

    await api.createR2Bucket(bucketName);
    await api.deployWorkerScript(workerName, buildSyncWorkerSource(), [
      {
        type: 'd1',
        name: 'DB',
        id: databaseId
      },
      {
        type: 'r2_bucket',
        name: 'BUCKET',
        bucket_name: bucketName
      },
      {
        type: 'plain_text',
        name: 'ACCESS_TOKEN',
        text: workerAccessToken
      }
    ]);
    const activationResult = await api.activateWorkerSubdomain(workerName);

    const workerUrl = `https://${workerName}.${workersSubdomain}.workers.dev`;
    try {
      await waitForWorkerReady(workerUrl, workerAccessToken);
      await initializeSyncWorker(workerUrl, workerAccessToken);
    } catch (error) {
      if (!activationResult.activated && activationResult.errorMessage) {
        throw new Error(`同步 Worker 已创建，但尚未就绪：${error.message}；自动激活 workers.dev / 预览 URL 也失败：${activationResult.errorMessage}`);
      }

      throw error;
    }

    return redirectWithPayload(submission.redirectUri, submission.state, {
      workerUrl,
      accessToken: workerAccessToken,
      themeId: `cf-${Date.now()}`,
      themeName: submission.themeName,
      workerName,
      databaseName,
      bucketName,
      workersSubdomain
    });
  } catch (error) {
    return redirectWithError(submission.redirectUri, submission.state, error.message);
  }
}

function validateSubmission(submission) {
  if (!submission.accountId) {
    throw new Error('请填写 Cloudflare Account ID');
  }

  if (!submission.apiToken) {
    throw new Error('请填写 Cloudflare API Token');
  }
}

async function initializeSyncWorker(workerUrl, workerAccessToken) {
  const response = await fetch(`${workerUrl}/api/init`, {
    method: 'POST',
    headers: workerAccessToken
      ? { Authorization: `Bearer ${workerAccessToken}` }
      : {}
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`初始化同步 Worker 失败：${errorText || response.status}`);
  }
}

async function waitForWorkerReady(workerUrl, workerAccessToken, maxAttempts = 8) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await requestSyncWorker(workerUrl, workerAccessToken, 'GET', '/api/ping');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw new Error(lastError?.message || '同步 Worker 尚未就绪');
}

async function requestSyncWorker(workerUrl, workerAccessToken, method, path) {
  const response = await fetch(`${workerUrl}${path}`, {
    method,
    headers: workerAccessToken
      ? { Authorization: `Bearer ${workerAccessToken}` }
      : {}
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `请求失败 (${response.status})`);
  }

  return response;
}

class CloudflareApiClient {
  constructor(accountId, apiToken) {
    this.accountId = accountId;
    this.apiToken = apiToken;
  }

  buildErrorMessage(payload, fallbackMessage) {
    return payload?.errors?.map(item => item.message).filter(Boolean).join('；')
      || payload?.messages?.map(item => item.message).filter(Boolean).join('；')
      || fallbackMessage;
  }

  async requestRaw(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${this.apiToken}`);
    headers.set('Accept', 'application/json');

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
      ...init,
      headers
    });
    const text = await response.text().catch(() => '');
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    return {
      response,
      payload,
      text
    };
  }

  async request(path, init = {}) {
    const { response: rawResponse, payload: rawPayload, text: rawText } = await this.requestRaw(path, init);
    if (!rawResponse.ok || !rawPayload?.success) {
      const message = this.buildErrorMessage(
        rawPayload,
        rawText || `Cloudflare API 请求失败 (${rawResponse.status})`
      );
      throw new Error(message);
    }

    return rawPayload.result ?? rawPayload;

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${this.apiToken}`);
    headers.set('Accept', 'application/json');

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
      ...init,
      headers
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      const message = payload?.errors?.map(item => item.message).filter(Boolean).join('；')
        || payload?.messages?.map(item => item.message).filter(Boolean).join('；')
        || `Cloudflare API 请求失败 (${response.status})`;
      throw new Error(message);
    }

    return payload.result ?? payload;
  }

  async tryRequest(path, init = {}) {
    const { response, payload, text } = await this.requestRaw(path, init);
    const ok = response.ok && (payload === null || payload.success !== false);

    return {
      ok,
      status: response.status,
      result: ok ? (payload?.result ?? payload ?? null) : null,
      errorMessage: ok
        ? ''
        : this.buildErrorMessage(payload, text || `Cloudflare API 请求失败 (${response.status})`)
    };
  }

  async getWorkersSubdomain() {
    const result = await this.request(`/accounts/${this.accountId}/workers/subdomain`, {
      method: 'GET'
    });

    const subdomain = result?.subdomain || result?.name || '';
    if (!subdomain) {
      throw new Error('无法获取 workers.dev 子域名，请先在 Cloudflare 控制台启用 workers.dev');
    }

    return subdomain;
  }

  async createD1Database(name) {
    return this.request(`/accounts/${this.accountId}/d1/database`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async createR2Bucket(name) {
    return this.request(`/accounts/${this.accountId}/r2/buckets`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async deployWorkerScript(scriptName, sourceCode, bindings) {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'worker.js',
      compatibility_date: DEFAULT_COMPATIBILITY_DATE,
      bindings
    }));
    formData.append(
      'worker.js',
      new Blob([sourceCode], { type: 'application/javascript+module' }),
      'worker.js'
    );

    await this.request(`/accounts/${this.accountId}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      body: formData
    });
  }

  async activateWorkerSubdomain(scriptName) {
    const body = JSON.stringify({
      enabled: true,
      previews_enabled: true
    });
    const attempts = [
      {
        method: 'POST',
        path: `/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`
      },
      {
        method: 'PATCH',
        path: `/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`
      },
      {
        method: 'POST',
        path: `/accounts/${this.accountId}/workers/services/${scriptName}/environments/production/subdomain`
      },
      {
        method: 'PATCH',
        path: `/accounts/${this.accountId}/workers/services/${scriptName}/environments/production/subdomain`
      }
    ];
    let lastErrorMessage = '';

    for (const attempt of attempts) {
      const result = await this.tryRequest(attempt.path, {
        method: attempt.method,
        body
      });

      if (result.ok) {
        return {
          activated: true,
          result: result.result,
          endpoint: `${attempt.method} ${attempt.path}`
        };
      }

      lastErrorMessage = result.errorMessage || `${attempt.method} ${attempt.path} (${result.status})`;
    }

    return {
      activated: false,
      errorMessage: lastErrorMessage || '未知错误'
    };
  }
}

function getFormValue(formData, key) {
  return String(formData.get(key) || '').trim();
}

function createNameSuffix() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function sanitizeName(value, fallback) {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return cleaned || fallback;
}

function createOpaqueToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function redirectWithPayload(redirectUri, state, payload) {
  const targetUrl = new URL(redirectUri);
  targetUrl.searchParams.set('state', state);
  targetUrl.searchParams.set('status', 'success');
  targetUrl.searchParams.set('payload', encodeJsonPayload(payload));
  return Response.redirect(targetUrl.toString(), 302);
}

function redirectWithError(redirectUri, state, message) {
  const targetUrl = new URL(redirectUri);
  targetUrl.searchParams.set('state', state);
  targetUrl.searchParams.set('status', 'error');
  targetUrl.searchParams.set('message', message || '开通失败');
  return Response.redirect(targetUrl.toString(), 302);
}

function encodeJsonPayload(payload) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function renderProvisioningPage(values) {
  const errorHtml = values.errorMessage
    ? `<div class="notice notice-error">${escapeHtml(values.errorMessage)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Tab - Cloudflare 一键开通</title>
  <style>
    :root {
      color-scheme: light;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(180deg, #f8fbff 0%, #f8f9fa 100%);
      color: #202124;
    }

    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      width: 100%;
      max-width: 720px;
      background: #ffffff;
      border: 1px solid rgba(26, 115, 232, 0.12);
      border-radius: 24px;
      box-shadow: 0 16px 48px rgba(26, 115, 232, 0.08);
      padding: 32px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 28px;
    }

    .subtitle {
      margin: 0 0 24px;
      color: #5f6368;
      line-height: 1.6;
    }

    .notice {
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 18px;
      font-size: 14px;
      line-height: 1.6;
    }

    .notice-info {
      background: #e8f0fe;
      color: #1a73e8;
    }

    .notice-error {
      background: rgba(197, 34, 31, 0.08);
      color: #c5221f;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 14px;
    }

    input {
      width: 100%;
      border: 1px solid #dadce0;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
    }

    input:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.12);
    }

    .field {
      margin-bottom: 16px;
    }

    .hint {
      margin-top: 6px;
      color: #5f6368;
      font-size: 12px;
      line-height: 1.5;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
      align-items: center;
    }

    button {
      border: none;
      border-radius: 999px;
      background: #1a73e8;
      color: #fff;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    button:hover {
      filter: brightness(0.96);
    }

    .token-scopes {
      margin: 24px 0 0;
      padding: 16px;
      border-radius: 16px;
      background: #f6fafe;
      color: #5f6368;
      font-size: 13px;
      line-height: 1.7;
    }

    code {
      background: rgba(95, 99, 104, 0.1);
      padding: 2px 6px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <h1>Cloudflare 一键开通</h1>
      <p class="subtitle">填写 Cloudflare 账号参数后，服务会自动创建 D1、R2、同步 Worker，并把结果回传给 Card Tab 扩展。</p>

      <div class="notice notice-info">
        当前工作区名称：<strong>${escapeHtml(values.themeName || values.defaultThemeName || 'Cloudflare 工作区')}</strong>
      </div>
      ${errorHtml}

      <form method="post" action="/oauth/cloudflare/complete">
        <input type="hidden" name="state" value="${escapeHtml(values.state || '')}">
        <input type="hidden" name="redirect_uri" value="${escapeHtml(values.redirectUri || '')}">
        <input type="hidden" name="theme_name" value="${escapeHtml(values.themeName || values.defaultThemeName || 'Cloudflare 工作区')}">

        <div class="grid">
          <div class="field">
            <label for="account_id">Cloudflare Account ID</label>
            <input id="account_id" name="account_id" value="${escapeHtml(values.accountId || '')}" placeholder="在 Cloudflare Dashboard 中可找到">
          </div>
          <div class="field">
            <label for="api_token">Cloudflare API Token</label>
            <input id="api_token" name="api_token" type="password" value="" placeholder="仅本次开通使用，不会持久化保存">
          </div>
          <div class="field">
            <label for="worker_prefix">Worker 名称前缀</label>
            <input id="worker_prefix" name="worker_prefix" value="${escapeHtml(values.workerPrefix || values.defaultWorkerPrefix || 'card-tab')}" placeholder="例如 card-tab">
            <div class="hint">最终会自动拼接时间戳，避免重名。</div>
          </div>
          <div class="field">
            <label for="workers_subdomain">workers.dev 子域名（可选）</label>
            <input id="workers_subdomain" name="workers_subdomain" value="${escapeHtml(values.workersSubdomain || '')}" placeholder="留空时自动通过 Cloudflare API 读取">
          </div>
          <div class="field" style="grid-column: 1 / -1;">
            <label for="worker_access_token">同步 Worker 访问令牌（可选）</label>
            <input id="worker_access_token" name="worker_access_token" value="${escapeHtml(values.workerAccessToken || '')}" placeholder="留空则自动生成">
          </div>
        </div>

        <div class="actions">
          <div class="hint">提交后会自动回到扩展，并启用同步。</div>
          <button type="submit">创建 Cloudflare 同步后端</button>
        </div>
      </form>

      <div class="token-scopes">
        建议为 API Token 至少授予以下权限：<br>
        <code>Account Settings:Read</code>、<code>Workers Scripts:Edit</code>、<code>D1:Edit</code>、<code>R2:Edit</code>。<br>
        使用前请先确保你的账号已启用 <code>workers.dev</code> 子域名。
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSyncWorkerSource() {
  return [
    "export default {",
    "  async fetch(request, env) {",
    "    if (request.method === 'OPTIONS') {",
    "      return new Response(null, { status: 204, headers: corsHeaders() });",
    "    }",
    "",
    "    try {",
    "      if (env.ACCESS_TOKEN) {",
    "        const auth = request.headers.get('Authorization');",
    "        if (!auth || auth !== `Bearer ${env.ACCESS_TOKEN}`) {",
    "          return json({ error: '未授权' }, 401);",
    "        }",
    "      }",
    "",
    "      const url = new URL(request.url);",
    "      const path = url.pathname;",
    "      const method = request.method;",
    "",
    "      if (method === 'GET' && path === '/api/ping') {",
    "        await env.DB.prepare('SELECT 1').first();",
    "        return json({ ok: true, timestamp: new Date().toISOString() });",
    "      }",
    "",
    "      if (method === 'POST' && path === '/api/init') {",
    "        const results = [];",
    "        await env.DB.prepare(`",
    "          CREATE TABLE IF NOT EXISTS card_tab_data (",
    "            id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "            user_id TEXT NOT NULL DEFAULT '1',",
    "            theme_id TEXT NOT NULL,",
    "            theme_name TEXT DEFAULT '',",
    "            theme_type TEXT DEFAULT 'default',",
    "            bg_image_url TEXT,",
    "            bg_image_path TEXT,",
    "            bg_opacity INTEGER DEFAULT 30,",
    "            is_active INTEGER DEFAULT 0,",
    "            data TEXT NOT NULL,",
    "            created_at TEXT DEFAULT (datetime('now')),",
    "            updated_at TEXT DEFAULT (datetime('now')),",
    "            UNIQUE(user_id, theme_id)",
    "          )",
    "        `).run();",
    "        results.push('表 card_tab_data 已创建');",
    "        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_card_tab_user_id ON card_tab_data(user_id)').run();",
    "        results.push('索引 idx_card_tab_user_id 已创建');",
    "        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_card_tab_theme_id ON card_tab_data(theme_id)').run();",
    "        results.push('索引 idx_card_tab_theme_id 已创建');",
    "        return json({ ok: true, results });",
    "      }",
    "",
    "      if (method === 'GET' && path === '/api/themes') {",
    "        const userId = url.searchParams.get('user_id') || '1';",
    "        const rows = await env.DB.prepare(`",
    "          SELECT theme_id, theme_name, theme_type, bg_image_url, bg_opacity, is_active, created_at, updated_at",
    "          FROM card_tab_data",
    "          WHERE user_id = ?",
    "          ORDER BY updated_at DESC",
    "        `).bind(userId).all();",
    "        return json({ ok: true, themes: rows.results || [] });",
    "      }",
    "",
    "      const dataMatch = path.match(/^\\/api\\/data\\/([^\\/]+)$/);",
    "      if (dataMatch) {",
    "        const themeId = decodeURIComponent(dataMatch[1]);",
    "        const userId = url.searchParams.get('user_id') || '1';",
    "",
    "        if (method === 'GET') {",
    "          const row = await env.DB.prepare(`",
    "            SELECT theme_id, theme_name, theme_type, bg_image_url, bg_image_path, bg_opacity, is_active, data, created_at, updated_at",
    "            FROM card_tab_data",
    "            WHERE user_id = ? AND theme_id = ?",
    "          `).bind(userId, themeId).first();",
    "",
    "          if (!row) {",
    "            return json(null, 204);",
    "          }",
    "",
    "          return json({",
    "            theme_id: row.theme_id,",
    "            theme_name: row.theme_name,",
    "            theme_type: row.theme_type,",
    "            bg_image_url: row.bg_image_url,",
    "            bg_image_path: row.bg_image_path,",
    "            bg_opacity: row.bg_opacity,",
    "            is_active: row.is_active,",
    "            data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,",
    "            created_at: row.created_at,",
    "            updated_at: row.updated_at",
    "          });",
    "        }",
    "",
    "        if (method === 'PUT') {",
    "          const body = await request.json();",
    "          const dataStr = JSON.stringify(body.data);",
    "          const now = body.updated_at || new Date().toISOString();",
    "",
    "          await env.DB.prepare(`",
    "            INSERT INTO card_tab_data (user_id, theme_id, theme_name, theme_type, bg_image_url, bg_image_path, bg_opacity, is_active, data, updated_at)",
    "            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    "            ON CONFLICT(user_id, theme_id) DO UPDATE SET",
    "              theme_name = excluded.theme_name,",
    "              theme_type = excluded.theme_type,",
    "              bg_image_url = excluded.bg_image_url,",
    "              bg_image_path = excluded.bg_image_path,",
    "              bg_opacity = excluded.bg_opacity,",
    "              is_active = excluded.is_active,",
    "              data = excluded.data,",
    "              updated_at = excluded.updated_at",
    "          `).bind(",
    "            userId,",
    "            themeId,",
    "            body.theme_name || '',",
    "            body.theme_type || 'default',",
    "            body.bg_image_url || null,",
    "            body.bg_image_path || null,",
    "            body.bg_opacity ?? 30,",
    "            body.is_active ?? 0,",
    "            dataStr,",
    "            now",
    "          ).run();",
    "",
    "          return json({ ok: true });",
    "        }",
    "",
    "        if (method === 'DELETE') {",
    "          await env.DB.prepare('DELETE FROM card_tab_data WHERE user_id = ? AND theme_id = ?').bind(userId, themeId).run();",
    "          return json({ ok: true });",
    "        }",
    "      }",
    "",
    "      const filesUploadMatch = path.match(/^\\/api\\/files\\/([^\\/]+)$/);",
    "      if (filesUploadMatch && method === 'POST') {",
    "        const themeId = decodeURIComponent(filesUploadMatch[1]);",
    "        const formData = await request.formData();",
    "        const file = formData.get('file');",
    "        const filePath = formData.get('path') || `${themeId}/${Date.now()}_upload`;",
    "",
    "        if (!file) {",
    "          return json({ error: '未提供文件' }, 400);",
    "        }",
    "",
    "        await env.BUCKET.put(filePath, file.stream(), {",
    "          httpMetadata: { contentType: file.type }",
    "        });",
    "",
    "        return json({ ok: true, path: filePath, url: `${url.origin}/files/${filePath}` });",
    "      }",
    "",
    "      const filesDeleteMatch = path.match(/^\\/api\\/files\\/([^\\/]+)\\/(.+)$/);",
    "      if (filesDeleteMatch && method === 'DELETE') {",
    "        const filePath = decodeURIComponent(filesDeleteMatch[2]);",
    "        await env.BUCKET.delete(filePath);",
    "        return json({ ok: true });",
    "      }",
    "",
    "      const fileServeMatch = path.match(/^\\/files\\/(.+)$/);",
    "      if (fileServeMatch && method === 'GET') {",
    "        const filePath = decodeURIComponent(fileServeMatch[1]);",
    "        const object = await env.BUCKET.get(filePath);",
    "        if (!object) {",
    "          return json({ error: '文件不存在' }, 404);",
    "        }",
    "",
    "        const headers = new Headers();",
    "        object.writeHttpMetadata(headers);",
    "        headers.set('Cache-Control', 'public, max-age=31536000');",
    "        headers.set('Access-Control-Allow-Origin', '*');",
    "        return new Response(object.body, { headers });",
    "      }",
    "",
    "      return json({ error: '未找到路由' }, 404);",
    "    } catch (error) {",
    "      return json({ error: error.message || '服务器内部错误' }, 500);",
    "    }",
    "  }",
    "};",
    "",
    "function corsHeaders() {",
    "  return {",
    "    'Access-Control-Allow-Origin': '*',",
    "    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',",
    "    'Access-Control-Allow-Headers': 'Content-Type, Authorization',",
    "    'Access-Control-Max-Age': '86400'",
    "  };",
    "}",
    "",
    "function json(data, status = 200) {",
    "  if (data === null && status === 204) {",
    "    return new Response(null, { status: 204, headers: corsHeaders() });",
    "  }",
    "",
    "  return new Response(JSON.stringify(data), {",
    "    status,",
    "    headers: {",
    "      'Content-Type': 'application/json',",
    "      ...corsHeaders()",
    "    }",
    "  });",
    "}"
  ].join('\n');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...corsHeaders()
    }
  });
}
