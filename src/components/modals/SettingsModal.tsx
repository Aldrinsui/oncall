import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Mic, Volume2, Store, Bell, Check } from 'lucide-react';
import { USER } from '../../data/mockData';

export default function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    incomingAlerts,
    setIncomingAlerts,
    audioOutput,
    setAudioOutput,
    showToast,
  } = useApp();

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Focus management and Escape key handling
  useEffect(() => {
    if (settingsOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      setTimeout(() => closeButtonRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSettingsOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        previouslyFocusedElement.current?.focus();
      };
    }
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  const handleSave = () => {
    setSettingsOpen(false);
    showToast(
      `Settings saved: Alerts ${incomingAlerts ? 'active' : 'muted'}, Output: ${audioOutput}`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Settings"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setSettingsOpen(false)}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-lg bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-og-forest text-white p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-og-green-light">
                Configuration
              </span>
              <h3 className="text-base font-bold">Call Centre Agent Settings</h3>
            </div>
            <button
              ref={closeButtonRef}
              onClick={() => setSettingsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white focus:outline-hidden focus:ring-2 focus:ring-white"
              aria-label="Close settings dialog"
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
              <div className="text-xs text-[#1c1c1e] font-semibold">
                {USER.store} Store · {USER.brand}
              </div>
              <div className="text-[11px] text-og-gray-text mt-0.5">
                Assigned Agent: {USER.name} (Shift: 10:00 AM – 7:00 PM)
              </div>
            </div>

            {/* Audio & Calling Preferences */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-og-forest uppercase tracking-wider">
                Audio & Hardware
              </span>

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
                <p className="text-[11px] text-og-gray-text">
                  Captures microphone audio for real-time speech transcription.
                </p>
              </div>

              <div className="p-3 border border-og-gray-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <Volume2 size={15} className="text-og-green" />
                    Audio Output / Ringtone
                  </span>
                  <select
                    value={audioOutput}
                    onChange={(e) => setAudioOutput(e.target.value)}
                    className="text-[11px] bg-og-green-bg text-og-forest font-bold px-2 py-1 rounded-lg border border-og-green/30 focus:outline-hidden cursor-pointer"
                    aria-label="Select audio output device"
                  >
                    <option value="Web Audio Synth (Active)">Web Audio Synth (Active)</option>
                    <option value="System Default Speaker">System Default Speaker</option>
                    <option value="Headset / Headphones">Headset / Headphones</option>
                  </select>
                </div>
                <p className="text-[11px] text-og-gray-text">
                  Synthesizes phone ringing tones, DTMF key tones, and customer speech.
                </p>
              </div>
            </div>

            {/* Incoming Call Alerts Toggle — Controlled and Interactive */}
            <div className="p-3 border border-og-gray-border rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Bell size={15} className={incomingAlerts ? 'text-og-amber' : 'text-og-gray-text'} />
                  <span>Incoming Call Alerts</span>
                </div>
                <p className="text-[11px] text-og-gray-text mt-0.5">
                  Play ringing chime and display visual notification card when callers queue.
                </p>
              </div>

              {/* Accessible interactive switch */}
              <button
                type="button"
                role="switch"
                aria-checked={incomingAlerts}
                onClick={() => setIncomingAlerts(!incomingAlerts)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-og-green ${
                  incomingAlerts ? 'bg-og-green' : 'bg-gray-300'
                }`}
                aria-label="Toggle incoming call alerts"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    incomingAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-og-gray-border bg-og-gray flex justify-end gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-hidden focus:ring-2 focus:ring-og-forest"
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
