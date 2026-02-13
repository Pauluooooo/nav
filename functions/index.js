// functions/index.js
import { isAdminAuthenticated } from './_middleware';
import { FONT_MAP, SCHEMA_VERSION } from './constants';

// 杈呭姪鍑芥暟
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }
}

function normalizeSortOrder(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 9999;
}

// 鍐呭瓨缂撳瓨锛氱儹鐘舵€佷笅璺宠繃 KV 璇诲彇锛屽彧鏈夊喎鍚姩鏃舵墠鏌?KV
let schemaMigrated = false;

async function ensureSchema(env) {
  // 鐑姸鎬佺洿鎺ヨ繑鍥烇紝涓嶈 KV
  if (schemaMigrated) return;

  // 鍐峰惎鍔ㄦ椂妫€鏌?KV 涓槸鍚﹀凡瀹屾垚杩佺Щ
  const migrated = await env.NAV_AUTH.get(`schema_migrated_${SCHEMA_VERSION}`);
  if (migrated) {
    schemaMigrated = true;  // 鏇存柊鍐呭瓨缂撳瓨
    return;
  }

  try {
    // 鎵归噺鎵ц鎵€鏈夌储寮曞垱寤猴紙鍑忓皯鏁版嵁搴撳線杩旓級
    await env.NAV_DB.batch([
      env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)"),
      env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)")
    ]);

    // 妫€鏌ュ苟娣诲姞缂哄け鐨勫垪锛堜娇鐢?PRAGMA 鏇撮珮鏁堬級
    const sitesColumns = await env.NAV_DB.prepare("PRAGMA table_info(sites)").all();
    const sitesCols = new Set(sitesColumns.results.map(c => c.name));
    
    const categoryColumns = await env.NAV_DB.prepare("PRAGMA table_info(category)").all();
    const categoryCols = new Set(categoryColumns.results.map(c => c.name));
    
    const pendingColumns = await env.NAV_DB.prepare("PRAGMA table_info(pending_sites)").all();
    const pendingCols = new Set(pendingColumns.results.map(c => c.name));

    const alterStatements = [];
    
    if (!sitesCols.has('is_private')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN is_private INTEGER DEFAULT 0"));
    }
    if (!sitesCols.has('catelog_name')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN catelog_name TEXT"));
    }
    if (!pendingCols.has('catelog_name')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE pending_sites ADD COLUMN catelog_name TEXT"));
    }
    if (!categoryCols.has('is_private')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE category ADD COLUMN is_private INTEGER DEFAULT 0"));
    }
    if (!categoryCols.has('parent_id')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE category ADD COLUMN parent_id INTEGER DEFAULT 0"));
    }

    if (alterStatements.length > 0) {
      // SQLite 涓嶆敮鎸佹壒閲?ALTER锛岄渶瑕侀€愪釜鎵ц
      for (const stmt of alterStatements) {
        try { await stmt.run(); } catch (e) { console.log('Column may already exist:', e.message); }
      }
      
      // 鍚屾 catelog_name 鏁版嵁锛堜粎鍦ㄦ坊鍔犲瓧娈靛悗鎵ц涓€娆★級
      if (!sitesCols.has('catelog_name')) {
        await env.NAV_DB.prepare(`
          UPDATE sites 
          SET catelog_name = (SELECT catelog FROM category WHERE category.id = sites.catelog_id) 
          WHERE catelog_name IS NULL
        `).run();
      }
    }

    // 鏍囪杩佺Щ瀹屾垚锛堟案涔呯紦瀛橈紝鐩村埌 SCHEMA_VERSION 鍙樻洿锛?    await env.NAV_AUTH.put(`schema_migrated_${SCHEMA_VERSION}`, 'true');
    schemaMigrated = true;  // 鏇存柊鍐呭瓨缂撳瓨
    console.log('Schema migration completed');
  } catch (e) {
    console.error('Schema migration failed:', e);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  
  // 浣跨敤 KV 缂撳瓨 Schema 杩佺Щ鐘舵€侊紝閬垮厤姣忔鍐峰惎鍔ㄩ兘妫€鏌?  await ensureSchema(env);

  const isAuthenticated = await isAdminAuthenticated(request, env);
  const includePrivate = isAuthenticated ? 1 : 0;

  // 1. 灏濊瘯璇诲彇 KV 缂撳瓨 (浠呴拡瀵规棤鏌ヨ鍙傛暟鐨勯椤佃姹?
  const url = new URL(request.url);
  const isHomePage = url.pathname === '/' && !url.search;
  
  // Cookie Bridge: Check for stale cache cookie
  const cookies = request.headers.get('Cookie') || '';
  const hasStaleCookie = cookies.includes('iori_cache_stale=1');
  let shouldClearCookie = false;
  const rawCommitSha = String(env.CF_PAGES_COMMIT_SHA || '').trim();
  const hasStableDeploymentTag = rawCommitSha.length > 0;
  const deploymentTag = String(hasStableDeploymentTag ? rawCommitSha : 'nocache')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16) || 'nocache';
  const cacheKeyPublic = 'home_html_' + deploymentTag + '_public';
  const cacheKeyPrivate = 'home_html_' + deploymentTag + '_private';
  const allowHomeCache = isHomePage && hasStableDeploymentTag;

  if (allowHomeCache) {
    if (isAuthenticated && hasStaleCookie) {
        // Detected stale cookie + Admin -> Clear Cache & Skip Read
        await env.NAV_AUTH.delete(cacheKeyPrivate);
        await env.NAV_AUTH.delete(cacheKeyPublic);
        shouldClearCookie = true;
    } else {
        const cacheKey = isAuthenticated ? cacheKeyPrivate : cacheKeyPublic;
        try {
          const cachedHtml = await env.NAV_AUTH.get(cacheKey);
          if (cachedHtml) {
            return new Response(cachedHtml, {
              headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'X-Cache': 'HIT'
              }
            });
          }
        } catch (e) {
          console.warn('Failed to read home cache:', e);
        }
    }
  }

  // 骞惰鎵ц鏁版嵁搴撴煡璇紙鍒嗙被銆佽缃€佺珯鐐癸級
  const categoryQuery = isAuthenticated 
    ? 'SELECT * FROM category ORDER BY sort_order ASC, id ASC'
    : `SELECT * FROM category
       WHERE (CASE
         WHEN LOWER(TRIM(CAST(is_private AS TEXT))) IN ('1', 'true') THEN 1
         ELSE 0
       END) = 0
       ORDER BY sort_order ASC, id ASC`;
  
  const settingsKeys = [
    'layout_hide_desc', 'layout_hide_links', 'layout_hide_category',
    'layout_hide_title', 'home_title_size', 'home_title_color',
    'layout_hide_subtitle', 'home_subtitle_size', 'home_subtitle_color',
    'home_hide_stats', 'home_stats_size', 'home_stats_color',
    'home_hide_github', 'home_hide_admin',
    'home_custom_font_url', 'home_title_font', 'home_subtitle_font', 'home_stats_font',
    'home_site_name', 'home_site_description',
    'home_search_engine_enabled', 'home_search_engine_provider',
    'home_theme_mode', 'home_theme_auto_dark_start', 'home_theme_auto_dark_end',
    'layout_grid_cols', 'layout_custom_wallpaper',
    'layout_random_wallpaper', 'bing_country',
    'layout_enable_frosted_glass', 'layout_frosted_glass_intensity',
    'layout_enable_bg_blur', 'layout_bg_blur_intensity', 'layout_card_style',
    'layout_card_border_radius', 'layout_card_scale', 'card_width',
    'wallpaper_source', 'wallpaper_cid_360',
    'card_title_font', 'card_title_size', 'card_title_color',
    'card_desc_font', 'card_desc_size', 'card_desc_color'
  ];
  const settingsPlaceholders = settingsKeys.map(() => '?').join(',');

  const sitesQuery = `SELECT id, name, url, logo, desc, catelog_id, catelog_name, sort_order, is_private, create_time, update_time 
                      FROM sites WHERE ((CASE
                        WHEN LOWER(TRIM(CAST(is_private AS TEXT))) IN ('1', 'true') THEN 1
                        ELSE 0
                      END) = 0 OR ? = 1) 
                      ORDER BY sort_order ASC, create_time DESC`;

  // 骞惰鎵ц鎵€鏈夋煡璇?
  const [categoriesResult, settingsResult, sitesResult] = await Promise.all([
    env.NAV_DB.prepare(categoryQuery).all().catch(e => ({ results: [], error: e })),
    env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${settingsPlaceholders})`).bind(...settingsKeys).all().catch(e => ({ results: [], error: e })),
    env.NAV_DB.prepare(sitesQuery).bind(includePrivate).all().catch(e => ({ results: [], error: e }))
  ]);

  // 澶勭悊鍒嗙被缁撴灉
  let categories = categoriesResult.results || [];
  if (categoriesResult.error) {
    console.error('Failed to fetch categories:', categoriesResult.error);
  }

  const categoryMap = new Map();
  const categoryIdMap = new Map(); 
  const rootCategories = [];

  categories.forEach(cat => {
    cat.children = [];
    cat.sort_order = normalizeSortOrder(cat.sort_order);
    categoryMap.set(cat.id, cat);
    if (cat.catelog) {
        categoryIdMap.set(cat.catelog, cat.id);
    }
  });

  categories.forEach(cat => {
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id).children.push(cat);
    } else {
      rootCategories.push(cat);
    }
  });

  const sortCats = (cats) => {
    cats.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    cats.forEach(c => sortCats(c.children));
  };
  sortCats(rootCategories);

  // 澶勭悊璁剧疆缁撴灉
  let layoutHideDesc = false;
  let layoutHideLinks = false;
  let layoutHideCategory = false;
  let layoutHideTitle = false;
  let homeTitleSize = '';
  let homeTitleColor = '';
  let layoutHideSubtitle = false;
  let homeSubtitleSize = '';
  let homeSubtitleColor = '';
  let homeHideStats = false;
  let homeStatsSize = '';
  let homeStatsColor = '';
  let homeHideGithub = false;
  let homeHideAdmin = false;
  let homeCustomFontUrl = '';
  let homeTitleFont = '';
  let homeSubtitleFont = '';
  let homeStatsFont = '';
  let homeSiteName = '';
  let homeSiteDescription = '';
  let homeSearchEngineEnabled = false;
  let homeSearchEngineProvider = 'local';
  let homeThemeMode = 'auto';
  let homeThemeAutoDarkStart = '19';
  let homeThemeAutoDarkEnd = '7';
  let layoutGridCols = '4';
  let layoutCustomWallpaper = '';
  let layoutRandomWallpaper = false;
  let bingCountry = '';
  let layoutEnableFrostedGlass = false;
  let layoutFrostedGlassIntensity = '15';
  let layoutEnableBgBlur = false;
  let layoutBgBlurIntensity = '0';
  let layoutCardStyle = 'style1';
  let layoutCardBorderRadius = '12';
  let layoutCardScale = '100';
  let wallpaperSource = 'bing';
  let wallpaperCid360 = '36';
  
  let cardTitleFont = '';
  let cardTitleSize = '';
  let cardTitleColor = '';
  let cardDescFont = '';
  let cardDescSize = '';
  let cardDescColor = '';
  let cardWidth = '100%';

  if (settingsResult.results) {
    settingsResult.results.forEach(row => {
      if (row.key === 'layout_hide_desc') layoutHideDesc = row.value === 'true';
      if (row.key === 'layout_hide_links') layoutHideLinks = row.value === 'true';
      if (row.key === 'layout_hide_category') layoutHideCategory = row.value === 'true';
      
      if (row.key === 'layout_hide_title') layoutHideTitle = row.value === 'true';
      if (row.key === 'home_title_size') homeTitleSize = row.value;
      if (row.key === 'home_title_color') homeTitleColor = row.value;

      if (row.key === 'layout_hide_subtitle') layoutHideSubtitle = row.value === 'true';
      if (row.key === 'home_subtitle_size') homeSubtitleSize = row.value;
      if (row.key === 'home_subtitle_color') homeSubtitleColor = row.value;

      if (row.key === 'home_hide_stats') homeHideStats = row.value === 'true';
      if (row.key === 'home_stats_size') homeStatsSize = row.value;
      if (row.key === 'home_stats_color') homeStatsColor = row.value;

      if (row.key === 'home_hide_github') homeHideGithub = (row.value === 'true' || row.value === '1');
      if (row.key === 'home_hide_admin') homeHideAdmin = (row.value === 'true' || row.value === '1');

      if (row.key === 'home_custom_font_url') homeCustomFontUrl = row.value;
      if (row.key === 'home_title_font') homeTitleFont = row.value;
      if (row.key === 'home_subtitle_font') homeSubtitleFont = row.value;
      if (row.key === 'home_stats_font') homeStatsFont = row.value;

      if (row.key === 'home_site_name') homeSiteName = row.value;
      if (row.key === 'home_site_description') homeSiteDescription = row.value;

      if (row.key === 'home_search_engine_enabled') homeSearchEngineEnabled = row.value === 'true';
      if (row.key === 'home_search_engine_provider') homeSearchEngineProvider = row.value;
      if (row.key === 'home_theme_mode') homeThemeMode = row.value;
      if (row.key === 'home_theme_auto_dark_start') homeThemeAutoDarkStart = row.value;
      if (row.key === 'home_theme_auto_dark_end') homeThemeAutoDarkEnd = row.value;

      if (row.key === 'layout_grid_cols') layoutGridCols = row.value;
      if (row.key === 'layout_custom_wallpaper') layoutCustomWallpaper = row.value;
      if (row.key === 'layout_random_wallpaper') layoutRandomWallpaper = row.value === 'true';
      if (row.key === 'bing_country') bingCountry = row.value;
      if (row.key === 'layout_enable_frosted_glass') layoutEnableFrostedGlass = row.value === 'true';
      if (row.key === 'layout_frosted_glass_intensity') layoutFrostedGlassIntensity = row.value;
      if (row.key === 'layout_enable_bg_blur') layoutEnableBgBlur = row.value === 'true';
      if (row.key === 'layout_bg_blur_intensity') layoutBgBlurIntensity = row.value;
      if (row.key === 'layout_card_style') layoutCardStyle = row.value;
      if (row.key === 'layout_card_border_radius') layoutCardBorderRadius = row.value;
      if (row.key === 'layout_card_scale') layoutCardScale = row.value;
      if (row.key === 'wallpaper_source') wallpaperSource = row.value;
      if (row.key === 'wallpaper_cid_360') wallpaperCid360 = row.value;
      
      if (row.key === 'card_title_font') cardTitleFont = row.value;
      if (row.key === 'card_title_size') cardTitleSize = row.value;
      if (row.key === 'card_title_color') cardTitleColor = row.value;
      if (row.key === 'card_desc_font') cardDescFont = row.value;
      if (row.key === 'card_desc_size') cardDescSize = row.value;
      if (row.key === 'card_desc_color') cardDescColor = row.value;
      if (row.key === 'card_width') cardWidth = row.value;
    });
  }

  const allowedSearchEngines = new Set(['local', 'google', 'baidu', 'bing']);
  let normalizedSearchEngine = String(homeSearchEngineProvider || '').toLowerCase();
  if (!allowedSearchEngines.has(normalizedSearchEngine)) {
    normalizedSearchEngine = homeSearchEngineEnabled ? 'baidu' : 'local';
  }
  homeSearchEngineProvider = normalizedSearchEngine;

  homeThemeMode = String(homeThemeMode || '').toLowerCase() === 'manual' ? 'manual' : 'auto';
  const normalizeThemeHour = (value, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 23) {
      return String(fallback);
    }
    return String(parsed);
  };
  homeThemeAutoDarkStart = normalizeThemeHour(homeThemeAutoDarkStart, 19);
  homeThemeAutoDarkEnd = normalizeThemeHour(homeThemeAutoDarkEnd, 7);

  // 澶勭悊绔欑偣缁撴灉
  let allSites = sitesResult.results || [];
  if (sitesResult.error) {
    return new Response(`Failed to fetch sites: ${sitesResult.error.message}`, { status: 500 });
  }

  // 纭畾鐩爣鍒嗙被
  let currentCatalogName = '';
  const catalogExists = false;

  // 濮嬬粓灞曠ず鍏ㄩ儴绔欑偣锛堝垎绫诲鑸敼涓哄畾浣嶅垎缁勬ā寮忥級
  let sites = allSites;

  // 闅忔満澹佺焊杞
  let nextWallpaperIndex = 0;
  if (layoutRandomWallpaper) {
    try {
      const cookies = request.headers.get('Cookie') || '';
      const match = cookies.match(/wallpaper_index=(\d+)/);
      const currentWallpaperIndex = match ? parseInt(match[1]) : -1;

      if (wallpaperSource === '360') {
        const cid = wallpaperCid360 || '36';
        const apiUrl = `http://cdn.apc.360.cn/index.php?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${cid}&start=0&count=8`;
        const res = await fetch(apiUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.errno === "0" && json.data && json.data.length > 0) {
            nextWallpaperIndex = (currentWallpaperIndex + 1) % json.data.length;
            const targetItem = json.data[nextWallpaperIndex];
            let targetUrl = targetItem.url;
            if (targetUrl) {
              targetUrl = targetUrl.replace('http://', 'https://');
              layoutCustomWallpaper = targetUrl;
            }
          }
        }
      } else {
        // Default to Bing
        let bingUrl = '';
        if (bingCountry === 'spotlight') {
          bingUrl = 'https://peapix.com/spotlight/feed?n=7';
        } else {
          bingUrl = `https://peapix.com/bing/feed?n=7&country=${bingCountry}`;
        }
        const res = await fetch(bingUrl);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            nextWallpaperIndex = (currentWallpaperIndex + 1) % data.length;
            const targetItem = data[nextWallpaperIndex];
            const targetUrl = targetItem.fullUrl || targetItem.url;
            if (targetUrl) {
              layoutCustomWallpaper = targetUrl;
            }
          }
        }
      }
    } catch (e) {
      console.error('Random Wallpaper Error:', e);
    }
  }

    const isCustomWallpaper = Boolean(layoutCustomWallpaper);

    const themeClass = isCustomWallpaper ? 'custom-wallpaper' : '';

    

        // Header Base Classes

    

    

    

        let headerClass = isCustomWallpaper 

    

            ? 'bg-transparent border-none shadow-none transition-colors duration-300' 

    

            : 'bg-primary-700 text-white border-b border-primary-600 shadow-sm dark:bg-gray-900 dark:border-gray-800';

    

      

    

        let containerClass = isCustomWallpaper

    

            ? 'rounded-2xl'

    

            : 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm dark:bg-gray-800/80 dark:border-gray-700';

    

      

    

        const titleColorClass = isCustomWallpaper ? 'text-gray-900 dark:text-gray-100' : 'text-white';

    

        const subTextColorClass = isCustomWallpaper ? 'text-gray-600 dark:text-gray-300' : 'text-primary-100/90 dark:text-gray-400';

    

        

    

        const searchInputClass = isCustomWallpaper

    

            ? 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white dark:bg-gray-800/90 dark:border-gray-600 dark:text-gray-200 dark:focus:bg-gray-800'

    

            : 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder-gray-500';

    

        const searchIconClass = isCustomWallpaper ? 'text-gray-400 dark:text-gray-500' : 'text-primary-200 dark:text-gray-500';

  

    // 4. 鐢熸垚鍔ㄦ€佽彍鍗?
    const flattenCategories = (cats, level = 0, acc = []) => {
    if (!Array.isArray(cats)) return acc;
    cats.forEach((cat) => {
      acc.push({ id: cat.id, name: cat.catelog, level });
      if (Array.isArray(cat.children) && cat.children.length > 0) {
        flattenCategories(cat.children, level + 1, acc);
      }
    });
    return acc;
  };

  const flatCategories = flattenCategories(rootCategories);
  const allLinkClass = catalogExists ? 'inactive' : 'active nav-item-active';

  const renderUnifiedCategoryLinks = (entries) => entries.map((entry) => {
    const isActive = currentCatalogName === entry.name;
    const stateClass = isActive ? 'active nav-item-active' : 'inactive';
    const level = Number.isFinite(entry.level) ? Math.max(0, Math.min(4, entry.level)) : 0;
    const levelPrefix = level > 0 ? `${'· '.repeat(level)}` : '';
    const safeLabel = escapeHTML(`${levelPrefix}${entry.name}`);
    const safeTitle = escapeHTML(String(entry.name || ''));
    const encodedName = encodeURIComponent(entry.name);
    return `<a href="?catalog=${encodedName}" class="nav-btn catalog-chip ${stateClass}" data-id="${entry.id}" data-level="${level}" title="${safeTitle}">${safeLabel}</a>`;
  }).join('');

  const horizontalCatalogMarkup = `
    <a href="?catalog=all" class="nav-btn ${allLinkClass}" data-role="all-catalog">全部</a>
    ${renderUnifiedCategoryLinks(flatCategories)}
  `;

  const catalogLinkMarkup = '';

  

    // Sites Grid
    let sitesGridMarkup = sites.map((site, index) => {
                      const rawName = site.name || 'Untitled';
                  const rawCatalog = site.catelog_name || 'Uncategorized';

      const rawDesc = site.desc || '暂无描述';

      const normalizedUrl = sanitizeUrl(site.url);

      const safeDisplayUrl = normalizedUrl || 'No URL';

      const logoUrl = sanitizeUrl(site.logo);

      const cardInitial = escapeHTML((rawName.trim().charAt(0) || 'U').toUpperCase());

      const safeName = escapeHTML(rawName);

      const safeCatalog = escapeHTML(rawCatalog);

      const safeDesc = escapeHTML(rawDesc);

      const hasValidUrl = Boolean(normalizedUrl);
      const logoHtml = logoUrl
        ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700" decoding="async" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');">
           <div class="hidden w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`
        : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`;

  

                                    const descHtml = layoutHideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;

  

                          

  

                                                                        const linksHtml = layoutHideLinks ? '' : `

  

                          

  

                                                      <div class="mt-3 flex items-center justify-between">

  

                          

  

                                                        <span class="text-xs text-primary-600 dark:text-primary-400 truncate flex-1 min-w-0 mr-2" title="${safeDisplayUrl}">${escapeHTML(safeDisplayUrl)}</span>

  

                          

  

                                                        <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50' : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'} rounded-full text-xs font-medium transition-colors" data-url="${escapeHTML(normalizedUrl)}" ${hasValidUrl ? '' : 'disabled'}>

  

                          

  

                                    

  

                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ${layoutGridCols >= '5' ? '' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">

  

                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />

  

                      </svg>

  

                      ${layoutGridCols >= '5' ? '' : '<span class="copy-text">复制</span>'}

  

                      <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制</span>

  

                    </button>

  

                  </div>`;

  

            const categoryHtml = layoutHideCategory ? '' : `

  

                        <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700 dark:bg-secondary-800 dark:text-primary-300">

  

                          ${safeCatalog}

  

                        </span>`;

  

            

  

            const frostedClass = layoutEnableFrostedGlass ? 'frosted-glass-effect' : '';

  

            const cardStyleClass = layoutCardStyle === 'style2' ? 'style-2' : '';

  

                              const baseCardClass = layoutEnableFrostedGlass 

  

                    

  

                                        ? 'site-card group h-full flex flex-col overflow-hidden transition-all' 

  

                    

  

                                        : 'site-card group h-full flex flex-col bg-white border border-primary-100/60 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700';

  

                    

  

                              

  

                              // Calculate delay for server-side rendering animation

  

                              // Note: 'sites' is an array, we need the index. map callback provides (site, index).

  

                              // But the current map usage is sites.map((site) => ...), we need to add index argument.

  

                              // Wait, I need to check the full map function signature in the old_string context or just update it.

  

                              // The surrounding code shows `const sitesGridMarkup = sites.map((site) => {`.

  

                              // I will update the map arguments.

  

                  

  

                              const delay = Math.min(index, 20) * 30;

  

                              const animStyle = delay > 0 ? `style="animation-delay: ${delay}ms"` : '';

  

                    

  

                              return `

  

                    

  

                                <div class="${baseCardClass} ${frostedClass} ${cardStyleClass} card-anim-enter" ${animStyle} data-id="${site.id}" data-name="${escapeHTML(site.name)}" data-url="${escapeHTML(normalizedUrl)}" data-catalog-id="${escapeHTML(String(site.catelog_id ?? ''))}" data-catalog="${escapeHTML(site.catelog_name || site.catelog || 'Uncategorized')}" data-desc="${safeDesc}">

  

                <div class="site-card-content">

  

                  <a href="${escapeHTML(normalizedUrl || '#')}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">

  

                    <div class="flex items-start">

  

                      <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">

  

                                                ${logoHtml}

  

                      </div>

  

                      <div class="flex-1 min-w-0">

  

                        <h3 class="site-title text-base font-medium text-gray-900 dark:text-gray-100 truncate transition-all duration-300 origin-left" title="${safeName}">${safeName}</h3>

  

                        ${categoryHtml}

  

                      </div>

  

                    </div>

  

                    ${descHtml}

  

                  </a>

  

                  ${linksHtml}

  

                </div>

  

              </div>

  

            `;

    }).join('');

  if (sites.length === 0) {
      const emptyStateText = categories.length === 0 ? 'Welcome to iori-nav' : 'No bookmarks yet';
      const emptyStateSub = categories.length === 0
        ? 'Initialization complete. Add categories and bookmarks in admin.'
        : 'There are no bookmarks in this category yet.';
      
      sitesGridMarkup = `
        <div class="col-span-full flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div class="w-32 h-32 mb-6 text-gray-200 dark:text-gray-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
            </div>
            <h3 class="text-xl font-medium text-gray-600 dark:text-gray-300 mb-2">${emptyStateText}</h3>
            <p class="text-gray-400 dark:text-gray-500 max-w-md mx-auto mb-8">${emptyStateSub}</p>
            ${
                !homeHideAdmin ? 
                `<a href="/admin" target="_blank" class="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 hover:-translate-y-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    鍓嶅線绠＄悊鍚庡彴
                </a>` : ''
            }
        </div>
      `;
  }

  let gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 justify-items-center';
  if (layoutGridCols === '5') {
      // 1024px+ 鏄剧ず 5 鍒?      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 justify-items-center';
  } else if (layoutGridCols === '6') {
      // 1024px+ 鏄剧ず 5 鍒? 1280px+ 鏄剧ず 6 鍒?(浼樺寲锛?200px 宸﹀彸涔熷彲灏濊瘯 6 鍒楋紝浣嗚€冭檻鍒颁晶杈规爮锛屼繚闄╄捣瑙?1280px 鍒?6 鍒楋紝浣?1024px 鍒?5 鍒楀凡缁忔瘮鍘熸潵 4 鍒楀ソ浜?
      // 鐢ㄦ埛鍙嶉 1200px 鍙湁 4 鍒楀お灏戯紝鐜板湪 1200px 浼氭槸 5 鍒椼€?      // 涔熷彲浠ュ姞鍏?min-[1200px]:grid-cols-6
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-[1200px]:grid-cols-6 gap-3 sm:gap-6 justify-items-center';
  } else if (layoutGridCols === '7') {
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 sm:gap-6 justify-items-center';
  }

  const datalistOptions = categories.map((cat) => `<option value="${escapeHTML(cat.catelog)}">`).join('');
  
  const headingPlainText = currentCatalogName
    ? `${currentCatalogName} · ${sites.length} bookmarks`
    : `All bookmarks · ${sites.length} bookmarks`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalogName) : '';
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
  const submissionClass = submissionEnabled ? '' : 'hidden';

  // Defaults for template placeholders.
  const siteName = homeSiteName || env.SITE_NAME || 'Iori Nav';
  const siteDescription = homeSiteDescription || env.SITE_DESCRIPTION || 'Bookmarks navigation';
  const footerText = env.FOOTER_TEXT || 'Iori Nav';

  // Build Style Strings
  const getStyleStr = (size, color, font) => {
    let s = '';
    if (size) s += `font-size: ${size}px;`;
    if (color) s += `color: ${color} !important;`;
    if (font) s += `font-family: ${font} !important;`;
    return s ? `style="${s}"` : '';
  };
  
  const titleStyle = getStyleStr(homeTitleSize, homeTitleColor, homeTitleFont);
  const subtitleStyle = getStyleStr(homeSubtitleSize, homeSubtitleColor, homeSubtitleFont);
  const statsStyle = getStyleStr(homeStatsSize, homeStatsColor, homeStatsFont);

  // Determine if the stats row should be rendered with padding/margin
  const shouldRenderStatsRow = !homeHideStats;
  const statsRowPyClass = shouldRenderStatsRow ? 'my-8' : 'hidden';
  const statsRowMbClass = '';
  const statsRowHiddenClass = shouldRenderStatsRow ? '' : 'hidden';

  const horizontalTitleHtml = layoutHideTitle ? '' : `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${titleColorClass}" ${titleStyle}>{{SITE_NAME}}</h1>`;
  const horizontalSubtitleHtml = layoutHideSubtitle ? '' : `<p class="${subTextColorClass} opacity-90 text-sm md:text-base" ${subtitleStyle}>{{SITE_DESCRIPTION}}</p>`;

  const searchPlaceholderMap = {
    local: '搜索书签...',
    google: 'Google 搜索...',
    baidu: '百度搜索...',
    bing: 'Bing 搜索...'
  };
  const searchInputPlaceholder = searchPlaceholderMap[homeSearchEngineProvider] || searchPlaceholderMap.local;

  const headerContent = `
    <div class="max-w-5xl mx-auto text-center relative z-10 ${themeClass}">
      <div class="max-w-4xl mx-auto mb-8">
        ${horizontalTitleHtml}
        ${horizontalSubtitleHtml}
      </div>

      <div class="relative max-w-xl mx-auto mb-8">
        <div class="search-input-target-wrapper relative">
          <div class="relative">
            <input id="headerSearchInput" type="text" name="search" aria-label="搜索" placeholder="${searchInputPlaceholder}" class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div id="suggestionDropdown" class="suggestion-dropdown hidden">
            <ul id="suggestionList" class="suggestion-list"></ul>
          </div>
        </div>
      </div>

      <div class="relative max-w-5xl mx-auto">
        <div id="horizontalCategoryNav" class="unified-category-nav flex flex-wrap justify-center items-center gap-2 sm:gap-3">
          ${horizontalCatalogMarkup}
        </div>
      </div>
    </div>
  `;

  let sidebarClass = 'hidden';
  let mainClass = '';
  let sidebarToggleClass = '!hidden';
  let githubIconHtml = '';
  let adminIconHtml = '';
  const themeIconHtml = `
    <button id="themeToggleBtn" class="flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-amber-500 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-yellow-300 transition-all cursor-pointer" title="切换主题">
      <svg id="themeIconSun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block dark:hidden"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
      <svg id="themeIconMoon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>
  `;

  if (!homeHideGithub) {
    githubIconHtml = `
      <a href="https://slink.661388.xyz/iori-nav" target="_blank" class="fixed top-4 left-4 z-50 flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-black dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-white transition-all" title="GitHub">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
      </a>
    `;
  }

  if (!homeHideAdmin) {
    adminIconHtml = `
      <a href="/admin" target="_blank" class="flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-primary-600 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-primary-400 transition-all" title="后台管理">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path><path d="M7 18a5 5 0 0 1 10 0"></path></svg>
      </a>
    `;
  }

  const topRightActionsHtml = `
    <div class="fixed top-4 right-4 z-50 flex items-center gap-3">
      ${themeIconHtml}
      ${adminIconHtml}
    </div>
  `;

  const leftTopActionHtml = `${githubIconHtml}`;

  const footerClass = isCustomWallpaper
      ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none text-black dark:text-gray-200'
      : 'bg-white py-8 px-6 mt-12 border-t border-primary-100 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400';
      
  const templateResponse = await env.ASSETS.fetch(new URL('/index.html', request.url));
  let html = await templateResponse.text();

  // Inject runtime asset version to avoid stale immutable asset cache after deployments.
  const applyRuntimeAssetVersion = (markup, assetPath) => {
    const escaped = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(${escaped})(?:\\?v=[a-zA-Z0-9_-]+)?(?=["'])`, 'g');
    return markup.replace(pattern, `$1?v=${deploymentTag}`);
  };
  const runtimeVersionedAssets = [
    '/css/style.css',
    '/css/tailwind.min.css',
    '/js/autocomplete.js',
    '/js/main.js',
    '/favicon.svg'
  ];
  runtimeVersionedAssets.forEach((assetPath) => {
    html = applyRuntimeAssetVersion(html, assetPath);
  });
  
  // Inject CSS to hide icons if requested (More robust than regex replacement)
  let hideIconsCss = '<style>';
  if (homeHideGithub) {
      hideIconsCss += 'a[title="GitHub"] { display: none !important; }';
  }
  if (homeHideAdmin) {
      hideIconsCss += 'a[href^="/admin"] { display: none !important; }';
  }
  hideIconsCss += '</style>';
  
  if (hideIconsCss !== '<style></style>') {
      html = html.replace('</head>', hideIconsCss + '</head>');
  }
  
  const safeWallpaperUrl = sanitizeUrl(layoutCustomWallpaper);
  const defaultBgColor = '#fdf8f3';
  
  // 缁熶竴鏋勫缓鑳屾櫙灞傞€昏緫 - 閲囩敤 img 鏍囩鏂规浠ヨВ鍐崇Щ鍔ㄧ缂╂斁闂
  let bgLayerHtml = '';
  
  if (safeWallpaperUrl) {
      const blurStyle = layoutEnableBgBlur ? `filter: blur(${layoutBgBlurIntensity}px); transform: scale(1.02);` : '';
      // transform: scale(1.02) 鏄负浜嗛槻姝㈡ā绯婂悗杈圭紭鍑虹幇鐧借竟
      
      bgLayerHtml = `
        <div id="fixed-background" style="position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;">
          <img src="${safeWallpaperUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; object-position: center center; ${blurStyle}" />
        </div>
      `;
  } else {
      bgLayerHtml = `
        <div id="fixed-background" style="position: fixed; inset: 0; z-index: -1; pointer-events: none; background-color: ${defaultBgColor};"></div>
      `;
  }
  
  // 娉ㄥ叆鍏ㄥ眬鏍峰紡
  const globalScrollCss = `
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
      }
      #app-scroll {
        width: 100%;
        height: var(--iori-stable-vh, 100svh);
        min-height: var(--iori-stable-vh, 100svh);
        overflow-y: auto; /* 鍏佽绾靛悜婊氬姩 */
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch; /* iOS 鍘熺敓鎯€ф粴鍔?*/
        position: relative;
        z-index: 1;
      }
      body {
        background-color: transparent !important;
        overflow: hidden; /* 绂佹 body 婊氬姩锛屼氦鐢?#app-scroll 绠＄悊 */
        min-height: var(--iori-stable-vh, 100svh);
        position: relative;
      }
      #fixed-background {
        /* 浠呭蹇呰鐨勫睘鎬ц繘琛屽钩婊戣繃娓?*/
        transition: background-color 0.3s ease, filter 0.3s ease;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }
      /* 淇 iOS 涓?100vh 闂 (閽堝鑳屾櫙灞? */
      @supports (-webkit-touch-callout: none) {
        #app-scroll {
          height: var(--iori-stable-vh, 100svh);
          min-height: var(--iori-stable-vh, 100svh);
        }
      }
    </style>
  `;

  html = html.replace('</head>', `${globalScrollCss}</head>`);
  
  // 鏇挎崲 body 鏍囩缁撴瀯锛屽鍔?#app-scroll 婊氬姩瀹瑰櫒
  html = html.replace('<body class="bg-secondary-50 font-sans text-gray-800">', `<body class="bg-secondary-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 relative layout-unified ${isCustomWallpaper ? 'custom-wallpaper' : ''}">${bgLayerHtml}<div id="app-scroll">`);
  
  // 闂悎婊氬姩瀹瑰櫒锛堝湪 </main> 鍚庡叧闂紝浣?#backToTop 鍜屾ā鎬佹鑴辩 #app-scroll 鐨勫眰鍙犱笂涓嬫枃锛?  html = html.replace('</main>', '</main></div>');
  
  // Inject Card CSS Variables
  const cardRadius = parseInt(layoutCardBorderRadius) || 12;
  const cardScaleRaw = parseInt(String(layoutCardScale), 10);
  const cardScalePercent = Number.isFinite(cardScaleRaw) ? Math.max(70, Math.min(140, cardScaleRaw)) : 100;
  const cardScale = (cardScalePercent / 100).toFixed(2);
  const frostedBlurRaw = String(layoutFrostedGlassIntensity || '15').replace(/[^0-9]/g, '');
  const frostedBlur = frostedBlurRaw || '15';
  
  const cardCssVars = `<style>:root { --card-padding: 1.25rem; --card-radius: ${cardRadius}px; --card-scale: ${cardScale}; --frosted-glass-blur: ${frostedBlur}px; }</style>`;
  html = html.replace('</head>', `${cardCssVars}</head>`);

  // 鑷姩娉ㄥ叆瀛椾綋璧勬簮
  // ... (existing code omitted for brevity but I should match context)
  const usedFonts = new Set();
  
  // 鍙湁鍦ㄥ厓绱犳樉绀烘椂鎵嶆坊鍔犲搴旂殑瀛椾綋
  if (!layoutHideTitle && homeTitleFont) usedFonts.add(homeTitleFont);
  if (!layoutHideSubtitle && homeSubtitleFont) usedFonts.add(homeSubtitleFont);
  if (!homeHideStats && homeStatsFont) usedFonts.add(homeStatsFont);
  
  // 鍗＄墖瀛椾綋濮嬬粓娣诲姞锛屽洜涓哄畠浠槸鍗＄墖鐨勫熀鏈厓绱?  if (cardTitleFont) usedFonts.add(cardTitleFont);
  if (cardDescFont) usedFonts.add(cardDescFont);
  
  let fontLinksHtml = '';
  
  usedFonts.forEach(font => {
      if (font && FONT_MAP[font]) {
          fontLinksHtml += `<link rel="stylesheet" href="${FONT_MAP[font]}">`;
      }
  });
  
  // 鍏煎鏃х増鑷畾涔?URL
  const safeCustomFontUrl = sanitizeUrl(homeCustomFontUrl);
  if (safeCustomFontUrl) {
      fontLinksHtml += `<link rel="stylesheet" href="${safeCustomFontUrl}">`;
  }

  if (fontLinksHtml) {
      html = html.replace('</head>', `${fontLinksHtml}</head>`);
  }
  
  // Inject Custom Card Fonts CSS
  let customCardCss = '<style>';
  if (cardTitleFont || cardTitleSize || cardTitleColor) {
      const s = getStyleStr(cardTitleSize, cardTitleColor, cardTitleFont).replace('style="', '').replace('"', '');
      if (s) customCardCss += `.site-title { ${s} }`;
  }
  if (cardDescFont || cardDescSize || cardDescColor) {
      const s = getStyleStr(cardDescSize, cardDescColor, cardDescFont).replace('style="', '').replace('"', '');
      if (s) customCardCss += `.site-card p { ${s} }`;
  }
  if (cardWidth && cardWidth !== '100%') {
      customCardCss += `@media (min-width: 768px) { .site-card { width: ${cardWidth}; } }`;
  }
  customCardCss += '</style>';
  
  if (customCardCss !== '<style></style>') {
      html = html.replace('</head>', `${customCardCss}</head>`);
  }

  // Inject Global Data for Client-side JS
  const safeJson = JSON.stringify(allSites).replace(/</g, '\\u003c');
  const globalDataScript = `
    <script>
      window.IORI_SITES = ${safeJson};
    </script>
  `;
  html = html.replace('</head>', `${globalDataScript}</head>`);

  // Inject Layout Config for Client-side JS
  const layoutConfigScript = `
    <script>
      window.IORI_LAYOUT_CONFIG = {
        hideDesc: ${layoutHideDesc},
        hideLinks: ${layoutHideLinks},
        hideCategory: ${layoutHideCategory},
        gridCols: "${layoutGridCols}",
        cardStyle: "${layoutCardStyle}",
        cardWidth: "${cardWidth}",
        enableFrostedGlass: ${layoutEnableFrostedGlass},
        randomWallpaper: ${layoutRandomWallpaper},
        wallpaperSource: "${wallpaperSource}",
        wallpaperCid360: "${wallpaperCid360}",
        bingCountry: "${bingCountry}",
        searchEngine: "${homeSearchEngineProvider}",
        themeMode: "${homeThemeMode}",
        themeAutoDarkStart: ${homeThemeAutoDarkStart},
        themeAutoDarkEnd: ${homeThemeAutoDarkEnd}
      };
    </script>
  `;
  html = html.replace('</head>', `${layoutConfigScript}</head>`);

  html = html
    .replace('{{HEADER_CONTENT}}', headerContent)
    .replace('{{HEADER_CLASS}}', headerClass)
    .replace('{{CONTAINER_CLASS}}', containerClass)
    .replace('{{FOOTER_CLASS}}', footerClass)
    .replace('{{LEFT_TOP_ACTION}}', leftTopActionHtml)
    .replace('{{RIGHT_TOP_ACTION}}', topRightActionsHtml)
    .replace('{{THEME_MODE_DEFAULT}}', homeThemeMode)
    .replace('{{THEME_AUTO_DARK_START}}', homeThemeAutoDarkStart)
    .replace('{{THEME_AUTO_DARK_END}}', homeThemeAutoDarkEnd)
    .replace(/{{SITE_NAME}}/g, escapeHTML(siteName))
    .replace(/{{SITE_DESCRIPTION}}/g, escapeHTML(siteDescription))
    .replace('{{FOOTER_TEXT}}', escapeHTML(footerText))
    .replace('{{CATALOG_EXISTS}}', catalogExists ? 'true' : 'false')
    .replace('{{CATALOG_LINKS}}', catalogLinkMarkup)
    .replace('{{SUBMISSION_CLASS}}', submissionClass)
    .replace('{{DATALIST_OPTIONS}}', datalistOptions)
    .replace('{{TOTAL_SITES}}', sites.length)
    .replace('{{CATALOG_COUNT}}', categories.length)
    .replace('{{HEADING_TEXT}}', headingText)
    .replace('{{HEADING_DEFAULT}}', headingDefaultAttr)
    .replace('{{HEADING_ACTIVE}}', headingActiveAttr)
    .replace('{{STATS_VISIBLE}}', homeHideStats ? 'hidden' : '')
    .replace('{{STATS_STYLE}}', statsStyle)
    .replace('{{STATS_ROW_PY_CLASS}}', statsRowPyClass)
    .replace('{{STATS_ROW_MB_CLASS}}', statsRowMbClass)
    .replace('{{STATS_ROW_HIDDEN}}', statsRowHiddenClass)
    .replace('{{SITES_GRID}}', sitesGridMarkup)
    .replace('{{CURRENT_YEAR}}', new Date().getFullYear())
    .replace('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6', gridClass)
    .replace('{{SIDEBAR_CLASS}}', sidebarClass)
    .replace('{{MAIN_CLASS}}', mainClass)
    .replace('{{SIDEBAR_TOGGLE_CLASS}}', sidebarToggleClass);

  const response = new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });

  if (shouldClearCookie) {
      // Clear the stale cookie
      response.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0; SameSite=Lax');
  }

  // 鍐欏叆缂撳瓨 (鍙涓嶆槸绠＄悊鍛樺己鍒跺埛鏂版垨 Stale 鐘舵€侊紝閮藉簲璇ュ啓鍏ョ紦瀛橈紝鍖呮嫭闅忔満澹佺焊寮€鍚殑鎯呭喌)
  if (allowHomeCache) {
    const cacheKey = isAuthenticated ? cacheKeyPrivate : cacheKeyPublic;
    context.waitUntil(env.NAV_AUTH.put(cacheKey, html));
  }

  return response;
}

