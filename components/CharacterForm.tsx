
import React from 'react';
import { CharacterProfile } from '../types';

interface CharacterFormProps {
  profile: CharacterProfile;
  setProfile: (profile: CharacterProfile) => void;
  onRandomize: () => void;
  onGenerateLLM: () => void;
  onLoadPersonalStarter?: () => void;
  isGenerating?: boolean;
}

const CharacterForm: React.FC<CharacterFormProps> = ({
  profile,
  setProfile,
  onRandomize,
  onGenerateLLM,
  onLoadPersonalStarter,
  isGenerating = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'undergarmentType') {
      if (value === 'None') {
        setProfile({ ...profile, undergarmentType: value, undergarmentFit: '', undergarmentStyle: '' });
      } else {
        setProfile({
          ...profile,
          undergarmentType: value,
          undergarmentFit: profile.undergarmentFit || 'Standard',
          undergarmentStyle: profile.undergarmentStyle || 'Neutral',
        });
      }
      return;
    }
    setProfile({ ...profile, [name]: value });
  };

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors";
  const labelClass = "block text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider";
  const undergarmentDisabled = profile.undergarmentType === 'None';
  const disabledClass = undergarmentDisabled ? 'opacity-50 cursor-not-allowed' : '';
  const lockLine = [profile.name, profile.age, profile.gender, profile.distinctiveFeatures]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5">
      {profile.canonHeadshotUrl ? (
        <div className="flex items-center gap-3 bg-slate-800/50 border border-emerald-500/30 rounded-lg px-3 py-2">
          <img
            src={profile.canonHeadshotUrl}
            alt="Canon face"
            className="w-10 h-10 rounded-full object-cover border border-emerald-500/50"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">Face locked</p>
            {lockLine && <p className="text-xs text-slate-300 truncate">{lockLine}</p>}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); setProfile({ ...profile, canonHeadshotUrl: undefined }); }}
            className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
          >
            Unlock
          </button>
        </div>
      ) : (
        <p className="text-xs text-amber-400/90 border border-amber-500/20 bg-amber-500/5 rounded-lg px-3 py-2">
          {profile.name ? `${profile.name} has no canon face yet.` : 'No character yet.'} Headshot is the identity lock.
        </p>
      )}

      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onGenerateLLM(); }}
        disabled={isGenerating}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
      >
        <i className="fas fa-sparkles"></i>
        {isGenerating ? 'Forging...' : 'Forge with LLM'}
      </button>
      <div className="flex justify-between gap-3 text-[11px]">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onRandomize(); }}
          className="text-slate-500 hover:text-indigo-300"
        >
          Shuffle presets
        </button>
        {onLoadPersonalStarter && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onLoadPersonalStarter(); }}
            className="text-slate-500 hover:text-emerald-300"
          >
            Load personal starter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelClass}>Name</label>
          <input name="name" value={profile.name} onChange={handleChange} className={inputClass} placeholder="Full name" />
        </div>
        <div>
          <label className={labelClass}>Gender</label>
          <select name="gender" value={profile.gender} onChange={handleChange} className={inputClass}>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Androgynous">Androgynous</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Age</label>
          <input name="age" value={profile.age} onChange={handleChange} className={inputClass} placeholder="e.g. 28" />
        </div>
        <div>
          <label className={labelClass}>Build</label>
          <input name="build" value={profile.build} onChange={handleChange} className={inputClass} placeholder="e.g. Wiry athletic" />
        </div>
        <div>
          <label className={labelClass}>Eyes</label>
          <input name="eyes" value={profile.eyes} onChange={handleChange} className={inputClass} placeholder="e.g. Ice blue" />
        </div>
        <div>
          <label className={labelClass}>Hair</label>
          <input name="hair" value={profile.hair} onChange={handleChange} className={inputClass} placeholder="e.g. Shaved with a fade" />
        </div>
        <div>
          <label className={labelClass}>Skin Tone</label>
          <input name="skinTone" value={profile.skinTone} onChange={handleChange} className={inputClass} placeholder="e.g. Deep mahogany" />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Distinctive Features</label>
          <input name="distinctiveFeatures" value={profile.distinctiveFeatures} onChange={handleChange} className={inputClass} placeholder="e.g. Mechanical eye" />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Signature Wardrobe</label>
          <input
            name="wardrobe"
            value={profile.wardrobe}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. weathered black leather jacket, cargo pants, neon circuit-trace collar"
          />
        </div>
      </div>

      <details className="group border border-slate-800 rounded-lg px-3 py-2">
        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-slate-500 group-open:text-slate-300">
          Personality & backstory
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <label className={labelClass}>Personality</label>
            <textarea
              name="personality"
              value={profile.personality}
              onChange={handleChange}
              className={`${inputClass} h-20 resize-none text-sm`}
              placeholder="How they carry themselves..."
            />
          </div>
          <div>
            <label className={labelClass}>Backstory</label>
            <textarea
              name="backstory"
              value={profile.backstory}
              onChange={handleChange}
              className={`${inputClass} h-20 resize-none text-sm`}
              placeholder="Where they come from..."
            />
          </div>
        </div>
      </details>

      <details className="group border border-slate-800 rounded-lg px-3 py-2">
        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-slate-500 group-open:text-slate-300">
          Body-study undergarments
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <select
              name="undergarmentType"
              value={profile.undergarmentType}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="None">None (Life Drawing)</option>
              <option value="Minimal briefs">Minimal briefs</option>
              <option value="Boxer briefs">Boxer briefs</option>
              <option value="Boxers">Boxers</option>
              <option value="Sports bra + briefs">Sports bra + briefs</option>
              <option value="Bodysuit">Bodysuit</option>
              <option value="Compression shorts">Compression shorts</option>
              <option value="Dance belt">Dance belt</option>
            </select>
          </div>
          <div>
            <select
              name="undergarmentFit"
              value={profile.undergarmentFit}
              onChange={handleChange}
              className={`${inputClass} ${disabledClass}`}
              disabled={undergarmentDisabled}
            >
              <option value="">Select Fit</option>
              <option value="Standard">Standard</option>
              <option value="Tight">Tight</option>
              <option value="Loose">Loose</option>
              <option value="High-cut">High-cut</option>
              <option value="Low-rise">Low-rise</option>
              <option value="High-waist">High-waist</option>
            </select>
          </div>
          <div>
            <select
              name="undergarmentStyle"
              value={profile.undergarmentStyle}
              onChange={handleChange}
              className={`${inputClass} ${disabledClass}`}
              disabled={undergarmentDisabled}
            >
              <option value="">Color / Style</option>
              <option value="Neutral">Neutral</option>
              <option value="Matte black">Matte black</option>
              <option value="Charcoal grey">Charcoal grey</option>
              <option value="Skin-tone">Skin-tone</option>
              <option value="White cotton">White cotton</option>
              <option value="Muted earth tones">Muted earth tones</option>
              <option value="Minimal seams">Minimal seams</option>
            </select>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          Applied to body-study reference sheets.
        </p>
      </details>
    </div>
  );
};

export default CharacterForm;
