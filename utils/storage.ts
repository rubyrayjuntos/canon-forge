/**
 * Persists data to localStorage under the given key.
 * Silently logs errors rather than crashing the app on quota or serialization failures.
 */
export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage [${key}]:`, error);
  }
}

/**
 * Loads and deserializes data from localStorage.
 * Returns the fallback value if the key is missing or the stored value is corrupted.
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to load from localStorage [${key}]:`, error);
    return fallback;
  }
}
