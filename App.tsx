
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CharacterProfile, SetProfile, ReferenceImage, ReferenceType, 
  SetReferenceType, GenerationState, AppTab, CompositeConfig, ToastType
} from './types';
import { INITIAL_CHARACTER_PROFILE, INITIAL_SET_PROFILE } from './constants';
import { generateCharacterImage, generateSetImage, generateCompositeImage } from './services/geminiService';
import CharacterForm from './components/CharacterForm';
import Toast from './components/Toast';
import { downloadImage } from './utils/helpers';
import { loadSavedCharacters, loadSavedSets, saveCharacters, saveSets } from './utils/storage';
import { useClipboard } from './hooks/useClipboard';

// --- Helper Functions ---
const generateId = (): string => Math.random().toString(36).substring(2, 15);
const generateSeed = (): number => Math.floor(Math.random() * 2147483647);

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

// --- Sub-Components ---

const CompositeResultCard = ({ img, charName, setName }: { img: ReferenceImage, charName: string, setName: string }) => {
  const [promptOpen, setPromptOpen] = useState(false);
  const { handleCopyToClipboard, toastState, hideToast } = useClipboard();

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
      {toastState.visible && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onClose={hideToast}
        />
      )}
      <img src={img.url} className="w-full aspect-video object-cover transition-transform group-hover:scale-[1.01] duration-700" />
      
      <div className="p-6 bg-slate-950/90 border-t border-slate-800">
         <div className="flex justify-between items-end mb-4">
           <div>
              <p className="text-[10px] text-indigo-400 font-mono mb-1 tracking-widest uppercase">CANON RENDER INTEGRATION</p>
              <span className="text-lg font-bold block text-white">{charName}</span>
              <span className="text-sm text-slate-400">@ {setName}</span>
           </div>
           <div className="flex gap-2">
             <button 
               onClick={() => setPromptOpen(!promptOpen)}
               className={`p-3 rounded-full border transition-all ${promptOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
               title="View Generation Prompt"
             >
               <i className="fas fa-terminal"></i>
             </button>
             <button onClick={() => downloadImage(img.url, 'comp.png')} className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 shadow-lg text-white" title="Download Image">
               <i className="fas fa-download"></i>
             </button>
           </div>
         </div>

         {promptOpen && (
           <div className="mt-4 p-4 bg-black/40 rounded-xl border border-slate-800 text-[10px] font-mono leading-relaxed animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-indigo-500 font-bold uppercase tracking-widest">Composite Logic Prompt</span>
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
  isGenerating: boolean;
  types: Array<{ type: string; label: string; icon: string }>;
}

const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({ images, onGenerate, isGenerating, types }) => {
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const { handleCopyToClipboard, toastState, hideToast } = useClipboard();

  return (
    <div className="space-y-8">
      {toastState.visible && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onClose={hideToast}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.type}
            onClick={() => onGenerate(t.type)}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 text-xs font-medium transition-all ${
              isGenerating ? 'opacity-50' : 'hover:bg-indigo-600/20 hover:border-indigo-500 active:scale-95'
            }`}
          >
            <i className={`fas ${t.icon} text-indigo-400`}></i>
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((img: ReferenceImage) => (
          <div key={img.id} className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-indigo-500/50 transition-all flex flex-col">
            <img src={img.url} className="aspect-video w-full object-cover transition-transform group-hover:scale-105" />
            <div className="p-3 bg-slate-900/90 flex justify-between items-center text-[10px] uppercase tracking-tighter">
              <span className="text-indigo-400 font-bold">{img.type.replace('_', ' ')}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setExpandedPrompt(expandedPrompt === img.id ? null : img.id)}
                  className={`transition-colors ${expandedPrompt === img.id ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`}
                  title="View Prompt"
                >
                  <i className="fas fa-terminal"></i>
                </button>
                <button onClick={() => downloadImage(img.url, 'canon.png')} className="text-slate-500 hover:text-white" title="Download Image"><i className="fas fa-download"></i></button>
              </div>
            </div>
            {expandedPrompt === img.id && (
              <div className="p-3 bg-black/50 border-t border-slate-800 text-[10px] font-mono text-slate-400 overflow-hidden">
                <div className="flex justify-between mb-1">
                   <span className="text-indigo-500 font-bold">PROMPT:</span>
                   <button onClick={() => handleCopyToClipboard(img.promptUsed)} className="text-indigo-400 hover:text-white"><i className="fas fa-copy"></i> Copy</button>
                </div>
                <div className="line-clamp-4 hover:line-clamp-none transition-all cursor-pointer whitespace-pre-wrap">
                  {img.promptUsed}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MAIN APP ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('CharacterForge');
  const [hasApiKey, setHasApiKey] = useState(true);
  
  const [charProfile, setCharProfile] = useState<CharacterProfile>({ ...INITIAL_CHARACTER_PROFILE, id: generateId(), seed: generateSeed() });
  const [setProfile, setSetProfile] = useState<SetProfile>({ ...INITIAL_SET_PROFILE, id: generateId(), seed: generateSeed() });
  const [compConfig, setCompConfig] = useState<CompositeConfig>({ characterId: '', setId: '', action: '', extraActors: '', compositionStyle: 'High-fidelity cinematic shot' });

  const [charRefs, setCharRefs] = useState<ReferenceImage[]>([]);
  const [setRefs, setSetRefs] = useState<ReferenceImage[]>([]);
  const [compRefs, setCompRefs] = useState<ReferenceImage[]>([]);

  const [savedChars, setSavedChars] = useState<CharacterProfile[]>([]);
  const [savedSets, setSavedSets] = useState<SetProfile[]>([]);

  const [genState, setGenState] = useState<GenerationState>({ isGenerating: false, statusMessage: '' });
  const [toastState, setToastState] = useState<ToastState>({ message: '', type: 'success', visible: false });

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    const checkKey = async () => { if (window.aistudio) setHasApiKey(await window.aistudio.hasSelectedApiKey()); };
    checkKey();
    setSavedChars(loadSavedCharacters());
    setSavedSets(loadSavedSets());
  }, []);

  const save = (type: 'char' | 'set') => {
    if (type === 'char') {
      const updated = [...savedChars.filter(c => c.id !== charProfile.id), charProfile];
      const success = saveCharacters(updated);
      if (success) {
        setSavedChars(updated);
        setToastState({ message: 'Character profile saved successfully', type: 'success', visible: true });
      } else {
        setToastState({ message: 'Failed to save character profile', type: 'error', visible: true });
      }
    } else {
      const updated = [...savedSets.filter(s => s.id !== setProfile.id), setProfile];
      const success = saveSets(updated);
      if (success) {
        setSavedSets(updated);
        setToastState({ message: 'Set profile saved successfully', type: 'success', visible: true });
      } else {
        setToastState({ message: 'Failed to save set profile', type: 'error', visible: true });
      }
    }
  };

  const handleGen = async (type: string, forgeType: AppTab) => {
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
        timestamp: Date.now() 
      };

      if (forgeType === 'CharacterForge') setCharRefs([ref, ...charRefs]);
      else if (forgeType === 'SetForge') setSetRefs([ref, ...setRefs]);
      else setCompRefs([ref, ...compRefs]);
      
      setGenState({ isGenerating: false, statusMessage: '' });
    } catch (e: any) {
      if (e.message === "AUTH_REQUIRED") setHasApiKey(false);
      setGenState({ isGenerating: false, statusMessage: '', error: e.message || "An unknown error occurred" });
    }
  };

  const randomizeSet = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const types = {
      Indoor: ['Neon Cyber-Cafe', 'Subterranean Shrine', 'Luxury Sky-Loft', 'Derelict Laboratory', 'Alien Spaceship Bridge', 'High-Tech Monastery'],
      Outdoor: ['Floating Rain-District', 'Abandoned Sprawl-Park', 'Ritual Rooftop', 'Monolithic Overpass', 'Magma-Side Industrial Outpost']
    };
    const lighting = ['Cold cyan fluorescents with warm back-glow', 'Natural filtered moonlight through smog', 'Dashing strobe pulses of amber', 'Eternal dusk soft indigo wash', 'Bioluminescent pulsing organic light'];
    const ambiance = ['Thrumming industrial silence', 'Hushed spiritual reverence', 'Chaotic urban bustle', 'Melancholic solitude', 'Tense high-tech hum'];
    
    setSetProfile({
      ...setProfile,
      seed: generateSeed(),
      name: pick(types[setProfile.locationType]),
      lighting: pick(lighting),
      ambiance: pick(ambiance),
      style: 'Urban Spiritual Realism',
      details: 'Rain-slicked surfaces, floating holographic talismans, intricate brutalist architecture.'
    });
    setSetRefs([]);
  };

  const randomizeComp = () => {
    const actions = [
      "Actively piloting the ship while sitting in the captain's seat",
      "Meditating on a ritual rooftop as rain falls upwards",
      "Engaged in a tense negotiation with a shadowy figure",
      "Repairing a complex mechanical prosthetic in the glow of a neon sign",
      "Standing stoically while wind whips their cloak against a monolithic sky"
    ];
    const actors = ["A hovering security drone", "Two hooded acolytes in the background", "A translucent holographic guide", "None"];
    
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setCompConfig({
      ...compConfig,
      action: pick(actions),
      extraActors: pick(actors)
    });
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <button 
          onClick={async () => { 
            try {
              if (window.aistudio) { 
                await window.aistudio.openSelectKey();
                // Re-check if key is actually selected
                const keySelected = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(keySelected);
              }
            } catch (error) {
              console.error('Failed to select API key:', error);
              setToastState({ 
                message: 'Failed to select API key. Please try again.', 
                type: 'error', 
                visible: true 
              });
            }
          }} 
          className="bg-indigo-600 p-6 rounded-2xl text-white font-bold shadow-xl shadow-indigo-500/20"
        >
          Select API Key to Begin
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {toastState.visible && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onClose={hideToast}
        />
      )}
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-600 p-2 rounded-lg"><i className="fas fa-microchip"></i></div>
             <h1 className="text-xl font-bold aesthetic-font">CANON<span className="text-indigo-500">FORGE</span></h1>
          </div>
          
          <nav className="flex bg-slate-900 rounded-xl p-1">
            {(['CharacterForge', 'SetForge', 'CompositorForge'] as AppTab[]).map(t => (
              <button 
                key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                {t.replace('Forge', '')}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => save(activeTab === 'SetForge' ? 'set' : 'char')} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
              <i className="fas fa-floppy-disk mr-2"></i> Save Current
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-10">
        
        {activeTab === 'CharacterForge' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit shadow-xl">
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Character Profile</h2>
                <span className="text-[10px] text-indigo-400 font-mono">SEED: {charProfile.seed}</span>
              </div>
              <CharacterForm 
                profile={charProfile} 
                setProfile={setCharProfile} 
                onRandomize={() => {
                  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random()*arr.length)];
                  setCharProfile({
                    ...charProfile,
                    seed: generateSeed(),
                    name: pick(['Silas Thorne', 'Kora Vance', 'Malachi Quinn', 'Lyra Skye', 'Dante Rios']),
                    age: pick(['21','28','35','42','56']),
                    build: pick(['Lithe & Graceful','Broad & Athletic','Wiry & Powerful','Compact & Agile']),
                    eyes: pick(['Glowing Indigo','Cybernetic Emerald','Deep Obsidian','Mismatched Amber']),
                    hair: pick(['Braided coils','Silver-white fade','Neon blue undercut','Long flowing black']),
                    skinTone: pick(['Pale ivory','Deep mahogany','Warm olive','Rich bronze']),
                    distinctiveFeatures: pick(['Faint neck tattoo','Mechanical right eye','Surgical scar on temple','Clockwork left hand']),
                    personality: 'Stoic wanderer with a sense of purpose.'
                  });
                  setCharRefs([]);
                }} 
              />
            </div>
            <div className="lg:col-span-8 space-y-6">
              <h2 className="text-xl font-bold aesthetic-font">Reference Vault</h2>
              <ReferenceGallery 
                images={charRefs} 
                isGenerating={genState.isGenerating}
                onGenerate={(t: any) => handleGen(t, 'CharacterForge')}
                types={[
                  { type: 'HEADSHOT', label: 'Headshot', icon: 'fa-user-circle' },
                  { type: 'BODY_REVERSE', label: 'Anatomical (3 Poses)', icon: 'fa-street-view' },
                  { type: 'NEUTRAL_SHEET', label: 'Neutral Studio', icon: 'fa-table-cells' },
                  { type: 'WARDROBE', label: 'Wardrobe', icon: 'fa-shirt' },
                  { type: 'ACTION', label: 'Action Pose', icon: 'fa-person-running' },
                  { type: 'EXPRESSION', label: 'Facial Range', icon: 'fa-face-smile' },
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === 'SetForge' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 h-fit space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Set Configuration</h2>
                <span className="text-[10px] text-indigo-400 font-mono">SEED: {setProfile.seed}</span>
              </div>
              <div className="space-y-4">
                <div><label className="text-[10px] text-slate-500 uppercase block mb-1">Environment Name</label>
                <input className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm focus:border-indigo-500 outline-none transition-colors" value={setProfile.name} onChange={e=>setSetProfile({...setProfile, name:e.target.value})} /></div>
                <div><label className="text-[10px] text-slate-500 uppercase block mb-1">Type</label>
                <select className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm focus:border-indigo-500" value={setProfile.locationType} onChange={e=>setSetProfile({...setProfile, locationType:e.target.value as any})}>
                  <option value="Indoor">Indoor</option><option value="Outdoor">Outdoor</option>
                </select></div>
                <div><label className="text-[10px] text-slate-500 uppercase block mb-1">Ambiance & Style</label>
                <textarea className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500" value={setProfile.ambiance} onChange={e=>setSetProfile({...setProfile, ambiance:e.target.value})} /></div>
                <button onClick={randomizeSet} className="w-full text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 py-2 rounded-lg border border-indigo-500/30 transition-all active:scale-95"><i className="fas fa-dice mr-2"></i> Randomize Set</button>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <h2 className="text-xl font-bold aesthetic-font">Set Reference Vault</h2>
              <ReferenceGallery 
                images={setRefs} 
                isGenerating={genState.isGenerating}
                onGenerate={(t: any) => handleGen(t, 'SetForge')}
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
                  <h2 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Compositor Forge</h2>
                  <button onClick={randomizeComp} className="text-[10px] text-indigo-400 hover:text-indigo-300" title="Randomize Action"><i className="fas fa-dice"></i></button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Target Character</label>
                    <select className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white" 
                      value={charProfile.id} 
                      onChange={e => { 
                        const c = savedChars.find(x => x.id === e.target.value) || (e.target.value === charProfile.id ? charProfile : null);
                        if(c) setCharProfile(c); 
                      }}
                    >
                      <option value={charProfile.id}>Currently Editing: {charProfile.name || 'Untitled'}</option>
                      {savedChars.filter(c => c.id !== charProfile.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Target Set</label>
                    <select className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm text-white"
                      value={setProfile.id}
                      onChange={e => { 
                        const s = savedSets.find(x => x.id === e.target.value) || (e.target.value === setProfile.id ? setProfile : null);
                        if(s) setSetProfile(s); 
                      }}
                    >
                      <option value={setProfile.id}>Currently Editing: {setProfile.name || 'Untitled'}</option>
                      {savedSets.filter(s => s.id !== setProfile.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Character Action</label>
                    <textarea className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-20 focus:border-indigo-500 text-white" 
                      placeholder="What is the character doing? (e.g. Piloting, Meditating, Fighting...)"
                      value={compConfig.action} onChange={e => setCompConfig({...compConfig, action: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Extra Actors / Props</label>
                    <textarea className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-sm h-16 focus:border-indigo-500 text-white" 
                      placeholder="Other people, drones, or focal objects..."
                      value={compConfig.extraActors} onChange={e => setCompConfig({...compConfig, extraActors: e.target.value})}
                    />
                  </div>

                  <button 
                    onClick={() => handleGen('CINEMATIC_COMPOSITE', 'CompositorForge')}
                    disabled={genState.isGenerating}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 text-white"
                  >
                    <i className="fas fa-wand-magic-sparkles"></i> Forge Canon Composite
                  </button>
                  
                  <div className="pt-2">
                    <p className="text-[9px] text-slate-500 italic text-center">Identity Lock (Seed): {charProfile.seed}</p>
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
                  />
                ))}
                {compRefs.length === 0 && !genState.isGenerating && (
                  <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 italic">
                    <i className="fas fa-clapperboard text-4xl mb-4 block opacity-20"></i>
                    Configure character and set, then hit Forge to generate a combined cinematic shot.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {genState.isGenerating && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-atom text-indigo-400 text-2xl animate-pulse"></i></div>
          </div>
          <h3 className="text-2xl font-bold aesthetic-font text-white">{genState.statusMessage}</h3>
          <p className="text-slate-500 text-xs mt-2 italic">Computing high-fidelity spiritual realism with deterministic seeds...</p>
        </div>
      )}

      {genState.error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 border border-red-500/50 p-6 rounded-2xl shadow-2xl flex items-center gap-6 max-w-lg animate-in slide-in-from-bottom-5">
          <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 shrink-0">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="flex-1">
             <p className="text-xs text-slate-300 font-medium leading-relaxed">{genState.error}</p>
          </div>
          <button onClick={() => setGenState({...genState, error: undefined})} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times"></i></button>
        </div>
      )}

      <footer className="bg-slate-950 border-t border-slate-900 p-4 text-[9px] text-slate-600 uppercase tracking-widest flex justify-between">
        <div className="flex gap-4">
          <span className="flex items-center gap-2"><span className="w-1 h-1 bg-green-500 rounded-full"></span> Gemini Engine Online</span>
          <span>Tab: {activeTab}</span>
        </div>
        <div className="font-mono">CanonID: {activeTab === 'SetForge' ? setProfile.id : charProfile.id}</div>
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
