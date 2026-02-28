import React from 'react';

interface LoadingOverlayProps {
  statusMessage: string;
}

/**
 * Full-screen loading overlay shown while an image is being generated.
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ statusMessage }) => (
  <div
    className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
    role="alert"
    aria-live="polite"
    aria-label="Generating image"
  >
    <div className="relative w-24 h-24 mb-6" aria-hidden="true">
      <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <i className="fas fa-atom text-indigo-400 text-2xl animate-pulse"></i>
      </div>
    </div>
    <h3 className="text-2xl font-bold aesthetic-font text-white">{statusMessage}</h3>
    <p className="text-slate-500 text-xs mt-2 italic">
      Computing high-fidelity spiritual realism with deterministic seeds...
    </p>
  </div>
);

export default LoadingOverlay;
