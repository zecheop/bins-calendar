const DEFAULT_AVATAR = "/static/assets/vince-profile.webp";
const DEFAULT_THUMBNAIL = "/static/assets/vince-profile.webp";
// TODO: 히어로 배경 영상이 생기면 여기에 /videos/*.mp4 경로를 추가
const HERO_VIDEOS = [];
const HERO_VIDEO_PLAYBACK_RATE = 2 / 3;
const HERO_VIDEO_DEFAULT_PLAYBACK_RATE = 1;
// TODO: 히어로 배경 이미지가 생기면 여기에 추가
const LOCAL_HERO_BACKGROUNDS = [];
// TODO: 빈스 커뮤니티에서 실제로 쓰는 노래 태그(밈/기념일 등)로 채워 넣기
const DEFAULT_SONG_TAGS = ["오리지널", "커버", "유튜브"];
const SONG_TAG_META = {
  "유튜브": { icon: "▶️", className: "youtube" },
};
const THEME_STORAGE_KEY = "vince-calendar-theme";
const CATEGORY_FALLBACKS = {
  warmup: "#fff9c4",
  main: "#cdfcf5",
  afterglow: "#fce5cd",
  gap_collab: "#ffd1da",
  ad: "#dcc8f0",
  plus: "#a8e6cf",
};
const MAX_POSTIT_ITEMS = 10;
const MAX_COUNTDOWN_ITEMS = 5;
const MAX_EDITOR_SLOTS = 5;
const MAX_DAY_IMAGE_WIDTH = 640;
const MAX_DAY_IMAGE_HEIGHT = 640;
const MAX_DAY_IMAGE_DATA_URL_LENGTH = 320000;
const SITE_DATA_URL = "/static/data/site-data.json";
const YOUTUBE_API_URL = "/api/youtube/latest?v=2026-08-01-2";
const YOUTUBE_CACHE_STORAGE_KEY = "vince-calendar-youtube-cache";
const HOME_MONTH_CACHE_PREFIX = "vince-calendar-home-month-v1-";
const HOME_MONTH_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CALENDAR_SEARCH_RESULT_LIMIT = 240;
const LOCAL_PREVIEW_API_ORIGIN = "http://localhost:8026";
const DEFAULT_ADMIN_EMAILS = ["wjddndj2@gmail.com"];
const VERSION_HISTORY_LIMIT = 18;
const VERSION_HISTORY_SUBCOLLECTION = "versions";
const DEFAULT_LINKS = {
  youtubeChannelUrl: "https://www.youtube.com/channel/UCXoZBh4NsEHDDzpkqCHGGdA",
  chzzkChannelUrl: "https://www.sooplive.com/station/psb010203",
  cafeUrl: "https://cafe.naver.com/binssss",
};

const firebaseState = {
  enabled: false,
  ready: false,
  auth: null,
  db: null,
  editorAccessUnsubscribe: null,
  currentMonthUnsubscribe: null,
  postitUnsubscribe: null,
  songbookUnsubscribe: null,
};

const state = {
  bootstrap: null,
  monthsByYear: new Map(),
  sortedMonths: [],
  selectedYear: 0,
  selectedMonth: 0,
  viewerOpen: false,
  songbookOpen: false,
  homeMonthData: null,
  homeNextMonthData: null,
  homeMonthPending: true,
  homeNextMonthPending: true,
  homeAgendaPreview: null,
  homeIntroFinished: false,
  gameOpen: false,
  memoryTodayDate: null,
  visitToday: null,
  visitTotal: null,
  mobileFullMonthView: false,
  currentMonthData: null,
  monthRequestId: 0,
  liveStatus: null,
  cafeNotice: null,
  calendarSearchMonthCache: new Map(),
  calendarSearchResults: [],
  calendarSearchHighlightKey: "",
  calendarSearchHighlightTimer: 0,
  calendarSearchStatus: "",
  calendarSearchQuery: "",
  calendarSearchCategory: "",
  calendarSearchStart: "",
  calendarSearchEnd: "",
  calendarSearchInFlight: false,
  monthLoading: false,
  youtubeItems: [],
  postitItems: [],
  countdownItems: [],
  postitUpdatedAt: "",
  postitStatusMessage: "",
  versionHistoryItems: [],
  versionHistoryStatus: "",
  versionHistoryLoading: false,
  versionHistoryRestoringId: "",
  versionHistoryDeletingId: "",
  versionHistoryPreviewId: "",
  songbookItems: [],
  songbookCategories: [],
  songbookArtists: [],
  songbookTags: [],
  selectedSongQuery: "",
  selectedSongArtistQuery: "",
  selectedSongCategoryQuery: "",
  selectedSongTagQuery: "",
  selectedSongTags: [],
  songbookPage: 1,
  editingSongId: "",
  randomSongResults: [],
  revealedSongActionId: "",
  revealedSongActionDirection: "",
  songTagFilterExpanded: false,
  songUndo: null,
  songUndoTimer: 0,
  selectedDay: null,
  mobileSelectedDate: null,
  editorDraft: { statusMode: "none", timePeriod: "PM", timeHour: "", timeMinute: "", dayNoteText: "", customImageDataUrl: "", entries: [] },
  editorDragIndex: -1,
  editorSaveTimer: 0,
  editorDirty: false,
  editorSaving: false,
  editorQueued: false,
  noteRegistry: new Map(),
  noteCounter: 0,
  renderedSongs: [],
  heroVideos: [],
  heroVideoCycle: [],
  heroMode: "fallback",
  currentHeroVideo: "",
  nextHeroVideo: "",
  activeHeroBuffer: "primary",
  authStatusMessage: "",
  authStatusTimer: 0,
  authStatusHideTimer: 0,
  pendingPermissionNotice: false,
  postitSaveTimer: 0,
  postitSyncKey: "",
  firebaseConfigured: false,
  livePollTimer: 0,
  cafeNoticePollTimer: 0,
  youtubePollTimer: 0,
  liveFetchInFlight: false,
  cafeNoticeFetchInFlight: false,
  youtubeFetchInFlight: false,
};

const bodyEl = document.body;
const themeToggleEl = document.getElementById("theme-toggle");
const authStatusEl = document.getElementById("auth-status");
const googleSigninEl = document.getElementById("google-signin");
const logoutButtonEl = document.getElementById("logout-button");
const heroVideoEl = document.getElementById("hero-video");
const heroVideoBufferEl = document.getElementById("hero-video-buffer");
const heroImageEl = document.getElementById("hero-image");
const heroSectionEl = document.getElementById("hero");
const homeAgendaEl = document.getElementById("home-agenda");
const homeAgendaLabelEl = document.getElementById("home-agenda-label");
const homeAgendaLiveMarkEl = document.getElementById("home-agenda-live-mark");
const homeAgendaDateEl = document.getElementById("home-agenda-date");
const homeAgendaNoteEl = document.getElementById("home-agenda-note");
const homeAgendaListEl = document.getElementById("home-agenda-list");
const homeAgendaTimeEl = document.getElementById("home-agenda-time");
const brandHomeEl = document.getElementById("brand-home");
const sideNavEl = document.getElementById("side-nav");
const sideNavItemEls = sideNavEl ? Array.from(sideNavEl.querySelectorAll(".side-nav-item")) : [];
const openCurrentMonthEl = document.getElementById("open-current-month");
const openSongbookHeroEl = document.getElementById("open-songbook-hero");
const visitCounterEl = document.getElementById("visit-counter");
const viewerShellEl = document.getElementById("viewer-shell");
const songbookShellEl = document.getElementById("songbook-shell");
const gameShellEl = document.getElementById("game-shell");
const memoryTodayDateEl = document.getElementById("memory-today-date");
const memoryTodayResultEl = document.getElementById("memory-today-result");
const yearPrevEl = document.getElementById("year-prev");
const yearNextEl = document.getElementById("year-next");
const yearTitleEl = document.getElementById("year-title");
const monthPrevEl = document.getElementById("month-prev");
const monthNextEl = document.getElementById("month-next");
const profileAvatarMiniEl = document.getElementById("profile-avatar-mini");
const profileNameEl = document.getElementById("profile-name");
const profileBioEl = document.getElementById("profile-bio");
const chzzkLinkEl = document.getElementById("chzzk-link");
const youtubeLinkEl = document.getElementById("youtube-link");
const cafeLinkEl = document.getElementById("cafe-link");
const livePillEl = document.getElementById("live-pill");
const liveSummaryEl = document.getElementById("live-summary");
const monthTitleEl = document.getElementById("month-title");
const cafeNoticeLinkEl = document.getElementById("cafe-notice-link");
const versionHistoryTriggerEl = document.getElementById("version-history-trigger");
const calendarSearchTriggerEl = document.getElementById("calendar-search-trigger");
const calendarGridEl = document.getElementById("calendar-grid");
const mobileDayViewEl = document.getElementById("mobile-day-view");
const mobileViewToggleEl = document.getElementById("mobile-view-toggle");
const mobileMonthViewEl = document.getElementById("mobile-month-view");
const legendEl = document.getElementById("legend");
const youtubeCardsEl = document.getElementById("youtube-cards");
const postitItemsEl = document.getElementById("postit-items");
const countdownItemsEl = document.getElementById("countdown-items");
const songResultsEl = document.getElementById("song-results");
const songPaginationEl = document.getElementById("song-pagination");
const songbookBoardEl = document.querySelector(".songbook-board");
const songbookEditorEl = document.getElementById("songbook-editor");
const songTitleInputEl = document.getElementById("song-title-input");
const songOriginalTitleInputEl = document.getElementById("song-original-title-input");
const songArtistInputEl = document.getElementById("song-artist-input");
const songTagInputEl = document.getElementById("song-tag-input");
const songCategoryInputEl = document.getElementById("song-category-input");
const songTagSuggestionsEl = document.getElementById("song-tag-suggestions");
const songAddButtonEl = document.getElementById("song-add-button");
const songEditorStatusEl = document.getElementById("song-editor-status");
const songUndoBarEl = document.getElementById("song-undo-bar");
const songUndoTextEl = document.getElementById("song-undo-text");
const songUndoButtonEl = document.getElementById("song-undo-button");
const songUndoCloseEl = document.getElementById("song-undo-close");
const songTagFilterBarEl = document.getElementById("song-tag-filter-bar");
const songSearchResetButtonEl = document.getElementById("song-search-reset");
const songSearchButtonEl = document.getElementById("song-search");
const songRandomButtonEl = document.getElementById("song-random");
const songSearchModalEl = document.getElementById("song-search-modal");
const songSearchFormEl = document.getElementById("song-search-form");
const songSearchTitleEl = document.getElementById("song-search-title");
const songSearchArtistEl = document.getElementById("song-search-artist");
const songSearchCategoryEl = document.getElementById("song-search-category");
const songSearchTagEl = document.getElementById("song-search-tag");
const calendarSearchModalEl = document.getElementById("calendar-search-modal");
const calendarSearchFormEl = document.getElementById("calendar-search-form");
const calendarSearchQueryEl = document.getElementById("calendar-search-query");
const calendarSearchCategoryEl = document.getElementById("calendar-search-category");
const calendarSearchStartEl = document.getElementById("calendar-search-start");
const calendarSearchEndEl = document.getElementById("calendar-search-end");
const calendarSearchResetEl = document.getElementById("calendar-search-reset");
const calendarSearchCloseEl = document.getElementById("calendar-search-close");
const calendarSearchStatusEl = document.getElementById("calendar-search-status");
const calendarSearchResultsEl = document.getElementById("calendar-search-results");
const versionHistoryModalEl = document.getElementById("version-history-modal");
const versionHistoryTitleEl = document.getElementById("version-history-title");
const versionHistoryStatusEl = document.getElementById("version-history-status");
const versionHistoryListEl = document.getElementById("version-history-list");
const versionHistoryCloseEl = document.getElementById("version-history-close");
const songRandomModalEl = document.getElementById("song-random-modal");
const songRandomFormEl = document.getElementById("song-random-form");
const songRandomCategoryEl = document.getElementById("song-random-category");
const songRandomCountEl = document.getElementById("song-random-count");
const songRandomResultsEl = document.getElementById("song-random-results");
const editorModalEl = document.getElementById("editor-modal");
const editorTitleEl = document.getElementById("editor-title");
const editorCloseButtonEl = document.getElementById("editor-close");
const editorCloseWarningModalEl = document.getElementById("editor-close-warning-modal");
const editorCloseWarningCancelEl = document.getElementById("editor-close-warning-cancel");
const editorCloseWarningDiscardEl = document.getElementById("editor-close-warning-discard");
const editorFormEl = document.getElementById("editor-form");
const editorStatusModeEl = document.getElementById("editor-status-mode");
const editorTimeFieldEl = document.getElementById("editor-time-field");
const editorTimePeriodEl = document.getElementById("editor-time-period");
const editorTimeHourEl = document.getElementById("editor-time-hour");
const editorTimeMinuteEl = document.getElementById("editor-time-minute");
const editorDayNoteEl = document.getElementById("editor-day-note");
const editorDayImageInputEl = document.getElementById("editor-day-image-input");
const editorDayImagePreviewEl = document.getElementById("editor-day-image-preview");
const editorDayImageRemoveEl = document.getElementById("editor-day-image-remove");
const slotListEl = document.getElementById("slot-list");
const saveStatusEl = document.getElementById("save-status");
const privacyPolicyTriggerEl = document.getElementById("privacy-policy-trigger");
const privacyPolicyModalEl = document.getElementById("privacy-policy-modal");
const privacyPolicyCloseEl = document.getElementById("privacy-policy-close");
const noteModalEl = document.getElementById("note-modal");
const noteCloseEl = document.getElementById("note-close");
const noteTitleEl = document.getElementById("note-title");
const noteMetaEl = document.getElementById("note-meta");
const noteContentEl = document.getElementById("note-content");
const modalFocusState = {
  stack: [],
  returnFocus: new Map(),
};
const MODAL_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getVisibleModalElements() {
  return [
    songRandomModalEl,
    songSearchModalEl,
    editorModalEl,
    editorCloseWarningModalEl,
    privacyPolicyModalEl,
    noteModalEl,
    calendarSearchModalEl,
    versionHistoryModalEl,
  ].filter((element) => element && !element.classList.contains("hidden"));
}

function syncModalStack() {
  const visibleIds = new Set(getVisibleModalElements().map((element) => element.id));
  modalFocusState.stack = modalFocusState.stack.filter((id) => visibleIds.has(id));
}

function getTopmostOpenModal() {
  syncModalStack();
  for (let index = modalFocusState.stack.length - 1; index >= 0; index -= 1) {
    const modalEl = document.getElementById(modalFocusState.stack[index]);
    if (modalEl && !modalEl.classList.contains("hidden")) {
      return modalEl;
    }
  }
  const visibleModals = getVisibleModalElements();
  return visibleModals[visibleModals.length - 1] || null;
}

function getModalDialogEl(modalEl) {
  if (!modalEl) {
    return null;
  }
  return modalEl.querySelector("[tabindex='-1']") || modalEl;
}

function getModalPreferredFocus(modalEl) {
  if (!modalEl) {
    return null;
  }
  if (modalEl === editorModalEl) {
    return editorStatusModeEl;
  }
  if (modalEl === editorCloseWarningModalEl) {
    return editorCloseWarningCancelEl;
  }
  if (modalEl === privacyPolicyModalEl) {
    return privacyPolicyCloseEl;
  }
  if (modalEl === noteModalEl) {
    return noteCloseEl;
  }
  if (modalEl === songRandomModalEl) {
    return songRandomCategoryEl;
  }
  if (modalEl === songSearchModalEl) {
    return songSearchTitleEl;
  }
  if (modalEl === calendarSearchModalEl) {
    return calendarSearchQueryEl;
  }
  if (modalEl === versionHistoryModalEl) {
    return versionHistoryCloseEl;
  }
  return null;
}

function focusModal(modalEl) {
  const preferredEl = getModalPreferredFocus(modalEl);
  const dialogEl = getModalDialogEl(modalEl);
  const fallbackEl = dialogEl?.querySelector(MODAL_FOCUSABLE_SELECTOR) || dialogEl || modalEl;
  const targetEl = preferredEl && !preferredEl.disabled ? preferredEl : fallbackEl;
  window.requestAnimationFrame(() => {
    targetEl?.focus?.();
    if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement) {
      targetEl.select?.();
    }
  });
}

function openModalElement(modalEl) {
  if (!modalEl) {
    return;
  }
  const modalId = modalEl.id;
  if (!modalEl.classList.contains("hidden")) {
    focusModal(modalEl);
    return;
  }
  if (document.activeElement instanceof HTMLElement) {
    modalFocusState.returnFocus.set(modalId, document.activeElement);
  }
  modalEl.classList.remove("hidden");
  modalFocusState.stack = modalFocusState.stack.filter((id) => id !== modalId);
  modalFocusState.stack.push(modalId);
  updateModalScrollLock();
  focusModal(modalEl);
}

function closeModalElement(modalEl, { restoreFocus = true } = {}) {
  if (!modalEl || modalEl.classList.contains("hidden")) {
    return;
  }
  const modalId = modalEl.id;
  modalEl.classList.add("hidden");
  modalFocusState.stack = modalFocusState.stack.filter((id) => id !== modalId);
  updateModalScrollLock();
  const nextModalEl = getTopmostOpenModal();
  if (nextModalEl) {
    focusModal(nextModalEl);
    return;
  }
  if (!restoreFocus) {
    return;
  }
  const returnFocusEl = modalFocusState.returnFocus.get(modalId);
  modalFocusState.returnFocus.delete(modalId);
  if (returnFocusEl && document.contains(returnFocusEl)) {
    window.requestAnimationFrame(() => {
      returnFocusEl.focus?.();
    });
  }
}

function trapFocusInsideModal(modalEl, event) {
  if (!modalEl || event.key !== "Tab") {
    return false;
  }
  const dialogEl = getModalDialogEl(modalEl);
  if (!dialogEl) {
    return false;
  }
  const focusable = Array.from(dialogEl.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter(
    (element) => element instanceof HTMLElement && !element.hasAttribute("disabled")
  );
  if (!focusable.length) {
    dialogEl.focus?.();
    event.preventDefault();
    return true;
  }
  const firstEl = focusable[0];
  const lastEl = focusable[focusable.length - 1];
  const activeEl = document.activeElement;
  if (event.shiftKey && (activeEl === firstEl || activeEl === dialogEl)) {
    lastEl.focus?.();
    event.preventDefault();
    return true;
  }
  if (!event.shiftKey && activeEl === lastEl) {
    firstEl.focus?.();
    event.preventDefault();
    return true;
  }
  return false;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  // 응답 파싱 자체가 실패하면(예: 존재하지 않는 API 경로를 정적 호스팅이
  // 200 OK로 index.html을 대신 돌려주는 경우) response.ok만 보고는 성공으로
  // 착각하기 쉽다. JSON 파싱 실패는 항상 실패로 취급해야 "일정이 없다"처럼
  // 조용히 틀린 결과를 보여주는 대신 실패 상태가 그대로 드러난다.
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("응답을 해석하지 못했습니다.");
  }
  if (!response.ok) {
    throw new Error(data.error || "요청에 실패했습니다.");
  }
  return data;
}

function localPreviewApiOrigin() {
  const isLocalHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  if (!isLocalHost || window.location.port !== "4173") {
    return "";
  }
  return LOCAL_PREVIEW_API_ORIGIN;
}

function apiUrl(path) {
  return `${localPreviewApiOrigin()}${String(path || "").trim()}`;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDayImageDataUrl(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("data:image/") || text.length > MAX_DAY_IMAGE_DATA_URL_LENGTH) {
    return "";
  }
  return text;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지 파일을 불러오지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("이미지 변환에 실패했습니다."));
    }, type, quality);
  });
}

function isFirestorePermissionError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    message.includes("missing or insufficient permissions") ||
    message.includes("permission") ||
    code.includes("permission-denied")
  );
}

async function resizeDayImageFile(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const squareSize = Math.max(1, Math.min(sourceWidth, sourceHeight));
  const cropX = Math.max(0, Math.round((sourceWidth - squareSize) / 2));
  const cropY = Math.max(0, Math.round((sourceHeight - squareSize) / 2));
  const width = MAX_DAY_IMAGE_WIDTH;
  const height = MAX_DAY_IMAGE_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지 변환을 준비하지 못했습니다.");
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, cropX, cropY, squareSize, squareSize, 0, 0, width, height);
  const attempts = [
    ["image/webp", 0.92],
    ["image/webp", 0.84],
    ["image/webp", 0.76],
    ["image/webp", 0.68],
  ];
  for (const [type, quality] of attempts) {
    const result = canvas.toDataURL(type, quality);
    if (result.length <= MAX_DAY_IMAGE_DATA_URL_LENGTH) {
      return result;
    }
  }
  throw new Error("이미지가 너무 커서 저장할 수 없습니다. 조금 더 작은 이미지를 올려주세요.");
}

function normalizeYoutubeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      videoId: String(item?.videoId || "").trim(),
      title: String(item?.title || "").trim(),
      url: String(item?.url || "").trim(),
      publishedAt: String(item?.publishedAt || "").trim(),
      thumbnailUrl: String(item?.thumbnailUrl || "").trim(),
      isShort: !!item?.isShort,
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 3);
}

function extractYoutubeVideoId(item) {
  const directId = String(item?.videoId || "").trim();
  if (directId) {
    return directId;
  }
  const rawUrl = String(item?.url || "").trim();
  if (!rawUrl) {
    return "";
  }
  try {
    const parsed = new URL(rawUrl);
    const watchId = parsed.searchParams.get("v");
    if (watchId) {
      return watchId.trim();
    }
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const shortsIndex = pathParts.indexOf("shorts");
    if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) {
      return pathParts[shortsIndex + 1].trim();
    }
  } catch {
    return "";
  }
  return "";
}

function resolveYoutubeThumbnail(item) {
  const directThumb = String(item?.thumbnailUrl || "").trim();
  if (directThumb) {
    return directThumb;
  }
  const videoId = extractYoutubeVideoId(item);
  if (videoId) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  }
  return DEFAULT_THUMBNAIL;
}

