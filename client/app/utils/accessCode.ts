const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 8): string {
  const limit = 256 - (256 % ALPHABET.length);
  const result: string[] = [];
  while (result.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && result.length < length) {
        result.push(ALPHABET[byte % ALPHABET.length]);
      }
    }
  }
  return result.join("");
}
