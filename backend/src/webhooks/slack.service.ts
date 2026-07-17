import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Thin wrapper for posting messages to a Slack incoming webhook URL.
// - Timeout: 5s (RT-8: never block Alertmanager response).
// - Throws on non-2xx so caller can handle Slack failures distinctly.
@Injectable()
export class SlackService {
  private readonly log = new Logger(SlackService.name);
  private readonly webhookUrl: string;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = this.config.get<string>('SLACK_ONCALL_WEBHOOK_URL', '');
  }

  /**
   * Post a plain text / mrkdwn message to the configured Slack webhook.
   * Caller is responsible for escaping interpolated strings before passing text.
   * Throws if Slack URL not configured or POST fails with non-2xx.
   */
  async post(text: string): Promise<void> {
    if (!this.webhookUrl) {
      this.log.warn('slack post skipped — SLACK_ONCALL_WEBHOOK_URL not configured');
      throw new Error('SLACK_ONCALL_WEBHOOK_URL not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Slack responded ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Slack POST timed out after 5s');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