function readYoutubeCache() {
  try {
    return normalizeYoutubeItems(JSON.parse(window.localStorage.getItem(YOUTUBE_CACHE_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function writeYoutubeCache(items) {
  try {
    const normalized = normalizeYoutubeItems(items);
    if (!normalized.length) {
      return;
    }
    window.localStorage.setItem(YOUTUBE_CACHE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage failures
  }
}

function nowKstClock() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "00";
  return {
    hour: Number(pick("hour")) || 0,
    minute: Number(pick("minute")) || 0,
  };
}

function youtubeRefreshIntervalMs() {
  const { hour, minute } = nowKstClock();
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes >= 17 * 60 + 30 && totalMinutes < 18 * 60 + 30) {
    return 5 * 60 * 1000;
  }
  if (totalMinutes >= 18 * 60 + 30 && totalMinutes < 21 * 60) {
    return 15 * 60 * 1000;
  }
  return 4 * 60 * 60 * 1000;
}

function scheduleYoutubeRefresh(delayMs = youtubeRefreshIntervalMs()) {
  if (state.youtubePollTimer) {
    window.clearTimeout(state.youtubePollTimer);
  }
  state.youtubePollTimer = window.setTimeout(() => {
    void refreshYoutubeItems();
  }, Math.max(60 * 1000, Number(delayMs) || youtubeRefreshIntervalMs()));
}

function applyYoutubePayload(payload) {
  const nextYoutubeItems = normalizeYoutubeItems(payload?.items || []);
  if (!nextYoutubeItems.length) {
    return;
  }
  state.youtubeItems = nextYoutubeItems;
  writeYoutubeCache(nextYoutubeItems);
}

function firebasePublicConfig() {
  return window.VINCE_FIREBASE_CONFIG || {};
}

function firebaseCollectionMap() {
  const config = firebasePublicConfig();
  return {
    calendar: String(config.calendarCollection || "calendar_overrides").trim() || "calendar_overrides",
    postit: String(config.postitCollection || "postit").trim() || "postit",
    songbook: String(config.songbookCollection || "songbook").trim() || "songbook",
    editorAccess: String(config.editorAccessCollection || "editor_access").trim() || "editor_access",
    siteStats: String(config.siteStatsCollection || "site_stats").trim() || "site_stats",
  };
}

function normalizeEmailList(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function adminEmailList() {
  const config = firebasePublicConfig();
  const configured = normalizeEmailList(config.adminEmails);
  return configured.length ? configured : DEFAULT_ADMIN_EMAILS.slice();
}

function isAdminEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return !!normalized && adminEmailList().includes(normalized);
}

function isAdminUser() {
  const auth = currentAuth();
  return Boolean(auth?.signedIn && auth?.canAdmin && isAdminEmail(auth.email));
}

function canUseFirebase() {
  const config = firebasePublicConfig();
  return Boolean(
    window.firebase &&
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.appId
  );
}

async function loadSiteData() {
  return fetchJson(`${SITE_DATA_URL}?v=${Date.now()}`);
}

function monthKey(year, month) {
  return `${Number(year)}-${String(Number(month)).padStart(2, "0")}`;
}

function summarizeNoteLabel(noteText) {
  const normalized = String(noteText || "").trim();
  if (!normalized) {
    return "";
  }
  const tokens = normalized.split(/[,\n/]+/).map((item) => item.trim()).filter(Boolean);
  if (tokens.length >= 2) {
    return `참여 ${tokens.length}명`;
  }
  return "더보기";
}

function createAuthState(overrides = {}) {
  return {
    googleEnabled: state.firebaseConfigured,
    writeEnabled: state.firebaseConfigured,
    signedIn: false,
    canEdit: false,
    canPostitEdit: false,
    canAdmin: false,
    displayName: "",
    email: "",
    readOnlyReason: state.firebaseConfigured ? "" : "Firebase 설정이 필요합니다.",
    ...overrides,
  };
}

function showAuthMessage(message) {
  const normalized = String(message || "").trim();
  if (state.authStatusHideTimer) {
    window.clearTimeout(state.authStatusHideTimer);
    state.authStatusHideTimer = 0;
  }

  if (normalized) {
    authStatusEl.textContent = normalized;
    authStatusEl.classList.remove("hidden");
    window.requestAnimationFrame(() => {
      authStatusEl.classList.add("auth-chip-visible");
    });
    return;
  }

  authStatusEl.classList.remove("auth-chip-visible");
  state.authStatusHideTimer = window.setTimeout(() => {
    authStatusEl.textContent = "";
    authStatusEl.classList.add("hidden");
    state.authStatusHideTimer = 0;
  }, 220);
}

function clearAuthStatusTimer() {
  if (state.authStatusTimer) {
    window.clearTimeout(state.authStatusTimer);
    state.authStatusTimer = 0;
  }
}

function clearTransientAuthMessage() {
  clearAuthStatusTimer();
  state.authStatusMessage = "";
}

function flashAuthStatusMessage(message, durationMs = 2600) {
  const normalized = String(message || "").trim();
  clearAuthStatusTimer();
  state.authStatusMessage = normalized;
  renderAuth();
  if (!normalized) {
    return;
  }
  state.authStatusTimer = window.setTimeout(() => {
    state.authStatusTimer = 0;
    state.authStatusMessage = "";
    renderAuth();
  }, durationMs);
}

function describeGoogleLoginError(error) {
  const code = String(error?.code || "").trim();
  if (code === "auth/unauthorized-domain") {
    return `Firebase 허용 도메인에 ${window.location.hostname} 추가가 필요합니다.`;
  }
  if (code === "auth/popup-blocked") {
    return "브라우저에서 로그인 팝업을 차단했습니다. 팝업 허용 후 다시 시도해주세요.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "로그인 창이 닫혀서 로그인되지 않았습니다.";
  }
  if (code === "auth/cancelled-popup-request") {
    return "로그인 요청이 취소되었습니다. 잠시 후 다시 시도해주세요.";
  }
  if (code === "auth/network-request-failed") {
    return "로그인 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
  return "Google 로그인에 실패했습니다. Firebase 인증 설정을 확인해주세요.";
}

function createBlankDay(dayNumber, weekdayIndex) {
  return {
    day: dayNumber,
    timeLabel: "",
    timeSource: "local",
    isOff: false,
    entries: [],
    weekdayIndex,
    baseRow: 0,
    baseColumn: 0,
    noteText: "",
    noteLabel: "",
    showStatusImage: false,
  };
}

function buildBlankMonth(year, month, legend) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  const days = [];
  let currentWeek = Array(7).fill(null);
  let weekdayIndex = firstDay;

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const dayPayload = createBlankDay(dayNumber, weekdayIndex);
    currentWeek[weekdayIndex] = dayPayload;
    days.push(dayPayload);
    if (weekdayIndex === 6 || dayNumber === daysInMonth) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }
    weekdayIndex = (weekdayIndex + 1) % 7;
  }

  return {
    key: monthKey(year, month),
    sheetName: "",
    title: formatMonthTitle(year, month),
    year,
    month,
    weeks,
    days,
    legend: Array.isArray(legend) ? cloneData(legend) : [],
    sheetVideos: [],
    hasEntries: false,
    source: "local",
  };
}

function ensureMonthGrid(monthData) {
  const legend = monthData?.legend || state.bootstrap?.legend || [];
  const blankMonth = buildBlankMonth(monthData.year, monthData.month, legend);
  const dayMap = new Map((monthData.days || []).map((item) => [Number(item.day), cloneData(item)]));
  blankMonth.days.forEach((dayPayload) => {
    if (dayMap.has(dayPayload.day)) {
      Object.assign(dayPayload, dayMap.get(dayPayload.day));
    }
  });
  blankMonth.weeks = blankMonth.weeks.map((week) =>
    week.map((dayPayload) => (dayPayload ? blankMonth.days.find((item) => item.day === dayPayload.day) : null))
  );
  blankMonth.sheetName = monthData.sheetName || "";
  blankMonth.sheetVideos = cloneData(monthData.sheetVideos || []);
  blankMonth.source = monthData.source || blankMonth.source;
  return blankMonth;
}

function applyMonthOverrideData(monthData, monthOverride) {
  const monthPayload = ensureMonthGrid(monthData);
  const legendLookup = new Map((monthPayload.legend || []).map((item) => [item.key, item]));
  const daysOverride = monthOverride?.days || {};

  Object.entries(daysOverride).forEach(([rawDay, override]) => {
    const dayNumber = Number(rawDay);
    const dayPayload = monthPayload.days.find((item) => item.day === dayNumber);
    if (!dayPayload) {
      return;
    }

    const timeLabel = String(override?.timeLabel || "").trim();
    const normalizedTime = timeLabel === "휴방" ? "휴뱅" : timeLabel;
    const renderedEntries = (Array.isArray(override?.entries) ? override.entries : [])
      .map((entry) => {
        const text = String(entry?.text || "").slice(0, 120).trim();
        if (!text) {
          return null;
        }
        const categoryKey = String(entry?.categoryKey || "").trim();
        const noteText = String(entry?.noteText || "").slice(0, 120).trim();
        const legendItem = legendLookup.get(categoryKey) || {};
        return {
          text,
          categoryKey,
          categoryLabel: legendItem.label || "",
          categoryColor: legendItem.color || "",
          noteText,
          noteLabel: String(entry?.noteLabel || "").trim() || (noteText ? summarizeNoteLabel(noteText) : ""),
          imageUrl: "",
        };
      })
      .filter(Boolean);

    const noteText = String(override?.noteText || "").slice(0, 1200).trim();
    dayPayload.timeLabel = normalizedTime;
    dayPayload.timeSource = String(override?.timeSource || "").trim() || "manual";
    dayPayload.isOff = normalizedTime === "휴뱅";
    dayPayload.entries = renderedEntries;
    dayPayload.noteText = noteText;
    dayPayload.noteLabel = String(override?.noteLabel || "").trim() || (noteText ? summarizeNoteLabel(noteText) : "");
    dayPayload.customImageDataUrl = normalizeDayImageDataUrl(override?.customImageDataUrl);
    dayPayload.localOverride = true;
  });

  monthPayload.days.forEach((dayPayload) => {
    const timeLabel = String(dayPayload.timeLabel || "").trim();
    dayPayload.isOff = timeLabel === "휴뱅" || timeLabel === "휴방";
    dayPayload.showStatusImage = dayPayload.isOff;
    dayPayload.customImageDataUrl = normalizeDayImageDataUrl(dayPayload.customImageDataUrl);
  });
  monthPayload.hasEntries = monthPayload.days.some((dayPayload) =>
    Boolean(String(dayPayload.timeLabel || "").trim() || (dayPayload.entries || []).length)
  );
  return monthPayload;
}

function mergeCurrentMonthDay(dayPayload) {
  if (!state.currentMonthData || !dayPayload) {
    return;
  }
  state.currentMonthData.days = state.currentMonthData.days.map((item) => (item.day === dayPayload.day ? dayPayload : item));
  state.currentMonthData.weeks = state.currentMonthData.weeks.map((week) =>
    week.map((item) => (item?.day === dayPayload.day ? dayPayload : item))
  );
  if (state.selectedDay?.day === dayPayload.day) {
    state.selectedDay = cloneData(dayPayload);
  }
}

function firestoreTimestamp() {
  return new Date().toISOString();
}

function formatVersionHistoryDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "시각 정보 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseVersionHistoryDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function versionHistoryMonthTitle(year = state.selectedYear, month = state.selectedMonth) {
  return `${Number(year)}년 ${String(Number(month)).padStart(2, "0")}월 버전 기록`;
}

function formatVersionHistoryDayLabel(value) {
  const date = parseVersionHistoryDate(value);
  if (!date) {
    return "날짜 정보 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function buildVersionHistorySessionDocId(savedBy, nowMs = Date.now()) {
  const date = new Date(nowMs);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "00";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = pick("hour");
  const minuteBucket = String(Math.floor(Number(pick("minute")) / 5) * 5).padStart(2, "0");
  const emailKey = encodeURIComponent(String(savedBy || "").trim().toLowerCase()).replace(/%/g, "_");
  return `save_${emailKey}_${year}${month}${day}${hour}${minuteBucket}`;
}

function normalizeHistorySnapshotDay(raw) {
  const noteText = String(raw?.noteText || "").slice(0, 1200).trim();
  return {
    timeLabel: String(raw?.timeLabel || "").trim(),
    timeSource: String(raw?.timeSource || "").trim() || "manual",
    entries: normalizeEditorEntries(raw?.entries || []).map((entry) => ({
      text: entry.text,
      categoryKey: entry.categoryKey,
      noteText: entry.noteText,
      noteLabel: entry.noteText ? summarizeNoteLabel(entry.noteText) : "",
    })),
    noteText,
    noteLabel: String(raw?.noteLabel || "").trim() || (noteText ? summarizeNoteLabel(noteText) : ""),
    customImageDataUrl: normalizeDayImageDataUrl(raw?.customImageDataUrl),
  };
}

function normalizeVersionSnapshot(raw, fallbackYear = state.selectedYear, fallbackMonth = state.selectedMonth) {
  const days = {};
  const rawDays = raw?.days && typeof raw.days === "object" ? raw.days : {};
  Object.entries(rawDays).forEach(([dayKey, dayValue]) => {
    const numericDay = Number(dayKey);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) {
      return;
    }
    days[String(numericDay)] = normalizeHistorySnapshotDay(dayValue);
  });
  return {
    year: Number(raw?.year || fallbackYear),
    month: Number(raw?.month || fallbackMonth),
    days,
  };
}

function summarizeVersionEntry(snapshot, changedDay = 0) {
  const day = snapshot?.days?.[String(changedDay)] || null;
  if (!day) {
    return "월 전체 상태 저장";
  }
  const firstEntry = (day.entries || []).find((entry) => String(entry?.text || "").trim());
  if (firstEntry?.text) {
    return truncateText(firstEntry.text, 40);
  }
  if (day.noteText) {
    return truncateText(day.noteText, 40);
  }
  if (day.timeLabel) {
    return day.timeLabel;
  }
  return `${changedDay}일 일정 상태 저장`;
}

function buildVersionHistoryFingerprint(snapshot, changedDay = 0) {
  return JSON.stringify({
    month: monthKey(snapshot?.year || state.selectedYear, snapshot?.month || state.selectedMonth),
    changedDay: Number(changedDay) || 0,
    snapshot,
  });
}

function normalizeVersionHistoryItem(docSnapshot) {
  const data = typeof docSnapshot?.data === "function" ? docSnapshot.data() : docSnapshot || {};
  const savedAtRaw = data?.savedAt?.toDate ? data.savedAt.toDate() : data?.savedAt || "";
  const snapshot = normalizeVersionSnapshot(data?.snapshot || {}, data?.year, data?.month);
  return {
    id: String(docSnapshot?.id || data?.id || ""),
    monthKey: String(data?.monthKey || monthKey(snapshot.year, snapshot.month)),
    year: Number(data?.year || snapshot.year || 0),
    month: Number(data?.month || snapshot.month || 0),
    savedAt: savedAtRaw,
    savedBy: String(data?.savedBy || "").trim().toLowerCase(),
    changedDay: Number(data?.changedDay || 0),
    action: String(data?.action || "save").trim() || "save",
    summary: String(data?.summary || summarizeVersionEntry(snapshot, Number(data?.changedDay || 0))).trim(),
    fingerprint: String(data?.fingerprint || "").trim(),
    snapshot,
  };
}

function categoryLabelForKey(categoryKey) {
  const match = (state.bootstrap?.legend || []).find((item) => item.key === categoryKey);
  return String(match?.label || categoryKey || "일정").trim();
}

function formatVersionEntryText(entry = {}) {
  const categoryLabel = categoryLabelForKey(entry.categoryKey);
  const text = String(entry.text || "").trim() || "내용 없음";
  const noteText = String(entry.noteText || "").trim();
  return noteText
    ? `[${categoryLabel}] ${text} / 기타: ${noteText}`
    : `[${categoryLabel}] ${text}`;
}

function versionEntriesEqual(left = {}, right = {}) {
  return (
    String(left.text || "").trim() === String(right.text || "").trim() &&
    String(left.categoryKey || "").trim() === String(right.categoryKey || "").trim() &&
    String(left.noteText || "").trim() === String(right.noteText || "").trim()
  );
}

function diffVersionHistoryDay(currentDay = {}, previousDay = {}) {
  const changes = [];
  const currentTime = String(currentDay.timeLabel || "").trim();
  const previousTime = String(previousDay.timeLabel || "").trim();
  if (currentTime !== previousTime) {
    changes.push({
      tone: currentTime ? (previousTime ? "changed" : "added") : "removed",
      label: "방송 시간",
      before: previousTime,
      after: currentTime,
    });
  }

  const currentNote = String(currentDay.noteText || "").trim();
  const previousNote = String(previousDay.noteText || "").trim();
  if (currentNote !== previousNote) {
    changes.push({
      tone: currentNote ? (previousNote ? "changed" : "added") : "removed",
      label: "날짜 메모",
      before: previousNote,
      after: currentNote,
    });
  }

  const currentImage = Boolean(String(currentDay.customImageDataUrl || "").trim());
  const previousImage = Boolean(String(previousDay.customImageDataUrl || "").trim());
  if (currentImage !== previousImage) {
    changes.push({
      tone: currentImage ? "added" : "removed",
      label: "날짜 이미지",
      before: previousImage ? "이미지 있음" : "",
      after: currentImage ? "이미지 있음" : "",
    });
  }

  const currentEntries = Array.isArray(currentDay.entries) ? currentDay.entries : [];
  const previousEntries = Array.isArray(previousDay.entries) ? previousDay.entries : [];
  const maxLength = Math.max(currentEntries.length, previousEntries.length);
  for (let index = 0; index < maxLength; index += 1) {
    const currentEntry = currentEntries[index] || null;
    const previousEntry = previousEntries[index] || null;
    if (currentEntry && previousEntry && versionEntriesEqual(currentEntry, previousEntry)) {
      continue;
    }
    changes.push({
      tone: currentEntry ? (previousEntry ? "changed" : "added") : "removed",
      label: `일정 ${index + 1}`,
      before: previousEntry ? formatVersionEntryText(previousEntry) : "",
      after: currentEntry ? formatVersionEntryText(currentEntry) : "",
    });
  }

  return changes;
}

function buildVersionHistoryDiff(currentItem, previousItem) {
  if (!currentItem) {
    return null;
  }
  if (!previousItem) {
    return {
      type: "missing-previous",
      dayDiffs: [],
    };
  }

  const currentDays = currentItem.snapshot?.days || {};
  const previousDays = previousItem.snapshot?.days || {};
  const changedDayKeys = [...new Set([...Object.keys(currentDays), ...Object.keys(previousDays)])]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
    .sort((a, b) => a - b);

  const dayDiffs = changedDayKeys
    .map((day) => ({
      day,
      changes: diffVersionHistoryDay(currentDays[String(day)] || {}, previousDays[String(day)] || {}),
    }))
    .filter((item) => item.changes.length);

  return {
    type: dayDiffs.length ? "diff" : "no-change",
    dayDiffs,
  };
}

function previousVersionHistoryItem(versionId) {
  const index = state.versionHistoryItems.findIndex((item) => item.id === versionId);
  if (index < 0) {
    return null;
  }
  return state.versionHistoryItems[index + 1] || null;
}

function renderVersionHistoryPreview(item) {
  if (!item || state.versionHistoryPreviewId !== item.id) {
    return "";
  }

  const diff = buildVersionHistoryDiff(item, previousVersionHistoryItem(item.id));
  if (!diff) {
    return "";
  }

  if (diff.type === "missing-previous") {
    return `
      <div class="version-history-preview">
        <p class="version-history-preview-title">편집 확인</p>
        <p class="version-history-preview-empty">직전 버전이 없어서 비교할 수 없습니다.</p>
      </div>
    `;
  }

  if (diff.type === "no-change") {
    return `
      <div class="version-history-preview">
        <p class="version-history-preview-title">편집 확인</p>
        <p class="version-history-preview-empty">직전 버전과 비교했을 때 저장된 내용 차이가 없습니다.</p>
      </div>
    `;
  }

  return `
    <div class="version-history-preview">
      <p class="version-history-preview-title">편집 확인</p>
      <div class="version-history-preview-days">
        ${diff.dayDiffs.map((dayDiff) => `
          <section class="version-history-preview-day">
            <p class="version-history-preview-day-title">${dayDiff.day}일 변경</p>
            <div class="version-history-preview-list">
              ${dayDiff.changes.map((change) => `
                <article class="version-history-preview-change tone-${escapeHtml(change.tone)}">
                  <div class="version-history-preview-label-row">
                    <span class="version-history-preview-label">${escapeHtml(change.label)}</span>
                    <span class="version-history-preview-badge tone-${escapeHtml(change.tone)}">${escapeHtml(
                      change.tone === "added" ? "추가" : change.tone === "removed" ? "삭제" : "변경"
                    )}</span>
                  </div>
                  ${change.before ? `<p class="version-history-preview-before">이전 · ${escapeHtml(change.before)}</p>` : ""}
                  ${change.after ? `<p class="version-history-preview-after">현재 · ${escapeHtml(change.after)}</p>` : ""}
                </article>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    </div>
  `;
}

function pickRandomItem(items) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }
  return items[Math.floor(Math.random() * items.length)] || "";
}

function truncateInlineText(value, maxLength = 18) {
  const text = String(value || "").trim();
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function truncateText(value, maxLength = 96) {
  const text = String(value || "").trim();
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function readStoredValue(key) {
  try {
    return String(window.localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value || "").trim());
  } catch {}
}

function preferredTheme() {
  const stored = readStoredValue(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return "dark";
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  bodyEl.dataset.theme = nextTheme;
  themeToggleEl.textContent = nextTheme === "dark" ? "☀" : "☾";
  writeStoredValue(THEME_STORAGE_KEY, nextTheme);
}

function toggleTheme() {
  applyTheme(bodyEl.dataset.theme === "dark" ? "light" : "dark");
}

function groupMonthsByYear(months) {
  const grouped = new Map();
  for (const month of months) {
    if (!grouped.has(month.year)) {
      grouped.set(month.year, []);
    }
    grouped.get(month.year).push(month);
  }
  for (const [, items] of grouped) {
    items.sort((a, b) => a.month - b.month);
  }
  return grouped;
}

function monthSortValue(item) {
  return item.year * 100 + item.month;
}

function currentAuth() {
  return state.bootstrap?.auth || null;
}

function syncAuthFromUser(user, canEditOverride = null) {
  if (!state.bootstrap) {
    return;
  }
  const email = String(user?.email || "").trim().toLowerCase();
  const canEdit = canEditOverride == null
    ? false
    : Boolean(canEditOverride);
  state.bootstrap.auth = createAuthState({
    googleEnabled: state.firebaseConfigured,
    writeEnabled: state.firebaseConfigured,
    signedIn: Boolean(user),
    canEdit,
    canPostitEdit: canEdit,
    canAdmin: isAdminEmail(email),
    displayName: String(user?.displayName || "").trim() || (email ? email.split("@")[0] : ""),
    email,
    readOnlyReason: state.firebaseConfigured ? "" : "Firebase 설정이 필요합니다.",
  });
}

function initializeFirebase() {
  state.firebaseConfigured = canUseFirebase();
  if (!state.firebaseConfigured) {
    return;
  }

  const config = firebasePublicConfig();
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId,
      messagingSenderId: config.messagingSenderId || "",
    });
  }

  firebaseState.enabled = true;
  firebaseState.ready = true;
  firebaseState.auth = firebase.auth();
  firebaseState.db = firebase.firestore();
  firebaseState.db.settings({ ignoreUndefinedProperties: true });
}

function currentMonthDocRef(year = state.selectedYear, month = state.selectedMonth) {
  if (!firebaseState.db) {
    return null;
  }
  const collections = firebaseCollectionMap();
  return firebaseState.db.collection(collections.calendar).doc(monthKey(year, month));
}

function postitDocRef() {
  if (!firebaseState.db) {
    return null;
  }
  return firebaseState.db.collection(firebaseCollectionMap().postit).doc("shared");
}

function songbookDocRef() {
  if (!firebaseState.db) {
    return null;
  }
  return firebaseState.db.collection(firebaseCollectionMap().songbook).doc("shared");
}

function siteStatsDocRef() {
  if (!firebaseState.db) {
    return null;
  }
  return firebaseState.db.collection(firebaseCollectionMap().siteStats).doc("visits");
}

function editorAccessDocRef(email = "") {
  if (!firebaseState.db) {
    return null;
  }
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return firebaseState.db.collection(firebaseCollectionMap().editorAccess).doc(normalized);
}

function currentMonthVersionHistoryRef(year = state.selectedYear, month = state.selectedMonth) {
  const ref = currentMonthDocRef(year, month);
  return ref ? ref.collection(VERSION_HISTORY_SUBCOLLECTION) : null;
}

function canonicalSongTag(value) {
  const normalized = String(value || "").replace(/^#+/, "").slice(0, 40).trim();
  if (!normalized) {
    return "";
  }
  return normalized.toLowerCase() === "커버곡" ? "유튜브" : normalized;
}

function songTagMeta(tag) {
  return SONG_TAG_META[canonicalSongTag(tag)] || null;
}

function songTagDisplayText(tag) {
  return canonicalSongTag(tag);
}

function renderSongTagLabel(tag) {
  const normalizedTag = songTagDisplayText(tag);
  const meta = songTagMeta(normalizedTag);
  if (!normalizedTag) {
    return "";
  }
  const iconMarkup = meta?.imageSrc
    ? `<img class="song-tag-symbol-image" src="${escapeHtml(meta.imageSrc)}" alt="${escapeHtml(meta.imageAlt || normalizedTag)}">`
    : meta?.icon
      ? `<span class="song-tag-symbol" aria-hidden="true">${escapeHtml(meta.icon)}</span>`
      : "";
  return `${iconMarkup}<span class="song-tag-text">${escapeHtml(normalizedTag)}</span>`;
}

function songTagClassName(tag) {
  const meta = songTagMeta(tag);
  return meta?.className ? ` tag-${meta.className}` : "";
}

function songTagOptionLabel(tag) {
  const normalizedTag = songTagDisplayText(tag);
  const meta = songTagMeta(normalizedTag);
  if (!normalizedTag) {
    return "전체";
  }
  return meta?.icon ? `${meta.icon} ${normalizedTag}` : normalizedTag;
}

function normalizeSongTags(rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
      .split(/[,\n]+/)
      .map((item) => item.trim());
  const seen = new Set();
  return source
    .map((item) => canonicalSongTag(item))
    .filter((item) => {
      if (!item) {
        return false;
      }
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function tagsToInputValue(tags) {
  return normalizeSongTags(tags).join(", ");
}

function normalizeSongbookItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: String(item?.id || "").trim() || `song-${index + 1}`,
      number: String(index + 1),
      title: String(item?.title || "").slice(0, 120).trim(),
      originalTitle: String(item?.originalTitle || "").slice(0, 120).trim(),
      artist: String(item?.artist || "").slice(0, 80).trim(),
      tags: normalizeSongTags(item?.tags || ""),
      category: String(item?.category || "").slice(0, 40).trim(),
      source: String(item?.source || "sheet").trim() || "sheet",
    }))
    .filter((item) => item.title);
}

function deriveSongbookMeta(items) {
  const artists = [...new Set(items.map((item) => item.artist).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))];
  const normalizedDefaultTags = DEFAULT_SONG_TAGS.map((tag) => canonicalSongTag(tag));
  const extraTags = [...new Set(items.flatMap((item) => normalizeSongTags(item.tags || [])))]
    .filter((tag) => !normalizedDefaultTags.some((defaultTag) => defaultTag.toLowerCase() === tag.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "ko"));
  const tags = [...normalizedDefaultTags, ...extraTags];
  return { artists, categories, tags };
}

function getKstYearMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  return { year, month };
}

function resolveAutoMonth() {
  return getKstYearMonth();
}

function calendarBounds() {
  const fallbackYear = getKstYearMonth().year;
  return state.bootstrap?.calendarBounds || {
    minYear: fallbackYear - 1,
    maxYear: fallbackYear + 2,
  };
}

function formatYearTitle(year) {
  return `${year}년`;
}

function formatMonthLabel(month) {
  return `${String(month).padStart(2, "0")}월`;
}

function buildDefaultLiveStatus() {
  return {
    channelName: "빈스",
    channelUrl: state.bootstrap?.links?.chzzkChannelUrl || "",
    avatarUrl: state.bootstrap?.profileAvatarUrl || DEFAULT_AVATAR,
    bio: "알다가도 모를 까마귀",
    isLive: false,
    available: false,
    stale: false,
    message: "",
    liveTitle: "",
    startAt: "",
    closeAt: "",
    lastStartAt: "",
    lastCloseAt: "",
  };
}

function currentLive() {
  return state.liveStatus || buildDefaultLiveStatus();
}

