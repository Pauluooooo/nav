/**
 * 搜索建议 API 端点
 * 代理第三方搜索引擎的建议接口（解决CORS问题）
 */

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('q');
  const engine = url.searchParams.get('engine') || 'baidu';

  // 参数验证
  if (!keyword || keyword.trim().length === 0) {
    return jsonResponse({ suggestions: [] });
  }

  try {
    let suggestions = [];

    switch (engine) {
      case 'baidu':
        suggestions = await fetchBaiduSuggestions(keyword);
        break;
      case 'google':
        suggestions = await fetchGoogleSuggestions(keyword);
        break;
      case 'bing':
        suggestions = await fetchBingSuggestions(keyword);
        break;
    }

    // 最多返回8个建议
    const limitedSuggestions = suggestions.slice(0, 8);

    return jsonResponse({
      suggestions: limitedSuggestions,
      engine: engine,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`[Search Suggestions] Error for engine ${engine}:`, error);
    return jsonResponse(
      {
        suggestions: [],
        error: error.message,
        engine: engine
      },
      500
    );
  }
}

/**
 * 获取百度搜索建议
 */
async function fetchBaiduSuggestions(keyword) {
  try {
    // 使用淘宝搜索建议 API 作为备选方案（更稳定）
    const response = await fetch(
      `https://suggestion.taobao.com/sug?q=${encodeURIComponent(keyword)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Taobao API returned ${response.status}`);
    }

    const data = await response.json();

    // 淘宝 API 返回: { "result": [[keyword, count], ...] }
    if (data.result && Array.isArray(data.result)) {
      return data.result.map(item => item[0]).filter(s => s && s.length > 0);
    }

    return [];
  } catch (error) {
    console.error('[Baidu Suggestions] Error:', error);
    return [];
  }
}

/**
 * 获取 Google 搜索建议
 */
async function fetchGoogleSuggestions(keyword) {
  try {
    // 优先尝试 DuckDuckGo API (开放且可靠)
    return await fetchDuckDuckGoSuggestions(keyword);
  } catch (error) {
    console.error('[Google Suggestions] Error:', error);
    return [];
  }
}

/**
 * 获取 DuckDuckGo 搜索建议 (作为 Google 的备选)
 */
async function fetchDuckDuckGoSuggestions(keyword) {
  try {
    const response = await fetch(
      `https://ac.duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    // DuckDuckGo API 返回 [{value: "...", type: "..."}]
    if (Array.isArray(data)) {
      return data
        .filter(item => item && item.phrase)
        .slice(0, 8)
        .map(item => item.phrase);
    }
    return [];
  } catch (error) {
    console.error('[DuckDuckGo Suggestions] Error:', error);
    return [];
  }
}

/**
 * 获取 Bing 搜索建议
 */
async function fetchBingSuggestions(keyword) {
  try {
    const response = await fetch(
      `https://www.bing.com/AS/Suggestions?py=0&cvid=&bc=8&dc=0&qry=${encodeURIComponent(keyword)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Bing API returned ${response.status}`);
    }

    const text = await response.text();

    // Bing 返回 JSONP 格式，需要提取 JSON
    try {
      const data = JSON.parse(text);
      if (
        data.AS &&
        data.AS.Results &&
        data.AS.Results[0] &&
        data.AS.Results[0].Suggests
      ) {
        return data.AS.Results[0].Suggests.map(s => s.Txt).filter(
          s => s && s.length > 0
        );
      }
    } catch (parseError) {
      console.warn('[Bing Suggestions] JSON parse failed:', parseError);
    }

    return [];
  } catch (error) {
    console.error('[Bing Suggestions] Error:', error);
    return [];
  }
}

/**
 * 返回 JSON 响应辅助函数
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  });
}

/**
 * 处理 CORS preflight 请求
 */
export async function onRequestOptions(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
