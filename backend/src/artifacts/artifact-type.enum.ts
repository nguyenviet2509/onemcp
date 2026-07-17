// Loại artifact — enum-like union, không dùng TypeScript enum (compile complexity).
export const ARTIFACT_TYPES = ['report', 'research', 'kb'] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

// Trạng thái artifact top-level (khác với version status).
export const ARTIFACT_STATUSES = ['pending', 'published', 'rejected', 'archived'] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export const ARTIFACT_VERSION_STATUSES = ['pending', 'active', 'rejected'] as const;
export type ArtifactVersionStatus = (typeof ARTIFACT_VERSION_STATUSES)[number];