function formatKoreanDate(isoText) {
  if (!isoText) {
    return "";
  }
  const date = new Date(isoText);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatMonthTitle(year, month) {
  return `${year}년 ${String(month).padStart(2, "0")}월`;
}

function shuffleHeroVideos(videos) {
  const pool = videos.slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function refillHeroVideoCycle(videos, currentVideo = "") {
  const nextCycle = shuffleHeroVideos(videos);
  if (currentVideo && nextCycle.length > 1 && nextCycle[0] === currentVideo) {
    [nextCycle[0], nextCycle[1]] = [nextCycle[1], nextCycle[0]];
  }
  state.heroVideoCycle = nextCycle;
}

function pickNextHeroVideo(videos, currentVideo = "") {
  if (!Array.isArray(videos) || !videos.length) {
    return "";
  }
  if (videos.length === 1) {
    return videos[0];
  }
  if (!Array.isArray(state.heroVideoCycle) || !state.heroVideoCycle.length) {
    refillHeroVideoCycle(videos, currentVideo);
  }
  const nextVideo = String(state.heroVideoCycle.shift() || "").trim();
  if (nextVideo && nextVideo !== currentVideo) {
    return nextVideo;
  }
  refillHeroVideoCycle(videos, currentVideo);
  return String(state.heroVideoCycle.shift() || videos[0] || "").trim();
}

function hideHeroImage() {
  if (!(heroImageEl instanceof HTMLImageElement)) {
    return;
  }
  heroImageEl.classList.add("hidden");
  heroImageEl.removeAttribute("src");
}

function getActiveHeroVideoEl() {
  return state.activeHeroBuffer === "primary" ? heroVideoEl : heroVideoBufferEl;
}

function getStandbyHeroVideoEl() {
  return state.activeHeroBuffer === "primary" ? heroVideoBufferEl : heroVideoEl;
}

function setHeroVideoVisibility(activeVideoEl) {
  [heroVideoEl, heroVideoBufferEl].forEach((videoEl) => {
    if (!(videoEl instanceof HTMLVideoElement)) {
      return;
    }
    videoEl.classList.toggle("is-on", videoEl === activeVideoEl);
  });
  heroSectionEl.classList.remove("hero-powering");
  heroSectionEl.classList.add("hero-powered");
}

function getHeroVideoPlaybackRate(src) {
  return String(src || "").includes("캘린더5.mp4")
    ? HERO_VIDEO_DEFAULT_PLAYBACK_RATE
    : HERO_VIDEO_PLAYBACK_RATE;
}

function preloadNextHeroVideo() {
  if (state.heroMode !== "fallback" || state.heroVideos.length < 2) {
    state.nextHeroVideo = "";
    return;
  }
  const nextSrc = pickNextHeroVideo(state.heroVideos, state.currentHeroVideo);
  if (!nextSrc) {
    state.nextHeroVideo = "";
    return;
  }
  state.nextHeroVideo = nextSrc;
  const standbyVideoEl = getStandbyHeroVideoEl();
  if (!(standbyVideoEl instanceof HTMLVideoElement)) {
    return;
  }
  standbyVideoEl.pause();
  standbyVideoEl.loop = false;
  standbyVideoEl.playbackRate = getHeroVideoPlaybackRate(nextSrc);
  if (standbyVideoEl.getAttribute("src") !== nextSrc) {
    standbyVideoEl.setAttribute("src", nextSrc);
    standbyVideoEl.load();
  }
}

function playHeroVideo(src, { loop = false, mode = "fallback" } = {}) {
  const activeVideoEl = getActiveHeroVideoEl();
  if (!(activeVideoEl instanceof HTMLVideoElement)) {
    return;
  }
  const nextSrc = String(src || "").trim();
  if (!nextSrc) {
    activeVideoEl.removeAttribute("src");
    state.currentHeroVideo = "";
    state.nextHeroVideo = "";
    return;
  }
  state.heroMode = mode;
  hideHeroImage();
  activeVideoEl.classList.remove("hidden");
  activeVideoEl.loop = loop;
  activeVideoEl.playbackRate = getHeroVideoPlaybackRate(nextSrc);
  state.currentHeroVideo = nextSrc;
  state.nextHeroVideo = "";
  heroSectionEl.classList.remove("hero-powering");
  heroSectionEl.classList.add("hero-powered");
  setHeroVideoVisibility(null);
  activeVideoEl.setAttribute("src", nextSrc);
  activeVideoEl.currentTime = 0;
  activeVideoEl.load();
  void activeVideoEl.play().catch(() => {});
  preloadNextHeroVideo();
}

function playNextHeroVideo() {
  if (state.heroMode !== "fallback") {
    return;
  }
  const standbyVideoEl = getStandbyHeroVideoEl();
  const nextSrc = String(state.nextHeroVideo || "").trim() || pickNextHeroVideo(state.heroVideos, state.currentHeroVideo);
  if (nextSrc) {
    if (
      standbyVideoEl instanceof HTMLVideoElement
      && standbyVideoEl.getAttribute("src") === nextSrc
      && standbyVideoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      state.activeHeroBuffer = state.activeHeroBuffer === "primary" ? "secondary" : "primary";
      state.currentHeroVideo = nextSrc;
      state.nextHeroVideo = "";
      setHeroVideoVisibility(getActiveHeroVideoEl());
      const activeVideoEl = getActiveHeroVideoEl();
      if (activeVideoEl instanceof HTMLVideoElement) {
        activeVideoEl.playbackRate = getHeroVideoPlaybackRate(nextSrc);
        activeVideoEl.currentTime = 0;
        void activeVideoEl.play().catch(() => {});
      }
      preloadNextHeroVideo();
      return;
    }
    playHeroVideo(nextSrc, { loop: false, mode: "fallback" });
  }
}

function bindHeroVideoElement(videoEl) {
  if (!(videoEl instanceof HTMLVideoElement) || videoEl.dataset.bound === "true") {
    return;
  }
  videoEl.dataset.bound = "true";
  videoEl.addEventListener("loadeddata", () => {
    if (videoEl !== getActiveHeroVideoEl()) {
      return;
    }
    requestAnimationFrame(() => {
      setHeroVideoVisibility(videoEl);
    });
  });
  videoEl.addEventListener("ended", () => {
    if (videoEl === getActiveHeroVideoEl()) {
      playNextHeroVideo();
    }
  });
  videoEl.addEventListener("error", () => {
    if (videoEl === getActiveHeroVideoEl()) {
      playNextHeroVideo();
    }
  });
}

function ensureHeroVideoBindings() {
  bindHeroVideoElement(heroVideoEl);
  bindHeroVideoElement(heroVideoBufferEl);
}

function setHeroVideos(videos) {
  state.heroVideos = Array.isArray(videos) ? videos.map((item) => String(item || "").trim()).filter(Boolean) : [];
  state.heroVideoCycle = [];
  ensureHeroVideoBindings();
  if (!state.heroVideos.length) {
    return;
  }
  const firstVideo = pickNextHeroVideo(state.heroVideos);
  playHeroVideo(firstVideo, { loop: false, mode: "fallback" });
}

function localHeroVideoSources() {
  return HERO_VIDEOS.filter((src) => !String(src).includes("캘린더5.mp4"));
}

function enableLocalHeroBackgroundPreview() {
  activeLocalHeroBackground = pickLocalHeroBackground();
  if (!activeLocalHeroBackground) {
    return false;
  }
  document.body.classList.add("local-background-preview");
  document.body.style.setProperty("--local-page-bg-image", `url("${activeLocalHeroBackground.src}")`);
  document.body.style.setProperty("--local-page-bg-pos-x", activeLocalHeroBackground.desktopX);
  document.body.style.setProperty("--local-page-bg-pos-y", `${activeLocalHeroBackground.baseY}%`);
  return true;
}

let heroMotionFrame = 0;
let heroPointerX = 0;
let heroPointerY = 0;
let activeLocalHeroBackground = null;

function pickLocalHeroBackground() {
  if (!LOCAL_HERO_BACKGROUNDS.length) {
    return null;
  }
  const index = Math.floor(Math.random() * LOCAL_HERO_BACKGROUNDS.length);
  return LOCAL_HERO_BACKGROUNDS[index];
}

function updateHeroMotion() {
  if (!heroSectionEl) {
    return;
  }
  // 모바일에서는 주소창이 접혔다 펴지는 것만으로도 window.resize가 반복
  // 발생해서, 스크롤에 따라 배경/카드를 흔드는 시차 효과가 화면이 계속
  // 움찔거리는 버그처럼 보였다 — 모바일에서는 reduced-motion과 동일하게
  // 아예 정지시킨다.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || isMobileViewport()) {
    heroSectionEl.style.setProperty("--hero-shift", "0px");
    heroSectionEl.style.setProperty("--hero-tilt", "0deg");
    heroSectionEl.style.setProperty("--hero-sway", "0px");
    heroSectionEl.style.setProperty("--hero-bg-pan-x", "0px");
    heroSectionEl.style.setProperty("--hero-bg-pan-y", "0px");
    if (bodyEl?.classList.contains("local-background-preview") && activeLocalHeroBackground) {
      bodyEl.style.setProperty("--local-page-bg-pos-x", activeLocalHeroBackground.mobileX);
      bodyEl.style.setProperty("--local-page-bg-pos-y", activeLocalHeroBackground.mobileY);
    }
    return;
  }

  const rect = heroSectionEl.getBoundingClientRect();
  const viewportHeight = Math.max(window.innerHeight || 0, 1);
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const scrollRange = Math.max((document.documentElement.scrollHeight || 0) - viewportHeight, 1);
  const scrollProgress = Math.max(0, Math.min(1, scrollY / scrollRange));
  const centerOffset = (rect.top + rect.height * 0.5 - viewportHeight * 0.5) / viewportHeight;
  const clamped = Math.max(-1, Math.min(1, centerOffset));
  const shift = clamped * -8 + Math.sin(scrollY * 0.004) * 2.6;
  const tilt = clamped * -0.8 + Math.sin(scrollY * 0.005) * 0.32;
  const sway = Math.sin(scrollY * 0.005) * 5.5;
  const imagePanX = heroPointerX * 6;
  const imagePanY = heroPointerY * 4;
  const bgBaseY = activeLocalHeroBackground?.baseY ?? 56;
  const bgScrollRange = activeLocalHeroBackground?.scrollRange ?? 12;
  const bgPosY = bgBaseY + (scrollProgress * bgScrollRange);
  const mobileView = isMobileViewport();

  heroSectionEl.style.setProperty("--hero-shift", `${shift.toFixed(2)}px`);
  heroSectionEl.style.setProperty("--hero-tilt", `${tilt.toFixed(2)}deg`);
  heroSectionEl.style.setProperty("--hero-sway", `${sway.toFixed(2)}px`);
  heroSectionEl.style.setProperty("--hero-bg-pan-x", `${imagePanX.toFixed(2)}px`);
  heroSectionEl.style.setProperty("--hero-bg-pan-y", `${imagePanY.toFixed(2)}px`);
  if (bodyEl?.classList.contains("local-background-preview") && activeLocalHeroBackground) {
    bodyEl.style.setProperty(
      "--local-page-bg-pos-x",
      mobileView ? activeLocalHeroBackground.mobileX : activeLocalHeroBackground.desktopX,
    );
    bodyEl.style.setProperty(
      "--local-page-bg-pos-y",
      mobileView ? activeLocalHeroBackground.mobileY : `${bgPosY.toFixed(2)}%`,
    );
  }
}

function scheduleHeroMotion() {
  if (heroMotionFrame) {
    return;
  }
  heroMotionFrame = requestAnimationFrame(() => {
    heroMotionFrame = 0;
    updateHeroMotion();
  });
}

function bindHeroMotion() {
  if (!heroSectionEl || heroSectionEl.dataset.motionBound === "true") {
    return;
  }
  heroSectionEl.dataset.motionBound = "true";
  window.addEventListener("scroll", scheduleHeroMotion, { passive: true });
  window.addEventListener("resize", scheduleHeroMotion);
  window.addEventListener("pointermove", (event) => {
    const viewportWidth = Math.max(window.innerWidth || 1, 1);
    const viewportHeight = Math.max(window.innerHeight || 1, 1);
    heroPointerX = ((event.clientX / viewportWidth) - 0.5) * 2;
    heroPointerY = ((event.clientY / viewportHeight) - 0.5) * 2;
    scheduleHeroMotion();
  }, { passive: true });
  window.addEventListener("pointerleave", () => {
    heroPointerX = 0;
    heroPointerY = 0;
    scheduleHeroMotion();
  });
  updateHeroMotion();
}

// 모바일 하단 탭바(홈/일정/노래책) — 아래로 스크롤하면 숨겨서 화면을 더
// 넓게 쓰고, 위로 스크롤하면 다시 보여준다(인스타그램/트위터 패턴).
// 데스크톱은 세로 사이드 네비라서 대상이 아니다.
let navAutoHideFrame = 0;
let navAutoHideLastY = 0;

function updateMobileNavVisibility() {
  if (!sideNavEl) {
    return;
  }
  if (!isMobileViewport()) {
    sideNavEl.classList.remove("is-nav-hidden");
    navAutoHideLastY = window.scrollY || 0;
    return;
  }
  const currentY = window.scrollY || window.pageYOffset || 0;
  const delta = currentY - navAutoHideLastY;
  if (currentY <= 8) {
    sideNavEl.classList.remove("is-nav-hidden");
  } else if (delta > 6) {
    sideNavEl.classList.add("is-nav-hidden");
  } else if (delta < -6) {
    sideNavEl.classList.remove("is-nav-hidden");
  }
  navAutoHideLastY = currentY;
}

function scheduleMobileNavVisibility() {
  if (navAutoHideFrame) {
    return;
  }
  navAutoHideFrame = requestAnimationFrame(() => {
    navAutoHideFrame = 0;
    updateMobileNavVisibility();
  });
}

function bindMobileNavAutoHide() {
  if (!sideNavEl) {
    return;
  }
  navAutoHideLastY = window.scrollY || 0;
  window.addEventListener("scroll", scheduleMobileNavVisibility, { passive: true });
  window.addEventListener("resize", scheduleMobileNavVisibility);
}

function playPanelEnter(el) {
  if (!el) {
    return;
  }
  el.classList.remove("panel-enter");
  void el.offsetWidth;
  el.classList.add("panel-enter");
}

function syncSideNav() {
  const showHero = !state.viewerOpen && !state.songbookOpen && !state.gameOpen;
  const heroWasHidden = heroSectionEl?.classList.contains("hidden");
  heroSectionEl?.classList.toggle("hidden", !showHero);
  if (showHero && heroWasHidden) {
    playPanelEnter(heroSectionEl);
  }

  if (!sideNavItemEls.length) {
    return;
  }
  const active = state.gameOpen ? "game" : state.songbookOpen ? "songbook" : state.viewerOpen ? "calendar" : "home";
  bodyEl.dataset.page = active;
  sideNavItemEls.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.nav === active);
  });
}

function goHome() {
  setSongbookOpen(false);
  setViewerOpen(false);
  setGameOpen(false);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setViewerOpen(nextOpen) {
  const wasHidden = viewerShellEl.classList.contains("hidden");
  state.viewerOpen = nextOpen;
  viewerShellEl.classList.toggle("hidden", !nextOpen);
  if (!nextOpen) {
    closeEditor();
  } else if (wasHidden) {
    playPanelEnter(viewerShellEl);
  }
  syncSideNav();
}

function setSongbookOpen(nextOpen) {
  const wasHidden = songbookShellEl.classList.contains("hidden");
  if (nextOpen && wasHidden) {
    playPanelEnter(songbookShellEl);
  }
  state.songbookOpen = nextOpen;
  songbookShellEl.classList.toggle("hidden", !nextOpen);
  syncSideNav();
}

function setGameOpen(nextOpen) {
  if (!gameShellEl) {
    return;
  }
  const wasHidden = gameShellEl.classList.contains("hidden");
  if (nextOpen && wasHidden) {
    playPanelEnter(gameShellEl);
  }
  state.gameOpen = nextOpen;
  gameShellEl.classList.toggle("hidden", !nextOpen);
  syncSideNav();
  if (nextOpen) {
    initPinballGame();
  }
}

function openGame() {
  setViewerOpen(false);
  setSongbookOpen(false);
  setGameOpen(true);
  window.scrollTo({ top: 0, behavior: "auto" });
}

// 홈의 일정 카드 — 오늘 방송이 있으면 오늘을, 없거나(휴방/미등록) 이미 지난
// 경우엔 앞으로 가장 가까운 방송일(다음 달까지)을 "다음 일정"으로 보여준다.
// 시간은 정해진 경우(예: "뱅온 [6PM]")에만 표시한다 — 미정인 날이 대부분이라
// "시간 미정" 문구는 쓰지 않는다.
const HOME_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function homeDayEntries(day) {
  return (day?.entries || [])
    .map((item) => ({ text: String(item.text || "").trim(), color: item.categoryColor || "", label: item.categoryLabel || "" }))
    .filter((item) => item.text);
}

function findNextScheduledDay(today, includeNextMonth = true) {
  const months = [
    { year: today.year, month: today.month, data: state.homeMonthData || currentBaseMonth(today.year, today.month), fromDay: today.day + 1 },
  ];
  const nextMonth = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 };
  if (includeNextMonth) months.push({ ...nextMonth, data: state.homeNextMonthData || currentBaseMonth(nextMonth.year, nextMonth.month), fromDay: 1 });
  for (const entry of months) {
    const days = [...(entry.data?.days || [])].sort((a, b) => Number(a.day) - Number(b.day));
    const found = days.find((day) => Number(day.day) >= entry.fromDay && !day.isOff && homeDayEntries(day).length);
    if (found) return { year: entry.year, month: entry.month, day: found };
  }
  return null;
}

function homeDateLabel(year, month, dayNumber, today) {
  const weekday = HOME_WEEKDAYS[new Date(year, month - 1, dayNumber).getDay()];
  const diff = Math.round((Date.UTC(year, month - 1, dayNumber) - Date.UTC(today.year, today.month - 1, today.day)) / 86400000);
  const relative = diff === 0 ? "오늘" : diff === 1 ? "내일" : diff === 2 ? "모레" : `${diff}일 후`;
  return `${month}월 ${dayNumber}일 (${weekday}) · ${relative}`;
}

