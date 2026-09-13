import "server-only";

/**
 * What a pairing code carries (08_sync/01_transport_and_pairing.md): enough
 * for the receiving device to reach and trust the one that generated it.
 * `port` travels alongside `tailnetHostname` rather than being assumed --
 * two devices on the same tailnet won't necessarily run this app on the
 * same port.
 */
export interface PairingPayload {
  deviceId: string;
  publicKeyRaw: string;
  tailnetHostname: string;
  port: number;
}

const PAIRING_CODE_VERSION = 1;

interface PairingCodeEnvelope extends PairingPayload {
  v: number;
}

/**
 * A short, visually-comparable digest of a public key (08_sync/01_transport_and_pairing.md's
 * "public key fingerprint") -- shown alongside a pairing code so the admin
 * can independently confirm the key they just paired with matches the one
 * displayed on the other device, as a second check beyond however the code
 * itself was transferred (QR scan, typed by hand).
 */
export const computeKeyFingerprint = async (
  publicKeyRawBase64: string
): Promise<string> => {
  // Uint8Array.from() (not the Buffer itself) allocates a fresh, definite
  // ArrayBuffer -- see device-identity.ts's fromBase64 for why this matters
  // for Web Crypto's BufferSource<ArrayBuffer> parameter type.
  const keyBytes = Uint8Array.from(Buffer.from(publicKeyRawBase64, "base64"));
  const digest = await crypto.subtle.digest("SHA-256", keyBytes);
  const hex = Buffer.from(digest).toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
};

/**
 * Encodes a device's pairing payload as a compact, copy-pasteable (or
 * QR-encodeable) string. A version field guards against a future format
 * change being silently misread by an older build.
 */
export const encodePairingCode = (payload: PairingPayload): string => {
  const envelope: PairingCodeEnvelope = {
    v: PAIRING_CODE_VERSION,
    ...payload,
  };
  return Buffer.from(JSON.stringify(envelope), "utf-8").toString("base64url");
};

const isValidPort = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 65_535;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Parses and validates a pairing code. Returns null for anything malformed
 * or of an unrecognized version, rather than throwing -- a bad paste/scan
 * is a validation-error UI state at the call site, not an exception.
 */
export const decodePairingCode = (code: string): PairingPayload | null => {
  let envelope: Partial<PairingCodeEnvelope>;
  try {
    envelope = JSON.parse(
      Buffer.from(code, "base64url").toString("utf-8")
    ) as Partial<PairingCodeEnvelope>;
  } catch {
    return null;
  }

  if (
    envelope.v !== PAIRING_CODE_VERSION ||
    !isNonEmptyString(envelope.deviceId) ||
    !isNonEmptyString(envelope.publicKeyRaw) ||
    !isNonEmptyString(envelope.tailnetHostname) ||
    !isValidPort(envelope.port)
  ) {
    return null;
  }

  return {
    deviceId: envelope.deviceId,
    port: envelope.port,
    publicKeyRaw: envelope.publicKeyRaw,
    tailnetHostname: envelope.tailnetHostname,
  };
};
