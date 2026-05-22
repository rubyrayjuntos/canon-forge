import React, { useState, useEffect, useRef } from 'react';
import { Keyframe } from '../types';

interface FlipbookPlayerProps {
  frames: Keyframe[];
  totalDuration: number;
  intervalSeconds: number;
  onRegenerateFrame: (frameIndex: number) => void;
}

const FlipbookPlayer: React.FC<FlipbookPlayerProps> = ({
  frames,
  totalDuration,
  intervalSeconds,
  onRegenerateFrame,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canPlay = frames.some((f) => f.status === 'done');
  const activeFrame = frames[activeIndex];

  // Reset active index when frames array changes length (new scene)
  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
  }, [frames.length]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % frames.length);
    }, 1000 / fps);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, fps, frames.length]);

  return (
    <div className="flex flex-col gap-4">
      {/* Preview window */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {activeFrame?.status === 'done' && activeFrame.url ? (
          <img src={activeFrame.url} className="w-full h-full object-cover" alt={`Frame ${activeIndex + 1}`} />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <i className="fas fa-film text-3xl"></i>
            <span className="text-xs font-mono">
              {activeFrame?.status === 'generating' ? 'Generating...' : 'Pending'}
            </span>
          </div>
        )}
        {activeFrame?.sourceLabel && (
          <div className="absolute top-3 left-3 bg-emerald-950/80 border border-emerald-600/50 rounded-lg px-2 py-1 text-[10px] font-mono text-emerald-200">
            {activeFrame.sourceLabel}
          </div>
        )}
        <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-3 py-1 text-xs font-mono text-slate-300">
          Frame {activeIndex + 1} of {frames.length} · {activeIndex * intervalSeconds}s / {totalDuration}s
        </div>
      </div>

      {/* Filmstrip */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {frames.map((frame, i) => (
          <FrameThumbnail
            key={frame.id}
            frame={frame}
            index={i}
            isActive={i === activeIndex}
            intervalSeconds={intervalSeconds}
            onClick={() => setActiveIndex(i)}
            onRegenerate={() => onRegenerateFrame(i)}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPlaying((p) => !p)}
          disabled={!canPlay}
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <i className={`fas fa-${isPlaying ? 'pause' : 'play'} text-sm`}></i>
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Speed</span>
          <input
            type="range"
            min={1}
            max={8}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-24 accent-indigo-500"
          />
          <span className="font-mono w-8">{fps} fps</span>
        </div>
      </div>
    </div>
  );
};

const FrameThumbnail: React.FC<{
  frame: Keyframe;
  index: number;
  isActive: boolean;
  intervalSeconds: number;
  onClick: () => void;
  onRegenerate: () => void;
}> = ({ frame, index, isActive, intervalSeconds, onClick, onRegenerate }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
        isActive ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : frame.status === 'error' ? 'border-red-700' : 'border-slate-700 hover:border-slate-500'
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {frame.status === 'done' && frame.url ? (
        <img src={frame.url} className="w-full h-full object-cover" alt={`Frame ${index + 1}`} />
      ) : frame.status === 'generating' ? (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <i className="fas fa-circle-notch fa-spin text-indigo-400"></i>
        </div>
      ) : (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <i className={`fas ${frame.status === 'error' ? 'fa-exclamation-triangle text-red-500' : 'fa-clock text-slate-600'}`}></i>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
        {index * intervalSeconds}s
      </div>
      {frame.sourceLabel && (
        <div className="absolute top-1 left-1 max-w-[88%] truncate bg-emerald-950/80 border border-emerald-700/60 rounded px-1 py-0.5 text-[8px] font-mono text-emerald-200">
          {frame.sourceLabel}
        </div>
      )}
      {hovered && (frame.status === 'done' || frame.status === 'error') && (
        <button
          onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
          className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 transition-colors"
          title="Regenerate frame"
        >
          <i className="fas fa-redo text-[8px]"></i>
        </button>
      )}
    </div>
  );
};

export default FlipbookPlayer;
