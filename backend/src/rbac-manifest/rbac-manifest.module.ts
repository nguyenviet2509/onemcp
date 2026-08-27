import { Module } from '@nestjs/common';
import { RbacManifestController } from './rbac-manifest.controller';

/**
 * RBAC manifest module — exposes /.well-known/rbac-permissions.json for
 * Central RBAC self-registration sync (onelog plan 260826-1644 Phase 08).
 *
 * Public endpoint (no auth) — central-rbac fetches via SSRF-hardened fetcher.
 */
@Module({
  controllers: [RbacManifestController],
})
export class RbacManifestModule {}
