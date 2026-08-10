import { Injectable, Logger } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// In-memory session store for Streamable HTTP transport sessions.
// Each session = one active McpServer↔transport pair.
// TODO (v2): swap Map for Redis-backed store to survive restart.
export interface McpSession {
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
}

@Injectable()
export class McpSessionStore {
  private readonly log = new Logger(McpSessionStore.name);
  private readonly sessions = new Map<string, McpSession>();

  get(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: McpSession): void {
    this.sessions.set(sessionId, session);
    this.log.debug(`session created: ${sessionId} (total=${this.sessions.size})`);
  }

  delete(sessionId: string): void {
    if (this.sessions.delete(sessionId)) {
      this.log.debug(`session deleted: ${sessionId} (total=${this.sessions.size})`);
    }
  }

  size(): number {
    return this.sessions.size;
  }
}
