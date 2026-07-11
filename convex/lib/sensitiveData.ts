import { ConvexError } from "convex/values";

const ALGORITHM = "AES-GCM";
const IV_LENGTH_BYTES = 12;
export const SENSITIVE_DATA_KEY_VERSION = 1;

function unavailableError() {
  return new ConvexError({
    publicMessage: "Secure data storage is unavailable. Contact the developer.",
  });
}

function unreadableError() {
  return new ConvexError({
    publicMessage: "Secure borrower data could not be read. Try again or contact the developer.",
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw unreadableError();
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const encodedKey = process.env.BORROWER_DATA_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw unavailableError();
  }

  const keyBytes = base64ToBytes(encodedKey);
  if (keyBytes.byteLength !== 32) {
    throw unavailableError();
  }

  return await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSensitiveValue(value: string, context: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const plaintext = new TextEncoder().encode(value);
  const additionalData = new TextEncoder().encode(context);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(additionalData),
    },
    key,
    toArrayBuffer(plaintext)
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSensitiveValue(
  payload: string,
  context: string,
  keyVersion: number
): Promise<string> {
  if (keyVersion !== SENSITIVE_DATA_KEY_VERSION) {
    throw unreadableError();
  }
  const [encodedIv, encodedCiphertext, ...extra] = payload.split(".");
  if (!encodedIv || !encodedCiphertext || extra.length > 0) {
    throw unreadableError();
  }

  try {
    const key = await getEncryptionKey();
    const additionalData = new TextEncoder().encode(context);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: toArrayBuffer(base64ToBytes(encodedIv)),
        additionalData: toArrayBuffer(additionalData),
      },
      key,
      toArrayBuffer(base64ToBytes(encodedCiphertext))
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    throw unreadableError();
  }
}
