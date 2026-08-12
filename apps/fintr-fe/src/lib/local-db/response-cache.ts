import { getLocalDb } from "./db";

/**
 * Structured-clone via JSON so IndexedDB never rejects non-cloneable API fields.
 * Returns undefined if the value cannot be serialized.
 */
const toStorableValue = (value: unknown): unknown | undefined => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.warn("[local-db] Failed to serialize cache snapshot", error);
    return undefined;
  }
};

export const putLocalResponseSnapshot = async (
  key: string,
  value: unknown
): Promise<void> => {
  if (!key) {
    return;
  }

  if (value === undefined) {
    console.warn(
      "[local-db] Skipping cache snapshot — value was undefined",
      key,
    );
    return;
  }

  const storable = toStorableValue(value);
  if (storable === undefined) {
    console.warn(
      "[local-db] Skipping cache snapshot — value could not be serialized",
      key,
    );
    return;
  }

  try {
    await getLocalDb().meta.put({ key, value: storable });
  } catch (error) {
    // Never fail the network query because local cache write failed.
    console.warn("[local-db] Failed to persist cache snapshot", key, error);
  }
};

export const getLocalResponseSnapshot = async <T = unknown>(
  key: string
): Promise<T | undefined> => {
  if (!key) {
    return undefined;
  }

  try {
    const row = await getLocalDb().meta.get(key);
    if (row?.value == null) {
      return undefined;
    }

    return row.value as T;
  } catch (error) {
    console.warn("[local-db] Failed to read cache snapshot", key, error);
    return undefined;
  }
};

export const deleteLocalResponseSnapshot = async (key: string): Promise<void> => {
  if (!key) {
    return;
  }

  try {
    await getLocalDb().meta.delete(key);
  } catch (error) {
    console.warn("[local-db] Failed to delete cache snapshot", key, error);
  }
};
