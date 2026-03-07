import { isAdminAuthenticated, errorResponse, jsonResponse, clearHomeCache } from '../_middleware';

const CHUNK_SIZE = 50;
const SORT_STEP = 10;

function splitChunks(items, size = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const normalized = [];
  ids.forEach((id) => {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0 || seen.has(num)) {
      return;
    }
    seen.add(num);
    normalized.push(num);
  });
  return normalized;
}

async function resolveCatalogId(db, rawCatalogId, ids) {
  const parsed = Number.parseInt(String(rawCatalogId || ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  if (!ids.length) return 0;
  const row = await db.prepare('SELECT catelog_id FROM sites WHERE id = ?').bind(ids[0]).first();
  const fallback = Number(row?.catelog_id);
  if (!Number.isInteger(fallback) || fallback <= 0) {
    return 0;
  }
  return fallback;
}

async function collectValidIds(db, ids, catalogId) {
  const idSet = new Set();
  const chunks = splitChunks(ids);

  for (const chunk of chunks) {
    const placeholders = chunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT id FROM sites WHERE catelog_id = ? AND id IN (${placeholders})`)
      .bind(catalogId, ...chunk)
      .all();
    (results || []).forEach((row) => {
      const id = Number(row?.id);
      if (Number.isInteger(id) && id > 0) {
        idSet.add(id);
      }
    });
  }

  return ids.filter((id) => idSet.has(id));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const ids = normalizeIds(body?.ids);
    if (ids.length === 0) {
      return errorResponse('No valid bookmark ids provided', 400);
    }

    const catalogId = await resolveCatalogId(env.NAV_DB, body?.catalogId, ids);
    if (!catalogId) {
      return errorResponse('Invalid catalog id', 400);
    }

    const validIds = await collectValidIds(env.NAV_DB, ids, catalogId);
    if (validIds.length === 0) {
      return errorResponse('No valid bookmarks found for this category', 400);
    }

    const statements = validIds.map((id, index) =>
      env.NAV_DB
        .prepare('UPDATE sites SET sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ? AND catelog_id = ?')
        .bind((index + 1) * SORT_STEP, id, catalogId)
    );

    await env.NAV_DB.batch(statements);
    await clearHomeCache(env);

    return jsonResponse({
      code: 200,
      message: 'Bookmark order synced',
      data: {
        catalogId,
        updated: validIds.length,
        cacheCleared: true
      }
    });
  } catch (e) {
    return errorResponse(`Failed to sync bookmark order: ${e.message}`, 500);
  }
}
