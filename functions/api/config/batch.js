import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';

const CHUNK_SIZE = 50;

function splitChunks(items, size = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeIdList(ids) {
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

async function collectAffectedCategoryIds(db, idChunks) {
  const affected = new Set();

  for (const chunk of idChunks) {
    const placeholders = chunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT DISTINCT catelog_id FROM sites WHERE id IN (${placeholders}) AND catelog_id IS NOT NULL`)
      .bind(...chunk)
      .all();

    (results || []).forEach((row) => {
      const categoryId = Number(row.catelog_id);
      if (Number.isInteger(categoryId) && categoryId > 0) {
        affected.add(categoryId);
      }
    });
  }

  return Array.from(affected);
}

async function expandCategoryIdsWithAncestors(db, categoryIds) {
  const visited = new Set(categoryIds);
  let frontier = [...categoryIds];

  while (frontier.length > 0) {
    const nextFrontier = [];

    for (const chunk of splitChunks(frontier)) {
      const placeholders = chunk.map(() => '?').join(',');
      const { results } = await db
        .prepare(`SELECT id, parent_id FROM category WHERE id IN (${placeholders})`)
        .bind(...chunk)
        .all();

      (results || []).forEach((row) => {
        const parentId = Number(row.parent_id || 0);
        if (Number.isInteger(parentId) && parentId > 0 && !visited.has(parentId)) {
          visited.add(parentId);
          nextFrontier.push(parentId);
        }
      });
    }

    frontier = nextFrontier;
  }

  return Array.from(visited);
}

async function cleanupEmptyCategories(db, categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return 0;
  }

  let totalDeleted = 0;
  let changed = 0;

  do {
    changed = 0;

    for (const chunk of splitChunks(categoryIds)) {
      const placeholders = chunk.map(() => '?').join(',');
      const result = await db
        .prepare(`
          DELETE FROM category
          WHERE id IN (${placeholders})
            AND NOT EXISTS (
              SELECT 1
              FROM sites s
              WHERE s.catelog_id = category.id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM category child
              WHERE child.parent_id = category.id
            )
        `)
        .bind(...chunk)
        .run();

      const deleted = Number(result?.meta?.changes || 0);
      changed += deleted;
      totalDeleted += deleted;
    }
  } while (changed > 0);

  return totalDeleted;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { action, ids, payload } = await request.json();
    const normalizedIds = normalizeIdList(ids);

    if (normalizedIds.length === 0) {
      return errorResponse('未提供有效 ID', 400);
    }

    const idChunks = splitChunks(normalizedIds);
    const statements = [];

    if (action === 'delete') {
      const directCategoryIds = await collectAffectedCategoryIds(env.NAV_DB, idChunks);

      idChunks.forEach((chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`DELETE FROM sites WHERE id IN (${placeholders})`).bind(...chunk)
        );
      });

      if (statements.length > 0) {
        await env.NAV_DB.batch(statements);
      }

      const cleanupScope = await expandCategoryIdsWithAncestors(env.NAV_DB, directCategoryIds);
      const deletedCategories = await cleanupEmptyCategories(env.NAV_DB, cleanupScope);

      const categoryCleanupMessage =
        deletedCategories > 0 ? `，并清理 ${deletedCategories} 个空分类` : '';

      return jsonResponse({
        code: 200,
        message: `成功删除 ${normalizedIds.length} 条书签${categoryCleanupMessage}`
      });
    }

    if (action === 'update_category') {
      const categoryId = Number(payload?.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return errorResponse('分类 ID 是必填项', 400);
      }

      const category = await env.NAV_DB
        .prepare('SELECT catelog, is_private FROM category WHERE id = ?')
        .bind(categoryId)
        .first();

      if (!category) {
        return errorResponse('找不到分类', 404);
      }

      let baseSql = 'UPDATE sites SET catelog_id = ?, catelog_name = ?';
      const baseParams = [categoryId, category.catelog];

      if (Number(category.is_private) === 1) {
        baseSql += ', is_private = 1';
      }

      idChunks.forEach((chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`${baseSql} WHERE id IN (${placeholders})`).bind(...baseParams, ...chunk)
        );
      });

      if (statements.length > 0) {
        await env.NAV_DB.batch(statements);
      }

      return jsonResponse({
        code: 200,
        message: `成功更新 ${normalizedIds.length} 条书签的分类`
      });
    }

    if (action === 'update_privacy') {
      const isPrivate = payload?.isPrivate;
      if (isPrivate === undefined) {
        return errorResponse('隐私状态是必填项', 400);
      }

      const isPrivateValue = isPrivate ? 1 : 0;

      idChunks.forEach((chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`UPDATE sites SET is_private = ? WHERE id IN (${placeholders})`).bind(isPrivateValue, ...chunk)
        );
      });

      if (statements.length > 0) {
        await env.NAV_DB.batch(statements);
      }

      return jsonResponse({
        code: 200,
        message: `成功更新 ${normalizedIds.length} 条书签的隐私属性`
      });
    }

    return errorResponse('无效的操作', 400);
  } catch (e) {
    return errorResponse(`批量操作失败: ${e.message}`, 500);
  }
}
