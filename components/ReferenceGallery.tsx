
import React from 'react';
import { ReferenceImage, ReferenceType } from '../types';

interface ReferenceGalleryProps {
  images: ReferenceImage[];
  onGenerate: (type: ReferenceType) => void;
  isGenerating: boolean;
}

const ReferenceGallery: React.FC<ReferenceGalleryProps> = ({ images, onGenerate, isGenerating }) => {
  const types: { type: ReferenceType; label: string; icon: string }[] = [
    { type: 'HEADSHOT', label: 'Headshot', icon: 'fa-user-circle' },
    { type: 'BODY_REVERSE', label: 'Anatomical (3 Poses)', icon: 'fa-street-view' },
    { type: 'NEUTRAL_SHEET', label: 'Neutral Sheet', icon: 'fa-table-cells' },
    { type: 'WARDROBE', label: 'Wardrobe', icon: 'fa-shirt' },
    { type: 'ACTION', label: 'Action', icon: 'fa-person-running' },
    { type: 'EXPRESSION', label: 'Expressions', icon: 'fa-face-smile-beam' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        {types.map((t) => (
          <button
            key={t.type}
            onClick={() => onGenerate(t.type)}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 text-sm font-medium transition-all ${
              isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-600/20 hover:border-indigo-500 active:scale-95'
            }`}
          >
            <i className={`fas ${t.icon} text-indigo-400`}></i>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((img) => (
          <div key={img.id} className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all">
            <div className="aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
              <img src={img.url} alt={img.type} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </div>
            <div className="p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">{img.type.replace('_', ' ')}</span>
                <p className="text-[10px] text-slate-500 mt-1">{new Date(img.timestamp).toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = img.url;
                  link.download = `canon_${img.type}_${img.id.slice(0, 5)}.png`;
                  link.click();
                }}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Download reference"
              >
                <i className="fas fa-download"></i>
              </button>
            </div>
          </div>
        ))}

        {images.length === 0 && !isGenerating && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl">
            <i className="fas fa-magic-wand-sparkles text-4xl text-slate-700 mb-4 block"></i>
            <p className="text-slate-500 font-medium">Define your character and click a reference type to begin forging.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferenceGallery;
