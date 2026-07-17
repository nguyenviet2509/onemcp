# Cook Session 11 — P5 Part 2: Client Hook + Skill Samples

**Date:** 2026-07-17 · **Phase:** P5 Templates / P6.5 Client-side · **Progress:** P5 done, P6.5 preview.

## Scope

Đóng vòng lặp workflow — client-side reminder trước end session + seed content.

**Không có backend change**. Pure client + docs + seed samples.

## Delivered

### Python hook script
- `hooks/onemcp-wrapup-check.py` — Claude Code PreCompact hook.
  - Stdlib only (urllib + json + ssl) — không cần pip install.
  - Config qua env: `ONEMCP_URL`, `ONEMCP_USER`, `ONEMCP_SESSION_HOURS` (default 4), `ONEMCP_HOOK_STRICT` (0=advisory, 1=blocking), `ONEMCP_HOOK_INSECURE` (skip TLS verify cho self-signed lab).
  - Query `/api/me` + `/api/artifacts`, filter `ownerId == me AND createdAt >= now - window`.
  - Nếu 0 recent → in reminder ra stderr với hint call `submit_artifact`.
  - Fail-safe: nếu env chưa set hoặc network fail → silent skip (exit 0).
  - Strict mode: exit 1 khi 0 recent → Claude Code block PreCompact.

### Skill seed samples (`skills-samples/`)
- `session-wrapup/manifest.json` + `SKILL.md` — protocol content agent load qua MCP `load_skill`. Nội dung: 5 bước MUST, ví dụ KB entry (Sepay 502 timeout), anti-patterns.
- `debug-guide/manifest.json` + `SKILL.md` — 6-step incident workflow (stabilize → gather → reproduce → isolate → fix → wrap-up).
- `README.md` — layout expected trong GitLab repo `onemcp/skills-kythuat`, 3 cách seed (SQL manual, GitLab push, mount).

### Docs
- `docs/client-session-wrapup.md` — 3-lớp enforce guide: MCP skill hint / Claude Code MCP config / PreCompact hook. Install steps + env table + rollout suggest 3 tuần (advisory → strict).

## Files

- Hooks: 1 (Python script ~80 LOC)
- Skills samples: 5 (2 manifest + 2 SKILL.md + 1 README)
- Docs: 1 rewritten

Không backend/portal thay đổi. Không cần rebuild containers.

## Deploy (client-side)

Không cần git pull/rebuild trên VPS. Chỉ config máy dev:

```bash
# Trên máy dev (WSL/Linux/macOS)
git pull

mkdir -p ~/.claude/hooks
cp hooks/onemcp-wrapup-check.py ~/.claude/hooks/
chmod +x ~/.claude/hooks/onemcp-wrapup-check.py

# Edit ~/.claude/settings.json — thêm block hooks (xem docs/client-session-wrapup.md)
# Restart Claude Code
```

## Verify

```bash
# 1. Manual test (advisory)
ONEMCP_URL=https://onemcp.local ONEMCP_USER=vietnt ONEMCP_HOOK_INSECURE=1 \
  python3 hooks/onemcp-wrapup-check.py
echo "exit=$?"

# 2. Force strict test — should exit 1 nếu no recent artifact
ONEMCP_URL=https://onemcp.local ONEMCP_USER=vietnt ONEMCP_HOOK_INSECURE=1 \
  ONEMCP_HOOK_STRICT=1 \
  python3 hooks/onemcp-wrapup-check.py
echo "exit=$?"

# 3. Trong Claude Code — trigger /compact hoặc chờ auto-compact
#    → stderr message hiện lên trước khi Claude compact
```

## Skill seed manual (chưa có GitLab)

```bash
# Body cho session-wrapup — copy paste vào SQL
BODY=$(cat skills-samples/session-wrapup/SKILL.md | sed "s/'/''/g")
docker compose exec -T postgres psql -U onemcp onemcp <<EOF
UPDATE skill_versions SET body = '$BODY' WHERE id = 2;
EOF

# Verify load_skill trả về content
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"load_skill","arguments":{"name":"session-wrapup"}}}' \
  http://127.0.0.1:3000/api/mcp | jq -r '.result.content[0].text' | head -30
```

## Complete workflow (bug-trace KB reuse) — cuối P5

1. Dev A gặp bug → agent Claude Code có OneMCP MCP config.
2. Fix xong → agent call `search` với error message → không có KB.
3. `get_artifact_template("kb")` → biết fill `problem` + `solution`.
4. `submit_artifact({type:"kb", ...})` → pending.
5. Session compact → **hook check** → thấy artifact vừa submit → ✓.
6. Nếu quên submit → hook cảnh báo. Strict mode → block compact.
7. Maintainer approve qua portal → published.
8. **Vài tuần sau**: Dev B paste error → `search` → hit KB → apply fix < 5 phút.

Full pipeline end-to-end, không có magic step.

## Rollout plan

| Tuần | Mode | Kết quả monitor |
|---|---|---|
| 1 | Install advisory | % session có artifact submit |
| 2 | Vẫn advisory | Đo drift — có tăng không |
| 3 | Flip STRICT=1 | Block session compact nếu chưa submit |
| 4+ | Feedback | Adjust window (SESSION_HOURS), tune reminder text |

## Unresolved

- **Session ID tracking**: hook đang dùng "recent submit trong 4h" — proxy chưa chính xác. Claude Code chưa expose stable session_id cho hook. Chấp nhận approximation cho v1.
- **Multi-project**: nếu dev làm 3 project song song trong 4h, submit 1 artifact vào project A sẽ pass check cho project B → false positive. Chấp nhận cho pilot; fix cần tag artifact bằng cwd/project.
- **Windows dev**: script tested Linux/macOS. Windows PowerShell cần Python3 in PATH. WSL2 recommended.
- **Non-Claude-Code agents** (Cursor, Continue, etc.): mỗi tool có hook API riêng — port sang khi cần.
- **Skill seed**: manual SQL update dễ typo. Enable GitLab sớm để clean flow.

## Session Metrics
- Files new: 6 (1 script + 4 skill samples + 1 README)
- Files modified: 1 (docs/client-session-wrapup.md rewrite)
- LOC delta: ~200 (mostly docs + markdown)
- Backend build: no change (no backend touched)
