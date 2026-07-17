#!/usr/bin/env python3
"""
OneMCP session wrap-up check — Claude Code PreCompact hook.

Kiểm tra user đã submit artifact nào trong session hiện tại chưa. Nếu chưa,
in reminder ra stderr. Non-blocking by default (advisory).

Bật blocking mode: set ONEMCP_HOOK_STRICT=1 → exit 1 nếu không có artifact.

Env cần:
  ONEMCP_URL              base URL, e.g. https://onemcp.local
  ONEMCP_USER             username, e.g. vietnt
  ONEMCP_SESSION_HOURS    window để tính "recent" (default 4)
  ONEMCP_HOOK_STRICT      "1" để blocking, "0" (default) advisory
  ONEMCP_HOOK_INSECURE    "1" để skip TLS verify (self-signed lab)

Install:
  chmod +x ~/.claude/hooks/onemcp-wrapup-check.py
  Add block vào ~/.claude/settings.json — xem docs/client-session-wrapup.md
"""
import json
import os
import ssl
import sys
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def get_json(url: str, headers: dict, insecure: bool) -> object:
    req = Request(url, headers=headers, method="GET")
    ctx = ssl._create_unverified_context() if insecure else None
    with urlopen(req, timeout=10, context=ctx) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    base = env("ONEMCP_URL")
    user = env("ONEMCP_USER")
    strict = env("ONEMCP_HOOK_STRICT") == "1"
    insecure = env("ONEMCP_HOOK_INSECURE") == "1"
    try:
        window_hours = int(env("ONEMCP_SESSION_HOURS", "4"))
    except ValueError:
        window_hours = 4

    if not base or not user:
        # Config chưa set — silent skip, không phiền user.
        return 0

    headers = {"X-Onemcp-User": user, "Accept": "application/json"}
    try:
        me = get_json(f"{base}/api/me", headers, insecure)
        artifacts = get_json(f"{base}/api/artifacts", headers, insecure)
    except (HTTPError, URLError, TimeoutError, ssl.SSLError) as e:
        sys.stderr.write(f"[onemcp-wrapup] warn: cannot reach OneMCP ({e}); skip check\n")
        return 0

    if not isinstance(me, dict) or "id" not in me:
        return 0
    me_id = me["id"]

    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    recent = []
    if isinstance(artifacts, list):
        for a in artifacts:
            try:
                if a.get("ownerId") != me_id:
                    continue
                created = datetime.fromisoformat(a["createdAt"].replace("Z", "+00:00"))
                if created >= since:
                    recent.append(a)
            except (KeyError, ValueError):
                continue

    if recent:
        sys.stderr.write(
            f"[onemcp-wrapup] ✓ {len(recent)} artifact(s) submitted in last {window_hours}h — good.\n"
        )
        return 0

    msg = (
        f"[onemcp-wrapup] ⚠  No artifact submitted in last {window_hours}h.\n"
        f"[onemcp-wrapup]     Consider capturing session outcomes:\n"
        f"[onemcp-wrapup]       - Bug fix?    → submit_artifact type=kb\n"
        f"[onemcp-wrapup]       - Incident?   → submit_artifact type=report\n"
        f"[onemcp-wrapup]       - Research?   → submit_artifact type=research\n"
        f"[onemcp-wrapup]     Call MCP tool `get_artifact_template` for schema, then `submit_artifact`.\n"
    )
    sys.stderr.write(msg)
    return 1 if strict else 0


if __name__ == "__main__":
    sys.exit(main())
