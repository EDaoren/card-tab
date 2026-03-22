/**
 * Cloudflare D1/R2 客户端管理器
 * 通过 Cloudflare Worker REST API 处理数据同步和文件存储
 */

class CloudflareClient {
  constructor() {
    this.isConnected = false;
    this.config = null;
    this.currentConfigHash = null;
  }

  /**
   * 生成配置哈希值
   */
  generateConfigHash(config) {
    return `${config.workerUrl}|${config.accessToken || ''}`;
  }

  /**
   * 检查是否需要重新初始化
   */
  needsReinitialization(config) {
    const newHash = this.generateConfigHash(config);
    return this.currentConfigHash !== newHash;
  }

  /**
   * 初始化连接
   * @param {Object} config
   * @param {string} config.workerUrl - Worker URL
   * @param {string} config.accessToken - 访问令牌（可选）
   * @param {boolean} shouldTest - 是否测试连接
   */
  async initialize(config, shouldTest = false) {
    try {
      if (!this.needsReinitialization(config)) {
        if (shouldTest && this.isConnected) {
          return true;
        } else if (shouldTest) {
          await this.testConnection();
          return true;
        }
        return true;
      }

      this.config = config;
      this.currentConfigHash = this.generateConfigHash(config);

      if (shouldTest) {
        await this.testConnection();
        console.log('CloudflareClient: 初始化并验证连接成功');
      } else {
        this.isConnected = true;
        console.log('CloudflareClient: 初始化完成（延迟验证）');
      }

      return true;
    } catch (error) {
      console.error('CloudflareClient: 初始化失败:', error);
      this.isConnected = false;
      this.currentConfigHash = null;
      throw error;
    }
  }

