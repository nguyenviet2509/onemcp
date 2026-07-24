import { Artifact } from '../artifacts/entities/artifact.entity';
import { ArtifactVersion } from '../artifacts/entities/artifact-version.entity';

// Max chars sent to TEI — avoids overloading the model on very large KB entries.
const MAX_EMBED_CHARS = 2000;

// Build the text representation of an artifact for embedding.
// Concat: title + body + tags. Truncate to MAX_EMBED_CHARS.
export function buildArtifactEmbedText(artifact: Artifact, version: ArtifactVersion): string {
  const tags = Array.isArray(artifact.tags) ? artifact.tags.join(' ') : '';
  const raw = [artifact.title, version.body, tags].filter(Boolean).join('\n');
  return raw.length > MAX_EMBED_CHARS ? raw.slice(0, MAX_EMBED_CHARS) : raw;
}
