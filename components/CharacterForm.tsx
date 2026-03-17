
import React from 'react';
import { CharacterProfile } from '../types';

interface CharacterFormProps {
  profile: CharacterProfile;
  setProfile: (profile: CharacterProfile) => void;
  onRandomize: () => void;
}

const CharacterForm: React.FC<CharacterFormProps> = ({ profile, setProfile, onRandomize }) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <label className={labelClass}>Gender Identity</label>
        <button 
          onClick={(e) => { e.preventDefault(); onRandomize(); }}
          className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1 transition-all active:scale-95"
        >
          <i className="fas fa-dice"></i> Randomize Remaining
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <select name="gender" value={profile.gender} onChange={handleChange} className={inputClass}>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Androgynous">Androgynous</option>
          </select>
        </div>
        <div>
          <input name="name" value={profile.name} onChange={handleChange} className={inputClass} placeholder="Full Name" />
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
        <div>
          <label className={labelClass}>Distinctive Features</label>
          <input name="distinctiveFeatures" value={profile.distinctiveFeatures} onChange={handleChange} className={inputClass} placeholder="e.g. Mechanical eye" />
        </div>
      </div>
      
      <div>
        <label className={labelClass}>Personality & Backstory</label>
        <textarea 
          name="personality" 
          value={profile.personality} 
          onChange={handleChange} 
          className={`${inputClass} h-32 resize-none text-sm`} 
          placeholder="Describe their spirit..."
        />
      </div>

      <div>
        <label className={labelClass}>Body Study Undergarments</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          Applied to BODY_REVERSE prompts only. Selecting “None” disables fit and color/style.
        </p>
      </div>
    </div>
  );
};

export default CharacterForm;