function revealHomeAgendaChange(element) {
  if (!element?.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(
    [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 380, easing: "cubic-bezier(.22, 1, .36, 1)" }
  );
}

function revealHomeAgendaLiveTitle(element) {
  if (!element?.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(
    [
      { height: "0px", marginTop: "-16px", opacity: 0, transform: "translateY(5px)" },
      { height: `${element.scrollHeight}px`, marginTop: "-8px", opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 850, easing: "cubic-bezier(.22, 1, .36, 1)" }
  );
}

function setHomeAgendaText(element, value) {
  if (!element || element.textContent === value) return;
  element.textContent = value;
  if (value) revealHomeAgendaChange(element);
}

let homeAgendaListHtml = null;
function setHomeAgendaList(html) {
  if (!homeAgendaListEl || homeAgendaListHtml === html) return;
  homeAgendaListHtml = html;
  homeAgendaListEl.innerHTML = html;
  if (!document.body.classList.contains("is-intro") && !html.includes("home-agenda-loading")) {
    revealHomeAgendaChange(homeAgendaListEl);
  }
}

function renderHomeAgenda() {
  if (!homeAgendaListEl) return;
  const today = todayKstParts();
  const todayKey = `${monthKey(today.year, today.month)}-${String(today.day).padStart(2, "0")}`;
  const preview = state.homeAgendaPreview?.date === todayKey ? state.homeAgendaPreview : null;
  if (state.homeMonthPending && !preview) {
    renderHomeAgendaLoading("오늘 방송");
    return;
  }
  const month = state.homeMonthData || currentBaseMonth(today.year, today.month);
  const todayDay = state.homeMonthPending
    ? preview.today?.day
    : month?.days?.find((item) => Number(item.day) === today.day);
  const todayEntries = homeDayEntries(todayDay);
  const live = currentLive();
  const showLive = Boolean(live.isLive && state.homeIntroFinished);
  let label = "오늘 방송";
  let target = { year: today.year, month: today.month, day: todayDay };
  let note = "";
  if (live.isLive) {
    note = showLive ? live.liveTitle || "" : "";
  } else if (todayDay?.isOff || !todayEntries.length) {
    let next;
    if (state.homeMonthPending) {
      next = preview.next;
    } else if (state.homeNextMonthPending && preview) {
      const currentNext = findNextScheduledDay(today, false);
      next = currentNext || (preview.next?.month !== today.month || preview.next?.year !== today.year ? preview.next : null);
    } else {
      next = findNextScheduledDay(today);
    }
    label = "다음 일정";
    note = todayDay?.isOff ? "오늘은 휴뱅이에요" : "";
    target = next || null;
    if (!target && state.homeNextMonthPending && !preview) {
      renderHomeAgendaLoading(label);
      return;
    }
  }
  homeAgendaEl?.classList.toggle("is-live", showLive);
  homeAgendaEl?.classList.toggle("is-next", label === "다음 일정");
  setHomeAgendaText(homeAgendaLabelEl, label);
  const liveMarkWasHidden = homeAgendaLiveMarkEl?.classList.contains("hidden");
  homeAgendaLiveMarkEl?.classList.toggle("hidden", !showLive);
  if (showLive && liveMarkWasHidden) revealHomeAgendaChange(homeAgendaLiveMarkEl);
  if (homeAgendaNoteEl) {
    const noteChanged = homeAgendaNoteEl.textContent !== note;
    const noteWasHidden = homeAgendaNoteEl.classList.contains("hidden");
    homeAgendaNoteEl.textContent = note;
    homeAgendaNoteEl.classList.toggle("hidden", !note);
    if (note && (noteChanged || noteWasHidden)) {
      if (showLive && noteWasHidden) revealHomeAgendaLiveTitle(homeAgendaNoteEl);
      else revealHomeAgendaChange(homeAgendaNoteEl);
    }
  }
  if (!target?.day) {
    setHomeAgendaText(homeAgendaDateEl, "");
    setHomeAgendaList('<li class="home-agenda-empty">예정된 일정이 아직 없어요</li>');
    setHomeAgendaTime("");
    return;
  }
  const dayNumber = Number(target.day.day);
  setHomeAgendaText(homeAgendaDateEl, homeDateLabel(target.year, target.month, dayNumber, today));
  const entries = homeDayEntries(target.day);
  setHomeAgendaList(entries.length
    ? entries.map((item) => {
      const [first, ...rest] = item.text.split("\n");
      return `<li class="home-agenda-item" style="--dot:${escapeHtml(item.color || "#c4b5fd")}"><span class="home-agenda-text"><strong>${escapeHtml(first)}</strong>${rest.length ? `<small>${escapeHtml(rest.join(" "))}</small>` : ""}</span>${item.label ? `<span class="home-agenda-cat">${escapeHtml(item.label)}</span>` : ""}</li>`;
    }).join("")
    : '<li class="home-agenda-empty">방송 중이에요</li>');
  setHomeAgendaTime(String(target.day.timeLabel || "").trim());
}

function setHomeAgendaTime(value) {
  if (!homeAgendaTimeEl) return;
  homeAgendaTimeEl.textContent = value;
  homeAgendaTimeEl.parentElement?.classList.toggle("hidden", !value);
}

function renderHomeAgendaLoading(label) {
  homeAgendaEl?.classList.remove("is-live");
  homeAgendaEl?.classList.toggle("is-next", label === "다음 일정");
  if (homeAgendaLabelEl) homeAgendaLabelEl.textContent = label;
  homeAgendaLiveMarkEl?.classList.add("hidden");
  if (homeAgendaDateEl) homeAgendaDateEl.textContent = "";
  if (homeAgendaNoteEl) homeAgendaNoteEl.classList.add("hidden");
  setHomeAgendaList('<li class="home-agenda-empty home-agenda-loading">일정 확인 중</li>');
  setHomeAgendaTime("");
}

function renderAuth() {
  const auth = currentAuth();
  if (!auth) {
    renderVersionHistoryTrigger();
    return;
  }

  renderVersionHistoryTrigger();

  if (auth.signedIn) {
    logoutButtonEl.classList.remove("hidden");
    googleSigninEl.classList.add("hidden");
    showAuthMessage(state.authStatusMessage);
    return;
  }

  if (!auth.googleEnabled) {
    logoutButtonEl.classList.add("hidden");
    googleSigninEl.classList.add("hidden");
    showAuthMessage(auth.readOnlyReason || "로그인 설정 필요");
    return;
  }

  logoutButtonEl.classList.add("hidden");
  googleSigninEl.classList.remove("hidden");
  showAuthMessage(state.authStatusMessage);
}

function renderHeroCurrentMonth() {
  if (openCurrentMonthEl) openCurrentMonthEl.disabled = false;
}

function renderMonthPager() {
  const bounds = calendarBounds();
  const monthText = String(state.selectedMonth).padStart(2, "0");
  yearTitleEl.innerHTML = `<span class="nav-title-full">${escapeHtml(formatYearTitle(state.selectedYear))}</span><span class="nav-title-compact">${escapeHtml(String(state.selectedYear).slice(-2))}년</span>`;
  monthTitleEl.innerHTML = `<span class="nav-title-full">${escapeHtml(formatMonthLabel(state.selectedMonth))}</span><span class="nav-title-compact">${escapeHtml(monthText)}월</span>`;
  yearPrevEl.disabled = state.selectedYear <= bounds.minYear;
  yearNextEl.disabled = state.selectedYear >= bounds.maxYear;
  monthPrevEl.disabled = state.selectedYear <= bounds.minYear && state.selectedMonth <= 1;
  monthNextEl.disabled = state.selectedYear >= bounds.maxYear && state.selectedMonth >= 12;
}

function renderLegend() {
  legendEl.innerHTML = (state.bootstrap?.legend || [])
    .map(
      (item) => `
        <div class="legend-pill">
          <span class="legend-dot" style="background:${escapeHtml(item.color)}"></span>
          <span>${escapeHtml(item.label)}</span>
        </div>
      `
    )
    .join("");
}

function renderProfile() {
  const live = currentLive();
  profileAvatarMiniEl.src = state.bootstrap?.profileAvatarUrl || DEFAULT_AVATAR;
  profileNameEl.textContent = live.channelName || "빈스";
  if (profileBioEl) {
    profileBioEl.textContent = live.bio || "알다가도 모를 까마귀";
  }
  chzzkLinkEl.href = live.channelUrl || state.bootstrap?.links?.chzzkChannelUrl || "#";
  youtubeLinkEl.href = state.bootstrap?.links?.youtubeChannelUrl || "#";
  cafeLinkEl.href = state.bootstrap?.links?.cafeUrl || "#";
}

function renderLiveStatus() {
  const live = currentLive();
  renderHomeAgenda();
  livePillEl.classList.toggle("online", !!live.isLive);
  livePillEl.classList.toggle("offline", !live.isLive);
  livePillEl.textContent = live.isLive ? "LIVE" : "OFFLINE";
  if (live.isLive) {
    liveSummaryEl.textContent = live.liveTitle || "지금 방송 중";
    liveSummaryEl.title = live.liveTitle || "지금 방송 중";
    return;
  }
  if (live.available || live.stale) {
    liveSummaryEl.textContent = "방송 준비 중...";
    liveSummaryEl.title = "방송 준비 중...";
    return;
  }
  liveSummaryEl.textContent = "방송 상태 확인 중";
  liveSummaryEl.title = "방송 상태 확인 중";
}

function normalizeCafeNotice(payload) {
  const item = payload?.item || payload || null;
  const title = String(item?.title || "").trim();
  const url = String(item?.url || "").trim();
  const articleId = Number(item?.articleId || 0);
  if (!title || !url || !Number.isFinite(articleId) || articleId <= 0) {
    return null;
  }
  return { articleId, title, url };
}

function renderCafeNotice() {
  if (!cafeNoticeLinkEl) {
    return;
  }
  const notice = state.cafeNotice;
  if (!notice?.title || !notice?.url) {
    cafeNoticeLinkEl.classList.add("hidden");
    cafeNoticeLinkEl.removeAttribute("title");
    cafeNoticeLinkEl.innerHTML = "";
    cafeNoticeLinkEl.href = "#";
    return;
  }
  cafeNoticeLinkEl.classList.remove("hidden");
  cafeNoticeLinkEl.href = notice.url;
  cafeNoticeLinkEl.title = notice.title;
  cafeNoticeLinkEl.innerHTML = `
    <span class="calendar-notice-badge">공지</span>
    <span class="calendar-notice-title">${escapeHtml(notice.title)}</span>
  `;
}

function renderYoutube() {
  if (!state.youtubeItems.length) {
    youtubeCardsEl.innerHTML = '<p class="status-copy">최신 영상을 아직 불러오지 못했습니다.</p>';
    return;
  }

  youtubeCardsEl.innerHTML = state.youtubeItems
    .map(
      (item) => `
        <a class="video-card" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
          <img class="video-thumb" src="${escapeHtml(resolveYoutubeThumbnail(item))}" alt="${escapeHtml(item.title)}">
          <div>
            <h4 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
            <p class="video-meta">${item.isShort ? "Shorts" : "영상"} · ${escapeHtml(formatKoreanDate(item.publishedAt) || "게시일 미상")}</p>
          </div>
        </a>
      `
    )
    .join("");
}

async function refreshLiveStatus() {
  if (state.liveFetchInFlight) {
    return;
  }
  state.liveFetchInFlight = true;
  try {
    const payload = await fetchJson(apiUrl("/api/live-status"));
    state.liveStatus = { ...buildDefaultLiveStatus(), ...payload };
  } catch {
    state.liveStatus = buildDefaultLiveStatus();
  } finally {
    state.liveFetchInFlight = false;
    renderProfile();
    renderLiveStatus();
  }
}

async function refreshCafeNotice() {
  if (state.cafeNoticeFetchInFlight) {
    return;
  }
  state.cafeNoticeFetchInFlight = true;
  try {
    const payload = await fetchJson(apiUrl("/api/cafe/notice"));
    const nextNotice = normalizeCafeNotice(payload);
    if (nextNotice) {
      state.cafeNotice = nextNotice;
    }
  } catch {
    // Keep the last successfully rendered notice instead of flashing empty state.
  } finally {
    state.cafeNoticeFetchInFlight = false;
    renderCafeNotice();
  }
}

async function refreshYoutubeItems() {
  if (state.youtubeFetchInFlight) {
    return;
  }
  state.youtubeFetchInFlight = true;
  try {
    const payload = await fetchJson(apiUrl(YOUTUBE_API_URL));
    applyYoutubePayload(payload);
    scheduleYoutubeRefresh(payload?.nextPollMs);
  } catch {
    scheduleYoutubeRefresh();
  } finally {
    state.youtubeFetchInFlight = false;
    renderYoutube();
  }
}

function createSongId() {
  return `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nextSongNumber(items = state.songbookItems) {
  const maxNumber = items.reduce((max, item) => {
    const value = Number.parseInt(String(item.number || "").trim(), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return String(maxNumber + 1);
}

function filteredSongItems(sourceItems = state.songbookItems) {
  const titleQuery = state.selectedSongQuery.trim().toLowerCase();
  const artistQuery = state.selectedSongArtistQuery.trim().toLowerCase();
  const categoryQuery = state.selectedSongCategoryQuery.trim();
  const tagQuery = state.selectedSongTagQuery.trim();
  const activeFilterTags = Array.isArray(state.selectedSongTags) ? state.selectedSongTags : [];
  return sourceItems.filter((item) => {
    const title = String(item.title || "").toLowerCase();
    const originalTitle = String(item.originalTitle || "").toLowerCase();
    const artist = String(item.artist || "").toLowerCase();
    const category = String(item.category || "");
    const tags = normalizeSongTags(item.tags || []);
    if (titleQuery && !title.includes(titleQuery) && !originalTitle.includes(titleQuery)) {
      return false;
    }
    if (artistQuery && !artist.includes(artistQuery)) {
      return false;
    }
    if (categoryQuery && category !== categoryQuery) {
      return false;
    }
    if (tagQuery && !tags.includes(tagQuery)) {
      return false;
    }
    if (activeFilterTags.length && !activeFilterTags.some((tag) => tags.includes(tag))) {
      return false;
    }
    return true;
  });
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function songbookItemsPerPage() {
  // 모바일은 한 화면에 다 들어오게 해달라는 피드백에 따라, 접힌 한 줄짜리
  // 곡 행 기준으로 스크롤 없이 보이는 개수(대략 8개)로 줄였다.
  return isMobileViewport() ? 8 : 12;
}

function totalSongbookPages(items) {
  const pageSize = songbookItemsPerPage();
  if (!Number.isFinite(pageSize)) {
    return 1;
  }
  return Math.max(1, Math.ceil(items.length / pageSize));
}

function clampSongbookPage(totalPages, requestedPage = state.songbookPage) {
  const numericPage = Number.parseInt(String(requestedPage || 1), 10);
  return Math.min(Math.max(Number.isFinite(numericPage) ? numericPage : 1, 1), Math.max(totalPages, 1));
}

function hasActiveSongSearch() {
  return Boolean(
    state.selectedSongQuery.trim() ||
      state.selectedSongArtistQuery.trim() ||
      state.selectedSongCategoryQuery.trim() ||
      state.selectedSongTagQuery.trim() ||
      (Array.isArray(state.selectedSongTags) && state.selectedSongTags.length),
  );
}

const SONG_TAG_FILTER_COLLAPSED_COUNT = 2;

function renderSongFilters() {
  if (!songTagFilterBarEl) {
    return;
  }
  const activeTags = Array.isArray(state.selectedSongTags) ? state.selectedSongTags : [];
  const filterTags = ["", ...(state.songbookTags || [])];

  const renderChip = (tag) => {
    const isActive = tag ? activeTags.includes(tag) : activeTags.length === 0;
    if (!tag) {
      return `<button type="button" class="song-tag-filter-chip ${isActive ? "active" : ""}" data-song-tag-filter="" aria-pressed="${isActive ? "true" : "false"}">전체</button>`;
    }
    return `
      <button
        type="button"
        class="song-tag-filter-chip${songTagClassName(tag)} ${isActive ? "active" : ""}"
        data-song-tag-filter="${escapeHtml(tag)}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        <span class="song-tag-filter-check" aria-hidden="true">✓</span>
        ${renderSongTagLabel(tag)}
      </button>
    `;
  };

  // 태그가 많을 때 가로 스크롤 줄이 정신없다는 피드백에 따라, "모바일 화면"에서만
  // 기본으로 앞쪽 몇 개만 한 줄로 보여주고 "더보기"를 누르면 나머지가 줄바꿈돼
  // 펼쳐지도록 했다 — PC(데스크톱)는 원래대로 태그를 전부 그대로 보여준다.
  // 접힌 상태는 태그 글자 길이에 따라 개수를 맞추기 어려워서, CSS에서
  // overflow:hidden + 한 줄 고정으로 한 번 더 안전하게 잘라준다(.is-collapsed).
  const isMobile = isMobileViewport();
  const expanded = Boolean(state.songTagFilterExpanded);
  const hasOverflow = isMobile && filterTags.length > SONG_TAG_FILTER_COLLAPSED_COUNT;
  const visibleTags = expanded || !hasOverflow ? filterTags : filterTags.slice(0, SONG_TAG_FILTER_COLLAPSED_COUNT);

  const chipsHtml = visibleTags.map(renderChip).join("");
  const toggleHtml = hasOverflow
    ? `<button type="button" class="song-tag-filter-chip song-tag-filter-toggle" data-song-tag-toggle>${expanded ? "접기 ▴" : "더보기 ▾"}</button>`
    : "";

  songTagFilterBarEl.innerHTML = chipsHtml + toggleHtml;
  songTagFilterBarEl.classList.toggle("is-collapsed", isMobile && !expanded);
}

function renderSongSearchModalOptions() {
  if (!songSearchCategoryEl) {
    return;
  }
  const categories = ["", ...(state.songbookCategories || [])];
  const tags = ["", ...(state.songbookTags || [])];
  const currentCategory = state.selectedSongCategoryQuery;
  const currentTag = state.selectedSongTagQuery;
  songSearchCategoryEl.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category || "전체")}</option>`)
    .join("");
  songSearchCategoryEl.value = categories.includes(currentCategory) ? currentCategory : "";
  if (songSearchTagEl) {
    songSearchTagEl.innerHTML = tags
      .map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(songTagOptionLabel(tag))}</option>`)
      .join("");
    songSearchTagEl.value = tags.includes(currentTag) ? currentTag : "";
  }
  if (songSearchTitleEl) {
    songSearchTitleEl.value = state.selectedSongQuery;
  }
  if (songSearchArtistEl) {
    songSearchArtistEl.value = state.selectedSongArtistQuery;
  }
}

function renderSongSearchResetButton() {
  if (!songSearchResetButtonEl) {
    return;
  }
  songSearchResetButtonEl.classList.toggle("hidden", !hasActiveSongSearch());
}

function buildSongTagSuggestionValues(currentValue = "") {
  const rawTokens = String(currentValue || "").split(",");
  const committed = normalizeSongTags(rawTokens.slice(0, -1));
  const currentToken = String(rawTokens.at(-1) || "").replace(/^#+/, "").trim().toLowerCase();
  const prefix = committed.length ? `${committed.join(", ")}, ` : "";
  return (state.songbookTags || [])
    .filter((tag) => !committed.some((savedTag) => savedTag.toLowerCase() === tag.toLowerCase()))
    .filter((tag) => !currentToken || tag.toLowerCase().includes(currentToken))
    .slice(0, 12)
    .map((tag) => `${prefix}${tag}`);
}

function renderSongTagSuggestions(currentValue = "") {
  if (!songTagSuggestionsEl) {
    return;
  }
  songTagSuggestionsEl.innerHTML = buildSongTagSuggestionValues(currentValue)
    .map((tagValue) => `<option value="${escapeHtml(tagValue)}"></option>`)
    .join("");
}

function setSongEditorStatus(message = "", isError = false) {
  if (!songEditorStatusEl) {
    return;
  }
  songEditorStatusEl.textContent = String(message || "").trim();
  songEditorStatusEl.classList.toggle("error", Boolean(isError && message));
}

function renderSongEditor() {
  if (!songbookEditorEl || !songCategoryInputEl) {
    return;
  }

  const canEdit = Boolean(currentAuth()?.canEdit);
  songbookEditorEl.classList.toggle("hidden", !canEdit);
  renderSongTagSuggestions();
  if (!canEdit) {
    setSongEditorStatus("");
    return;
  }

  const currentValue = songCategoryInputEl.value;
  const categories = state.songbookCategories || [];
  songCategoryInputEl.innerHTML = [
    '<option value="">분류 선택</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");

  if (categories.includes(currentValue)) {
    songCategoryInputEl.value = currentValue;
  }
}

function resetSongEditorForm() {
  if (songTitleInputEl) {
    songTitleInputEl.value = "";
  }
  if (songOriginalTitleInputEl) {
    songOriginalTitleInputEl.value = "";
  }
  if (songArtistInputEl) {
    songArtistInputEl.value = "";
  }
  if (songTagInputEl) {
    songTagInputEl.value = "";
  }
  if (songCategoryInputEl) {
    songCategoryInputEl.value = "";
  }
}

function clearSongUndo() {
  state.songUndo = null;
  if (songUndoBarEl) {
    songUndoBarEl.classList.add("hidden");
  }
}

function showSongUndo(item, index, anchorTop = null) {
  if (!songUndoBarEl || !songUndoTextEl) {
    return;
  }
  clearSongUndo();
  state.songUndo = { item: { ...item }, index, anchorTop };
  songUndoTextEl.textContent = `${item.number || ""} ${item.title || "곡"} 삭제됨`;
  if (anchorTop != null) {
    songUndoBarEl.style.top = `${Math.max(112, anchorTop)}px`;
  } else {
    songUndoBarEl.style.removeProperty("top");
  }
  songUndoBarEl.classList.remove("hidden");
}

function buildSongRow(item, index) {
  const canEdit = Boolean(currentAuth()?.canEdit);
  const isEditing = canEdit && state.editingSongId === item.id;
  const isEditOpen = canEdit && state.revealedSongActionId === item.id && state.revealedSongActionDirection === "edit";
  const isDeleteOpen = canEdit && state.revealedSongActionId === item.id && state.revealedSongActionDirection === "delete";
  const title = escapeHtml(item.title || "");
  const originalTitle = escapeHtml(item.originalTitle || "");
  const artist = escapeHtml(item.artist || "");
  const category = escapeHtml(item.category || "");
  const tagInputValue = escapeHtml(tagsToInputValue(item.tags || []));
  const tagChips = normalizeSongTags(item.tags || [])
    .map((tag) => `<span class="song-tag-chip${songTagClassName(tag)}">${renderSongTagLabel(tag)}</span>`)
    .join("");

  if (isEditing) {
    const categoryOptions = ["", ...(state.songbookCategories || [])]
      .map((value) => `<option value="${escapeHtml(value)}" ${value === item.category ? "selected" : ""}>${escapeHtml(value || "분류 없음")}</option>`)
      .join("");
    return `
      <div class="song-item song-item-editing" data-song-index="${index}" data-song-id="${escapeHtml(item.id)}">
        <span class="song-cell song-number-cell">${escapeHtml(item.number || "")}</span>
        <span class="song-cell"><input class="song-inline-input" data-song-edit-field="title" value="${title}"></span>
        <span class="song-cell"><input class="song-inline-input" data-song-edit-field="originalTitle" value="${originalTitle}"></span>
        <span class="song-cell"><input class="song-inline-input" data-song-edit-field="artist" value="${artist}"></span>
        <span class="song-cell">
          <div class="song-inline-tail">
            <select class="song-inline-input song-inline-select" data-song-edit-field="category">${categoryOptions}</select>
          </div>
        </span>
        <span class="song-cell song-inline-last">
          <div class="song-inline-actions">
            <button type="button" class="song-inline-button save" data-song-save>저장</button>
            <button type="button" class="song-inline-button cancel" data-song-cancel>취소</button>
          </div>
        </span>
        <label class="song-inline-tags-row">
          <span class="song-inline-tags-label">태그</span>
          <input class="song-inline-input" data-song-edit-field="tags" data-song-tag-field list="song-tag-suggestions" value="${tagInputValue}" placeholder="쉼표로 구분">
        </label>
      </div>
    `;
  }

  return `
    <div class="song-item ${canEdit ? "song-item-draggable" : ""} ${isEditOpen ? "song-action-open song-action-open-edit" : ""} ${isDeleteOpen ? "song-action-open song-action-open-delete" : ""}" data-song-index="${index}" data-song-id="${escapeHtml(item.id)}">
      <div class="song-swipe-action-wrap song-swipe-action-wrap-edit">
        <button type="button" class="song-swipe-action edit" data-song-edit-trigger>편집</button>
      </div>
      <div class="song-swipe-action-wrap song-swipe-action-wrap-delete">
        <button type="button" class="song-swipe-action delete" data-song-delete-trigger>삭제</button>
      </div>
      <div class="song-item-content">
        <span class="song-title-row">
          <span class="song-cell song-number-cell">${escapeHtml(item.number || "")}</span>
          <span class="song-cell song-title-block">
            <strong class="song-title-cell" title="${title}">${title || "-"}</strong>
          </span>
        </span>
        <span class="song-cell" title="${originalTitle}">${originalTitle || "-"}</span>
        <span class="song-cell" title="${artist}">${artist || "-"}</span>
        <span class="song-cell" title="${category}">${category || "-"}</span>
        <span class="song-cell song-tags-cell">${tagChips || '<span class="song-tags-empty">-</span>'}</span>
      </div>
    </div>
  `;
}

function renderSongPagination(items) {
  if (!songPaginationEl) {
    return;
  }
  const pageSize = songbookItemsPerPage();
  const totalPages = totalSongbookPages(items);
  if (!Number.isFinite(pageSize) || totalPages <= 1) {
    songPaginationEl.classList.add("hidden");
    songPaginationEl.innerHTML = "";
    return;
  }
  state.songbookPage = clampSongbookPage(totalPages);
  // PC는 화면 폭이 넉넉해서 페이지 번호를 5개까지 보여준다 — 모바일은 기존처럼 3개.
  const pageWindowSize = isMobileViewport() ? 3 : 5;
  const halfWindow = Math.floor(pageWindowSize / 2);
  let startPage = Math.max(1, state.songbookPage - halfWindow);
  let endPage = Math.min(totalPages, startPage + pageWindowSize - 1);
  startPage = Math.max(1, endPage - pageWindowSize + 1);
  songPaginationEl.classList.remove("hidden");
  songPaginationEl.innerHTML = `
    <button type="button" class="song-pagination-button song-pagination-arrow" data-song-page="1" ${state.songbookPage <= 1 ? "disabled" : ""}>«</button>
    <button type="button" class="song-pagination-button song-pagination-arrow" data-song-page-nav="-1" ${state.songbookPage <= 1 ? "disabled" : ""}>‹</button>
    <div class="song-pagination-pages">
      ${Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
        .map((page) => `
          <button
            type="button"
            class="song-pagination-button ${page === state.songbookPage ? "is-active" : ""}"
            data-song-page="${page}"
            aria-current="${page === state.songbookPage ? "page" : "false"}"
          >${page}</button>
        `)
        .join("")}
    </div>
    <button type="button" class="song-pagination-button song-pagination-arrow" data-song-page-nav="1" ${state.songbookPage >= totalPages ? "disabled" : ""}>›</button>
    <button type="button" class="song-pagination-button song-pagination-arrow" data-song-page="${totalPages}" ${state.songbookPage >= totalPages ? "disabled" : ""}>»</button>
  `;
}

function renderSongResults(items) {
  const pageSize = songbookItemsPerPage();
  const totalPages = totalSongbookPages(items);
  state.songbookPage = clampSongbookPage(totalPages);
  const visibleItems = Number.isFinite(pageSize)
    ? items.slice((state.songbookPage - 1) * pageSize, state.songbookPage * pageSize)
    : items.slice();
  state.renderedSongs = visibleItems.slice();
  renderSongPagination(items);
  if (!state.renderedSongs.length) {
    songResultsEl.innerHTML = '<p class="status-copy">해당 조건의 노래가 없습니다.</p>';
    return;
  }

  songResultsEl.innerHTML = state.renderedSongs.map((item, index) => buildSongRow(item, index)).join("");
}

function refreshSongbook() {
  renderSongFilters();
  renderSongEditor();
  renderSongSearchModalOptions();
  renderSongSearchResetButton();
  renderSongResults(filteredSongItems());
}

function resetSongSearch() {
  state.selectedSongQuery = "";
  state.selectedSongArtistQuery = "";
  state.selectedSongCategoryQuery = "";
  state.selectedSongTagQuery = "";
  state.selectedSongTags = [];
  state.songbookPage = 1;
  refreshSongbook();
}

function goToSongbookPage(page) {
  state.songbookPage = clampSongbookPage(totalSongbookPages(filteredSongItems()), page);
  refreshSongbook();
}

async function persistSongbook(items, successMessage = "") {
  const ref = songbookDocRef();
  if (!ref) {
    throw new Error("Firebase 노래책 설정이 필요합니다.");
  }
  const normalizedItems = normalizeSongbookItems(items);
  if (!normalizedItems.length) {
    throw new Error("최소 한 곡은 남아 있어야 합니다.");
  }
  await ref.set(
    {
      items: normalizedItems,
      updatedAt: firestoreTimestamp(),
    },
    { merge: true }
  );
  state.songbookItems = normalizedItems;
  const meta = deriveSongbookMeta(normalizedItems);
  state.songbookCategories = meta.categories;
  state.songbookArtists = meta.artists;
  state.songbookTags = meta.tags;
  state.editingSongId = "";
  state.revealedSongActionId = "";
  state.revealedSongActionDirection = "";
  if (state.bootstrap?.songbookSummary) {
    state.bootstrap.songbookSummary.count = normalizedItems.length;
    state.bootstrap.songbookSummary.categories = meta.categories.slice();
    state.bootstrap.songbookSummary.artists = meta.artists.slice();
  }
  if (successMessage) {
    setSongEditorStatus(successMessage);
  }
  refreshSongbook();
}

function startSongEdit(songId) {
  if (!currentAuth()?.canEdit) {
    return;
  }
  state.editingSongId = songId;
  refreshSongbook();
}

function cancelSongEdit() {
  state.editingSongId = "";
  refreshSongbook();
}

async function saveSongEdit(songId, rowEl) {
  if (!currentAuth()?.canEdit || !rowEl) {
    return;
  }
  const title = rowEl.querySelector('[data-song-edit-field="title"]')?.value.trim() || "";
  if (!title) {
    setSongEditorStatus("곡명은 비워둘 수 없습니다.", true);
    return;
  }

  const nextItems = state.songbookItems.map((item) => {
    if (item.id !== songId) {
      return item;
    }
    const tagField = rowEl.querySelector('[data-song-edit-field="tags"]');
    return {
      ...item,
      title,
      originalTitle: rowEl.querySelector('[data-song-edit-field="originalTitle"]')?.value.trim(),
      artist: rowEl.querySelector('[data-song-edit-field="artist"]')?.value.trim(),
      tags: normalizeSongTags(tagField ? tagField.value : ""),
      category: rowEl.querySelector('[data-song-edit-field="category"]')?.value.trim(),
    };
  });
  await persistSongbook(nextItems, "수정됐습니다.");
}

async function deleteSongItem(songId) {
  if (!currentAuth()?.canEdit) {
    return;
  }
  const rowEl = songResultsEl
    ? [...songResultsEl.querySelectorAll(".song-item")].find((item) => item.dataset.songId === songId) || null
    : null;
  const anchorTop = rowEl && songbookBoardEl
    ? rowEl.getBoundingClientRect().top - songbookBoardEl.getBoundingClientRect().top + (rowEl.getBoundingClientRect().height / 2) - 22
    : null;
  const deleteIndex = state.songbookItems.findIndex((item) => item.id === songId);
  if (deleteIndex < 0) {
    return;
  }
  const deletedItem = state.songbookItems[deleteIndex];
  const nextItems = state.songbookItems.filter((item) => item.id !== songId);
  if (!nextItems.length) {
    setSongEditorStatus("최소 한 곡은 남아 있어야 합니다.", true);
    return;
  }
  await persistSongbook(nextItems, "삭제됐습니다.");
  showSongUndo(deletedItem, deleteIndex, anchorTop);
}

async function undoDeletedSong() {
  if (!state.songUndo) {
    return;
  }
  const { item, index } = state.songUndo;
  clearSongUndo();
  const nextItems = state.songbookItems.slice();
  const insertIndex = Math.max(0, Math.min(index, nextItems.length));
  nextItems.splice(insertIndex, 0, item);
  await persistSongbook(nextItems, "복구됐습니다.");
}

function renderSongRandomResults(items, emptyMessage = "조건에 맞는 곡이 없습니다.") {
  if (!songRandomResultsEl) {
    return;
  }
  if (!items.length) {
    songRandomResultsEl.innerHTML = emptyMessage ? `<p class="status-copy">${escapeHtml(emptyMessage)}</p>` : "";
    return;
  }
  songRandomResultsEl.innerHTML = items
    .map(
      (item) => `
        <div class="song-random-item">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.artist || "아티스트 미상")} · ${escapeHtml(item.category || "분류 없음")}</p>
        </div>
      `
    )
    .join("");
}

function updateSongRandomCountBounds() {
  if (!songRandomCountEl) {
    return;
  }
  const category = songRandomCategoryEl?.value || "";
  const sourceItems = category ? state.songbookItems.filter((item) => item.category === category) : state.songbookItems;
  const maxCount = Math.max(1, sourceItems.length || 1);
  songRandomCountEl.max = String(maxCount);
  const currentValue = Number.parseInt(songRandomCountEl.value || "1", 10);
  const nextValue = Number.isFinite(currentValue) ? Math.min(maxCount, Math.max(1, currentValue)) : 1;
  songRandomCountEl.value = String(nextValue);
}

function updateModalScrollLock() {
  const hasOpenModal = getVisibleModalElements().length > 0;
  bodyEl.classList.toggle("modal-open", hasOpenModal);
}

function openSongRandomModal() {
  if (!songRandomModalEl || !songRandomCountEl) {
    return;
  }
  openModalElement(songRandomModalEl);
  updateSongRandomCountBounds();
  renderSongRandomResults([], "");
}

function closeSongRandomModal() {
  closeModalElement(songRandomModalEl);
}

function openSongSearchModal() {
  if (!songSearchModalEl) {
    return;
  }
  renderSongSearchModalOptions();
  openModalElement(songSearchModalEl);
}

function closeSongSearchModal() {
  closeModalElement(songSearchModalEl);
}

function pickRandomSongs(items, count) {
  const pool = items.slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

async function addSongbookItem() {
  if (!currentAuth()?.canEdit || !songTitleInputEl || !songAddButtonEl) {
    return;
  }

  const title = songTitleInputEl.value.trim();
  if (!title) {
    setSongEditorStatus("곡명을 입력해 주세요.", true);
    songTitleInputEl.focus();
    return;
  }

  songAddButtonEl.disabled = true;
  setSongEditorStatus("추가 중...");

  try {
    const nextItems = state.songbookItems.concat({
      id: createSongId(),
      number: nextSongNumber(),
      title,
      originalTitle: songOriginalTitleInputEl?.value.trim() || "",
      artist: songArtistInputEl?.value.trim() || "",
      tags: normalizeSongTags(songTagInputEl?.value || ""),
      category: songCategoryInputEl?.value.trim() || "",
      source: "custom",
    });
    state.songbookPage = totalSongbookPages(nextItems);
    await persistSongbook(nextItems, "추가됐습니다.");
    resetSongEditorForm();
  } catch (error) {
    setSongEditorStatus(error?.message || "노래 추가에 실패했습니다.", true);
  } finally {
    songAddButtonEl.disabled = false;
  }
}

const songSwipeState = {
  row: null,
  content: null,
  pointerId: 0,
  startX: 0,
  deltaX: 0,
};

function resetSongSwipe() {
  if (songSwipeState.content) {
    songSwipeState.content.style.removeProperty("transform");
  }
  if (songSwipeState.row) {
    songSwipeState.row.classList.remove("song-swiping", "song-swipe-delete", "song-swipe-edit");
  }
  songSwipeState.row = null;
  songSwipeState.content = null;
  songSwipeState.pointerId = 0;
  songSwipeState.startX = 0;
  songSwipeState.deltaX = 0;
}

function beginSongSwipe(event) {
  if (!currentAuth()?.canEdit) {
    return;
  }
  if (event.target.closest("input, select, button")) {
    return;
  }
  const row = event.target.closest(".song-item-draggable");
  if (!row) {
    return;
  }
  const content = row.querySelector(".song-item-content");
  if (!content) {
    return;
  }
  if (state.revealedSongActionId && state.revealedSongActionId !== row.dataset.songId) {
    state.revealedSongActionId = "";
    state.revealedSongActionDirection = "";
    refreshSongbook();
  }
  songSwipeState.row = row;
  songSwipeState.content = content;
  songSwipeState.pointerId = event.pointerId;
  songSwipeState.startX = event.clientX;
  songSwipeState.deltaX = 0;
  row.classList.add("song-swiping");
  row.setPointerCapture?.(event.pointerId);
}

function moveSongSwipe(event) {
  if (!songSwipeState.row || !songSwipeState.content || songSwipeState.pointerId !== event.pointerId) {
    return;
  }
  const deltaX = Math.max(-132, Math.min(132, event.clientX - songSwipeState.startX));
  songSwipeState.deltaX = deltaX;
  songSwipeState.content.style.transform = `translateX(${deltaX}px)`;
  songSwipeState.row.classList.toggle("song-swipe-delete", deltaX <= -54);
  songSwipeState.row.classList.toggle("song-swipe-edit", deltaX >= 54);
}

function endSongSwipe(event) {
  if (!songSwipeState.row || !songSwipeState.content || songSwipeState.pointerId !== event.pointerId) {
    return;
  }
  const row = songSwipeState.row;
  const deltaX = songSwipeState.deltaX;
  resetSongSwipe();
  if (deltaX <= -92) {
    state.revealedSongActionId = row.dataset.songId || "";
    state.revealedSongActionDirection = "delete";
    refreshSongbook();
    return;
  }
  if (deltaX >= 92) {
    state.revealedSongActionId = row.dataset.songId || "";
    state.revealedSongActionDirection = "edit";
    refreshSongbook();
    return;
  }
  state.revealedSongActionId = "";
  state.revealedSongActionDirection = "";
  refreshSongbook();
}

function resetNoteRegistry() {
  state.noteRegistry = new Map();
  state.noteCounter = 0;
}

function registerNote(note) {
  state.noteCounter += 1;
  const id = `note-${state.noteCounter}`;
  state.noteRegistry.set(id, note);
  return id;
}

function buildNoteTrigger(noteText, noteLabel, title, meta) {
  if (!noteText) {
    return "";
  }
  const noteId = registerNote({ title, meta, text: noteText });
  return `<button type="button" class="note-trigger" data-note-id="${noteId}" title="${escapeHtml(noteLabel || "메모")}">…</button>`;
}

function dayEntryHtml(entry, day) {
  const color = entry.categoryColor || CATEGORY_FALLBACKS[entry.categoryKey] || "#ffffff";
  const label = String(entry.text || "").trim();
  const imageHtml = entry.imageUrl
    ? `<img class="entry-media" src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(label || "일정 이미지")}">`
    : "";
  const noteButton = buildNoteTrigger(
    entry.noteText,
    entry.noteLabel,
    label || "메모",
    `${formatMonthTitle(state.selectedYear, state.selectedMonth)} ${day.day}일`
  );
  const tooltipHtml = label ? `<span class="entry-tooltip">${escapeHtml(label)}</span>` : "";

  return `
    <div class="entry-chip ${entry.imageUrl ? "has-image" : ""} ${noteButton ? "has-note" : ""}" style="background:${escapeHtml(color)}" data-fulltext="${escapeHtml(label)}">
      ${imageHtml}
      <span class="entry-label">${escapeHtml(label)}</span>
      ${noteButton}
      ${tooltipHtml}
    </div>
  `;
}

function createPostitId() {
  return `postit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCountdownId() {
  return `countdown-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyEditorEntry() {
  return { categoryKey: "", text: "", noteText: "" };
}

function normalizeEditorEntries(entries, { keepBlank = false, ensureOne = false } = {}) {
  const normalized = (Array.isArray(entries) ? entries : [])
    .slice(0, MAX_EDITOR_SLOTS)
    .map((entry) => ({
      categoryKey: String(entry?.categoryKey || "").trim(),
      text: String(entry?.text || "").slice(0, 120),
      noteText: String(entry?.noteText || "").slice(0, 120),
    }));
  const filtered = keepBlank
    ? normalized
    : normalized.filter((entry) => entry.text.trim() || entry.noteText.trim() || entry.categoryKey);
  if (ensureOne && !filtered.length) {
    return [createEmptyEditorEntry()];
  }
  return filtered;
}

function parseTimeLabelToEditorParts(timeLabel) {
  const text = String(timeLabel || "").trim();
  const match = text.match(/\[(\d{1,2})(?::(\d{2}))?(AM|PM)\]/i);
  if (!match) {
    return { period: "PM", hour: "", minute: "" };
  }
  return {
    period: String(match[3] || "PM").toUpperCase() === "AM" ? "AM" : "PM",
    hour: String(Number(match[1] || 0) || ""),
    minute: match[2] ? String(Number(match[2] || 0)).padStart(2, "0") : "",
  };
}

function buildTimeTextFromEditor(statusMode, timePeriod, timeHour, timeMinute) {
  if (statusMode === "off") {
    return { ok: true, value: "휴뱅" };
  }
  if (statusMode !== "live") {
    return { ok: true, value: "" };
  }
  const hourText = String(timeHour || "").trim();
  const minuteText = String(timeMinute || "").trim();
  const meridiem = String(timePeriod || "PM").toUpperCase() === "AM" ? "AM" : "PM";
  if (!hourText) {
    return { ok: false, error: "방송 시간을 적어 주세요." };
  }
  const hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
    return { ok: false, error: "시는 1~12 사이로 적어 주세요." };
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { ok: false, error: "분은 0~59 사이로 적어 주세요." };
  }
  const minuteSuffix = minuteText ? `:${String(minute).padStart(2, "0")}` : "";
  return { ok: true, value: `뱅온 [${hour}${minuteSuffix}${meridiem}]` };
}

function buildEditorActionButtons(index, total) {
  const buttons = [];
  if (total === 1) {
    buttons.push('<button type="button" class="editor-row-button add" data-editor-add aria-label="일정 추가">+</button>');
    return buttons.join("");
  }
  if (index === total - 1) {
    if (total < MAX_EDITOR_SLOTS) {
      buttons.push('<button type="button" class="editor-row-button add" data-editor-add aria-label="일정 추가">+</button>');
    }
    buttons.push('<button type="button" class="editor-row-button remove" data-editor-remove aria-label="일정 삭제">-</button>');
    return buttons.join("");
  }
  if (index > 0) {
    buttons.push('<button type="button" class="editor-row-button remove" data-editor-remove aria-label="일정 삭제">-</button>');
  }
  return buttons.join("");
}

function buildPostitActionButtons(index, total) {
  const buttons = [];
  if (total === 1) {
    buttons.push('<button type="button" class="postit-row-button add" data-postit-add aria-label="메모 추가">+</button>');
    return buttons.join("");
  }
  if (index === total - 1) {
    if (total < MAX_POSTIT_ITEMS) {
      buttons.push('<button type="button" class="postit-row-button add" data-postit-add aria-label="메모 추가">+</button>');
    }
    buttons.push('<button type="button" class="postit-row-button remove" data-postit-remove aria-label="메모 삭제">-</button>');
    return buttons.join("");
  }
  if (index > 0) {
    buttons.push('<button type="button" class="postit-row-button remove" data-postit-remove aria-label="메모 삭제">-</button>');
  }
  return buttons.join("");
}

function buildCountdownActionButtons(index, total) {
  const buttons = [];
  if (total === 1) {
    buttons.push('<button type="button" class="countdown-row-button add" data-countdown-add aria-label="디데이 추가">+</button>');
    return buttons.join("");
  }
  if (total < MAX_COUNTDOWN_ITEMS) {
    buttons.push('<button type="button" class="countdown-row-button add" data-countdown-add aria-label="디데이 추가">+</button>');
  }
  if (index >= 0) {
    buttons.push('<button type="button" class="countdown-row-button remove" data-countdown-remove aria-label="디데이 삭제">-</button>');
  }
  return buttons.join("");
}

