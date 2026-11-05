/**
 * A keyed fingerprint that reveals edits made to stored data outside the game.
 * The key ships with the game, so this deters casual edits; it is not proof.
 * Synchronous on purpose: shift saves are written while the page is being hidden.
 */
const SEAL_KEY = 'vector-approach:seal:7f3c9a1e';

/** JSON with sorted object keys, so equal data always yields equal text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// cyrb53: a small, well-mixed 53-bit string hash.
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The seal of a value, ignoring any `seal` field it already carries. */
export function sealOf(value: object): string {
  const { seal: _ignored, ...data } = value as Record<string, unknown>;
  return cyrb53(SEAL_KEY + canonicalJson(data));
}

export function sealMatches(value: object, seal: unknown): boolean {
  return typeof seal === 'string' && seal === sealOf(value);
}
