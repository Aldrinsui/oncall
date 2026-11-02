import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { X, TrendingUp, Award, CheckCircle2, ShieldCheck } from 'lucide-react';
import { USER } from '../../data/mockData';

export default function OgScoreModal() {
  const { ogScoreModalOpen, setOgScoreModalOpen } = useApp();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ogScoreModalOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      setTimeout(() => closeButtonRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setOgScoreModalOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        previouslyFocusedElement.current?.focus();
      };
    }
  }, [ogScoreModalOpen, setOgScoreModalOpen]);

  if (!ogScoreModalOpen) return null;

  const scorePillars = [
    { title: 'SOP Script Adherence', score: 88, weight: '30%', trend: '+4 pts', desc: 'Opening greeting, discovery questions & warranty pitch' },
    { title: 'Objection Handling', score: 79, weight: '25%', trend: '+8 pts', desc: 'EMI plan justification & competitor price defense' },
    { title: 'Lead Conversion Rate', score: 84, weight: '25%', trend: '+2 pts', desc: 'Walk-out recovery and quotation follow-ups closed' },
    { title: 'Customer Sentiment Score', score: 91, weight: '20%', trend: '+3 pts', desc: 'AI speech tone analysis and positive caller feedback' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="OG Score Performance Breakdown"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setOgScoreModalOpen(false)}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-md bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-og-forest to-og-forest-deep text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="og-ring lg" style={{ '--pct': USER.ogScore, '--ring-color': '#1d9e75' } as React.CSSProperties}>
                <span className="og-ring-val">{USER.ogScore}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-og-green-light uppercase tracking-wider">
                  Performance Metric
                </span>
                <h3 className="text-lg font-bold">OG Score™ Breakdown</h3>
                <p className="text-xs text-[#a9c4ba]">Rank #{USER.rank} in {USER.store} Store</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={() => setOgScoreModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white focus:outline-hidden focus:ring-2 focus:ring-white"
              aria-label="Close OG Score dialog"
            >
              <X size={16} />
            </button>
          </div>

          {/* Metric Summary Banner */}
          <div className="bg-emerald-50/70 p-4 border-b border-og-gray-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-og-forest font-semibold">
              <TrendingUp size={16} className="text-og-green" />
              <span>▲ +13 points since period start</span>
            </div>
            <span className="bg-og-green-bg text-og-forest font-bold px-2 py-0.5 rounded-full text-[11px]">
              72nd Percentile
            </span>
          </div>

          {/* Pillars List */}
          <div className="p-5 space-y-3.5 max-h-[60vh] overflow-y-auto">
            <span className="text-xs font-bold text-og-forest uppercase tracking-wider">
              Scoring Pillars & Evaluation
            </span>

            {scorePillars.map((pillar) => (
              <div key={pillar.title} className="p-3 border border-og-gray-border rounded-xl space-y-1.5 hover:bg-og-gray/40 transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1c1c1e]">{pillar.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-og-green font-bold">{pillar.trend}</span>
                    <span className="font-black text-sm text-og-forest">{pillar.score}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-og-gray overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-og-green to-og-green-light rounded-full transition-all duration-500"
                    style={{ width: `${pillar.score}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-og-gray-text pt-0.5">
                  <span>{pillar.desc}</span>
                  <span className="font-medium">Weight: {pillar.weight}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-og-gray-border bg-og-gray flex items-center justify-between">
            <span className="text-[11px] text-og-gray-text flex items-center gap-1">
              <ShieldCheck size={14} className="text-og-green" />
              Verified by On-Ground QA Engine
            </span>
            <button
              onClick={() => setOgScoreModalOpen(false)}
              className="px-4 py-1.5 bg-og-forest text-white rounded-lg text-xs font-bold hover:bg-og-forest-deep transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
