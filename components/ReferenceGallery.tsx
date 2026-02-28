import React, { useState, useCallback } from 'react';
import { ReferenceImage } from '../types';
import { downloadImage } from '../utils/download';
import { copyToClipboard } from '../utils/clipboard';

export interface GalleryType {
  type: string;
  label: string;
  icon: string;
}

interface ReferenceGalleryProps {
  images: ReferenceImage[];
  onGenerate: (type: string) => void;
  isGenerating: boolean;
  types: GalleryType[];
  onCopySuccess: () => void;
}

/**
 * Displays a grid of generated reference images with generation buttons,
 * expandable prompt viewers, and individual download actions.
 */
const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({
  images,
  onGenerate,
  isGenerating,
  types,
  onCopySuccess,
}) => {
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) onCopySuccess();
  }, [onCopySuccess]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Reference type selection">
        {types.map((t) => (
          <button
            key={t.type}
            onClick={() => onGenerate(t.type)}
            disabled={isGenerating}
            aria-label={`Generate ${t.label} reference`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 text-xs font-medium transition-all ${
              isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-600/20 hover:border-indigo-500 active:scale-95'
            }`}
          >
            <i className={`fas ${t.icon} text-indigo-400`} aria-hidden="true"></i>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-indigo-500/50 transition-all flex flex-col"
          >
            <img
              src={img.url}
              alt={`${img.type.replace('_', ' ')} reference image`}
              className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="p-3 bg-slate-900/90 flex justify-between items-center text-[10px] uppercase tracking-tighter">
              <span className="text-indigo-400 font-bold">{img.type.replace('_', ' ')}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpandedPrompt(expandedPrompt === img.id ? null : img.id)}
                  aria-expanded={expandedPrompt === img.id}
                  aria-label={expandedPrompt === img.id ? 'Hide prompt' : 'View prompt'}
                  className={`transition-colors ${
                    expandedPrompt === img.id ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'
                  }`}
                >
                  <i className="fas fa-terminal" aria-hidden="true"></i>
                </button>
                <button
                  onClick={() => downloadImage(img.url, `canon_${img.type}_${img.id.slice(0, 5)}.png`)}
                  aria-label={`Download ${img.type.replace('_', ' ')} image`}
                  title="Download image"
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <i className="fas fa-download" aria-hidden="true"></i>
                </button>
              </div>
            </div>

            {expandedPrompt === img.id && (
              <div className="p-3 bg-black/50 border-t border-slate-800 text-[10px] font-mono text-slate-400 overflow-hidden">
                <div className="flex justify-between mb-1">
                  <span className="text-indigo-500 font-bold">PROMPT:</span>
                  <button
                    onClick={() => handleCopy(img.promptUsed)}
                    aria-label="Copy prompt to clipboard"
                    className="text-indigo-400 hover:text-white transition-colors"
                  >
                    <i className="fas fa-copy" aria-hidden="true"></i> Copy
                  </button>
                </div>
                <div className="line-clamp-4 hover:line-clamp-none transition-all cursor-pointer whitespace-pre-wrap">
                  {img.promptUsed}
                </div>
              </div>
            )}
          </div>
        ))}

        {images.length === 0 && !isGenerating && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl">
            <i className="fas fa-magic-wand-sparkles text-4xl text-slate-700 mb-4 block" aria-hidden="true"></i>
            <p className="text-slate-500 font-medium">Select a reference type above to begin forging.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferenceGallery;
