import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PhoneCall,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { LEADS } from '../../data/mockData';
import type { Lead } from '../../types';

export default function CallsToMake() {
  const {
    startCall,
    setLeadsModalOpen,
    setLeadsModalPage,
  } = useApp();

  // Sort leads strictly by attractivenessScore descending (P1 fix)
  const sortedLeads = useMemo(() => {
    return [...LEADS].sort((a, b) => b.attractivenessScore - a.attractivenessScore);
  }, []);

  const [expandedRow, setExpandedRow] = useState<string | null>(sortedLeads[0].id);
  const [page, setPage] = useState(0);

  const pageSize = 2; // 2 leads per page -> 3 pages for 6 leads
  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const displayedLeads = sortedLeads.slice(page * pageSize, (page + 1) * pageSize);

  const toggleExpand = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleStartCall = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    startCall({
      id: lead.id,
      name: lead.name,
      initials: lead.initials,
      phone: lead.phone,
      avatarBg: lead.avatarBg,
      avatarColor: lead.avatarColor,
      intent: lead.interest,
      product: lead.product,
      value: `₹${lead.expectedValue.toLocaleString('en-IN')}`,
      personaChallenge: lead.emiNote,
    });
  };

  const handleOpenDossier = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Resolve lead record by stable ID, not displayed pagination index
    const indexInMasterList = LEADS.findIndex((l) => l.id === leadId);
    setLeadsModalPage(indexInMasterList !== -1 ? indexInMasterList : 0);
    setLeadsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Lead List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-og-gray-border gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#1c1c1e]">Prioritized Outgoing Queue</h3>
          <p className="text-xs text-og-gray-text">
            Ranked strictly by AI Propensity Score & Attractiveness in descending order
          </p>
        </div>

        {/* Pagination Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-semibold text-og-gray-text">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="w-7 h-7 rounded-lg border border-og-gray-border bg-white hover:bg-og-gray disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-[#1c1c1e] transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="w-7 h-7 rounded-lg border border-og-gray-border bg-white hover:bg-og-gray disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-[#1c1c1e] transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Leads Rows */}
      <div className="space-y-3">
        {displayedLeads.map((lead, idx) => {
          const globalRank = page * pageSize + idx + 1;
          const isExpanded = expandedRow === lead.id;

          return (
            <div
              key={lead.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isExpanded
                  ? 'bg-white border-og-green/40 shadow-sm'
                  : 'bg-white border-og-gray-border hover:border-gray-300'
              }`}
            >
              {/* Row Header — keyboard accessible */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand(lead.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(lead.id);
                  }
                }}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none focus:outline-hidden focus:bg-og-gray/30"
                aria-expanded={isExpanded}
                aria-label={`Lead rank #${globalRank}: ${lead.name}, Score: ${lead.attractivenessScore}. Press Enter to toggle details.`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank & Avatar */}
                  <span className="text-xs font-black text-og-forest w-5">#{globalRank}</span>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-xs flex-shrink-0"
                    style={{ backgroundColor: lead.avatarBg, color: lead.avatarColor }}
                  >
                    {lead.initials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#1c1c1e]">{lead.name}</h4>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: lead.badgeBg, color: lead.badgeColor }}
                      >
                        {lead.badge}
                      </span>
                      <span className="text-[10px] font-black text-og-green bg-emerald-50 px-1.5 py-0.5 rounded">
                        Score: {lead.attractivenessScore}
                      </span>
                    </div>
                    <div className="text-xs text-og-gray-text mt-0.5 truncate">
                      {lead.interest}
                    </div>
                  </div>
                </div>

                {/* Right side: Scores & Quick Call */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-og-gray-border">
                  <div className="flex items-center gap-2 text-right">
                    <div className="px-2 py-1 rounded-lg bg-emerald-50 text-og-green text-center">
                      <div className="text-[9px] font-bold uppercase tracking-wider">ICP</div>
                      <div className="text-xs font-black">{lead.icp}%</div>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-teal-50 text-teal-800 text-center">
                      <div className="text-[9px] font-bold uppercase tracking-wider">Intent</div>
                      <div className="text-xs font-black">{lead.intent}%</div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleStartCall(lead, e)}
                    className="px-3.5 py-1.5 bg-og-green hover:bg-og-forest text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    aria-label={`Call ${lead.name}`}
                  >
                    <PhoneCall size={13} />
                    <span>Call</span>
                  </button>

                  <span className="p-1 rounded-md text-og-gray-text hover:text-[#1c1c1e] hover:bg-og-gray">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </div>
              </div>

              {/* Expandable Row Body */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-og-gray-border bg-emerald-50/20 space-y-3 animate-fade-in text-xs">
                  {/* Pitch Angle & Cross-sell */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-white rounded-xl border border-og-gray-border space-y-1">
                      <span className="text-[10px] font-bold text-og-forest uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={12} className="text-og-green" />
                        Recommended Pitch Strategy
                      </span>
                      <p className="text-[#1c1c1e] font-medium leading-relaxed">{lead.emiNote}</p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-og-gray-border space-y-1">
                      <span className="text-[10px] font-bold text-og-forest uppercase tracking-wider flex items-center gap-1">
                        <CreditCard size={12} className="text-og-green" />
                        Attachment / Cross-sell
                      </span>
                      <p className="font-bold text-og-green">{lead.crossSell}</p>
                      <p className="text-[11px] text-og-gray-text">Bundle with 10% discount if ordered today</p>
                    </div>
                  </div>

                  {/* Buying Signals Strip */}
                  <div className="p-2.5 bg-white rounded-xl border border-og-gray-border flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-og-gray-text">Signals:</span>
                    {lead.buyingSignals.map((sig, sIdx) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center gap-1 text-[11px] bg-og-gray px-2 py-0.5 rounded-md text-gray-700 font-medium"
                      >
                        <span aria-hidden="true">{sig.icon}</span>
                        <span>{sig.label}</span>
                      </span>
                    ))}
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={(e) => handleOpenDossier(lead.id, e)}
                      className="text-xs font-bold text-og-green hover:text-og-forest flex items-center gap-1"
                    >
                      <FileText size={14} />
                      <span>Open Full Lead Dossier & Signals</span>
                    </button>

                    <button
                      onClick={(e) => handleStartCall(lead, e)}
                      className="px-4 py-2 bg-og-forest hover:bg-og-forest-deep text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <PhoneCall size={14} />
                      <span>Start Outbound Call</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Paging Info */}
      <div className="flex items-center justify-between pt-3 text-xs text-og-gray-text">
        <span>Showing {displayedLeads.length} of {sortedLeads.length} ranked leads</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded-lg border border-og-gray-border bg-white hover:bg-og-gray disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 rounded-lg border border-og-gray-border bg-white hover:bg-og-gray disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
