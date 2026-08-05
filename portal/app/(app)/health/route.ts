export const dynamic = 'force-dynamic';

// Portal liveness — used by docker healthcheck.
export function GET() {
  return Response.json({
    status: 'ok',
    service: 'onemcp-portal',
    timestamp: new Date().toISOString(),
  });
}
