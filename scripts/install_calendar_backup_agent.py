#!/Users/eomjeong-ung/Documents/New project/imzecheon-calendar/.venv/bin/python
from __future__ import annotations

import os
import plistlib
import subprocess
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
PYTHON_BIN = BASE_DIR / ".venv" / "bin" / "python"
BACKUP_SCRIPT = BASE_DIR / "scripts" / "backup_calendar_state.py"
LOG_DIR = BASE_DIR / "outputs" / "calendar-backup-logs"
LAUNCH_AGENTS_DIR = Path.home() / "Library" / "LaunchAgents"
PLIST_PATH = LAUNCH_AGENTS_DIR / "com.imzecheon.calendar.backup.plist"
LABEL = "com.imzecheon.calendar.backup"


def build_plist_payload() -> dict:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return {
        "Label": LABEL,
        "ProgramArguments": [str(PYTHON_BIN), str(BACKUP_SCRIPT)],
        "RunAtLoad": False,
        "StartCalendarInterval": {
            "Hour": 23,
            "Minute": 59,
        },
        "WorkingDirectory": str(BASE_DIR),
        "StandardOutPath": str(LOG_DIR / "stdout.log"),
        "StandardErrorPath": str(LOG_DIR / "stderr.log"),
    }


def main() -> int:
    if not PYTHON_BIN.exists():
        raise FileNotFoundError(f"파이썬 실행 파일을 찾지 못했습니다: {PYTHON_BIN}")
    if not BACKUP_SCRIPT.exists():
        raise FileNotFoundError(f"백업 스크립트를 찾지 못했습니다: {BACKUP_SCRIPT}")

    LAUNCH_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    with PLIST_PATH.open("wb") as fp:
        plistlib.dump(build_plist_payload(), fp)

    uid = str(os.getuid())
    subprocess.run(["launchctl", "bootout", f"gui/{uid}", str(PLIST_PATH)], check=False)
    subprocess.run(["launchctl", "bootstrap", f"gui/{uid}", str(PLIST_PATH)], check=True)
    subprocess.run(["launchctl", "enable", f"gui/{uid}/{LABEL}"], check=False)
    print(PLIST_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
