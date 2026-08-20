import React, { useState, useRef, useEffect } from 'react';
import { CharacterProfile } from '../types';
import { ProviderConfig } from '../services/geminiService';
import { AESTHETIC_PROMPT_CORE } from '../constants';
import { buildCharacterIdentityBlock, HEADSHOT_SCENE, HEADSHOT_NEGATIVE_CONSTRAINTS } from '../utils/identityLock.js';

interface CanonHeadshotDialogProps {
  isOpen: boolean;
  profile: CharacterProfile;
  providerConfig: ProviderConfig;
  onApprove: (canonUrl: string) => void;
  onGenerateFromDescription: () => void;
  onClose: () => void;
}

type DialogState = 'upload' | 'generating' | 'error' | 'review';

function buildCanonPrompt(profile: CharacterProfile): string {
  return `${AESTHETIC_PROMPT_CORE}
${buildCharacterIdentityBlock(profile, { shotType: 'HEADSHOT' })}
Scene: ${HEADSHOT_SCENE}
Negative constraints: ${HEADSHOT_NEGATIVE_CONSTRAINTS}.
Style: High-fidelity cinematic photography. Strict facial identity. Maintain the exact facial features from the reference image if attached.`.trim();
}

async function downscaleImage(file: File): Promise<{ b64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round((height / width) * MAX); width = MAX; }
        else { width = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve({ b64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

const CanonHeadshotDialog: React.FC<CanonHeadshotDialogProps> = ({
  isOpen, profile, providerConfig, onApprove, onGenerateFromDescription, onClose,
}) => {
  const [state, setState] = useState<DialogState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setState('upload');
      setSelectedFile(null);
      setPreviewUrl(null);
      setGeneratedUrl(null);
      setErrorMessage('');
      setFileError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setFileError('');
    if (!file.type.startsWith('image/')) {
      setFileError('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Image is too large. Please use a file under 10 MB.');
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;
    setState('generating');
    try {
      const { b64, mimeType } = await downscaleImage(selectedFile);
      const prompt = buildCanonPrompt(profile);
      const body: Record<string, unknown> = {
        prompt,
        seed: profile.seed,
        aspectRatio: '1:1',
        provider: providerConfig.provider === 'local-llm' ? 'local-sd' : providerConfig.provider,
        model: providerConfig.model,
      };
      if (providerConfig.provider !== 'venice') {
        body.referenceImage = `data:${mimeType};base64,${b64}`;
      }
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data?.error || 'Generation failed.');
      setGeneratedUrl(data.url);
      setState('review');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setErrorMessage(message);
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-100">Lock a canon face</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">Close</button>
        </div>

        <p className="text-sm text-slate-400">
          <span className="text-indigo-400 font-semibold">{profile.name || 'Character'}</span>
          {profile.age ? `, ${profile.age}y/o` : ''}{profile.gender ? ` ${profile.gender}` : ''}.
          The first headshot becomes the identity lock for every later shot.
        </p>

        {providerConfig.provider === 'venice' && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-3 py-2">
            Reference image is not supported with Venice — canon headshot will be generated from description only.
          </p>
        )}

        {state === 'upload' && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Reference" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="text-slate-500 space-y-2">
                  <i className="fas fa-cloud-upload-alt text-3xl"></i>
                  <p className="text-sm">Drop an image here or click to browse</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
            />
            {fileError && <p className="text-sm text-red-400">{fileError}</p>}
            <button
              onClick={onGenerateFromDescription}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 py-2"
            >
              Generate from description
            </button>
            <button
              onClick={handleGenerate}
              disabled={!selectedFile}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm"
            >
              {selectedFile ? 'Generate from photo' : 'Or upload a photo first'}
            </button>
            <button
              onClick={onClose}
              className="w-full text-sm text-slate-500 hover:text-slate-300 py-1"
            >
              Cancel
            </button>
          </div>
        )}

        {state === 'generating' && (
          <div className="space-y-4">
            {previewUrl && <img src={previewUrl} alt="Reference" className="max-h-40 mx-auto rounded-lg object-contain opacity-60" />}
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Creating your canon headshot…</span>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded px-3 py-2">{errorMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setState('upload')}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state === 'review' && generatedUrl && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider text-center">Reference</p>
                <img src={previewUrl!} alt="Reference" className="w-full aspect-square object-cover rounded-lg" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-indigo-400 uppercase tracking-wider text-center">Canon Headshot</p>
                <img src={generatedUrl} alt="Canon headshot" className="w-full aspect-square object-cover rounded-lg" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onApprove(generatedUrl)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
              >
                ✓ Lock as canon face
              </button>
              <button
                onClick={handleGenerate}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
              >
                ↻ Retry
              </button>
              <button
                onClick={onGenerateFromDescription}
                className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                Generate from description instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanonHeadshotDialog;
