from __future__ import annotations

import calendar
import json
import re
import shutil
from copy import deepcopy
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
STATIC_DIR = ROOT / "static"
DIST_DIR = ROOT / "dist"
SITE_DATA_FILE = STATIC_DIR / "data" / "site-data.json"
HOME_AGENDA_BASE_FILE = STATIC_DIR / "data" / "home-agenda-base.json"

DEFAULT_LINKS = {
    "youtubeChannelUrl": "https://www.youtube.com/channel/UCXoZBh4NsEHDDzpkqCHGGdA",
    "chzzkChannelUrl": "https://www.sooplive.com/station/psb010203",
    "cafeUrl": "https://cafe.naver.com/binssss",
}
DEFAULT_PROFILE = {
    "brandName": "빈스 캘린더",
    "brandEnglishName": "Vince Calendar",
    "profileAvatarUrl": "/static/assets/vince-profile.webp",
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_existing_site_data() -> dict:
    if not SITE_DATA_FILE.exists():
        return {}
    try:
        return read_json(SITE_DATA_FILE)
    except Exception:
        return {}


def human_month_title(year: int, month: int) -> str:
    return f"{year}년 {month:02d}월"


def summarize_note_label(note_text: str) -> str:
    normalized = str(note_text or "").strip()
    if not normalized:
        return ""
    parts = [item.strip() for item in re.split(r"[,\n/]+", normalized) if item.strip()]
    if len(parts) >= 2:
        return f"참여 {len(parts)}명"
    return "더보기"


def build_blank_month(year: int, month: int, legend: list[dict]) -> dict:
    first_weekday, days_in_month = calendar.monthrange(year, month)
    weeks = []
    days = []
    current_week = [None] * 7
    weekday_index = (first_weekday + 1) % 7

    for day_number in range(1, days_in_month + 1):
        payload = {
            "day": day_number,
            "timeLabel": "",
            "timeSource": "local",
            "isOff": False,
            "entries": [],
            "weekdayIndex": weekday_index,
            "baseRow": 0,
            "baseColumn": 0,
            "noteText": "",
            "noteLabel": "",
            "showStatusImage": False,
        }
        current_week[weekday_index] = payload
        days.append(payload)

        if weekday_index == 6 or day_number == days_in_month:
            weeks.append(current_week)
            current_week = [None] * 7
        weekday_index = (weekday_index + 1) % 7

    return {
        "key": f"{year}-{month:02d}",
        "sheetName": "",
        "title": human_month_title(year, month),
        "year": year,
        "month": month,
        "weeks": weeks,
        "days": days,
        "legend": deepcopy(legend),
        "sheetVideos": [],
        "hasEntries": False,
        "source": "local",
    }


def ensure_month_grid(month_data: dict, legend: list[dict]) -> dict:
    base = build_blank_month(month_data["year"], month_data["month"], month_data.get("legend") or legend)
    day_lookup = {int(item["day"]): item for item in month_data.get("days") or []}
    for day_payload in base["days"]:
        if day_payload["day"] in day_lookup:
            day_payload.update(deepcopy(day_lookup[day_payload["day"]]))
    base["weeks"] = [
        [next((item for item in base["days"] if item["day"] == day["day"]), None) if day else None for day in week]
        for week in base["weeks"]
    ]
    base["sheetName"] = month_data.get("sheetName", "")
    base["sheetVideos"] = deepcopy(month_data.get("sheetVideos") or [])
    base["source"] = month_data.get("source", "sheet")
    return base


def apply_overrides(month_data: dict, month_override: dict, legend: list[dict]) -> dict:
    payload = ensure_month_grid(month_data, legend)
    legend_lookup = {item["key"]: item for item in payload.get("legend") or legend}
    days_override = (month_override.get("days") if isinstance(month_override, dict) else {}) or {}

    for raw_day, override in days_override.items():
        day_number = int(raw_day)
        target = next((item for item in payload["days"] if int(item["day"]) == day_number), None)
        if target is None:
            continue

        time_label = str((override or {}).get("timeLabel") or "").strip()
        if time_label == "휴방":
            time_label = "휴뱅"

        entries = []
        for entry in (override or {}).get("entries") or []:
            text = str((entry or {}).get("text") or "").strip()[:120]
            if not text:
                continue
            category_key = str((entry or {}).get("categoryKey") or "").strip()
            note_text = str((entry or {}).get("noteText") or "").strip()[:120]
            legend_item = legend_lookup.get(category_key, {})
            entries.append(
                {
                    "text": text,
                    "categoryKey": category_key,
                    "categoryLabel": legend_item.get("label", ""),
                    "categoryColor": legend_item.get("color", ""),
                    "noteText": note_text,
                    "noteLabel": str((entry or {}).get("noteLabel") or "").strip() or (summarize_note_label(note_text) if note_text else ""),
                    "imageUrl": "",
                }
            )

        note_text = str((override or {}).get("noteText") or "").strip()[:1200]
        target["timeLabel"] = time_label
        target["timeSource"] = str((override or {}).get("timeSource") or "").strip() or "manual"
        target["isOff"] = time_label == "휴뱅"
        target["entries"] = entries
        target["noteText"] = note_text
        target["noteLabel"] = str((override or {}).get("noteLabel") or "").strip() or (summarize_note_label(note_text) if note_text else "")
        target["showStatusImage"] = target["isOff"]

    payload["hasEntries"] = any(
        bool(str(day.get("timeLabel") or "").strip() or (day.get("entries") or []))
        for day in payload["days"]
    )
    return payload


def build_site_data() -> dict:
    snapshot = read_json(DATA_DIR / "frozen_sheet_snapshot.json")
    overrides = read_json(DATA_DIR / "calendar_overrides.json")
    songbook_overrides = read_json(DATA_DIR / "songbook_overrides.json")
    postit = read_json(DATA_DIR / "postit.json")
    existing_site_data = read_existing_site_data()

    legend = deepcopy(snapshot.get("legend") or [])
    base_months = {key: deepcopy(value) for key, value in (snapshot.get("monthsByKey") or {}).items()}
    months_meta = {item["key"]: deepcopy(item) for item in snapshot.get("monthsMeta") or []}

    for month_key, month_override in ((overrides.get("months") or {}).items()):
        if month_key in base_months:
            base_month = base_months[month_key]
        else:
            year_text, month_text = month_key.split("-", 1)
            base_month = build_blank_month(int(year_text), int(month_text), legend)
        merged = apply_overrides(base_month, month_override, legend)
        base_months[month_key] = merged
        months_meta[month_key] = {
            "key": month_key,
            "sheetName": merged.get("sheetName", ""),
            "title": merged["title"],
            "year": merged["year"],
            "month": merged["month"],
            "hasEntries": merged["hasEntries"],
        }

    ordered_months = sorted(months_meta.values(), key=lambda item: (item["year"], item["month"]))
    current_year = datetime.now().year
    years = {current_year - 1, current_year, current_year + 1, current_year + 2}
    years.update(item["year"] for item in ordered_months)
    calendar_bounds = {"minYear": min(years), "maxYear": max(years)}

    initial = deepcopy(snapshot.get("initial") or {})
    initial_key = f"{initial.get('year')}-{int(initial.get('month', 0)):02d}" if initial else ""
    initial_month = base_months.get(initial_key)
    youtube_fallback = []
    if initial_month:
        youtube_fallback = [
            {
                "videoId": "",
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "publishedAt": "",
                "thumbnailUrl": "",
                "isShort": "short" in str(item.get("url", "")).lower(),
            }
            for item in (initial_month.get("sheetVideos") or [])[:3]
        ]
    if existing_site_data.get("youtubeFallback"):
        youtube_fallback = deepcopy(existing_site_data.get("youtubeFallback") or [])

    song_items = deepcopy((songbook_overrides.get("items") or snapshot.get("songbook", {}).get("items") or []))
    categories = sorted({item.get("category", "") for item in song_items if item.get("category")})
    artists = sorted({item.get("artist", "") for item in song_items if item.get("artist")})

    return {
        "generatedAt": snapshot.get("generatedAt", ""),
        **DEFAULT_PROFILE,
        "initial": initial,
        "months": ordered_months,
        "monthsByKey": base_months,
        "calendarBounds": calendar_bounds,
        "legend": legend,
        "links": DEFAULT_LINKS,
        "songbookSummary": {
            "count": len(song_items),
            "publicLink": snapshot.get("songbook", {}).get("publicLink", ""),
            "notice": snapshot.get("songbook", {}).get("notice", ""),
            "categories": categories,
            "artists": artists,
        },
        "songbook": {
            "items": song_items,
            "categories": categories,
            "artists": artists,
            "publicLink": snapshot.get("songbook", {}).get("publicLink", ""),
            "notice": snapshot.get("songbook", {}).get("notice", ""),
        },
        "postit": {
            "items": deepcopy(postit.get("items") or []),
            "countdowns": deepcopy(postit.get("countdowns") or []),
            "updatedAt": postit.get("updatedAt", ""),
        },
        "youtubeFallback": youtube_fallback,
    }


def build_dist() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(STATIC_DIR / "index.html", DIST_DIR / "index.html")
    shutil.copytree(STATIC_DIR, DIST_DIR / "static", dirs_exist_ok=True)
    videos_dir = ROOT / "videos"
    if videos_dir.exists():
        shutil.copytree(videos_dir, DIST_DIR / "videos", dirs_exist_ok=True)


def main() -> None:
    site_data = build_site_data()
    SITE_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    SITE_DATA_FILE.write_text(
        json.dumps(site_data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    HOME_AGENDA_BASE_FILE.write_text(
        json.dumps(
            {
                "legend": {
                    item["key"]: {"label": item.get("label", ""), "color": item.get("color", "")}
                    for item in site_data.get("legend", [])
                    if item.get("key")
                },
                "months": {
                    key: {
                        str(day["day"]): {
                            "timeLabel": day.get("timeLabel", ""),
                            "entries": [
                                {"text": entry.get("text", ""), "categoryKey": entry.get("categoryKey", "")}
                                for entry in day.get("entries", [])
                            ],
                        }
                        for day in month.get("days", [])
                        if day.get("timeLabel") or day.get("entries")
                    }
                    for key, month in site_data.get("monthsByKey", {}).items()
                },
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    build_dist()


if __name__ == "__main__":
    main()