function buildDayMoreTrigger(day) {
  if (!Array.isArray(day?.entries) || day.entries.length <= 3) {
    return "";
  }
  const fullText = day.entries
    .map((entry, index) => {
      const category = entry.categoryLabel ? `[${entry.categoryLabel}] ` : "";
      const extra = entry.noteText ? ` / ${entry.noteText}` : "";
      return `${index + 1}. ${category}${entry.text}${extra}`;
    })
    .join("\n");
  const noteId = registerNote({
    title: `${day.day}일 전체 일정`,
    meta: `${formatMonthTitle(state.selectedYear, state.selectedMonth)} · 총 ${day.entries.length}개`,
    text: fullText,
  });
  return `<button type="button" class="note-trigger day-more-trigger" data-note-id="${noteId}" title="일정 더보기">...</button>`;
}

function categoryLabelForKey(categoryKey) {
  const normalizedKey = String(categoryKey || "").trim();
  const legendItem = (state.bootstrap?.legend || []).find((item) => item.key === normalizedKey);
  return legendItem?.label || normalizedKey || "일정";
}

function resolveMobileSelectedDate(monthData = state.currentMonthData) {
  if (!monthData) {
    return null;
  }

  if (
    state.mobileSelectedDate &&
    Number(state.mobileSelectedDate.year) === Number(monthData.year) &&
    Number(state.mobileSelectedDate.month) === Number(monthData.month)
  ) {
    const safeDay = Math.min(
      Math.max(1, Number(state.mobileSelectedDate.day || 1)),
      daysInMonth(monthData.year, monthData.month),
    );
    return { year: Number(monthData.year), month: Number(monthData.month), day: safeDay };
  }

  const today = todayKstParts();
  if (Number(monthData.year) === today.year && Number(monthData.month) === today.month) {
    return { year: today.year, month: today.month, day: today.day };
  }

  if (state.mobileSelectedDate?.day) {
    const keepDay = Math.min(
      Math.max(1, Number(state.mobileSelectedDate.day || 1)),
      daysInMonth(monthData.year, monthData.month),
    );
    return { year: Number(monthData.year), month: Number(monthData.month), day: keepDay };
  }

  const firstEntryDay = (monthData.days || []).find((item) => Array.isArray(item?.entries) && item.entries.length)?.day;
  return {
    year: Number(monthData.year),
    month: Number(monthData.month),
    day: Number(firstEntryDay || monthData.days?.[0]?.day || 1),
  };
}

function buildMobileEntryCard(entry, monthData, day) {
  const categoryKey = String(entry?.categoryKey || "main").trim();
  const categoryLabel = entry?.categoryLabel || categoryLabelForKey(categoryKey);
  const color = entry?.categoryColor || CATEGORY_FALLBACKS[categoryKey] || "#ffffff";
  const label = String(entry?.text || "").trim();
  const imageHtml = entry?.imageUrl
    ? `<img class="mobile-entry-media" src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(label || "일정 이미지")}">`
    : "";
  const needsMoreButton = Boolean(entry?.noteText || label.length > 26);
  const noteButton = needsMoreButton
    ? buildNoteTrigger(
      entry?.noteText || label,
      "더보기",
      label || "메모",
      `${formatMonthTitle(monthData.year, monthData.month)} ${day.day}일`
    )
    : "";

  return `
    <article class="mobile-entry-card" style="--mobile-entry-color:${escapeHtml(color)}">
      <div class="mobile-entry-top">
        <span class="mobile-entry-category">${escapeHtml(categoryLabel)}</span>
        ${noteButton || ""}
      </div>
      <div class="mobile-entry-body ${imageHtml ? "has-image" : ""}">
        ${imageHtml}
        <div class="mobile-entry-copy">
          <strong class="mobile-entry-title">${escapeHtml(label || "-")}</strong>
        </div>
      </div>
    </article>
  `;
}

function setMobileFullMonthView(active) {
  state.mobileFullMonthView = active;
  mobileViewToggleEl?.classList.toggle("is-active", active);
  document.body.classList.toggle("mobile-month-active", active);
  if (mobileViewToggleEl) {
    mobileViewToggleEl.textContent = active ? "주간" : "월간";
  }
  renderMobileDayView();
}

function mobileMonthDayCellHtml(day, todayKst) {
  if (!day) {
    return '<div class="mobile-month-empty"></div>';
  }

  const isTodayKst =
    state.currentMonthData.year === todayKst.year &&
    state.currentMonthData.month === todayKst.month &&
    day.day === todayKst.day;
  const entries = Array.isArray(day.entries) ? day.entries : [];
  const visibleEntries = entries.slice(0, 2);
  const extraCount = entries.length - visibleEntries.length;
  const chips = visibleEntries
    .map((entry) => {
      const color = entry.categoryColor || CATEGORY_FALLBACKS[entry.categoryKey] || "#4bbdce";
      const label = String(entry.text || "").trim();
      return `<span class="mobile-month-chip" style="background:${escapeHtml(color)}">${escapeHtml(label)}</span>`;
    })
    .join("");
  const moreLabel = extraCount > 0 ? `<span class="mobile-month-more">+${extraCount}</span>` : "";

  return `
    <button
      type="button"
      class="mobile-month-day ${isTodayKst ? "is-today" : ""} ${day.isOff ? "is-off" : ""}"
      data-mobile-month-day="${day.day}"
    >
      <span class="mobile-month-day-number">${day.day}</span>
      <span class="mobile-month-chips">${chips}${moreLabel}</span>
    </button>
  `;
}

function renderMobileMonthView() {
  if (!mobileMonthViewEl) {
    return;
  }

  if (!state.mobileFullMonthView || !state.viewerOpen) {
    mobileMonthViewEl.innerHTML = "";
    mobileMonthViewEl.classList.add("hidden");
    return;
  }

  if (state.monthLoading && !state.currentMonthData) {
    mobileMonthViewEl.classList.remove("hidden");
    mobileMonthViewEl.innerHTML = '<div class="mobile-day-message">일정을 불러오는 중입니다.</div>';
    return;
  }

  if (!state.currentMonthData) {
    mobileMonthViewEl.classList.remove("hidden");
    mobileMonthViewEl.innerHTML = '<div class="mobile-day-message">표시할 일정이 없습니다.</div>';
    return;
  }

  mobileMonthViewEl.classList.remove("hidden");
  const todayKst = todayKstParts();
  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const weekRows = state.currentMonthData.weeks
    .map(
      (week) => `<div class="mobile-month-week">${week.map((day) => mobileMonthDayCellHtml(day, todayKst)).join("")}</div>`
    )
    .join("");

  mobileMonthViewEl.innerHTML = `
    <div class="mobile-month-weekday-row">
      ${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}
    </div>
    ${weekRows}
  `;
}

function renderMobileDayView() {
  if (!mobileDayViewEl) {
    return;
  }

  renderMobileMonthView();

  if (state.mobileFullMonthView) {
    mobileDayViewEl.innerHTML = "";
    return;
  }

  if (!state.viewerOpen) {
    mobileDayViewEl.innerHTML = "";
    return;
  }

  if (state.monthLoading && !state.currentMonthData) {
    mobileDayViewEl.innerHTML = '<div class="mobile-day-message">일정을 불러오는 중입니다.</div>';
    return;
  }

  if (!state.currentMonthData) {
    mobileDayViewEl.innerHTML = '<div class="mobile-day-message">표시할 일정이 없습니다.</div>';
    return;
  }

  const auth = currentAuth();
  const selectedDate = resolveMobileSelectedDate(state.currentMonthData);
  state.mobileSelectedDate = selectedDate;
  const day = (state.currentMonthData.days || []).find((item) => Number(item?.day) === Number(selectedDate?.day || 0));

  if (!day) {
    mobileDayViewEl.innerHTML = '<div class="mobile-day-message">표시할 일정이 없습니다.</div>';
    return;
  }

  // 구글 캘린더처럼: 선택한 날이 속한 주(일~토) → 날짜 제목 → 일정 목록.
  const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const selectedWeekday = new Date(selectedDate.year, selectedDate.month - 1, selectedDate.day).getDay();
  const weekDates = Array.from({ length: 7 }, (_, index) => shiftCalendarDate(selectedDate, index - selectedWeekday));
  const now = new Date();
  const todayDate = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  const entries = Array.isArray(day.entries) ? day.entries : [];
  const imageUrl = day.customImageDataUrl || entries.find((entry) => entry?.imageUrl)?.imageUrl || "";
  const dayNoteButton = buildNoteTrigger(
    day.noteText,
    day.noteLabel || "날짜 메모",
    `${day.day}일 메모`,
    `${formatMonthTitle(state.currentMonthData.year, state.currentMonthData.month)} ${day.day}일`
  );
  const isOff = day.isOff || String(day.timeLabel || "").trim() === "휴뱅";
  const timeText = isOff ? "" : String(day.timeLabel || "").trim();
  const statusChip = isOff ? '<span class="mday-chip is-off">휴뱅</span>' : timeText ? `<span class="mday-chip">${escapeHtml(truncateInlineText(timeText, 18))}</span>` : "";

  mobileDayViewEl.innerHTML = `
    <section class="mobile-day-panel mday">
      <div class="mday-week">
        ${weekDates.map((item) => {
          const active = isSameCalendarDate(item, selectedDate);
          const outside = Number(item.month) !== Number(state.currentMonthData.month);
          const itemDay = outside ? null : (state.currentMonthData.days || []).find((entry) => Number(entry?.day) === Number(item.day));
          const itemEntries = Array.isArray(itemDay?.entries) ? itemDay.entries : [];
          const dotColor = itemEntries[0]?.categoryColor || CATEGORY_FALLBACKS[itemEntries[0]?.categoryKey] || "";
          const weekday = new Date(item.year, item.month - 1, item.day).getDay();
          return `
            <button type="button" class="mday-date${active ? " is-active" : ""}${outside ? " is-outside" : ""}${isSameCalendarDate(item, todayDate) ? " is-today" : ""}${itemDay?.isOff ? " is-off" : ""}${weekday === 0 ? " is-sun" : weekday === 6 ? " is-sat" : ""}" data-mobile-go-date="${item.year}-${item.month}-${item.day}">
              <span class="mday-weekday">${weekdayNames[weekday]}</span>
              <span class="mday-number">${escapeHtml(item.day)}</span>
              <span class="mday-dot"${dotColor ? ` style="background:${escapeHtml(dotColor)}"` : ""}></span>
            </button>
          `;
        }).join("")}
      </div>

      <header class="mday-head">
        <div class="mday-title">
          <h3>${escapeHtml(selectedDate.month)}월 ${escapeHtml(selectedDate.day)}일 ${weekdayNames[selectedWeekday]}요일${isSameCalendarDate(selectedDate, todayDate) ? ' <span class="mday-today">오늘</span>' : ""}</h3>
          <p class="mday-meta">${statusChip}<span>일정 ${entries.length}개</span>${auth?.canEdit ? '<button type="button" class="mobile-day-edit-button" data-mobile-edit-day>편집</button>' : ""}</p>
        </div>
        <div class="mday-arrows">
          <button type="button" class="mobile-day-arrow" data-mobile-shift="-1" aria-label="이전 날짜">‹</button>
          <button type="button" class="mobile-day-arrow" data-mobile-shift="1" aria-label="다음 날짜">›</button>
        </div>
      </header>

      <div class="mobile-entry-list">
        ${entries.length ? entries.map((entry) => buildMobileEntryCard(entry, state.currentMonthData, day)).join("") : `
          <div class="mobile-day-empty">${day.isOff ? "이 날은 휴뱅으로 기록되어 있어요." : "등록된 일정이 아직 없어요."}</div>
        `}
      </div>

      ${(day.noteText || imageUrl) ? `
        <div class="mobile-day-extra-row">
          ${day.noteText ? `
            <article class="mobile-day-note-card">
              <div>
                <span class="mobile-day-note-label">날짜 메모</span>
                <p>${escapeHtml(truncateInlineText(day.noteText, 92))}</p>
              </div>
              ${dayNoteButton}
            </article>
          ` : ""}
          ${imageUrl ? `
            <article class="mobile-day-image-card">
              <img src="${escapeHtml(imageUrl)}" alt="">
            </article>
          ` : ""}
        </div>
      ` : ""}
    </section>
  `;
}

function editorCategoryColor(categoryKey) {
  const legendItem = (state.bootstrap?.legend || []).find((item) => item.key === categoryKey);
  return legendItem?.color || "";
}

function applyCategorySelectColor(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return;
  }
  const fill = editorCategoryColor(selectEl.value);
  if (fill) {
    selectEl.style.background = fill;
    selectEl.style.color = "#0f1115";
    selectEl.style.borderColor = "rgba(15, 17, 21, 0.18)";
    return;
  }
  selectEl.style.background = "";
  selectEl.style.color = "";
  selectEl.style.borderColor = "";
}

function normalizePostitItems(items, { keepBlank = false, ensureOne = false } = {}) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id || "").trim() || createPostitId(),
      text: String(item?.text || "").slice(0, 120),
      checked: Boolean(item?.checked),
    }))
    .slice(0, MAX_POSTIT_ITEMS);
  const filtered = keepBlank ? normalized : normalized.filter((item) => item.text.trim() || item.checked);
  if (ensureOne && !filtered.length) {
    return [{ id: createPostitId(), text: "", checked: false }];
  }
  return filtered;
}

function normalizeCountdownItems(items, { keepBlank = false, ensureOne = false } = {}) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id || "").trim() || createCountdownId(),
      title: String(item?.title || "").slice(0, 50),
      targetDate: String(item?.targetDate || "").trim().slice(0, 10),
    }))
    .sort((left, right) => {
      const leftDiff = countdownDiffDays(left.targetDate);
      const rightDiff = countdownDiffDays(right.targetDate);
      const leftHasDate = leftDiff !== null;
      const rightHasDate = rightDiff !== null;
      if (leftHasDate !== rightHasDate) {
        return leftHasDate ? -1 : 1;
      }
      if (!leftHasDate && !rightHasDate) {
        return 0;
      }
      const leftUpcoming = leftDiff >= 0;
      const rightUpcoming = rightDiff >= 0;
      if (leftUpcoming !== rightUpcoming) {
        return leftUpcoming ? -1 : 1;
      }
      if (leftUpcoming && rightUpcoming) {
        return leftDiff - rightDiff;
      }
      return rightDiff - leftDiff;
    })
    .slice(0, MAX_COUNTDOWN_ITEMS);
  const filtered = keepBlank ? normalized : normalized.filter((item) => item.title.trim() || item.targetDate);
  if (ensureOne && !filtered.length) {
    return [{ id: createCountdownId(), title: "", targetDate: "" }];
  }
  return filtered;
}

function postitDraftItems() {
  const items = normalizePostitItems(state.postitItems, { keepBlank: true });
  if (!currentAuth()?.canPostitEdit) {
    return normalizePostitItems(items);
  }
  return normalizePostitItems(items, { keepBlank: true, ensureOne: true });
}

function countdownDraftItems() {
  const items = normalizeCountdownItems(state.countdownItems, { keepBlank: true });
  if (!currentAuth()?.canPostitEdit) {
    return normalizeCountdownItems(items);
  }
  return normalizeCountdownItems(items, { keepBlank: true, ensureOne: true });
}

function collectPostitItems() {
  if (!postitItemsEl) {
    return [];
  }
  return [...postitItemsEl.querySelectorAll(".postit-item")]
    .map((item) => ({
      id: item.dataset.postitId || createPostitId(),
      text: item.querySelector("[data-postit-text]")?.value || item.querySelector(".postit-text")?.textContent || "",
      checked: Boolean(item.querySelector("[data-postit-check]")?.checked),
    }))
    .slice(0, MAX_POSTIT_ITEMS);
}

function collectCountdownItems() {
  if (!countdownItemsEl) {
    return [];
  }
  return [...countdownItemsEl.querySelectorAll(".countdown-item")]
    .map((item) => ({
      id: item.dataset.countdownId || createCountdownId(),
      title: item.querySelector("[data-countdown-title]")?.value || item.querySelector(".countdown-title")?.textContent || "",
      targetDate: item.querySelector("[data-countdown-date]")?.value || item.dataset.countdownDate || "",
    }))
    .slice(0, MAX_COUNTDOWN_ITEMS);
}

function postitItemsKey(items) {
  return JSON.stringify(
    normalizePostitItems(items, { keepBlank: true }).map((item) => ({
      id: item.id,
      text: item.text,
      checked: item.checked,
    }))
  );
}

function countdownItemsKey(items) {
  return JSON.stringify(
    normalizeCountdownItems(items, { keepBlank: true }).map((item) => ({
      id: item.id,
      title: item.title,
      targetDate: item.targetDate,
    }))
  );
}

function sharedBoardKey(postitItems, countdownItems) {
  return JSON.stringify({
    items: JSON.parse(postitItemsKey(postitItems)),
    countdowns: JSON.parse(countdownItemsKey(countdownItems)),
  });
}

function autosizePostitInput(inputEl) {
  if (!(inputEl instanceof HTMLTextAreaElement)) {
    return;
  }
  inputEl.style.height = "0px";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 124)}px`;
}

function todayKstDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function todayKstParts() {
  const [year, month, day] = todayKstDate().split("-").map((value) => Number(value) || 0);
  return { year, month, day };
}

function daysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function normalizeCalendarDate(dateLike, fallbackYear = state.selectedYear, fallbackMonth = state.selectedMonth) {
  return {
    year: Number(dateLike?.year || fallbackYear || 0),
    month: Number(dateLike?.month || fallbackMonth || 0),
    day: Number(dateLike?.day || 1),
  };
}

function shiftCalendarDate(dateLike, offset) {
  const base = normalizeCalendarDate(dateLike);
  const shifted = new Date(base.year, base.month - 1, base.day + Number(offset || 0));
  return {
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
    day: shifted.getDate(),
  };
}

function isSameCalendarDate(left, right) {
  return (
    Number(left?.year || 0) === Number(right?.year || 0) &&
    Number(left?.month || 0) === Number(right?.month || 0) &&
    Number(left?.day || 0) === Number(right?.day || 0)
  );
}


function countdownDiffDays(targetDate) {
  const text = String(targetDate || "").trim();
  if (!text) {
    return null;
  }
  const todayText = todayKstDate();
  const target = new Date(`${text}T00:00:00+09:00`);
  const today = new Date(`${todayText}T00:00:00+09:00`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(today.getTime())) {
    return null;
  }
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function countdownLabel(targetDate) {
  const diff = countdownDiffDays(targetDate);
  if (diff === null) {
    return "";
  }
  if (diff === 0) {
    return "D-Day";
  }
  if (diff > 0) {
    return `D-${diff}`;
  }
  return `D+${Math.abs(diff)}`;
}

function countdownToneClass(targetDate) {
  const diff = countdownDiffDays(targetDate);
  if (diff === null) {
    return "draft";
  }
  if (diff >= 0 && diff <= 7) {
    return "urgent";
  }
  if (diff >= 8 && diff <= 30) {
    return "soon";
  }
  if (diff < 0) {
    return "past";
  }
  return "normal";
}

function formatCountdownDate(targetDate) {
  const text = String(targetDate || "").trim();
  if (!text) {
    return "날짜를 정해 주세요";
  }
  const parsed = new Date(`${text}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "날짜를 다시 확인해 주세요";
  }
  return formatKoreanDate(parsed.toISOString());
}

