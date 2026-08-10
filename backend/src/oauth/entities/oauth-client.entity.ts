import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// OAuth 2.1 registered client (RFC 7591 Dynamic Client Registration + manual).
// `clientId` = nanoid(24) — URL-safe. `clientSecretHash` bcrypt of secret; null for
// public clients (PKCE-only, default for DCR).
@Entity({ name: 'oauth_clients' })
export class OAuthClient {
  @PrimaryColumn({ name: 'client_id', type: 'varchar', length: 32 })
  clientId!: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 100, nullable: true })
  clientSecretHash!: string | null;

  @Column({ type: 'text' })
  name!: string;

  // JSONB array of allowed redirect URIs (exact match).
  @Column({ name: 'redirect_uris', type: 'jsonb' })
  redirectUris!: string[];

  // Requested scopes at registration. Actual grant limited by user consent.
  @Column({ name: 'scopes', type: 'jsonb', default: () => `'["mcp"]'::jsonb` })
  scopes!: string[];

  // 'public' (PKCE, no secret) | 'confidential' (secret required).
  @Column({ name: 'token_endpoint_auth_method', type: 'varchar', length: 32, default: 'none' })
  tokenEndpointAuthMethod!: 'none' | 'client_secret_basic' | 'client_secret_post';

  @Index()
  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
