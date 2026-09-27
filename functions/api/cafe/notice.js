const DEFAULT_CAFE_ID = "31114233";
const DEFAULT_MENU_ID = "6";
const CAFE_NOTICE_CACHE_TTL_MS = 10 * 60 * 1000;
const ARTICLE_LIST_URL = "https://apis.naver.com/cafe-web/cafe-boardlist-api/v1";

function cloneResponse(response, cacheState) {
  const cloned = new Response(response.body, response);
  if (cacheState) {
    cloned.headers.set("x-imz-cafe-notice-cache", cacheState);
  }
  return cloned;
}

function buildNoticeResponse(item, fetchedAt, cacheState) {
  return Response.json(
    {
      item,
      fetchedAt: new Date(fetchedAt).toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=86400",
        "x-imz-cafe-notice-fetched-at": String(fetchedAt),
        "x-imz-cafe-notice-cache": cacheState,
      },
    }
  );
}

function normalizeArticleItems(payload) {
  const articleList = Array.isArray(payload?.result?.articleList) ? payload.result.articleList : [];
  return articleList
    .map((entry) => entry?.item || null)
    .filter(Boolean);
}

function buildArticleUrl(cafeId, articleId) {
  return `https://cafe.naver.com/f-e/cafes/${encodeURIComponent(cafeId)}/articles/${encodeURIComponent(articleId)}`;
}

function pickTopVisibleArticle(articleItems, upArticleItems, cafeId) {
  const upArticleIds = new Set(
    upArticleItems
      .map((item) => Number(item?.articleId || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
  );

  const article = articleItems.find((item) => {
    const articleId = Number(item?.articleId || 0);
    if (!Number.isFinite(articleId) || articleId <= 0) {
      return false;
    }
    if (upArticleIds.has(articleId)) {
      return false;
    }
    if (!String(item?.subject || "").trim()) {
      return false;
    }
    if (item?.blindArticle || item?.delParent || item?.openArticle === false) {
      return false;
    }
    return true;
  });

  if (!article) {
    return null;
  }

  return {
    articleId: Number(article.articleId),
    title: String(article.subject || "").trim(),
    url: buildArticleUrl(cafeId, article.articleId),
  };
}

async function fetchCafeJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://cafe.naver.com/binssss",
      Accept: "application/json, text/plain, */*",
    },
  });
  if (!response.ok) {
    throw new Error("Cafe notice fetch failed");
  }
  return response.json();
}

export async function onRequestGet(context) {
  const cafeId = String(context.env?.NAVER_CAFE_ID || DEFAULT_CAFE_ID).trim() || DEFAULT_CAFE_ID;
  const menuId = String(context.env?.NAVER_CAFE_NOTICE_MENU_ID || DEFAULT_MENU_ID).trim() || DEFAULT_MENU_ID;
  const articleListUrl = `${ARTICLE_LIST_URL}/cafes/${encodeURIComponent(cafeId)}/menus/${encodeURIComponent(menuId)}/articles`;
  const upArticleUrl = `${ARTICLE_LIST_URL}/cafes/${encodeURIComponent(cafeId)}/uparticles/menus/${encodeURIComponent(menuId)}`;
  const cache = caches.default;
  const cacheKey = new Request(new URL(context.request.url).toString(), { method: "GET" });
  const cachedResponse = await cache.match(cacheKey);
  const cachedFetchedAt = Number(cachedResponse?.headers.get("x-imz-cafe-notice-fetched-at") || 0);
  const now = Date.now();

  if (cachedResponse && cachedFetchedAt && now - cachedFetchedAt < CAFE_NOTICE_CACHE_TTL_MS) {
    return cloneResponse(cachedResponse, "HIT");
  }

  try {
    const [articlesPayload, upArticlesPayload] = await Promise.all([
      fetchCafeJson(articleListUrl),
      fetchCafeJson(upArticleUrl),
    ]);
    const articleItems = normalizeArticleItems(articlesPayload);
    const upArticleItems = normalizeArticleItems(upArticlesPayload);
    const item = pickTopVisibleArticle(articleItems, upArticleItems, cafeId);

    if (!item) {
      if (cachedResponse) {
        return cloneResponse(cachedResponse, "STALE");
      }
      return Response.json({ error: "공지사항을 찾지 못했습니다." }, { status: 404 });
    }

    const payloadResponse = buildNoticeResponse(item, now, cachedResponse ? "REFRESH" : "MISS");
    context.waitUntil(cache.put(cacheKey, payloadResponse.clone()));
    return payloadResponse;
  } catch {
    if (cachedResponse) {
      return cloneResponse(cachedResponse, "STALE");
    }
    return Response.json({ error: "공지사항을 불러오지 못했습니다." }, { status: 502 });
  }
}
