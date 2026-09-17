'use strict';

const express = require('express');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const MOCK_BEARER = process.env.MOCK_BEARER || 'dev-fixed-token';

// --- RBAC gate config ---
const allowMap = {
  'test-user-x': ['osh_admin:tool.create_waf', 'osh_admin:tool.create_rate_limit', 'osh_admin:tool.query_access_log'],
  'test-user-y': [],
  'test-user-partial': ['osh_admin:tool.query_access_log'],
};

const routePerm = {
  'POST /waf/rules':     'osh_admin:tool.create_waf',
  'POST /rate-limits':   'osh_admin:tool.create_rate_limit',
  'GET /access-logs':    'osh_admin:tool.query_access_log',
};

// --- Middleware: authBearer ---
function authBearer(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${MOCK_BEARER}`) {
    return res.status(401).json({ error: 'unauthorized', hint: 'Bearer token mismatch' });
  }
  next();
}

// --- Middleware: logHeaders ---
function logHeaders(req, res, next) {
  const entry = {
    ts: new Date().toISOString(),
    method: req.method,
    path: req.path,
    user: req.headers['x-onemcp-user'] || null,
    user_sub: req.headers['x-onemcp-user-sub'] || null,
    correlation_id: req.headers['x-onemcp-correlation-id'] || null,
    scenario: req.query.scenario || null,
  };
  // Outcome filled after gate; store ref for route handlers
  req._logEntry = entry;
  next();
}

// --- Middleware: fakeRbacGate ---
function fakeRbacGate(req, res, next) {
  // Debug bypass
  if (req.headers['x-force-rbac-bypass'] === 'true') {
    if (req._logEntry) req._logEntry.outcome = 'bypass';
    return next();
  }

  const sub = req.headers['x-onemcp-user-sub'];
  const key = `${req.method} ${req.path}`;
  const requiredPerm = routePerm[key];

  // No permission required for this route (e.g. /health)
  if (!requiredPerm) {
    if (req._logEntry) req._logEntry.outcome = 'allow';
    return next();
  }

  const userPerms = allowMap[sub] || [];
  if (!userPerms.includes(requiredPerm)) {
    if (req._logEntry) {
      req._logEntry.outcome = 'deny';
      req._logEntry.missing_permission = requiredPerm;
      process.stdout.write(JSON.stringify(req._logEntry) + '\n');
    }
    return res.status(403).json({ error: 'forbidden', missing_permission: requiredPerm });
  }

  if (req._logEntry) req._logEntry.outcome = 'allow';
  next();
}

// --- Middleware: scenarioHandler (applied per route after gate) ---
function scenarioHandler(req, res, next) {
  const scenario = req.query.scenario;
  if (!scenario) return next();

  if (scenario === 'slow') {
    // 15s delay — OneMCP 10s abort will trigger first
    return setTimeout(() => res.json({ status: 'ok', note: 'slow response' }), 15000);
  }
  if (scenario === '5xx') {
    return res.status(502).json({ error: 'upstream error', scenario: '5xx' });
  }
  if (scenario === 'large') {
    // 2MB body to trigger OneMCP response cap
    const chunk = 'x'.repeat(1024);
    let body = '[';
    for (let i = 0; i < 2048; i++) body += `"${chunk}",`;
    body = body.slice(0, -1) + ']';
    res.setHeader('Content-Type', 'application/json');
    return res.send(body);
  }
  if (scenario === 'malformed') {
    res.setHeader('Content-Type', 'application/json');
    return res.send('{bad json :::');
  }
  next();
}

// --- Emit log entry after route handler ---
function emitLog(req) {
  if (req._logEntry) {
    process.stdout.write(JSON.stringify(req._logEntry) + '\n');
  }
}

// --- Route handlers ---

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: 'mock-1.0' });
});

app.post('/waf/rules', authBearer, logHeaders, fakeRbacGate, scenarioHandler, (req, res) => {
  const { domain, ip, rules } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain required' });
  const result = {
    status: 'created',
    waf_id: `waf-mock-${randomUUID().slice(0, 8)}`,
    domain,
    ip: ip || null,
    rules: rules || ['block'],
  };
  emitLog(req);
  res.status(201).json(result);
});

app.post('/rate-limits', authBearer, logHeaders, fakeRbacGate, scenarioHandler, (req, res) => {
  const { domain, limit_rps } = req.body || {};
  if (!domain || limit_rps == null) return res.status(400).json({ error: 'domain and limit_rps required' });
  const result = {
    status: 'created',
    policy_id: `rl-mock-${randomUUID().slice(0, 8)}`,
    domain,
    limit_rps,
  };
  emitLog(req);
  res.status(201).json(result);
});

app.get('/access-logs', authBearer, logHeaders, fakeRbacGate, scenarioHandler, (req, res) => {
  const { domain, since, limit } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain required' });
  const count = Math.min(Math.max(parseInt(limit) || 20, 5), 100);
  const now = Date.now();
  const entries = Array.from({ length: count }, (_, i) => ({
    ts: new Date(now - i * 60000).toISOString(),
    domain,
    src_ip: `203.0.113.${(i % 254) + 1}`,
    method: i % 3 === 0 ? 'POST' : 'GET',
    path: i % 5 === 0 ? '/admin/login' : `/api/resource/${i}`,
    status: i % 7 === 0 ? 429 : 200,
    bytes: 512 + i * 17,
  }));
  if (since) {
    // Filter cosmetically — mock doesn't validate ISO date, just notes it
    entries[0].since_filter_applied = since;
  }
  emitLog(req);
  res.json(entries);
});

app.listen(PORT, () => {
  process.stdout.write(JSON.stringify({
    ts: new Date().toISOString(),
    event: 'start',
    port: PORT,
    bearer_hint: MOCK_BEARER.slice(0, 4) + '****',
    note: 'DEV-ONLY mock — do not deploy to production',
  }) + '\n');
});
