const startsWithBytes = (bytes, signature) => signature.every((value, index) => bytes[index] === value);

export function validImageMagic(mimeType, bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || []);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return bytes.length >= 8 && startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/webp") return bytes.length >= 12 && startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (mimeType === "image/avif") return bytes.length >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
    ["avif", "avis"].includes(new TextDecoder().decode(bytes.slice(8, 12)));
  return false;
}
