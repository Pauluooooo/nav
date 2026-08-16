const CACHE_SECONDS = 60 * 60 * 24 * 30;

function normalizeHostname(raw) {
  const value = String(raw || '').trim();
  if (!value || value.length > 2048) return null;

  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(candidate);
    const hostname = parsed.host.toLowerCase();
    if (!hostname || hostname.length > 253) return null;
    return hostname;
  } catch {
    return null;
  }
}

function cacheKeyFor(request, hostname) {
  const key = new URL(request.url);
  key.search = '';
  key.searchParams.set('url', hostname);
  return key.toString();
}

function imageResponse(response) {
  const contentType = response.headers.get('content-type') || 'image/png';
  return new Response(response.body, {
    headers: {
      'Content-Type': contentType,
      // The URL is keyed by hostname. Icons rarely change, and a new cache entry can
      // always be requested by adding a query version if an immediate refresh is needed.
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
      'Cross-Origin-Resource-Policy': 'same-origin'
    }
  });
}

async function fetchIcon(hostname) {
  const endpoints = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`,
    // Preserve the existing provider as a fallback, especially for private IP/port bookmarks.
    `https://faviconsnap.com/api/favicon?url=${encodeURIComponent(hostname)}`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlusNetNavIconCache/1.0)' }
      });
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.toLowerCase().startsWith('image/')) return response;
    } catch (error) {
      console.warn('Icon upstream failed:', new URL(endpoint).hostname, error?.message || error);
    }
  }
  return null;
}

export async function onRequestGet(context) {
  const { request } = context;
  const hostname = normalizeHostname(new URL(request.url).searchParams.get('url'));
  if (!hostname) return new Response('Invalid icon URL', { status: 400 });

  const cacheKey = cacheKeyFor(request, hostname);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetchIcon(hostname);
  if (!upstream) {
    return new Response('Icon not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  }

  const response = imageResponse(upstream);
  const cacheWrite = caches.default.put(cacheKey, response.clone());
  if (typeof context.waitUntil === 'function') context.waitUntil(cacheWrite);
  else await cacheWrite;
  return response;
}
