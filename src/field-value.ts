/**
 * Sentinel values for special write behaviors, mirroring the native Firebase
 * SDK's `FieldValue`. Currently only `serverTimestamp()` is supported.
 *
 * A `FieldValue` is not a real field value: when used as a field in a write it
 * is translated into a Firestore field transform (applied server-side) rather
 * than serialized as data. Using one anywhere else (e.g. inside an array) is an
 * error.
 */
export class FieldValue {
  private constructor(readonly methodName: "serverTimestamp") {}

  /**
   * Returns a sentinel that sets the field to the server's request timestamp at
   * write time, e.g. `client.add("posts", { createdAt: FieldValue.serverTimestamp() })`.
   */
  static serverTimestamp(): FieldValue {
    return new FieldValue("serverTimestamp");
  }

  /**
   * Whether this sentinel represents the same transform as another.
   */
  isEqual(other: FieldValue): boolean {
    return other instanceof FieldValue && other.methodName === this.methodName;
  }
}
