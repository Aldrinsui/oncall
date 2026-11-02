import { useState, useEffect, useRef } from 'react';
import { X, ThumbsUp, CalendarClock, PhoneOutgoing, CircleCheck, Frown, Save, Award } from 'lucide-react';
import { WRAPUP_OUTCOMES } from '../../data/mockData';
import type { CallTarget, WrapupOutcome } from '../../types';

interface CallWrapupModalProps {
  target: CallTarget | null;
  duration: string;
  onSave: (outcome: string, notes: string) => void;
  onClose: () => void;
}

export default function CallWrapupModal({
  target,
  duration,
  onSave,
  onClose,
}: CallWrapupModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState('interested');
  const [notes, setNotes] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement;
    setTimeout(() => closeButtonRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement.current?.focus();
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(selectedOutcome, notes);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Call Wrap-up"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-md bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-og-night-mid to-[#252849] text-white p-5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-og-green-light uppercase tracking-wider">
                Call Completed
              </span>
              <h3 className="text-base font-bold text-white">Call Wrap-up Sheet</h3>
              <p className="text-xs text-gray-300">
                {target?.name} • Duration: <strong>{duration}</strong>
              </p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white focus:outline-hidden focus:ring-2 focus:ring-white"
              aria-label="Close wrap-up modal"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Outcome Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-og-forest uppercase tracking-wider block">
                Select Call Outcome
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WRAPUP_OUTCOMES.map((outcome) => {
                  const isSelected = selectedOutcome === outcome.key;
                  return (
                    <button
                      type="button"
                      key={outcome.key}
                      onClick={() => setSelectedOutcome(outcome.key)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'border-2 shadow-xs'
                          : 'bg-og-gray/40 border-og-gray-border hover:bg-og-gray'
                      }`}
                      style={{
                        borderColor: isSelected ? outcome.color : undefined,
                        backgroundColor: isSelected ? outcome.bg : undefined,
                        color: isSelected ? outcome.color : '#1c1c1e',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: outcome.color }} />
                      <span>{outcome.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shift Agent Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-og-forest uppercase tracking-wider block">
                Call Notes & Commitments
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Customer confirmed 12-month EMI. Agreed to test SmartGRID Luxe at Koramangala store on Saturday..."
                rows={3}
                className="w-full bg-og-gray/40 border border-og-gray-border rounded-xl p-3 text-xs text-[#1c1c1e] placeholder-gray-400 focus:outline-hidden focus:border-og-green focus:bg-white resize-none"
              />
            </div>

            {/* Next Steps CTA */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-og-gray-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-og-gray-border hover:bg-og-gray text-xs font-semibold rounded-lg text-og-gray-text"
              >
                Skip Wrap-up
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-og-green hover:bg-og-forest text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Award size={15} />
                <span>Save & View SOP Score</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
