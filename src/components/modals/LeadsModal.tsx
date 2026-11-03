import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  Share2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CreditCard,
  Shield,
  FileText,
  Clock,
} from 'lucide-react';
import { LEADS } from '../../data/mockData';

export default function LeadsModal() {
  const {
    leadsModalOpen,
    setLeadsModalOpen,
    leadsModalPage,
    setLeadsModalPage,
    startCall,
    showToast,
  } = useApp();

  const [signalsOpen, setSignalsOpen] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const totalLeads = LEADS.length;
  const safePage = Math.max(0, Math.min(totalLeads - 1, Math.floor(Number(leadsModalPage) || 0)));
  const currentLead = LEADS[safePage] || LEADS[0];

  const pageRef = useRef(safePage);
  pageRef.current = safePage;

  // 1. Focus management: capture previous focus on modal open, restore on close
  useEffect(() => {
    if (leadsModalOpen) {
      previouslyFocusedElement.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => {
        clearTimeout(timer);
        previouslyFocusedElement.current?.focus();
      };
    }
  }, [leadsModalOpen]);

  // 2. Keyboard shortcuts: Escape (close), ArrowLeft/ArrowRight (paginate leads)
  useEffect(() => {
    if (!leadsModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLeadsModalOpen(false);
      } else if (e.key === 'ArrowRight' && pageRef.current < totalLeads - 1) {
        setLeadsModalPage(pageRef.current + 1);
      } else if (e.key === 'ArrowLeft' && pageRef.current > 0) {
        setLeadsModalPage(pageRef.current - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [leadsModalOpen, totalLeads, setLeadsModalOpen, setLeadsModalPage]);

  if (!leadsModalOpen || !currentLead) return null;

  const handleStartCall = () => {
    setLeadsModalOpen(false);
    startCall({
      id: currentLead.id,
      name: currentLead.name,
      initials: currentLead.initials,
      phone: currentLead.phone,
      avatarBg: currentLead.avatarBg,
      avatarColor: currentLead.avatarColor,
      intent: currentLead.interest,
      product: currentLead.product,
      value: `₹${currentLead.expectedValue.toLocaleString('en-IN')}`,
      personaChallenge: currentLead.emiNote,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Lead details for ${currentLead.name}`}
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setLeadsModalOpen(false)}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-lg bg-white rounded-sheet shadow-2xl overflow-hidden border border-og-gray-border animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-og-forest to-og-forest-deep text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-og-green-light uppercase tracking-wider">
                Lead Dossier
              </span>
              <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full font-semibold">
                Lead {safePage + 1} of {totalLeads}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Pagination controls */}
              <button
                onClick={() => setLeadsModalPage(Math.max(0, safePage - 1))}
                disabled={safePage <= 0}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white"
                aria-label="Previous lead"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setLeadsModalPage(Math.min(totalLeads - 1, safePage + 1))}
                disabled={safePage >= totalLeads - 1}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white"
                aria-label="Next lead"
              >
                <ChevronRight size={16} />
              </button>

              <button
                ref={closeButtonRef}
                onClick={() => setLeadsModalOpen(false)}
                className="w-7 h-7 ml-2 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white focus:outline-hidden focus:ring-2 focus:ring-white"
                aria-label="Close lead modal"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Lead Identity Card */}
            <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-og-gray/60 border border-og-gray-border">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shadow-sm flex-shrink-0"
                  style={{ backgroundColor: currentLead.avatarBg, color: currentLead.avatarColor }}
                >
                  {currentLead.initials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1c1c1e]">{currentLead.name}</h3>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: currentLead.badgeBg, color: currentLead.badgeColor }}
                    >
                      {currentLead.badge}
                    </span>
                  </div>
                  <div className="text-xs text-og-gray-text mt-0.5 flex items-center gap-1.5">
                    <span>{currentLead.phone}</span>
                    <span>•</span>
                    <span>{currentLead.source}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-black text-og-forest">
                  ₹{currentLead.expectedValue.toLocaleString('en-IN')}
                </span>
                <div className="text-[11px] font-semibold text-og-green">Expected Value</div>
              </div>
            </div>

            {/* Product Interest & Pitch Hint */}
            <div className="p-3.5 border border-emerald-200/60 rounded-xl bg-emerald-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-og-forest flex items-center gap-1.5">
                  <Sparkles size={14} className="text-og-green" />
                  Primary Interest
                </span>
                <span className="font-bold text-og-green">{currentLead.product}</span>
              </div>

              <div className="text-xs text-[#1c1c1e] bg-white p-2.5 rounded-lg border border-emerald-100">
                <div className="text-[11px] text-og-gray-text font-semibold mb-0.5">Recommended Pitch Angle:</div>
                <p className="font-medium">{currentLead.emiNote}</p>
                <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-og-gray-text">Upsell Cross-sell:</span>
                  <span className="font-bold text-og-forest">{currentLead.crossSell}</span>
                </div>
              </div>
            </div>

            {/* ICP & Lead Intent Score Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border border-og-gray-border rounded-xl text-center bg-white space-y-1">
                <span className="text-[11px] font-bold text-og-gray-text uppercase tracking-wider">
                  ICP Fit Score
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black" style={{ color: currentLead.icpColor }}>
                    {currentLead.icp}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-og-gray rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${currentLead.icp}%`, backgroundColor: currentLead.icpColor }}
                  />
                </div>
                <span className="text-[10px] text-og-gray-text">Profile & Budget Match</span>
              </div>

              <div className="p-3 border border-og-gray-border rounded-xl text-center bg-white space-y-1">
                <span className="text-[11px] font-bold text-og-gray-text uppercase tracking-wider">
                  Lead Intent Score
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black" style={{ color: currentLead.intentColor }}>
                    {currentLead.intent}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-og-gray rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${currentLead.intent}%`, backgroundColor: currentLead.intentColor }}
                  />
                </div>
                <span className="text-[10px] text-og-gray-text">Purchase Propensity</span>
              </div>
            </div>

            {/* Collapsible Buying Signals Section */}
            <div className="border border-og-gray-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setSignalsOpen(!signalsOpen)}
                className="w-full flex items-center justify-between p-3 bg-og-gray/50 hover:bg-og-gray text-xs font-bold text-og-forest transition-colors"
                aria-expanded={signalsOpen}
              >
                <div className="flex items-center gap-2">
                  <span>Where We Picked Up Signals</span>
                  <span className="bg-og-green-bg text-og-green px-1.5 py-0.5 rounded text-[10px]">
                    {currentLead.buyingSignals.length} signals
                  </span>
                </div>
                {signalsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {signalsOpen && (
                <div className="p-3 space-y-2 bg-white divide-y divide-og-gray-border animate-fade-in">
                  {currentLead.buyingSignals.map((sig, idx) => (
                    <div key={idx} className={`flex items-start gap-2.5 ${idx > 0 ? 'pt-2' : ''}`}>
                      <span className="text-base flex-shrink-0" aria-hidden="true">{sig.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#1c1c1e]">{sig.label}</span>
                        <p className="text-[11px] text-og-gray-text leading-snug mt-0.5">{sig.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer with Actions */}
          <div className="p-4 border-t border-og-gray-border bg-og-gray flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => showToast(`[Demo Simulation] Prepared quote for ${currentLead.product}`)}
                className="p-2 bg-white hover:bg-gray-100 text-[#1c1c1e] border border-og-gray-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Share quotation"
              >
                <Share2 size={14} />
                <span className="hidden sm:inline">Quote</span>
              </button>
              <button
                onClick={() => showToast(`[Demo Simulation] Generated WhatsApp chat link for ${currentLead.name}`)}
                className="p-2 bg-white hover:bg-gray-100 text-[#1c1c1e] border border-og-gray-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Send WhatsApp"
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            </div>

            <button
              onClick={handleStartCall}
              className="px-5 py-2.5 bg-og-green hover:bg-og-forest text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <PhoneCall size={15} />
              <span>Call Lead Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