  /**
   * 构建请求 Headers
   */
  _buildHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }
    return headers;
  }

  /**
   * 统一 fetch 封装
   */
  async _request(method, path, body = null) {
    const url = `${this.config.workerUrl.replace(/\/+$/, '')}${path}`;
    const options = {
      method,
      headers: this._buildHeaders(),
    };
    if (body !== null) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`请求失败 (${response.status}): ${errorText || response.statusText}`);
    }

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const result = await this._request('GET', '/api/ping');
      if (result && result.ok) {
        await this.testSchemaAccess();
        this.isConnected = true;
        console.log('CloudflareClient: 连接与数据表测试成功');
        return {
          ok: true,
          provider: 'cloudflare'
        };
      } else {
        throw new Error('连接测试响应格式异常');
      }
    } catch (error) {
      this.isConnected = false;
      console.error('CloudflareClient: 连接测试失败:', error);
      throw error;
    }
  }

  async testSchemaAccess() {
    try {
      await this._request('GET', '/api/themes?user_id=1');
      return { ok: true };
    } catch (error) {
      const errorMessage = String(error?.message || '');
      if (errorMessage.includes('no such table') || errorMessage.includes('card_tab_data')) {
        throw new Error('数据表不存在，请先初始化数据库');
      }

      throw error;
    }
  }

  /**
   * 自动初始化数据库（建表）
   * @returns {Object} 初始化结果
   */
  async initializeDatabase() {
    try {
      const result = await this._request('POST', '/api/init');
      console.log('CloudflareClient: 数据库初始化完成', result);
      return result;
    } catch (error) {
      console.error('CloudflareClient: 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 列出所有主题（不含完整 data）
   * @param {string} userId - 用户 ID（默认 '1'）
   * @returns {Array} 主题列表
   */
  async listThemes(userId = '1') {
    if (!this.isConnected) {
      throw new Error('Cloudflare 未连接');
    }

    try {
      const result = await this._request('GET', `/api/themes?user_id=${encodeURIComponent(userId)}`);
      return result?.themes || [];
    } catch (error) {
      console.error('CloudflareClient: 获取主题列表失败:', error);
      throw error;
    }
  }

  /**
   * 保存主题数据
   * @param {string} themeId - 主题 ID
   * @param {Object} data - 书签/设置 JSON 数据
   * @param {Object} themeMeta - 主题元数据
   * @param {string} userId - 用户 ID（默认 '1'）
   */
  async saveData(themeId, data, themeMeta = {}, userId = '1') {
    if (!this.isConnected) {
      throw new Error('Cloudflare 未连接');
    }

    try {
      await this._request('PUT', `/api/data/${encodeURIComponent(themeId)}?user_id=${encodeURIComponent(userId)}`, {
        data: data,
        theme_name: themeMeta.themeName || '',
        theme_type: themeMeta.themeType || 'default',
        bg_image_url: themeMeta.bgImageUrl || null,
        bg_image_path: themeMeta.bgImagePath || null,
        bg_opacity: themeMeta.bgOpacity ?? 30,
        is_active: themeMeta.isActive ?? 0,
        updated_at: new Date().toISOString()
      });
      console.log('数据已保存到 Cloudflare D1, themeId:', themeId);
    } catch (error) {
      if (this._isConnectionError(error)) {
        this.isConnected = false;
      }
      console.error('Cloudflare 保存失败:', error);
      throw error;
    }
  }

  /**
   * 加载指定主题的完整数据
   * @param {string} themeId - 主题 ID
   * @param {string} userId - 用户 ID（默认 '1'）
   * @returns {Object|null} 主题数据（含元数据 + data）
   */
  async loadData(themeId, userId = '1') {
    if (!this.isConnected) {
      throw new Error('Cloudflare 未连接');
    }

    try {
      const result = await this._request('GET', `/api/data/${encodeURIComponent(themeId)}?user_id=${encodeURIComponent(userId)}`);
      if (!result) {
        return null;
      }
      return result;
    } catch (error) {
      // 404 表示无数据
      if (error.message && error.message.includes('404')) {
        return null;
      }
      if (this._isConnectionError(error)) {
        this.isConnected = false;
      }
      console.error('Cloudflare 加载失败:', error);
      throw error;
    }
  }

  /**
   * 删除指定主题
   * @param {string} themeId - 主题 ID
   * @param {string} userId - 用户 ID（默认 '1'）
   */
  async deleteData(themeId, userId = '1') {
    if (!this.isConnected) {
      throw new Error('Cloudflare 未连接');
    }

    try {
      await this._request('DELETE', `/api/data/${encodeURIComponent(themeId)}?user_id=${encodeURIComponent(userId)}`);
      console.log('主题数据已从 Cloudflare 删除, themeId:', themeId);
      return { success: true };
    } catch (error) {
      console.error('Cloudflare 删除失败:', error);
      throw error;
    }
  }

  /**
   * 上传文件到 R2
   */
  async uploadFile(file, themeId = 'default', bucket = 'backgrounds', path = null) {
    if (!this.isConnected) {
      throw new Error('Cloudflare 未连接');
    }

    try {
      const cleanFileName = this._sanitizeFileName(file.name);
      const fileName = path || `${themeId}/${Date.now()}_${cleanFileName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', fileName);

      const url = `${this.config.workerUrl.replace(/\/+$/, '')}/api/files/${encodeURIComponent(themeId)}`;
      const headers = {};
      if (this.config.accessToken) {
        headers['Authorization'] = `Bearer ${this.config.accessToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`文件上传失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        path: result.path || fileName,
        url: result.url
      };
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 删除 R2 文件
   */
  async deleteFile(bucket = 'backgrounds', filePath, themeId = 'default') {
    if (!this.isConnected) {
      throw new Error('Cloudflare 未连接');
    }

    try {
      await this._request('DELETE', `/api/files/${encodeURIComponent(themeId)}/${filePath}`);
      return { success: true };
    } catch (error) {
      console.error('文件删除失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.isConnected = false;
    this.config = null;
    this.currentConfigHash = null;
    console.log('Cloudflare 连接已断开');
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      config: this.config
    };
  }

  /**
   * 获取客户端状态
   */
  getClientStatus() {
    return {
      isConnected: this.isConnected,
      currentConfig: this.config ? {
        workerUrl: this.config.workerUrl,
        hasAccessToken: !!this.config.accessToken
      } : null,
      configHash: this.currentConfigHash
    };
  }

  /**
   * 判断是否是连接错误
   */
  _isConnectionError(error) {
    if (!error || !error.message) return false;
    const msg = error.message.toLowerCase();
    return ['network', 'timeout', 'refused', 'unreachable', 'failed to fetch'].some(k => msg.includes(k));
  }

  /**
   * 清理文件名
   */
  _sanitizeFileName(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

    let cleanName = name
      .replace(/[\u4e00-\u9fff]/g, '')
      .replace(/[^\w\-_.]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

    if (!cleanName) cleanName = 'image';
    if (cleanName.length > 50) cleanName = cleanName.substring(0, 50);

    return cleanName + extension;
  }
}

// 创建全局实例
const cloudflareClient = new CloudflareClient();
globalThis.cloudflareClient = cloudflareClient;
