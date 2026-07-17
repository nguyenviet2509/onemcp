// Sanitize runbook body trước khi trả về qua MCP load_runbook (RT-11).
// Strip BiDi override characters (U+202A..U+202E, U+2066..U+2069) và non-printable chars
// ngoại trừ \n \r \t — ngăn homoglyph/inject attack trên ops paste vào terminal.

// BiDi control chars: LRE(202A) RLE(202B) PDF(202C) LRO(202D) RLO(202E)
//                   + FSI(2066) LRI(2067) RLI(2068) PDI(2069)
const BIDI_CONTROLS_RE = /[‪-‮⁦-⁩]/g;

// Non-printable ASCII (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F) + DEL (0x7F).
// Giữ lại: \t (0x09), \n (0x0A), \r (0x0D).
const NON_PRINTABLE_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Xóa BiDi override chars và non-printable chars khỏi runbook body.
 * Gọi trước khi trả response trong load_runbook MCP tool.
 */
export function sanitizeRunbookOutput(body: string): string {
  return body.replace(BIDI_CONTROLS_RE, '').replace(NON_PRINTABLE_RE, '');
}
