import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CharacterProfile, SetProfile, ReferenceImage, ReferenceType,
  SetReferenceType, GenerationState, AppTab, CompositeConfig
} from './types';
import { INITIAL_CHARACTER_PROFILE, INITIAL_SET_PROFILE } from './constants';
import { generateCharacterImage, generateSetImage, generateCompositeImage } from './services/geminiService';
import CharacterForm from './components/CharacterForm';
import ReferenceGallery from './components/ReferenceGallery';
import CompositeResultCard from './components/CompositeResultCard';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import { generateId, generateSeed, randomCharacterData, randomSetData, randomCompositeData } from './utils/randomizers';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { useToast } from './hooks/useToast';

// Defined outside component so the array references are stable and children never re-render due to them
const CHAR_GALLERY_TYPES = [
  { type: 'HEADSHOT', label: 'Headshot', icon: 'fa-user-circle' },
  { type: 'BODY_REVERSE', label: 'Anatomical (3 Poses)', icon: 'fa-street-view' },
  { type: 'NEUTRAL_SHEET', label: 'Neutral Studio', icon: 'fa-table-cells' },
  { type: 'WARDROBE', label: 'Wardrobe', icon: 'fa-shirt' },
  { type: 'ACTION', label: 'Action Pose', icon: 'fa-person-running' },
  { type: 'EXPRESSION', label: 'Facial Range', icon: 'fa-face-smile' },
];

