# 🛡️ Supabase 安全配置指南

## 📊 **使用场景对比**

| 使用场景 | 推荐方案 | 安全级别 | 配置复杂度 |
|---------|---------|---------|-----------|
| 个人使用 | 禁用RLS | ⚠️ 低 | 🟢 简单 |
| 多人使用 | 启用RLS | 🛡️ 高 | 🟡 中等 |
| 企业使用 | RLS+认证 | 🔒 最高 | 🔴 复杂 |

## 🔧 **配置方案**

### 方案1: 个人使用（简单）

**适用场景**: 只有你一个人使用，不分享API密钥

```sql
-- 禁用行级安全策略
ALTER TABLE quick_nav_data DISABLE ROW LEVEL SECURITY;
```

**风险**: 
- ❌ 任何获得API密钥的人都能访问所有数据
- ❌ 无数据隔离保护

### 方案2: 多人使用（推荐）

**适用场景**: 多人使用，需要数据隔离

```sql
-- 启用行级安全策略
ALTER TABLE quick_nav_data ENABLE ROW LEVEL SECURITY;

-- 创建安全策略：用户只能访问自己的数据
CREATE POLICY "Users can only access their own data" ON quick_nav_data
  FOR ALL 
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
```

**优势**:
- ✅ 数据完全隔离
- ✅ 用户只能看到自己的数据
- ✅ 防止数据泄露和篡改

### 方案3: 简化多人使用

**如果方案2不工作，使用此备选方案**:

```sql
-- 启用行级安全策略
ALTER TABLE quick_nav_data ENABLE ROW LEVEL SECURITY;

-- 简化策略（临时允许所有操作，用于调试）
CREATE POLICY "Enable access based on user_id" ON quick_nav_data
  FOR ALL 
  USING (true)
  WITH CHECK (true);
```

## 🔍 **如何选择方案**

### 选择方案1的条件：
- ✅ 只有你一个人使用
- ✅ 不会分享Supabase API密钥
- ✅ 数据不敏感
- ✅ 追求简单配置

### 选择方案2的条件：
- ✅ 多人使用同一个Supabase项目
- ✅ 需要数据隔离
- ✅ 数据包含隐私信息
- ✅ 安全性要求较高

## ⚙️ **实施步骤**

### 步骤1: 评估使用场景
```
问自己：
1. 会有其他人使用这个Chrome扩展吗？
2. 会分享Supabase API密钥吗？
3. 数据是否包含敏感信息？
4. 是否需要数据隔离？
```

### 步骤2: 选择并执行SQL
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入 SQL Editor
3. 根据场景选择对应的SQL执行

### 步骤3: 测试验证
1. 在Chrome扩展中测试同步功能
2. 如果是多人使用，创建不同的user_id测试数据隔离

## 🚨 **安全建议**

### 对于个人使用：
- 🔐 **保护API密钥**: 不要分享给他人
- 🔄 **定期轮换**: 定期更换API密钥
- 📱 **设备安全**: 确保使用扩展的设备安全

### 对于多人使用：
- 👥 **用户标识**: 确保每个用户使用唯一的user_id
- 🔍 **定期审计**: 检查数据访问日志
- 🛡️ **最小权限**: 只给必要的数据库权限

## 🔧 **故障排除**

### 如果启用RLS后无法同步：
1. **检查策略**: 确保RLS策略正确配置
2. **验证user_id**: 确保user_id格式正确
3. **查看日志**: 检查Supabase日志中的错误信息
4. **临时禁用**: 可以临时禁用RLS进行调试

### 常见错误：
```
错误: "new row violates row-level security policy"
解决: 检查RLS策略是否正确配置

错误: "permission denied for table"
解决: 检查API密钥权限设置
```

## 💡 **最佳实践**

1. **开发阶段**: 可以先禁用RLS，快速开发测试
2. **生产阶段**: 根据实际使用场景启用适当的RLS策略
3. **监控**: 定期检查数据访问情况
4. **备份**: 定期备份重要数据

## 📞 **需要帮助？**

如果遇到配置问题：
1. 检查Supabase项目设置
2. 验证API密钥权限
3. 查看浏览器控制台错误信息
4. 参考Supabase官方文档
