import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CharacterProfile,
  SetProfile,
  ReferenceImage,
  SceneSeedStill,
  ReferenceType,
  SetReferenceType,
  GenerationState,
  AppTab,
  CompositeConfig,
  ToastType,
  VideoClip,
} from './types';
import { INITIAL_CHARACTER_PROFILE, INITIAL_SET_PROFILE } from './constants';
import {
  generateCharacterImage as generateGeminiCharacterImage,
  generateSetImage as generateGeminiSetImage,
  generateCompositeImage as generateGeminiCompositeImage,
  buildCharacterPrompt,
  buildSetPrompt,
  setProviderConfig,
  ProviderConfig,
} from './services/geminiService';
import { generateCompositeVideo } from './services/videoService';
import CharacterForm from './components/CharacterForm';
import SceneForgePanel from './components/SceneForgePanel';
import Toast from './components/Toast';
import { downloadImage, copyToClipboard } from './utils/helpers';
import { pickFirstModelIfMissing } from './utils/providerModels';
import {
  loadSavedCharacters,
  loadSavedSets,
  saveCharacters,
  saveSets,
  loadPersonalStarter,
  savePersonalStarter,
  loadFromStorage,
  saveToStorage,
} from './utils/storage';
import { useClipboard } from './hooks/useClipboard';
import CanonHeadshotDialog from './components/CanonHeadshotDialog';
import AwsAuthDialog from './components/AwsAuthDialog';

// --- Helper Functions ---
const generateId = (): string => Math.random().toString(36).substring(2, 15);
const generateSeed = (): number => Math.floor(Math.random() * 2147483647);
const MAX_CONCURRENT_IMAGE_RENDERS = 3;
const CONSISTENCY_REPORT_STORAGE_KEY = 'consistency_report_card';

function buildPersonalStarter(base: CharacterProfile): CharacterProfile {
  return {
    ...base,
    seed: generateSeed(),
    name: 'Rowan Sable',
    age: '31',
    gender: 'Male',
    build: 'Lean athletic build with defined chest, shoulders, and core; natural body hair distribution',
    eyes: 'warm brown eyes behind rectangular matte-black glasses',
    hair: 'dark brown short textured hair with slight wave and clean side taper',
    skinTone: 'light-to-medium olive skin with warm undertones and realistic texture',
    distinctiveFeatures:
      'rectangular black glasses, dense dark beard connected to mustache, pronounced brow, sharp jawline, visible collarbone structure',
    wardrobe:
      'open charcoal button-down over bare torso, tailored dark trousers; optional minimalist boxer-briefs for anatomical studies',
    personality:
      'Composed, introspective, and grounded; carries quiet confidence with a calm but intense gaze.',
    backstory:
      'An urban creative who balances disciplined routines with late-night reflective work; body language communicates restraint, focus, and vulnerability.',
    aesthetic: 'Urban spiritual realism with grounded cinematic portraiture',
    undergarmentType: 'Minimal briefs',
    undergarmentFit: 'Standard',
    undergarmentStyle: 'Charcoal grey',
  };
}

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

type ConsistencyScore = 'unrated' | 'pass' | 'mixed' | 'fail';

interface ConsistencyReportItem {
  id: string;
  shot: ReferenceType;
  imageId?: string;
  success: boolean;
  score: ConsistencyScore;
  notes: string;
}

// --- Sub-Components ---

