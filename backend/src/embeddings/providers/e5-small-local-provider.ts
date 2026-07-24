import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding-provider.interface';

// Default embedding provider: HuggingFace text-embeddings-inference (TEI) container
// running intfloat/multilingual-e5-small. Internal-only — not exposed outside docker network.
// TEI API: POST /embed { inputs: string | string[] } → float[][] (always 2D).
// Dim=384 matches embeddings table vector(384) column.
@Injectable()
export class E5SmallLocalProvider implements EmbeddingProvider {
  readonly name = 'e5-small-local';
  readonly dim = 384;

  private readonly log = new Logger(E5SmallLocalProvider.name);
  private readonly baseUrl: string;
  // HTTP request timeout in ms — TEI p95 <500ms on CPU; 10s covers cold start.
  private readonly timeoutMs = 10_000;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('EMBEDDING_URL', 'http://tei:80');
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/embed`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: texts }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`TEI embed request failed: ${msg}`);
      throw new Error(`EmbeddingProvider request failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`TEI embed HTTP ${res.status}: ${body}`);
      throw new Error(`EmbeddingProvider HTTP ${res.status}`);
    }

    // TEI always returns float[][] even for single input.
    const data = (await res.json()) as number[][];
    if (!Array.isArray(data) || data.length !== texts.length) {
      throw new Error(`EmbeddingProvider unexpected response shape`);
    }
    return data;
  }
}
