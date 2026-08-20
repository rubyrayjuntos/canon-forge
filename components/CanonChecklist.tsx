import React from 'react';
import { AppTab, CharacterProfile, ReferenceImage, SetProfile } from '../types';

export type CanonProgress = {
  hasCharacter: boolean;
  hasFace: boolean;
  hasSet: boolean;
  hasWide: boolean;
  hasMedium: boolean;
  hasCoverage: boolean;
  hasComposite: boolean;
};

export type CanonNextKind =
  | 'forge-character'
  | 'headshot'
  | 'forge-set'
  | 'set-coverage'
  | 'composite'
  | 'scene'
  | 'done';

export type CanonNextAction = {
  kind: CanonNextKind;
  tab: AppTab;
  title: string;
  detail: string;
  cta: string;
};

export function getCanonProgress(
  charProfile: CharacterProfile,
  setProfile: SetProfile,
  setRefs: ReferenceImage[],
  compRefs: ReferenceImage[],
): CanonProgress {
  const hasCharacter = Boolean(charProfile.name?.trim());
  const hasFace = Boolean(charProfile.canonHeadshotUrl);
  const hasSet = Boolean(setProfile.name?.trim());
  const hasWide = setRefs.some((img) => img.type === 'WIDE' && img.status === 'done' && img.url);
  const hasMedium = setRefs.some((img) => img.type === 'MEDIUM' && img.status === 'done' && img.url);
  const hasComposite = compRefs.some((img) => img.status === 'done' && img.url);
  return {
    hasCharacter,
    hasFace,
    hasSet,
    hasWide,
    hasMedium,
    hasCoverage: hasWide && hasMedium,
    hasComposite,
  };
}

export function getNextCanonAction(progress: CanonProgress): CanonNextAction {
  if (!progress.hasCharacter) {
    return {
      kind: 'forge-character',
      tab: 'CharacterForge',
      title: 'Invent a person',
      detail: 'Forge a full character, then lock his face. That face is the identity lock.',
      cta: 'Forge with LLM',
    };
  }
  if (!progress.hasFace) {
    return {
      kind: 'headshot',
      tab: 'CharacterForge',
      title: 'Lock the face',
      detail: `${progress.hasCharacter ? 'Character is named. ' : ''}The first successful headshot becomes the canon face.`,
      cta: 'Generate headshot',
    };
  }
  if (!progress.hasSet) {
    return {
      kind: 'forge-set',
      tab: 'SetForge',
      title: 'Invent a place',
      detail: 'Face is locked. Next invent a set, then shoot wide and medium coverage.',
      cta: 'Randomize Set',
    };
  }
  if (!progress.hasCoverage) {
    return {
      kind: 'set-coverage',
      tab: 'SetForge',
      title: 'Shoot the set',
      detail: progress.hasWide
        ? 'Wide is in. A medium shot locks the acting area.'
        : 'Wide then medium stills lock the space before any composite.',
      cta: progress.hasWide ? 'Generate medium' : 'Generate wide',
    };
  }
  if (!progress.hasComposite) {
    return {
      kind: 'composite',
      tab: 'CompositorForge',
      title: 'Put him in the set',
      detail: 'Character and place are locked. Composite is the first true canon still.',
      cta: 'Forge composite',
    };
  }
  return {
    kind: 'scene',
    tab: 'SceneForge',
    title: 'Canon is locked',
    detail: 'Scene and video are optional. Identity and place are already canon.',
    cta: 'Open Scene',
  };
}

interface CanonChecklistProps {
  charProfile: CharacterProfile;
  setProfile: SetProfile;
  setRefs: ReferenceImage[];
  compRefs: ReferenceImage[];
  activeTab: AppTab;
  busy?: boolean;
  onGo: (tab: AppTab) => void;
  onNext: (action: CanonNextAction) => void;
}

export default function CanonChecklist({
  charProfile,
  setProfile,
  setRefs,
  compRefs,
  activeTab,
  busy = false,
  onGo,
  onNext,
}: CanonChecklistProps) {
  const progress = getCanonProgress(charProfile, setProfile, setRefs, compRefs);
  const next = getNextCanonAction(progress);

  const steps: Array<{ id: AppTab; label: string; done: boolean; later?: boolean }> = [
    { id: 'CharacterForge', label: 'Person', done: progress.hasCharacter },
    { id: 'CharacterForge', label: 'Face', done: progress.hasFace },
    { id: 'SetForge', label: 'Place', done: progress.hasSet },
    { id: 'SetForge', label: 'Coverage', done: progress.hasCoverage },
    { id: 'CompositorForge', label: 'Shot', done: progress.hasComposite },
    { id: 'SceneForge', label: 'Scene', done: false, later: true },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => (
          <React.Fragment key={`${step.label}-${index}`}>
            {index === 5 && (
              <span className="text-slate-700 text-[10px] px-1" aria-hidden>
                ·
              </span>
            )}
            <button
              onClick={() => onGo(step.id)}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors ${
                step.done
                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                  : step.later
                    ? activeTab === step.id
                      ? 'border-slate-600 text-slate-300'
                      : 'border-slate-800 text-slate-600 hover:text-slate-400'
                    : activeTab === step.id
                      ? 'border-indigo-500/50 text-indigo-200 bg-indigo-500/10'
                      : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {step.done ? '✓ ' : ''}
              {step.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-indigo-400">Next</p>
          <p className="text-sm text-slate-100 font-medium">{next.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{next.detail}</p>
        </div>
        <button
          type="button"
          disabled={busy && next.kind !== 'scene'}
          onClick={() => onNext(next)}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg"
        >
          {next.cta}
        </button>
      </div>
    </div>
  );
}
