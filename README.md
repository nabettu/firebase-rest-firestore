# Firebase REST Firestore

[日本語版はこちら(Japanese Version)](./README.ja.md)

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

## Quick Start

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// Create a client with your configuration
const firestore = createFirestoreClient({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});

// Add a document
const newDoc = await firestore.add("collection", {
  name: "Test Document",
  value: 100,
});

// Get a document
const doc = await firestore.get("collection", newDoc.id);

// Update a document
await firestore.update("collection", newDoc.id, { value: 200 });

// Query documents
const querySnapshot = await firestore
  .collection("games")
  .where("score", ">", 50)
  .where("active", "==", true)
  .orderBy("score", "desc")
  .limit(10)
  .get();

// Process query results
const games = [];
querySnapshot.forEach(doc => {
  games.push({
    id: doc.id,
    ...doc.data(),
  });
});
console.log("Games with score > 50:", games);

// Delete a document
await firestore.delete("collection", newDoc.id);
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

#### collection(collectionPath).add(data)

Creates a new document with an auto-generated ID in the specified collection.

Parameters:

- `data`: Document data to be added

Returns: A reference to the created document.

#### collection(collectionPath).doc(id?).set(data)

Creates or overwrites a document with the specified ID. If no ID is provided, one will be auto-generated.

Parameters:

- `id` (optional): Document ID
- `data`: Document data

Returns: A promise that resolves when the set operation is complete.

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

#### add(collectionName, data)

Adds a new document to the specified collection.

Parameters:

- `collectionName`: Name of the collection
- `data`: Document data to be added

Returns: The added document with auto-generated ID.

## Error Handling

Firebase REST Firestore throws exceptions with appropriate error messages when API requests fail. Here's an example of error handling:

```typescript
try {
  // Try to get a document
  const game = await firestore.get("games", "non-existent-id");

  // If document doesn't exist, null is returned
  if (game === null) {
    console.log("Document not found");
    return;
  }

  // Process document if it exists
  console.log("Fetched game:", game);
} catch (error) {
  // Handle API errors (authentication, network, etc.)
  console.error("Firestore error:", error.message);
}
```

Common error cases:

- Authentication errors (invalid credentials)
- Network errors
- Invalid query parameters
- Firestore rate limits

## Query Options Details

The `query` method supports the following options for filtering, sorting, and paginating Firestore documents:

### where

Specify multiple filter conditions. Each condition is an object with the following properties:

- `field`: The field name to filter on
- `op`: The comparison operator. Available values:
  - `EQUAL`: Equal to
  - `NOT_EQUAL`: Not equal to
  - `LESS_THAN`: Less than
  - `LESS_THAN_OR_EQUAL`: Less than or equal to
  - `GREATER_THAN`: Greater than
  - `GREATER_THAN_OR_EQUAL`: Greater than or equal to
  - `ARRAY_CONTAINS`: Array contains
  - `IN`: Equal to any of the specified values
  - `ARRAY_CONTAINS_ANY`: Array contains any of the specified values
  - `NOT_IN`: Not equal to any of the specified values
- `value`: The value to compare against

```typescript
// Query games with score > 50 and active = true
const games = await firestore.query("games", {
  where: [
    { field: "score", op: "GREATER_THAN", value: 50 },
    { field: "active", op: "EQUAL", value: true },
  ],
});
```

### orderBy

Specifies the field name to sort results by. Results are sorted in ascending order by default.

```typescript
// Sort by creation time
const games = await firestore.query("games", {
  orderBy: "createdAt",
});
```

### limit

Limits the maximum number of results returned.

```typescript
// Get at most 10 documents
const games = await firestore.query("games", {
  limit: 10,
});
```

### offset

Specifies the number of results to skip. Useful for pagination.

```typescript
// Skip the first 20 results and get the next 10
const games = await firestore.query("games", {
  offset: 20,
  limit: 10,
});
```

Example of a compound query:

```typescript
// Get top 10 active games by score
const topGames = await firestore.query("games", {
  where: [{ field: "active", op: "EQUAL", value: true }],
  orderBy: "score", // Sort by score
  limit: 10,
});
```

## Edge Runtime Examples

### Cloudflare Workers

```typescript
// Set these environment variables in wrangler.toml
// FIREBASE_PROJECT_ID
// FIREBASE_PRIVATE_KEY
// FIREBASE_CLIENT_EMAIL

import { createFirestoreClient } from "firebase-rest-firestore";

export default {
  async fetch(request, env, ctx) {
    // Load configuration from environment variables
    const firestore = createFirestoreClient({
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    });

    const url = new URL(request.url);
    const path = url.pathname;

    // Example API endpoint
    if (path === "/api/games" && request.method === "GET") {
      try {
        // Get active games
        const games = await firestore.query("games", {
          where: [{ field: "active", op: "EQUAL", value: true }],
          limit: 10,
        });

        return new Response(JSON.stringify(games), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
```

### Vercel Edge Functions

```typescript
// Set these environment variables in .env.local
// FIREBASE_PROJECT_ID
// FIREBASE_PRIVATE_KEY
// FIREBASE_CLIENT_EMAIL

import { createFirestoreClient } from "firebase-rest-firestore";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // Load configuration from environment variables
  const firestore = createFirestoreClient({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });

  try {
    // Get the latest 10 documents
    const documents = await firestore.query("posts", {
      orderBy: "createdAt",
      limit: 10,
    });

    return new Response(JSON.stringify(documents), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

## Performance Considerations

### Token Caching

Firebase REST Firestore caches JWT tokens to improve performance. By default, tokens are cached for 50 minutes (actual token expiry is 1 hour). This eliminates the need to generate a new token for each request, improving API request speed.

```typescript
// Tokens are cached internally, so multiple requests
// have minimal authentication overhead
const doc1 = await firestore.get("collection", "doc1");
const doc2 = await firestore.get("collection", "doc2");
const doc3 = await firestore.get("collection", "doc3");
```

### Query Optimization

When dealing with large amounts of data, consider the following:

1. **Set appropriate limits**: Always use the `limit` parameter to restrict the number of documents returned.

2. **Query only needed fields**: Future versions will add support for retrieving only specific fields.

3. **Create indexes**: For complex queries, create appropriate indexes in the Firebase console.

4. **Use pagination**: When retrieving large datasets, implement pagination using `offset` and `limit`.

### Edge Environment Considerations

In edge environments, be aware of:

1. **Cold starts**: Initial execution has token generation overhead.

2. **Memory usage**: Be mindful of memory limits when processing large amounts of data.

3. **Timeouts**: Long-running queries may hit edge environment timeout limits.

## Limitations and Roadmap

### Current Limitations

- **Batch operations**: The current version does not support batch processing for operating on multiple documents at once.
- **Transactions**: Atomic transaction operations are not supported.
- **Real-time listeners**: Due to the nature of REST APIs, real-time data synchronization is not supported.
- **Subcollections**: The current version has limited direct support for nested subcollections.

### Future Roadmap

The following features are planned for future versions:

- Batch operations support
- Basic transaction support
- Improved subcollection support
- More detailed query options (compound indexes, etc.)
- Performance optimizations

Please report feature requests and bugs via GitHub Issues.

## License

MIT
