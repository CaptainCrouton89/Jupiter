import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM, a 12-byte IV is common, but 16 bytes is also fine and typical for AES block size.
const AUTH_TAG_LENGTH = 16;

// Ensure the encryption key is set in environment variables
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
  throw new Error(
    "Invalid ENCRYPTION_KEY. It must be a 64-character hex string (32 bytes). Please generate one and set it in your .env file."
  );
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

/**
 * Encrypts a plaintext string.
 * The IV is generated randomly for each encryption and prepended to the ciphertext,
 * followed by the authTag.
 * Format: [IV (16 bytes)][AuthTag (16 bytes)][Ciphertext]
 * @param text The plaintext string to encrypt.
 * @returns The encrypted string (hex encoded) containing IV, authTag, and ciphertext.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Prepend IV and authTag to the encrypted text
  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

/**
 * Decrypts an encrypted string that was encrypted with the encrypt function.
 * Expects format: [IV (16 bytes)][AuthTag (16 bytes)][Ciphertext]
 * @param encryptedText The hex encoded encrypted string.
 * @returns The decrypted plaintext string.
 * @throws Error if decryption fails (e.g., wrong key, tampered data).
 */
export function decrypt(encryptedText: string): string {
  const totalLength = IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2; // Hex encoding doubles length
  if (encryptedText.length < totalLength) {
    throw new Error("Invalid encrypted text format: too short.");
  }

  const iv = Buffer.from(encryptedText.substring(0, IV_LENGTH * 2), "hex");
  const authTag = Buffer.from(
    encryptedText.substring(IV_LENGTH * 2, totalLength),
    "hex"
  );
  const ciphertext = encryptedText.substring(totalLength);

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
