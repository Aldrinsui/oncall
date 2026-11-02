import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Mic, Volume2, Store, Bell, Check } from 'lucide-react';
import { USER } from '../../data/mockData';

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, showToast } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Agent Settings">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setSettingsOpen(false)}
        />

        <div className="relative w-full max-w-lg bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-og-forest text-white p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-og-green-light">Configuration</span>
              <h3 className="text-base font-bold">Call Centre Agent Settings</h3>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Close settings"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Store & Profile Info */}
            <div className="p-3.5 rounded-xl bg-og-gray/70 border border-og-gray-border">
              <div className="flex items-center gap-2 text-xs font-bold text-og-forest mb-1.5">
                <Store size={15} />
                <span>Store & Assignment</span>
              </div>
              <div className="text-xs text-[#1c1c1e] font-semibold">{USER.store} Store · {USER.brand}</div>
              <div className="text-[11px] text-og-gray-text mt-0.5">Assigned Agent: {USER.name} (Shift: 10:00 AM – 7:00 PM)</div>
            </div>

            {/* Audio & Calling Preferences */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-og-forest uppercase tracking-wider">Audio & Hardware</span>

              <div className="p-3 border border-og-gray-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <Mic size={15} className="text-og-green" />
                    Microphone Input
                  </span>
                  <span className="text-[11px] bg-og-green-bg text-og-forest px-2 py-0.5 rounded-full font-bold">
                    Default System Mic
                  </span>
                </div>
                <p className="text-[11px] text-og-gray-text">Used for live AI-to-human speech transcription in the calling engine.</p>
              </div>

              <div className="p-3 border border-og-gray-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <Volume2 size={15} className="text-og-green" />
                    Audio Output / Ringtone
                  </span>
                  <span className="text-[11px] bg-og-green-bg text-og-forest px-2 py-0.5 rounded-full font-bold">
                    Web Audio Synth (Active)
                  </span>
                </div>
                <p className="text-[11px] text-og-gray-text">Synthesized telephone ringing tones and customer voice playback.</p>
              </div>
            </div>

            {/* Notification sound toggle */}
            <div className="p-3 border border-og-gray-border rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Bell size={15} className="text-og-amber" />
                <span>Incoming Call Alerts</span>
              </div>
              <div className="w-9 h-5 bg-og-green rounded-full flex items-center justify-end px-0.5 cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-og-gray-border bg-og-gray flex justify-end gap-2">
            <button
              onClick={() => {
                setSettingsOpen(false);
                showToast('Settings saved successfully');
              }}
              className="px-4 py-2 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Check size={14} />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
