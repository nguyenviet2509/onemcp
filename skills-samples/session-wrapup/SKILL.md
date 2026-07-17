# Session Wrap-Up Protocol

**Trigger**: Trước khi end session, compact context, hoặc chuyển sang task khác.

## Bắt buộc

1. **Check duplicates** — call MCP `search` với error message hoặc keyword task chính. Nếu KB tương tự đã có → cân nhắc update thay vì tạo mới.

2. **Choose type**:
   - `kb` — bug fix step-by-step (ưu tiên cho trace-bug reuse)
   - `report` — incident postmortem
   - `research` — khảo sát / benchmark

3. **Get template** — call MCP `get_artifact_template({type: <chosen>})` để lấy schema.

4. **Fill sections đầy đủ**. Quan trọng nhất:
   - `problem` (kb): paste **exact error message** hoặc log line. Dev tương lai sẽ paste string đó vào search.
   - `solution` (kb): step-by-step + commands + code snippet nếu có.
   - `root_cause` (report): explain vì sao previous safeguards không catch.

5. **Submit** — call MCP `submit_artifact` với type + slug + structured.

## Ví dụ kb entry

```
Problem:
Sepay webhook responds 502 after 30s.
Log: "upstream timed out (110: Operation timed out) while reading response header from upstream, client: 10.0.14.5, server: sepay.local"

Solution:
1. Tăng nginx proxy_read_timeout lên 60s trong ops/nginx/sepay.conf
2. Add BullMQ retry queue với exponential backoff (5s, 15s, 45s)
3. Deploy: docker compose up -d nginx backend
Verify: curl -X POST /webhook/sepay đo response time < 60s.
```

## Anti-patterns

- ❌ Submit KB với body chỉ ghi "fixed" — vô dụng cho future search.
- ❌ Skip `problem` section — không match được error message.
- ❌ Submit vào wrong dept — check `department` field trong manifest matches dept của bạn.
- ❌ Duplicate KB — luôn `search` trước khi submit.

## Nếu skip

Nếu task không tạo knowledge value (e.g. exploratory, dead-end, private work), OK skip. Nhưng nếu fixed real bug hoặc tìm ra pattern → phải submit. Dev khác đang chờ.
