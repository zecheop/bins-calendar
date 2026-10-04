const PROJECT_ID = "bins-calendar";
const COLLECTION = "calendar_overrides";
const CACHE_SECONDS = 30;

function kstToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const number = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: number("year"), month: number("month"), day: number("day") };
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function firestoreString(field) {
  return String(field?.stringValue || "");
}

function firestoreMonthDays(document) {
  const fields = document?.fields?.days?.mapValue?.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([day, value]) => {
    const dayFields = value?.mapValue?.fields || {};
    const entries = dayFields.entries?.arrayValue?.values || [];
    return [day, {
      timeLabel: firestoreString(dayFields.timeLabel),
      entries: entries.map((entry) => {
        const entryFields = entry?.mapValue?.fields || {};
        return {
          text: firestoreString(entryFields.text),
          categoryKey: firestoreString(entryFields.categoryKey),
        };
      }),
    }];
  }));
}

async function readFirestoreMonth(year, month) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${monthKey(year, month)}?mask.fieldPaths=days`;
  const response = await fetch(url);
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return firestoreMonthDays(await response.json());
}

async function readBase(context) {
  const url = new URL("/static/data/home-agenda-base.json", context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(url));
  if (!response.ok) throw new Error(`Agenda base read failed (${response.status})`);
  return response.json();
}

function mergedDays(base, key, overrides, legend) {
  const days = { ...(base.months?.[key] || {}), ...overrides };
  return Object.fromEntries(Object.entries(days).map(([rawDay, value]) => {
    const timeLabel = String(value?.timeLabel || "").trim().replace(/^휴방$/, "휴뱅");
    return [rawDay, {
      day: Number(rawDay),
      timeLabel,
      isOff: timeLabel === "휴뱅",
      entries: (value?.entries || []).map((entry) => {
        const category = legend[entry.categoryKey] || {};
        return {
          text: String(entry.text || "").trim(),
          categoryLabel: category.label || "",
          categoryColor: category.color || "",
        };
      }).filter((entry) => entry.text),
    }];
  }));
}

function firstScheduledDay(days, from, to) {
  for (let day = from; day <= to; day += 1) {
    const item = days[String(day)];
    if (item && !item.isOff && item.entries.length) return item;
  }
  return null;
}

function cacheResponse(response, state) {
  const copy = new Response(response.body, response);
  copy.headers.set("x-home-agenda-cache", state);
  return copy;
}

export async function onRequestGet(context) {
  const today = kstToday();
  const following = nextMonth(today.year, today.month);
  const cacheUrl = new URL(context.request.url);
  cacheUrl.searchParams.set("date", `${monthKey(today.year, today.month)}-${String(today.day).padStart(2, "0")}`);
  const cacheKey = new Request(cacheUrl.toString());
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cacheResponse(cached, "HIT");

  try {
    const [base, currentOverrides, nextOverrides] = await Promise.all([
      readBase(context),
      readFirestoreMonth(today.year, today.month),
      readFirestoreMonth(following.year, following.month),
    ]);
    const legend = base.legend || {};
    const currentDays = mergedDays(base, monthKey(today.year, today.month), currentOverrides, legend);
    const nextDays = mergedDays(base, monthKey(following.year, following.month), nextOverrides, legend);
    const todayDay = currentDays[String(today.day)] || { day: today.day, timeLabel: "", isOff: false, entries: [] };
    const currentLastDay = new Date(today.year, today.month, 0).getDate();
    const nextLastDay = new Date(following.year, following.month, 0).getDate();
    const nextCurrent = firstScheduledDay(currentDays, today.day + 1, currentLastDay);
    const nextFollowing = nextCurrent ? null : firstScheduledDay(nextDays, 1, nextLastDay);
    const next = nextCurrent
      ? { year: today.year, month: today.month, day: nextCurrent }
      : nextFollowing ? { ...following, day: nextFollowing } : null;
    const response = Response.json({
      date: `${monthKey(today.year, today.month)}-${String(today.day).padStart(2, "0")}`,
      today: { year: today.year, month: today.month, day: todayDay },
      next,
    }, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}, must-revalidate`, "x-home-agenda-cache": "MISS" },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return Response.json({ error: "홈 일정을 불러오지 못했습니다." }, { status: 502 });
  }
}
