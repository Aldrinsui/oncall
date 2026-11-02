import { useEffect, useRef } from 'react';
import { X, CheckCircle2, XCircle, Award, ShieldCheck, Clock, FileText } from 'lucide-react';
import type { RecentCall } from '../../types';

interface CallSopReviewModalProps {
  call: RecentCall | null;
  onClose: () => void;
}

export default function CallSopReviewModal({ call, onClose }: CallSopReviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (call) {
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
    }
  }, [call, onClose]);

  if (!call) return null;

  const score = call.sopScore ?? 85;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`SOP Review for call with ${call.name}`}
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-lg bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-og-night-mid to-[#252849] text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-md"
                style={{ backgroundColor: call.outcomeColor, color: '#fff' }}
              >
                {score}%
              </div>
              <div>
                <span className="text-[11px] font-bold text-og-green-light uppercase tracking-wider">
                  Quality Audit
                </span>
                <h3 className="text-base font-bold text-white">Call SOP Review · {call.name}</h3>
                <p className="text-xs text-gray-300">
                  Duration: {call.duration} • Outcome: {call.outcome} {call.value ? `(${call.value})` : ''}
                </p>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white focus:outline-hidden focus:ring-2 focus:ring-white"
              aria-label="Close SOP review modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Score Banner */}
          <div className="bg-og-green-bg/60 p-3.5 border-b border-og-gray-border flex items-center justify-between text-xs">
            <span className="font-bold text-og-forest flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-og-green" />
              SOP Compliance: {score >= 80 ? 'Target Achieved ✓' : 'Requires Attention'}
            </span>
            <span className="text-og-gray-text text-[11px]">Audited by QA Agent & Sunita Rao</span>
          </div>

          {/* DPDP Consent Audit Banner */}
          {call.consent && (
            <div className="mx-5 mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  size={16}
                  className={call.consent.status === 'granted' ? 'text-emerald-600' : 'text-red-500'}
                />
                <div>
                  <span className="font-bold text-gray-800">
                    {call.consent.isMinor ? 'Parent/Guardian Recording Consent:' : 'Recording Consent:'}{' '}
                    {call.consent.status === 'granted' ? 'Granted ✓' : 'Declined ✕'}
                  </span>
                  <span className="text-gray-500 text-[11px] block mt-0.5">
                    ID: {call.consent.consentId} • Method: {call.consent.method === 'wa' ? 'WhatsApp' : 'Voice'} • Verified {call.consent.timestamp}
                    {call.consent.isMinor && call.consent.guardianPhone ? ` • Guardian: +91 ${call.consent.guardianPhone}` : ''}
                  </span>
                </div>

              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  call.consent.status === 'granted'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {call.consent.status}
              </span>
            </div>
          )}


          {/* Criteria Breakdown */}
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            <span className="text-xs font-bold text-og-forest uppercase tracking-wider block mb-1">
              6-Pillar Sales Script Evaluation
            </span>

            {call.reviewItems && call.reviewItems.length > 0 ? (
              call.reviewItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-colors ${
                    item.passed
                      ? 'bg-emerald-50/40 border-emerald-200/60'
                      : 'bg-red-50/40 border-red-200/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 font-bold text-[#1c1c1e]">
                      {item.passed ? (
                        <CheckCircle2 size={16} className="text-og-green flex-shrink-0" />
                      ) : (
                        <XCircle size={16} className="text-og-red flex-shrink-0" />
                      )}
                      <span>{item.criterion}</span>
                    </div>
                    <span
                      className={`font-black text-xs ${
                        item.passed ? 'text-og-green' : 'text-og-red'
                      }`}
                    >
                      {item.score}%
                    </span>
                  </div>

                  <p className="text-[11px] text-og-gray-text pl-6 leading-relaxed">
                    <strong className="text-gray-700 font-semibold">Evidence: </strong>
                    "{item.evidence}"
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-og-gray-text bg-og-gray/40 rounded-xl">
                No conversation transcript available for missed or dropped call.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-og-gray-border bg-og-gray flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-og-forest hover:bg-og-forest-deep text-white rounded-lg text-xs font-bold transition-colors"
            >
              Close Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
