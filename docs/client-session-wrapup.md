# Client-side Session Wrap-Up (P6.5 preview)

Muốn agents (Claude Code, Cursor, etc.) tự động nộp artifact trước khi end session? Có 2 lớp:

## Lớp 1 — Server-side skill hint (đã có)

Skill `session-wrapup` trong `skills-kythuat` GitLab repo. Manifest tag `mandatory`. Load qua MCP `load_skill`:

```
docker compose exec -T backend wget -qO- \
  --header="X-Onemcp-User: alice" --header="Content-Type: application/json" \
  --post-data='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"load_skill","arguments":{"name":"session-wrapup"}}}' \
  http://127.0.0.1:3000/api/mcp
```

Body của skill (seed vào GitLab):

```markdown
# Session Wrap-Up Protocol

Trước khi end session, dev/agent MUST:

1. Call `search` MCP để check xem có KB tương tự chưa.
2. Nếu KB thiếu hoặc cần update, call `get_artifact_template` để lấy schema.
3. Call `submit_artifact` với `type` phù hợp:
   - `report` cho postmortem / incident
   - `research` cho khảo sát / benchmark
   - `kb` cho fix step-by-step (ưu tiên khi trace bug)
4. Include từ khóa error message / log line vào `problem` section để dev tương lai search ra.
```

## Lớp 2 — Client-side hard enforcement (P6.5, defer)

Claude Code hỗ trợ pre-shutdown hook via `.claude/settings.json`:

```json
{
  "mcpServers": {
    "onemcp": {
      "type": "http",
      "url": "https://onemcp.local/api/mcp",
      "headers": { "X-Onemcp-User": "vietnt" }
    }
  },
  "hooks": {
    "PreCompact": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/onemcp-wrapup-check.py"
          }
        ]
      }
    ]
  }
}
```

`onemcp-wrapup-check.py` sẽ:
1. Đọc session context (git log của repo work).
2. Query OneMCP REST `/api/artifacts?owner=me&status=pending&since=<session-start>`.
3. Nếu chưa có artifact submit trong session → exit(1) với message "Please submit artifact via MCP submit_artifact before ending session".

Script sample sẽ ship khi cook P6.5 dedicated session. Hiện tại đây là placeholder documentation.

## Contribution

Nếu team muốn tạo mới skill session-wrapup:
1. Clone `onemcp/skills-kythuat` GitLab repo (khi GITLAB_BASE_URL enable)
2. Tạo `skills/session-wrapup/manifest.json` + `SKILL.md` với body ở trên
3. Merge → webhook sync → pending version
4. Admin approve qua portal
