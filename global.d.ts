// Global type declarations for Canon Forge

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

interface Window {
  aistudio?: AIStudio;
}

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
  };
};
