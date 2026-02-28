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
    setProfile({ ...profile, [name]: value } as CharacterProfile);
  };

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors";
  const labelClass = "block text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider";

  return (
    <form className="space-y-6" onSubmit={e => e.preventDefault()}>
      <div className="flex justify-between items-center mb-2">
        <span id="gender-group-label" className={labelClass}>Gender Identity</span>
        <button
          type="button"
          onClick={onRandomize}
          aria-label="Randomize remaining character fields"
          className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1 transition-all active:scale-95"
        >
          <i className="fas fa-dice" aria-hidden="true"></i> Randomize Remaining
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="gender" className="sr-only">Gender Identity</label>
          <select
            id="gender"
            name="gender"
            value={profile.gender}
            onChange={handleChange}
            aria-labelledby="gender-group-label"
            className={inputClass}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Androgynous">Androgynous</option>
          </select>
        </div>

        <div>
          <label htmlFor="name" className="sr-only">Full Name</label>
          <input
            id="name"
            name="name"
            value={profile.name}
            onChange={handleChange}
            className={inputClass}
            placeholder="Full Name"
          />
        </div>

        <div>
          <label htmlFor="age" className={labelClass}>Age</label>
          <input
            id="age"
            name="age"
            value={profile.age}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. 28"
          />
        </div>

        <div>
          <label htmlFor="build" className={labelClass}>Build</label>
          <input
            id="build"
            name="build"
            value={profile.build}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Wiry athletic"
          />
        </div>

        <div>
          <label htmlFor="eyes" className={labelClass}>Eyes</label>
          <input
            id="eyes"
            name="eyes"
            value={profile.eyes}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Ice blue"
          />
        </div>

        <div>
          <label htmlFor="hair" className={labelClass}>Hair</label>
          <input
            id="hair"
            name="hair"
            value={profile.hair}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Shaved with a fade"
          />
        </div>

        <div>
          <label htmlFor="skinTone" className={labelClass}>Skin Tone</label>
          <input
            id="skinTone"
            name="skinTone"
            value={profile.skinTone}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Deep mahogany"
          />
        </div>

        <div>
          <label htmlFor="distinctiveFeatures" className={labelClass}>Distinctive Features</label>
          <input
            id="distinctiveFeatures"
            name="distinctiveFeatures"
            value={profile.distinctiveFeatures}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Mechanical eye"
          />
        </div>
      </div>

      <div>
        <label htmlFor="personality" className={labelClass}>Personality & Backstory</label>
        <textarea
          id="personality"
          name="personality"
          value={profile.personality}
          onChange={handleChange}
          className={`${inputClass} h-32 resize-none text-sm`}
          placeholder="Describe their spirit..."
        />
      </div>
    </form>
  );
};

export default CharacterForm;
