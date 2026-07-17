export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">OneMCP</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Internal MCP server — v1 pilot Kỹ thuật (P1 scaffold).
      </p>
      <div className="mt-8 rounded-lg border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Status</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
          <li>Backend health: <a className="text-blue-600 hover:underline" href="/api/health">/api/health</a></li>
          <li>Portal health: <a className="text-blue-600 hover:underline" href="/health">/health</a></li>
          <li>Mode: <code>v1-trust-header</code></li>
        </ul>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Access controlled by IP CIDR + <code>X-Onemcp-User</code> header. Full auth deferred (post-v1).
      </p>
    </main>
  );
}
