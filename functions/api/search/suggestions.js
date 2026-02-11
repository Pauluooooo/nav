const ALLOWED_ENGINES = new Set(['baidu', 'google', 'bing']);
const MAX_SUGGESTIONS = 8;

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get('q') || '').trim();
  const requestedEngine = (url.searchParams.get('engine') || 'baidu').toLowerCase();
  const engine = ALLOWED_ENGINES.has(requestedEngine) ? requestedEngine : 'baidu';

  if (!keyword) {
    return jsonResponse({
      suggestions: [],
      engine,
      timestamp: Date.now()
    });
  }

  try {
    let suggestions = [];

    if (engine === 'baidu') {
      suggestions = await fetchBaiduSuggestions(keyword);
    } else if (engine === 'google') {
      suggestions = await fetchGoogleSuggestions(keyword);
    } else if (engine === 'bing') {
      suggestions = await fetchBingSuggestions(keyword);
    }

    return jsonResponse({
      suggestions: uniqueSuggestions(suggestions).slice(0, MAX_SUGGESTIONS),
      engine,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`[Search Suggestions] Failed for ${engine}:`, error);
    return jsonResponse({
      suggestions: [],
      engine,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

async function fetchBaiduSuggestions(keyword) {
  const data = await fetchJson(
    `https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(keyword)}`
  );

  if (!data || !Array.isArray(data.g)) {
    return [];
  }

  return data.g
    .map((item) => item?.q)
    .filter((item) => typeof item === 'string' && item.trim());
}

async function fetchGoogleSuggestions(keyword) {
  const data = await fetchJson(
    `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}`
  );

  if (Array.isArray(data) && Array.isArray(data[1])) {
    return data[1].filter((item) => typeof item === 'string' && item.trim());
  }

  return [];
}

async function fetchBingSuggestions(keyword) {
  const data = await fetchJson(
    `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(keyword)}`
  );

  if (Array.isArray(data) && Array.isArray(data[1])) {
    return data[1].filter((item) => typeof item === 'string' && item.trim());
  }

  return [];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`Upstream API error: ${response.status}`);
  }

  return response.json();
}

function uniqueSuggestions(suggestions) {
  const seen = new Set();
  const result = [];

  for (const item of suggestions) {
    const value = String(item || '').trim();
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
