// Global type declarations for Canon Forge

/**
 * AIStudio interface for managing Google AI Studio API keys
 * This interface provides methods to check and select API keys for the Gemini API
 */
interface AIStudio {
  /** Checks if an API key has been selected */
  hasSelectedApiKey(): Promise<boolean>;
  /** Opens a dialog to allow the user to select an API key */
  openSelectKey(): Promise<void>;
}

interface Window {
  aistudio?: AIStudio;
}

declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY?: string;
  }
}
