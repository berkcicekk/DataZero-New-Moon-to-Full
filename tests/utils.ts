/** Small helpers shared by the DataZero test suite. */

/** A buffer of `length` cryptographically random bytes. */
export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Deterministic 32-byte tag for an interest category.
 *
 * Production code would hash the category with the same domain separation the
 * contract uses; for tests a zero-padded UTF-8 encoding is enough and keeps
 * failures readable.
 */
export const segmentTag = (category: string): Uint8Array => {
  const encoded = new TextEncoder().encode(category);
  if (encoded.length > 32) {
    throw new Error(`segmentTag: "${category}" does not fit in 32 bytes`);
  }
  const tag = new Uint8Array(32);
  tag.set(encoded);
  return tag;
};

/**
 * Drop trailing zero bytes.
 *
 * The Compact runtime renders ledger values with trailing zeros trimmed — a
 * 32-byte cell holding `"travel"` prints as six bytes, not thirty-two. Any
 * search for a fixed-width value in that rendering has to trim the needle the
 * same way, or a hash that happens to end in `00` silently fails to match.
 */
export const trimTrailingZeros = (bytes: Uint8Array): Uint8Array => {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.subarray(0, end);
};

/**
 * Whether `haystack` contains `needle` as a contiguous run of bytes.
 *
 * Used by the privacy tests to assert that a secret never shows up anywhere in
 * the serialized public ledger.
 */
export const containsBytes = (haystack: Uint8Array, needle: Uint8Array): boolean => {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
};