function autosizeEditorTextarea(inputEl, maxHeight = 168) {
  if (!(inputEl instanceof HTMLTextAreaElement)) {
    return;
  }
  inputEl.style.height = "0px";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, maxHeight)}px`;
}

function syncPostitDraftFromDom() {
  if (!currentAuth()?.canPostitEdit) {
    return;
  }
  state.postitItems = collectPostitItems();
  state.countdownItems = collectCountdownItems();
}

function queuePostitSave() {
  if (!currentAuth()?.canPostitEdit) {
    return;
  }
  if (state.postitSaveTimer) {
    window.clearTimeout(state.postitSaveTimer);
  }
  state.postitSaveTimer = window.setTimeout(() => {
    state.postitSaveTimer = 0;
    savePostit();
  }, 500);
}

function capturePostitFocus() {
  if (!postitItemsEl && !countdownItemsEl) {
    return null;
  }
  const activeField = document.activeElement;
  const postitTextarea = activeField?.closest?.("[data-postit-text]");
  const postitItemEl = postitTextarea?.closest?.(".postit-item");
  if (activeField instanceof HTMLTextAreaElement && postitItemEl?.dataset?.postitId) {
    return {
      kind: "postit",
      id: postitItemEl.dataset.postitId,
      selector: "[data-postit-text]",
      selectionStart: activeField.selectionStart,
      selectionEnd: activeField.selectionEnd,
    };
  }
  const countdownField = activeField?.closest?.("[data-countdown-title], [data-countdown-date]");
  const countdownItemEl = countdownField?.closest?.(".countdown-item");
  if (activeField instanceof HTMLInputElement && countdownItemEl?.dataset?.countdownId) {
    return {
      kind: "countdown",
      id: countdownItemEl.dataset.countdownId,
      selector: countdownField.matches("[data-countdown-date]") ? "[data-countdown-date]" : "[data-countdown-title]",
      selectionStart: activeField.type === "text" ? activeField.selectionStart : null,
      selectionEnd: activeField.type === "text" ? activeField.selectionEnd : null,
    };
  }
  return null;
}

function restorePostitFocus(focusState) {
  if (!focusState?.id || !focusState?.selector) {
    return;
  }
  const host =
    focusState.kind === "countdown"
      ? countdownItemsEl?.querySelector(`.countdown-item[data-countdown-id="${CSS.escape(focusState.id)}"] ${focusState.selector}`)
      : postitItemsEl?.querySelector(`.postit-item[data-postit-id="${CSS.escape(focusState.id)}"] ${focusState.selector}`);
  if (!(host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement)) {
    return;
  }
  host.focus({ preventScroll: true });
  if (typeof focusState.selectionStart === "number" && typeof focusState.selectionEnd === "number") {
    host.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
  }
}

function renderPostit() {
  if (!postitItemsEl) {
    return;
  }

  const canEdit = Boolean(currentAuth()?.canPostitEdit);
  const items = postitDraftItems();
  const focusState = canEdit ? capturePostitFocus() : null;

  if (!items.length) {
    postitItemsEl.innerHTML = '<p class="postit-empty">아직 메모가 없습니다.</p>';
    return;
  }

  postitItemsEl.innerHTML = items
    .map((item, index) => {
      const text = String(item.text || "");
      return `
        <div class="postit-item ${item.checked ? "checked" : ""}" data-postit-id="${escapeHtml(item.id)}">
          <label class="postit-check">
            <input type="checkbox" data-postit-check ${item.checked ? "checked" : ""} ${canEdit ? "" : "disabled"}>
            <span class="postit-box"></span>
          </label>
          ${
            canEdit
              ? `<textarea class="postit-input" data-postit-text rows="1" maxlength="120" placeholder="메모를 적어주세요.">${escapeHtml(text)}</textarea>`
              : `<p class="postit-text" title="${escapeHtml(text)}">${escapeHtml(text || "메모 없음")}</p>`
          }
          ${
            canEdit
              ? `<div class="postit-actions">${buildPostitActionButtons(index, items.length)}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  if (canEdit) {
    postitItemsEl.querySelectorAll("[data-postit-text]").forEach((inputEl) => autosizePostitInput(inputEl));
    if (focusState?.kind === "postit") {
      restorePostitFocus(focusState);
    }
  }
}

function renderCountdowns() {
  if (!countdownItemsEl) {
    return;
  }

  const canEdit = Boolean(currentAuth()?.canPostitEdit);
  const items = countdownDraftItems();
  const focusState = canEdit ? capturePostitFocus() : null;

  if (!items.length) {
    countdownItemsEl.innerHTML = '<p class="countdown-empty">아직 일정이 없습니다.</p>';
    return;
  }

  countdownItemsEl.innerHTML = items
    .map((item, index) => {
      const title = String(item.title || "");
      const targetDate = String(item.targetDate || "");
      const tone = countdownToneClass(targetDate);
      const isDday = countdownDiffDays(targetDate) === 0;
      return `
        <div class="countdown-item ${tone} ${isDday ? "is-dday" : ""}" data-countdown-id="${escapeHtml(item.id)}" data-countdown-date="${escapeHtml(targetDate)}">
          ${targetDate ? `<div class="countdown-watermark ${tone} ${isDday ? "is-dday" : ""}">${escapeHtml(countdownLabel(targetDate))}</div>` : ""}
          <div class="countdown-main">
            ${
              canEdit
                ? `<input class="countdown-title-input" data-countdown-title type="text" maxlength="50" placeholder="일정 이름" value="${escapeHtml(title)}">`
                : `<p class="countdown-title">${escapeHtml(title || "일정 이름 없음")}</p>`
            }
            <div class="countdown-meta-row">
              ${
                canEdit
                  ? `<input class="countdown-date-input" data-countdown-date type="date" value="${escapeHtml(targetDate)}">`
                  : `<p class="countdown-date">${escapeHtml(formatCountdownDate(targetDate))}</p>`
              }
            </div>
          </div>
          ${canEdit ? `<div class="countdown-actions">${buildCountdownActionButtons(index, items.length)}</div>` : ""}
        </div>
      `;
    })
    .join("");

  if (canEdit && focusState?.kind === "countdown") {
    restorePostitFocus(focusState);
  }
}

function addPostitItem() {
  addPostitItemAfter("");
}

function addPostitItemAfter(itemId) {
  if (!currentAuth()?.canPostitEdit) {
    return;
  }
  syncPostitDraftFromDom();
  if (state.postitItems.length >= MAX_POSTIT_ITEMS) {
    return;
  }
  const nextItem = { id: createPostitId(), text: "", checked: false };
  if (!itemId) {
    state.postitItems.push(nextItem);
  } else {
    const targetIndex = state.postitItems.findIndex((item) => item.id === itemId);
    if (targetIndex < 0) {
      state.postitItems.push(nextItem);
    } else {
      state.postitItems.splice(targetIndex + 1, 0, nextItem);
    }
  }
  renderPostit();
  postitItemsEl.querySelector(".postit-item:last-child [data-postit-text]")?.focus();
  queuePostitSave();
}

function addCountdownItemAfter(itemId) {
  if (!currentAuth()?.canPostitEdit) {
    return;
  }
  syncPostitDraftFromDom();
  if (state.countdownItems.length >= MAX_COUNTDOWN_ITEMS) {
    return;
  }
  const nextItem = { id: createCountdownId(), title: "", targetDate: "" };
  if (!itemId) {
    state.countdownItems.push(nextItem);
  } else {
    const targetIndex = state.countdownItems.findIndex((item) => item.id === itemId);
    if (targetIndex < 0) {
      state.countdownItems.push(nextItem);
    } else {
      state.countdownItems.splice(targetIndex + 1, 0, nextItem);
    }
  }
  renderCountdowns();
  countdownItemsEl.querySelector(".countdown-item:last-child [data-countdown-title]")?.focus();
  queuePostitSave();
}

function removePostitItem(itemId) {
  if (!currentAuth()?.canPostitEdit || !itemId) {
    return;
  }
  syncPostitDraftFromDom();
  state.postitItems = state.postitItems.filter((item) => item.id !== itemId);
  renderPostit();
  queuePostitSave();
}

function removeCountdownItem(itemId) {
  if (!currentAuth()?.canPostitEdit || !itemId) {
    return;
  }
  syncPostitDraftFromDom();
  state.countdownItems = state.countdownItems.filter((item) => item.id !== itemId);
  renderCountdowns();
  queuePostitSave();
}

async function savePostit() {
  if (!currentAuth()?.canPostitEdit) {
    return;
  }

  try {
    const ref = postitDocRef();
    if (!ref) {
      throw new Error("Firebase 포스트잇 설정이 필요합니다.");
    }
    const items = normalizePostitItems(collectPostitItems(), { keepBlank: true, ensureOne: true });
    const countdowns = normalizeCountdownItems(collectCountdownItems(), { keepBlank: true, ensureOne: true });
    state.postitSyncKey = sharedBoardKey(items, countdowns);
    const updatedAt = firestoreTimestamp();
    await ref.set({ items, countdowns, updatedAt }, { merge: true });
    state.postitItems = normalizePostitItems(items, { keepBlank: true, ensureOne: true });
    state.countdownItems = normalizeCountdownItems(countdowns, { keepBlank: true, ensureOne: true });
    state.postitUpdatedAt = updatedAt;
  } catch (error) {
    state.postitSyncKey = "";
    console.error(error);
  }
}

function hydrateEditorDraft(day) {
  const timeLabel = String(day?.timeLabel || "").trim();
  const timeParts = parseTimeLabelToEditorParts(timeLabel);
  state.editorDraft = {
    statusMode: day?.isOff || timeLabel === "휴뱅" ? "off" : (timeLabel ? "live" : "none"),
    timePeriod: day?.isOff || timeLabel === "휴뱅" ? "PM" : timeParts.period,
    timeHour: day?.isOff || timeLabel === "휴뱅" ? "" : timeParts.hour,
    timeMinute: day?.isOff || timeLabel === "휴뱅" ? "" : timeParts.minute,
    dayNoteText: String(day?.noteText || "").slice(0, 1200),
    customImageDataUrl: normalizeDayImageDataUrl(day?.customImageDataUrl),
    entries: normalizeEditorEntries(day?.entries || [], { keepBlank: true, ensureOne: true }),
  };
}

function collectEditorEntriesFromDom() {
  if (!slotListEl) {
    return normalizeEditorEntries([], { keepBlank: true, ensureOne: true });
  }
  return normalizeEditorEntries(
    [...slotListEl.querySelectorAll(".editor-slot")].map((slotEl) => ({
      categoryKey: slotEl.querySelector("[data-slot-category]")?.value || "",
      text: slotEl.querySelector("[data-slot-text]")?.value || "",
      noteText: slotEl.querySelector("[data-slot-note]")?.value || "",
    })),
    { keepBlank: true, ensureOne: true }
  );
}

function syncEditorDraftFromDom() {
  if (!state.selectedDay) {
    return;
  }
  state.editorDraft = {
    statusMode: editorStatusModeEl?.value || "none",
    timePeriod: editorTimePeriodEl?.value || "PM",
    timeHour: editorTimeHourEl?.value || "",
    timeMinute: editorTimeMinuteEl?.value || "",
    dayNoteText: editorDayNoteEl?.value || "",
    customImageDataUrl: normalizeDayImageDataUrl(state.editorDraft.customImageDataUrl),
    entries: collectEditorEntriesFromDom(),
  };
}

function updateEditorTimeField() {
  const isLive = editorStatusModeEl?.value === "live";
  editorTimeFieldEl?.classList.toggle("hidden", !isLive);
  if (!isLive) {
    if (editorTimeHourEl) {
      editorTimeHourEl.value = "";
    }
    if (editorTimeMinuteEl) {
      editorTimeMinuteEl.value = "";
    }
  }
}

function renderEditorDayImagePreview() {
  if (!editorDayImagePreviewEl || !editorDayImageRemoveEl) {
    return;
  }
  const imageDataUrl = normalizeDayImageDataUrl(state.editorDraft.customImageDataUrl);
  editorDayImagePreviewEl.classList.toggle("hidden", !imageDataUrl);
  editorDayImageRemoveEl.classList.toggle("hidden", !imageDataUrl);
  editorDayImagePreviewEl.innerHTML = imageDataUrl
    ? `<img src="${escapeHtml(imageDataUrl)}" alt="날짜 이미지 미리보기">`
    : "";
}

function queueEditorSave() {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }
  state.editorDirty = true;
  saveStatusEl.textContent = "자동 저장 예정";
  if (state.editorSaveTimer) {
    window.clearTimeout(state.editorSaveTimer);
  }
  state.editorSaveTimer = window.setTimeout(() => {
    state.editorSaveTimer = 0;
    void saveEditorDraft();
  }, 700);
}

async function saveEditorDraft({ force = false } = {}) {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return true;
  }

  syncEditorDraftFromDom();
  const timeResult = buildTimeTextFromEditor(
    state.editorDraft.statusMode,
    state.editorDraft.timePeriod,
    state.editorDraft.timeHour,
    state.editorDraft.timeMinute
  );
  if (!timeResult.ok) {
    saveStatusEl.textContent = timeResult.error;
    return false;
  }

  if (!force && !state.editorDirty) {
    return true;
  }
  if (state.editorSaving) {
    state.editorQueued = true;
    state.editorDirty = true;
    return false;
  }

  state.editorSaving = true;
  state.editorDirty = false;
  saveStatusEl.textContent = "자동 저장 중...";

  try {
    const ref = currentMonthDocRef();
    if (!ref) {
      throw new Error("Firebase 일정 설정이 필요합니다.");
    }
    const currentSnapshot = await ref.get();
    const currentData = normalizeVersionSnapshot(currentSnapshot.data() || {}, state.selectedYear, state.selectedMonth);

    const dayOverride = {
      timeLabel: timeResult.value,
      timeSource: "manual",
      entries: normalizeEditorEntries(state.editorDraft.entries).map((entry) => ({
        text: entry.text,
        categoryKey: entry.categoryKey,
        noteText: entry.noteText,
        noteLabel: entry.noteText ? summarizeNoteLabel(entry.noteText) : "",
      })),
      noteText: String(state.editorDraft.dayNoteText || "").slice(0, 1200).trim(),
      noteLabel: state.editorDraft.dayNoteText ? summarizeNoteLabel(state.editorDraft.dayNoteText) : "",
      customImageDataUrl: normalizeDayImageDataUrl(state.editorDraft.customImageDataUrl),
      updatedAt: firestoreTimestamp(),
    };
    const historyDayOverride = normalizeHistorySnapshotDay(dayOverride);
    const nextVersionSnapshot = normalizeVersionSnapshot(
      {
        year: state.selectedYear,
        month: state.selectedMonth,
        days: {
          ...(currentData.days || {}),
          [String(state.selectedDay.day)]: historyDayOverride,
        },
      },
      state.selectedYear,
      state.selectedMonth
    );

    await ref.set({
      year: state.selectedYear,
      month: state.selectedMonth,
      days: {
        ...(currentData.days || {}),
        [String(state.selectedDay.day)]: {
          ...historyDayOverride,
          updatedAt: dayOverride.updatedAt,
        },
      },
      updatedAt: dayOverride.updatedAt,
    });

    try {
      await saveVersionHistoryEntry(nextVersionSnapshot, {
        changedDay: state.selectedDay.day,
      });
    } catch (historyError) {
      console.error(historyError);
      state.versionHistoryStatus = isFirestorePermissionError(historyError)
        ? "버전 기록 권한이 아직 적용되지 않아 기록은 남기지 못했습니다."
        : "버전 기록 저장에 실패했습니다.";
    }

    const mergedMonth = applyMonthOverrideData(currentBaseMonth(), {
      days: {
        [String(state.selectedDay.day)]: dayOverride,
      },
    });
    updateCalendarSearchMonthCache(state.selectedYear, state.selectedMonth, mergedMonth);
    const updatedDay = mergedMonth.days.find((item) => item.day === state.selectedDay.day);
    if (updatedDay) {
      mergeCurrentMonthDay(updatedDay);
      renderCalendar();
      if (state.selectedDay?.day === updatedDay.day) {
        state.selectedDay = cloneData(updatedDay);
      }
    }
    saveStatusEl.textContent = "자동 저장됨";
    if (versionHistoryModalEl && !versionHistoryModalEl.classList.contains("hidden")) {
      void loadVersionHistory();
    }
    return true;
  } catch (error) {
    state.editorDirty = true;
    saveStatusEl.textContent = error.message;
    return false;
  } finally {
    state.editorSaving = false;
    if (state.editorQueued) {
      state.editorQueued = false;
      void saveEditorDraft({ force: true });
    }
  }
}

function renderEditor() {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }

  const legendOptions = (state.bootstrap?.legend || [])
    .map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`)
    .join("");
  const entries = normalizeEditorEntries(state.editorDraft.entries, { keepBlank: true, ensureOne: true });

  editorTitleEl.textContent = `${state.selectedYear}년 ${String(state.selectedMonth).padStart(2, "0")}월 ${String(state.selectedDay.day).padStart(2, "0")}일`;
  editorStatusModeEl.value = state.editorDraft.statusMode || "none";
  editorTimePeriodEl.value = state.editorDraft.timePeriod || "PM";
  editorTimeHourEl.value = state.editorDraft.timeHour || "";
  editorTimeMinuteEl.value = state.editorDraft.timeMinute || "";
  if (editorDayNoteEl) {
    editorDayNoteEl.value = state.editorDraft.dayNoteText || "";
  }
  if (editorDayImageInputEl) {
    editorDayImageInputEl.value = "";
  }
  updateEditorTimeField();
  renderEditorDayImagePreview();

  slotListEl.innerHTML = entries
    .map(
      (entry, index) => `
        <div class="editor-slot" data-slot-index="${index}">
          <div class="editor-slot-head">
            <div class="editor-slot-title">
              <button type="button" class="editor-slot-drag" data-editor-drag-handle draggable="true" aria-label="일정 순서 이동">↕</button>
              <strong>일정 ${index + 1}</strong>
            </div>
            <div class="editor-slot-actions">
              ${buildEditorActionButtons(index, entries.length)}
            </div>
          </div>
          <label>
            <span class="editor-field-title">카테고리</span>
            <select data-slot-category>
              <option value="">선택 안 함</option>
              ${legendOptions}
            </select>
          </label>
          <label>
            <span class="editor-field-title">내용</span>
            <textarea data-slot-text rows="1" maxlength="120" placeholder="일정 내용을 적어주세요.">${escapeHtml(entry.text || "")}</textarea>
          </label>
          <label>
            <span class="editor-field-title">일정 기타</span>
            <input data-slot-note type="text" maxlength="120" placeholder="예. 합방 인원">
          </label>
        </div>
      `
    )
    .join("");

  [...slotListEl.querySelectorAll(".editor-slot")].forEach((slotEl, index) => {
    const entry = entries[index] || createEmptyEditorEntry();
    const categoryEl = slotEl.querySelector("[data-slot-category]");
    const noteEl = slotEl.querySelector("[data-slot-note]");
    const textEl = slotEl.querySelector("[data-slot-text]");
    if (categoryEl) {
      categoryEl.value = entry.categoryKey || "";
      applyCategorySelectColor(categoryEl);
    }
    if (textEl) {
      autosizeEditorTextarea(textEl, 156);
    }
    if (noteEl) {
      noteEl.value = entry.noteText || "";
    }
  });
  if (editorDayNoteEl) {
    autosizeEditorTextarea(editorDayNoteEl, 96);
  }
}

function clearEditorDragState() {
  state.editorDragIndex = -1;
  slotListEl?.querySelectorAll(".editor-slot").forEach((slotEl) => {
    slotEl.classList.remove("dragging", "drag-over");
  });
}

function reorderEditorEntries(fromIndex, toIndex) {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    clearEditorDragState();
    return;
  }
  syncEditorDraftFromDom();
  const nextEntries = state.editorDraft.entries.slice();
  if (fromIndex >= nextEntries.length || toIndex >= nextEntries.length) {
    clearEditorDragState();
    return;
  }
  const [movedEntry] = nextEntries.splice(fromIndex, 1);
  nextEntries.splice(toIndex, 0, movedEntry);
  state.editorDraft.entries = normalizeEditorEntries(nextEntries, { keepBlank: true, ensureOne: true });
  renderEditor();
  queueEditorSave();
  clearEditorDragState();
}

function addEditorEntryAfter(index) {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }
  syncEditorDraftFromDom();
  if (state.editorDraft.entries.length >= MAX_EDITOR_SLOTS) {
    return;
  }
  const nextEntries = state.editorDraft.entries.slice();
  const insertIndex = Number.isInteger(index) ? index + 1 : nextEntries.length;
  nextEntries.splice(insertIndex, 0, createEmptyEditorEntry());
  state.editorDraft.entries = normalizeEditorEntries(nextEntries, { keepBlank: true, ensureOne: true });
  renderEditor();
  queueEditorSave();
  slotListEl.querySelector(`.editor-slot[data-slot-index="${Math.min(insertIndex, state.editorDraft.entries.length - 1)}"] [data-slot-text]`)?.focus();
}

function removeEditorEntry(index) {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }
  syncEditorDraftFromDom();
  if (state.editorDraft.entries.length <= 1) {
    state.editorDraft.entries = [createEmptyEditorEntry()];
  } else {
    state.editorDraft.entries = state.editorDraft.entries.filter((_, itemIndex) => itemIndex !== index);
  }
  renderEditor();
  queueEditorSave();
}

async function handleEditorDayImageSelection(file) {
  if (!file || !state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }
  if (!String(file.type || "").startsWith("image/")) {
    saveStatusEl.textContent = "이미지 파일만 올릴 수 있습니다.";
    return;
  }
  try {
    saveStatusEl.textContent = "이미지 처리 중...";
    const resized = await resizeDayImageFile(file);
    state.editorDraft.customImageDataUrl = resized;
    renderEditorDayImagePreview();
    queueEditorSave();
  } catch (error) {
    saveStatusEl.textContent = error.message || "이미지를 저장하지 못했습니다.";
  } finally {
    if (editorDayImageInputEl) {
      editorDayImageInputEl.value = "";
    }
  }
}

function clearEditorDayImage() {
  if (!state.selectedDay || !currentAuth()?.canEdit) {
    return;
  }
  state.editorDraft.customImageDataUrl = "";
  renderEditorDayImagePreview();
  queueEditorSave();
}

function renderCalendar() {
  if (!state.viewerOpen) {
    calendarGridEl.innerHTML = "";
    renderMobileDayView();
    return;
  }

  renderMonthPager();

  if (state.monthLoading && !state.currentMonthData) {
    calendarGridEl.innerHTML = '<div class="calendar-message">일정을 불러오는 중입니다.</div>';
    renderMobileDayView();
    return;
  }
  if (!state.currentMonthData) {
    calendarGridEl.innerHTML = '<div class="calendar-message">표시할 일정이 없습니다.</div>';
    renderMobileDayView();
    return;
  }

  resetNoteRegistry();
  const auth = currentAuth();
  const cells = [];
  const todayKst = todayKstParts();

  for (const week of state.currentMonthData.weeks) {
    for (const day of week) {
      if (!day) {
        cells.push('<div class="calendar-empty"></div>');
        continue;
      }

      const isTodayKst =
        state.currentMonthData.year === todayKst.year &&
        state.currentMonthData.month === todayKst.month &&
        day.day === todayKst.day;
      const isSearchHit = state.calendarSearchHighlightKey === `${monthKey(state.currentMonthData.year, state.currentMonthData.month)}:${day.day}`;
      const visibleEntries = (day.entries || []).slice(0, 3).map((entry) => dayEntryHtml(entry, day)).join("");
      const moreButton = buildDayMoreTrigger(day);
      const dayNoteButton = buildNoteTrigger(
        day.noteText,
        day.noteLabel,
        `${day.day}일 메모`,
        `${state.currentMonthData.title} ${day.day}일`
      );
      const timeLabel = String(day.timeLabel || "").trim();
      const timeDisplay = truncateInlineText(timeLabel, 15);

      cells.push(`
        <article class="calendar-day ${auth?.canEdit ? "selectable" : ""} ${state.selectedDay?.day === day.day ? "selected" : ""} ${day.showStatusImage ? "has-status-mark" : ""} ${day.isOff ? "off-day-cell" : ""} ${isTodayKst ? "today-kst-day" : ""} ${isSearchHit ? "search-hit" : ""}" data-day="${day.day}">
          ${day.customImageDataUrl ? `<div class="day-custom-image-wrap"><img class="day-custom-image" src="${escapeHtml(day.customImageDataUrl)}" alt=""></div>` : ""}
          <div class="day-top">
            <div class="day-number-wrap">
              <span class="day-number">${day.day}</span>
            </div>
            <div class="day-tools">
              ${dayNoteButton}
              ${timeLabel ? `<span class="time-chip ${day.isOff ? "off" : ""}" title="${escapeHtml(timeLabel)}">${escapeHtml(timeDisplay)}</span>` : ""}
            </div>
          </div>
          <div class="entry-list">${visibleEntries}${moreButton}</div>
        </article>
      `);
    }
  }

  calendarGridEl.innerHTML = cells.join("");
  renderMobileDayView();
}

function openEditor(day) {
  if (!currentAuth()?.canEdit || !day) {
    return;
  }
  state.selectedDay = JSON.parse(JSON.stringify(day));
  hydrateEditorDraft(day);
  state.editorDirty = false;
  saveStatusEl.textContent = "";
  renderEditor();
  openModalElement(editorModalEl);
  renderCalendar();
}

function closeEditorCloseWarning({ restoreFocus = false } = {}) {
  closeModalElement(editorCloseWarningModalEl, { restoreFocus });
}

function hasEditorCloseTimeWarning() {
  if (!state.selectedDay) {
    return false;
  }
  syncEditorDraftFromDom();
  return state.editorDraft.statusMode === "live" && !String(state.editorDraft.timeHour || "").trim();
}

function discardAndCloseEditor() {
  closeEditorCloseWarning();
  closeEditor();
}

function closeEditor({ skipRender = false } = {}) {
  if (state.editorSaveTimer) {
    window.clearTimeout(state.editorSaveTimer);
    state.editorSaveTimer = 0;
  }
  closeEditorCloseWarning();
  state.selectedDay = null;
  state.editorDraft = { statusMode: "none", timePeriod: "PM", timeHour: "", timeMinute: "", dayNoteText: "", customImageDataUrl: "", entries: [] };
  state.editorDirty = false;
  closeModalElement(editorModalEl);
  if (!skipRender) {
    renderCalendar();
  }
}

async function saveAndCloseEditor() {
  if (state.editorSaveTimer) {
    window.clearTimeout(state.editorSaveTimer);
    state.editorSaveTimer = 0;
  }
  const saved = await saveEditorDraft({ force: true });
  if (saved) {
    closeEditor();
  }
}

async function requestEditorClose() {
  if (state.editorSaveTimer) {
    window.clearTimeout(state.editorSaveTimer);
    state.editorSaveTimer = 0;
  }
  if (hasEditorCloseTimeWarning()) {
    saveStatusEl.textContent = "";
    openModalElement(editorCloseWarningModalEl);
    return;
  }
  await saveAndCloseEditor();
}

function showNote(note) {
  if (!note) {
    return;
  }
  noteTitleEl.textContent = note.title || "메모";
  noteMetaEl.textContent = note.meta || "";
  noteContentEl.textContent = note.text || "";
  openModalElement(noteModalEl);
}

function hideNote() {
  closeModalElement(noteModalEl);
}

function openPrivacyPolicy() {
  openModalElement(privacyPolicyModalEl);
}

function closePrivacyPolicy() {
  closeModalElement(privacyPolicyModalEl);
}

function currentBaseMonth(year = state.selectedYear, month = state.selectedMonth) {
  const key = monthKey(year, month);
  const sourceMonth = state.bootstrap?.monthsByKey?.[key];
  if (sourceMonth) {
    return ensureMonthGrid(cloneData(sourceMonth));
  }
  return buildBlankMonth(year, month, state.bootstrap?.legend || []);
}

function unsubscribeCurrentMonth() {
  if (typeof firebaseState.currentMonthUnsubscribe === "function") {
    firebaseState.currentMonthUnsubscribe();
  }
  firebaseState.currentMonthUnsubscribe = null;
}

function unsubscribeEditorAccessListener() {
  if (typeof firebaseState.editorAccessUnsubscribe === "function") {
    firebaseState.editorAccessUnsubscribe();
  }
  firebaseState.editorAccessUnsubscribe = null;
}

function clearCalendarSearchHighlight() {
  if (state.calendarSearchHighlightTimer) {
    window.clearTimeout(state.calendarSearchHighlightTimer);
    state.calendarSearchHighlightTimer = 0;
  }
  state.calendarSearchHighlightKey = "";
}

function setCalendarSearchHighlight(year, month, day) {
  clearCalendarSearchHighlight();
  state.calendarSearchHighlightKey = `${monthKey(year, month)}:${Number(day)}`;
  state.calendarSearchHighlightTimer = window.setTimeout(() => {
    state.calendarSearchHighlightTimer = 0;
    state.calendarSearchHighlightKey = "";
    renderCalendar();
  }, 3400);
}

function syncCalendarSearchForm() {
  if (calendarSearchQueryEl) {
    calendarSearchQueryEl.value = state.calendarSearchQuery;
  }
  if (calendarSearchCategoryEl) {
    calendarSearchCategoryEl.value = state.calendarSearchCategory;
  }
  if (calendarSearchStartEl) {
    calendarSearchStartEl.value = state.calendarSearchStart;
  }
  if (calendarSearchEndEl) {
    calendarSearchEndEl.value = state.calendarSearchEnd;
  }
}

