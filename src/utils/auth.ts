import * as jose from "jose";
import { FirestoreConfig } from "../types";

/**
 * Function to create a JWT (JSON Web Token)
 * @param config Firestore configuration
 * @returns JWT string
 */
export async function createJWT(config: FirestoreConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.clientEmail,
    sub: config.clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // Expires in 1 hour
    scope: "https://www.googleapis.com/auth/datastore",
  };

  try {
    // Import the private key
    const privateKey = await jose.importPKCS8(config.privateKey, "RS256");

    // Create JWT
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({
        alg: "RS256",
        typ: "JWT",
      })
      .sign(privateKey);

    return token;
  } catch (error) {
    console.error("Error creating JWT:", error);
    throw error;
  }
}

/**
 * Function to get Firestore authentication token
 * @param config Firestore configuration
 * @returns Access token
 */
export async function getFirestoreToken(
  config: FirestoreConfig
): Promise<string> {
  // No authentication in emulator mode (returns a dummy token)
  if (config.useEmulator) {
    return "firebase-emulator-auth-token";
  }
  
  // Normal authentication process
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await createJWT(config),
    }),
  });

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
