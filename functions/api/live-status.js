const DEFAULT_BJID = "psb010203";
const DEFAULT_STATION_URL = "https://www.sooplive.com/station/psb010203";
const SOOP_LIVE_API_URL = "https://live.afreecatv.com/afreeca/player_live_api.php";
// TODO: 빈스 캘린더용 Firebase 프로젝트를 새로 만든 뒤 그 프로젝트 ID로 교체
const DEFAULT_PROJECT_ID = "";
const DEFAULT_CALENDAR_COLLECTION = "calendar_overrides";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const DEFAULT_PROFILE = {
  channelName: "빈스",
  bio: "알다가도 모를 까마귀",
};

function fallbackPayload(channelId, message) {
  return {
    channelId,
    channelName: DEFAULT_PROFILE.channelName,
    channelUrl: DEFAULT_STATION_URL,
    avatarUrl: "",
    bio: DEFAULT_PROFILE.bio,
    followerCount: 0,
    isLive: false,
    liveTitle: "",
    startAt: "",
    closeAt: "",
    lastStartAt: "",
    lastCloseAt: "",
    available: false,
    stale: false,
    message,
  };
}

function encodeBase64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizePrivateKey(rawPrivateKey) {
  let normalized = String(rawPrivateKey || "").trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\\n/g, "\n").trim();
}

function pemToArrayBuffer(rawPem) {
  const normalizedPem = normalizePrivateKey(rawPem);
  const base64 = normalizedPem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function createAccessToken(serviceAccountEmail, privateKey) {
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: serviceAccountEmail,
      scope: FIRESTORE_SCOPE,
      aud: GOOGLE_TOKEN_AUDIENCE,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );
  const unsignedJwt = `${header}.${payload}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );
  const assertion = `${unsignedJwt}.${encodeBase64Url(new Uint8Array(signature))}`;
  const response = await fetch(GOOGLE_TOKEN_AUDIENCE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google access token fetch failed: ${detail || response.status}`);
  }

  const payloadJson = await response.json();
  return String(payloadJson.access_token || "").trim();
}

function extractStringField(field) {
  return String(field?.stringValue || "").trim();
}

function extractDayFields(documentPayload, day) {
  return (
    documentPayload?.fields?.days?.mapValue?.fields?.[String(day)]?.mapValue?.fields ||
    null
  );
}

function hasExistingTimeOverride(dayFields) {
  if (!dayFields) {
    return false;
  }
  const timeLabel = extractStringField(dayFields.timeLabel);
  const timeSource = extractStringField(dayFields.timeSource);
  const autoLiveAt = extractStringField(dayFields.autoLiveAt);
  return Boolean(timeLabel || autoLiveAt || (timeSource && timeSource !== "manual"));
}

function getKstParts(isoText) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = formatter.formatToParts(new Date(isoText));
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(pick("year") || 0),
    month: Number(pick("month") || 0),
    day: Number(pick("day") || 0),
    hour: Number(pick("hour") || 0),
    minute: Number(pick("minute") || 0),
    dayPeriod: pick("dayPeriod").toUpperCase().startsWith("A") ? "AM" : "PM",
  };
}

function buildTimeLabelFromStartAt(startAt) {
  const kst = getKstParts(startAt);
  if (!kst.year || !kst.month || !kst.day || !kst.hour) {
    return "";
  }
  const minuteSuffix = kst.minute ? `:${String(kst.minute).padStart(2, "0")}` : "";
  return `뱅온 [${kst.hour}${minuteSuffix}${kst.dayPeriod}]`;
}

function fieldPathForDay(day, fieldName) {
  return `days.\`${String(day)}\`.${fieldName}`;
}

function firestoreDocumentUrl(projectId, collectionName, documentId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${documentId}`;
}

async function readStaticMonthDay(context, year, month, day) {
  if (!context.env?.ASSETS || typeof context.env.ASSETS.fetch !== "function") {
    return null;
  }
  const assetUrl = new URL("/static/data/site-data.json", context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(assetUrl.toString()));
  if (!response.ok) {
    return null;
  }
  const siteData = await response.json();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthPayload = siteData?.monthsByKey?.[monthKey];
  if (!Array.isArray(monthPayload?.days)) {
    return null;
  }
  return monthPayload.days.find((item) => Number(item?.day) === Number(day)) || null;
}

async function readFirestoreDocument(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore document read failed: ${detail || response.status}`);
  }
  return response.json();
}

async function patchFirestoreDocument(url, accessToken, body, updateMaskFields) {
  const query = new URLSearchParams();
  updateMaskFields.forEach((fieldPath) => {
    query.append("updateMask.fieldPaths", fieldPath);
  });
  const response = await fetch(`${url}?${query.toString()}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore document patch failed: ${detail || response.status}`);
  }
  return response.json();
}

