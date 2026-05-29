export function chunkPairs(
  pairs: [string, string][],
  maxChars = 6000,
  maxItems = 80,
): [string, string][][] {
  const chunks: [string, string][][] = []
  let buf: [string, string][] = []
  let chars = 0

  for (const [k, v] of pairs) {
    const itemJson = JSON.stringify({ key: k, value: v })
    if (buf.length >= maxItems || (buf.length > 0 && chars + itemJson.length > maxChars)) {
      chunks.push(buf)
      buf = []
      chars = 0
    }
    buf.push([k, v])
    chars += itemJson.length
  }
  if (buf.length > 0) chunks.push(buf)
  return chunks
}
