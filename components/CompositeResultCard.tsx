import React, { useState, useCallback } from 'react';
import { ReferenceImage } from '../types';
import { downloadImage } from '../utils/download';
import { copyToClipboard } from '../utils/clipboard';

interface CompositeResultCardProps {
  img: ReferenceImage;
  charName: string;
  setName: string;
  onCopySuccess: () => void;
}

/**
 * Displays a single composite render with metadata, a prompt viewer, and download action.
 */
const CompositeResultCard: React.FC<CompositeResultCardProps> = ({ img, charName, setName, onCopySuccess }) => {
  const [promptOpen, setPromptOpen] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(img.promptUsed);
    if (success) onCopySuccess();
  }, [img.promptUsed, onCopySuccess]);

  const handleDownload = useCallback(() => {
    downloadImage(img.url, `composite_${img.id.slice(0, 5)}.png`);
  }, [img.url, img.id]);

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
      <img
        src={img.url}
        alt={`Composite render of ${charName} at ${setName}`}
        className="w-full aspect-video object-cover transition-transform group-hover:scale-[1.01] duration-700"
      />

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
              onClick={() => setPromptOpen(prev => !prev)}
              aria-expanded={promptOpen}
              aria-label={promptOpen ? 'Hide generation prompt' : 'View generation prompt'}
              className={`p-3 rounded-full border transition-all ${
                promptOpen
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <i className="fas fa-terminal" aria-hidden="true"></i>
            </button>
            <button
              onClick={handleDownload}
              className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 shadow-lg text-white"
              aria-label="Download composite image"
              title="Download image"
            >
              <i className="fas fa-download" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {promptOpen && (
          <div className="mt-4 p-4 bg-black/40 rounded-xl border border-slate-800 text-[10px] font-mono leading-relaxed animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-indigo-500 font-bold uppercase tracking-widest">Composite Logic Prompt</span>
              <button
                onClick={handleCopy}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                aria-label="Copy prompt to clipboard"
              >
                <i className="fas fa-copy" aria-hidden="true"></i> Copy
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

export default CompositeResultCard;
