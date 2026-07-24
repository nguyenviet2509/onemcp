// EmbeddingProvider — interface for swappable embedding backends.
// Current impl: E5SmallLocalProvider (self-hosted TEI container).
// Keep interface stable; add new impls behind this contract.
export interface EmbeddingProvider {
  /** Human-readable provider name, used in metrics labels. */
  readonly name: string;
  /** Vector dimensionality — must match pgvector column dimension (384). */
  readonly dim: number;
  /** Embed a single text string, return float array of length `dim`. */
  embed(text: string): Promise<number[]>;
  /** Batch embed — returns parallel array of vectors. */
  embedBatch(texts: string[]): Promise<number[][]>;
}
