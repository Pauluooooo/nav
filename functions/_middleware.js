// functions/_middleware.js

import { DB_SCHEMA, SCHEMA_VERSION } from './constants';

export function normalizeSortOrder(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 9999;
}

export function isSubmissionEnabled(env) {
  // Convert to string to handle both boolean `true` from toml and string 'true' from secrets
  return String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
}

export async function isAdminAuthenticated(request, env) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;
  
  const match = cookie.match(/admin_session=([^;]+)/);
  if (!match) return false;
  
  const token = match[1];
  const session = await env.NAV_AUTH.get(`session_${token}`);
  
  return Boolean(session);
}

export function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function clearHomeCache(env) {
  try {
    const keysToDelete = new Set(['home_html_public', 'home_html_private']);
    let cursor;

    do {
      const list = await env.NAV_AUTH.list({ prefix: 'home_html_', cursor, limit: 1000 });
      (list.keys || []).forEach(item => keysToDelete.add(item.name));
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    await Promise.all(Array.from(keysToDelete).map(key => env.NAV_AUTH.delete(key)));
    console.log('Home cache cleared');
  } catch (e) {
    console.error('Failed to clear home cache:', e);
  }
}

// DB_SCHEMA and SCHEMA_VERSION are imported from constants.js

let dbInitialized = false;

async function initializeDb(db, kv) {
  if (dbInitialized) return;

  // 检查 KV 缓存，如果已经迁移过，说明表结构已就绪，跳过初始化
  if (kv) {
    try {
      const migrated = await kv.get(`schema_migrated_${SCHEMA_VERSION}`);
      if (migrated) {
        dbInitialized = true;
        return;
      }
    } catch (e) {
      // KV 读取失败不应阻塞，继续尝试数据库初始化
      console.warn("KV check failed:", e);
    }
  }

  try {
    console.log("Initializing database...");
    const statements = DB_SCHEMA.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    const preparedStatements = statements.map(stmt => db.prepare(stmt));
    
    await db.batch(preparedStatements);
    
    // 3. 标记初始化完成
    dbInitialized = true;
    if (kv) {
      // 标记迁移完成（永久缓存，直到 SCHEMA_VERSION 变更）
      await kv.put(`db_init_${SCHEMA_VERSION}`, 'true');
      // 同时写入 schema_migrated 标记，避免 index.js 重复检查
      await kv.put(`schema_migrated_${SCHEMA_VERSION}`, 'true');
    }
    console.log("Database initialized successfully.");
  } catch (e) {
    console.error("Database initialization failed:", e);
    // 初始化失败时,我们只记录错误并继续,以防影响正常请求
  }
}

// 导出中间件(可选,用于添加全局逻辑)
export async function onRequest(context) {
  // 在每个请求开始时检查并初始化数据库
  if (context.env.NAV_DB) {
    await initializeDb(context.env.NAV_DB, context.env.NAV_AUTH);
  }
  
  // 在这里可以添加全局中间件逻辑
  // 例如: 日志记录、CORS 头等
  return context.next();
}
