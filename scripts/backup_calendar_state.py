#!/Users/eomjeong-ung/Documents/New project/imzecheon-calendar/.venv/bin/python
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account


BASE_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BASE_DIR / "outputs" / "calendar-backups"
DEFAULT_COLLECTION = "calendar_overrides"
DOWNLOAD_KEY_GLOB = "imzecheon-calendar-*.json"
TIMEZONE = "Asia/Seoul"

load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env", override=True)


def now_kst() -> datetime:
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo(TIMEZONE))


def resolve_service_account_file() -> Path:
    explicit = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
    if explicit:
      explicit_path = Path(explicit).expanduser()
      if explicit_path.exists():
          return explicit_path

    download_candidates = sorted(Path.home().glob(f"Downloads/{DOWNLOAD_KEY_GLOB}"), reverse=True)
    for candidate in download_candidates:
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(payload, dict) and payload.get("private_key") and payload.get("client_email"):
            return candidate
    raise FileNotFoundError("서비스 계정 JSON 파일을 찾지 못했습니다.")


def build_access_token(service_account_file: Path) -> tuple[str, str]:
    credentials = service_account.Credentials.from_service_account_file(
        str(service_account_file),
        scopes=["https://www.googleapis.com/auth/datastore"],
    )
    credentials.refresh(GoogleAuthRequest())
    project_id = str(credentials.project_id or "").strip()
    if not project_id:
        raise RuntimeError("서비스 계정에서 Firebase 프로젝트 ID를 확인하지 못했습니다.")
    return str(credentials.token or ""), project_id


def fetch_collection_documents(project_id: str, access_token: str, collection_name: str) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    endpoint = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{collection_name}"
    next_page_token = ""
    headers = {"Authorization": f"Bearer {access_token}"}

    while True:
        params = {"pageSize": 100}
        if next_page_token:
            params["pageToken"] = next_page_token
        response = requests.get(endpoint, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()
        documents.extend(payload.get("documents") or [])
        next_page_token = str(payload.get("nextPageToken") or "").strip()
        if not next_page_token:
            break

    return documents


def build_backup_payload(project_id: str, collection_name: str, documents: list[dict[str, Any]]) -> dict[str, Any]:
    captured_at = now_kst()
    return {
        "generatedAt": captured_at.isoformat(),
        "projectId": project_id,
        "collection": collection_name,
        "documentCount": len(documents),
        "documents": documents,
    }


def write_backup_file(payload: dict[str, Any]) -> Path:
    captured_at = now_kst()
    directory = BACKUP_DIR / captured_at.strftime("%Y") / captured_at.strftime("%m")
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"calendar-backup-{captured_at.strftime('%Y-%m-%d_%H-%M-%S')}-kst.json"
    destination = directory / filename
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return destination


def main() -> int:
    collection_name = os.getenv("FIRESTORE_CALENDAR_COLLECTION", "").strip() or DEFAULT_COLLECTION
    service_account_file = resolve_service_account_file()
    access_token, project_id = build_access_token(service_account_file)
    documents = fetch_collection_documents(project_id, access_token, collection_name)
    destination = write_backup_file(build_backup_payload(project_id, collection_name, documents))
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
