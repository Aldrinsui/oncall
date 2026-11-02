import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Check } from 'lucide-react';
import { USER } from '../../data/mockData';

export default function AvatarModal() {
  const { avatarModalOpen, setAvatarModalOpen, showToast } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && avatarModalOpen) {
        setAvatarModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [avatarModalOpen, setAvatarModalOpen]);

  if (!avatarModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Agent Avatar Profile">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setAvatarModalOpen(false)}
        />

        <div className="relative w-full max-w-sm bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-og-forest text-white p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-og-green-light">Identity</span>
              <h3 className="text-base font-bold">Agent Profile Badge</h3>
            </div>
            <button
              onClick={() => setAvatarModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Close avatar modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 text-center space-y-4">
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-og-green to-og-green-light flex items-center justify-center text-3xl shadow-lg mx-auto ring-4 ring-og-green/20">
                {USER.emoji}
              </div>
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-og-gold text-og-forest text-xs font-black flex items-center justify-center border-2 border-white">
                #3
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-[#1c1c1e]">{USER.name}</h4>
              <p className="text-xs text-og-gray-text">{USER.store} · {USER.brand}</p>
              <div className="inline-flex items-center gap-1.5 mt-2 bg-og-green-bg px-2.5 py-1 rounded-full text-xs font-bold text-og-forest">
                <span>OG Score™:</span>
                <span className="text-og-green font-extrabold">{USER.ogScore}</span>
              </div>
            </div>

            <div className="pt-2 text-left text-xs text-og-gray-text border-t border-og-gray-border">
              <p>Top performing sales consultant in Karnataka region this month. Assigned to high-intent leads.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-og-gray-border bg-og-gray flex justify-end">
            <button
              onClick={() => {
                setAvatarModalOpen(false);
                showToast('Profile badge confirmed');
              }}
              className="px-4 py-1.5 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Check size={14} />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
