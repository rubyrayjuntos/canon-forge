
export type ReferenceType = 'HEADSHOT' | 'BODY_REVERSE' | 'WARDROBE' | 'ACTION' | 'EXPRESSION' | 'NEUTRAL_SHEET';
export type SetReferenceType = 'WIDE' | 'MEDIUM' | 'POV' | 'DETAIL' | 'PLAN' | 'LIGHTING';
export type AppTab = 'CharacterForge' | 'SetForge' | 'CompositorForge';

export interface CharacterProfile {
  id: string;
  seed: number;
  name: string;
  age: string;
  gender: string;
  eyes: string;
  hair: string;
  build: string;
  skinTone: string;
  distinctiveFeatures: string;
  personality: string;
  backstory: string;
  aesthetic: string;
}

export interface SetProfile {
  id: string;
  seed: number;
  name: string;
  locationType: 'Indoor' | 'Outdoor';
  lighting: string;
  ambiance: string;
  style: string;
  details: string;
}

export interface CompositeConfig {
  characterId: string;
  setId: string;
  action: string;
  extraActors: string;
  compositionStyle: string;
}

export interface ReferenceImage {
  id: string;
  type: string;
  url: string;
  promptUsed: string;
  timestamp: number;
}

export interface GenerationState {
  isGenerating: boolean;
  statusMessage: string;
  error?: string;
}
