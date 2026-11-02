import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { USER, SELLING_PERSONAS } from '../../data/mockData';
import type { SellingPersona } from '../../types';

export default function AvatarModal() {
  const {
    avatarModalOpen,
    setAvatarModalOpen,
    currentAvatar,
    saveAvatar,
    showToast,
  } = useApp();

  const [selectedPersona, setSelectedPersona] = useState<SellingPersona>(currentAvatar);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Sync state whenever modal opens
  useEffect(() => {
    if (avatarModalOpen) {
      setSelectedPersona(currentAvatar);
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      setTimeout(() => closeButtonRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setAvatarModalOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        previouslyFocusedElement.current?.focus();
      };
    }
  }, [avatarModalOpen, currentAvatar, setAvatarModalOpen]);

  if (!avatarModalOpen) return null;

  const handleSave = () => {
    saveAvatar(selectedPersona);
    showToast(`Persona saved: ${selectedPersona.name} · ${selectedPersona.title}`);
    setAvatarModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Avatar & Selling Persona Customization"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setAvatarModalOpen(false)}
        />

        <div className="relative w-full max-w-lg bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in z-10">
          {/* Header */}
          <div className="bg-og-forest text-white p-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-og-green-light">
                <Sparkles size={18} />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-og-green-light">
                  Selling Persona Customization
                </span>
                <h3 className="text-base font-bold">Select Selling Avatar</h3>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={() => setAvatarModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white focus:outline-hidden focus:ring-2 focus:ring-white transition-colors"
              aria-label="Close avatar modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Top: Active Profile & OG Score Overview */}
            <div className="bg-gradient-to-br from-og-forest/5 via-white to-og-green/10 border border-og-gray-border rounded-xl p-4 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-md ring-4 transition-all duration-300"
                  style={{
                    backgroundColor: selectedPersona.bgLight,
                    boxShadow: `0 0 0 3px ${selectedPersona.ringColor}`,
                  }}
                >
                  {selectedPersona.emoji}
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-og-gold text-og-forest text-[11px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                  #{USER.rank}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-[#1c1c1e] truncate">{USER.name}</h4>
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${selectedPersona.ringColor}20`,
                      color: selectedPersona.ringColor,
                    }}
                  >
                    {selectedPersona.badge}
                  </span>
                </div>
                <p className="text-xs text-og-gray-text mt-0.5">
                  {USER.store} · {USER.brand}
                </p>

                <div className="flex items-center gap-3 mt-2">
                  <div className="inline-flex items-center gap-1.5 bg-og-green-bg px-2.5 py-0.5 rounded-full text-xs font-bold text-og-forest">
                    <span>OG Score™:</span>
                    <span className="text-og-green font-extrabold">{USER.ogScore}</span>
                  </div>
                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-og-green" /> Verified Agent
                  </span>
                </div>
              </div>
            </div>

            {/* Instruction Banner */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-600">
                  Select 1 of 5 Personas
                </label>
                <span className="text-[11px] text-gray-400">Updates Topbar & call signature</span>
              </div>

              {/* 5 Persona Grid */}
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Selling Personas">
                {SELLING_PERSONAS.map((persona) => {
                  const isSelected = selectedPersona.id === persona.id;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedPersona(persona)}
                      className={`relative flex flex-col items-center p-2 rounded-xl transition-all text-center border-2 ${
                        isSelected
                          ? 'border-transparent shadow-md transform -translate-y-0.5 bg-white'
                          : 'border-transparent hover:border-gray-200 bg-gray-50 hover:bg-white'
                      }`}
                      style={{
                        boxShadow: isSelected ? `0 0 0 2.5px ${persona.ringColor}` : undefined,
                      }}
                    >
                      {/* Emoji Avatar Icon */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-inner mb-1.5"
                        style={{ backgroundColor: persona.bgLight }}
                      >
                        {persona.emoji}
                      </div>

                      <span className="text-xs font-bold text-gray-900 leading-tight">
                        {persona.name}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight line-clamp-1 mt-0.5">
                        {persona.title.replace('The ', '')}
                      </span>

                      {/* Selected check badge */}
                      {isSelected && (
                        <div
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center shadow-xs text-[10px]"
                          style={{ backgroundColor: persona.ringColor }}
                        >
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Persona Deep Dive */}
            <div
              className="p-3.5 rounded-xl border text-xs space-y-1.5 transition-all"
              style={{
                backgroundColor: `${selectedPersona.bgLight}50`,
                borderColor: `${selectedPersona.ringColor}40`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <span>{selectedPersona.emoji}</span>
                  <span>{selectedPersona.name} · {selectedPersona.title}</span>
                </span>
                <span
                  className="px-2 py-0.5 rounded-md font-bold text-[10px] text-white"
                  style={{ backgroundColor: selectedPersona.ringColor }}
                >
                  {selectedPersona.badge}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed font-medium">
                {selectedPersona.description}
              </p>
              <div className="text-[11px] text-gray-500 pt-1 flex items-center gap-1 border-t border-gray-200/60 mt-1">
                <span className="font-semibold text-gray-700">Tone:</span>
                <span>{selectedPersona.style}</span>
              </div>
            </div>

            {/* Region / Performance Footer Note */}
            <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-center justify-between">
              <span>Karnataka Region Top Consultant</span>
              <span className="font-semibold text-og-forest">Ranked #3 of 142 Tele-callers</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3.5 border-t border-og-gray-border bg-og-gray flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAvatarModalOpen(false)}
              className="px-3.5 py-1.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: selectedPersona.ringColor }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Save Avatar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
