# Firebase REST Firestore

Firebase Firestore REST API client for Edge runtime environments like Cloudflare Workers and Vercel Edge Functions.

## Features

- Works in Edge runtime environments where Firebase Admin SDK is not available
- Full CRUD operations support
- TypeScript support
- Token caching for better performance
- Simple and intuitive API
- Explicit configuration without hidden environment variable dependencies

## Installation

```bash
npm install firebase-rest-firestore
```

## Usage

### Basic usage with explicit configuration

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// Create a client with your configuration
const firestore = createFirestoreClient({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});

// Create a document
const game = await firestore.create("games", {
  name: "New Game",
  createdAt: new Date(),
  score: 100,
  active: true,
});
console.log("Created game ID:", game.id);

// Get a document
const fetchedGame = await firestore.get("games", game.id);
console.log("Fetched game:", fetchedGame);

// Update a document
const updatedGame = await firestore.update("games", game.id, {
  ...fetchedGame,
  name: "Updated Game Name",
  updatedAt: new Date(),
});

// Query documents
const userGames = await firestore.query("games", {
  where: [{ field: "score", op: "GREATER_THAN", value: 50 }],
  orderBy: "createdAt",
  limit: 10,
});
console.log("Games with score > 50:", userGames);

// Delete a document
await firestore.delete("games", game.id);
```

## Configuration

The `FirestoreConfig` object requires the following properties:

| Property    | Description                  |
| ----------- | ---------------------------- |
| projectId   | Firebase project ID          |
| privateKey  | Service account private key  |
| clientEmail | Service account client email |

## API Reference

### FirestoreClient

The main class for interacting with Firestore.

#### create(collectionName, data)

Creates a new document in the specified collection.

#### get(collectionName, documentId)

Retrieves a document by ID.

#### update(collectionName, documentId, data)

Updates an existing document.

#### delete(collectionName, documentId)

Deletes a document.

#### query(collectionName, options)

Queries documents in a collection with filtering, ordering, and pagination.

### createFirestoreClient(config)

Creates a new FirestoreClient instance with the provided configuration.

### loadConfigFromEnv()

Helper function to load configuration from environment variables.

## License

MIT
