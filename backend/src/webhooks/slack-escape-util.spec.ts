/**
 * Unit tests for escapeSlackText() — RT-6 Slack mrkdwn injection prevention.
 * Covers: mention stripping, mrkdwn char escaping, length cap, edge cases.
 */
import { escapeSlackText } from './slack-escape.util';

describe('escapeSlackText', () => {
  describe('mention stripping', () => {
    it('strips <!channel> token', () => {
      expect(escapeSlackText('hello <!channel> world')).toBe('hello [mention-stripped] world');
    });

    it('strips <!here> token', () => {
      expect(escapeSlackText('<!here> urgent')).toBe('[mention-stripped] urgent');
    });

    it('strips <!everyone> token', () => {
      expect(escapeSlackText('ping <!everyone>')).toBe('ping [mention-stripped]');
    });

    it('strips <!subteam^S123ABC> token', () => {
      expect(escapeSlackText('<!subteam^S123ABC> please review')).toBe(
        '[subteam-stripped] please review',
      );
    });

    it('strips <!subteam^S123|label> token with label', () => {
      expect(escapeSlackText('notify <!subteam^S123|oncall-team> now')).toBe(
        'notify [subteam-stripped] now',
      );
    });

    it('strips @channel plaintext mention', () => {
      expect(escapeSlackText('alert @channel asap')).toBe('alert [mention-stripped] asap');
    });

    it('strips @here plaintext mention', () => {
      expect(escapeSlackText('@here disk full')).toBe('[mention-stripped] disk full');
    });

    it('strips @everyone plaintext mention', () => {
      expect(escapeSlackText('FYI @everyone')).toBe('FYI [mention-stripped]');
    });

    it('is case-insensitive for mention tokens', () => {
      expect(escapeSlackText('<!CHANNEL>')).toBe('[mention-stripped]');
      expect(escapeSlackText('@HERE')).toBe('[mention-stripped]');
    });
  });

  describe('mrkdwn control char escaping', () => {
    it('escapes & to &amp;', () => {
      expect(escapeSlackText('bread & butter')).toBe('bread &amp; butter');
    });

    it('escapes < to &lt;', () => {
      // All < and > are escaped — Slack mrkdwn uses these for links/mentions.
      expect(escapeSlackText('<script>xss</script>')).toBe('&lt;script&gt;xss&lt;/script&gt;');
    });

    it('escapes > to &gt;', () => {
      expect(escapeSlackText('a > b')).toBe('a &gt; b');
    });

    it('escapes all three in a phishing payload', () => {
      // Simulates attacker setting: annotations.summary = "<!channel> click http://phish|real"
      const payload = '<!channel> click <http://phish.example.com|real-onemcp>';
      const escaped = escapeSlackText(payload);
      expect(escaped).toContain('[mention-stripped]');
      // After mention strip: " click <http://phish.example.com|real-onemcp>"
      // Then < and > are escaped.
      expect(escaped).toContain('&lt;');
      expect(escaped).not.toContain('<!channel>');
    });

    it('escapes & before < and > to avoid double-escaping', () => {
      // "&amp;" should become "&amp;amp;" — & is always escaped first.
      expect(escapeSlackText('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    });
  });

  describe('length cap', () => {
    it('caps output at 200 chars', () => {
      const long = 'x'.repeat(500);
      const result = escapeSlackText(long);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('caps before escaping (200 char input of special chars stays reasonable)', () => {
      // 200 '&' chars → each becomes '&amp;' (5 chars) = 1000 → acceptable, cap is on input
      const result = escapeSlackText('&'.repeat(500));
      // Input sliced to 200 → each & → &amp; → output is 1000 chars (escaping post-cap)
      expect(result).toBe('&amp;'.repeat(200));
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(escapeSlackText('')).toBe('');
    });

    it('returns empty string for null/undefined coerced via guard', () => {
      // The function has a guard: if (!s) return ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(escapeSlackText(null as any)).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(escapeSlackText(undefined as any)).toBe('');
    });

    it('leaves normal text unchanged', () => {
      expect(escapeSlackText('disk full on postgres primary')).toBe(
        'disk full on postgres primary',
      );
    });

    it('handles multiple mentions in one string', () => {
      const input = '<!channel> and @here and <!subteam^S1>';
      const result = escapeSlackText(input);
      expect(result).toBe('[mention-stripped] and [mention-stripped] and [subteam-stripped]');
    });
  });
});
