// Slack mrkdwn injection prevention utilities (RT-6).
// Escape control chars, strip mention tokens, cap length.

const MAX_TEXT_LEN = 200;

/**
 * Escape a string for safe inclusion in Slack mrkdwn text.
 * - Strips <!channel>, <!here>, <!everyone>, <!subteam^...> tokens.
 * - Strips @channel, @here, @everyone plaintext mentions.
 * - Escapes mrkdwn control chars: & < >
 * - Caps length to MAX_TEXT_LEN (200) chars.
 */
export function escapeSlackText(s: string): string {
  if (!s) return '';
  let out = String(s).slice(0, MAX_TEXT_LEN);

  // Strip <!channel>, <!here>, <!everyone> and similar special tokens.
  out = out.replace(/<!(?:channel|here|everyone)>/gi, '[mention-stripped]');
  // Strip <!subteam^XXXXX> and <!subteam^XXXXX|label> forms.
  out = out.replace(/<!subteam\^[^>]+>/gi, '[subteam-stripped]');
  // Strip plaintext @channel, @here, @everyone (no angle brackets).
  out = out.replace(/@(?:channel|here|everyone)/gi, '[mention-stripped]');

  // Escape Slack mrkdwn control chars in order: & first (avoid double-escaping).
  out = out.replace(/&/g, '&amp;');
  out = out.replace(/</g, '&lt;');
  out = out.replace(/>/g, '&gt;');

  return out;
}