const CompositeResultCard = ({
  img,
  charName,
  setName,
  onDelete,
  onRetry,
  onSendToScene,
}: {
  img: ReferenceImage;
  charName: string;
  setName: string;
  onDelete: (id: string) => void;
  onRetry: (image: ReferenceImage) => void;
  onSendToScene: (image: ReferenceImage) => void;
}) => {
  const [promptOpen, setPromptOpen] = useState(false);
  const { handleCopyToClipboard, toastState, hideToast } = useClipboard();

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
      {toastState.visible && (
        <Toast message={toastState.message} type={toastState.type} onClose={hideToast} />
      )}
      {img.status === 'pending' ? (
        <div className="w-full aspect-video bg-slate-950 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Generating composite...</p>
        </div>
      ) : img.status === 'error' ? (
        <div className="w-full aspect-video bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-xs text-red-400 uppercase tracking-wider mb-2">Render request failed</p>
          <p className="text-[11px] text-slate-500">{img.error || 'The API request did not complete.'}</p>
        </div>
      ) : (
        <img
          src={img.url}
          className="w-full aspect-video object-cover transition-transform group-hover:scale-[1.01] duration-700"
        />
      )}

      <div className="p-6 bg-slate-950/90 border-t border-slate-800">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] text-indigo-400 font-mono mb-1 tracking-widest uppercase">
              CANON RENDER INTEGRATION
            </p>
            <span className="text-lg font-bold block text-white">{charName}</span>
            <span className="text-sm text-slate-400">@ {setName}</span>
          </div>
          <div className="flex gap-2">
            <button
              disabled={img.status === 'pending' || img.status === 'error'}
              onClick={() => setPromptOpen(!promptOpen)}
              className={`p-3 rounded-full border transition-all disabled:opacity-40 ${promptOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
              title="View Generation Prompt"
            >
              <i className="fas fa-terminal"></i>
            </button>
            <button
              disabled={img.status === 'pending' || img.status === 'error'}
              onClick={() => downloadImage(img.url, 'comp.png')}
              className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 shadow-lg text-white disabled:opacity-40"
              title="Download Image"
            >
              <i className="fas fa-download"></i>
            </button>
            {img.status === 'error' && (
              <button
                onClick={() => onRetry(img)}
                className="p-3 bg-slate-900 rounded-full border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
                title="Retry Render"
              >
                <i className="fas fa-rotate-right"></i>
              </button>
            )}
            <button
              disabled={img.status === 'pending' || img.status === 'error'}
              onClick={() => onSendToScene(img)}
              className="p-3 bg-slate-900 rounded-full border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
              title="Send To Scene"
            >
              <i className="fas fa-share-nodes"></i>
            </button>
            <button
              onClick={() => onDelete(img.id)}
              className="p-3 bg-slate-900 rounded-full border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50"
              title="Delete Image"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        {promptOpen && (
          <div className="mt-4 p-4 bg-black/40 rounded-xl border border-slate-800 text-[10px] font-mono leading-relaxed animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-indigo-500 font-bold uppercase tracking-widest">
                Composite Logic Prompt
              </span>
              <button
                onClick={() => handleCopyToClipboard(img.promptUsed)}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <i className="fas fa-copy"></i> Copy
              </button>
            </div>
            <div className="text-slate-400 max-h-40 overflow-y-auto pr-2 custom-scrollbar whitespace-pre-wrap">
              {img.promptUsed}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ReferenceGalleryProps {
  images: ReferenceImage[];
  onGenerate: (type: string) => void;
  onDelete: (id: string) => void;
  onRetry: (image: ReferenceImage) => void;
  onCopyPrompt: (type: string) => void;
  disableGenerate: boolean;
  activeCount: number;
  types: Array<{ type: string; label: string; icon: string }>;
}

const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({
  images,
  onGenerate,
  onDelete,
  onRetry,
  onCopyPrompt,
  disableGenerate,
  activeCount,
  types,
}) => {
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<ReferenceImage | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [failedImageLoads, setFailedImageLoads] = useState<Set<string>>(new Set());
  const { handleCopyToClipboard, toastState, hideToast } = useClipboard();

  const handleImageLoad = (id: string) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFailedImageLoads((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleImageError = (id: string) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFailedImageLoads((prev) => new Set(prev).add(id));
  };

  // Track new images as loading
  React.useEffect(() => {
    if (images.length > 0) {
      const newestImage = images[0];
      if (!loadingImages.has(newestImage.id)) {
        setLoadingImages((prev) => new Set(prev).add(newestImage.id));
      }
    }
  }, [images]);

  return (
    <div className="space-y-8">
      {toastState.visible && (
        <Toast message={toastState.message} type={toastState.type} onClose={hideToast} />
      )}
      <div className="flex flex-wrap gap-3 items-center">
        {types.map((t) => (
          <div key={t.type} className="flex items-center">
            <button
              onClick={() => onGenerate(t.type)}
              disabled={disableGenerate}
              className="flex items-center gap-2 px-3 py-1.5 rounded-l-full border border-indigo-500/30 text-xs font-medium transition-all hover:bg-indigo-600/20 hover:border-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border-r-0"
            >
              <i className={`fas ${t.icon} text-indigo-400`}></i>
              {t.label}
            </button>
            <button
              onClick={() => onCopyPrompt(t.type)}
              className="px-2 py-1.5 rounded-r-full border border-indigo-500/30 text-[10px] text-slate-400 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500 transition-all border-l-0"
              title="Copy prompt text"
            >
              <i className="fas fa-copy"></i>
            </button>
          </div>
        ))}
        <span className={`text-[10px] uppercase tracking-widest font-mono ${disableGenerate ? 'text-amber-400' : 'text-slate-500'}`}>
          Renders: {activeCount}/{MAX_CONCURRENT_IMAGE_RENDERS}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((img: ReferenceImage) => (
          <div
            key={img.id}
            className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-indigo-500/50 transition-all flex flex-col"
          >
            {(img.status === 'pending' || loadingImages.has(img.id)) && (
              <div className="absolute inset-0 z-10 bg-slate-900/90 flex flex-col items-center justify-center">
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-atom text-indigo-400 text-lg animate-pulse"></i>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Generating image...</p>
              </div>
            )}
            {img.status === 'pending' ? (
              <div className="aspect-video w-full bg-slate-950"></div>
            ) : img.status === 'error' ? (
              <div className="aspect-video w-full flex flex-col items-center justify-center bg-slate-950 text-center px-4">
                <p className="text-red-400 text-xs uppercase tracking-wider mb-2">Render request failed</p>
                <p className="text-[11px] text-slate-500">{img.error || 'The generation API call failed.'}</p>
                <button
                  onClick={() => onRetry(img)}
                  className="mt-3 text-[10px] uppercase tracking-wider px-3 py-1 rounded border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
                >
                  Retry
                </button>
              </div>
            ) : (
              <img
                src={img.url}
                className="aspect-video w-full object-cover transition-transform group-hover:scale-105 cursor-zoom-in"
                onClick={() => img.url && setLightboxImage(img)}
                onLoad={() => handleImageLoad(img.id)}
                onError={() => handleImageError(img.id)}
              />
            )}
            <div className="p-3 bg-slate-900/90 flex justify-between items-center text-[10px] uppercase tracking-tighter">
              <span className="text-indigo-400 font-bold">{img.type.replace('_', ' ')}</span>
              <div className="flex gap-2">
                <button
                  disabled={img.status === 'pending' || !img.promptUsed}
                  onClick={() => setExpandedPrompt(expandedPrompt === img.id ? null : img.id)}
                  className={`transition-colors ${expandedPrompt === img.id ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'} disabled:opacity-40`}
                  title="View Prompt"
                >
                  <i className="fas fa-terminal"></i>
                </button>
                <button
                  disabled={img.status === 'pending' || img.status === 'error' || !img.url}
                  onClick={() => downloadImage(img.url, 'canon.png')}
                  className="text-slate-500 hover:text-white disabled:opacity-40"
                  title="Download Image"
                >
                  <i className="fas fa-download"></i>
                </button>
                <button
                  onClick={() => onDelete(img.id)}
                  className="text-slate-500 hover:text-red-400"
                  title="Delete Image"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
            {failedImageLoads.has(img.id) && img.status === 'done' && (
              <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/30 text-[10px] text-amber-300 uppercase tracking-wider">
                Image URL failed to load. Render may have succeeded server-side.
              </div>
            )}
            {expandedPrompt === img.id && (
              <div className="p-3 bg-black/50 border-t border-slate-800 text-[10px] font-mono text-slate-400 overflow-hidden">
                <div className="flex justify-between mb-1">
                  <span className="text-indigo-500 font-bold">PROMPT:</span>
                  <button
                    onClick={() => handleCopyToClipboard(img.promptUsed)}
                    className="text-indigo-400 hover:text-white"
                  >
                    <i className="fas fa-copy"></i> Copy
                  </button>
                </div>
                <div className="line-clamp-4 hover:line-clamp-none transition-all cursor-pointer whitespace-pre-wrap">
                  {img.promptUsed}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={() => downloadImage(lightboxImage.url, `canon_${lightboxImage.type}.png`)}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                title="Download"
              >
                <i className="fas fa-download text-sm"></i>
              </button>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
              >
                <i className="fas fa-xmark text-sm"></i>
              </button>
            </div>
            <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-indigo-400 font-bold bg-black/60 px-2 py-1 rounded">
              {lightboxImage.type.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('CharacterForge');

  const [charProfile, setCharProfile] = useState<CharacterProfile>({
    ...INITIAL_CHARACTER_PROFILE,
    id: generateId(),
    seed: generateSeed(),
  });
  const [setProfile, setSetProfile] = useState<SetProfile>({
    ...INITIAL_SET_PROFILE,
    id: generateId(),
    seed: generateSeed(),
  });
  const [compConfig, setCompConfig] = useState<CompositeConfig>({
    characterId: '',
    setId: '',
    action: '',
    extraActors: '',
    compositionStyle: 'High-fidelity cinematic shot',
    shotType: 'master',
    cameraAngle: 'eye_level',
    lensPreset: '35mm',
    subjectDistance: 'medium',
    emotionTone: 'quiet resolve and focused anticipation',
    landmarkLock: 'Preserve established set landmarks and spacing from SetForge.',
  });
  const [awsCredentials, setAwsCredentials] = useState<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string } | null>(() => {
    const saved = localStorage.getItem('canon_aws_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAwsDialogOpen, setIsAwsDialogOpen] = useState(false);

  const [charRefs, setCharRefs] = useState<ReferenceImage[]>([]);
  const [setRefs, setSetRefs] = useState<ReferenceImage[]>([]);
  const [compRefs, setCompRefs] = useState<ReferenceImage[]>([]);
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [sceneSeedStills, setSceneSeedStills] = useState<SceneSeedStill[]>([]);

  const [savedChars, setSavedChars] = useState<CharacterProfile[]>([]);
  const [savedSets, setSavedSets] = useState<SetProfile[]>([]);
  const [personalStarter, setPersonalStarter] = useState<CharacterProfile | null>(null);
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReportItem[]>([]);

  const [providerConfig, setProviderConfigState] = useState<ProviderConfig>({ provider: 'xai', model: 'grok-imagine-image' });
  const [availableModels, setAvailableModels] = useState<{ gemini: {id:string;name:string}[]; venice: {id:string;name:string}[]; aws: {id:string;name:string}[]; xai: {id:string;name:string}[] }>({ gemini: [], venice: [], aws: [], xai: [] });
  const [localSdAvailable, setLocalSdAvailable] = useState(false);

  const fetchModels = useCallback((creds?: any) => {
    fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awsCredentials: creds }),
    })
      .then(r => r.json())
      .then(data => {
        setAvailableModels(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchModels(awsCredentials);
  }, [awsCredentials, fetchModels]);

  // Handle auto-model selection when list changes or provider changes
  useEffect(() => {
    if (providerConfig.provider === 'aws') {
      const nextModel = pickFirstModelIfMissing(providerConfig.model, availableModels.aws);
      if (nextModel) {
        setProviderConfigState((prev) => ({ ...prev, model: nextModel }));
      }
    }

    if (providerConfig.provider === 'xai') {
      const nextModel = pickFirstModelIfMissing(providerConfig.model, availableModels.xai);
      if (nextModel) {
        setProviderConfigState((prev) => ({ ...prev, model: nextModel }));
      }
    }
  }, [availableModels.aws, availableModels.xai, providerConfig.model, providerConfig.provider]);

  useEffect(() => {
    if (providerConfig.provider === 'aws' && !awsCredentials) {
      setIsAwsDialogOpen(true);
    }
  }, [providerConfig.provider, awsCredentials]);

  useEffect(() => {
    const checkLocalSd = () => {
      fetch('/api/local-sd-status')
        .then((r) => r.json())
        .then((data) => {
          setLocalSdAvailable(Boolean(data?.available));
        })
        .catch(() => {});
    };

    checkLocalSd();
    const intervalId = window.setInterval(checkLocalSd, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setProviderConfig(providerConfig);
  }, [providerConfig]);

  const [genState, setGenState] = useState<GenerationState>({
    isGenerating: false,
    statusMessage: '',
  });
  const [activeImageRenders, setActiveImageRenders] = useState(0);
  const activeImageRendersRef = useRef(0);
  const [isVideoGenerating, setIsVideoGenerating] = useState<boolean>(false);
  const [isCanonDialogOpen, setIsCanonDialogOpen] = useState(false);
  const skipDialogRef = useRef(false);
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    type: 'success',
    visible: false,
  });

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    // Load saved data on mount
    const loadData = () => {
      setSavedChars(loadSavedCharacters());
      setSavedSets(loadSavedSets());
      setPersonalStarter(loadPersonalStarter());
      setConsistencyReport(
        loadFromStorage<ConsistencyReportItem[]>(CONSISTENCY_REPORT_STORAGE_KEY, [])
      );
    };
    loadData();
  }, []);

  useEffect(() => {
    saveToStorage(CONSISTENCY_REPORT_STORAGE_KEY, consistencyReport);
  }, [consistencyReport]);

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await copyToClipboard(text);
      setToastState({ message: 'Copied to clipboard', type: 'success', visible: true });
    } catch {
      setToastState({ message: 'Failed to copy to clipboard', type: 'error', visible: true });
    }
  }, []);

  const saveCurrentAsPersonalStarter = useCallback(() => {
    const success = savePersonalStarter(charProfile);
    if (success) {
      setPersonalStarter(charProfile);
      setToastState({
        message: 'Saved current character as Personal Starter.',
        type: 'success',
        visible: true,
      });
    } else {
      setToastState({
        message: 'Failed to save Personal Starter profile.',
        type: 'error',
        visible: true,
      });
    }
  }, [charProfile]);

  const save = (type: 'char' | 'set') => {
    if (type === 'char') {
      const updated = [...savedChars.filter((c) => c.id !== charProfile.id), charProfile];
      const success = saveCharacters(updated);
      if (success) {
        setSavedChars(updated);
        setToastState({
          message: 'Character profile saved successfully',
          type: 'success',
          visible: true,
        });
      } else {
        setToastState({
          message: 'Failed to save character profile',
          type: 'error',
          visible: true,
        });
      }
    } else {
      const updated = [...savedSets.filter((s) => s.id !== setProfile.id), setProfile];
      const success = saveSets(updated);
      if (success) {
        setSavedSets(updated);
        setToastState({
          message: 'Set profile saved successfully',
          type: 'success',
          visible: true,
        });
      } else {
        setToastState({ message: 'Failed to save set profile', type: 'error', visible: true });
      }
    }
  };

  const enqueueGeneration = (
    type: string,
    forgeType: AppTab,
    skipHeadshotDialog = false
  ): Promise<{ success: boolean; imageId?: string }> => {
    if (type === 'HEADSHOT' && forgeType === 'CharacterForge' && !skipDialogRef.current && !skipHeadshotDialog) {
      setIsCanonDialogOpen(true);
      return Promise.resolve({ success: false });
    }

    if (providerConfig.provider === 'aws' && !awsCredentials) {
      setIsAwsDialogOpen(true);
      return Promise.resolve({ success: false });
    }

    if (skipHeadshotDialog) {
      skipDialogRef.current = true;
    }

    if (activeImageRendersRef.current >= MAX_CONCURRENT_IMAGE_RENDERS) {
      setToastState({
        message: `Render limit reached (${MAX_CONCURRENT_IMAGE_RENDERS}). Wait for one to finish.`,
        type: 'info',
        visible: true,
      });
      return Promise.resolve({ success: false });
    }

    skipDialogRef.current = false;
    activeImageRendersRef.current += 1;
    setActiveImageRenders(activeImageRendersRef.current);

    const pendingRef: ReferenceImage = {
      id: generateId(),
      type,
      url: '',
      promptUsed: '',
      timestamp: Date.now(),
      status: 'pending',
      compositorSpec:
        forgeType === 'CompositorForge'
          ? {
              shotType: compConfig.shotType,
              cameraAngle: compConfig.cameraAngle,
              lensPreset: compConfig.lensPreset,
              subjectDistance: compConfig.subjectDistance,
              emotionTone: compConfig.emotionTone,
              landmarkLock: compConfig.landmarkLock,
              action: compConfig.action,
            }
          : undefined,
    };

    if (forgeType === 'CharacterForge') setCharRefs((prev) => [pendingRef, ...prev]);
    else if (forgeType === 'SetForge') setSetRefs((prev) => [pendingRef, ...prev]);
    else setCompRefs((prev) => [pendingRef, ...prev]);

    const updateRef = (patch: Partial<ReferenceImage>) => {
      const updater = (prev: ReferenceImage[]) =>
        prev.map((img) => (img.id === pendingRef.id ? { ...img, ...patch } : img));
      if (forgeType === 'CharacterForge') setCharRefs(updater);
      else if (forgeType === 'SetForge') setSetRefs(updater);
      else setCompRefs(updater);
    };

    return new Promise((resolve) => {
      void (async () => {
        let success = false;
      try {
        const result =
          forgeType === 'CharacterForge'
            ? await generateGeminiCharacterImage(charProfile, type as ReferenceType, awsCredentials)
            : forgeType === 'SetForge'
              ? await generateGeminiSetImage(setProfile, type as SetReferenceType, awsCredentials)
              : await generateGeminiCompositeImage(charProfile, setProfile, compConfig, awsCredentials);

        updateRef({
          url: result.url,
          promptUsed: result.prompt,
          status: 'done',
        });
        success = true;
      } catch (e: any) {
        const message = e.message || 'An unknown error occurred';
        if (message === 'AUTH_REQUIRED') {
          if (providerConfig.provider === 'aws') {
            setIsAwsDialogOpen(true);
          } else {
            setToastState({
              message: 'API key missing or invalid for this provider.',
              type: 'error',
              visible: true,
            });
          }
        }
        updateRef({ status: 'error', error: message });
        setGenState((prev) => ({ ...prev, error: message }));
      } finally {
        activeImageRendersRef.current = Math.max(0, activeImageRendersRef.current - 1);
        setActiveImageRenders(activeImageRendersRef.current);
        resolve({ success, imageId: pendingRef.id });
      }
      })();
    });
  };

  const handleGen = (type: string, forgeType: AppTab) => {
    void enqueueGeneration(type, forgeType);
  };

  const handleDeleteRef = (forgeType: AppTab, id: string) => {
    if (forgeType === 'CharacterForge') setCharRefs((prev) => prev.filter((img) => img.id !== id));
    else if (forgeType === 'SetForge') setSetRefs((prev) => prev.filter((img) => img.id !== id));
    else setCompRefs((prev) => prev.filter((img) => img.id !== id));
  };

  const handleRetryRef = (forgeType: AppTab, image: ReferenceImage) => {
    if (forgeType === 'CharacterForge' && image.type === 'HEADSHOT') {
      skipDialogRef.current = true;
    }
    void enqueueGeneration(image.type, forgeType);
  };

  const handleSendCompositeToScene = (image: ReferenceImage) => {
    if (!image.compositorSpec || !image.url || image.status !== 'done') {
      setToastState({
        message: 'Only completed compositor stills can be sent to Scene.',
        type: 'info',
        visible: true,
      });
      return;
    }

    const still: SceneSeedStill = {
      id: image.id,
      url: image.url,
      promptUsed: image.promptUsed,
      timestamp: image.timestamp,
      compositorSpec: image.compositorSpec,
    };

    setSceneSeedStills((prev) => {
      if (prev.some((s) => s.id === still.id)) return prev;
      return [still, ...prev].slice(0, 8);
    });
    setToastState({
      message: 'Added still to Scene queue.',
      type: 'success',
      visible: true,
    });
  };

  const clearSceneSeedStills = () => {
    setSceneSeedStills([]);
  };

  const runConsistencyStressTest = useCallback(async () => {
    const sequence: ReferenceType[] = [
      'HEADSHOT',
      'BODY_NUDE_FRONT',
      'BODY_NUDE_THREE_QUARTER',
      'BODY_NUDE_PROFILE',
    ];

    setToastState({
      message: 'Running consistency stress test (4-shot sequence)...',
      type: 'info',
      visible: true,
    });

    const initialReport: ConsistencyReportItem[] = sequence.map((shot) => ({
      id: generateId(),
      shot,
      success: false,
      score: 'unrated',
      notes: '',
    }));
    setConsistencyReport(initialReport);

    let completed = 0;
    for (const shot of sequence) {
      const result = await enqueueGeneration(shot, 'CharacterForge', true);
      if (result.success) completed += 1;
      setConsistencyReport((prev) =>
        prev.map((item) =>
          item.shot === shot
            ? {
                ...item,
                success: result.success,
                imageId: result.imageId,
              }
            : item
        )
      );
    }

    setToastState({
      message: `Consistency stress test complete: ${completed}/${sequence.length} renders succeeded.`,
      type: completed === sequence.length ? 'success' : 'info',
      visible: true,
    });
  }, [charProfile, setProfile, compConfig]);

  const runSetCanonPack = useCallback(async () => {
    const sequence: SetReferenceType[] = ['WIDE', 'MEDIUM', 'DETAIL', 'LIGHTING'];
    setToastState({
      message: 'Running Set Canon Pack (Wide, Medium, Detail, Lighting)...',
      type: 'info',
      visible: true,
    });

    let completed = 0;
    for (const shot of sequence) {
      const result = await enqueueGeneration(shot, 'SetForge');
      if (result.success) completed += 1;
    }

    setToastState({
      message: `Set Canon Pack complete: ${completed}/${sequence.length} renders succeeded.`,
      type: completed === sequence.length ? 'success' : 'info',
      visible: true,
    });
  }, [setProfile]);

  const updateConsistencyReportItem = (
    id: string,
    patch: Partial<ConsistencyReportItem>
  ) => {
    setConsistencyReport((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleGenVideo = async () => {
    setIsVideoGenerating(true);
    try {
      const result = await generateCompositeVideo(charProfile, setProfile, compConfig);
      const clip: VideoClip = {
        id: generateId(),
        url: result.url,
        promptUsed: result.prompt,
        characterName: charProfile.name,
        setName: setProfile.name,
        timestamp: Date.now(),
      };
      setVideoClips(prev => [clip, ...prev]);
    } catch (e: any) {
      setGenState((prev) => ({ ...prev, error: e.message || 'Video generation failed.' }));
    } finally {
      setIsVideoGenerating(false);
    }
  };

  const handleLlmGen = async () => {
    setGenState({ isGenerating: true, statusMessage: 'Consulting local oracle...' });
    try {
      const prompt = `Generate a unique character profile for an "Urban Spiritual Realism" setting. 
      Return only a JSON object with the following fields: 
      name, age, gender (Male/Female/Non-binary/Androgynous), build, eyes, hair, skinTone, distinctiveFeatures, wardrobe, personality, backstory.
      Make it gritty, cinematic, and detailed.`;
      
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      if (!res.ok) throw new Error('LLM_ERROR');
      const data = await res.json();
      
      const cleanJson = data.text.match(/\{[\s\S]*\}/)?.[0] || data.text;
      const profile = JSON.parse(cleanJson);
      
      setCharProfile(prev => ({
        ...prev,
        ...profile,
        id: generateId(),
        seed: generateSeed()
      }));
      setCharRefs([]);
      setToastState({ message: 'Character forged by local LLM.', type: 'success', visible: true });
    } catch (e: any) {
      console.error('LLM Gen failed:', e);
      setToastState({ message: 'LLM generation failed. falling back to randomized presets.', type: 'info', visible: true });
      onRandomizeChar();
    } finally {
      setGenState({ isGenerating: false, statusMessage: '' });
    }
  };

  const onRandomizeChar = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const undergarmentType = pick([
      'Minimal briefs',
      'Boxer briefs',
      'Compression shorts',
      'Sports bra + briefs',
      'None',
    ]);
    const undergarmentFit =
      undergarmentType === 'None' ? '' : pick(['Standard', 'Tight', 'High-waist', 'Low-rise']);
    const undergarmentStyle =
      undergarmentType === 'None'
        ? ''
        : pick(['Matte black', 'Charcoal grey', 'Skin-tone', 'Neutral']);
    const names = ['Adrian Vale', 'Micah Stone', 'Rian Calder', 'Noah Archer', 'Elias Ward'];
    const builds = [
      'Lean athletic frame with visible shoulder definition',
      'Compact muscular build with narrow waist',
      'Broad-shouldered endurance build',
      'Wiry dancer-like frame with long limbs',
    ];
    const eyes = [
      'hazel with amber flecks',
      'dark brown with high contrast limbal ring',
      'steel gray with low-saturation iris texture',
      'green-brown heterochromia hint',
    ];
    const hair = [
      'short fade with textured top and natural crown swirl',
      'tight side fade with braided top section',
      'close crop with receding temple line',
      'undercut with soft wave and natural flyaways',
    ];
    const skinTones = [
      'warm medium-brown with olive undertone',
      'deep brown with cool undertone and subtle shoulder freckles',
      'light tan with neutral undertone and visible pore texture',
      'rich bronze with warm undertone and natural tonal variation',
    ];
    const distinctiveFeatures = [
      'slight nose bridge asymmetry, pronounced jaw angle, faint left-cheek scar',
      'strong brow ridge, rounded chin dimple, subtle neck tendon definition',
      'high cheekbones, narrow nose tip, minor asymmetry in ear projection',
      'defined clavicles, soft smile line at right mouth corner, subtle eyebrow notch',
    ];
    const wardrobes = [
      'weathered bomber jacket, ribbed black tee, tapered cargo trousers, worn leather boots',
      'matte charcoal overcoat, raw denim, fitted thermal shirt, steel-toe lace boots',
      'cropped utility jacket, draped slate hoodie, technical joggers, combat trainers',
      'faded indigo work shirt, dark canvas pants, layered necklaces, scuffed high-top boots',
    ];
    const personalityLines = [
      'Quietly vigilant, thoughtful before speaking, radiates controlled intensity.',
      'Grounded and compassionate, keeps emotions private, moves with deliberate calm.',
      'Disciplined and observant, resilient under pressure, carries protective energy.',
      'Reserved but warm, strategic thinker, unwavering focus in chaotic spaces.',
    ];
    const backstories = [
      'Raised between concrete neighborhoods and community temples; learned to balance grit with ritual calm.',
      'Former street medic turned night-shift guardian, carrying quiet responsibility for others.',
      'Ex-warehouse mechanic who now navigates city rooftops, reading people before danger unfolds.',
      'Grew up in transit districts, shaped by late-night work, rain-soaked alleys, and disciplined self-study.',
    ];
    setCharProfile({
      ...charProfile,
      seed: generateSeed(),
      name: pick(names),
      age: pick(['24', '27', '31', '36', '41']),
      build: pick(builds),
      eyes: pick(eyes),
      hair: pick(hair),
      skinTone: pick(skinTones),
      distinctiveFeatures: pick(distinctiveFeatures),
      wardrobe: pick(wardrobes),
      personality: pick(personalityLines),
      backstory: pick(backstories),
      aesthetic: 'Urban spiritual realism with grounded cinematic realism',
      undergarmentType,
      undergarmentFit,
      undergarmentStyle,
    });
    setCharRefs([]);
  };

  const handleCopyPrompt = useCallback((type: string, context: 'CharacterForge' | 'SetForge') => {
    const prompt = context === 'CharacterForge' 
      ? buildCharacterPrompt(charProfile, type as any)
      : buildSetPrompt(setProfile, type as any);
    handleCopyToClipboard(prompt);
  }, [charProfile, setProfile, handleCopyToClipboard]);

  const randomizeSet = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const types = {
      Indoor: [
        'Neon Cyber-Cafe',
        'Subterranean Shrine',
        'Luxury Sky-Loft',
        'Derelict Laboratory',
        'Alien Spaceship Bridge',
        'High-Tech Monastery',
      ],
      Outdoor: [
        'Floating Rain-District',
        'Abandoned Sprawl-Park',
        'Ritual Rooftop',
        'Monolithic Overpass',
        'Magma-Side Industrial Outpost',
      ],
    };
    const lighting = [
      'Cold cyan fluorescents with warm back-glow',
      'Natural filtered moonlight through smog',
      'Dashing strobe pulses of amber',
      'Eternal dusk soft indigo wash',
      'Bioluminescent pulsing organic light',
    ];
    const ambiance = [
      'Thrumming industrial silence',
      'Hushed spiritual reverence',
      'Chaotic urban bustle',
      'Melancholic solitude',
      'Tense high-tech hum',
    ];
    const spatialInvariants = [
      'Rectangular main chamber with fixed center axis and unchanged circulation path around perimeter.',
      'Split-level space with lower work pit and elevated walkway; stair position remains fixed.',
      'Long corridor feed into a central nexus room; corridor width and nexus orientation are constant.',
    ];
    const fixedLandmarks = [
      'Main entry door on frame-left, shrine-like focal structure at far wall, overhead conduit cluster above center.',
      'North-facing window bank, central table platform, suspended practical light bar over acting zone.',
      'Concrete pillar pair flanking the scene center, metal rail on right edge, utility cabinet at rear-left.',
    ];
    const forbiddenChanges = [
      'Do not move doors, windows, pillars, or focal structure; do not mirror layout.',
      'Do not replace core architecture with different style language; preserve scale and geometry.',
      'No major object substitutions in hero area; maintain landmark spacing and orientation.',
    ];
    const lightingRigLock = [
      'Key: camera-left 45 degrees softbox; Fill: low ratio bounce; Rim: narrow camera-right edge; practicals warm amber.',
      'Key: overhead diffused panel; Fill: cool floor bounce; Rim: subtle back-right kicker; haze at low density.',
      'Key: side window motivated cool light; Fill: negative fill on shadow side; practical point lights as amber accents.',
    ];

    setSetProfile({
      ...setProfile,
      name: pick(types[setProfile.locationType]),
      lighting: pick(lighting),
      ambiance: pick(ambiance),
      style: 'Urban Spiritual Realism',
      details:
        'Rain-slicked surfaces, floating holographic talismans, intricate brutalist architecture.',
      spatialInvariants: pick(spatialInvariants),
      fixedLandmarks: pick(fixedLandmarks),
      forbiddenChanges: pick(forbiddenChanges),
      lightingRigLock: pick(lightingRigLock),
    });
    setSetRefs([]);
  };

  const randomizeComp = () => {
    const actions = [
      "Actively piloting the ship while sitting in the captain's seat",
      'Meditating on a ritual rooftop as rain falls upwards',
      'Engaged in a tense negotiation with a shadowy figure',
      'Repairing a complex mechanical prosthetic in the glow of a neon sign',
      'Standing stoically while wind whips their cloak against a monolithic sky',
    ];
    const actors = [
      'A hovering security drone',
      'Two hooded acolytes in the background',
      'A translucent holographic guide',
      'None',
    ];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setCompConfig({
      ...compConfig,
      action: pick(actions),
      extraActors: pick(actors),
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {toastState.visible && (
        <Toast message={toastState.message} type={toastState.type} onClose={hideToast} />
      )}
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <i className="fas fa-microchip"></i>
            </div>
            <h1 className="text-xl font-bold aesthetic-font">
              CANON<span className="text-indigo-500">FORGE</span>
            </h1>
          </div>

          <nav className="flex bg-slate-900 rounded-xl p-1">
            {(['CharacterForge', 'SetForge', 'CompositorForge', 'SceneForge'] as AppTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                {t.replace('Forge', '')}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <select
                value={providerConfig.provider}
                onChange={e => {
                  const p = e.target.value as 'gemini' | 'venice' | 'aws' | 'xai' | 'local-llm';
                  const defaultModel = p === 'gemini'
                    ? (availableModels.gemini[0]?.id || 'gemini-3-pro-image-preview')
                    : p === 'venice'
                    ? (availableModels.venice[0]?.id || 'flux-dev-uncensored')
                    : p === 'aws'
                    ? (availableModels.aws[0]?.id || 'amazon.titan-image-generator-v2:0')
                    : p === 'xai'
                    ? (availableModels.xai[0]?.id || 'grok-imagine-image')
                    : 'local-llm';
                  setProviderConfigState({ provider: p, model: defaultModel });
                }}
                className="bg-transparent text-[10px] uppercase tracking-widest text-indigo-400 font-bold focus:outline-none cursor-pointer"
              >
                <option value="gemini">Gemini</option>
                <option value="venice">Venice</option>
                <option value="aws">AWS</option>
                <option value="xai">xAI</option>
                <option value="local-llm">Local LLM</option>
              </select>
              {providerConfig.provider !== 'local-llm' && (
                <>
                  <span className="text-slate-600">|</span>
                  <select
                    value={providerConfig.model}
                    onChange={e => setProviderConfigState({ ...providerConfig, model: e.target.value })}
                    className="bg-transparent text-[10px] text-slate-300 focus:outline-none cursor-pointer max-w-[140px]"
                  >
                    {(providerConfig.provider === 'gemini'
                      ? availableModels.gemini
                      : providerConfig.provider === 'venice'
                      ? availableModels.venice
                      : providerConfig.provider === 'aws'
                      ? availableModels.aws
                      : availableModels.xai).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </>
              )}
              {providerConfig.provider === 'local-llm' && (
                <span className={`text-[10px] font-mono ${localSdAvailable ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {localSdAvailable ? 'online' : 'offline'}
                </span>
              )}
            </div>
            <button
              onClick={() => save(activeTab === 'SetForge' ? 'set' : 'char')}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              <i className="fas fa-floppy-disk mr-2"></i> Save Current
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-10">
        {activeTab === 'CharacterForge' && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit shadow-xl">
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">
                  Character Profile
                </h2>
                <span className="text-[10px] text-indigo-400 font-mono">
                  SEED: {charProfile.seed}
                </span>
              </div>
              <CharacterForm
                profile={charProfile}
                setProfile={setCharProfile}
                onLoadPersonalStarter={() => {
                  setCharProfile(personalStarter || buildPersonalStarter(charProfile));
                  setCharRefs([]);
                  setToastState({
                    message: `Loaded ${personalStarter ? 'saved' : 'default'} personal starter profile. Fine-tune any fields before rendering.`,
                    type: 'success',
                    visible: true,
                  });
                }}
                onRandomize={onRandomizeChar}
                onGenerateLLM={handleLlmGen}
              />
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold aesthetic-font">Reference Vault</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveCurrentAsPersonalStarter}
                    className="text-[10px] uppercase tracking-widest bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg"
                  >
                    <i className="fas fa-bookmark mr-1"></i> Save As Personal Starter
                  </button>
                  <button
                    onClick={() => void runConsistencyStressTest()}
                    disabled={activeImageRenders > 0}
                    className="text-[10px] uppercase tracking-widest bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg disabled:opacity-40"
                  >
                    <i className="fas fa-vials mr-1"></i> Run Consistency Test
                  </button>
                </div>
              </div>

              {consistencyReport.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
                      Consistency Report Card
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono">
                      pass: {consistencyReport.filter((x) => x.score === 'pass').length} | mixed: {consistencyReport.filter((x) => x.score === 'mixed').length} | fail: {consistencyReport.filter((x) => x.score === 'fail').length}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {consistencyReport.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">
                            {item.shot.replace(/_/g, ' ')}
                          </span>
                          <span className={`text-[10px] uppercase tracking-widest ${item.success ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {item.success ? 'rendered' : 'not rendered'}
                          </span>
                        </div>

                        <select
                          value={item.score}
                          onChange={(e) => updateConsistencyReportItem(item.id, { score: e.target.value as ConsistencyScore })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="unrated">Unrated</option>
                          <option value="pass">Pass (identity locked)</option>
                          <option value="mixed">Mixed (partial drift)</option>
                          <option value="fail">Fail (strong drift)</option>
                        </select>

                        <textarea
                          value={item.notes}
                          onChange={(e) => updateConsistencyReportItem(item.id, { notes: e.target.value })}
                          placeholder="Notes: glasses shape, beard geometry, jawline, torso ratio, body-hair pattern..."
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 h-16 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

               <ReferenceGallery
                images={charRefs}
                onGenerate={(t: any) => handleGen(t, 'CharacterForge')}
                onDelete={(id) => handleDeleteRef('CharacterForge', id)}
                onRetry={(img) => handleRetryRef('CharacterForge', img)}
                onCopyPrompt={(t) => handleCopyPrompt(t, 'CharacterForge')}
                disableGenerate={activeImageRenders >= MAX_CONCURRENT_IMAGE_RENDERS}
                activeCount={activeImageRenders}
                types={[
                  { type: 'HEADSHOT', label: 'Headshot', icon: 'fa-user-circle' },
                  { type: 'BODY_REVERSE', label: 'Anatomical (3 Poses)', icon: 'fa-street-view' },
                  { type: 'BODY_NUDE_FRONT', label: 'Nude Front', icon: 'fa-person' },
                  { type: 'BODY_NUDE_THREE_QUARTER', label: 'Nude 3/4', icon: 'fa-person-rays' },
                  { type: 'BODY_NUDE_PROFILE', label: 'Nude Profile', icon: 'fa-person-half-dress' },
                  { type: 'BODY_NUDE_BACK', label: 'Nude Back', icon: 'fa-person-walking' },
                  { type: 'NEUTRAL_SHEET', label: 'Neutral Studio', icon: 'fa-table-cells' },
                  { type: 'WARDROBE', label: 'Wardrobe', icon: 'fa-shirt' },
                  { type: 'ACTION', label: 'Action Pose', icon: 'fa-person-running' },
                  { type: 'EXPRESSION', label: 'Facial Range', icon: 'fa-face-smile' },
                ]}
              />
            </div>
          </div>
          <CanonHeadshotDialog
            isOpen={isCanonDialogOpen}
            profile={charProfile}
            providerConfig={providerConfig}
            onApprove={(url) => {
              setCharProfile({ ...charProfile, canonHeadshotUrl: url });
              setIsCanonDialogOpen(false);
            }}
            onSkip={() => {
              setIsCanonDialogOpen(false);
              skipDialogRef.current = true;
              handleGen('HEADSHOT', 'CharacterForge');
            }}
          />
          </>
        )}

        {activeTab === 'SetForge' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">
                  Set Configuration
                </h2>
                <span className="text-[10px] text-indigo-400 font-mono">
                  SEED: {setProfile.seed}
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">
                    Environment Name
                  </label>
                  <input
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm focus:border-indigo-500 outline-none transition-colors"
                    value={setProfile.name}
                    onChange={(e) => setSetProfile({ ...setProfile, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Type</label>
                  <select
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm focus:border-indigo-500"
                    value={setProfile.locationType}
                    onChange={(e) =>
                      setSetProfile({ ...setProfile, locationType: e.target.value as any })
                    }
                  >
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">
                    Ambiance & Style
                  </label>
                  <textarea
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500"
                    value={setProfile.ambiance}
                    onChange={(e) => setSetProfile({ ...setProfile, ambiance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Lighting Rig Lock</label>
                  <textarea
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500"
                    value={setProfile.lightingRigLock}
                    onChange={(e) => setSetProfile({ ...setProfile, lightingRigLock: e.target.value })}
                    placeholder="e.g. Key left 45 deg, low-ratio fill, subtle rim, warm practical accents"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Spatial Invariants</label>
                  <textarea
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500"
                    value={setProfile.spatialInvariants}
                    onChange={(e) => setSetProfile({ ...setProfile, spatialInvariants: e.target.value })}
                    placeholder="Describe proportions and circulation that must stay fixed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Fixed Landmarks</label>
                  <textarea
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500"
                    value={setProfile.fixedLandmarks}
                    onChange={(e) => setSetProfile({ ...setProfile, fixedLandmarks: e.target.value })}
                    placeholder="List landmarks and their relative positions"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-1">Forbidden Changes</label>
                  <textarea
                    className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500"
                    value={setProfile.forbiddenChanges}
                    onChange={(e) => setSetProfile({ ...setProfile, forbiddenChanges: e.target.value })}
                    placeholder="Describe what must never drift between renders"
                  />
                </div>
                <button
                  onClick={randomizeSet}
                  className="w-full text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 py-2 rounded-lg border border-indigo-500/30 transition-all active:scale-95"
                >
                  <i className="fas fa-dice mr-2"></i> Randomize Set
                </button>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold aesthetic-font">Set Reference Vault</h2>
                <button
                  onClick={() => void runSetCanonPack()}
                  disabled={activeImageRenders > 0}
                  className="text-[10px] uppercase tracking-widest bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg disabled:opacity-40"
                >
                  <i className="fas fa-layer-group mr-1"></i> Run Set Canon Pack
                </button>
              </div>
               <ReferenceGallery
                images={setRefs}
                onGenerate={(t: any) => handleGen(t, 'SetForge')}
                onDelete={(id) => handleDeleteRef('SetForge', id)}
                onRetry={(img) => handleRetryRef('SetForge', img)}
                onCopyPrompt={(t) => handleCopyPrompt(t, 'SetForge')}
                disableGenerate={activeImageRenders >= MAX_CONCURRENT_IMAGE_RENDERS}
                activeCount={activeImageRenders}
                types={[
                  { type: 'WIDE', label: 'Wide Shot', icon: 'fa-panorama' },
                  { type: 'MEDIUM', label: 'Medium/Acting Area', icon: 'fa-vector-square' },
                  { type: 'POV', label: 'POV/Immersive', icon: 'fa-eye' },
                  { type: 'DETAIL', label: 'Detail/Macro', icon: 'fa-magnifying-glass' },
                  { type: 'PLAN', label: 'Architectural Plan', icon: 'fa-map' },
                  { type: 'LIGHTING', label: 'Lighting Study', icon: 'fa-bolt-lightning' },
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === 'CompositorForge' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">
                    Compositor Forge
                  </h2>
                  <button
                    onClick={randomizeComp}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    title="Randomize Action"
                  >
                    <i className="fas fa-dice"></i>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Target Character
                    </label>
                    <select
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                      value={charProfile.id}
                      onChange={(e) => {
                        const c =
                          savedChars.find((x) => x.id === e.target.value) ||
                          (e.target.value === charProfile.id ? charProfile : null);
                        if (c) setCharProfile(c);
                      }}
                    >
                      <option value={charProfile.id}>
                        Currently Editing: {charProfile.name || 'Untitled'}
                      </option>
                      {savedChars
                        .filter((c) => c.id !== charProfile.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Target Set
                    </label>
                    <select
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                      value={setProfile.id}
                      onChange={(e) => {
                        const s =
                          savedSets.find((x) => x.id === e.target.value) ||
                          (e.target.value === setProfile.id ? setProfile : null);
                        if (s) setSetProfile(s);
                      }}
                    >
                      <option value={setProfile.id}>
                        Currently Editing: {setProfile.name || 'Untitled'}
                      </option>
                      {savedSets
                        .filter((s) => s.id !== setProfile.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Character Action
                    </label>
                    <textarea
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500 text-white"
                      placeholder="What is the character doing? (e.g. Piloting, Meditating, Fighting...)"
                      value={compConfig.action}
                      onChange={(e) => setCompConfig({ ...compConfig, action: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Extra Actors / Props
                    </label>
                    <textarea
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-16 focus:border-indigo-500 text-white"
                      placeholder="Other people, drones, or focal objects..."
                      value={compConfig.extraActors}
                      onChange={(e) =>
                        setCompConfig({ ...compConfig, extraActors: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">Shot Type</label>
                      <select
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                        value={compConfig.shotType}
                        onChange={(e) => setCompConfig({ ...compConfig, shotType: e.target.value as CompositeConfig['shotType'] })}
                      >
                        <option value="master">Master</option>
                        <option value="medium">Medium</option>
                        <option value="close">Close</option>
                        <option value="insert">Insert</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">Camera Angle</label>
                      <select
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                        value={compConfig.cameraAngle}
                        onChange={(e) => setCompConfig({ ...compConfig, cameraAngle: e.target.value as CompositeConfig['cameraAngle'] })}
                      >
                        <option value="eye_level">Eye Level</option>
                        <option value="low_angle">Low Angle</option>
                        <option value="high_angle">High Angle</option>
                        <option value="dutch">Dutch</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">Lens</label>
                      <select
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                        value={compConfig.lensPreset}
                        onChange={(e) => setCompConfig({ ...compConfig, lensPreset: e.target.value as CompositeConfig['lensPreset'] })}
                      >
                        <option value="24mm">24mm</option>
                        <option value="35mm">35mm</option>
                        <option value="50mm">50mm</option>
                        <option value="85mm">85mm</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">Distance</label>
                      <select
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                        value={compConfig.subjectDistance}
                        onChange={(e) => setCompConfig({ ...compConfig, subjectDistance: e.target.value as CompositeConfig['subjectDistance'] })}
                      >
                        <option value="wide">Wide</option>
                        <option value="medium">Medium</option>
                        <option value="tight">Tight</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Emotion Tone</label>
                    <input
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                      value={compConfig.emotionTone}
                      onChange={(e) => setCompConfig({ ...compConfig, emotionTone: e.target.value })}
                      placeholder="e.g. restrained tension with calm focus"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Landmark Lock</label>
                    <textarea
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-16 focus:border-indigo-500 text-white"
                      value={compConfig.landmarkLock}
                      onChange={(e) => setCompConfig({ ...compConfig, landmarkLock: e.target.value })}
                      placeholder="What set landmarks must remain fixed in this shot"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-[10px] uppercase tracking-widest">
                    <span className="text-slate-400">Scene Queue</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-300 font-mono">{sceneSeedStills.length} stills</span>
                      <button
                        onClick={() => setActiveTab('SceneForge')}
                        className="text-emerald-300 hover:text-emerald-200"
                      >
                        Open Scene
                      </button>
                      <button
                        onClick={clearSceneSeedStills}
                        className="text-slate-500 hover:text-red-400"
                        title="Clear Scene Queue"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGen('CINEMATIC_COMPOSITE', 'CompositorForge')}
                    disabled={activeImageRenders >= MAX_CONCURRENT_IMAGE_RENDERS}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 text-white"
                  >
                    <i className="fas fa-wand-magic-sparkles"></i> {activeImageRenders >= MAX_CONCURRENT_IMAGE_RENDERS ? 'Render Queue Full (3/3)' : 'Forge Canon Composite'}
                  </button>
                  <button
                    onClick={handleGenVideo}
                    disabled={isVideoGenerating}
                    className="w-full bg-slate-800 hover:bg-slate-700 border border-indigo-500/30 hover:border-indigo-500/60 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-white"
                  >
                    <i className="fas fa-film"></i> {isVideoGenerating ? 'Forging Video...' : 'Forge Video Clip'}
                  </button>

                  <div className="pt-2">
                    <p className="text-[9px] text-slate-500 italic text-center">
                      Identity Lock (Seed): {charProfile.seed}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <h2 className="text-xl font-bold aesthetic-font">Cinematic Archive</h2>
              <div className="grid grid-cols-1 gap-6">
                {compRefs.map((img: ReferenceImage) => (
                  <CompositeResultCard
                    key={img.id}
                    img={img}
                    charName={charProfile.name}
                    setName={setProfile.name}
                    onDelete={(id) => handleDeleteRef('CompositorForge', id)}
                    onRetry={(retryImg) => handleRetryRef('CompositorForge', retryImg)}
                    onSendToScene={handleSendCompositeToScene}
                  />
                ))}
                {compRefs.length === 0 && (
                  <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 italic">
                    <i className="fas fa-clapperboard text-4xl mb-4 block opacity-20"></i>
                    Configure character and set, then hit Forge to generate a combined cinematic
                    shot.
                  </div>
                )}
              </div>

              {videoClips.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">
                    <i className="fas fa-film mr-2"></i>Video Clips
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    {videoClips.map((clip: VideoClip) => (
                      <div key={clip.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                        <video
                          src={clip.url}
                          controls
                          autoPlay
                          loop
                          className="w-full"
                        />
                        <div className="p-3 flex justify-between items-center text-[10px] uppercase tracking-tighter">
                          <div>
                            <span className="text-indigo-400 font-bold">{clip.characterName}</span>
                            <span className="text-slate-500 mx-1">@</span>
                            <span className="text-slate-400">{clip.setName}</span>
                          </div>
                          <a
                            href={clip.url}
                            download={`canon_video_${clip.id.slice(0, 5)}.mp4`}
                            className="text-slate-500 hover:text-white transition-colors"
                            title="Download clip"
                          >
                            <i className="fas fa-download"></i>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SceneForge' && (
          <div className="animate-in fade-in duration-500">
            <SceneForgePanel
              charProfile={charProfile}
              savedChars={savedChars}
              setProfile={setProfile}
              savedSets={savedSets}
              providerConfig={providerConfig}
              seedStills={sceneSeedStills}
              onConsumeSeedStills={clearSceneSeedStills}
            />
          </div>
        )}
        <AwsAuthDialog
          isOpen={isAwsDialogOpen}
          onClose={() => setIsAwsDialogOpen(false)}
          onSave={(creds) => {
            setAwsCredentials(creds);
            localStorage.setItem('canon_aws_auth', JSON.stringify(creds));
            setToastState({ message: 'AWS session initiated locally.', type: 'success', visible: true });
          }}
        />
      </main>

      {genState.error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 border border-red-500/50 p-6 rounded-2xl shadow-2xl flex items-center gap-6 max-w-lg animate-in slide-in-from-bottom-5">
          <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 shrink-0">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-300 font-medium leading-relaxed">{genState.error}</p>
          </div>
          <button
            onClick={() => setGenState((prev) => ({ ...prev, error: undefined }))}
            className="text-slate-500 hover:text-white p-2"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <footer className="bg-slate-950 border-t border-slate-900 p-4 text-[9px] text-slate-600 uppercase tracking-widest flex justify-between">
        <div className="flex gap-4">
          <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              providerConfig.provider === 'xai' ? 'bg-fuchsia-500 animate-pulse' :
              providerConfig.provider === 'aws' ? 'bg-orange-500 animate-pulse' : 
              providerConfig.provider === 'venice' ? 'bg-cyan-500' : 
              providerConfig.provider === 'local-llm' ? 'bg-amber-500' :
              'bg-green-500'
            }`}></span> 
            {providerConfig.provider.toUpperCase()} ENGINE
          </span>
          <span>Tab: {activeTab}</span>
        </div>
        <div className="font-mono">
          CanonID: {activeTab === 'SetForge' ? setProfile.id : charProfile.id}
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4f46e5;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default App;
