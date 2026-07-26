/**
 * seed-sample-artifacts-ops.ts
 *
 * Standalone script — seed 3 placeholder SOP/FAQ artifacts for Ops + Support.
 * Run MANUALLY after backend is up and Ops lead provides real content:
 *
 *   npm run seed:sample-ops
 *
 * Requires DATABASE_URL env var (or .env loaded). Does NOT run on startup.
 * Idempotent: skips insert if artifact with same title + template_key already exists.
 *
 * TODO(ops-lead): replace placeholder body markdown with real content before going live.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Placeholder SOP content — replace with real Ops lead content before launch.
// ---------------------------------------------------------------------------

interface ArtifactSeed {
  title: string;
  template_key: string;
  /** space slug — must exist in DB */
  space_slug: string;
  /** department code — must exist in DB */
  dept_code: string;
  tags: string[];
  /** markdown body for the primary content field */
  body: string;
}

const SAMPLE_ARTIFACTS: ArtifactSeed[] = [
  {
    title: '[MẪU] Xử lý ticket P1 khách hàng',
    template_key: 'ticket_playbook',
    space_slug: 'support-faq',
    dept_code: 'support',
    tags: ['p1', 'ticket', 'escalation', 'mẫu'],
    body: [
      '# Xử lý ticket P1 khách hàng',
      '',
      '<!-- TODO(ops-lead): replace với quy trình thực tế của team Support -->',
      '',
      '## Loại ticket',
      'P1 — Sự cố nghiêm trọng ảnh hưởng nhiều khách hàng hoặc tính năng cốt lõi.',
      '',
      '## Bước chẩn đoán',
      '1. Xác nhận triệu chứng từ khách (screenshot, log, bước tái hiện)',
      '2. Kiểm tra dashboard status (TODO: link dashboard)',
      '3. Xác định scope: bao nhiêu khách bị ảnh hưởng?',
      '',
      '## Phương án xử lý',
      '- Nếu lỗi hệ thống → escalate ngay cho Ops oncall',
      '- Nếu lỗi config tài khoản → thao tác trực tiếp (TODO: link runbook)',
      '- Nếu không rõ → mở incident channel, tag @ops-oncall',
      '',
      '## Escalation matrix',
      '| Mức | Điều kiện | Escalate tới |',
      '|---|---|---|',
      '| P1 | > 10 khách hoặc mất dữ liệu | Ops Lead + CTO |',
      '| P2 | 1-10 khách, tính năng phụ | Ops oncall |',
      '',
      '## Mẫu communication khách',
      '> Kính gửi Quý khách, chúng tôi đã ghi nhận sự cố và đang xử lý khẩn.',
      '> Dự kiến phản hồi trong [SLA]. Xin lỗi về sự bất tiện.',
    ].join('\n'),
  },
  {
    title: '[MẪU] Escalation matrix theo mức severity',
    template_key: 'sop',
    space_slug: 'ops-oncall',
    dept_code: 'ops',
    tags: ['escalation', 'severity', 'oncall', 'mẫu'],
    body: [
      '# Escalation matrix theo mức severity',
      '',
      '<!-- TODO(ops-lead): cập nhật tên người + kênh liên lạc thực tế -->',
      '',
      '## Đối tượng áp dụng',
      'Ops L1, L2 — dùng khi cần escalate incident ra ngoài shift.',
      '',
      '## Mục đích',
      'Xác định ai cần thông báo, kênh nào, trong bao lâu — tránh mất thời gian tìm người khi oncall.',
      '',
      '## Điều kiện tiên quyết',
      '- Đã xác định mức severity (SEV1/2/3)',
      '- Đã ghi incident ID',
      '',
      '## Các bước thực hiện',
      '1. Xác định severity theo bảng dưới',
      '2. Gọi / ping người theo cột "Escalate tới"',
      '3. Ghi log escalation vào incident thread',
      '4. Update status mỗi 15 phút cho đến khi resolve',
      '',
      '## Bảng escalation',
      '| Severity | Điều kiện | Escalate tới | Kênh | Thời gian phản hồi |',
      '|---|---|---|---|---|',
      '| SEV1 | Outage toàn hệ thống | Ops Lead + CTO | Phone + Slack | 5 phút |',
      '| SEV2 | Degraded, 1 service | Ops oncall | Slack #incidents | 15 phút |',
      '| SEV3 | Lỗi nhỏ, không ảnh hưởng SLA | Ops next shift | Ticket | 4 giờ |',
      '',
      '## SOP liên quan',
      '- Oncall handoff SOP (TODO: link)',
      '- Xử lý ticket P1 (TODO: link)',
      '',
      '## Người duy trì',
      'TODO(ops-lead): điền tên + email người chịu trách nhiệm review SOP này định kỳ.',
    ].join('\n'),
  },
  {
    title: '[MẪU] Quy trình oncall handoff',
    template_key: 'sop',
    space_slug: 'ops-oncall',
    dept_code: 'ops',
    tags: ['oncall', 'handoff', 'shift', 'mẫu'],
    body: [
      '# Quy trình oncall handoff',
      '',
      '<!-- TODO(ops-lead): điền thời gian shift, kênh Slack, link checklist thực tế -->',
      '',
      '## Đối tượng áp dụng',
      'Ops oncall — người bàn giao và người nhận ca.',
      '',
      '## Mục đích',
      'Đảm bảo không mất context khi chuyển shift. Người nhận ca nắm được: incident đang mở, alert đang active, task pending.',
      '',
      '## Điều kiện tiên quyết',
      '- Có quyền truy cập dashboard (TODO: link)',
      '- Đã join kênh #oncall-handoff',
      '',
      '## Các bước thực hiện',
      '',
      '### Người bàn giao (15 phút trước hết ca)',
      '1. Mở handoff note template (TODO: link Notion/Confluence)',
      '2. Điền: incidents đang mở + status, alert nào đang mute và lý do, task dở dang',
      '3. Post vào #oncall-handoff, tag người nhận',
      '4. Chuyển quyền PagerDuty sang người nhận',
      '',
      '### Người nhận ca',
      '1. Đọc handoff note',
      '2. Xác nhận đã nhận bằng reply thread',
      '3. Kiểm tra dashboard — alert nào cần follow up ngay?',
      '4. Nếu có incident đang mở → join incident channel, đọc update',
      '',
      '## SOP liên quan',
      '- Escalation matrix (TODO: link)',
      '',
      '## Người duy trì',
      'TODO(ops-lead): điền tên người chịu trách nhiệm update SOP này.',
    ].join('\n'),
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load the default DataSource export (TypeORM CLI-compatible named export is `default`).
  const dataSourceModule = await import('../db/data-source');
  // data-source.ts exports `default new DataSource(...)` — handle both CJS default wrapper and direct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDs = (dataSourceModule as any).default ?? dataSourceModule;
  const ds: DataSource = rawDs instanceof DataSource ? rawDs : (rawDs.default as DataSource);

  try {
    await ds.initialize();
    console.log('[seed-sample-ops] DB connected');

    for (const artifact of SAMPLE_ARTIFACTS) {
      // Check duplicate by title + template_key.
      const existing = await ds.query(
        `SELECT id FROM artifacts WHERE title = $1 AND template_key = $2 LIMIT 1`,
        [artifact.title, artifact.template_key],
      );
      if (existing.length > 0) {
        console.log(`[seed-sample-ops] SKIP (exists): "${artifact.title}"`);
        continue;
      }

      // Resolve space_id.
      const spaceRows = await ds.query(
        `SELECT id FROM spaces WHERE slug = $1 LIMIT 1`,
        [artifact.space_slug],
      );
      if (spaceRows.length === 0) {
        console.warn(`[seed-sample-ops] WARN: space '${artifact.space_slug}' not found — skipping "${artifact.title}"`);
        continue;
      }
      const spaceId: number = spaceRows[0].id;

      // Resolve department_id.
      const deptRows = await ds.query(
        `SELECT id FROM departments WHERE code = $1 LIMIT 1`,
        [artifact.dept_code],
      );
      if (deptRows.length === 0) {
        console.warn(`[seed-sample-ops] WARN: dept '${artifact.dept_code}' not found — skipping "${artifact.title}"`);
        continue;
      }
      const deptId: number = deptRows[0].id;

      // Insert artifact — status=pending (requires reviewer approval before published).
      await ds.query(
        `INSERT INTO artifacts
           (title, template_key, space_id, department_id, tags, body, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', now(), now())`,
        [
          artifact.title,
          artifact.template_key,
          spaceId,
          deptId,
          artifact.tags,
          artifact.body,
        ],
      );
      console.log(`[seed-sample-ops] INSERTED: "${artifact.title}"`);
    }

    console.log('[seed-sample-ops] Done. Review artifacts at /artifacts (status=pending).');
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed-sample-ops] Fatal:', err);
  process.exit(1);
});
