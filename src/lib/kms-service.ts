// lib/kmsService.ts
import { KeyManagementServiceClient } from "@google-cloud/kms";
import crypto from "crypto";

// --- Configuration ---
const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
const KMS_LOCATION = process.env.KMS_LOCATION;
const KMS_KEYRING_NAME = process.env.KMS_KEYRING_NAME;
const KMS_KEK_NAME = process.env.KMS_KEK_NAME;

// Basic validation on startup
if (
  !GCLOUD_PROJECT_ID ||
  !KMS_LOCATION ||
  !KMS_KEYRING_NAME ||
  !KMS_KEK_NAME
) {
  throw new Error(
    "Missing Google Cloud KMS configuration in environment variables (GCLOUD_PROJECT_ID, KMS_LOCATION, KMS_KEYRING_NAME, KMS_KEK_NAME)."
  );
}

const KEK_RESOURCE_NAME = `projects/${GCLOUD_PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING_NAME}/cryptoKeys/${KMS_KEK_NAME}`;

// Initialize the KMS client (singleton pattern)
let kmsClient: KeyManagementServiceClient;

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    const credentialsJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
    const credentialsFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credentialsJsonString && credentialsJsonString.trim().startsWith("{")) {
      // Priority 1: Use JSON string from GCP_SERVICE_ACCOUNT_KEY_JSON (for Vercel, etc.)
      try {
        const credentials = JSON.parse(credentialsJsonString);
        kmsClient = new KeyManagementServiceClient({ credentials });
        // console.log("KMS Client Initialized with explicit credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.");
      } catch (e) {
        console.error(
          "Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON. Content (first 100 chars):",
          credentialsJsonString?.substring(0, 100),
          "Error:",
          e
        );
        // Fallback or throw error depending on how critical this is
        // For now, let it fall through to try other methods, but log a severe warning.
        console.warn(
          "Falling back on KMS client initialization due to GCP_SERVICE_ACCOUNT_KEY_JSON parse error."
        );
      }
    }

    // If kmsClient is still not initialized, try GOOGLE_APPLICATION_CREDENTIALS path
    if (!kmsClient && credentialsFilePath) {
      // Priority 2: Use file path from GOOGLE_APPLICATION_CREDENTIALS (for local dev)
      // The KeyManagementServiceClient constructor will use this env var by default if no explicit credentials are provided.
      kmsClient = new KeyManagementServiceClient();
      // console.log("KMS Client Initialized using GOOGLE_APPLICATION_CREDENTIALS path.");
    }

    // If kmsClient is still not initialized, use Application Default Credentials
    if (!kmsClient) {
      // Priority 3: Use Application Default Credentials (e.g., when running on GCP infrastructure)
      kmsClient = new KeyManagementServiceClient();
      // console.log("KMS Client Initialized using Application Default Credentials (ADC).");
    }
  }
  return kmsClient;
}

// --- Symmetric Encryption Constants ---
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEK_LENGTH_BYTES = 32;

// --- Symmetric Encryption Helper Functions ---

function generateDek(): Buffer {
  return crypto.randomBytes(DEK_LENGTH_BYTES);
}

function encryptWithDek(plaintextData: Buffer, dek: Buffer): Buffer {
  if (dek.length !== DEK_LENGTH_BYTES) {
    throw new Error(`DEK must be ${DEK_LENGTH_BYTES} bytes for AES-256.`);
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextData), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]);
}

function decryptWithDek(ciphertextPackage: Buffer, dek: Buffer): Buffer {
  if (dek.length !== DEK_LENGTH_BYTES) {
    throw new Error(`DEK must be ${DEK_LENGTH_BYTES} bytes for AES-256.`);
  }
  if (ciphertextPackage.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error(
      `Ciphertext package is too short. Length: ${ciphertextPackage.length}, Required minimum: ${IV_LENGTH + AUTH_TAG_LENGTH}`
    );
  }

  const iv = ciphertextPackage.subarray(0, IV_LENGTH);
  const authTag = ciphertextPackage.subarray(
    ciphertextPackage.length - AUTH_TAG_LENGTH
  );
  const ciphertext = ciphertextPackage.subarray(
    IV_LENGTH,
    ciphertextPackage.length - AUTH_TAG_LENGTH
  );

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted;
  } catch (error) {
    console.error("Symmetric decryption failed (decryptWithDek):", error);
    if (error instanceof Error && error.message.includes("Unsupported state")) {
      throw new Error(
        `Decryption failed: Authentication tag mismatch or invalid data.`
      );
    } else if (error instanceof Error) {
      throw new Error(`Decryption failed: ${error.message}`);
    } else {
      throw new Error(`Decryption failed: ${String(error)}`);
    }
  }
}

