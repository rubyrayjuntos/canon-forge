import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CharacterProfile, SetProfile, Keyframe, KeyframeScene } from '../types';
import { ProviderConfig } from '../services/geminiService';
import { buildKeyframePrompt, generateKeyframeSequence, computeFrameCount } from '../services/keyframeService';
import FlipbookPlayer from './FlipbookPlayer';

interface SceneForgePanelProps {
  charProfile: CharacterProfile;
  savedChars: CharacterProfile[];
  setProfile: SetProfile;
  savedSets: SetProfile[];
  providerConfig: ProviderConfig;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const SceneForgePanel: React.FC<SceneForgePanelProps> = ({
  charProfile,
  savedChars,
  setProfile,
  savedSets,
  providerConfig,
}) => {
  const allChars = useMemo(
    () => [charProfile, ...savedChars.filter((c) => c.id !== charProfile.id)],
    [charProfile, savedChars]
  );
  const allSets = useMemo(
    () => [setProfile, ...savedSets.filter((s) => s.id !== setProfile.id)],
    [setProfile, savedSets]
  );

  const [selectedCharId, setSelectedCharId] = useState<string>(charProfile.id);
  const [selectedSetId, setSelectedSetId] = useState<string>(setProfile.id);
  const [sceneAction, setSceneAction] = useState('');
  const [totalDuration, setTotalDuration] = useState(32);
  const [intervalSeconds, setIntervalSeconds] = useState(8);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualBeats, setManualBeats] = useState<string[]>([]);
  const [isForging, setIsForging] = useState(false);

  const [activeScene, setActiveScene] = useState<KeyframeScene | null>(null);
  const [sceneHistory, setSceneHistory] = useState<KeyframeScene[]>([]);

  const frameCount = computeFrameCount(totalDuration, intervalSeconds);

  // Keep manualBeats in sync with frameCount regardless of mode
  useEffect(() => {
    setManualBeats((prev) => {
      if (prev.length === frameCount) return prev;
      if (prev.length > frameCount) return prev.slice(0, frameCount);
      return [...prev, ...Array(frameCount - prev.length).fill('')];
    });
  }, [frameCount]);

  // Append to history when all frames have settled
  useEffect(() => {
    if (!activeScene) return;
    const allSettled = activeScene.frames.every(
      (f) => f.status === 'done' || f.status === 'error'
    );
    if (!allSettled) return;
    setSceneHistory((prev) =>
      prev.some((s) => s.id === activeScene.id) ? prev : [activeScene, ...prev]
    );
  }, [activeScene]);

  const handleFrameUpdate = useCallback((frameIndex: number, update: Partial<Keyframe>) => {
    setActiveScene((prev) => {
      if (!prev) return prev;
      const frames = prev.frames.map((f, i) =>
        i === frameIndex ? { ...f, ...update } : f
      );
      return { ...prev, frames };
    });
  }, []);

