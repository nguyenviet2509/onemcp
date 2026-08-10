import { Controller, Get, Logger, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AuthedRequest } from '../common/user-request';
import { McpSdkServerFactory } from './mcp-sdk-server.factory';
import { McpSession, McpSessionStore } from './mcp-session.store';

// MCP Streamable HTTP transport — MCP spec 2025-03-26.
// Routes:
//   POST /api/mcp/rpc  — JSON-RPC (initialize + tools/call + all methods)
//   GET  /api/mcp/stream — SSE channel for server-initiated notifications
//
// Feature-flagged: only active when MCP_TRANSPORT=streamable.
// Auth: TrustUserMiddleware + ApiKeyMiddleware gate this same as /api/mcp.
// Session: stateful, Map<sessionId, McpSession> (in-memory, lost on restart — see mcp-session.store.ts).

const SESSION_HEADER = 'mcp-session-id';

@Controller('mcp')
export class StreamableHttpController {
  private readonly log = new Logger(StreamableHttpController.name);
  private readonly enabled: boolean;

  constructor(
    private readonly factory: McpSdkServerFactory,
    private readonly sessions: McpSessionStore,
    private readonly config: ConfigService,
  ) {
    const flag = this.config.get<string>('MCP_TRANSPORT', 'jsonrpc');
    this.enabled = flag === 'streamable';
    if (this.enabled) {
      this.log.log('Streamable HTTP transport ENABLED (MCP_TRANSPORT=streamable)');
    } else {
      this.log.log('Streamable HTTP transport DISABLED (MCP_TRANSPORT!=streamable) — routes dormant');
    }
  }

  // POST /api/mcp/rpc — handles initialize, tools/list, tools/call, etc.
  // On initialize: creates new session + transport + McpServer, returns Mcp-Session-Id.
  // Subsequent calls: reuses existing transport by session ID.
  @Post('rpc')
  async handleRpc(@Req() req: AuthedRequest, @Res() res: Response): Promise<void> {
    if (!this.enabled) {
      res.status(404).json({ error: 'Streamable HTTP transport disabled (MCP_TRANSPORT=jsonrpc)' });
      return;
    }

    const sessionId = req.headers[SESSION_HEADER] as string | undefined;

    // Existing session — route to its transport.
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: `Session ${sessionId} not found or expired` });
        return;
      }
      try {
        await session.transport.handleRequest(req as unknown as Request, res);
      } catch (err) {
        this.log.error(`rpc session=${sessionId} error: ${(err as Error).message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal error' });
        }
      }
      return;
    }

    // No session ID — expect initialize request, create new session.
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    const server = this.factory.createServer(req);

    const session: McpSession = { transport, createdAt: new Date() };
    this.sessions.set(newSessionId, session);

    // Clean up session when transport closes.
    transport.onclose = () => {
      this.sessions.delete(newSessionId);
      this.log.debug(`transport closed, session removed: ${newSessionId}`);
    };

    try {
      await server.connect(transport);
      await transport.handleRequest(req as unknown as Request, res);
    } catch (err) {
      this.log.error(`rpc init sessionId=${newSessionId} error: ${(err as Error).message}`);
      this.sessions.delete(newSessionId);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal error during initialize' });
      }
    }
  }

  // GET /api/mcp/stream — SSE channel; client passes Mcp-Session-Id header.
  // Holds the connection open for server→client notifications.
  @Get('stream')
  async handleStream(@Req() req: AuthedRequest, @Res() res: Response): Promise<void> {
    if (!this.enabled) {
      res.status(404).json({ error: 'Streamable HTTP transport disabled (MCP_TRANSPORT=jsonrpc)' });
      return;
    }

    const sessionId = req.headers[SESSION_HEADER] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: `Missing ${SESSION_HEADER} header` });
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: `Session ${sessionId} not found or expired` });
      return;
    }

    try {
      await session.transport.handleRequest(req as unknown as Request, res);
    } catch (err) {
      this.log.error(`stream session=${sessionId} error: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal error on stream' });
      }
    }
  }
}