// --- KMS Interaction Functions ---

async function encryptDekWithKms(dek: Buffer): Promise<Buffer> {
  const client = getKmsClient();
  try {
    const [response] = await client.encrypt({
      name: KEK_RESOURCE_NAME,
      plaintext: dek,
    });
    if (!response.ciphertext) {
      throw new Error("KMS encryption failed to return ciphertext.");
    }
    if (!(response.ciphertext instanceof Uint8Array)) {
      throw new Error("KMS returned ciphertext in unexpected format.");
    }
    return Buffer.from(response.ciphertext);
  } catch (error) {
    console.error("KMS DEK Encryption failed:", error);
    if (error instanceof Error) {
      throw new Error(`KMS DEK Encryption failed: ${error.message}`);
    } else {
      throw new Error(`KMS DEK Encryption failed: ${String(error)}`);
    }
  }
}

async function decryptDekWithKms(encryptedDek: Buffer): Promise<Buffer> {
  const client = getKmsClient();
  try {
    const [response] = await client.decrypt({
      name: KEK_RESOURCE_NAME,
      ciphertext: encryptedDek,
    });
    if (!response.plaintext) {
      throw new Error("KMS decryption failed to return plaintext.");
    }
    if (!(response.plaintext instanceof Uint8Array)) {
      throw new Error("KMS returned plaintext in unexpected format.");
    }
    return Buffer.from(response.plaintext);
  } catch (error) {
    console.error("KMS DEK Decryption failed:", error);
    if (error instanceof Error) {
      throw new Error(`KMS DEK Decryption failed: ${error.message}`);
    } else {
      throw new Error(`KMS DEK Decryption failed: ${String(error)}`);
    }
  }
}

// --- Public Workflow Functions ---

export interface EncryptedPackage {
  encryptedDataB64: string;
  encryptedDekB64: string;
}

export async function encryptSensitiveData(
  sensitiveDataHex: string
): Promise<EncryptedPackage> {
  let cleanHex = sensitiveDataHex;
  if (cleanHex && cleanHex.startsWith("0x")) {
    cleanHex = cleanHex.substring(2);
  }

  if (!cleanHex || cleanHex.length === 0 || cleanHex.length % 2 !== 0) {
    throw new Error(
      "Invalid or empty hex string provided for encryption."
    );
  }

  const dataBuffer = Buffer.from(cleanHex, "hex");

  if (dataBuffer.length === 0 && cleanHex.length > 0) {
    throw new Error("Invalid hex characters provided for encryption.");
  }

  const plaintextDek = generateDek();
  const encryptedData = encryptWithDek(dataBuffer, plaintextDek);
  const kmsEncryptedDek = await encryptDekWithKms(plaintextDek);

  return {
    encryptedDataB64: encryptedData.toString("base64"),
    encryptedDekB64: kmsEncryptedDek.toString("base64"),
  };
}

export async function decryptSensitiveData(
  encryptedDataB64: string,
  encryptedDekB64: string
): Promise<string> {
  if (!encryptedDataB64 || !encryptedDekB64) {
    throw new Error("Encrypted data and encrypted DEK cannot be empty.");
  }
  const encryptedDataBuffer = Buffer.from(encryptedDataB64, "base64");
  const kmsEncryptedDek = Buffer.from(encryptedDekB64, "base64");

  const plaintextDek = await decryptDekWithKms(kmsEncryptedDek);
  const decryptedDataBuffer = decryptWithDek(encryptedDataBuffer, plaintextDek);

  const hexString = decryptedDataBuffer.toString("hex");
  return hexString.length > 0 ? `0x${hexString}` : "";
}