function renderCalendarSearchCategoryOptions() {
  if (!calendarSearchCategoryEl) {
    return;
  }
  calendarSearchCategoryEl.innerHTML = [
    '<option value="">전체</option>',
    ...(state.bootstrap?.legend || []).map(
      (item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label || item.key)}</option>`
    ),
  ].join("");
  calendarSearchCategoryEl.value = state.calendarSearchCategory;
}

function openCalendarSearch() {
  renderCalendarSearchCategoryOptions();
  syncCalendarSearchForm();
  renderCalendarSearchResults();
  openModalElement(calendarSearchModalEl);
}

function closeCalendarSearch() {
  closeModalElement(calendarSearchModalEl);
}

function versionHistoryActionLabel(action) {
  if (action === "restore") {
    return "복구";
  }
  if (action === "restore-backup") {
    return "복구 전 백업";
  }
  return "자동 저장";
}

function versionHistoryActionClass(action) {
  if (action === "restore") {
    return "restore";
  }
  if (action === "restore-backup") {
    return "backup";
  }
  return "save";
}

function renderVersionHistoryTrigger() {
  const visible = isAdminUser();
  versionHistoryTriggerEl?.classList.toggle("hidden", !visible);
  if (!visible) {
    closeVersionHistory();
  }
}

function renderVersionHistoryModal() {
  if (!versionHistoryListEl || !versionHistoryStatusEl || !versionHistoryTitleEl) {
    return;
  }
  versionHistoryTitleEl.textContent = versionHistoryMonthTitle();
  versionHistoryStatusEl.textContent = state.versionHistoryStatus || "관리자만 볼 수 있는 월별 기록입니다.";

  if (state.versionHistoryLoading) {
    versionHistoryListEl.innerHTML = '<div class="version-history-empty">버전 기록을 불러오는 중입니다.</div>';
    return;
  }

  if (!state.versionHistoryItems.length) {
    versionHistoryListEl.innerHTML = '<div class="version-history-empty">아직 저장된 버전 기록이 없습니다.</div>';
    return;
  }

  let previousDayLabel = "";
  versionHistoryListEl.innerHTML = state.versionHistoryItems.map((item) => {
    const dayLabel = formatVersionHistoryDayLabel(item.savedAt);
    const showSeparator = dayLabel !== previousDayLabel;
    previousDayLabel = dayLabel;
    const actionBusy = Boolean(state.versionHistoryRestoringId || state.versionHistoryDeletingId);
    const restoreDisabled = actionBusy && state.versionHistoryRestoringId !== item.id;
    const deleteDisabled = actionBusy && state.versionHistoryDeletingId !== item.id;
    const previewOpen = state.versionHistoryPreviewId === item.id;
    return `
      ${showSeparator ? `<div class="version-history-day-separator"><span>${escapeHtml(dayLabel)}</span></div>` : ""}
      <article class="version-history-item">
        <div class="version-history-top">
          <p class="version-history-date">편집일시 · ${escapeHtml(formatVersionHistoryDateTime(item.savedAt))}</p>
        </div>
        <p class="version-history-meta">편집자 · ${escapeHtml(item.savedBy || "이메일 정보 없음")}</p>
        <div class="version-history-actions">
          <button
            class="version-history-inspect"
            type="button"
            data-version-inspect="${escapeHtml(item.id)}"
          >${previewOpen ? "확인 닫기" : "편집 확인"}</button>
          <button
            class="version-history-restore"
            type="button"
            data-version-restore="${escapeHtml(item.id)}"
            ${restoreDisabled ? "disabled" : ""}
          >${state.versionHistoryRestoringId === item.id ? "복구 중..." : "이 버전으로 복구"}</button>
          <button
            class="version-history-delete"
            type="button"
            data-version-delete="${escapeHtml(item.id)}"
            ${deleteDisabled ? "disabled" : ""}
          >${state.versionHistoryDeletingId === item.id ? "삭제 중..." : "삭제"}</button>
        </div>
        ${renderVersionHistoryPreview(item)}
      </article>
    `;
  }).join("");
}

async function loadVersionHistory() {
  if (!isAdminUser() || !firebaseState.db) {
    state.versionHistoryItems = [];
    state.versionHistoryStatus = "버전 기록은 관리자만 볼 수 있습니다.";
    state.versionHistoryLoading = false;
    renderVersionHistoryModal();
    return;
  }

  const ref = currentMonthVersionHistoryRef();
  if (!ref) {
    state.versionHistoryItems = [];
    state.versionHistoryStatus = "버전 기록을 불러올 수 없습니다.";
    state.versionHistoryLoading = false;
    renderVersionHistoryModal();
    return;
  }

  state.versionHistoryLoading = true;
  state.versionHistoryStatus = "버전 기록을 불러오는 중입니다...";
  renderVersionHistoryModal();

  try {
    const snapshot = await ref.orderBy("savedAt", "desc").limit(VERSION_HISTORY_LIMIT).get();
    state.versionHistoryItems = snapshot.docs
      .map((doc) => normalizeVersionHistoryItem(doc))
      .filter((item) => item.id)
      .sort((a, b) => {
        const aTime = parseVersionHistoryDate(a.savedAt)?.getTime() || 0;
        const bTime = parseVersionHistoryDate(b.savedAt)?.getTime() || 0;
        return bTime - aTime;
      });
    state.versionHistoryStatus = state.versionHistoryItems.length
      ? `최신순으로 ${state.versionHistoryItems.length}개의 버전이 정렬되어 있습니다.`
      : "아직 저장된 버전 기록이 없습니다.";
  } catch (error) {
    state.versionHistoryItems = [];
    state.versionHistoryStatus = isFirestorePermissionError(error)
      ? "버전 기록 권한이 아직 적용되지 않았습니다. Firebase 규칙 게시 후 사용할 수 있습니다."
      : error?.message || "버전 기록을 불러오지 못했습니다.";
  } finally {
    state.versionHistoryLoading = false;
    renderVersionHistoryModal();
  }
}

function openVersionHistory() {
  if (!isAdminUser()) {
    return;
  }
  state.versionHistoryPreviewId = "";
  openModalElement(versionHistoryModalEl);
  void loadVersionHistory();
}

function closeVersionHistory() {
  closeModalElement(versionHistoryModalEl);
  state.versionHistoryRestoringId = "";
  state.versionHistoryDeletingId = "";
  state.versionHistoryPreviewId = "";
}

function formatStatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function updateVisitCounterDisplay() {
  if (!visitCounterEl) {
    return;
  }
  if (state.visitToday == null || state.visitTotal == null) {
    return;
  }
  visitCounterEl.textContent = `오늘 ${formatStatNumber(state.visitToday)} · 누적 ${formatStatNumber(state.visitTotal)}`;
  visitCounterEl.classList.remove("hidden");
}

async function recordSiteVisit() {
  const ref = siteStatsDocRef();
  if (!ref) {
    return;
  }
  const todayKey = todayKstDate();
  const alreadyCountedToday = window.localStorage?.getItem("visitCountedDate") === todayKey;
  try {
    if (!alreadyCountedToday) {
      try {
        await ref.update({ [`daily.${todayKey}`]: firebase.firestore.FieldValue.increment(1) });
      } catch (error) {
        if (error?.code === "not-found") {
          await ref.set({ daily: { [todayKey]: 1 } }, { merge: true });
        } else {
          throw error;
        }
      }
      window.localStorage?.setItem("visitCountedDate", todayKey);
    }
    const snapshot = await ref.get();
    const daily = (snapshot.exists && snapshot.data().daily) || {};
    const total = Object.values(daily).reduce((sum, value) => sum + (Number(value) || 0), 0);
    state.visitToday = Number(daily[todayKey] || 0);
    state.visitTotal = total;
    updateVisitCounterDisplay();
  } catch (error) {
    console.error(error);
  }
}

async function saveVersionHistoryEntry(snapshot, { changedDay = 0, action = "save", force = false } = {}) {
  if (!firebaseState.db || !currentAuth()?.canEdit) {
    return;
  }

  const normalizedSnapshot = normalizeVersionSnapshot(snapshot, state.selectedYear, state.selectedMonth);
  if (!Object.keys(normalizedSnapshot.days || {}).length) {
    return;
  }

  const ref = currentMonthVersionHistoryRef(normalizedSnapshot.year, normalizedSnapshot.month);
  if (!ref) {
    return;
  }

  const savedBy = String(currentAuth()?.email || "").trim().toLowerCase();
  if (!savedBy) {
    return;
  }

  const fingerprint = buildVersionHistoryFingerprint(normalizedSnapshot, changedDay);
  const now = Date.now();
  const payload = {
    monthKey: monthKey(normalizedSnapshot.year, normalizedSnapshot.month),
    year: normalizedSnapshot.year,
    month: normalizedSnapshot.month,
    savedAt: firestoreTimestamp(),
    savedBy,
    changedDay: Number(changedDay) || 0,
    action,
    snapshot: normalizedSnapshot,
    fingerprint,
  };

  if (!force && action === "save") {
    const sessionDocId = buildVersionHistorySessionDocId(savedBy, now);
    await ref.doc(sessionDocId).set(payload, { merge: false });
    return;
  }

  await ref.add(payload);
}

async function restoreVersionHistoryItem(versionId) {
  if (!isAdminUser() || !firebaseState.db || !versionId) {
    return;
  }
  const selectedVersion = state.versionHistoryItems.find((item) => item.id === versionId);
  if (!selectedVersion) {
    return;
  }

  const confirmMessage = `${versionHistoryMonthTitle(selectedVersion.year, selectedVersion.month)}의 기록을 ${formatVersionHistoryDateTime(selectedVersion.savedAt)} 버전으로 복구할까요?`;
  if (!window.confirm(confirmMessage)) {
    return;
  }

  const ref = currentMonthDocRef(selectedVersion.year, selectedVersion.month);
  if (!ref) {
    state.versionHistoryStatus = "복구 대상 문서를 찾지 못했습니다.";
    renderVersionHistoryModal();
    return;
  }

  state.versionHistoryRestoringId = versionId;
  state.versionHistoryStatus = "버전을 복구하는 중입니다...";
  renderVersionHistoryModal();

  try {
    const currentSnapshot = await ref.get();
    const currentData = normalizeVersionSnapshot(currentSnapshot.data() || {}, selectedVersion.year, selectedVersion.month);
    if (Object.keys(currentData.days || {}).length) {
      await saveVersionHistoryEntry(currentData, {
        changedDay: selectedVersion.changedDay,
        action: "restore-backup",
        force: true,
      });
    }

    await ref.set(
      {
        year: selectedVersion.snapshot.year,
        month: selectedVersion.snapshot.month,
        days: selectedVersion.snapshot.days,
        updatedAt: firestoreTimestamp(),
        restoredBy: String(currentAuth()?.email || "").trim().toLowerCase(),
        restoredFromVersionId: selectedVersion.id,
      },
      { merge: false }
    );

    await saveVersionHistoryEntry(selectedVersion.snapshot, {
      changedDay: selectedVersion.changedDay,
      action: "restore",
      force: true,
    });

    state.versionHistoryStatus = "선택한 버전으로 복구했습니다.";
    await loadVersionHistory();
  } catch (error) {
    state.versionHistoryStatus = error?.message || "버전 복구에 실패했습니다.";
    renderVersionHistoryModal();
  } finally {
    state.versionHistoryRestoringId = "";
    renderVersionHistoryModal();
  }
}

async function deleteVersionHistoryItem(versionId) {
  if (!isAdminUser() || !firebaseState.db || !versionId) {
    return;
  }
  const selectedVersion = state.versionHistoryItems.find((item) => item.id === versionId);
  if (!selectedVersion) {
    return;
  }

  const confirmMessage = `${formatVersionHistoryDateTime(selectedVersion.savedAt)} 기록을 삭제할까요?`;
  if (!window.confirm(confirmMessage)) {
    return;
  }

  const ref = currentMonthVersionHistoryRef(selectedVersion.year, selectedVersion.month);
  if (!ref) {
    state.versionHistoryStatus = "삭제 대상 기록을 찾지 못했습니다.";
    renderVersionHistoryModal();
    return;
  }

  state.versionHistoryDeletingId = versionId;
  state.versionHistoryStatus = "버전 기록을 삭제하는 중입니다...";
  renderVersionHistoryModal();

  try {
    await ref.doc(versionId).delete();
    state.versionHistoryItems = state.versionHistoryItems.filter((item) => item.id !== versionId);
    state.versionHistoryStatus = "버전 기록을 삭제했습니다.";
    await loadVersionHistory();
  } catch (error) {
    state.versionHistoryStatus = error?.message || "버전 기록 삭제에 실패했습니다.";
    renderVersionHistoryModal();
  } finally {
    state.versionHistoryDeletingId = "";
    renderVersionHistoryModal();
  }
}

function readCalendarSearchFilters() {
  return {
    query: String(calendarSearchQueryEl?.value || "").trim(),
    categoryKey: String(calendarSearchCategoryEl?.value || "").trim(),
    startDate: String(calendarSearchStartEl?.value || "").trim(),
    endDate: String(calendarSearchEndEl?.value || "").trim(),
  };
}

function setCalendarSearchFilters(filters = {}) {
  state.calendarSearchQuery = String(filters.query || "").trim();
  state.calendarSearchCategory = String(filters.categoryKey || "").trim();
  state.calendarSearchStart = String(filters.startDate || "").trim();
  state.calendarSearchEnd = String(filters.endDate || "").trim();
  syncCalendarSearchForm();
}

function resetCalendarSearch() {
  setCalendarSearchFilters({});
  state.calendarSearchResults = [];
  state.calendarSearchStatus = "검색어 또는 필터를 입력하면 일정 결과를 보여드릴게요.";
  renderCalendarSearchResults();
}

function parseDateFilterValue(value) {
  const text = String(value || "").trim();
  if (!/^\d{8}$/.test(text)) {
    return 0;
  }
  return Number(text);
}

function dayDateValue(year, month, day) {
  return Number(`${Number(year)}${String(Number(month)).padStart(2, "0")}${String(Number(day)).padStart(2, "0")}`);
}

function monthRangeValue(year, month) {
  return Number(`${Number(year)}${String(Number(month)).padStart(2, "0")}`);
}

function formatCalendarSearchDate(year, month, day) {
  return `${year}. ${String(month).padStart(2, "0")}. ${String(day).padStart(2, "0")}.`;
}

function updateCalendarSearchMonthCache(year, month, monthData) {
  const key = monthKey(year, month);
  if (!monthData) {
    state.calendarSearchMonthCache.delete(key);
    return;
  }
  state.calendarSearchMonthCache.set(key, cloneData(monthData));
}

async function getCalendarMonthForSearch(year, month) {
  const key = monthKey(year, month);
  if (state.selectedYear === Number(year) && state.selectedMonth === Number(month) && state.currentMonthData) {
    return cloneData(state.currentMonthData);
  }

  let monthData = null;
  const cachedMonth = state.calendarSearchMonthCache.get(key);
  if (cachedMonth) {
    monthData = ensureMonthGrid(cloneData(cachedMonth));
  } else {
    const bootstrapMonth = state.bootstrap?.monthsByKey?.[key];
    if (bootstrapMonth) {
      monthData = ensureMonthGrid(cloneData(bootstrapMonth));
    } else {
      // /api/calendar/<year>/<month>는 Flask 전용 라우트라 지금의 정적
      // 호스팅(Cloudflare Pages)에는 아예 존재하지 않는다 — 예전엔 이 주소로
      // fetch를 시도했는데, 존재하지 않는 경로라 200 OK로 index.html이
      // 대신 돌아와서 "로딩 실패"를 "일정 없음"으로 잘못 표시하는 버그가
      // 있었다. 애초에 정적 빌드가 monthsByKey에 프리즌 스냅샷+오버라이드를
      // 전부 담고 있어서, 백엔드가 있었어도 이 경로가 반환할 내용은 결국
      // "기록 없는 빈 달"과 동일하다 — 그러니 네트워크를 아예 타지 않고
      // 바로 빈 달을 만들어서 곧장 정확한 결과를 준다.
      monthData = ensureMonthGrid({ year: Number(year), month: Number(month), days: [] });
    }
  }

  if (firebaseState.db) {
    try {
      const ref = currentMonthDocRef(year, month);
      const snapshot = ref ? await ref.get() : null;
      monthData = applyMonthOverrideData(monthData, snapshot?.data() || {});
    } catch (error) {
      console.warn("일정 검색용 월 데이터를 최신 편집본과 합치지 못했습니다.", error);
    }
  }

  updateCalendarSearchMonthCache(year, month, monthData);
  return cloneData(monthData);
}

function searchMonthCandidates(filters) {
  const startMonth = filters.startDate ? Number(String(filters.startDate).slice(0, 6)) : 0;
  const endMonth = filters.endDate ? Number(String(filters.endDate).slice(0, 6)) : 0;
  const bounds = calendarBounds();
  const months = [];

  for (let year = Number(bounds.minYear); year <= Number(bounds.maxYear); year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      months.push({ year, month });
    }
  }

  return months.filter((month) => {
    const value = monthRangeValue(month.year, month.month);
    if (startMonth && value < startMonth) {
      return false;
    }
    if (endMonth && value > endMonth) {
      return false;
    }
    return true;
  });
}

function buildCalendarSearchResult(entry, day, monthData) {
  return {
    key: `${monthKey(monthData.year, monthData.month)}:${day.day}:${entry.categoryKey}:${entry.text}:${entry.noteText || ""}`,
    year: monthData.year,
    month: monthData.month,
    day: day.day,
    title: String(entry.text || "").trim(),
    noteText: String(entry.noteText || "").trim(),
    categoryKey: String(entry.categoryKey || "").trim(),
    categoryLabel: String(entry.categoryLabel || "").trim(),
    categoryColor: String(entry.categoryColor || CATEGORY_FALLBACKS[entry.categoryKey] || "#dff7fb"),
    dateValue: dayDateValue(monthData.year, monthData.month, day.day),
  };
}

function renderCalendarSearchResults() {
  if (calendarSearchStatusEl) {
    calendarSearchStatusEl.textContent = state.calendarSearchStatus || "검색어 또는 필터를 입력하면 일정 결과를 보여드릴게요.";
  }
  if (!calendarSearchResultsEl) {
    return;
  }
  if (!state.calendarSearchResults.length) {
    calendarSearchResultsEl.innerHTML = `<div class="calendar-search-empty">${escapeHtml(state.calendarSearchStatus || "검색 결과가 없습니다.")}</div>`;
    return;
  }
  calendarSearchResultsEl.innerHTML = state.calendarSearchResults
    .map((item) => `
      <button
        type="button"
        class="calendar-search-result"
        data-search-year="${item.year}"
        data-search-month="${item.month}"
        data-search-day="${item.day}"
        title="${escapeHtml(item.title)}${item.noteText ? ` / ${escapeHtml(item.noteText)}` : ""}"
      >
        <div class="calendar-search-result-top">
          <span class="calendar-search-result-date">${escapeHtml(formatCalendarSearchDate(item.year, item.month, item.day))}</span>
          <span class="calendar-search-result-category" style="background:${escapeHtml(item.categoryColor)};">${escapeHtml(item.categoryLabel || item.categoryKey || "일정")}</span>
        </div>
        <p class="calendar-search-result-title">${escapeHtml(truncateText(item.title, 88))}</p>
        ${item.noteText ? `<p class="calendar-search-result-note">${escapeHtml(truncateText(item.noteText, 110))}</p>` : ""}
      </button>
    `)
    .join("");
}

async function runCalendarSearch(filters = readCalendarSearchFilters()) {
  const normalizedFilters = {
    query: String(filters.query || "").trim().toLowerCase(),
    categoryKey: String(filters.categoryKey || "").trim(),
    startDate: String(filters.startDate || "").trim(),
    endDate: String(filters.endDate || "").trim(),
  };
  setCalendarSearchFilters(filters);
  const hasFilter = Boolean(
    normalizedFilters.query ||
    normalizedFilters.categoryKey ||
    normalizedFilters.startDate ||
    normalizedFilters.endDate
  );
  if (!hasFilter) {
    state.calendarSearchResults = [];
    state.calendarSearchStatus = "검색어 또는 필터를 입력하면 일정 결과를 보여드릴게요.";
    renderCalendarSearchResults();
    return;
  }

  const startValue = parseDateFilterValue(normalizedFilters.startDate);
  const endValue = parseDateFilterValue(normalizedFilters.endDate);
  if (normalizedFilters.startDate && !startValue) {
    state.calendarSearchResults = [];
    state.calendarSearchStatus = "시작일은 8자리 숫자 형식으로 입력해주세요. 예. 20260401";
    renderCalendarSearchResults();
    return;
  }
  if (normalizedFilters.endDate && !endValue) {
    state.calendarSearchResults = [];
    state.calendarSearchStatus = "종료일은 8자리 숫자 형식으로 입력해주세요. 예. 20260401";
    renderCalendarSearchResults();
    return;
  }
  if (startValue && endValue && startValue > endValue) {
    state.calendarSearchResults = [];
    state.calendarSearchStatus = "시작일이 종료일보다 늦을 수는 없어요.";
    renderCalendarSearchResults();
    return;
  }

  const months = searchMonthCandidates(normalizedFilters);
  if (!months.length) {
    state.calendarSearchResults = [];
    state.calendarSearchStatus = "해당 기간에 검색할 일정이 없습니다.";
    renderCalendarSearchResults();
    return;
  }

  state.calendarSearchInFlight = true;
  state.calendarSearchStatus = "일정을 검색하는 중입니다...";
  renderCalendarSearchResults();

  try {
    const monthPayloads = await Promise.all(months.map((item) => getCalendarMonthForSearch(item.year, item.month)));
    const results = [];

    monthPayloads.forEach((monthData) => {
      (monthData.days || []).forEach((day) => {
        const currentDateValue = dayDateValue(monthData.year, monthData.month, day.day);
        if (startValue && currentDateValue < startValue) {
          return;
        }
        if (endValue && currentDateValue > endValue) {
          return;
        }
        (day.entries || []).forEach((entry) => {
          const title = String(entry.text || "").trim();
          const noteText = String(entry.noteText || "").trim();
          const categoryKey = String(entry.categoryKey || "").trim();
          const haystack = `${title}\n${noteText}`.toLowerCase();
          if (!title) {
            return;
          }
          if (normalizedFilters.categoryKey && normalizedFilters.categoryKey !== categoryKey) {
            return;
          }
          if (normalizedFilters.query && !haystack.includes(normalizedFilters.query)) {
            return;
          }
          results.push(buildCalendarSearchResult(entry, day, monthData));
        });
      });
    });

    results.sort((a, b) => a.dateValue - b.dateValue || a.title.localeCompare(b.title, "ko"));
    state.calendarSearchResults = results.slice(0, CALENDAR_SEARCH_RESULT_LIMIT);
    state.calendarSearchStatus = results.length
      ? results.length > CALENDAR_SEARCH_RESULT_LIMIT
        ? `총 ${results.length}개 중 ${CALENDAR_SEARCH_RESULT_LIMIT}개까지 보여드릴게요.`
        : `총 ${results.length}개의 일정을 찾았습니다.`
      : "조건에 맞는 일정이 없습니다.";
  } catch (error) {
    state.calendarSearchResults = [];
    state.calendarSearchStatus = error?.message || "일정 검색에 실패했습니다.";
  } finally {
    state.calendarSearchInFlight = false;
    renderCalendarSearchResults();
  }
}

async function moveToCalendarSearchResult(year, month, day) {
  closeCalendarSearch();
  setCalendarSearchHighlight(year, month, day);
  await loadMonth(year, month, true);
  renderCalendar();
  window.setTimeout(() => {
    const target = calendarGridEl?.querySelector(`.calendar-day[data-day="${Number(day)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, 120);
}

function applyEditorPermission(canEdit) {
  syncAuthFromUser(firebaseState.auth?.currentUser || null, canEdit);
  if (state.pendingPermissionNotice && firebaseState.auth?.currentUser) {
    flashAuthStatusMessage(
      canEdit ? "편집 권한이 확인되었습니다." : "읽기 전용입니다"
    );
    state.pendingPermissionNotice = false;
  }
  renderAuth();
  renderPostit();
  renderCountdowns();
  refreshSongbook();
  renderCalendar();
}

function subscribeEditorAccessDocument(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  unsubscribeEditorAccessListener();

  if (!email) {
    applyEditorPermission(false);
    return;
  }

  const ref = editorAccessDocRef(email);
  if (!ref) {
    applyEditorPermission(false);
    return;
  }

  firebaseState.editorAccessUnsubscribe = ref.onSnapshot(
    (snapshot) => {
      const payload = snapshot.data();
      const canEdit = snapshot.exists && payload?.enabled !== false;
      applyEditorPermission(canEdit);
    },
    () => {
      applyEditorPermission(false);
    }
  );
}

function applySongbookPayload(items) {
  state.songbookItems = normalizeSongbookItems(items);
  const meta = deriveSongbookMeta(state.songbookItems);
  state.songbookCategories = meta.categories;
  state.songbookArtists = meta.artists;
  state.songbookTags = meta.tags;
  if (state.bootstrap?.songbookSummary) {
    state.bootstrap.songbookSummary.count = state.songbookItems.length;
    state.bootstrap.songbookSummary.categories = meta.categories.slice();
    state.bootstrap.songbookSummary.artists = meta.artists.slice();
  }
  refreshSongbook();
}

function subscribeSongbookDocument() {
  const ref = songbookDocRef();
  if (!ref) {
    applySongbookPayload(state.bootstrap?.songbook?.items || []);
    return;
  }
  firebaseState.songbookUnsubscribe = ref.onSnapshot(
    (snapshot) => {
      const payload = snapshot.data();
      applySongbookPayload(payload?.items || state.bootstrap?.songbook?.items || []);
    },
    () => {
      applySongbookPayload(state.bootstrap?.songbook?.items || []);
    }
  );
}

function subscribePostitDocument() {
  const ref = postitDocRef();
  if (!ref) {
    state.postitItems = normalizePostitItems(state.bootstrap?.postit?.items || [], { keepBlank: true, ensureOne: true });
    state.countdownItems = normalizeCountdownItems(state.bootstrap?.postit?.countdowns || [], { keepBlank: true, ensureOne: true });
    state.postitUpdatedAt = state.bootstrap?.postit?.updatedAt || "";
    renderPostit();
    renderCountdowns();
    return;
  }
  firebaseState.postitUnsubscribe = ref.onSnapshot(
    (snapshot) => {
      const payload = snapshot.data();
      const nextItems = normalizePostitItems(payload?.items || state.bootstrap?.postit?.items || [], { keepBlank: true, ensureOne: true });
      const nextCountdowns = normalizeCountdownItems(payload?.countdowns || state.bootstrap?.postit?.countdowns || [], { keepBlank: true, ensureOne: true });
      const nextUpdatedAt = String(payload?.updatedAt || state.bootstrap?.postit?.updatedAt || "");
      const nextSyncKey = sharedBoardKey(nextItems, nextCountdowns);
      const activePostitFocus = capturePostitFocus();
      state.postitItems = nextItems;
      state.countdownItems = nextCountdowns;
      state.postitUpdatedAt = nextUpdatedAt;
      if (activePostitFocus && state.postitSyncKey && state.postitSyncKey === nextSyncKey) {
        state.postitSyncKey = "";
        return;
      }
      state.postitSyncKey = "";
      renderPostit();
      renderCountdowns();
    },
    () => {
      state.postitItems = normalizePostitItems(state.bootstrap?.postit?.items || [], { keepBlank: true, ensureOne: true });
      state.countdownItems = normalizeCountdownItems(state.bootstrap?.postit?.countdowns || [], { keepBlank: true, ensureOne: true });
      state.postitUpdatedAt = state.bootstrap?.postit?.updatedAt || "";
      state.postitSyncKey = "";
      renderPostit();
      renderCountdowns();
    }
  );
}

function subscribeCurrentMonthDocument(requestId) {
  const ref = currentMonthDocRef();
  if (!ref) {
    state.currentMonthData = currentBaseMonth();
    state.monthLoading = false;
    renderCalendar();
    return;
  }

  firebaseState.currentMonthUnsubscribe = ref.onSnapshot(
    (snapshot) => {
      if (requestId !== state.monthRequestId) {
        return;
      }
      const nextMonth = applyMonthOverrideData(currentBaseMonth(), snapshot.data() || {});
      state.currentMonthData = nextMonth;
      state.monthLoading = false;
      if (state.selectedYear === todayKstParts().year && state.selectedMonth === todayKstParts().month) {
        state.homeMonthData = nextMonth;
        renderHomeAgenda();
      }
      updateCalendarSearchMonthCache(state.selectedYear, state.selectedMonth, nextMonth);
      renderCalendar();
    },
    () => {
      if (requestId !== state.monthRequestId) {
        return;
      }
      state.currentMonthData = currentBaseMonth();
      state.monthLoading = false;
      updateCalendarSearchMonthCache(state.selectedYear, state.selectedMonth, state.currentMonthData);
      renderCalendar();
    }
  );
}

function readHomeMonthCache(year, month) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(`${HOME_MONTH_CACHE_PREFIX}${monthKey(year, month)}`) || "null");
    const age = Date.now() - Number(cached?.savedAt);
    if (!cached?.days || !Number.isFinite(age) || age < 0 || age > HOME_MONTH_CACHE_MAX_AGE_MS) return null;
    return cached.days;
  } catch {
    return null;
  }
}

function writeHomeMonthCache(year, month, data) {
  try {
    // 홈 카드에 필요한 항목만 저장한다. 달력 이미지와 메모는 캐시에 넣지 않는다.
    const days = Object.fromEntries(Object.entries(data?.days || {}).map(([day, value]) => [day, {
      timeLabel: value?.timeLabel || "",
      entries: (value?.entries || []).map((entry) => ({ text: entry?.text || "", categoryKey: entry?.categoryKey || "" })),
    }]));
    window.localStorage.setItem(`${HOME_MONTH_CACHE_PREFIX}${monthKey(year, month)}`, JSON.stringify({ savedAt: Date.now(), days }));
  } catch {
    // 저장 공간을 사용할 수 없어도 실시간 일정은 그대로 표시한다.
  }
}

function subscribeHomeMonthDocument() {
  const today = todayKstParts();
  const next = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 };
  const currentBase = currentBaseMonth(today.year, today.month);
  const nextBase = currentBaseMonth(next.year, next.month);
  const cachedCurrent = readHomeMonthCache(today.year, today.month);
  const cachedNext = readHomeMonthCache(next.year, next.month);
  state.homeMonthData = cachedCurrent ? applyMonthOverrideData(currentBase, { days: cachedCurrent }) : currentBase;
  state.homeNextMonthData = cachedNext ? applyMonthOverrideData(nextBase, { days: cachedNext }) : nextBase;
  state.homeMonthPending = !cachedCurrent && !state.bootstrap?.monthsByKey?.[monthKey(today.year, today.month)] && Boolean(firebaseState.db);
  state.homeNextMonthPending = !cachedNext && !state.bootstrap?.monthsByKey?.[monthKey(next.year, next.month)] && Boolean(firebaseState.db);
  renderHomeAgenda();
  const ref = currentMonthDocRef(today.year, today.month);
  if (ref) {
    ref.onSnapshot(
      (snapshot) => {
        state.homeMonthData = applyMonthOverrideData(currentBaseMonth(today.year, today.month), snapshot.data() || {});
        state.homeMonthPending = false;
        if (!snapshot.metadata.fromCache) writeHomeMonthCache(today.year, today.month, snapshot.data());
        renderHomeAgenda();
      },
      () => {
        state.homeMonthPending = false;
        renderHomeAgenda();
      }
    );
  }
  // 오늘 이후 이번 달에 방송이 없으면 다음 달 첫 방송을 "다음 일정"으로 보여줘야 해서
  // 다음 달 문서도 같이 구독한다.
  const nextRef = currentMonthDocRef(next.year, next.month);
  if (nextRef) {
    nextRef.onSnapshot(
      (snapshot) => {
        state.homeNextMonthData = applyMonthOverrideData(currentBaseMonth(next.year, next.month), snapshot.data() || {});
        state.homeNextMonthPending = false;
        if (!snapshot.metadata.fromCache) writeHomeMonthCache(next.year, next.month, snapshot.data());
        renderHomeAgenda();
      },
      () => {
        state.homeNextMonthPending = false;
        renderHomeAgenda();
      }
    );
  }
}

