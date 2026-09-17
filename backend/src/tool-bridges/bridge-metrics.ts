import { Counter, Histogram, Registry } from 'prom-client';

// Prometheus metrics for tool bridge HTTP proxy calls.
// Registered on the shared MetricsService registry (injected via constructor).
// Labels:
//   tool            — bridge name (e.g. osh_list_devices)
//   upstream_status — HTTP status from upstream (e.g. "200", "403", "500", "timeout")
//   outcome         — "success" | "error" | "timeout" | "path_c_block"

export interface BridgeMetrics {
  callsTotal: Counter<string>;
  latencySeconds: Histogram<string>;
  responseBytes: Histogram<string>;
  truncatedTotal: Counter<string>;
}

export function createBridgeMetrics(registry: Registry): BridgeMetrics {
  const callsTotal = new Counter({
    name: 'onemcp_bridge_tool_calls_total',
    help: 'Total bridge tool proxy calls (tool, upstream_status, outcome)',
    labelNames: ['tool', 'upstream_status', 'outcome'],
    registers: [registry],
  });

  const latencySeconds = new Histogram({
    name: 'onemcp_bridge_tool_latency_seconds',
    help: 'End-to-end latency for bridge tool HTTP proxy calls',
    labelNames: ['tool'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    registers: [registry],
  });

  const responseBytes = new Histogram({
    name: 'onemcp_bridge_tool_response_bytes',
    help: 'Response body size in bytes (after cap) for bridge tool calls',
    labelNames: ['tool'],
    buckets: [256, 1024, 8192, 65536, 262144, 1048576],
    registers: [registry],
  });

  const truncatedTotal = new Counter({
    name: 'onemcp_bridge_tool_truncated_total',
    help: 'Bridge tool responses truncated due to 1MB cap',
    labelNames: ['tool'],
    registers: [registry],
  });

  return { callsTotal, latencySeconds, responseBytes, truncatedTotal };
}
