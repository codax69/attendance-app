import crypto from "node:crypto";

const getSecret = () => {
  return process.env.ACCESS_TOKEN_SECRET || "fallback_qr_secret_key_12984";
};

/**
 * Generates a secure signature for a QR payload.
 * @param {object} payload - The QR details
 * @returns {string} The HMAC signature
 */
export const signQrPayload = (payload) => {
  const dataString = `${payload.organizationId || ""}-${payload.departmentId || ""}-${payload.departmentCode || ""}-${payload.dateCode || ""}-${payload.date || ""}-${payload.expiresAt || ""}`;
  return crypto
    .createHmac("sha256", getSecret())
    .update(dataString)
    .digest("hex");
};

/**
 * Verifies if the signature of the QR payload is valid.
 * @param {object} payload - Scanned QR payload
 * @param {string} signature - Scanned key/signature
 * @returns {boolean} True if signature is valid
 */
export const verifyQrPayload = (payload, signature) => {
  if (!signature) return false;
  const expectedSignature = signQrPayload(payload);
  
  // Safe hex decoding
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
};

