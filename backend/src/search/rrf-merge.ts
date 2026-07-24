// Reciprocal Rank Fusion (RRF) merge helper.
// Formula: score(d) = Σ 1/(k + rank_i(d)) with k=60 (standard).
// Merges FTS and vector result lists by versionId → returns sorted by RRF score desc.

export interface FtsResult {
  artifactId: string;
  versionId: string;
  ftsRank: number;
  snippet: string;
}

export interface VectorResult {
  artifactId: string;
  versionId: string;
  distance: number; // cosine distance (lower = more similar)
  vectorRank: number;
}

export interface MergedResult {
  artifactId: string;
  versionId: string;
  rrfScore: number;
  ftsRank?: number;
  vectorRank?: number;
  snippet: string; // from FTS if available, fallback empty
}

const RRF_K = 60;

/**
 * Merge FTS and vector result lists using RRF.
 * @param ftsResults - ordered by ftsRank desc (rank 1 = best)
 * @param vectorResults - ordered by distance asc (rank 1 = closest)
 * @param limit - max results to return (default 20)
 */
export function rrfMerge(
  ftsResults: FtsResult[],
  vectorResults: VectorResult[],
  limit = 20,
): MergedResult[] {
  // Map versionId → accumulated RRF score + metadata
  const scoreMap = new Map<
    string,
    { artifactId: string; rrfScore: number; ftsRank?: number; vectorRank?: number; snippet: string }
  >();

  // Assign 1-based rank to FTS results (already ordered by score desc)
  ftsResults.forEach((r, idx) => {
    const rank = idx + 1;
    const contribution = 1 / (RRF_K + rank);
    const existing = scoreMap.get(r.versionId);
    if (existing) {
      existing.rrfScore += contribution;
      existing.ftsRank = rank;
      // Prefer FTS snippet (has ts_headline highlight)
      existing.snippet = r.snippet || existing.snippet;
    } else {
      scoreMap.set(r.versionId, {
        artifactId: r.artifactId,
        rrfScore: contribution,
        ftsRank: rank,
        snippet: r.snippet,
      });
    }
  });

  // Assign 1-based rank to vector results (already ordered by distance asc)
  vectorResults.forEach((r, idx) => {
    const rank = idx + 1;
    const contribution = 1 / (RRF_K + rank);
    const existing = scoreMap.get(r.versionId);
    if (existing) {
      existing.rrfScore += contribution;
      existing.vectorRank = rank;
    } else {
      scoreMap.set(r.versionId, {
        artifactId: r.artifactId,
        rrfScore: contribution,
        vectorRank: rank,
        snippet: '',
      });
    }
  });

  // Sort by RRF score desc, apply limit
  return Array.from(scoreMap.entries())
    .map(([versionId, v]) => ({ versionId, ...v }))
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);
}