const SET_GALLERY_TYPES = [
  { type: 'WIDE', label: 'Wide Shot', icon: 'fa-panorama' },
  { type: 'MEDIUM', label: 'Medium/Acting Area', icon: 'fa-vector-square' },
  { type: 'POV', label: 'POV/Immersive', icon: 'fa-eye' },
  { type: 'DETAIL', label: 'Detail/Macro', icon: 'fa-magnifying-glass' },
  { type: 'PLAN', label: 'Architectural Plan', icon: 'fa-map' },
  { type: 'LIGHTING', label: 'Lighting Study', icon: 'fa-bolt-lightning' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('CharacterForge');
  const [hasApiKey, setHasApiKey] = useState(true);
  const { toasts, addToast, removeToast } = useToast();

  const [charProfile, setCharProfile] = useState<CharacterProfile>({
    ...INITIAL_CHARACTER_PROFILE, id: generateId(), seed: generateSeed(),
  });
  const [setProfile, setSetProfile] = useState<SetProfile>({
    ...INITIAL_SET_PROFILE, id: generateId(), seed: generateSeed(),
  });
  const [compConfig, setCompConfig] = useState<CompositeConfig>({
    action: '',
    extraActors: '',
    compositionStyle: 'High-fidelity cinematic shot',
  });

  const [charRefs, setCharRefs] = useState<ReferenceImage[]>([]);
  const [setRefs, setSetRefs] = useState<ReferenceImage[]>([]);
  const [compRefs, setCompRefs] = useState<ReferenceImage[]>([]);

  const [savedChars, setSavedChars] = useState<CharacterProfile[]>([]);
  const [savedSets, setSavedSets] = useState<SetProfile[]>([]);

  const [genState, setGenState] = useState<GenerationState>({ isGenerating: false, statusMessage: '' });

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) setHasApiKey(await window.aistudio.hasSelectedApiKey());
    };
    checkKey();
    setSavedChars(loadFromStorage<CharacterProfile[]>('saved_chars', []));
    setSavedSets(loadFromStorage<SetProfile[]>('saved_sets', []));
  }, []);

  const save = useCallback((type: 'char' | 'set') => {
    if (type === 'char') {
      const updated = [...savedChars.filter(c => c.id !== charProfile.id), charProfile];
      saveToStorage('saved_chars', updated);
      setSavedChars(updated);
    } else {
      const updated = [...savedSets.filter(s => s.id !== setProfile.id), setProfile];
      saveToStorage('saved_sets', updated);
      setSavedSets(updated);
    }
    addToast('Profile stored in vault.', 'success');
  }, [savedChars, savedSets, charProfile, setProfile, addToast]);

  const handleGen = useCallback(async (type: string, forgeType: AppTab) => {
    setGenState({ isGenerating: true, statusMessage: `Forging ${type}...` });
    try {
      let result;
      if (forgeType === 'CharacterForge') result = await generateCharacterImage(charProfile, type as ReferenceType);
      else if (forgeType === 'SetForge') result = await generateSetImage(setProfile, type as SetReferenceType);
      else result = await generateCompositeImage(charProfile, setProfile, compConfig);

      const ref: ReferenceImage = {
        id: generateId(),
        type,
        url: result.url,
        promptUsed: result.prompt,
        timestamp: Date.now(),
      };

      if (forgeType === 'CharacterForge') setCharRefs(prev => [ref, ...prev]);
      else if (forgeType === 'SetForge') setSetRefs(prev => [ref, ...prev]);
      else setCompRefs(prev => [ref, ...prev]);

      setGenState({ isGenerating: false, statusMessage: '' });
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error('An unknown error occurred');
      if (error.message === 'AUTH_REQUIRED') setHasApiKey(false);
      setGenState({ isGenerating: false, statusMessage: '', error: error.message });
    }
  }, [charProfile, setProfile, compConfig]);

  const randomizeCharacter = useCallback(() => {
    setCharProfile(prev => ({ ...prev, ...randomCharacterData(), seed: generateSeed() }));
    setCharRefs([]);
  }, []);

  const randomizeSet = useCallback(() => {
    setSetProfile(prev => ({ ...prev, ...randomSetData(prev.locationType), seed: generateSeed() }));
    setSetRefs([]);
  }, []);

  const randomizeComp = useCallback(() => {
    setCompConfig(prev => ({ ...prev, ...randomCompositeData() }));
  }, []);

  const handleCopySuccess = useCallback(() => {
    addToast('Prompt copied to clipboard.', 'success');
  }, [addToast]);

  const onGenChar = useCallback((t: string) => handleGen(t, 'CharacterForge'), [handleGen]);
  const onGenSet = useCallback((t: string) => handleGen(t, 'SetForge'), [handleGen]);
  const onGenComp = useCallback(() => handleGen('CINEMATIC_COMPOSITE', 'CompositorForge'), [handleGen]);

  const canonId = useMemo(
    () => activeTab === 'SetForge' ? setProfile.id : charProfile.id,
    [activeTab, setProfile.id, charProfile.id]
  );

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <button
          onClick={async () => { await window.aistudio?.openSelectKey(); setHasApiKey(true); }}
          className="bg-indigo-600 p-6 rounded-2xl text-white font-bold shadow-xl shadow-indigo-500/20"
        >
          Select API Key to Begin
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

        {/* ── Header ── */}
        <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg" aria-hidden="true">
                <i className="fas fa-microchip"></i>
              </div>
              <h1 className="text-xl font-bold aesthetic-font">
                CANON<span className="text-indigo-500">FORGE</span>
              </h1>
            </div>

            <nav className="flex bg-slate-900 rounded-xl p-1" role="tablist" aria-label="Application sections">
              {(['CharacterForge', 'SetForge', 'CompositorForge'] as AppTab[]).map(t => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={activeTab === t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.replace('Forge', '')}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => save(activeTab === 'SetForge' ? 'set' : 'char')}
                aria-label="Save current profile to vault"
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
              >
                <i className="fas fa-floppy-disk mr-2" aria-hidden="true"></i> Save Current
              </button>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-10" role="main">

          {/* Character Forge Tab */}
          {activeTab === 'CharacterForge' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
              <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit shadow-xl">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                  <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Character Profile</h2>
                  <span
                    className="text-[10px] text-indigo-400 font-mono"
                    aria-label={`Character seed: ${charProfile.seed}`}
                  >
                    SEED: {charProfile.seed}
                  </span>
                </div>
                <CharacterForm
                  profile={charProfile}
                  setProfile={setCharProfile}
                  onRandomize={randomizeCharacter}
                />
              </div>
              <div className="lg:col-span-8 space-y-6">
                <h2 className="text-xl font-bold aesthetic-font">Reference Vault</h2>
                <ReferenceGallery
                  images={charRefs}
                  isGenerating={genState.isGenerating}
                  onGenerate={onGenChar}
                  types={CHAR_GALLERY_TYPES}
                  onCopySuccess={handleCopySuccess}
                />
              </div>
            </div>
          )}

          {/* Set Forge Tab */}
          {activeTab === 'SetForge' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
              <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Set Configuration</h2>
                  <span
                    className="text-[10px] text-indigo-400 font-mono"
                    aria-label={`Set seed: ${setProfile.seed}`}
                  >
                    SEED: {setProfile.seed}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="set-name" className="text-[10px] text-slate-500 uppercase block mb-1">
                      Environment Name
                    </label>
                    <input
                      id="set-name"
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm focus:border-indigo-500 outline-none transition-colors"
                      value={setProfile.name}
                      onChange={e => setSetProfile(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="set-type" className="text-[10px] text-slate-500 uppercase block mb-1">
                      Type
                    </label>
                    <select
                      id="set-type"
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm focus:border-indigo-500"
                      value={setProfile.locationType}
                      onChange={e => setSetProfile(prev => ({
                        ...prev, locationType: e.target.value as 'Indoor' | 'Outdoor',
                      }))}
                    >
                      <option value="Indoor">Indoor</option>
                      <option value="Outdoor">Outdoor</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="set-ambiance" className="text-[10px] text-slate-500 uppercase block mb-1">
                      Ambiance & Style
                    </label>
                    <textarea
                      id="set-ambiance"
                      className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500"
                      value={setProfile.ambiance}
                      onChange={e => setSetProfile(prev => ({ ...prev, ambiance: e.target.value }))}
                    />
                  </div>
                  <button
                    onClick={randomizeSet}
                    aria-label="Randomize set configuration"
                    className="w-full text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 py-2 rounded-lg border border-indigo-500/30 transition-all active:scale-95"
                  >
                    <i className="fas fa-dice mr-2" aria-hidden="true"></i> Randomize Set
                  </button>
                </div>
              </div>
              <div className="lg:col-span-8 space-y-6">
                <h2 className="text-xl font-bold aesthetic-font">Set Reference Vault</h2>
                <ReferenceGallery
                  images={setRefs}
                  isGenerating={genState.isGenerating}
                  onGenerate={onGenSet}
                  types={SET_GALLERY_TYPES}
                  onCopySuccess={handleCopySuccess}
                />
              </div>
            </div>
          )}

          {/* Compositor Forge Tab */}
          {activeTab === 'CompositorForge' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Compositor Forge</h2>
                    <button
                      onClick={randomizeComp}
                      aria-label="Randomize composite action"
                      title="Randomize Action"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      <i className="fas fa-dice" aria-hidden="true"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="comp-char" className="text-[10px] text-slate-500 uppercase block mb-1">
                        Target Character
                      </label>
                      <select
                        id="comp-char"
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                        value={charProfile.id}
                        onChange={e => {
                          const found = savedChars.find(x => x.id === e.target.value)
                            || (e.target.value === charProfile.id ? charProfile : null);
                          if (found) setCharProfile(found);
                        }}
                      >
                        <option value={charProfile.id}>
                          Currently Editing: {charProfile.name || 'Untitled'}
                        </option>
                        {savedChars
                          .filter(c => c.id !== charProfile.id)
                          .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        }
                      </select>
                    </div>

                    <div>
                      <label htmlFor="comp-set" className="text-[10px] text-slate-500 uppercase block mb-1">
                        Target Set
                      </label>
                      <select
                        id="comp-set"
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                        value={setProfile.id}
                        onChange={e => {
                          const found = savedSets.find(x => x.id === e.target.value)
                            || (e.target.value === setProfile.id ? setProfile : null);
                          if (found) setSetProfile(found);
                        }}
                      >
                        <option value={setProfile.id}>
                          Currently Editing: {setProfile.name || 'Untitled'}
                        </option>
                        {savedSets
                          .filter(s => s.id !== setProfile.id)
                          .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        }
                      </select>
                    </div>

                    <div>
                      <label htmlFor="comp-action" className="text-[10px] text-slate-500 uppercase block mb-1">
                        Character Action
                      </label>
                      <textarea
                        id="comp-action"
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500 text-white"
                        placeholder="What is the character doing? (e.g. Piloting, Meditating, Fighting...)"
                        value={compConfig.action}
                        onChange={e => setCompConfig(prev => ({ ...prev, action: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label htmlFor="comp-actors" className="text-[10px] text-slate-500 uppercase block mb-1">
                        Extra Actors / Props
                      </label>
                      <textarea
                        id="comp-actors"
                        className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-16 focus:border-indigo-500 text-white"
                        placeholder="Other people, drones, or focal objects..."
                        value={compConfig.extraActors}
                        onChange={e => setCompConfig(prev => ({ ...prev, extraActors: e.target.value }))}
                      />
                    </div>

                    <button
                      onClick={onGenComp}
                      disabled={genState.isGenerating}
                      aria-label="Generate composite cinematic image"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 text-white"
                    >
                      <i className="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Forge Canon Composite
                    </button>

                    <p className="text-[9px] text-slate-500 italic text-center pt-2">
                      Identity Lock (Seed): {charProfile.seed}
                    </p>
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
                      onCopySuccess={handleCopySuccess}
                    />
                  ))}
                  {compRefs.length === 0 && !genState.isGenerating && (
                    <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 italic">
                      <i className="fas fa-clapperboard text-4xl mb-4 block opacity-20" aria-hidden="true"></i>
                      Configure character and set, then hit Forge to generate a combined cinematic shot.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Loading Overlay ── */}
        {genState.isGenerating && <LoadingOverlay statusMessage={genState.statusMessage} />}

        {/* ── Generation Error Banner ── */}
        {genState.error && (
          <div
            role="alert"
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 border border-red-500/50 p-6 rounded-2xl shadow-2xl flex items-center gap-6 max-w-lg animate-in slide-in-from-bottom-5"
          >
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 shrink-0" aria-hidden="true">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-300 font-medium leading-relaxed">{genState.error}</p>
            </div>
            <button
              onClick={() => setGenState(prev => ({ ...prev, error: undefined }))}
              aria-label="Dismiss error"
              className="text-slate-500 hover:text-white p-2"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        )}

        {/* ── Toast Notifications ── */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* ── Footer ── */}
        <footer className="bg-slate-950 border-t border-slate-900 p-4 text-[9px] text-slate-600 uppercase tracking-widest flex justify-between">
          <div className="flex gap-4">
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 bg-green-500 rounded-full" aria-hidden="true"></span>
              Gemini Engine Online
            </span>
            <span>Tab: {activeTab}</span>
          </div>
          <div className="font-mono">CanonID: {canonId}</div>
        </footer>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

export default App;
