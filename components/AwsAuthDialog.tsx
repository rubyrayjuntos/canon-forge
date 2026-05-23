
import React, { useState } from 'react';

interface AwsAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }) => void;
}

const AwsAuthDialog: React.FC<AwsAuthDialogProps> = ({ isOpen, onClose, onSave }) => {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-indigo-600/5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <i className="fab fa-aws text-orange-400"></i> AWS Authentication
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Required for Bedrock Access</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[10px] text-amber-200/70 leading-relaxed uppercase tracking-wider">
              <i className="fas fa-shield-halved mr-1"></i> These credentials stay in your browser session. They are used to sign requests to Amazon Bedrock.
            </p>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Access Key ID</label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 outline-none transition-colors font-mono"
              placeholder="AKIA..."
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Secret Access Key</label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 outline-none transition-colors font-mono"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Session Token (Optional)</label>
            <textarea
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-white focus:border-orange-500 outline-none transition-colors font-mono h-20 resize-none"
              placeholder="FwoGZXIvYXdz..."
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                if (accessKeyId && secretAccessKey) {
                  onSave({ accessKeyId, secretAccessKey, sessionToken });
                  onClose();
                }
              }}
              disabled={!accessKeyId || !secretAccessKey}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <i className="fas fa-lock-open"></i> Initiate Session
            </button>
            <p className="text-[9px] text-slate-600 text-center mt-3 lowercase px-4">
              ensure your IAM policy has <span className="text-slate-400">bedrock:InvokeModel</span> permissions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AwsAuthDialog;
