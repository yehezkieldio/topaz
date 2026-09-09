import "server-only";

const ED25519 = { name: "Ed25519" } as const;

/**
 * Deterministic JSON serialization (recursively sorted object keys) so
 * signing and verifying the same logical payload always hash the same
 * bytes regardless of the order its fields happened to be constructed in.
 * Plain JSON.stringify doesn't guarantee this across call sites.
 */
const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(",")}}`;
};

/**
 * Signs a sync request payload with this device's Ed25519 private key
 * (08_sync/01_transport_and_pairing.md). The receiving peer verifies this
 * against the public key it stored for this device during pairing before
 * doing anything else with the request.
 */
export const signPayload = async (
  privateKey: CryptoKey,
  payload: unknown
): Promise<string> => {
  const data = new TextEncoder().encode(canonicalize(payload));
  const signature = await crypto.subtle.sign(ED25519, privateKey, data);
  return Buffer.from(signature).toString("base64");
};

/**
 * Verifies a sync request's signature against a peer's stored public key.
 * Never throws -- a malformed key, signature, or payload is just "doesn't
 * verify," the same outcome as a genuinely wrong signature, so a caller
 * can't distinguish a corrupt request from a forged one.
 */
export const verifySignature = async (
  publicKeyRawBase64: string,
  payload: unknown,
  signatureBase64: string
): Promise<boolean> => {
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(Buffer.from(publicKeyRawBase64, "base64")),
      ED25519,
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(canonicalize(payload));
    const signature = new Uint8Array(Buffer.from(signatureBase64, "base64"));
    return await crypto.subtle.verify(ED25519, publicKey, signature, data);
  } catch {
    return false;
  }
};
