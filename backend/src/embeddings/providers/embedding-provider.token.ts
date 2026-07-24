// NestJS DI token for EmbeddingProvider — injected as @Inject(EMBEDDING_PROVIDER).
// Use Symbol to avoid string collision with other providers.
export const EMBEDDING_PROVIDER = Symbol('EmbeddingProvider');
