# Firebase REST Firestore

Firebase Firestore REST API client for Edge runtime environments like Cloudflare Workers and Vercel Edge Functions.

## Features

- Works in Edge runtime environments where Firebase Admin SDK is not available
- Full CRUD operations support
- TypeScript support
- Token caching for better performance
- Simple and intuitive API
- Configurable via environment variables or direct configuration

## Installation

```bash
npm install firebase-rest-firestore
```

## Usage

### Setup environment variables

You can configure the client using environment variables:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=your-client-cert-url
```

### Basic usage with environment variables

```typescript
import { firestore } from "firebase-rest-firestore";

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

### Usage with direct configuration

You can also configure the client directly without environment variables:

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// Create a custom client with your configuration
const firestore = createFirestoreClient({
  projectId: "your-project-id",
  privateKeyId: "your-private-key-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
  clientId: "your-client-id",
  clientCertUrl: "your-client-cert-url",
});

// Use the client as usual
const game = await firestore.create("games", {
  name: "New Game",
  score: 100,
});
```

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

## License

MIT
