import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FirestoreClient,
  createFirestoreClient,
  DocumentReference,
} from "../src/client";
import { loadConfig, getTestCollectionName } from "./helpers";

/**
 * Note: Before running composite query tests, you need to create composite indices for the following fields:
 * - category + stock
 * - price + stock
 * - category + price
 * - category + tags (tags requires an array_contains type index)
 *
 * Create these manually from the Firestore console or deploy using Firebase CLI.
 *
 * Index creation example (firestore.indexes.json for Firebase CLI):
 * ```
 * {
 *   "indexes": [
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "category", "order": "ASCENDING" },
 *         { "fieldPath": "price", "order": "ASCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "category", "order": "ASCENDING" },
 *         { "fieldPath": "stock", "order": "ASCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "price", "order": "ASCENDING" },
 *         { "fieldPath": "stock", "order": "ASCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "category", "order": "ASCENDING" },
 *         { "fieldPath": "tags", "arrayConfig": "CONTAINS" }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

// Fixed test collection name (for composite indices)
const INDEXED_TEST_COLLECTION = "test_indexed_collection";
// Fixed collection name for collection group tests
const NESTED_COLLECTION_NAME = "items";

describe("Firebase Rest Firestore", () => {
  let client: FirestoreClient;
  let testCollection: string;
  let createdIds: { collection: string; id: string }[] = [];
  let debugMode: boolean;

  beforeEach(() => {
    // Initialize client by loading configuration from environment variables
    const config = loadConfig();
    client = createFirestoreClient(config);
    // Extract debug setting from config
    debugMode = config.debug || false;
    // Use dynamic collection names for normal tests
    testCollection = getTestCollectionName();
    createdIds = [];
  });

  afterEach(async () => {
    // Clean up documents created during tests
    for (const { collection, id } of createdIds) {
      try {
        await client.delete(collection, id);
      } catch (err) {
        console.error(
          `Clean up failed for document ${collection}/${id}: ${err}`
        );
      }
    }
  });

  // Basic client functionality test
  it("Client should initialize correctly", () => {
    expect(client).toBeDefined();
  });

  // Basic CRUD operations test
  it("Should be able to create, read, update, and delete documents", async () => {
    // Creation test
    const testData = {
      name: "Test Item",
      value: 123,
      active: true,
    };

    const createdDoc = await client.add(testCollection, testData);
    createdIds.push({ collection: testCollection, id: createdDoc.id });

    expect(createdDoc).toBeDefined();
    expect(createdDoc.id).toBeDefined();
    expect(createdDoc.name).toBe(testData.name);
    expect(createdDoc.value).toBe(testData.value);
    expect(createdDoc.active).toBe(testData.active);

    // Reading test
    const fetchedDoc = await client.get(testCollection, createdDoc.id);
    expect(fetchedDoc).toBeDefined();
    expect(fetchedDoc?.id).toBe(createdDoc.id);
    expect(fetchedDoc?.name).toBe(testData.name);
    expect(fetchedDoc?.value).toBe(testData.value);
    expect(fetchedDoc?.active).toBe(testData.active);

    // Update test
    const updateData = {
      name: "Updated Item",
      active: false,
    };

    const updatedDoc = await client.update(
      testCollection,
      createdDoc.id,
      updateData
    );

    expect(updatedDoc).toBeDefined();
    expect(updatedDoc.id).toBe(createdDoc.id);
    expect(updatedDoc.name).toBe(updateData.name);
    expect(updatedDoc.value).toBe(testData.value);
    expect(updatedDoc.active).toBe(updateData.active);

    // Update confirmation test
    const fetchedUpdatedDoc = await client.get(testCollection, createdDoc.id);
    expect(fetchedUpdatedDoc?.name).toBe(updateData.name);
    expect(fetchedUpdatedDoc?.value).toBe(testData.value);
    expect(fetchedUpdatedDoc?.active).toBe(updateData.active);

    // Delete test
    await client.delete(testCollection, createdDoc.id);
    const deletedDoc = await client.get(testCollection, createdDoc.id);
    expect(deletedDoc).toBeNull();

    // IDs of deleted documents don't need cleanup
    createdIds = createdIds.filter(
      doc => !(doc.collection === testCollection && doc.id === createdDoc.id)
    );
  });

  // Reference API test
  it("Should be able to operate on documents using the reference API", async () => {
    // Collection reference
    const collRef = client.collection(testCollection);
    expect(collRef).toBeDefined();

    // Add document
    const testData = { name: "Reference Test", count: 100 };
    const docRef = await collRef.add(testData);
    createdIds.push({ collection: testCollection, id: docRef.id });

    expect(docRef).toBeDefined();
    expect(docRef.id).toBeDefined();

    // Get document
    const snapshot = await docRef.get();
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toMatchObject(testData);

    // Update document
    await docRef.update({
      name: "Updated Document",
      count: 200,
    });

    // Confirm update
    const updatedSnapshot = await docRef.get();
    expect(updatedSnapshot.data()?.name).toBe("Updated Document");
    expect(updatedSnapshot.data()?.count).toBe(200);

    // Delete document
    await docRef.delete();

    // Confirm deletion
    const deletedSnapshot = await docRef.get();
    expect(deletedSnapshot.exists).toBe(false);

    // IDs of deleted documents don't need cleanup
    createdIds = createdIds.filter(
      doc => !(doc.collection === testCollection && doc.id === docRef.id)
    );
  });

  // Simple query test
  it("Should be able to execute basic queries", async () => {
    // Add multiple test data items
    const testData = [
      { category: "A", price: 100, stock: true },
      { category: "B", price: 200, stock: false },
      { category: "A", price: 300, stock: true },
    ];

    for (const data of testData) {
      const doc = await client.add(testCollection, data);
      createdIds.push({ collection: testCollection, id: doc.id });
    }

    // Limit to single-condition filtering test
    if (debugMode) console.log("Starting single condition filtering test");
    try {
      const filteredResults = await client
        .collection(testCollection)
        .where("category", "==", "A")
        .get();

      if (debugMode) console.log("Filtering results:", filteredResults.docs.length);
      expect(filteredResults.docs.length).toBe(2);
      expect(
        filteredResults.docs.every(doc => doc.data()?.category === "A")
      ).toBe(true);
    } catch (error) {
      console.error("Filtering test failed:", error);
      throw error;
    }
  });

  // Multiple filter test
  it("Should be able to execute queries with multiple filter conditions", async () => {
    // Use fixed collection with indexes
    const indexedCollection = INDEXED_TEST_COLLECTION;

    // Add multiple test data items
    const testData = [
      { category: "A", price: 100, stock: true, tags: ["sale", "new"] },
      { category: "B", price: 200, stock: false, tags: ["sale"] },
      { category: "A", price: 300, stock: true, tags: ["premium"] },
      { category: "C", price: 150, stock: true, tags: ["sale", "limited"] },
      { category: "A", price: 50, stock: false, tags: ["clearance"] },
    ];

    for (const data of testData) {
      const doc = await client.add(indexedCollection, data);
      createdIds.push({ collection: indexedCollection, id: doc.id });
    }

    if (debugMode) console.log("Starting multiple filter test");
    try {
      // Category A and in stock
      const filteredResults1 = await client
        .collection(indexedCollection)
        .where("category", "==", "A")
        .where("stock", "==", true)
        .get();

      if (debugMode) console.log("Category A and in stock results:", filteredResults1.docs.length);
      expect(filteredResults1.docs.length).toBe(2);
      filteredResults1.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.category).toBe("A");
        expect(data?.stock).toBe(true);
      });

      // Price greater than 100 and in stock
      const filteredResults2 = await client
        .collection(indexedCollection)
        .where("price", ">", 100)
        .where("stock", "==", true)
        .get();

      if (debugMode) console.log("Price > 100 and in stock results:", filteredResults2.docs.length);
      expect(filteredResults2.docs.length).toBe(2);
      filteredResults2.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.price).toBeGreaterThan(100);
        expect(data?.stock).toBe(true);
      });

      // Category A and price less than or equal to 100
      const filteredResults3 = await client
        .collection(indexedCollection)
        .where("category", "==", "A")
        .where("price", "<=", 100)
        .get();

      if (debugMode) console.log(
        "Category A and price <= 100 results:",
        filteredResults3.docs.length
      );
      expect(filteredResults3.docs.length).toBe(2);
      filteredResults3.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.category).toBe("A");
        expect(data?.price).toBeLessThanOrEqual(100);
      });

      // Documents containing 'sale' tag
      const filteredResults4 = await client
        .collection(indexedCollection)
        .where("tags", "array-contains", "sale")
        .get();

      if (debugMode) console.log("Results containing sale tag:", filteredResults4.docs.length);
      expect(filteredResults4.docs.length).toBe(3);
      filteredResults4.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.tags).toContain("sale");
      });

      // Category A and containing 'sale' tag
      const filteredResults5 = await client
        .collection(indexedCollection)
        .where("category", "==", "A")
        .where("tags", "array-contains", "sale")
        .get();

      if (debugMode) console.log(
        "Category A and containing sale tag results:",
        filteredResults5.docs.length
      );
      expect(filteredResults5.docs.length).toBe(1);
      filteredResults5.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.category).toBe("A");
        expect(data?.tags).toContain("sale");
      });

      // Documents with category 'A' or 'B' (in operator)
      const filteredResults6 = await client
        .collection(indexedCollection)
        .where("category", "in", ["A", "B"])
        .get();

      if (debugMode) console.log("Results with category A or B:", filteredResults6.docs.length);
      expect(filteredResults6.docs.length).toBe(4);
      filteredResults6.docs.forEach(doc => {
        const data = doc.data();
        expect(["A", "B"]).toContain(data?.category);
      });

      // Documents with category not 'A' or 'B' (not-in operator)
      const filteredResults7 = await client
        .collection(indexedCollection)
        .where("category", "not-in", ["A", "B"])
        .get();

      if (debugMode) console.log(
        "Results with category not A or B:",
        filteredResults7.docs.length
      );
      expect(filteredResults7.docs.length).toBe(1);
      filteredResults7.docs.forEach(doc => {
        const data = doc.data();
        expect(["A", "B"]).not.toContain(data?.category);
      });
    } catch (error) {
      console.error("Multiple filter test failed:", error);
      throw error;
    }
  });

  // Nested collection test
  it("Should be able to operate on documents in nested collections", async () => {
    // Create parent document
    const parentData = { name: "Parent Document" };
    const parentDoc = await client.add(testCollection, parentData);
    createdIds.push({ collection: testCollection, id: parentDoc.id });

    // Get subcollection reference
    const subCollectionRef = client.collection(
      `${testCollection}/${parentDoc.id}/${NESTED_COLLECTION_NAME}`
    );

    // Add data to subcollection
    const subCollectionData = [
      { name: "Sub Item 1", value: 100 },
      { name: "Sub Item 2", value: 200 },
      { name: "Sub Item 3", value: 300 },
    ];

    // Add documents to subcollection
    const subDocRefs: DocumentReference[] = [];
    for (const data of subCollectionData) {
      const subDoc = await subCollectionRef.add(data);
      subDocRefs.push(subDoc);
      const nestedPath = `${testCollection}/${parentDoc.id}/${NESTED_COLLECTION_NAME}`;
      createdIds.push({ collection: nestedPath, id: subDoc.id });
    }

    // Get data from subcollection
    const subCollectionSnapshot = await subCollectionRef.get();
    expect(subCollectionSnapshot.docs.length).toBe(3);

    // Get specific document from subcollection
    const subDocSnapshot = await subDocRefs[0].get();
    expect(subDocSnapshot.exists).toBe(true);
    expect(subDocSnapshot.data()?.name).toBe("Sub Item 1");

    // Test subcollection query
    const querySnapshot = await subCollectionRef.where("value", ">", 150).get();

    expect(querySnapshot.docs.length).toBe(2);
    querySnapshot.docs.forEach(doc => {
      expect(doc.data()?.value).toBeGreaterThan(150);
    });

    // Update subdocument
    await subDocRefs[0].update({ value: 150 });
    const updatedSubDoc = await subDocRefs[0].get();
    expect(updatedSubDoc.data()?.value).toBe(150);

    // Delete subdocument and remove from cleanup list
    const subDocIdToDelete = subDocRefs[2].id;
    const nestedPathToDelete = `${testCollection}/${parentDoc.id}/${NESTED_COLLECTION_NAME}`;
    await subDocRefs[2].delete();

    // Confirm deletion
    const deletedDocSnapshot = await client.get(
      nestedPathToDelete,
      subDocIdToDelete
    );
    expect(deletedDocSnapshot).toBeNull();

    // Remove deleted document from cleanup list
    createdIds = createdIds.filter(
      doc =>
        !(doc.collection === nestedPathToDelete && doc.id === subDocIdToDelete)
    );
  });

  // Test updating nested object fields
  it("Should be able to update nested object fields using dot notation", async () => {
    // Create test data with nested objects
    const testData = {
      name: "Test User",
      profile: {
        age: 30,
        job: "Engineer",
        address: {
          prefecture: "Tokyo",
          city: "Shinjuku",
        },
      },
      favorites: {
        food: "Ramen",
        color: "Blue",
        sports: "Soccer",
      },
    };

    // Create document
    const createdDoc = await client.add(testCollection, testData);
    createdIds.push({ collection: testCollection, id: createdDoc.id });
    expect(createdDoc).toBeDefined();
    expect(createdDoc.profile.age).toBe(30);
    expect(createdDoc.favorites.color).toBe("Blue");

    // Update nested fields (dot notation)
    const updateData = {
      "profile.age": 31,
      "favorites.color": "Red",
      "profile.address.city": "Shibuya",
    };

    const updatedDoc = await client.update(
      testCollection,
      createdDoc.id,
      updateData
    );

    // Verify update results
    expect(updatedDoc).toBeDefined();
    expect(updatedDoc.profile.age).toBe(31);
    expect(updatedDoc.favorites.color).toBe("Red");
    expect(updatedDoc.profile.address.city).toBe("Shibuya");

    // Verify unchanged fields are preserved
    expect(updatedDoc.name).toBe("Test User");
    expect(updatedDoc.profile.job).toBe("Engineer");
    expect(updatedDoc.profile.address.prefecture).toBe("Tokyo");
    expect(updatedDoc.favorites.food).toBe("Ramen");
    expect(updatedDoc.favorites.sports).toBe("Soccer");

    // Test updating non-existent nested paths
    const newNestedData = {
      "settings.theme": "Dark",
      "profile.skills": ["JavaScript", "TypeScript"],
    };

    const newUpdatedDoc = await client.update(
      testCollection,
      createdDoc.id,
      newNestedData
    );

    // Verify new nested fields are created
    expect(newUpdatedDoc.settings.theme).toBe("Dark");
    expect(newUpdatedDoc.profile.skills).toEqual(["JavaScript", "TypeScript"]);

    // Verify existing data is preserved
    expect(newUpdatedDoc.profile.age).toBe(31);
    expect(newUpdatedDoc.favorites.color).toBe("Red");

    // Test updates using DocumentReference API
    const docRef = client.collection(testCollection).doc(createdDoc.id);
    await docRef.update({
      "favorites.color": "Green",
      "profile.address.prefecture": "Osaka",
    });

    // Verify update results
    const finalDoc = await docRef.get();
    const finalData = finalDoc.data();
    expect(finalData?.favorites.color).toBe("Green");
    expect(finalData?.profile.address.prefecture).toBe("Osaka");
    expect(finalData?.profile.address.city).toBe("Shibuya");
  });

  // Collection group test
  it("Should be able to perform cross-collection queries using collection groups", async () => {
    // Parent collection 1
    const parentCollection1 = `${getTestCollectionName()}_parent1`;

    // Parent collection 2
    const parentCollection2 = `${getTestCollectionName()}_parent2`;

    // Create parent document 1
    const parent1Data = { name: "Parent Document 1" };
    const parent1Doc = await client.add(parentCollection1, parent1Data);
    createdIds.push({ collection: parentCollection1, id: parent1Doc.id });

    // Create parent document 2
    const parent2Data = { name: "Parent Document 2" };
    const parent2Doc = await client.add(parentCollection2, parent2Data);
    createdIds.push({ collection: parentCollection2, id: parent2Doc.id });

    // Add data to parent 1's subcollection
    const subColl1Ref = client.collection(
      `${parentCollection1}/${parent1Doc.id}/${NESTED_COLLECTION_NAME}`
    );
    const subColl1Data = [
      { category: "A", price: 100 },
      { category: "B", price: 200 },
    ];

    for (const data of subColl1Data) {
      const doc = await subColl1Ref.add(data);
      const path = `${parentCollection1}/${parent1Doc.id}/${NESTED_COLLECTION_NAME}`;
      createdIds.push({ collection: path, id: doc.id });
    }

    // Add data to parent 2's subcollection
    const subColl2Ref = client.collection(
      `${parentCollection2}/${parent2Doc.id}/${NESTED_COLLECTION_NAME}`
    );
    const subColl2Data = [
      { category: "A", price: 300 },
      { category: "C", price: 400 },
    ];

    for (const data of subColl2Data) {
      const doc = await subColl2Ref.add(data);
      const path = `${parentCollection2}/${parent2Doc.id}/${NESTED_COLLECTION_NAME}`;
      createdIds.push({ collection: path, id: doc.id });
    }

    // Execute query across all subcollections using collection group
    if (debugMode) console.log("Starting collection group test");
    try {
      // Find category A items from all "items" collections
      const groupQuery = await client
        .collectionGroup(NESTED_COLLECTION_NAME)
        .where("category", "==", "A")
        .get();

      if (debugMode) console.log("Collection group query results:", groupQuery.docs.length);
      expect(groupQuery.docs.length).toBe(2);

      // Verify all results are category A
      groupQuery.docs.forEach(doc => {
        expect(doc.data()?.category).toBe("A");
      });

      // Query sorted by price
      const sortedQuery = await client
        .collectionGroup(NESTED_COLLECTION_NAME)
        .orderBy("price", "desc")
        .get();

      if (debugMode) console.log("Sorted results:", sortedQuery.docs.length);
      expect(sortedQuery.docs.length).toBe(4);

      // Verify descending order
      let lastPrice = Infinity;
      sortedQuery.docs.forEach(doc => {
        const currentPrice = doc.data()?.price;
        expect(currentPrice).toBeLessThanOrEqual(lastPrice);
        lastPrice = currentPrice;
      });

      // Complex conditional query
      const complexQuery = await client
        .collectionGroup(NESTED_COLLECTION_NAME)
        .where("category", "in", ["A", "B"])
        .where("price", ">", 150)
        .get();

      if (debugMode) console.log("Complex condition results:", complexQuery.docs.length);
      expect(complexQuery.docs.length).toBe(2);

      complexQuery.docs.forEach(doc => {
        const data = doc.data();
        expect(["A", "B"]).toContain(data?.category);
        expect(data?.price).toBeGreaterThan(150);
      });
    } catch (error) {
      console.error("Collection group test failed:", error);
      throw error;
    }
  });
});