  const handleRegenerate = useCallback(async (frameIndex: number) => {
    if (!activeScene) return;
    const char = allChars.find((c) => c.id === activeScene.characterId);
    const set = allSets.find((s) => s.id === activeScene.setId);
    if (!char || !set) return;

    const interval = activeScene.intervalSeconds;
    const frameCount = activeScene.frames.length;
    const timestampSeconds = frameIndex * interval;
    const beat = activeScene.manualBeats[frameIndex] ?? '';
    const prompt = buildKeyframePrompt(char, set, activeScene.sceneAction, frameIndex, frameCount, timestampSeconds, beat, char.wardrobe);

    handleFrameUpdate(frameIndex, { status: 'generating', url: '', promptUsed: prompt });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          seed: char.seed,
          aspectRatio: '16:9',
          fastRender: true,
          provider: providerConfig.provider,
          model: providerConfig.model,
          referenceImage: char.canonHeadshotUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        handleFrameUpdate(frameIndex, { status: 'error' });
      } else {
        handleFrameUpdate(frameIndex, { status: 'done', url: data.url });
      }
    } catch {
      handleFrameUpdate(frameIndex, { status: 'error' });
    }
  }, [activeScene, allChars, allSets, providerConfig, handleFrameUpdate]);

  const handleForge = async () => {
    const char = allChars.find((c) => c.id === selectedCharId) ?? charProfile;
    const set = allSets.find((s) => s.id === selectedSetId) ?? setProfile;
    const clampedInterval = Math.max(1, Math.min(8, intervalSeconds));
    const count = computeFrameCount(totalDuration, clampedInterval);

    const initialFrames: Keyframe[] = Array.from({ length: count }, (_, i) => ({
      id: generateId(),
      frameIndex: i,
      timestampSeconds: i * clampedInterval,
      url: '',
      promptUsed: '',
      status: 'pending' as const,
    }));

    const newScene: KeyframeScene = {
      id: generateId(),
      characterId: char.id,
      setId: set.id,
      characterName: char.name,
      setName: set.name,
      sceneAction,
      totalDuration,
      intervalSeconds: clampedInterval,
      mode,
      manualBeats: [...manualBeats],
      frames: initialFrames,
      createdAt: Date.now(),
    };

    setActiveScene(newScene);
    setIsForging(true);
    try {
      await generateKeyframeSequence(char, set, newScene, providerConfig, char.canonHeadshotUrl, handleFrameUpdate);
    } finally {
      setIsForging(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Config Bar */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">Scene Configuration</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Character</label>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {allChars.map((c) => (
                <option key={c.id} value={c.id}>{c.name || 'Unnamed Character'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Set</label>
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {allSets.map((s) => (
                <option key={s.id} value={s.id}>{s.name || 'Unnamed Set'}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Scene Action</label>
          <input
            type="text"
            value={sceneAction}
            onChange={(e) => setSceneAction(e.target.value)}
            placeholder="e.g. walks to the window and looks out"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Duration (s)</label>
            <input
              type="number"
              min={8}
              max={300}
              value={totalDuration}
              onChange={(e) => setTotalDuration(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Interval (s, max 8)</label>
            <input
              type="number"
              min={1}
              max={8}
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Math.max(1, Math.min(8, Number(e.target.value))))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Frames</label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono">
              {frameCount}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Mode:</span>
          {(['auto', 'manual'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        {mode === 'manual' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Beat descriptions (one per frame):</p>
            {manualBeats.map((beat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">
                  {i * intervalSeconds}s
                </span>
                <input
                  type="text"
                  value={beat}
                  onChange={(e) => {
                    const next = [...manualBeats];
                    next[i] = e.target.value;
                    setManualBeats(next);
                  }}
                  placeholder={`Frame ${i + 1} beat`}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600"
                />
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleForge}
          disabled={isForging || !sceneAction.trim()}
          className="w-full bg-gradient-to-r from-violet-700 to-indigo-600 hover:from-violet-600 hover:to-indigo-500 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <i className={`fas ${isForging ? 'fa-circle-notch fa-spin' : 'fa-film'}`}></i>
          {isForging ? 'Forging Scene...' : `⚡ Forge Keyframes (${frameCount} frames)`}
        </button>
      </div>

      {/* Flipbook Player */}
      {activeScene && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase mb-4">
            Scene Preview — {activeScene.characterName} · {activeScene.sceneAction}
          </p>
          <FlipbookPlayer
            frames={activeScene.frames}
            totalDuration={activeScene.totalDuration}
            intervalSeconds={activeScene.intervalSeconds}
            onRegenerateFrame={handleRegenerate}
          />
        </div>
      )}

      {/* Scene History */}
      {sceneHistory.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase mb-4">Scene Archive</p>
          <div className="space-y-2">
            {sceneHistory.map((scene) => (
              <button
                key={scene.id}
                onClick={() => setActiveScene(scene)}
                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{scene.characterName}</span>
                    <span className="text-slate-400 text-sm"> · {scene.sceneAction}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {scene.frames.length} frames · {new Date(scene.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneForgePanel;
