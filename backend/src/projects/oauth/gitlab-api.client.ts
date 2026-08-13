// Thin wrapper around GitLab REST v4 endpoints needed by the auto-provision flow.
// Uses global fetch (Node 20+). Throws on non-2xx with response body for diagnostics.
export interface GitlabProject {
  id: number;
  path_with_namespace: string;
  default_branch: string | null;
  web_url: string;
}

export interface GitlabDeployToken {
  id: number;
  name: string;
  username: string;
  token: string;
  expires_at: string | null;
  scopes: string[];
}

export interface GitlabHook {
  id: number;
  url: string;
}

export class GitlabApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GitlabApiError';
  }
}

export class GitlabApiClient {
  constructor(private readonly baseUrl: string, private readonly accessToken: string) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v4${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GitlabApiError(res.status, `${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  // GitLab accepts either numeric id or url-encoded 'namespace/path' as :id.
  async getProject(repoIdOrPath: string): Promise<GitlabProject> {
    return this.request<GitlabProject>('GET', `/projects/${encodeURIComponent(repoIdOrPath)}`);
  }

  async createWebhook(projectId: number, url: string, token: string): Promise<GitlabHook> {
    return this.request<GitlabHook>('POST', `/projects/${projectId}/hooks`, {
      url,
      token,
      push_events: true,
      enable_ssl_verification: true,
    });
  }

  async createDeployToken(projectId: number, name: string): Promise<GitlabDeployToken> {
    return this.request<GitlabDeployToken>('POST', `/projects/${projectId}/deploy_tokens`, {
      name,
      scopes: ['read_repository'],
    });
  }
}

// Extract 'group/subgroup/repo' from https://gitlabs.inet.vn/group/subgroup/repo(.git)
export function parseRepoPath(repoUrl: string): string {
  const u = new URL(repoUrl);
  const p = u.pathname.replace(/^\/+/, '').replace(/\.git$/, '');
  if (!p) throw new Error('Cannot extract repo path from URL');
  return p;
}
