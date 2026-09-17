// Streaming response reader with 1MB hard cap.
// Reads chunks from a ReadableStream (Node fetch/undici), accumulates until cap,
// then cancels the reader and appends a truncation marker.
// NEVER buffers more than cap + final chunk size in memory.

const CAP_BYTES = 1_000_000; // 1MB

export interface CappedRead {
  body: string;
  truncated: boolean;
  bytesRead: number;
}

export async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  cap = CAP_BYTES,
): Promise<CappedRead> {
  if (!stream) return { body: '', truncated: false, bytesRead: 0 };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      const remaining = cap - total;
      if (value.length >= remaining) {
        // Take only what fits under cap, then stop.
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        truncated = true;
        // Estimate omitted: we know at least value.length - remaining more bytes.
        // Cancel signals upstream to release connection.
        await reader.cancel().catch(() => {});
        break;
      }

      chunks.push(value);
      total += value.length;
    }
  } catch {
    // Stream read error — return whatever we have accumulated.
    truncated = true;
  }

  const body = Buffer.concat(chunks).toString('utf8');
  const omitted = truncated ? `\n[...TRUNCATED: response exceeded ${cap} bytes, partial content shown]` : '';

  return {
    body: body + omitted,
    truncated,
    bytesRead: total,
  };
}
