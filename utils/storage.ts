import { CharacterProfile, SetProfile } from '../types';

const PERSONAL_STARTER_KEY = 'personal_starter_char';

/**
 * Safely loads data from localStorage with error handling
 * @param key - The localStorage key to read from
 * @param defaultValue - The default value to return if parsing fails
 * @returns The parsed data or the default value
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Failed to load data from localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely saves data to localStorage with error handling
 * @param key - The localStorage key to write to
 * @param value - The value to save
 * @returns true if save was successful, false otherwise
 */
export function saveToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save data to localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Loads saved character profiles from localStorage
 * @returns Array of saved character profiles
 */
export function loadSavedCharacters(): CharacterProfile[] {
  return loadFromStorage<CharacterProfile[]>('saved_chars', []);
}

/**
 * Loads saved set profiles from localStorage
 * @returns Array of saved set profiles
 */
export function loadSavedSets(): SetProfile[] {
  return loadFromStorage<SetProfile[]>('saved_sets', []);
}

/**
 * Saves character profiles to localStorage
 * @param characters - Array of character profiles to save
 * @returns true if save was successful, false otherwise
 */
export function saveCharacters(characters: CharacterProfile[]): boolean {
  return saveToStorage('saved_chars', characters);
}

/**
 * Saves set profiles to localStorage
 * @param sets - Array of set profiles to save
 * @returns true if save was successful, false otherwise
 */
export function saveSets(sets: SetProfile[]): boolean {
  return saveToStorage('saved_sets', sets);
}

/**
 * Loads the saved personal starter character profile
 * @returns The personal starter profile or null when not configured
 */
export function loadPersonalStarter(): CharacterProfile | null {
  return loadFromStorage<CharacterProfile | null>(PERSONAL_STARTER_KEY, null);
}

/**
 * Saves a personal starter character profile
 * @param profile - Character profile used as one-click starter
 * @returns true if save was successful, false otherwise
 */
export function savePersonalStarter(profile: CharacterProfile): boolean {
  return saveToStorage(PERSONAL_STARTER_KEY, profile);
}