async function openGoogleLogin() {
  if (!firebaseState.auth) {
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  clearTransientAuthMessage();
  showAuthMessage("");
  state.pendingPermissionNotice = true;
  await firebaseState.auth.signInWithPopup(provider);
}

async function logoutCurrentUser() {
  if (!firebaseState.auth) {
    return;
  }
  state.pendingPermissionNotice = false;
  clearTransientAuthMessage();
  await firebaseState.auth.signOut();
}

function previousYearTodayParts() {
  const today = todayKstParts();
  const year = today.year - 1;
  const day = Math.min(today.day, daysInMonth(year, today.month));
  return { year, month: today.month, day };
}

function formatMemoryTodayDate(dateParts) {
  return `${String(dateParts.year).slice(-2)}/${dateParts.month}/${dateParts.day}`;
}

function memoryTodayEntryHtml(entry) {
  const label = String(entry?.text || "").trim() || "내용 없는 일정";
  const noteText = String(entry?.noteText || "").trim();
  const categoryKey = String(entry?.categoryKey || "").trim();
  const categoryLabel = categoryLabelForKey(categoryKey);
  const color = entry?.categoryColor || CATEGORY_FALLBACKS[categoryKey] || "#dff7fb";
  return `
    <article class="memory-today-entry" style="--memory-entry-color:${escapeHtml(color)}">
      <span class="memory-today-entry-dot" aria-hidden="true"></span>
      <div>
        <p class="memory-today-entry-title">${escapeHtml(label)}</p>
        <p class="memory-today-entry-meta">${escapeHtml(categoryLabel)}${noteText ? ` · ${escapeHtml(noteText)}` : ""}</p>
      </div>
    </article>
  `;
}

function renderMemoryTodayDay(day) {
  if (!memoryTodayResultEl || !memoryTodayDateEl) {
    return;
  }
  const target = state.memoryTodayDate;
  const entries = Array.isArray(day?.entries) ? day.entries : [];
  const visibleEntries = entries.slice(0, 3);
  const timeLabel = String(day?.timeLabel || "").trim();
  const isOff = Boolean(day?.isOff || timeLabel === "휴뱅" || timeLabel === "휴방");
  const statusLabel = isOff ? "휴뱅" : (timeLabel || "기록 없음");
  const statusClass = isOff ? "is-off" : (timeLabel ? "is-live" : "is-empty");
  const dayNoteText = String(day?.noteText || "").trim();

  memoryTodayDateEl.textContent = formatMemoryTodayDate(target);
  memoryTodayResultEl.innerHTML = `
    <div class="memory-today-status ${statusClass}">
      <span>방송</span>
      <strong>${escapeHtml(statusLabel)}</strong>
    </div>
    <div class="memory-today-entries">
      ${visibleEntries.length
        ? visibleEntries.map(memoryTodayEntryHtml).join("")
        : (isOff ? "" : '<p class="memory-today-empty">등록된 일정이 없어요.</p>')}
      ${entries.length > visibleEntries.length ? `<p class="memory-today-more">외 ${entries.length - visibleEntries.length}개 일정</p>` : ""}
    </div>
    ${dayNoteText ? `<p class="memory-today-note">메모 · ${escapeHtml(dayNoteText)}</p>` : ""}
  `;
}

async function refreshMemoryToday() {
  if (!memoryTodayResultEl || !memoryTodayDateEl) {
    return;
  }
  const target = previousYearTodayParts();
  state.memoryTodayDate = target;
  memoryTodayDateEl.textContent = formatMemoryTodayDate(target);
  memoryTodayResultEl.innerHTML = '<p class="memory-today-loading">기록을 찾는 중...</p>';

  try {
    const monthData = await getCalendarMonthForSearch(target.year, target.month);
    const day = monthData?.days?.find((item) => Number(item.day) === target.day) || createBlankDay(target.day, 0);
    renderMemoryTodayDay(day);
  } catch (error) {
    console.error(error);
    memoryTodayResultEl.innerHTML = '<p class="memory-today-empty">기록을 불러오지 못했어요.</p>';
  }
}

async function loadMonth(year, month, shouldScroll = true) {
  closeEditor({ skipRender: true });
  state.selectedYear = Number(year);
  state.selectedMonth = Number(month);
  setSongbookOpen(false);
  setGameOpen(false);
  setViewerOpen(true);

  const requestId = ++state.monthRequestId;
  unsubscribeCurrentMonth();
  const cachedMonth = state.calendarSearchMonthCache.get(monthKey(state.selectedYear, state.selectedMonth));
  state.monthLoading = true;
  state.currentMonthData = cachedMonth ? ensureMonthGrid(cloneData(cachedMonth)) : (firebaseState.db ? null : currentBaseMonth(state.selectedYear, state.selectedMonth));
  renderCalendar();

  if (firebaseState.db) {
    subscribeCurrentMonthDocument(requestId);
  } else {
    state.monthLoading = false;
  }

  if (shouldScroll) {
    viewerShellEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function goToMobileDate(targetDate, shouldScroll = false) {
  const nextDate = normalizeCalendarDate(targetDate);
  state.mobileSelectedDate = nextDate;
  if (Number(nextDate.year) === Number(state.selectedYear) && Number(nextDate.month) === Number(state.selectedMonth)) {
    renderCalendar();
    if (shouldScroll) {
      viewerShellEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }
  await loadMonth(nextDate.year, nextDate.month, shouldScroll);
}

function goToAdjacentMonth(direction) {
  const bounds = calendarBounds();
  let nextYear = state.selectedYear;
  let nextMonth = state.selectedMonth + direction;

  if (nextMonth < 1) {
    nextYear -= 1;
    nextMonth = 12;
  } else if (nextMonth > 12) {
    nextYear += 1;
    nextMonth = 1;
  }

  if (nextYear < bounds.minYear || nextYear > bounds.maxYear) {
    return;
  }
  loadMonth(nextYear, nextMonth, false);
  setTimeout(() => {
    viewerShellEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function goToAdjacentYear(direction) {
  const bounds = calendarBounds();
  const nextYear = state.selectedYear + direction;
  if (nextYear < bounds.minYear || nextYear > bounds.maxYear) {
    return;
  }
  loadMonth(nextYear, state.selectedMonth, false);
  setTimeout(() => {
    viewerShellEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function openSongbook(shouldScroll = true) {
  setViewerOpen(false);
  setGameOpen(false);
  closeEditor();
  setSongbookOpen(true);
  refreshSongbook();
  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function openCurrentMonth() {
  const currentMonth = resolveAutoMonth();
  loadMonth(currentMonth.year, currentMonth.month);
  window.scrollTo({ top: 0, behavior: "auto" });
}

// 마블 레이스 게임(static/game/*.js)은 별도 모듈로 분리돼 있는데, 예전엔
// index.html이 무조건 <script>로 미리 불러왔다 — 게임 탭을 한 번도 안 눌러도
// 물리엔진(Box2D)+게임 이미지까지 650KB 가까이 매번 받아야 했다("첫 화면이
// 느리다" 피드백). 이제 "게임" 탭을 처음 열 때만 동적으로 스크립트를 순서대로
// 불러오고, 그 다음부터는 캐시된 Promise를 그대로 재사용한다.
const GAME_SCRIPT_SRCS = [
  ["/static/game/vendor/box2d/entry.js", { "data-box2d-dir": "/static/game/vendor/box2d" }],
  ["/static/game/course.js"],
  ["/static/game/physics.js"],
  ["/static/game/camera.js"],
  ["/static/game/renderer.js"],
  ["/static/game/marble-race.js"],
  ["/static/game/soop-chat.js"],
  ["/static/game/bgm.js"],
  ["/static/game/ui.js"],
];

function loadScriptOnce(src, attrs) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value));
    }
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
    document.body.appendChild(script);
  });
}

let gameScriptsPromise = null;
function loadGameScripts() {
  if (!gameScriptsPromise) {
    // 게임 모듈끼리 서로의 전역(MarblePhysics, MarbleCamera 등)에 기대고
    // 있어서 순서를 지켜 하나씩 불러와야 한다 — 병렬로 넣으면 실행 순서가
    // 뒤섞여 "OOO is not defined" 오류가 난다.
    gameScriptsPromise = GAME_SCRIPT_SRCS.reduce(
      (chain, [src, attrs]) => chain.then(() => loadScriptOnce(src, attrs)),
      Promise.resolve()
    );
  }
  return gameScriptsPromise;
}

function initPinballGame() {
  if (window.initRaceUI) {
    window.initRaceUI();
    return;
  }
  const loadingEl = document.getElementById("race-game-loading");
  loadGameScripts()
    .then(() => {
      window.initRaceUI?.();
      loadingEl?.classList.add("hidden");
    })
    .catch((error) => {
      console.error(error);
      gameScriptsPromise = null;
      if (loadingEl) {
        loadingEl.textContent = "게임을 불러오지 못했어요. 새로고침해주세요.";
      }
    });
}

async function init() {
  applyTheme(preferredTheme());
  // 작은 공개 일정은 큰 기본 데이터 파일과 병렬로 요청한다.
  const publicAgendaPromise = fetchJson("/api/home-agenda").catch(() => null);
  // 첫 화면 입장 연출(renewal.css의 body.is-intro)은 처음 열었을 때 한 번만 재생한다.
  // 제목 글꼴이 도착한 뒤에 시작해야 기본 글꼴로 보이는 순간이 없다 — 그동안은 감춰 두고,
  // 느린 환경에서도 1.5초 넘게 기다리지는 않는다.
  document.body.classList.add("is-font-wait");
  const titleFontReady = document.fonts?.load ? document.fonts.load('600 1em "Pretendard Title"', "빈스 캘린더").catch(() => {}) : Promise.resolve();
  Promise.race([titleFontReady, new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(() => {
    document.body.classList.remove("is-font-wait");
    document.body.classList.add("is-intro");
    const introDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 3200;
    window.setTimeout(() => {
      document.body.classList.remove("is-intro");
      state.homeIntroFinished = true;
      if (state.bootstrap) renderHomeAgenda();
    }, introDuration);
  });
  enableLocalHeroBackgroundPreview();
  setHeroVideos(localHeroVideoSources());
  bindHeroMotion();
  bindMobileNavAutoHide();
  // 레이스 우승 화면(.race-winner-name)이 Black Han Sans를 쓰는데, 사이트
  // 어디에도 이 폰트를 미리 쓰는 곳이 없어서 그동안 늦게 로드되며 기본
  // 폰트로 잠깐 보였다 바뀌었다 — 페이지 로드 시점에 미리 요청해둔다.
  // (실제 우승 화면을 띄우기 직전에도 한 번 더 로드 완료를 기다린다 —
  // ui.js의 onRaceEnd 참고.)
  document.fonts?.load('40px "Black Han Sans"').catch(() => {});

  try {
    state.bootstrap = await loadSiteData();
  } catch {
    console.error("Static data load failed");
    return;
  }

  initializeFirebase();
  state.bootstrap.links = { ...DEFAULT_LINKS, ...(state.bootstrap.links || {}) };
  state.bootstrap.auth = createAuthState();
  state.monthsByYear = groupMonthsByYear(state.bootstrap.months || []);
  state.sortedMonths = [...(state.bootstrap.months || [])].sort((a, b) => monthSortValue(a) - monthSortValue(b));
  const defaultMonth = resolveAutoMonth() || state.bootstrap.initial || state.sortedMonths[0] || null;
  state.selectedYear = defaultMonth?.year || 0;
  state.selectedMonth = defaultMonth?.month || 0;
  state.liveStatus = buildDefaultLiveStatus();
  state.homeMonthData = currentBaseMonth();
  state.calendarSearchStatus = "검색어 또는 필터를 입력하면 일정 결과를 보여드릴게요.";
  state.youtubeItems = readYoutubeCache();
  if (!state.youtubeItems.length) {
    state.youtubeItems = normalizeYoutubeItems(state.bootstrap.youtubeFallback || []);
  }
  applySongbookPayload(state.bootstrap.songbook?.items || []);
  state.postitItems = normalizePostitItems(state.bootstrap.postit?.items || []);
  state.countdownItems = normalizeCountdownItems(state.bootstrap.postit?.countdowns || []);
  state.postitUpdatedAt = state.bootstrap.postit?.updatedAt || "";
  renderAuth();
  renderHeroCurrentMonth();
  renderLegend();
  renderProfile();
  renderLiveStatus();
  subscribeHomeMonthDocument();
  void publicAgendaPromise.then((preview) => {
    if (!preview?.today || !("next" in preview)) return;
    state.homeAgendaPreview = preview;
    renderHomeAgenda();
  });
  renderCafeNotice();
  renderCalendarSearchCategoryOptions();
  renderCalendarSearchResults();
  renderYoutube();
  renderPostit();
  renderCountdowns();
  void refreshMemoryToday();
  void recordSiteVisit();

  if (firebaseState.auth) {
    firebaseState.auth.onAuthStateChanged((user) => {
      if (!user) {
        unsubscribeEditorAccessListener();
        state.pendingPermissionNotice = false;
        clearTransientAuthMessage();
        syncAuthFromUser(null, false);
        renderAuth();
        renderPostit();
        renderCountdowns();
        refreshSongbook();
        renderCalendar();
        return;
      }
      syncAuthFromUser(user, false);
      renderAuth();
      renderPostit();
      renderCountdowns();
      refreshSongbook();
      renderCalendar();
      subscribeEditorAccessDocument(user);
    });
  }

  if (firebaseState.db) {
    subscribeSongbookDocument();
    subscribePostitDocument();
  }

  await refreshYoutubeItems();

  const [liveResult, cafeNoticeResult] = await Promise.allSettled([
    refreshLiveStatus(),
    refreshCafeNotice(),
  ]);

  if (liveResult.status !== "fulfilled") {
    renderProfile();
    renderLiveStatus();
  }
  if (state.livePollTimer) {
    window.clearInterval(state.livePollTimer);
  }
  state.livePollTimer = window.setInterval(() => {
    void refreshLiveStatus();
  }, 60000);
  if (state.cafeNoticePollTimer) {
    window.clearInterval(state.cafeNoticePollTimer);
  }
  state.cafeNoticePollTimer = window.setInterval(() => {
    void refreshCafeNotice();
  }, 10 * 60 * 1000);

  if (cafeNoticeResult.status !== "fulfilled") {
    renderCafeNotice();
  }
  renderYoutube();
}

themeToggleEl.addEventListener("click", () => {
  toggleTheme();
});

// 모바일에서 "건의사항 남기기" 버튼이 다른 UI와 겹쳐 위치가 애매하다는 피드백에
// 따라, 모바일 폭에서는 기본적으로 아이콘만 보이는 작은 버튼으로 접어두고
// 첫 탭에는 라벨만 펼치고(폼으로 이동하지 않음), 펼쳐진 상태에서 다시 탭하거나
// 라벨을 탭해야 실제로 폼이 열리게 한다. 데스크톱에서는 원래대로 항상 펼쳐진
// 채로 즉시 이동한다.
const feedbackFabEl = document.getElementById("feedback-fab");
if (feedbackFabEl) {
  const isMobileFeedbackFab = () => window.matchMedia("(max-width: 760px)").matches;
  feedbackFabEl.addEventListener("click", (event) => {
    if (!isMobileFeedbackFab()) {
      return;
    }
    if (!feedbackFabEl.classList.contains("is-expanded")) {
      event.preventDefault();
      feedbackFabEl.classList.add("is-expanded");
    }
  });
  document.addEventListener("click", (event) => {
    if (feedbackFabEl.classList.contains("is-expanded") && !feedbackFabEl.contains(event.target)) {
      feedbackFabEl.classList.remove("is-expanded");
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    return;
  }
  void refreshMemoryToday();
});

window.addEventListener("resize", () => {
  refreshSongbook();
});

openCurrentMonthEl?.addEventListener("click", openCurrentMonth);
brandHomeEl?.addEventListener("click", goHome);
openSongbookHeroEl?.addEventListener("click", () => openSongbook());

sideNavItemEls.forEach((item) => {
  item.addEventListener("click", () => {
    const target = item.dataset.nav;
    if (target === "calendar") {
      openCurrentMonth();
    } else if (target === "songbook") {
      openSongbook();
    } else if (target === "game") {
      openGame();
    } else {
      goHome();
    }
  });
});
privacyPolicyTriggerEl?.addEventListener("click", openPrivacyPolicy);
privacyPolicyCloseEl?.addEventListener("click", closePrivacyPolicy);
privacyPolicyModalEl?.addEventListener("click", (event) => {
  if (event.target === privacyPolicyModalEl) {
    closePrivacyPolicy();
  }
});

calendarSearchTriggerEl?.addEventListener("click", openCalendarSearch);
calendarSearchResetEl?.addEventListener("click", resetCalendarSearch);
calendarSearchCloseEl?.addEventListener("click", closeCalendarSearch);
calendarSearchFormEl?.addEventListener("submit", (event) => {
  event.preventDefault();
  void runCalendarSearch();
});
calendarSearchModalEl?.addEventListener("click", (event) => {
  if (event.target === calendarSearchModalEl) {
    closeCalendarSearch();
  }
});
versionHistoryTriggerEl?.addEventListener("click", openVersionHistory);
versionHistoryCloseEl?.addEventListener("click", closeVersionHistory);
versionHistoryModalEl?.addEventListener("click", (event) => {
  if (event.target === versionHistoryModalEl) {
    closeVersionHistory();
  }
});
versionHistoryListEl?.addEventListener("click", (event) => {
  const inspectButton = event.target.closest("[data-version-inspect]");
  if (inspectButton) {
    const versionId = inspectButton.dataset.versionInspect || "";
    state.versionHistoryPreviewId = state.versionHistoryPreviewId === versionId ? "" : versionId;
    renderVersionHistoryModal();
    return;
  }
  const restoreButton = event.target.closest("[data-version-restore]");
  if (restoreButton) {
    void restoreVersionHistoryItem(restoreButton.dataset.versionRestore || "");
    return;
  }
  const deleteButton = event.target.closest("[data-version-delete]");
  if (!deleteButton) {
    return;
  }
  void deleteVersionHistoryItem(deleteButton.dataset.versionDelete || "");
});
calendarSearchResultsEl?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-year][data-search-month][data-search-day]");
  if (!button) {
    return;
  }
  const year = Number(button.dataset.searchYear);
  const month = Number(button.dataset.searchMonth);
  const day = Number(button.dataset.searchDay);
  if (!year || !month || !day) {
    return;
  }
  void moveToCalendarSearchResult(year, month, day);
});

yearPrevEl.addEventListener("click", () => goToAdjacentYear(-1));
yearNextEl.addEventListener("click", () => goToAdjacentYear(1));
monthPrevEl.addEventListener("click", () => goToAdjacentMonth(-1));
monthNextEl.addEventListener("click", () => goToAdjacentMonth(1));

calendarGridEl.addEventListener("click", (event) => {
  const noteButton = event.target.closest("[data-note-id]");
  if (noteButton) {
    event.stopPropagation();
    showNote(state.noteRegistry.get(noteButton.dataset.noteId));
    return;
  }

  const card = event.target.closest(".calendar-day");
  if (!card || !state.currentMonthData) {
    return;
  }

  const day = state.currentMonthData.days.find((item) => item.day === Number(card.dataset.day));
  openEditor(day);
});

mobileViewToggleEl?.addEventListener("click", () => {
  setMobileFullMonthView(!state.mobileFullMonthView);
});

mobileMonthViewEl?.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-mobile-month-day]");
  if (!dayButton || !state.currentMonthData) {
    return;
  }
  state.mobileSelectedDate = {
    year: state.currentMonthData.year,
    month: state.currentMonthData.month,
    day: Number(dayButton.dataset.mobileMonthDay),
  };
  setMobileFullMonthView(false);
});

mobileDayViewEl?.addEventListener("click", (event) => {
  const noteButton = event.target.closest("[data-note-id]");
  if (noteButton) {
    event.stopPropagation();
    showNote(state.noteRegistry.get(noteButton.dataset.noteId));
    return;
  }

  const shiftButton = event.target.closest("[data-mobile-shift]");
  if (shiftButton) {
    const direction = Number(shiftButton.dataset.mobileShift || 0);
    if (!direction || !state.mobileSelectedDate) {
      return;
    }
    void goToMobileDate(shiftCalendarDate(state.mobileSelectedDate, direction), false);
    return;
  }

  const dateButton = event.target.closest("[data-mobile-go-date]");
  if (dateButton) {
    const [year, month, day] = String(dateButton.dataset.mobileGoDate || "").split("-").map((value) => Number(value) || 0);
    if (!year || !month || !day) {
      return;
    }
    void goToMobileDate({ year, month, day }, false);
    return;
  }

  const editButton = event.target.closest("[data-mobile-edit-day]");
  if (!editButton || !state.currentMonthData || !state.mobileSelectedDate) {
    return;
  }
  const day = state.currentMonthData.days.find((item) => Number(item?.day) === Number(state.mobileSelectedDate?.day || 0));
  openEditor(day);
});

songTagFilterBarEl?.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-song-tag-toggle]");
  if (toggleButton) {
    state.songTagFilterExpanded = !state.songTagFilterExpanded;
    renderSongFilters();
    return;
  }
  const button = event.target.closest("[data-song-tag-filter]");
  if (!button) {
    return;
  }
  const nextTag = button.dataset.songTagFilter || "";
  if (!nextTag) {
    state.selectedSongTags = [];
  } else {
    const activeTags = Array.isArray(state.selectedSongTags) ? state.selectedSongTags.slice() : [];
    state.selectedSongTags = activeTags.includes(nextTag)
      ? activeTags.filter((tag) => tag !== nextTag)
      : activeTags.concat(nextTag);
  }
  state.songbookPage = 1;
  state.revealedSongActionId = "";
  state.revealedSongActionDirection = "";
  refreshSongbook();
});

songPaginationEl?.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-song-page]");
  if (pageButton) {
    goToSongbookPage(Number(pageButton.dataset.songPage || 1));
    return;
  }
  const navButton = event.target.closest("[data-song-page-nav]");
  if (!navButton) {
    return;
  }
  const direction = Number(navButton.dataset.songPageNav || 0);
  if (!direction) {
    return;
  }
  goToSongbookPage(state.songbookPage + direction);
});

songResultsEl?.addEventListener("click", async (event) => {
  const row = event.target.closest(".song-item");
  if (!row) {
    return;
  }
  const songId = row.dataset.songId || "";
  if (event.target.closest("[data-song-save]")) {
    await saveSongEdit(songId, row);
    return;
  }
  if (event.target.closest("[data-song-cancel]")) {
    cancelSongEdit();
    return;
  }
  if (event.target.closest("[data-song-edit-trigger]")) {
    state.revealedSongActionId = "";
    state.revealedSongActionDirection = "";
    startSongEdit(songId);
    return;
  }
  if (event.target.closest("[data-song-delete-trigger]")) {
    await deleteSongItem(songId);
    return;
  }
  // 모바일 정보 과다 피드백: 기본은 제목만 보이고, 곡 행을 탭하면
  // 원곡명/아티스트/분류/태그가 펼쳐지도록 한다(편집 중인 행, 스와이프로
  // 편집/삭제가 열려있는 행은 탭 대상에서 제외).
  if (
    !row.classList.contains("song-item-editing") &&
    !row.classList.contains("song-action-open") &&
    event.target.closest(".song-item-content")
  ) {
    row.classList.toggle("is-expanded");
  }
});

songResultsEl?.addEventListener("pointerdown", beginSongSwipe);
songResultsEl?.addEventListener("pointermove", moveSongSwipe);
songResultsEl?.addEventListener("pointerup", endSongSwipe);
songResultsEl?.addEventListener("pointercancel", resetSongSwipe);
songResultsEl?.addEventListener("focusin", (event) => {
  const tagInput = event.target.closest("[data-song-tag-field]");
  if (!tagInput) {
    return;
  }
  renderSongTagSuggestions(tagInput.value || "");
});
songResultsEl?.addEventListener("input", (event) => {
  const tagInput = event.target.closest("[data-song-tag-field]");
  if (!tagInput) {
    return;
  }
  renderSongTagSuggestions(tagInput.value || "");
});

songRandomButtonEl?.addEventListener("click", openSongRandomModal);
songSearchButtonEl?.addEventListener("click", openSongSearchModal);
songSearchResetButtonEl?.addEventListener("click", resetSongSearch);

songRandomCategoryEl?.addEventListener("change", updateSongRandomCountBounds);

songRandomFormEl?.addEventListener("submit", (event) => {
  event.preventDefault();
  const category = songRandomCategoryEl?.value || "";
  const sourceItems = category ? state.songbookItems.filter((item) => item.category === category) : state.songbookItems.slice();
  const maxCount = Math.max(1, sourceItems.length);
  const requested = Number.parseInt(songRandomCountEl?.value || "1", 10);
  const count = Math.min(maxCount, Math.max(1, Number.isFinite(requested) ? requested : 1));
  if (songRandomCountEl) {
    songRandomCountEl.value = String(count);
  }
  renderSongRandomResults(pickRandomSongs(sourceItems, count));
});

songRandomModalEl?.addEventListener("click", (event) => {
  if (event.target === songRandomModalEl) {
    closeSongRandomModal();
  }
});

songSearchFormEl?.addEventListener("submit", (event) => {
  event.preventDefault();
  state.selectedSongQuery = songSearchTitleEl?.value.trim() || "";
  state.selectedSongArtistQuery = songSearchArtistEl?.value.trim() || "";
  state.selectedSongCategoryQuery = songSearchCategoryEl?.value || "";
  state.selectedSongTagQuery = songSearchTagEl?.value || "";
  state.songbookPage = 1;
  closeSongSearchModal();
  refreshSongbook();
});

songSearchModalEl?.addEventListener("click", (event) => {
  if (event.target === songSearchModalEl) {
    closeSongSearchModal();
  }
});

songUndoButtonEl?.addEventListener("click", async () => {
  await undoDeletedSong();
});

songUndoCloseEl?.addEventListener("click", () => {
  clearSongUndo();
});

songbookEditorEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addSongbookItem();
});
songbookEditorEl?.addEventListener("focusin", (event) => {
  const tagInput = event.target.closest("[data-song-tag-field]");
  if (!tagInput) {
    return;
  }
  renderSongTagSuggestions(tagInput.value || "");
});
songbookEditorEl?.addEventListener("input", (event) => {
  const tagInput = event.target.closest("[data-song-tag-field]");
  if (!tagInput) {
    return;
  }
  renderSongTagSuggestions(tagInput.value || "");
});

postitItemsEl?.addEventListener("input", (event) => {
  const inputEl = event.target.closest("[data-postit-text]");
  if (!inputEl) {
    return;
  }
  autosizePostitInput(inputEl);
  queuePostitSave();
});

postitItemsEl?.addEventListener("change", (event) => {
  const checkboxEl = event.target.closest("[data-postit-check]");
  if (!checkboxEl) {
    return;
  }
  checkboxEl.closest(".postit-item")?.classList.toggle("checked", checkboxEl.checked);
  queuePostitSave();
});

postitItemsEl?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-postit-remove]");
  if (removeButton) {
    removePostitItem(removeButton.closest(".postit-item")?.dataset.postitId || "");
    return;
  }
  const addButton = event.target.closest("[data-postit-add]");
  if (!addButton) {
    return;
  }
  addPostitItemAfter(addButton.closest(".postit-item")?.dataset.postitId || "");
});

countdownItemsEl?.addEventListener("input", (event) => {
  const fieldEl = event.target.closest("[data-countdown-title], [data-countdown-date]");
  if (!fieldEl) {
    return;
  }
  queuePostitSave();
});

countdownItemsEl?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-countdown-remove]");
  if (removeButton) {
    removeCountdownItem(removeButton.closest(".countdown-item")?.dataset.countdownId || "");
    return;
  }
  const addButton = event.target.closest("[data-countdown-add]");
  if (!addButton) {
    return;
  }
  addCountdownItemAfter(addButton.closest(".countdown-item")?.dataset.countdownId || "");
});

logoutButtonEl.addEventListener("click", async () => {
  try {
    await logoutCurrentUser();
    closeEditor();
    clearSongUndo();
  } catch {
    console.error("Logout failed");
  }
});

googleSigninEl.addEventListener("click", async () => {
  try {
    await openGoogleLogin();
  } catch (error) {
    console.error("Google login failed", error);
    state.pendingPermissionNotice = false;
    showAuthMessage(describeGoogleLoginError(error));
  }
});

editorStatusModeEl?.addEventListener("change", () => {
  updateEditorTimeField();
  queueEditorSave();
});
slotListEl?.addEventListener("change", (event) => {
  const categoryEl = event.target.closest("[data-slot-category]");
  if (categoryEl) {
    applyCategorySelectColor(categoryEl);
  }
});
slotListEl?.addEventListener("click", (event) => {
  const slotEl = event.target.closest(".editor-slot");
  const slotIndex = Number(slotEl?.dataset.slotIndex || -1);
  if (slotIndex < 0) {
    return;
  }
  if (event.target.closest("[data-editor-add]")) {
    addEditorEntryAfter(slotIndex);
    return;
  }
  if (event.target.closest("[data-editor-remove]")) {
    removeEditorEntry(slotIndex);
  }
});
slotListEl?.addEventListener("dragstart", (event) => {
  const handleEl = event.target.closest("[data-editor-drag-handle]");
  const slotEl = handleEl?.closest(".editor-slot");
  const slotIndex = Number(slotEl?.dataset.slotIndex || -1);
  if (!handleEl || !slotEl || slotIndex < 0) {
    return;
  }
  state.editorDragIndex = slotIndex;
  slotEl.classList.add("dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(slotIndex));
  }
});
slotListEl?.addEventListener("dragover", (event) => {
  const slotEl = event.target.closest(".editor-slot");
  const slotIndex = Number(slotEl?.dataset.slotIndex || -1);
  if (!slotEl || slotIndex < 0 || state.editorDragIndex < 0) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  slotListEl.querySelectorAll(".editor-slot.drag-over").forEach((item) => {
    if (item !== slotEl) {
      item.classList.remove("drag-over");
    }
  });
  slotEl.classList.toggle("drag-over", slotIndex !== state.editorDragIndex);
});
slotListEl?.addEventListener("drop", (event) => {
  const slotEl = event.target.closest(".editor-slot");
  const targetIndex = Number(slotEl?.dataset.slotIndex || -1);
  if (!slotEl || targetIndex < 0 || state.editorDragIndex < 0) {
    return;
  }
  event.preventDefault();
  reorderEditorEntries(state.editorDragIndex, targetIndex);
});
slotListEl?.addEventListener("dragend", () => {
  clearEditorDragState();
});
editorFormEl?.addEventListener("input", (event) => {
  if (!event.target.closest("input, textarea, select")) {
    return;
  }
  if (event.target instanceof HTMLTextAreaElement) {
    autosizeEditorTextarea(event.target, event.target.id === "editor-day-note" ? 96 : 156);
  }
  queueEditorSave();
});
editorFormEl?.addEventListener("change", (event) => {
  if (event.target === editorDayImageInputEl) {
    return;
  }
  if (!event.target.closest("input, textarea, select")) {
    return;
  }
  queueEditorSave();
});
editorDayImageInputEl?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  void handleEditorDayImageSelection(file);
});
editorDayImageRemoveEl?.addEventListener("click", () => {
  clearEditorDayImage();
});
editorFormEl?.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveEditorDraft({ force: true });
});
editorCloseButtonEl?.addEventListener("click", () => {
  void requestEditorClose();
});
editorCloseWarningCancelEl?.addEventListener("click", closeEditorCloseWarning);
editorCloseWarningDiscardEl?.addEventListener("click", discardAndCloseEditor);
editorCloseWarningModalEl?.addEventListener("click", (event) => {
  if (event.target === editorCloseWarningModalEl) {
    closeEditorCloseWarning();
  }
});

noteCloseEl?.addEventListener("click", hideNote);
noteModalEl?.addEventListener("click", (event) => {
  if (event.target === noteModalEl) {
    hideNote();
  }
});

window.addEventListener("keydown", (event) => {
  const topModalEl = getTopmostOpenModal();
  if (event.key === "Tab" && topModalEl) {
    if (trapFocusInsideModal(topModalEl, event)) {
      return;
    }
  }
  if (event.key !== "Escape" || !topModalEl) {
    return;
  }
  event.preventDefault();
  if (topModalEl === editorCloseWarningModalEl) {
    closeEditorCloseWarning();
    return;
  }
  if (topModalEl === versionHistoryModalEl) {
    closeVersionHistory();
    return;
  }
  if (topModalEl === privacyPolicyModalEl) {
    closePrivacyPolicy();
    return;
  }
  if (topModalEl === noteModalEl) {
    hideNote();
    return;
  }
  if (topModalEl === calendarSearchModalEl) {
    closeCalendarSearch();
    return;
  }
  if (topModalEl === songSearchModalEl) {
    closeSongSearchModal();
    return;
  }
  if (topModalEl === songRandomModalEl) {
    closeSongRandomModal();
    return;
  }
  if (topModalEl === editorModalEl) {
    void requestEditorClose();
  }
});

init();
