
export type ReferenceType =
  | 'HEADSHOT'
  | 'BODY_REVERSE'
  | 'BODY_NUDE'
  | 'BODY_NUDE_FRONT'
  | 'BODY_NUDE_THREE_QUARTER'
  | 'BODY_NUDE_PROFILE'
  | 'BODY_NUDE_BACK'
  | 'WARDROBE'
  | 'ACTION'
  | 'EXPRESSION'
  | 'NEUTRAL_SHEET';
export type SetReferenceType = 'WIDE' | 'MEDIUM' | 'POV' | 'DETAIL' | 'PLAN' | 'LIGHTING';
export type AppTab = 'CharacterForge' | 'SetForge' | 'CompositorForge' | 'SceneForge';
export type ToastType = 'success' | 'error' | 'info';

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
  undergarmentType: string;
  undergarmentFit: string;
  undergarmentStyle: string;
  canonHeadshotUrl?: string;  // data URL of approved canon headshot; undefined until locked
  wardrobe: string;           // e.g. "weathered black leather jacket, cargo pants"
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
  spatialInvariants: string;
  fixedLandmarks: string;
  forbiddenChanges: string;
  lightingRigLock: string;
}

export interface CompositeConfig {
  characterId: string;
  setId: string;
  action: string;
  extraActors: string;
  compositionStyle: string;
  shotType: 'master' | 'medium' | 'close' | 'insert';
  cameraAngle: 'eye_level' | 'low_angle' | 'high_angle' | 'dutch';
  lensPreset: '24mm' | '35mm' | '50mm' | '85mm';
  subjectDistance: 'wide' | 'medium' | 'tight';
  emotionTone: string;
  landmarkLock: string;
}

export interface CompositorShotSpec {
  shotType: CompositeConfig['shotType'];
  cameraAngle: CompositeConfig['cameraAngle'];
  lensPreset: CompositeConfig['lensPreset'];
  subjectDistance: CompositeConfig['subjectDistance'];
  emotionTone: string;
  landmarkLock: string;
  action: string;
}

export interface ReferenceImage {
  id: string;
  type: string;
  url: string;
  promptUsed: string;
  timestamp: number;
  status?: 'pending' | 'done' | 'error';
  error?: string;
  compositorSpec?: CompositorShotSpec;
}

export interface SceneSeedStill {
  id: string;
  url: string;
  promptUsed: string;
  timestamp: number;
  compositorSpec: CompositorShotSpec;
}

export interface VideoClip {
  id: string;
  url: string;
  promptUsed: string;
  characterName: string;
  setName: string;
  timestamp: number;
}

export interface GenerationState {
  isGenerating: boolean;
  statusMessage: string;
  error?: string;
}

export interface Keyframe {
  id: string;
  frameIndex: number;        // 0-based
  timestampSeconds: number;  // e.g. 0, 8, 16, 24, 32
  url: string;
  promptUsed: string;
  sourceLabel?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

export interface KeyframeScene {
  id: string;
  characterId: string;       // foreign key into CharacterProfile[] state
  setId: string;             // foreign key into SetProfile[] state
  characterName: string;     // denormalized for display
  setName: string;           // denormalized for display
  sceneAction: string;
  totalDuration: number;     // seconds
  intervalSeconds: number;   // 1–8
  mode: 'auto' | 'manual';
  manualBeats: string[];     // always length === frameCount, even in auto mode
  frames: Keyframe[];
  createdAt: number;
}
