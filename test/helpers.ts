import { FirestoreConfig } from "../src/types";
import { formatPrivateKey } from "../src/utils/config";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Load settings from environment variables
 * @returns Firestore configuration object
 */
export function loadConfig(): FirestoreConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  // Load emulator settings from environment variables
  const useEmulator = process.env.FIRESTORE_EMULATOR === "true";
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "localhost";
  const emulatorPort = parseInt(process.env.FIRESTORE_EMULATOR_PORT || "8080");

  // Project ID is always required, but email and key only required for non-emulator mode
  if (!projectId) {
    throw new Error(
      "FIREBASE_PROJECT_ID environment variable is not set. Please check the .env file."
    );
  }

  if (!useEmulator && (!clientEmail || !privateKey)) {
    throw new Error(
      "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required when not using the emulator. Please check the .env file."
    );
  }

  // Only format the private key if it exists
  if (privateKey) {
    privateKey = formatPrivateKey(privateKey);
  }
  
  // Debug mode settings
  const debug = process.env.DEBUG_TESTS === "true";

  return {
    projectId,
    clientEmail: clientEmail || "",
    privateKey: privateKey || "",
    useEmulator,
    emulatorHost,
    emulatorPort,
    debug
  };
}

/**
 * Generate collection name for testing
 * @param prefix Collection name prefix
 * @returns Unique collection name
 */
export function getTestCollectionName(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Cleanup process for test data
 * @param client FirestoreClient
 * @param collectionName Collection name
 * @param docIds Array of document IDs
 */
export async function cleanupTestData(
  client: any,
  collectionName: string,
  docIds: string[]
): Promise<void> {
  for (const id of docIds) {
    try {
      await client.delete(collectionName, id);
    } catch (err) {
      console.error(`Clean up failed for document ${id}: ${err}`);
    }
  }
}
