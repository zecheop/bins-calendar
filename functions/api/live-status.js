// 빈스는 치지직이 아니라 SOOP에서 방송하므로 CHZZK_CHANNEL_ID를 비워둠(라이브 상태는 항상 fallback으로 처리됨).
const DEFAULT_CHANNEL_ID = "";
// TODO: 빈스 캘린더용 Firebase 프로젝트를 새로 만든 뒤 그 프로젝트 ID로 교체
const DEFAULT_PROJECT_ID = "";
const DEFAULT_CALENDAR_COLLECTION = "calendar_overrides";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const DEFAULT_PROFILE = {
  channelName: "빈스",
  bio: "알다가도 모를 까마귀",
};

function parseKstDateTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const normalized = text.replace(" ", "T");
  return `${normalized}+09:00`;
}

function fallbackPayload(channelId, message) {
  return {
    channelId,
    channelName: DEFAULT_PROFILE.channelName,
    channelUrl: `https://chzzk.naver.com/${channelId}`,
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

export async function onRequestGet(context) {
  const channelId = String(context.env?.CHZZK_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim() || DEFAULT_CHANNEL_ID;
  const baseUrl = "https://api.chzzk.naver.com";
  const requestUrl = new URL(context.request.url);
  const debugAutoSync = requestUrl.searchParams.get("debugAutoSync") === "1";
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json",
  };

  try {
    const [channelResponse, liveResponse] = await Promise.all([
      fetch(`${baseUrl}/service/v1/channels/${channelId}`, { headers }),
      fetch(`${baseUrl}/service/v2/channels/${channelId}/live-detail`, { headers }),
    ]);

    if (!channelResponse.ok || !liveResponse.ok) {
      return Response.json(fallbackPayload(channelId, "치지직 상태를 잠시 확인하지 못했습니다."));
    }

    const channelPayload = (await channelResponse.json()).content || {};
    const livePayload = (await liveResponse.json()).content || {};
    const responsePayload = {
      channelId,
      channelName:
        String(channelPayload.channelName || "").trim() ||
        String(livePayload.channel?.channelName || "").trim() ||
        DEFAULT_PROFILE.channelName,
      channelUrl: `https://chzzk.naver.com/${channelId}`,
      avatarUrl:
        String(channelPayload.channelImageUrl || "").trim() ||
        String(livePayload.channel?.channelImageUrl || "").trim(),
      bio: String(channelPayload.channelDescription || "").trim() || DEFAULT_PROFILE.bio,
      followerCount: Number(channelPayload.followerCount || 0) || 0,
      isLive: Boolean(channelPayload.openLive),
      liveTitle: String(livePayload.liveTitle || "").trim(),
      startAt: parseKstDateTime(livePayload.openDate),
      closeAt: parseKstDateTime(livePayload.closeDate),
      lastStartAt: parseKstDateTime(livePayload.openDate),
      lastCloseAt: parseKstDateTime(livePayload.closeDate),
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
    return Response.json(fallbackPayload(channelId, "치지직 상태를 잠시 확인하지 못했습니다."));
  }
}