async function syncAutoLiveStatus(context, livePayload) {
  if (!livePayload?.isLive || !livePayload?.startAt) {
    return { enabled: false, synced: false, reason: "not-live" };
  }

  const serviceAccountEmail = String(context.env?.FIREBASE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(context.env?.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  if (!serviceAccountEmail || !privateKey) {
    return { enabled: false, synced: false, reason: "missing-service-account" };
  }

  const projectId = String(context.env?.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID).trim() || DEFAULT_PROJECT_ID;
  const collectionName =
    String(context.env?.FIRESTORE_CALENDAR_COLLECTION || DEFAULT_CALENDAR_COLLECTION).trim() ||
    DEFAULT_CALENDAR_COLLECTION;
  const label = buildTimeLabelFromStartAt(livePayload.startAt);
  if (!label) {
    return { enabled: true, synced: false, reason: "invalid-start-at" };
  }

  const { year, month, day } = getKstParts(livePayload.startAt);
  if (!year || !month || !day) {
    return { enabled: true, synced: false, reason: "invalid-kst-date" };
  }

  const staticDay = await readStaticMonthDay(context, year, month, day);
  if (String(staticDay?.timeLabel || "").trim() || staticDay?.isOff) {
    return { enabled: true, synced: false, reason: "seed-has-time" };
  }

  const documentId = `${year}-${String(month).padStart(2, "0")}`;
  const documentUrl = firestoreDocumentUrl(projectId, collectionName, documentId);
  const accessToken = await createAccessToken(serviceAccountEmail, privateKey);
  const existingDocument = await readFirestoreDocument(documentUrl, accessToken);
  const dayFields = extractDayFields(existingDocument, day);
  if (hasExistingTimeOverride(dayFields)) {
    return { enabled: true, synced: false, reason: "already-recorded" };
  }

  const updatedAt = new Date().toISOString();
  const payload = {
    fields: {
      year: { integerValue: String(year) },
      month: { integerValue: String(month) },
      updatedAt: { stringValue: updatedAt },
      days: {
        mapValue: {
          fields: {
            [String(day)]: {
              mapValue: {
                fields: {
                  timeLabel: { stringValue: label },
                  timeSource: { stringValue: "auto" },
                  autoLiveAt: { stringValue: livePayload.startAt },
                  updatedAt: { stringValue: updatedAt },
                },
              },
            },
          },
        },
      },
    },
  };
  const updateMaskFields = [
    "year",
    "month",
    "updatedAt",
    fieldPathForDay(day, "timeLabel"),
    fieldPathForDay(day, "timeSource"),
    fieldPathForDay(day, "autoLiveAt"),
    fieldPathForDay(day, "updatedAt"),
  ];
  await patchFirestoreDocument(documentUrl, accessToken, payload, updateMaskFields);
  return {
    enabled: true,
    synced: true,
    year,
    month,
    day,
    label,
  };
}

// SOOP(구 아프리카TV)의 비공식 플레이어 API 호출. BTIME은 절대시각이 아니라
// "방송 시작 후 경과 초"라서, 시작 시각은 지금 시각에서 그만큼 빼서 계산한다.
// (static/game/soop-chat.js 상단 주석에 이 API의 검증 경위를 적어뒀다.)
export async function onRequestGet(context) {
  const bjid = String(context.env?.SOOP_BJID || DEFAULT_BJID).trim() || DEFAULT_BJID;
  const requestUrl = new URL(context.request.url);
  const debugAutoSync = requestUrl.searchParams.get("debugAutoSync") === "1";

  try {
    const body = new URLSearchParams({
      bid: bjid,
      bno: "",
      type: "live",
      confirm_adult: "false",
      player_type: "html5",
      mode: "landing",
      from_api: "0",
      pwd: "",
      stream_type: "common",
      quality: "HD",
    });
    const liveResponse = await fetch(`${SOOP_LIVE_API_URL}?bjid=${encodeURIComponent(bjid)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: body.toString(),
    });

    if (!liveResponse.ok) {
      return Response.json(fallbackPayload(bjid, "방송 상태를 잠시 확인하지 못했습니다."));
    }

    const channelPayload = (await liveResponse.json())?.CHANNEL || {};
    const isLive = Number(channelPayload.RESULT || 0) === 1;
    let startAt = "";
    if (isLive) {
      const elapsedSeconds = Number(channelPayload.BTIME || 0) || 0;
      startAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();
    }

    const responsePayload = {
      channelId: bjid,
      channelName: String(channelPayload.BJNICK || "").trim() || DEFAULT_PROFILE.channelName,
      channelUrl: DEFAULT_STATION_URL,
      avatarUrl: "",
      bio: DEFAULT_PROFILE.bio,
      followerCount: 0,
      isLive,
      liveTitle: String(channelPayload.TITLE || "").trim(),
      startAt,
      closeAt: "",
      lastStartAt: startAt,
      lastCloseAt: "",
      available: true,
      stale: false,
      message: "",
    };

    try {
      responsePayload.autoSync = await syncAutoLiveStatus(context, responsePayload);
    } catch (error) {
      responsePayload.autoSync = {
        enabled: true,
        synced: false,
        reason: "sync-failed",
      };
      if (debugAutoSync) {
        responsePayload.autoSync.detail = String(error?.message || error || "Unknown error");
      }
    }

    return Response.json(responsePayload);
  } catch {
    return Response.json(fallbackPayload(bjid, "방송 상태를 잠시 확인하지 못했습니다."));
  }
}
