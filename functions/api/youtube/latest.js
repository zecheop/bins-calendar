const DEFAULT_CHANNEL_ID = "UCXoZBh4NsEHDDzpkqCHGGdA";
const YOUTUBE_CACHE_TTL_DEFAULT_MS = 4 * 60 * 60 * 1000;
const YOUTUBE_CACHE_TTL_PREMIERE_MS = 5 * 60 * 1000;
const YOUTUBE_CACHE_TTL_EVENING_MS = 15 * 60 * 1000;
const YOUTUBE_CACHE_VERSION = "2026-08-01-2";

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractEntries(xml) {
  return [...String(xml || "").matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]).slice(0, 3);
}

function extractValue(block, pattern) {
  const match = block.match(pattern);
  return decodeXml(match?.[1] || "");
}

function cloneResponse(response, cacheState) {
  const cloned = new Response(response.body, response);
  if (cacheState) {
    cloned.headers.set("x-imz-youtube-cache", cacheState);
  }
  return cloned;
}

function nowKstParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type)?.value || "00";
  return {
    hour: Number(pick("hour")) || 0,
    minute: Number(pick("minute")) || 0,
  };
}

function youtubeRefreshIntervalMs() {
  const { hour, minute } = nowKstParts();
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes >= 17 * 60 + 30 && totalMinutes < 18 * 60 + 30) {
    return YOUTUBE_CACHE_TTL_PREMIERE_MS;
  }
  if (totalMinutes >= 18 * 60 + 30 && totalMinutes < 21 * 60) {
    return YOUTUBE_CACHE_TTL_EVENING_MS;
  }
  return YOUTUBE_CACHE_TTL_DEFAULT_MS;
}

function buildYoutubeResponse(items, fetchedAt, cacheState, ttlMs) {
  return Response.json(
    {
      items,
      fetchedAt: new Date(fetchedAt).toISOString(),
      nextPollMs: ttlMs,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "x-imz-youtube-fetched-at": String(fetchedAt),
        "x-imz-youtube-cache": cacheState,
      },
    }
  );
}

export async function onRequestGet(context) {
  const channelId = String(context.env?.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim() || DEFAULT_CHANNEL_ID;
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const cache = caches.default;
  const ttlMs = youtubeRefreshIntervalMs();
  const cacheUrl = new URL(context.request.url);
  cacheUrl.searchParams.set("cacheVersion", YOUTUBE_CACHE_VERSION);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cachedResponse = await cache.match(cacheKey);
  const cachedFetchedAt = Number(cachedResponse?.headers.get("x-imz-youtube-fetched-at") || 0);
  const now = Date.now();

  if (cachedResponse && cachedFetchedAt && now - cachedFetchedAt < ttlMs) {
    return cloneResponse(cachedResponse, "HIT");
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!response.ok) {
      return Response.json({ error: "유튜브 피드를 읽지 못했습니다." }, { status: 502 });
    }

    const xml = await response.text();
    const items = extractEntries(xml).map((entry) => {
      const videoId = extractValue(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
      const url = extractValue(entry, /<link[^>]+href="([^"]+)"/);
      const title = extractValue(entry, /<title>([\s\S]*?)<\/title>/);
      const publishedAt = extractValue(entry, /<published>([^<]+)<\/published>/);
      const thumbnailUrl = extractValue(entry, /<media:thumbnail[^>]+url="([^"]+)"/);
      return {
        videoId,
        title,
        url: url || `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt,
        thumbnailUrl,
        isShort: url.includes("/shorts/") || title.toLowerCase().includes("#shorts"),
      };
    }).filter((item) => item.url && item.title);

    if (!items.length && cachedResponse) {
      return cloneResponse(cachedResponse, "STALE");
    }

    const payloadResponse = buildYoutubeResponse(items, now, cachedResponse ? "REFRESH" : "MISS", ttlMs);
    context.waitUntil(cache.put(cacheKey, payloadResponse.clone()));
    return payloadResponse;
  } catch {
    if (cachedResponse) {
      return cloneResponse(cachedResponse, "STALE");
    }
    return Response.json({ error: "유튜브 피드를 읽지 못했습니다." }, { status: 502 });
  }
}
