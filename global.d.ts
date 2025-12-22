// Global type declarations for Canon Forge

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
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
